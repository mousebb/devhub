import { dirname, join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, shell } from 'electron'
import { CHANNELS, EVENTS } from '@shared/ipc'
import type { AppConfig, ProjectConfig, ServiceRuntime } from '@shared/types'
import { createId } from '@shared/types'
import { ConfigManager, resolveDataDir } from './config-manager'
import { LogStore, safeFileName } from './log-store'
import { ProcessManager } from './process-manager'
import { scanDirectory } from './scanner'
import { checkPorts, getEnvInfo, getTools, openExplorer, openVSCode } from './system'
import { createAppIcon } from './icon'

const isDev = !!process.env.ELECTRON_RENDERER_URL

/**
 * 把 Electron 自身的运行数据（Chromium 缓存 / Local Storage / Session 等）
 * 也放进 DevHub 目录，C 盘用户目录里不再留任何 DevHub 痕迹。
 * 必须在 app ready 之前调用，否则不生效。
 */
try {
  const electronDataDir = join(resolveDataDir(), 'electron')
  mkdirSync(electronDataDir, { recursive: true })
  app.setPath('userData', electronDataDir)
} catch (err) {
  console.error('[DevHub] 无法重定向 userData，回退到默认目录', err)
}

let mainWindow: BrowserWindow | undefined
let tray: Tray | undefined
let quitting = false

let configManager: ConfigManager
let logStore: LogStore
let processManager: ProcessManager

/* ------------------------------- 窗口 ------------------------------- */

function createWindow() {
  const icon = createAppIcon(64)
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    title: 'DevHub',
    icon,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    if (!quitting && configManager.get().settings.minimizeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}

function saveAndBroadcast(): AppConfig {
  const config = configManager.save()
  broadcast(EVENTS.configChanged, config)
  return config
}

/* ------------------------------- 托盘 ------------------------------- */

function setupTray() {
  tray = new Tray(createAppIcon(32))
  tray.setToolTip('DevHub')
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
  refreshTrayMenu()
}

function refreshTrayMenu() {
  if (!tray) return
  const running = processManager.snapshot().filter((r) => r.status === 'running' || r.status === 'starting')
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: '打开 DevHub', click: () => mainWindow?.show() },
    { type: 'separator' }
  ]
  if (!running.length) {
    items.push({ label: '没有正在运行的服务', enabled: false })
  } else {
    for (const r of running) {
      const project = configManager.getProject(r.projectId)
      const service = configManager.getService(r.projectId, r.serviceId)?.service
      items.push({
        label: `● ${project?.name ?? '?'} / ${service?.name ?? '?'}`,
        submenu: [
          {
            label: '停止',
            click: () => {
              void processManager.stop(r.projectId, r.serviceId)
              refreshTrayMenu()
            }
          }
        ]
      })
    }
    items.push({ type: 'separator' }, {
      label: '停止全部',
      click: () => {
        void processManager.stopEverything().then(refreshTrayMenu)
      }
    })
  }
  items.push({ type: 'separator' }, { label: '退出 DevHub', click: () => app.quit() })
  tray.setContextMenu(Menu.buildFromTemplate(items))
}

/* ------------------------------- IPC ------------------------------- */

