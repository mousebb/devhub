import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { ConfigManager } from './config-manager'
import { LogStore, serviceKey } from './log-store'
import type { ProjectConfig, ServiceConfig, ServiceRuntime, ServiceStatus, TerminalMode } from '@shared/types'

interface ManagedProcess {
  runtime: ServiceRuntime
  child?: ChildProcess
  /** 用户主动停止（区分崩溃/退出，决定是否自动重启） */
  manualStop: boolean
  stopPromise?: Promise<void>
  partial: { out: string; err: string }
}

/** 落盘的运行记录条目（runtime.json） */
interface RunRegistryEntry {
  pid: number
  terminalMode: TerminalMode
  startedAt: number
  command: string
  cwd: string
}

const GRACE_MS = 3000

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ManagedProcess>()
  /** 运行记录落盘路径（用于重启后恢复孤儿进程），为空则不持久化 */
  private runRegistryPath = ''

  constructor(
    private config: ConfigManager,
    private logs: LogStore,
    runRegistryPath = ''
  ) {
    super()
    this.runRegistryPath = runRegistryPath
  }

  /* ------------------------------------------------------------------ */
  /* 查询                                                                */
  /* ------------------------------------------------------------------ */

  get(projectId: string, serviceId: string): ServiceRuntime {
    const existing = this.processes.get(serviceKey(projectId, serviceId))
    if (existing) return { ...existing.runtime }
    return { projectId, serviceId, status: 'stopped' }
  }

  snapshot(): ServiceRuntime[] {
    return [...this.processes.values()].map((p) => ({ ...p.runtime }))
  }

  isRunning(projectId: string, serviceId: string): boolean {
    const s = this.processes.get(serviceKey(projectId, serviceId))?.runtime.status
    return s === 'running' || s === 'starting'
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                                */
  /* ------------------------------------------------------------------ */

  async start(projectId: string, serviceId: string): Promise<ServiceRuntime> {
    const found = this.config.getService(projectId, serviceId)
    if (!found) return { projectId, serviceId, status: 'error', error: '服务不存在' }
    const { project, service } = found

    const key = serviceKey(projectId, serviceId)
    const existing = this.processes.get(key)
    if (existing && (existing.runtime.status === 'running' || existing.runtime.status === 'starting')) {
      return { ...existing.runtime }
    }

    const cwd = (service.cwd || project.path || '').trim()
    if (!cwd) return this.fail(projectId, serviceId, '未配置工作目录')
    if (!existsSync(cwd)) return this.fail(projectId, serviceId, `工作目录不存在：${cwd}`)
    if (!service.command.trim()) return this.fail(projectId, serviceId, '未配置启动命令')

    const runtime: ServiceRuntime = {
      projectId,
      serviceId,
      status: 'starting',
      startedAt: Date.now(),
      restarts: existing?.runtime.restarts ?? 0
    }
    const managed: ManagedProcess = {
      runtime,
      manualStop: false,
      partial: { out: '', err: '' }
    }
    this.processes.set(key, managed)
    this.emitStatus(managed)

    this.logSystem(
      managed,
      `$ ${service.command}\n# cwd: ${cwd}${service.env.length ? `\n# env: ${service.env.map((e) => e.key).join(', ')}` : ''}`
    )

    if (service.terminalMode === 'devhub') {
      this.spawnInternal(managed, project, service, cwd)
    } else {
      this.spawnExternal(managed, service, cwd)
    }

    return { ...runtime }
  }

  /**
   * 构造被托管服务的运行环境。
   * 关键：DevHub 自身是打包后的 Electron 应用，其 process.env.NODE_ENV 为 'production'
   * （这是 DevHub 自己的构建模式，不是用户服务的环境）。若不剔除，会被子进程继承，
   * 导致用户的 dev 服务误判为生产环境（例如触发生产安全校验而拒绝启动）。
   * 服务若确实需要生产环境，应在自己的 .env / npm script 里声明，或在下方 service.env
   * 显式设置（service.env 在剔除之后应用，会覆盖）。
   */
  private buildServiceEnv(service: ServiceConfig): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env }
    // DevHub 自身是打包后的 Electron 应用，其运行期环境变量不该泄漏给被托管的服务：
    //  - NODE_ENV=production 会让 dev 服务误判为生产环境（触发生产安全校验而拒绝启动）；
    //  - ELECTRON_* / npm_config_electron* 只与「安装 electron」有关，用户服务用不到，
    //    还会让子进程里的 npm 打印 "Unknown env config" 警告。
    // 服务若确实需要这些变量，应在自己的 .env / npm script 里声明，或在 service.env 显式设置（下方会覆盖）。
    for (const key of Object.keys(env)) {
      if (key === 'NODE_ENV' || key.startsWith('ELECTRON_') || key.toLowerCase().startsWith('npm_config_electron')) {
        delete env[key]
      }
    }
    // 强制 Python 无缓冲：DevHub 通过管道捕获输出（非 TTY），Python 默认块缓冲，
    // 长驻进程（如 http server）的启动 banner / 日志会卡在缓冲区不刷新，日志面板看不到。
    // 该变量仅 Python 解释器识别，对 node/npm 等其它进程完全无副作用。
    env.PYTHONUNBUFFERED = '1'
    for (const item of service.env) {
      if (item.key) env[item.key] = item.value
    }
    return env
  }

  private spawnInternal(managed: ManagedProcess, project: ProjectConfig, service: ServiceConfig, cwd: string) {
    const env = this.buildServiceEnv(service)

    let child: ChildProcess
    try {
      child = spawn(service.command, {
        cwd,
        env,
        shell: true, // Windows 下 npm/npx/pnpm 都是 .cmd，必须走 shell
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (err) {
      this.onFailure(managed, err instanceof Error ? err.message : String(err))
      return
    }
    managed.child = child
    managed.runtime.pid = child.pid
    managed.runtime.status = 'running'
    this.emitStatus(managed)

    // 按 utf8 解码，避免中文输出被分包截断成乱码
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')

    const pushLines = (stream: 'stdout' | 'stderr') => (chunk: Buffer | string) => {
      const text = chunk.toString()
      for (const line of this.logs.append(managed.runtime.projectId, managed.runtime.serviceId, stream, text)) {
        this.emit('log', line)
      }
    }

    child.stdout?.on('data', pushLines('stdout'))
    child.stderr?.on('data', pushLines('stderr'))

    child.on('error', (err) => {
      this.onFailure(managed, err.message)
    })

    child.on('exit', (code, signal) => {
      managed.child = undefined
      managed.runtime.exitedAt = Date.now()
      managed.runtime.exitCode = code
      managed.runtime.pid = undefined
      const wasRunning = managed.runtime.status === 'running'
      managed.runtime.status = managed.manualStop || code === 0 ? 'stopped' : 'exited'
      this.emitStatus(managed)
      this.logSystem(managed, `# 进程退出 code=${code} signal=${signal ?? 'none'}`)

      if (!managed.manualStop && service.autoRestart && code !== 0 && wasRunning) {
        const n = (managed.runtime.restarts ?? 0) + 1
        if (n <= 10) {
          managed.runtime.restarts = n
          const delay = Math.min(1000 * n, 5000)
          this.logSystem(managed, `# 将在 ${delay}ms 后自动重启（第 ${n} 次）`)
          setTimeout(() => {
            void this.restart(managed.runtime.projectId, managed.runtime.serviceId)
          }, delay)
        }
      }
    })
  }

  /** 外部终端模式：无法捕获输出，但可交互 */
  private spawnExternal(managed: ManagedProcess, service: ServiceConfig, cwd: string) {
    const env = this.buildServiceEnv(service)
    const opts = { cwd, env, detached: true, stdio: 'ignore' as const, windowsHide: false }
    const launch = (mode: TerminalMode) => {
      if (mode === 'powershell') return spawn('powershell.exe', ['-NoExit', '-Command', service.command], opts)
      if (mode === 'terminal') return spawn('wt.exe', ['-d', cwd, 'cmd', '/k', service.command], opts)
      return spawn('cmd.exe', ['/k', service.command], opts)
    }

    let child: ChildProcess
    try {
      child = launch(service.terminalMode)
    } catch (err) {
      this.onFailure(managed, err instanceof Error ? err.message : String(err))
      return
    }
    managed.child = child
    child.unref()
    managed.runtime.pid = child.pid
    managed.runtime.status = 'running'
    managed.runtime.external = true
    this.emitStatus(managed)
    this.logSystem(
      managed,
      `# 已在外部窗口启动（${service.terminalMode}），日志请查看对应终端窗口`
    )

    child.on('error', (err) => {
      if (service.terminalMode === 'terminal') {
        this.logSystem(managed, `# Windows Terminal 不可用，回退到 CMD：${err.message}`)
        const fallback = spawn('cmd.exe', ['/k', service.command], opts)
        fallback.unref()
        managed.child = fallback
        managed.runtime.pid = fallback.pid
        this.emitStatus(managed)
        fallback.on('exit', () => this.markExternalStopped(managed))
        return
      }
      this.onFailure(managed, err.message)
    })

    child.on('exit', () => this.markExternalStopped(managed))
  }

  private markExternalStopped(managed: ManagedProcess) {
    managed.runtime.status = 'stopped'
    managed.runtime.pid = undefined
    managed.runtime.exitedAt = Date.now()
    this.emitStatus(managed)
  }

  private onFailure(managed: ManagedProcess, message: string) {
    managed.runtime.status = 'error'
    managed.runtime.error = message
    managed.runtime.pid = undefined
    this.emitStatus(managed)
    this.logSystem(managed, `启动失败：${message}`)
  }

  private fail(projectId: string, serviceId: string, message: string): ServiceRuntime {
    const runtime: ServiceRuntime = { projectId, serviceId, status: 'error', error: message }
    const managed: ManagedProcess = { runtime, manualStop: true, partial: { out: '', err: '' } }
    this.processes.set(serviceKey(projectId, serviceId), managed)
    this.emitStatus(managed)
    this.logSystem(managed, `启动失败：${message}`)
    return runtime
  }

  /** 写一条系统日志并推送给渲染进程 */
  private logSystem(managed: ManagedProcess, text: string) {
    const { projectId, serviceId } = managed.runtime
    for (const line of this.logs.system(projectId, serviceId, text)) this.emit('log', line)
  }

  /* ------------------------------------------------------------------ */
  /* 停止                                                                */
  /* ------------------------------------------------------------------ */

  async stop(projectId: string, serviceId: string): Promise<void> {
    const key = serviceKey(projectId, serviceId)
    const managed = this.processes.get(key)
    if (!managed) return
    if (managed.stopPromise) return managed.stopPromise

    managed.manualStop = true
    managed.stopPromise = this.doStop(managed).finally(() => {
      managed.stopPromise = undefined
    })
    return managed.stopPromise
  }

  private async doStop(managed: ManagedProcess): Promise<void> {
    const { projectId, serviceId } = managed.runtime
    if (managed.runtime.status !== 'running' && managed.runtime.status !== 'starting') {
      this.processes.delete(serviceKey(projectId, serviceId))
      return
    }
    const pid = managed.runtime.pid
    this.logSystem(managed, '# 正在停止服务…')
    managed.runtime.status = 'stopped'
    managed.runtime.pid = undefined
    this.emitStatus(managed)

    if (!pid) {
      this.processes.delete(serviceKey(projectId, serviceId))
      return
    }

    // 1) 优雅阶段：关闭 stdin，给进程 GRACE_MS 时间自行退出
    try {
      managed.child?.stdin?.end()
    } catch {
      /* ignore */
    }
    const exited = await this.waitExit(pid, GRACE_MS)
    if (exited) {
      this.logSystem(managed, `# 服务已退出（PID ${pid}）`)
      this.processes.delete(serviceKey(projectId, serviceId))
      return
    }

    // 2) 强制阶段：杀掉整棵进程树（npm -> node -> 子进程）
    const ok = await this.killTree(pid)
    this.logSystem(managed, ok ? `# 已强制结束进程树（PID ${pid}）` : `# 无法结束进程树（PID ${pid}），请手动检查`)
    this.processes.delete(serviceKey(projectId, serviceId))
  }

  async restart(projectId: string, serviceId: string): Promise<void> {
    await this.stop(projectId, serviceId)
    await this.start(projectId, serviceId)
  }

  /* ------------------------------------------------------------------ */
  /* 项目级批量操作                                                       */
  /* ------------------------------------------------------------------ */

  async startAll(projectId: string): Promise<void> {
    const project = this.config.getProject(projectId)
    if (!project) return
    for (const service of project.services) {
      if (!service.enabled) continue
      await this.start(projectId, service.id)
      if (service.startupDelay > 0) await sleep(service.startupDelay)
    }
  }

  async stopAll(projectId: string): Promise<void> {
    const project = this.config.getProject(projectId)
    if (!project) return
    for (const service of [...project.services].reverse()) {
      await this.stop(projectId, service.id)
    }
  }

  async restartAll(projectId: string): Promise<void> {
    await this.stopAll(projectId)
    await this.startAll(projectId)
  }

  /** 分组级启停：遍历同 group 的所有项目，按服务顺序启动/停止（保留每个服务的 startupDelay 与 enabled） */
  async startGroup(group: string): Promise<void> {
    const members = this.config.get().projects.filter((p) => p.group === group)
    for (const project of members) {
      for (const service of project.services) {
        if (!service.enabled) continue
        await this.start(project.id, service.id)
        if (service.startupDelay > 0) await sleep(service.startupDelay)
      }
    }
  }

  async stopGroup(group: string): Promise<void> {
    const members = this.config.get().projects.filter((p) => p.group === group)
    for (const project of members) {
      for (const service of [...project.services].reverse()) {
        await this.stop(project.id, service.id)
      }
    }
  }

  /** 应用退出：尽最大努力结束所有子进程树 */
  async stopEverything(): Promise<void> {
    const pending = [...this.processes.values()]
    await Promise.all(
      pending.map(async (managed) => {
        const pid = managed.runtime.pid
        managed.manualStop = true
        if (pid) await this.killTree(pid)
        this.processes.delete(serviceKey(managed.runtime.projectId, managed.runtime.serviceId))
      })
    )
  }

  /* ------------------------------------------------------------------ */
  /* 进程工具                                                            */
  /* ------------------------------------------------------------------ */

  private waitExit(pid: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    return new Promise((resolve) => {
      const tick = () => {
        if (!isAlive(pid)) {
          resolve(true)
          return
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(false)
          return
        }
        setTimeout(tick, 200)
      }
      tick()
    })
  }

  private killTree(pid: number): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(
        'taskkill',
        ['/PID', String(pid), '/T', '/F'],
        { windowsHide: true },
        (err) => resolve(!err)
      )
    })
  }

  private emitStatus(managed: ManagedProcess) {
    this.emit('status', { ...managed.runtime })
    this.persistRunRegistry()
  }

  /* ------------------------------------------------------------------ */
  /* 运行记录（落盘，用于重启后恢复孤儿进程）                              */
  /* ------------------------------------------------------------------ */

  /**
   * 把当前「运行中/启动中」的服务写入 runtime.json。
   * 这是恢复孤儿进程的唯一信息源：进程真正拿到 PID 时才登记，
   * 停止/退出（状态不再是 running/starting）时自动剔除。
   */
  private persistRunRegistry() {
    if (!this.runRegistryPath) return
    const reg: Record<string, RunRegistryEntry> = {}
    for (const [key, managed] of this.processes) {
      const st = managed.runtime.status
      if ((st === 'running' || st === 'starting') && managed.runtime.pid) {
        const found = this.config.getService(managed.runtime.projectId, managed.runtime.serviceId)
        if (!found) continue
        reg[key] = {
          pid: managed.runtime.pid,
          terminalMode: found.service.terminalMode,
          startedAt: managed.runtime.startedAt ?? Date.now(),
          command: found.service.command,
          cwd: found.service.cwd || found.project.path
        }
      }
    }
    try {
      const tmp = `${this.runRegistryPath}.tmp`
      writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf-8')
      renameSync(tmp, this.runRegistryPath)
    } catch {
      /* 写入失败不阻塞主流程 */
    }
  }

  /**
   * 启动时调用：读回上次会话运行记录，把仍然存活的进程重新登记为「运行中」。
   * 无法捕获它们的实时输出（进程树已不属于本进程），所以标记 recovered。
   * 已死的 PID 会从记录里清掉（自洁），不会留下幽灵条目。
   */
  recoverOrphans(): void {
    if (!this.runRegistryPath) return
    let raw: Record<string, RunRegistryEntry> = {}
    try {
      if (existsSync(this.runRegistryPath)) {
        raw = JSON.parse(readFileSync(this.runRegistryPath, 'utf-8'))
      }
    } catch {
      raw = {}
    }

    const survivors: Record<string, RunRegistryEntry> = {}
    for (const [key, info] of Object.entries(raw)) {
      if (info && isAlive(info.pid)) survivors[key] = info
    }

    // 自洁：剔除已死进程，避免 runtime.json 无限膨胀
    if (Object.keys(survivors).length !== Object.keys(raw).length) {
      try {
        const tmp = `${this.runRegistryPath}.tmp`
        writeFileSync(tmp, JSON.stringify(survivors, null, 2), 'utf-8')
        renameSync(tmp, this.runRegistryPath)
      } catch {
        /* ignore */
      }
    }

    for (const [key, info] of Object.entries(survivors)) {
      const idx = key.indexOf('::')
      if (idx < 0) continue
      const projectId = key.slice(0, idx)
      const serviceId = key.slice(idx + 2)
      if (!this.config.getService(projectId, serviceId)) continue
      const managed: ManagedProcess = {
        runtime: {
          projectId,
          serviceId,
          status: 'running',
          pid: info.pid,
          startedAt: info.startedAt ?? Date.now(),
          external: info.terminalMode !== 'devhub',
          recovered: true
        },
        manualStop: false,
        partial: { out: '', err: '' }
      }
      this.processes.set(key, managed)
      this.emitStatus(managed)
      this.logSystem(
        managed,
        `# 已从上次会话恢复（PID ${info.pid}）。实时日志不可用，但可在此停止该进程。`
      )
    }
  }
}

export function isAlive(pid: number | undefined): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0) // signal 0：仅检测进程是否存在
    return true
  } catch {
    return false
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type { ServiceStatus }
