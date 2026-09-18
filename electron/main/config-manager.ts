import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { app } from 'electron'
import { normalizeLang } from '@shared/i18n'
import {
  AppConfig,
  CONFIG_VERSION,
  EnvVar,
  ProjectConfig,
  ServiceConfig,
  STACK_KINDS,
  StackKind,
  createDefaultSettings,
  createId
} from '@shared/types'

/**
 * Electron 默认的 userData 目录（%APPDATA%\<appName>）。
 * 主进程稍后会用 app.setPath('userData', …) 把运行数据重定向到 DevHub 目录，
 * 所以必须在模块加载时（重定向之前）先记下来，供旧数据迁移使用。
 */
const legacyUserDataDir = ((): string => {
  try {
    return app.getPath('userData')
  } catch {
    return ''
  }
})()

/**
 * 数据根目录：DevHub 自身的运行目录，而不是 C 盘用户目录。
 * 优先级：DEVHUB_DATA_DIR 环境变量 > 打包时的 exe 目录 > 开发时的 cwd。
 */
export function resolveDataDir(): string {
  const override = process.env.DEVHUB_DATA_DIR
  if (override) return resolve(override)
  const base = app.isPackaged ? dirname(app.getPath('exe')) : process.cwd()
  return join(base, 'data')
}

/**
 * 配置管理
 *
 * 配置与日志统一放在 **DevHub 自己所在的目录**（`<base>/data`），不再写 C 盘用户目录：
 * - 开发运行（npm run dev / npm start）：`process.cwd()`，即项目根，例如 E:\prj\devhub\data
 * - 打包运行：exe 所在目录下的 `data`（portable 风格）
 * - 可用环境变量 `DEVHUB_DATA_DIR` 覆盖
 *
 * 仍然**绝不写入用户的「项目」目录**（被管理项目），只落在 DevHub 自身目录。
 */
export class ConfigManager {
  readonly dataDir: string
  readonly configPath: string
  readonly logDir: string
  private config: AppConfig

  constructor() {
    this.dataDir = resolveDataDir()
    this.configPath = join(this.dataDir, 'config.json')
    this.logDir = join(this.dataDir, 'logs')
    // 迁移必须在建目录之前：否则 logs 目录已存在，旧日志搬不过来
    this.migrateLegacyConfig()
    this.ensureDirs()
    this.config = this.load()
  }