function registerIpc() {
  /* config */
  ipcMain.handle(CHANNELS.configGet, () => configManager.get())
  ipcMain.handle(CHANNELS.configSave, (_e, config: AppConfig) => {
    // 渲染进程只允许改 settings；projects 由主进程维护，
    // 否则会用渲染进程的陈旧快照把 lastStartedAt / 运行状态覆盖回去。
    const settings = config?.settings
    if (settings) {
      logStore.setMaxLines(settings.maxLogLines ?? 3000)
      configManager.update((c) => {
        c.settings = { ...c.settings, ...settings }
      })
    }
    return saveAndBroadcast()
  })

  ipcMain.handle(CHANNELS.configExport, async () => {
    const res = await dialog.showSaveDialog({
      title: '导出配置',
      defaultPath: `devhub-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    await writeFile(res.filePath, configManager.toExportPayload(), 'utf-8')
    return { canceled: false, path: res.filePath }
  })

  ipcMain.handle(CHANNELS.configImport, async () => {
    const res = await dialog.showOpenDialog({
      title: '导入配置',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths.length) return { canceled: true }
    const parsed = ConfigManager.parseImport(await readText(res.filePaths[0]))
    if (!parsed) return { canceled: true }
    configManager.save(parsed)
    return { canceled: false, config: saveAndBroadcast() }
  })

  /* projects */
  ipcMain.handle(CHANNELS.projectCreate, (_e, project: ProjectConfig) => {
    configManager.update((c) => {
      c.projects.push({ ...project, id: project.id || createId('prj'), updatedAt: Date.now() })
    })
    return saveAndBroadcast()
  })

  ipcMain.handle(CHANNELS.projectUpdate, (_e, project: ProjectConfig) => {
    configManager.update((c) => {
      const idx = c.projects.findIndex((p) => p.id === project.id)
      if (idx >= 0) c.projects[idx] = { ...project, updatedAt: Date.now() }
      else c.projects.push({ ...project, updatedAt: Date.now() })
    })
    return saveAndBroadcast()
  })

  ipcMain.handle(CHANNELS.projectDelete, async (_e, projectId: string) => {
    const project = configManager.getProject(projectId)
    if (project) await processManager.stopAll(projectId)
    configManager.update((c) => {
      c.projects = c.projects.filter((p) => p.id !== projectId)
    })
    return saveAndBroadcast()
  })

  ipcMain.handle(CHANNELS.projectDuplicate, (_e, projectId: string) => {
    const project = configManager.getProject(projectId)
    if (!project) return configManager.get()
    const clone: ProjectConfig = JSON.parse(JSON.stringify(project))
    clone.id = createId('prj')
    clone.name = `${project.name} (copy)`
    clone.createdAt = Date.now()
    clone.updatedAt = Date.now()
    clone.services = clone.services.map((s) => ({ ...s, id: createId('svc') }))
    configManager.update((c) => c.projects.push(clone))
    return saveAndBroadcast()
  })

  ipcMain.handle(CHANNELS.projectTouch, (_e, projectId: string) => {
    configManager.update((c) => {
      const p = c.projects.find((x) => x.id === projectId)
      if (p) p.lastOpenedAt = Date.now()
    })
    saveAndBroadcast()
  })

  /* runtime */
  ipcMain.handle(CHANNELS.serviceStart, async (_e, projectId: string, serviceId: string) => {
    const runtime = await processManager.start(projectId, serviceId)
    if (runtime.status === 'running' || runtime.status === 'starting') {
      configManager.update((c) => {
        const p = c.projects.find((x) => x.id === projectId)
        if (p) p.lastStartedAt = Date.now()
      })
      broadcast(EVENTS.configChanged, configManager.get())
    }
    return runtime
  })
  ipcMain.handle(CHANNELS.serviceStop, async (_e, projectId: string, serviceId: string) => {
    await processManager.stop(projectId, serviceId)
  })
  ipcMain.handle(CHANNELS.serviceRestart, async (_e, projectId: string, serviceId: string) => {
    await processManager.restart(projectId, serviceId)
  })
  ipcMain.handle(CHANNELS.projectStartAll, async (_e, projectId: string) => {
    await processManager.startAll(projectId)
    configManager.update((c) => {
      const p = c.projects.find((x) => x.id === projectId)
      if (p) p.lastStartedAt = Date.now()
    })
    broadcast(EVENTS.configChanged, configManager.get())
  })
  ipcMain.handle(CHANNELS.projectStopAll, async (_e, projectId: string) => {
    await processManager.stopAll(projectId)
  })
  ipcMain.handle(CHANNELS.projectRestartAll, async (_e, projectId: string) => {
    await processManager.restartAll(projectId)
  })
  ipcMain.handle(CHANNELS.groupStart, async (_e, group: string) => {
    await processManager.startGroup(group)
    configManager.update((c) => {
      for (const p of c.projects) if (p.group === group) p.lastStartedAt = Date.now()
    })
    broadcast(EVENTS.configChanged, configManager.get())
  })
  ipcMain.handle(CHANNELS.groupStop, async (_e, group: string) => {
    await processManager.stopGroup(group)
  })
  ipcMain.handle(CHANNELS.runtimeSnapshot, (): ServiceRuntime[] => processManager.snapshot())

  /* logs */
  ipcMain.handle(CHANNELS.logsGet, (_e, projectId: string, serviceId: string) => logStore.getOrLoad(projectId, serviceId))
  ipcMain.handle(CHANNELS.logsClear, (_e, projectId: string, serviceId: string) => {
    logStore.clear(projectId, serviceId)
    broadcast(EVENTS.logsCleared, { projectId, serviceId })
  })
  ipcMain.handle(CHANNELS.logsSave, async (_e, projectId: string, serviceId: string) => {
    const project = configManager.getProject(projectId)
    const service = configManager.getService(projectId, serviceId)?.service
    const res = await dialog.showSaveDialog({
      title: '保存日志',
      defaultPath: `${safeFileName(project?.name ?? 'project')}-${safeFileName(service?.name ?? 'service')}.log`,
      filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    const text = logStore
      .get(projectId, serviceId)
      .map((l) => `[${new Date(l.ts).toLocaleTimeString()}] ${l.text}`)
      .join('\n')
    await writeFile(res.filePath, text, 'utf-8')
    return { canceled: false, path: res.filePath }
  })
  ipcMain.handle(CHANNELS.logsOpenFolder, (_e, projectId: string, serviceId: string) => {
    const dir = logStore.folderPath(projectId, serviceId)
    if (existsSync(dir)) void shell.openPath(dir)
  })

  /* system */
  ipcMain.handle(CHANNELS.dialogPickDirectory, async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return res.canceled ? undefined : res.filePaths[0]
  })
  ipcMain.handle(CHANNELS.systemOpenVSCode, (_e, path: string) => openVSCode(path))
  ipcMain.handle(CHANNELS.systemOpenExplorer, (_e, path: string) => openExplorer(path))
  ipcMain.handle(CHANNELS.systemScan, (_e, dir: string, depth?: number) => scanDirectory(dir, depth ?? 2))
  ipcMain.handle(CHANNELS.systemCheckPorts, (_e, ports: number[]) => checkPorts(ports))
  ipcMain.handle(CHANNELS.systemEnvInfo, () => getEnvInfo())
  ipcMain.handle(CHANNELS.systemTools, () => getTools())
  ipcMain.handle(CHANNELS.appInfo, () => ({
    version: app.getVersion(),
    dataDir: configManager.dataDir,
    configPath: configManager.configPath,
    logDir: configManager.logDir,
    platform: process.platform
  }))
}

async function readText(file: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return readFile(file, 'utf-8')
}

/* ------------------------------ 生命周期 ------------------------------ */

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // 依赖 app.getPath() 的模块必须在 ready 之后初始化
    configManager = new ConfigManager()
    logStore = new LogStore(configManager.logDir, configManager.get().settings.maxLogLines)
    processManager = new ProcessManager(configManager, logStore, join(dirname(configManager.configPath), 'runtime.json'))

    processManager.on('log', (line) => broadcast(EVENTS.log, line))
    processManager.on('status', (runtime: ServiceRuntime) => {
      broadcast(EVENTS.status, runtime)
      refreshTrayMenu()
    })

    // 重启后恢复上次会话遗留的孤儿进程（须在 createWindow 之前，保证首次快照能拿到）
    processManager.recoverOrphans()

    registerIpc()
    createWindow()
    setupTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', (event) => {
  if (quitting || !processManager) return
  event.preventDefault()
  quitting = true
  void processManager.stopEverything().then(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
