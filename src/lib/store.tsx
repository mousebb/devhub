import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { api, keyOf } from './api'
import { normalizeLang, translate, type MsgKey, type MsgParams } from '@shared/i18n'
import type { AppConfig, AppSettings, LogLine, ProjectConfig, ServiceConfig, ServiceRuntime } from '@shared/types'

const MAX_LOGS = 4000

/** 服务是否处于运行/启动中 */
const isRunningStatus = (rt?: ServiceRuntime) => rt?.status === 'running' || rt?.status === 'starting'

export interface ToastItem {
  id: number
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}

interface ConfirmRequest {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface StoreValue {
  config: AppConfig
  runtime: Record<string, ServiceRuntime>
  logs: Record<string, LogLine[]>
  toasts: ToastItem[]
  confirmRequest?: ConfirmRequest & { resolve: (v: boolean) => void }
  ready: boolean
  refresh: () => Promise<void>
  saveProject: (project: ProjectConfig) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  duplicateProject: (id: string) => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  startService: (projectId: string, serviceId: string) => Promise<void>
  stopService: (projectId: string, serviceId: string) => Promise<void>
  restartService: (projectId: string, serviceId: string) => Promise<void>
  startAll: (projectId: string) => Promise<void>
  stopAll: (projectId: string) => Promise<void>
  restartAll: (projectId: string) => Promise<void>
  startGroup: (group: string) => Promise<void>
  stopGroup: (group: string) => Promise<void>
  loadLogs: (projectId: string, serviceId: string) => Promise<void>
  clearLogs: (projectId: string, serviceId: string) => Promise<void>
  toast: (level: ToastItem['level'], message: string) => void
  confirm: (req: ConfirmRequest) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
  dismissToast: (id: number) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>({ version: 1, projects: [], settings: {
    theme: 'dark',
    language: 'zh',
    confirmBeforeStopAll: true,
    checkPorts: true,
    maxLogLines: 3000,
    defaultTerminalMode: 'devhub',
    scanRoots: [],
    minimizeToTray: false
  } })
  const [runtime, setRuntime] = useState<Record<string, ServiceRuntime>>({})
  const [logs, setLogs] = useState<Record<string, LogLine[]>>({})
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmRequest, setConfirmRequest] = useState<(ConfirmRequest & { resolve: (v: boolean) => void }) | undefined>()
  const [ready, setReady] = useState(false)
  const toastSeq = useRef(0)
  const configRef = useRef(config)
  configRef.current = config
  const confirmRef = useRef<ConfirmRequest & { resolve: (v: boolean) => void }>()

