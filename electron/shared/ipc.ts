import type {
  AppConfig,
  AppSettings,
  DetectedProject,
  EnvInfoEntry,
  LogLine,
  PortCheckResult,
  ProjectConfig,
  ServiceConfig,
  ServiceRuntime,
  ToolInfo
} from './types'

/** 主进程 -> 渲染进程 事件名 */
export const EVENTS = {
  log: 'devhub:log',
  status: 'devhub:status',
  logsCleared: 'devhub:logs-cleared',
  configChanged: 'devhub:config-changed',
  toast: 'devhub:toast'
} as const

/** 渲染进程 -> 主进程 invoke 通道 */
export const CHANNELS = {
  configGet: 'config:get',
  configSave: 'config:save',
  configExport: 'config:export',
  configImport: 'config:import',

  projectCreate: 'project:create',
  projectUpdate: 'project:update',
  projectDelete: 'project:delete',
  projectDuplicate: 'project:duplicate',
  projectTouch: 'project:touch',

  serviceStart: 'service:start',
  serviceStop: 'service:stop',
  serviceRestart: 'service:restart',
  projectStartAll: 'project:start-all',
  projectStopAll: 'project:stop-all',
  projectRestartAll: 'project:restart-all',
  groupStart: 'group:start',
  groupStop: 'group:stop',

  runtimeSnapshot: 'runtime:snapshot',
  logsGet: 'logs:get',
  logsClear: 'logs:clear',
  logsSave: 'logs:save',
  logsOpenFolder: 'logs:open-folder',

  dialogPickDirectory: 'dialog:pick-directory',
  systemOpenVSCode: 'system:open-vscode',
  systemOpenExplorer: 'system:open-explorer',
  systemScan: 'system:scan',
  systemCheckPorts: 'system:check-ports',
  systemEnvInfo: 'system:env-info',
  systemTools: 'system:tools',
  appInfo: 'app:info'
} as const

export interface ToastPayload {
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}

export interface AppInfo {
  version: string
  dataDir: string
  configPath: string
  logDir: string
  platform: string
}

export interface DevHubApi {
  /* ---------- config ---------- */
  getConfig(): Promise<AppConfig>
  saveConfig(config: AppConfig): Promise<AppConfig>
  exportConfig(): Promise<{ canceled: boolean; path?: string }>
  importConfig(): Promise<{ canceled: boolean; config?: AppConfig }>

  /* ---------- projects ---------- */
  createProject(project: ProjectConfig): Promise<AppConfig>
  updateProject(project: ProjectConfig): Promise<AppConfig>
  deleteProject(projectId: string): Promise<AppConfig>
  duplicateProject(projectId: string): Promise<AppConfig>
  touchProject(projectId: string): Promise<void>

  /* ---------- runtime ---------- */
  startService(projectId: string, serviceId: string): Promise<ServiceRuntime>
  stopService(projectId: string, serviceId: string): Promise<void>
  restartService(projectId: string, serviceId: string): Promise<void>
  startAll(projectId: string): Promise<void>
  stopAll(projectId: string): Promise<void>
  restartAll(projectId: string): Promise<void>
  startGroup(group: string): Promise<void>
  stopGroup(group: string): Promise<void>
  getRuntimeSnapshot(): Promise<ServiceRuntime[]>

  /* ---------- logs ---------- */
  getLogs(projectId: string, serviceId: string): Promise<LogLine[]>
  clearLogs(projectId: string, serviceId: string): Promise<void>
  saveLogs(projectId: string, serviceId: string): Promise<{ canceled: boolean; path?: string }>
  openLogFolder(projectId: string, serviceId: string): Promise<void>

  /* ---------- system ---------- */
  pickDirectory(): Promise<string | undefined>
  openVSCode(path: string): Promise<{ ok: boolean; message?: string }>
  openExplorer(path: string): Promise<{ ok: boolean; message?: string }>
  scanDirectory(dir: string, depth?: number): Promise<DetectedProject[]>
  checkPorts(ports: number[]): Promise<PortCheckResult[]>
  getEnvInfo(): Promise<EnvInfoEntry[]>
  getTools(): Promise<ToolInfo[]>
  getAppInfo(): Promise<AppInfo>

  /* ---------- events ---------- */
  onLog(cb: (line: LogLine) => void): () => void
  onStatus(cb: (runtime: ServiceRuntime) => void): () => void
  onLogsCleared(cb: (payload: { projectId: string; serviceId: string }) => void): () => void
  onConfigChanged(cb: (config: AppConfig) => void): () => void
  onToast(cb: (payload: ToastPayload) => void): () => void
}

export type { AppConfig, AppSettings, ProjectConfig, ServiceConfig, ServiceRuntime, LogLine }
