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
        toast('error', `${service?.name ?? '服务'} 启动失败：${r.error}`)
      }
      if (r.status === 'exited') {
        const project = configRef.current.projects.find((p) => p.id === r.projectId)
        const service = project?.services.find((s) => s.id === r.serviceId)
        toast('warn', `${service?.name ?? '服务'} 已退出（exit code ${r.exitCode ?? '?'}）`)
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
  }, [toast])

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
    toast('success', `已保存项目「${project.name}」`)
  }, [toast])

  const deleteProject = useCallback(
    async (id: string) => {
      const project = configRef.current.projects.find((p) => p.id === id)
      const ok = await confirm({
        title: '删除项目',
        message: `确定删除「${project?.name ?? ''}」吗？正在运行的服务会被停止，此操作不可撤销。`,
        confirmText: '删除',
        danger: true
      })
      if (!ok) return
      setConfig(await api.deleteProject(id))
      toast('info', `已删除「${project?.name ?? ''}」`)
    },
    [confirm, toast]
  )

  const duplicateProject = useCallback(
    async (id: string) => {
      setConfig(await api.duplicateProject(id))
      toast('success', '已复制项目')
    },
    [toast]
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
        .map((b) => `端口 ${b.port} 被占用${b.pid ? `（PID ${b.pid}${b.processName ? ` / ${b.processName}` : ''}）` : ''}`)
        .join('\n')
      return confirm({
        title: '端口已被占用',
        message: `${detail}\n\nDevHub 不会自动结束占用端口的程序。是否仍然启动？`,
        confirmText: '仍然启动'
      })
    },
    [confirm]
  )

  const startService = useCallback(
    async (projectId: string, serviceId: string) => {
      const project = configRef.current.projects.find((p) => p.id === projectId)
      const service = project?.services.find((s) => s.id === serviceId)
      if (!service) return
      if (!(await checkPortsBeforeStart(service))) return
      const result = await api.startService(projectId, serviceId)
      setRuntime((prev) => ({ ...prev, [keyOf(projectId, serviceId)]: result }))
      if (result.status === 'error') toast('error', `${service.name}: ${result.error ?? '启动失败'}`)
    },
    [checkPortsBeforeStart, toast]
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
        toast('info', `「${project.name}」的服务已在运行`)
        return
      }
      for (const service of pending) {
        if (!(await checkPortsBeforeStart(service))) continue
      }
      await api.startAll(projectId)
      toast('success', `已启动「${project.name}」的 ${pending.length} 个服务`)
    },
    [checkPortsBeforeStart, runtime, toast]
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
          title: '停止全部服务',
          message: `确定停止「${project?.name ?? ''}」的 ${running.length} 个正在运行的服务吗？`,
          confirmText: '停止',
          danger: true
        })
        if (!ok) return
      }
      await api.stopAll(projectId)
      toast('info', `已停止「${project?.name ?? ''}」`)
    },
    [confirm, runtime, toast]
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
        toast('info', `分组「${group}」的服务已在运行`)
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
      toast('success', `已启动分组「${group}」的 ${pending.length} 个服务`)
    },
    [checkPortsBeforeStart, runtime, toast]
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
            title: '停止分组服务',
            message: `确定停止分组「${group}」的 ${running.length} 个运行中的服务吗？`,
            confirmText: '停止',
            danger: true
          })
          if (!ok) return
        }
      }
      await api.stopGroup(group)
      toast('info', `已停止分组「${group}」`)
    },
    [confirm, runtime, toast]
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
