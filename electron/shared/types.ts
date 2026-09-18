/**
 * DevHub 共享数据模型
 * 主进程与渲染进程共用（仅类型 + 常量，无副作用）
 */

export const CONFIG_VERSION = 1

/** 服务的运行方式 */
export type TerminalMode = 'devhub' | 'terminal' | 'cmd' | 'powershell'

export const TERMINAL_MODE_LABELS: Record<TerminalMode, string> = {
  devhub: 'DevHub 内置日志',
  terminal: 'Windows Terminal',
  cmd: 'CMD',
  powershell: 'PowerShell'
}

export interface EnvVar {
  key: string
  value: string
  /** 标记为密钥：UI 打码，导出时剔除 value */
  secret: boolean
}

export interface ServiceConfig {
  id: string
  name: string
  /** 工作目录（绝对路径） */
  cwd: string
  /** 启动命令（原样交给 Windows shell） */
  command: string
  /** 启动该服务后，等待多少毫秒再启动下一个服务 */
  startupDelay: number
  /** 非手动停止时自动重启 */
  autoRestart: boolean
  /** 是否参与 "启动全部" */
  enabled: boolean
  terminalMode: TerminalMode
  env: EnvVar[]
  /** 该服务声明的端口（仅用于展示与占用检测） */
  ports: number[]
  notes?: string
}

export interface ProjectConfig {
  id: string
  name: string
  /** 项目根目录 */
  path: string
  group: string
  tags: string[]
  notes: string
  favorite: boolean
  /** 列表图标（emoji，作为技术栈图标识别失败时的兜底） */
  icon: string
  /** 技术栈（用于列表显示对应品牌图标），缺省时按服务命令自动推断 */
  stack?: StackKind
  services: ServiceConfig[]
  createdAt: number
  updatedAt: number
  lastStartedAt?: number
  lastOpenedAt?: number
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark'
  confirmBeforeStopAll: boolean
  checkPorts: boolean
  maxLogLines: number
  defaultTerminalMode: TerminalMode
  scanRoots: string[]
  /** 窗口关闭时最小化到托盘 */
  minimizeToTray: boolean
}

export interface AppConfig {
  version: number
  projects: ProjectConfig[]
  settings: AppSettings
}

export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'exited' | 'error'

export interface ServiceRuntime {
  projectId: string
  serviceId: string
  status: ServiceStatus
  pid?: number
  startedAt?: number
  exitedAt?: number
  exitCode?: number | null
  error?: string
  restarts?: number
  /** 外部终端模式（无法捕获日志） */
  external?: boolean
  /** 本次会话从磁盘恢复（进程是上次 DevHub 留下的孤儿进程，无法捕获实时日志） */
  recovered?: boolean
}

export type LogStream = 'stdout' | 'stderr' | 'system'

export interface LogLine {
  id: number
  projectId: string
  serviceId: string
  stream: LogStream
  text: string
  ts: number
}

/** 扫描器识别出的技术栈 */
export type StackKind =
  | 'node'
  | 'python'
  | 'flutter'
  | 'go'
  | 'rust'
  | 'dotnet'
  | 'java'
  | 'php'
  | 'static'
  | 'unknown'

export const STACK_KINDS: StackKind[] = [
  'node',
  'python',
  'flutter',
  'go',
  'rust',
  'dotnet',
  'java',
  'php',
  'static',
  'unknown'
]

export const STACK_LABELS: Record<StackKind, string> = {
  node: 'Node.js',
  python: 'Python',
  flutter: 'Flutter',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET',
  java: 'Java',
  php: 'PHP',
  static: 'Static',
  unknown: 'Unknown'
}

export interface DetectedProject {
  name: string
  path: string
  stack: StackKind
  /** package.json 中的 scripts 等可执行目标 */
  scripts: { name: string; command: string }[]
  /** 建议的启动命令（可一键采用） */
  suggestions: { label: string; command: string }[]
  /** 是否本身就是一个项目（false 表示只是包含子项目的目录） */
  isProject: boolean
}

export interface PortCheckResult {
  port: number
  inUse: boolean
  pid?: number
  processName?: string
}

export interface EnvInfoEntry {
  key: string
  value: string
}

export interface ToolInfo {
  name: string
  found: boolean
  path?: string
  version?: string
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createDefaultSettings(): AppSettings {
  return {
    theme: 'dark',
    confirmBeforeStopAll: true,
    checkPorts: true,
    maxLogLines: 3000,
    defaultTerminalMode: 'devhub',
    scanRoots: [],
    minimizeToTray: false
  }
}

export function createDefaultService(partial: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    id: createId('svc'),
    name: 'New Service',
    cwd: '',
    command: '',
    startupDelay: 0,
    autoRestart: false,
    enabled: true,
    terminalMode: 'devhub',
    env: [],
    ports: [],
    ...partial
  }
}

export function createDefaultProject(partial: Partial<ProjectConfig> = {}): ProjectConfig {
  const now = Date.now()
  return {
    id: createId('prj'),
    name: 'New Project',
    path: '',
    group: '',
    tags: [],
    notes: '',
    favorite: false,
    icon: '📦',
    services: [],
    createdAt: now,
    updatedAt: now,
    ...partial
  }
}