  const toast = useCallback((level: ToastItem['level'], message: string) => {
    const id = ++toastSeq.current
    setToasts((prev) => [...prev, { id, level, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }, [])

  /** 提示 / 确认框文案也要跟随界面语言（这里不用 useT，避免与 store 循环依赖） */
  const lang = normalizeLang(config.settings.language)
  const t = useCallback(
    (key: MsgKey, params?: MsgParams) => translate(lang, key, params),
    [lang]
  )

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const confirm = useCallback((req: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      const wrapped = { ...req, resolve }
      confirmRef.current = wrapped
      setConfirmRequest(wrapped)
    })
  }, [])

  const resolveConfirm = useCallback((value: boolean) => {
    const req = confirmRef.current
    confirmRef.current = undefined
    setConfirmRequest(undefined)
    req?.resolve(value)
  }, [])

  const refresh = useCallback(async () => {
    const [cfg, snapshot] = await Promise.all([api.getConfig(), api.getRuntimeSnapshot()])
    setConfig(cfg)
    setRuntime(Object.fromEntries(snapshot.map((r) => [keyOf(r.projectId, r.serviceId), r])))
  }, [])

  useEffect(() => {
    void refresh().then(() => setReady(true))
  }, [refresh])

  useEffect(() => {
    const offLog = api.onLog((line) => {
      setLogs((prev) => {
        const k = keyOf(line.projectId, line.serviceId)
        const arr = prev[k] ? [...prev[k], line] : [line]
        return { ...prev, [k]: arr.length > MAX_LOGS ? arr.slice(arr.length - MAX_LOGS) : arr }
      })
    })
    const offStatus = api.onStatus((r) => {
      setRuntime((prev) => ({ ...prev, [keyOf(r.projectId, r.serviceId)]: r }))
      if (r.status === 'error' && r.error) {
        const project = configRef.current.projects.find((p) => p.id === r.projectId)
        const service = project?.services.find((s) => s.id === r.serviceId)
        toast('error', t('msg.startFailed', { name: service?.name ?? t('msg.service'), error: r.error }))
      }
      if (r.status === 'exited') {
        const project = configRef.current.projects.find((p) => p.id === r.projectId)
        const service = project?.services.find((s) => s.id === r.serviceId)
        toast('warn', t('msg.exited', { name: service?.name ?? t('msg.service'), code: r.exitCode ?? '?' }))
      }
    })
    const offCleared = api.onLogsCleared(({ projectId, serviceId }) => {
      setLogs((prev) => ({ ...prev, [keyOf(projectId, serviceId)]: [] }))
    })
    const offConfig = api.onConfigChanged((cfg) => setConfig(cfg))
    return () => {
      offLog()
      offStatus()
      offCleared()
      offConfig()
    }
  }, [toast, t])

  /* theme */
  useEffect(() => {
    const theme = config.settings.theme
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }, [config.settings.theme])

  const saveProject = useCallback(async (project: ProjectConfig) => {
    const exists = configRef.current.projects.some((p) => p.id === project.id)
    const next = exists ? await api.updateProject(project) : await api.createProject(project)
    setConfig(next)
    toast('success', t('msg.savedProject', { name: project.name }))
  }, [toast, t])

  const deleteProject = useCallback(
    async (id: string) => {
      const project = configRef.current.projects.find((p) => p.id === id)
      const ok = await confirm({
        title: t('msg.deleteTitle'),
        message: t('msg.deleteMessage', { name: project?.name ?? '' }),
        confirmText: t('act.delete'),
        danger: true
      })
      if (!ok) return
      setConfig(await api.deleteProject(id))
      toast('info', t('msg.deleted', { name: project?.name ?? '' }))
    },
    [confirm, toast, t]
  )

  const duplicateProject = useCallback(
    async (id: string) => {
      setConfig(await api.duplicateProject(id))
      toast('success', t('msg.duplicated'))
    },
    [toast, t]
  )

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await api.saveConfig({ ...configRef.current, settings: { ...configRef.current.settings, ...patch } })
    setConfig(next)
  }, [])

  const toggleFavorite = useCallback(async (id: string) => {
    const project = configRef.current.projects.find((p) => p.id === id)
    if (!project) return
    setConfig(await api.updateProject({ ...project, favorite: !project.favorite, updatedAt: Date.now() }))
  }, [])

  const checkPortsBeforeStart = useCallback(
    async (service: ServiceConfig) => {
      if (!configRef.current.settings.checkPorts || !service.ports.length) return true
      const results = await api.checkPorts(service.ports)
      const busy = results.filter((r) => r.inUse)
      if (!busy.length) return true
      const detail = busy
        .map((b) =>
          b.pid
            ? t('msg.portBusy', { port: b.port, pid: b.pid, name: b.processName ?? '?' })
            : t('msg.portBusyNoPid', { port: b.port })
        )
        .join('\n')
      return confirm({
        title: t('msg.portBusyTitle'),
        message: t('msg.portBusyMessage', { detail }),
        confirmText: t('msg.startAnyway')
      })
    },
    [confirm, t]
  )

  const startService = useCallback(
    async (projectId: string, serviceId: string) => {
      const project = configRef.current.projects.find((p) => p.id === projectId)
      const service = project?.services.find((s) => s.id === serviceId)
      if (!service) return
      if (!(await checkPortsBeforeStart(service))) return
      const result = await api.startService(projectId, serviceId)
      setRuntime((prev) => ({ ...prev, [keyOf(projectId, serviceId)]: result }))
      if (result.status === 'error') {
        toast('error', `${service.name}: ${result.error ?? t('msg.startFailedShort')}`)
      }
    },
    [checkPortsBeforeStart, toast, t]
  )

  const stopService = useCallback(
    async (projectId: string, serviceId: string) => {
      await api.stopService(projectId, serviceId)
      setRuntime((prev) => ({ ...prev, [keyOf(projectId, serviceId)]: { projectId, serviceId, status: 'stopped' } }))
    },
    []
  )

  const restartService = useCallback(
    async (projectId: string, serviceId: string) => {
      await api.restartService(projectId, serviceId)
    },
    []
  )

  const startAll = useCallback(
    async (projectId: string) => {
      const project = configRef.current.projects.find((p) => p.id === projectId)
      if (!project) return
      // 已在跑的跳过：后端 start() 对运行中的服务是幂等的（不会重复起进程），
      // 这里只统计「真正要启动」的数量，顺便避免重复弹端口占用确认。
      const pending = project.services.filter(
        (s) => s.enabled && !isRunningStatus(runtime[keyOf(projectId, s.id)])
      )
      if (!pending.length) {
        toast('info', t('msg.alreadyRunning', { name: project.name }))
        return
      }
      for (const service of pending) {
        if (!(await checkPortsBeforeStart(service))) continue
      }
      await api.startAll(projectId)
      toast('success', t('msg.startedCount', { name: project.name, n: pending.length }))
    },
    [checkPortsBeforeStart, runtime, toast, t]
  )

  const stopAll = useCallback(
    async (projectId: string) => {
      const project = configRef.current.projects.find((p) => p.id === projectId)
      if (configRef.current.settings.confirmBeforeStopAll) {
        const running = Object.values(runtime).filter(
          (r) => r.projectId === projectId && (r.status === 'running' || r.status === 'starting')
        )
        if (!running.length) {
          await api.stopAll(projectId)
          return
        }
        const ok = await confirm({
          title: t('msg.stopAllTitle'),
          message: t('msg.stopAllMessage', { name: project?.name ?? '', n: running.length }),
          confirmText: t('act.stop'),
          danger: true
        })
        if (!ok) return
      }
      await api.stopAll(projectId)
      toast('info', t('msg.stopped', { name: project?.name ?? '' }))
    },
    [confirm, runtime, toast, t]
  )

  const restartAll = useCallback(async (projectId: string) => {
    await api.restartAll(projectId)
  }, [])

  const startGroup = useCallback(
    async (group: string) => {
      const members = configRef.current.projects.filter((p) => p.group === group)
      const pending = members.flatMap((p) =>
        p.services.filter((s) => s.enabled && !isRunningStatus(runtime[keyOf(p.id, s.id)]))
      )
      if (!pending.length) {
        toast('info', t('msg.groupAlreadyRunning', { name: group }))
        return
      }
      // 一次性端口预检（避免逐个弹窗）：任一服务端口被占用则提示一次
      if (configRef.current.settings.checkPorts) {
        for (const service of pending) {
          const ok = await checkPortsBeforeStart(service)
          if (!ok) return
        }
      }
      await api.startGroup(group)
      toast('success', t('msg.groupStartedCount', { name: group, n: pending.length }))
    },
    [checkPortsBeforeStart, runtime, toast, t]
  )

  const stopGroup = useCallback(
    async (group: string) => {
      if (configRef.current.settings.confirmBeforeStopAll) {
        const running = Object.values(runtime).filter((r) => {
          const p = configRef.current.projects.find((x) => x.id === r.projectId)
          return p?.group === group && (r.status === 'running' || r.status === 'starting')
        })
        if (running.length) {
          const ok = await confirm({
            title: t('msg.groupStopTitle'),
            message: t('msg.groupStopMessage', { name: group, n: running.length }),
            confirmText: t('act.stop'),
            danger: true
          })
          if (!ok) return
        }
      }
      await api.stopGroup(group)
      toast('info', t('msg.groupStopped', { name: group }))
    },
    [confirm, runtime, toast, t]
  )

  const loadLogs = useCallback(async (projectId: string, serviceId: string) => {
    const history = await api.getLogs(projectId, serviceId)
    setLogs((prev) => {
      const k = keyOf(projectId, serviceId)
      const map = new Map<number, LogLine>()
      for (const line of [...(prev[k] ?? []), ...history]) map.set(line.id, line)
      const merged = [...map.values()].sort((a, b) => a.id - b.id)
      return { ...prev, [k]: merged.slice(-MAX_LOGS) }
    })
  }, [])

  const clearLogs = useCallback(async (projectId: string, serviceId: string) => {
    await api.clearLogs(projectId, serviceId)
    setLogs((prev) => ({ ...prev, [keyOf(projectId, serviceId)]: [] }))
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      config,
      runtime,
      logs,
      toasts,
      confirmRequest,
      ready,
      refresh,
      saveProject,
      deleteProject,
      duplicateProject,
      updateSettings,
      toggleFavorite,
      startService,
      stopService,
      restartService,
      startAll,
      stopAll,
      restartAll,
      startGroup,
      stopGroup,
      loadLogs,
      clearLogs,
      toast,
      confirm,
      resolveConfirm,
      dismissToast
    }),
    [
      config,
      runtime,
      logs,
      toasts,
      confirmRequest,
      ready,
      refresh,
      saveProject,
      deleteProject,
      duplicateProject,
      updateSettings,
      toggleFavorite,
      startService,
      stopService,
      restartService,
      startAll,
      stopAll,
      restartAll,
      startGroup,
      stopGroup,
      loadLogs,
      clearLogs,
      toast,
      confirm,
      resolveConfirm,
      dismissToast
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
