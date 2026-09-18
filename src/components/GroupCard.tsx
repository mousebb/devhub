import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Play, Square } from 'lucide-react'
import type { ProjectConfig } from '@shared/types'
import { useStore } from '../lib/store'
import { keyOf } from '../lib/api'
import { useNow } from '../lib/useNow'
import { Button } from './ui'
import { StackIcon, projectStack } from './StackIcon'
import { ServiceRow } from './ServiceRow'

interface Props {
  groupName: string
  members: ProjectConfig[]
  onOpenProject: (id: string) => void
  onEdit: (project: ProjectConfig) => void
}

export function GroupCard({ groupName, members, onOpenProject }: Props) {
  const { runtime, startGroup, stopGroup, startService, stopService } = useStore()
  const now = useNow()
  const [expanded, setExpanded] = useState(true)

  const allServices = members.flatMap((p) => p.services.map((s) => ({ project: p, service: s })))
  const enabledCount = allServices.filter((x) => x.service.enabled).length
  const running = allServices.filter((x) => {
    const s = runtime[keyOf(x.project.id, x.service.id)]
    return s && (s.status === 'running' || s.status === 'starting')
  })
  const allRunning = enabledCount > 0 && running.length === enabledCount

  return (
    <div className="group flex flex-col rounded-xl border border-accent/30 bg-surface p-4 transition-shadow hover:shadow-lg">
      {/* 分组名 + 分组级启停按钮 */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-accent">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <Layers size={18} className="text-accent" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-ink">{groupName}</span>
            <span className="block text-[11px] text-subtle">
              {members.length} 个项目 · {enabledCount} 个服务
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {allRunning ? (
            <Button variant="danger" onClick={() => void stopGroup(groupName)}>
              <Square size={12} /> 停止
            </Button>
          ) : (
            <Button variant="success" onClick={() => void startGroup(groupName)}>
              <Play size={12} /> 启动
            </Button>
          )}
        </div>
      </div>

      {/* 成员项目（折叠时隐藏） */}
      {expanded && (
        <div className="mt-3 space-y-2">
          {members.map((member) => {
            const stack = projectStack(member)
            return (
              <div key={member.id} className="rounded-lg border border-line/60 bg-surface2/40 p-2">
                <button
                  onClick={() => onOpenProject(member.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-surface2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <StackIcon stack={stack} fallbackEmoji={member.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {member.name}
                  </span>
                  <span className="text-[11px] text-subtle">{member.services.length} 个服务</span>
                </button>
                <div className="mt-1 space-y-1">
                  {member.services.map((service) => (
                    <ServiceRow
                      key={service.id}
                      project={member}
                      service={service}
                      runtime={runtime[keyOf(member.id, service.id)]}
                      now={now}
                      onStart={() => void startService(member.id, service.id)}
                      onStop={() => void stopService(member.id, service.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
