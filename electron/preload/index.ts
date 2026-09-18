import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, EVENTS, type DevHubApi } from '@shared/ipc'

const api: DevHubApi = {
  getConfig: () => ipcRenderer.invoke(CHANNELS.configGet),
  saveConfig: (config) => ipcRenderer.invoke(CHANNELS.configSave, config),
  exportConfig: () => ipcRenderer.invoke(CHANNELS.configExport),
  importConfig: () => ipcRenderer.invoke(CHANNELS.configImport),

  createProject: (project) => ipcRenderer.invoke(CHANNELS.projectCreate, project),
  updateProject: (project) => ipcRenderer.invoke(CHANNELS.projectUpdate, project),
  deleteProject: (id) => ipcRenderer.invoke(CHANNELS.projectDelete, id),
  duplicateProject: (id) => ipcRenderer.invoke(CHANNELS.projectDuplicate, id),
  touchProject: (id) => ipcRenderer.invoke(CHANNELS.projectTouch, id),

  startService: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.serviceStart, projectId, serviceId),
  stopService: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.serviceStop, projectId, serviceId),
  restartService: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.serviceRestart, projectId, serviceId),
  startAll: (projectId) => ipcRenderer.invoke(CHANNELS.projectStartAll, projectId),
  stopAll: (projectId) => ipcRenderer.invoke(CHANNELS.projectStopAll, projectId),
  restartAll: (projectId) => ipcRenderer.invoke(CHANNELS.projectRestartAll, projectId),
  startGroup: (group) => ipcRenderer.invoke(CHANNELS.groupStart, group),
  stopGroup: (group) => ipcRenderer.invoke(CHANNELS.groupStop, group),
  getRuntimeSnapshot: () => ipcRenderer.invoke(CHANNELS.runtimeSnapshot),

  getLogs: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.logsGet, projectId, serviceId),
  clearLogs: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.logsClear, projectId, serviceId),
  saveLogs: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.logsSave, projectId, serviceId),
  openLogFolder: (projectId, serviceId) => ipcRenderer.invoke(CHANNELS.logsOpenFolder, projectId, serviceId),

  pickDirectory: () => ipcRenderer.invoke(CHANNELS.dialogPickDirectory),
  openVSCode: (path) => ipcRenderer.invoke(CHANNELS.systemOpenVSCode, path),
  openExplorer: (path) => ipcRenderer.invoke(CHANNELS.systemOpenExplorer, path),
  scanDirectory: (dir, depth) => ipcRenderer.invoke(CHANNELS.systemScan, dir, depth),
  checkPorts: (ports) => ipcRenderer.invoke(CHANNELS.systemCheckPorts, ports),
  getEnvInfo: () => ipcRenderer.invoke(CHANNELS.systemEnvInfo),
  getTools: () => ipcRenderer.invoke(CHANNELS.systemTools),
  getAppInfo: () => ipcRenderer.invoke(CHANNELS.appInfo),

  onLog: (cb) => {
    const handler = (_e: unknown, line: Parameters<typeof cb>[0]) => cb(line)
    ipcRenderer.on(EVENTS.log, handler)
    return () => ipcRenderer.removeListener(EVENTS.log, handler)
  },
  onStatus: (cb) => {
    const handler = (_e: unknown, runtime: Parameters<typeof cb>[0]) => cb(runtime)
    ipcRenderer.on(EVENTS.status, handler)
    return () => ipcRenderer.removeListener(EVENTS.status, handler)
  },
  onLogsCleared: (cb) => {
    const handler = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload)
    ipcRenderer.on(EVENTS.logsCleared, handler)
    return () => ipcRenderer.removeListener(EVENTS.logsCleared, handler)
  },
  onConfigChanged: (cb) => {
    const handler = (_e: unknown, config: Parameters<typeof cb>[0]) => cb(config)
    ipcRenderer.on(EVENTS.configChanged, handler)
    return () => ipcRenderer.removeListener(EVENTS.configChanged, handler)
  },
  onToast: (cb) => {
    const handler = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload)
    ipcRenderer.on(EVENTS.toast, handler)
    return () => ipcRenderer.removeListener(EVENTS.toast, handler)
  }
}

contextBridge.exposeInMainWorld('devhub', api)
