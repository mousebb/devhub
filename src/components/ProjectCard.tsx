import { useEffect, useState } from 'react'
import {
  Copy,
  ExternalLink,
  Folder,
  Pencil,
  Play,
  RotateCw,
  ScrollText,
  Square,
  Star,
  Trash2
} from 'lucide-react'
import type { ProjectConfig } from '@shared/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { keyOf } from '../lib/api'
import { useNow } from '../lib/useNow'
import { Button, IconButton } from './ui'
import { LogViewer } from './LogViewer'
import { StackIcon, projectStack } from './StackIcon'
import { ServiceRow } from './ServiceRow'

interface Props {
  project: ProjectConfig
  onOpen: () => void
  onEdit: () => void
}

export function ProjectCard({ project, onOpen, onEdit }: Props) {
  const {
    runtime,
    loadLogs,
    startService,
    stopService,
    toggleFavorite,
    startAll,
    stopAll,
    deleteProject,
    duplicateProject,
    toast
  } = useStore()
  const { t } = useT()
  const now = useNow()
  const [logOpen, setLogOpen] = useState(false)
  const stack = projectStack(project)

  const statuses = project.services.map(
    (s) =>
      runtime[keyOf(project.id, s.id)] ?? {
        projectId: project.id,
        serviceId: s.id,
        status: 'stopped' as const
      }
  )
  const running = statuses.filter((s) => s.status === 'running' || s.status === 'starting')
  const allRunning =
    project.services.length > 0 && running.length === project.services.filter((s) => s.enabled).length
  const multiRunning = running.length > 0 && project.services.length > 1

  const openExternal = async (kind: 'vscode' | 'folder') => {
    const target = project.path
    if (!target) {
      toast('error', t('msg.noProjectPath'))
      return
    }
    const res =
      kind === 'vscode'
        ? await window.devhub.openVSCode(target)
        : await window.devhub.openExplorer(target)
    if (!res.ok) toast('error', res.message ?? t('detail.opFailed'))
  }

  // 点开日志时把各服务历史+实时日志拉进 store
  useEffect(() => {
    if (logOpen) for (const s of project.services) void loadLogs(project.id, s.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logOpen, project.id])

  return (
    <div className="group flex flex-col rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-lg">
      {/* 项目名 + 所有操作按钮同一行 */}
      <div className="flex items-start gap-2">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <StackIcon stack={stack} fallbackEmoji={project.icon} size={22} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-ink">{project.name}</span>
            <span className="block truncate text-[11px] text-subtle">{project.path || t('card.noPath')}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {allRunning ? (
            <Button variant="danger" onClick={() => void stopAll(project.id)}>
              <Square size={12} /> {t('act.stop')}
            </Button>
          ) : (
            <Button variant="success" onClick={() => void startAll(project.id)}>
              <Play size={12} /> {t('act.start')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setLogOpen((o) => !o)}
            title={t('act.viewLogs')}
            className={logOpen ? '!border-accent !text-accent' : ''}
          >
            <ScrollText size={12} /> {t('act.logs')}
          </Button>
          {multiRunning && (
            <IconButton
              title={t('act.restartAll')}
              onClick={async () => {
                await stopAll(project.id)
                await startAll(project.id)
              }}
            >
              <RotateCw size={13} />
            </IconButton>
          )}
          <IconButton
            title={project.favorite ? t('act.unfavorite') : t('act.favorite')}
            onClick={() => void toggleFavorite(project.id)}
            className={project.favorite ? 'text-warn' : ''}
          >
            <Star size={15} fill={project.favorite ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton title={t('act.openVSCode')} onClick={() => void openExternal('vscode')}>
            <ExternalLink size={14} />
          </IconButton>
          <IconButton title={t('act.openFolder')} onClick={() => void openExternal('folder')}>
            <Folder size={14} />
          </IconButton>
          <IconButton title={t('act.duplicate')} onClick={() => void duplicateProject(project.id)}>
            <Copy size={14} />
          </IconButton>
          <IconButton title={t('act.edit')} onClick={onEdit}>
            <Pencil size={14} />
          </IconButton>
          <IconButton title={t('act.delete')} onClick={() => void deleteProject(project.id)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      {/* 服务列表 */}
      <div className="mt-3 space-y-1">
        {project.services.length === 0 && (
          <div className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[12px] text-subtle">
            {t('card.noServices')}
          </div>
        )}
        {project.services.map((service) => (
          <ServiceRow
            key={service.id}
            project={project}
            service={service}
            runtime={runtime[keyOf(project.id, service.id)]}
            now={now}
            onStart={() => void startService(project.id, service.id)}
            onStop={() => void stopService(project.id, service.id)}
          />
        ))}
      </div>

      {/* 卡内下拉日志面板 */}
      {logOpen && (
        <div className="mt-3 h-[340px]">
          <LogViewer project={project} serviceId="all" />
        </div>
      )}
    </div>
  )
}