  private ensureDirs() {
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })
    if (!existsSync(this.logDir)) mkdirSync(this.logDir, { recursive: true })
  }

  /**
   * 旧版本把数据放在 %APPDATA%\<appName>，这里做一次性搬家，
   * 免得用户升级后「项目全没了」。
   */
  private migrateLegacyConfig() {
    try {
      if (existsSync(this.configPath)) return
      const legacyDir = legacyUserDataDir
      if (!legacyDir || legacyDir === this.dataDir) return
      const legacyConfig = join(legacyDir, 'config.json')
      if (!existsSync(legacyConfig)) return
      if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })
      copyFileSync(legacyConfig, this.configPath)
      const legacyLogs = join(legacyDir, 'logs')
      if (existsSync(legacyLogs) && !existsSync(this.logDir)) {
        cpSync(legacyLogs, this.logDir, { recursive: true })
      }
      console.log(`[DevHub] 已把配置从 ${legacyDir} 迁移到 ${this.dataDir}`)
    } catch (err) {
      console.error('[DevHub] 旧配置迁移失败（不影响使用）', err)
    }
  }

  get(): AppConfig {
    return this.config
  }

  private load(): AppConfig {
    let raw: unknown = null
    if (existsSync(this.configPath)) {
      try {
        raw = JSON.parse(readFileSync(this.configPath, 'utf-8'))
      } catch (err) {
        const backup = this.configPath.replace(/\.json$/, `.corrupt-${Date.now()}.json`)
        try {
          renameSync(this.configPath, backup)
        } catch {
          /* ignore */
        }
        console.error('[DevHub] config.json 解析失败，已备份到', backup, err)
        raw = null
      }
    }
    return this.normalize(raw)
  }

  /** 容错：任何缺失字段都补齐，避免旧版本/手改配置导致崩溃 */
  private normalize(raw: unknown): AppConfig {
    const input = (raw ?? {}) as Partial<AppConfig>
    const settings = { ...createDefaultSettings(), ...(input.settings ?? {}) }
    // 语言/运行方式等枚举字段可能被手改成非法值，统一收敛回合法值
    settings.language = normalizeLang(settings.language)
    const projects = Array.isArray(input.projects) ? input.projects.map(normalizeProject) : []
    return { version: CONFIG_VERSION, settings, projects }
  }

  save(next?: AppConfig): AppConfig {
    if (next) this.config = this.normalize(next)
    const tmp = `${this.configPath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.config, null, 2), 'utf-8')
    renameSync(tmp, this.configPath)
    return this.config
  }

  update(mutator: (config: AppConfig) => void): AppConfig {
    mutator(this.config)
    return this.save()
  }

  getProject(id: string): ProjectConfig | undefined {
    return this.config.projects.find((p) => p.id === id)
  }

  getService(projectId: string, serviceId: string): { project: ProjectConfig; service: ServiceConfig } | undefined {
    const project = this.getProject(projectId)
    if (!project) return undefined
    const service = project.services.find((s) => s.id === serviceId)
    if (!service) return undefined
    return { project, service }
  }

  /** 导出：剔除 secret 环境变量的值 */
  toExportPayload(): string {
    const clone: AppConfig = JSON.parse(JSON.stringify(this.config))
    for (const p of clone.projects) {
      for (const s of p.services) {
        s.env = s.env.map((e) => (e.secret ? { key: e.key, value: '', secret: true } : e))
      }
    }
    return JSON.stringify(clone, null, 2)
  }

  /** 导入：兼容任意来源的 JSON */
  static parseImport(text: string): AppConfig | undefined {
    try {
      const parsed = JSON.parse(text)
      if (!parsed || !Array.isArray(parsed.projects)) return undefined
      const settings = { ...createDefaultSettings(), ...(parsed.settings ?? {}) }
      return {
        version: CONFIG_VERSION,
        settings,
        projects: parsed.projects.map(normalizeProject)
      }
    } catch {
      return undefined
    }
  }
}

function normalizeProject(input: ProjectConfig, index: number): ProjectConfig {
  const now = Date.now()
  const project: ProjectConfig = {
    id: typeof input?.id === 'string' && input.id ? input.id : createId('prj'),
    name: typeof input?.name === 'string' && input.name ? input.name : `Project ${index + 1}`,
    path: typeof input?.path === 'string' ? input.path : '',
    group: typeof input?.group === 'string' ? input.group : '',
    tags: Array.isArray(input?.tags) ? input.tags.filter((t) => typeof t === 'string') : [],
    notes: typeof input?.notes === 'string' ? input.notes : '',
    favorite: Boolean(input?.favorite),
    icon: typeof input?.icon === 'string' && input.icon ? input.icon : '📦',
    stack: (STACK_KINDS as string[]).includes(input?.stack as string)
      ? (input?.stack as StackKind)
      : undefined,
    services: Array.isArray(input?.services) ? input.services.map(normalizeService) : [],
    createdAt: Number(input?.createdAt) || now,
    updatedAt: Number(input?.updatedAt) || now,
    lastStartedAt: input?.lastStartedAt,
    lastOpenedAt: input?.lastOpenedAt
  }
  return project
}

function normalizeService(input: ServiceConfig, index: number): ServiceConfig {
  return {
    id: typeof input?.id === 'string' && input.id ? input.id : createId('svc'),
    name: typeof input?.name === 'string' && input.name ? input.name : `Service ${index + 1}`,
    cwd: typeof input?.cwd === 'string' ? input.cwd : '',
    command: typeof input?.command === 'string' ? input.command : '',
    startupDelay: Number.isFinite(input?.startupDelay) ? Number(input.startupDelay) : 0,
    autoRestart: Boolean(input?.autoRestart),
    enabled: input?.enabled === undefined ? true : Boolean(input.enabled),
    terminalMode:
      input?.terminalMode === 'terminal' ||
      input?.terminalMode === 'cmd' ||
      input?.terminalMode === 'powershell'
        ? input.terminalMode
        : 'devhub',
    env: Array.isArray(input?.env)
      ? input.env
          .filter((e) => e && typeof e.key === 'string')
          .map<EnvVar>((e) => ({ key: e.key, value: String(e.value ?? ''), secret: Boolean(e.secret) }))
      : [],
    ports: Array.isArray(input?.ports) ? input.ports.map(Number).filter((n) => Number.isFinite(n)) : [],
    notes: typeof input?.notes === 'string' ? input.notes : undefined
  }
}
