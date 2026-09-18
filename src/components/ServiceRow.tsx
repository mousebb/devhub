import { Play, Square } from 'lucide-react'
import type { ProjectConfig, ServiceConfig, ServiceRuntime } from '@shared/types'
import { IconButton, StatusDot } from './ui'
import { formatDuration } from '../lib/format'

interface Props {
  project: ProjectConfig
  service: ServiceConfig
  runtime?: ServiceRuntime
  now: number
  onStart: () => void
  onStop: () => void
}

/** 单个服务的状态行（项目卡片与分组卡片共用） */
export function ServiceRow({ service, runtime, now, onStart, onStop }: Props) {
  const rt: ServiceRuntime =
    runtime ?? { projectId: '', serviceId: service.id, status: 'stopped' }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface2">
      <StatusDot status={rt.status} showLabel={false} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink/90">{service.name}</span>
      {rt.status === 'running' ? (
        <span className="font-mono text-[11px] text-subtle">
          {rt.recovered && <span className="text-warn">已恢复 · </span>}
          {rt.pid ? `PID ${rt.pid} · ` : ''}
          {formatDuration(now - (rt.startedAt ?? now))}
        </span>
      ) : (
        <span className="text-[11px] capitalize text-subtle">{rt.status}</span>
      )}
      {rt.status === 'running' || rt.status === 'starting' ? (
        <IconButton title="停止" onClick={onStop}>
          <Square size={12} />
        </IconButton>
      ) : (
        <IconButton title="启动" onClick={onStart}>
          <Play size={12} />
        </IconButton>
      )}
    </div>
  )
}
