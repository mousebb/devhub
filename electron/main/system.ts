import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { shell } from 'electron'
import type { EnvInfoEntry, PortCheckResult, ToolInfo } from '@shared/types'

function run(cmd: string, args: string[], timeout = 8000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({ code: err ? (err as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0, stdout: stdout ?? '', stderr: stderr ?? '' })
      }
    )
  })
}

/** where 命令：返回可执行文件绝对路径（第一个匹配） */
export async function whereFull(name: string): Promise<string | undefined> {
  const res = await run('where', [name], 5000)
  if (res.code !== 0) return undefined
  const first = res.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
  return first
}

export async function getTools(): Promise<ToolInfo[]> {
  // 注意：`arg` 缺省表示「只探测是否存在、不执行」。
  // Windows Terminal (wt.exe) 不支持 --version，一旦执行就会弹出「Windows 终端」信息框（标题 Help），
  // 所以只 where 定位，绝不运行它。
  const tools: { name: string; arg?: string; exe?: string }[] = [
    { name: 'node', arg: '--version' },
    { name: 'npm', arg: '--version' },
    { name: 'pnpm', arg: '--version' },
    { name: 'yarn', arg: '--version' },
    { name: 'python', arg: '--version' },
    { name: 'git', arg: '--version' },
    { name: 'code', arg: '--version' },
    { name: 'flutter', arg: '--version' },
    { name: 'go', arg: 'version' },
    { name: 'dotnet', arg: '--version' },
    { name: 'wt', exe: 'wt.exe' }
  ]
  const results = await Promise.all(
    tools.map(async (tool) => {
      const path = await whereFull(tool.exe ?? tool.name)
      if (!path) return { name: tool.name, found: false }
      if (!tool.arg) return { name: tool.name, found: true, path }
      const res = await run(tool.name, [tool.arg], 8000)
      // 只取「看起来像版本号」的那一行：真实版本号一定含数字。
      // 某些工具（例如没装 SDK 的 dotnet）会把多行错误说明打到 stderr，
      // 直接取首行会把 "The command could not be loaded, possibly because:" 当成版本号显示出来。
      const version = (res.stdout || res.stderr)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => /\d/.test(l))
      return { name: tool.name, found: true, path, version }
    })
  )
  return results
}

/** 只读：展示 DevHub 当前继承的环境变量（绝不修改） */
export function getEnvInfo(): EnvInfoEntry[] {
  const keys = ['PATH', 'NODE_PATH', 'PYTHONPATH', 'JAVA_HOME', 'ANDROID_HOME', 'PUB_CACHE']
  // 未设置时返回空串，由渲染层按当前语言显示「未设置 / not set」
  return keys.map((key) => ({ key, value: process.env[key] ?? '' }))
}

export async function checkPorts(ports: number[]): Promise<PortCheckResult[]> {
  const unique = [...new Set(ports.filter((p) => Number.isFinite(p) && p > 0))]
  if (!unique.length) return []
  const res = await run('netstat', ['-ano', '-p', 'TCP'], 10000)
  const lines = res.stdout.split(/\r?\n/)
  const listeners = new Set<number>()
  const pidByPort = new Map<number, number>()
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.toUpperCase().includes('LISTENING')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 5) continue
    const local = parts[1]
    const pid = Number(parts[parts.length - 1])
    const port = Number(local.split(':').pop())
    if (!Number.isFinite(port)) continue
    listeners.add(port)
    if (Number.isFinite(pid) && !pidByPort.has(port)) pidByPort.set(port, pid)
  }

  const pids = [...new Set(unique.map((p) => pidByPort.get(p)).filter((v): v is number => Boolean(v)))]
  const names = new Map<number, string>()
  await Promise.all(
    pids.map(async (pid) => {
      const r = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], 6000)
      const first = r.stdout.split(/\r?\n/).find((l) => l.includes(',')) ?? ''
      const name = first.split(',')[0]?.replace(/"/g, '').trim()
      if (name) names.set(pid, name)
    })
  )

  return unique.map((port) => {
    const inUse = listeners.has(port)
    const pid = pidByPort.get(port)
    return {
      port,
      inUse,
      pid: inUse ? pid : undefined,
      processName: inUse && pid ? names.get(pid) : undefined
    }
  })
}

/* ------------------------------ 打开外部程序 ------------------------------ */

export async function openVSCode(target: string): Promise<{ ok: boolean; message?: string }> {
  const path = await whereFull('code')
  if (!path) return { ok: false, message: '未检测到 VS Code（code 命令）。DevHub 不会自动安装。' }
  spawn('cmd.exe', ['/c', 'start', '', 'code', target], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  return { ok: true }
}

export async function openExplorer(target: string): Promise<{ ok: boolean; message?: string }> {
  const res = await shell.openPath(target)
  return res ? { ok: false, message: res } : { ok: true }
}

