import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  Folder,
  Pencil,
  Play,
  RotateCw,
  Square
} from 'lucide-react'
import type { ProjectConfig } from '@shared/types'
import { keyOf } from '../lib/api'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { formatDuration, relativeTime } from '../lib/format'
import { useNow } from '../lib/useNow'
import { LogViewer } from './LogViewer'
import { StackIcon, projectStack } from './StackIcon'
import { Badge, Button, StatusDot } from './ui'

interface Props {
  project: ProjectConfig
  onBack: () => void
  onEdit: () => void
}

export function ProjectDetail({ project, onBack, onEdit }: Props) {
  const { runtime, loadLogs, startService, stopService, restartService, startAll, stopAll, restartAll, config, toast } =
    useStore()
  const { t, lang } = useT()
  const now = useNow()
  const [tab, setTab] = useState<string>('all')
  const logsRef = useRef<HTMLDivElement>(null)
  const [logsFlash, setLogsFlash] = useState(false)

  useEffect(() => {
    for (const s of project.services) void loadLogs(project.id, s.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const openExternal = async (kind: 'vscode' | 'folder', target?: string) => {
    const dir = target || project.path
    if (!dir) {
      toast('error', t('detail.noDir'))
      return
    }
    const res =
      kind === 'vscode'
        ? await window.devhub.openVSCode(dir)
        : await window.devhub.openExplorer(dir)
    if (!res.ok) toast('error', res.message ?? t('detail.opFailed'))
  }

  const running = project.services.filter((s) => {
    const st = runtime[keyOf(project.id, s.id)]?.status
    return st === 'running' || st === 'starting'
  })
  // 所有「启用的」服务都在跑 → 顶部主按钮切换为「停止」（与列表卡片行为一致）
  const enabledCount = project.services.filter((s) => s.enabled).length
  const allRunning = enabledCount > 0 && running.length === enabledCount

  // 与列表卡片保持一致：优先用显式 stack，否则从服务命令推断
  const stack = projectStack(project)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-start gap-3 border-b border-line px-6 py-4">
        <Button variant="ghost" onClick={onBack} title={t('act.back')}>
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <StackIcon stack={stack} fallbackEmoji={project.icon} size={26} />
            </span>
            <h1 className="truncate text-[18px] font-semibold text-ink">{project.name}</h1>
            {project.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-subtle">
            <button className="hover:text-accent hover:underline" onClick={() => void openExternal('folder')}>
              {project.path || t('detail.noPath')}
            </button>
            <span>{t('detail.lastStarted', { time: relativeTime(project.lastStartedAt, lang) })}</span>
            {running.length > 0 && (
              <span className="text-ok">{t('app.runningCount', { n: running.length })}</span>
            )}
          </div>
          {project.notes && <p className="mt-2 max-w-2xl text-[12px] text-subtle">{project.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          {allRunning ? (
            <Button variant="danger" onClick={() => void stopAll(project.id)}>
              <Square size={13} /> {t('act.stop')}
            </Button>
          ) : (
            <Button variant="success" onClick={() => void startAll(project.id)}>
              <Play size={13} /> {t('act.start')}
            </Button>
          )}
          <Button variant="outline" onClick={() => void restartAll(project.id)}>
            <RotateCw size={13} /> {t('act.restart')}
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil size={13} /> {t('act.edit')}
          </Button>
          <Button variant="ghost" onClick={() => void openExternal('vscode')} title={t('act.openVSCode')}>
            <ExternalLink size={15} />
          </Button>
          <Button variant="ghost" onClick={() => void openExternal('folder')} title={t('act.openFolder')}>
            <Folder size={15} />
          </Button>
        </div>
      </div>

      {/* services */}
      <div className="grid grid-cols-2 gap-3 px-6 py-4">
        {project.services.map((service) => {
          const rt = runtime[keyOf(project.id, service.id)]
          const status = rt?.status ?? 'stopped'
          const isRunning = status === 'running' || status === 'starting'
          return (
            <div key={service.id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <StatusDot status={status} />
                <span className="flex-1 truncate text-[14px] font-medium text-ink">{service.name}</span>
                {rt?.recovered && <Badge className="border-warn/60 text-warn">{t('detail.recoveredBadge')}</Badge>}
                {service.ports.map((p) => (
                  <Badge key={p}>:{p}</Badge>
                ))}
                {isRunning ? (
                  <Button variant="outline" onClick={() => void stopService(project.id, service.id)}>
                    <Square size={12} /> {t('act.stop')}
                  </Button>
                ) : (
                  <Button variant="success" onClick={() => void startService(project.id, service.id)}>
                    <Play size={12} /> {t('act.start')}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => void restartService(project.id, service.id)}>
                  <RotateCw size={13} />
                </Button>
              </div>
              <div className="mt-2 space-y-0.5 font-mono text-[11px] text-subtle">
                <div className="truncate">{service.cwd || project.path || t('detail.noCwd')}</div>
                {rt?.pid && <div>PID {rt.pid}</div>}
                {status === 'running' && rt?.startedAt && (
                  <div>{t('detail.uptime', { duration: formatDuration(now - rt.startedAt) })}</div>
                )}
                {rt?.recovered && <div className="text-warn">{t('detail.recoveredNote')}</div>}
                {status === 'exited' && <div className="text-warn">exit code {rt?.exitCode ?? '?'}</div>}
                {status === 'error' && <div className="text-danger">{rt?.error}</div>}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  className="text-[11px] text-subtle hover:text-accent"
                  onClick={() => void openExternal('folder', service.cwd || project.path)}
                >
                  {t('act.openDir')}
                </button>
                <span className="flex-1" />
                <span className="text-[11px] text-subtle">
                  {service.terminalMode === 'devhub'
                    ? t('detail.builtinLog')
                    : t('detail.external', { mode: service.terminalMode })}
                </span>
              </div>
            </div>
          )
        })}
        {project.services.length === 0 && (
          <div className="col-span-2 rounded-lg border border-dashed border-line p-8 text-center text-[13px] text-subtle">
            {t('detail.noServices')}
          </div>
        )}
      </div>

      {/* logs */}
      <div
        ref={logsRef}
        className={`flex min-h-0 flex-1 flex-col rounded-lg px-6 pb-4 transition-shadow ${
          logsFlash ? 'ring-2 ring-accent' : ''
        }`}
      >
        <div className="mb-2 flex items-center gap-1">
          <span className="mr-2 text-[12px] font-semibold text-subtle">{t('detail.logsTab')}</span>
          <button
            onClick={() => setTab('all')}
            className={`rounded px-2 py-1 text-[12px] ${
              tab === 'all' ? 'bg-accent/15 text-accent' : 'text-subtle hover:bg-surface2'
            }`}
          >
            All
          </button>
          {project.services.map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={`rounded px-2 py-1 text-[12px] ${
                tab === s.id ? 'bg-accent/15 text-accent' : 'text-subtle hover:bg-surface2'
              }`}
            >
              {s.name}
            </button>
          ))}
          <span className="flex-1" />
          <span className="text-[11px] text-subtle">
            {t('detail.logBuffer', { n: config.settings.maxLogLines })}
          </span>
        </div>
        <LogViewer project={project} serviceId={tab} />
      </div>
    </div>
  )
}
