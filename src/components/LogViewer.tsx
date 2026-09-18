import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ClipboardCopy, Eraser, FolderOpen, Save, Search } from 'lucide-react'
import type { LogLine, ProjectConfig } from '@shared/types'
import { keyOf } from '../lib/api'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { formatTime } from '../lib/format'
import { Button, IconButton, Input } from './ui'

interface Props {
  project: ProjectConfig
  /** 服务 id，或 'all' 表示合并显示全部 */
  serviceId: string
}

export function LogViewer({ project, serviceId }: Props) {
  const { logs, clearLogs, toast } = useStore()
  const { t } = useT()
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrap, setWrap] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const lines = useMemo<LogLine[]>(() => {
    const ids = serviceId === 'all' ? project.services.map((s) => s.id) : [serviceId]
    const merged = ids.flatMap((id) => logs[keyOf(project.id, id)] ?? [])
    merged.sort((a, b) => a.id - b.id)
    const kw = filter.trim().toLowerCase()
    return kw ? merged.filter((l) => l.text.toLowerCase().includes(kw)) : merged
  }, [logs, project, serviceId, filter])

  useEffect(() => {
    if (!autoScroll) return
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, autoScroll])

  const serviceName = (id: string) => project.services.find((s) => s.id === id)?.name ?? id
  const targetServiceId = serviceId === 'all' ? project.services[0]?.id : serviceId

  const copyAll = async () => {
    const text = lines.map((l) => `[${formatTime(l.ts)}] ${l.text}`).join('\n')
    await navigator.clipboard.writeText(text)
    toast('success', t('log.copied', { n: lines.length }))
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-2 py-1.5">
        <div className="relative w-56">
          <Search size={13} className="absolute left-2 top-2 text-subtle" />
          <Input
            className="!py-1 !pl-7"
            placeholder={t('log.filterPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1 text-[12px] text-subtle">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          {t('log.autoScroll')}
        </label>
        <label className="flex items-center gap-1 text-[12px] text-subtle">
          <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
          {t('log.wrap')}
        </label>
        <span className="text-[11px] text-subtle">{t('log.lines', { n: lines.length })}</span>
        <span className="flex-1" />
        <IconButton title={t('act.copy')} onClick={() => void copyAll()}>
          <ClipboardCopy size={14} />
        </IconButton>
        <IconButton
          title={t('log.saveFile')}
          onClick={async () => {
            if (!targetServiceId) return
            await window.devhub.saveLogs(project.id, targetServiceId)
          }}
        >
          <Save size={14} />
        </IconButton>
        <IconButton
          title={t('log.openFolder')}
          onClick={() => {
            if (targetServiceId) void window.devhub.openLogFolder(project.id, targetServiceId)
          }}
        >
          <FolderOpen size={14} />
        </IconButton>
        <IconButton
          title={t('log.clear')}
          onClick={() => {
            if (serviceId === 'all') {
              for (const s of project.services) void clearLogs(project.id, s.id)
            } else if (targetServiceId) {
              void clearLogs(project.id, targetServiceId)
            }
          }}
        >
          <Eraser size={14} />
        </IconButton>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 select-text overflow-auto bg-canvas px-3 py-2">
        {lines.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-subtle">{t('log.empty')}</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`log-line ${wrap ? '' : 'whitespace-pre'}`}>
              <span className="mr-2 select-none text-subtle/60">{formatTime(line.ts)}</span>
              {serviceId === 'all' && (
                <span className="mr-2 select-none text-accent">[{serviceName(line.serviceId)}]</span>
              )}
              <span
                className={
                  line.stream === 'stderr'
                    ? 'text-danger'
                    : line.stream === 'system'
                      ? 'text-accent/80'
                      : 'text-ink/90'
                }
              >
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>

      {!autoScroll && (
        <Button
          variant="outline"
          className="absolute bottom-4 right-6"
          onClick={() => {
            setAutoScroll(true)
            const el = containerRef.current
            if (el) el.scrollTop = el.scrollHeight
          }}
        >
          <ArrowDownToLine size={13} /> {t('log.backToBottom')}
        </Button>
      )}
    </div>
  )
}
