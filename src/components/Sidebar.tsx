import { useMemo, useState } from 'react'
import {
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Star
} from 'lucide-react'
import type { ProjectConfig, ServiceRuntime } from '@shared/types'
import { useT } from '../lib/i18n'
import { StackIcon, projectStack } from './StackIcon'

export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'group'; value: string }
  | { kind: 'tag'; value: string }

interface Props {
  projects: ProjectConfig[]
  runtime: Record<string, ServiceRuntime>
  view: View
  collapsed: boolean
  onToggleCollapse: () => void
  onViewChange: (view: View) => void
  onOpenProject: (id: string) => void
  onSettings: () => void
  runningCount: number
}

export function Sidebar({
  projects,
  runtime,
  view,
  collapsed,
  onToggleCollapse,
  onViewChange,
  onOpenProject,
  onSettings,
  runningCount
}: Props) {
  const { t } = useT()
  const [treeOpen, setTreeOpen] = useState(true)

  const tags = useMemo(() => [...new Set(projects.flatMap((p) => p.tags))].sort(), [projects])

  /** 分组 → 成员 + 未分组项目，用于「全部项目」下的树 */
  const tree = useMemo(() => {
    const byGroup = new Map<string, ProjectConfig[]>()
    const loose: ProjectConfig[] = []
    for (const p of [...projects].sort((a, b) => a.name.localeCompare(b.name))) {
      if (p.group) {
        if (!byGroup.has(p.group)) byGroup.set(p.group, [])
        byGroup.get(p.group)!.push(p)
      } else {
        loose.push(p)
      }
    }
    return { groups: [...byGroup.entries()].map(([name, members]) => ({ name, members })), loose }
  }, [projects])

  /** 项目 → 是否有服务在跑（树里给个小圆点） */
  const runningIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of Object.values(runtime)) {
      if (r.status === 'running' || r.status === 'starting') ids.add(r.projectId)
    }
    return ids
  }, [runtime])

  const isActive = (v: View) =>
    v.kind === view.kind && (v as { value?: string }).value === (view as { value?: string }).value

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
      active ? 'bg-accent/15 text-accent' : 'text-ink/80 hover:bg-surface2'
    }`

  const subItemClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] transition-colors ${
      active ? 'bg-accent/15 text-accent' : 'text-ink/75 hover:bg-surface2'
    }`

  const railBtnClass = (active: boolean) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors ${
      active ? 'bg-accent/15 text-accent' : 'text-ink/70 hover:bg-surface2 hover:text-ink'
    }`

  /* ----------------------------- 折叠态（图标条） ----------------------------- */
  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="my-1.5 h-px w-6 bg-line" />
        <button
          className={railBtnClass(isActive({ kind: 'all' }))}
          title={t('app.allProjectsTooltip', { n: projects.length })}
          onClick={() => onViewChange({ kind: 'all' })}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          className={railBtnClass(isActive({ kind: 'favorites' }))}
          title={t('app.favorites')}
          onClick={() => onViewChange({ kind: 'favorites' })}
        >
          <Star size={16} />
        </button>
        <button
          className={railBtnClass(isActive({ kind: 'recent' }))}
          title={t('app.recent')}
          onClick={() => onViewChange({ kind: 'recent' })}
        >
          <FolderOpen size={16} />
        </button>
        <span className="flex-1" />
        {runningCount > 0 && (
          <span
            className="mb-1 text-center text-[10px] leading-tight text-ok"
            title={t('app.runningCount', { n: runningCount })}
          >
            ●
          </span>
        )}
        <button className={railBtnClass(false)} title={t('app.settings')} onClick={onSettings}>
          <Settings size={16} />
        </button>
        <button className={railBtnClass(false)} title={t('app.expandSidebar')} onClick={onToggleCollapse}>
          <PanelLeftOpen size={16} />
        </button>
      </aside>
    )
  }

  /* ------------------------------ 展开态（完整） ------------------------------ */
  const projectRow = (p: ProjectConfig) => (
    <button key={p.id} className={subItemClass(false)} onClick={() => onOpenProject(p.id)} title={p.path || p.name}>
      <span className="grid w-3.5 shrink-0 place-items-center">
        <StackIcon stack={projectStack(p)} fallbackEmoji={p.icon} size={12} />
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
      {runningIds.has(p.id) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />}
    </button>
  )

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-none text-ink">DevHub</div>
          <div className="mt-0.5 truncate text-[11px] text-subtle">
            {runningCount > 0 ? t('app.runningCount', { n: runningCount }) : t('app.tagline')}
          </div>
        </div>
        <button
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-subtle hover:bg-surface2 hover:text-ink"
          title={t('app.collapseSidebar')}
          onClick={onToggleCollapse}
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        <div className="space-y-0.5">
          <div
            className={`flex items-center rounded-md transition-colors ${
              isActive({ kind: 'all' }) ? 'bg-accent/15' : 'hover:bg-surface2'
            }`}
          >
            <button
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                isActive({ kind: 'all' }) ? 'text-accent' : 'text-ink/80'
              }`}
              onClick={() => onViewChange({ kind: 'all' })}
            >
              <LayoutGrid size={15} />
              <span className="flex-1 truncate">{t('app.allProjects')}</span>
              <span className="text-[11px] text-subtle">{projects.length}</span>
            </button>
            <button
              className="mr-1 grid h-5 w-5 shrink-0 place-items-center rounded text-subtle hover:bg-surface2 hover:text-ink"
              title={treeOpen ? t('app.collapseTree') : t('app.expandTree')}
              onClick={() => setTreeOpen((v) => !v)}
            >
              <ChevronRight size={13} className={`transition-transform ${treeOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {treeOpen && (
            <div className="ml-3 space-y-1 border-l border-line pl-2">
              {tree.groups.map((g) => (
                <div key={`g:${g.name}`} className="space-y-0.5">
                  <button
                    className={subItemClass(isActive({ kind: 'group', value: g.name }))}
                    onClick={() => onViewChange({ kind: 'group', value: g.name })}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    <span className="min-w-0 flex-1 truncate text-left">{g.name}</span>
                    <span className="text-[11px] text-subtle">{g.members.length}</span>
                  </button>
                  <div className="ml-2 space-y-0.5 border-l border-line pl-2">{g.members.map(projectRow)}</div>
                </div>
              ))}
              {tree.loose.map(projectRow)}
              {!projects.length && <div className="px-2 py-1 text-[11px] text-subtle">{t('list.noProjects')}</div>}
            </div>
          )}

          <button
            className={itemClass(isActive({ kind: 'favorites' }))}
            onClick={() => onViewChange({ kind: 'favorites' })}
          >
            <Star size={15} />
            <span className="flex-1">{t('app.favorites')}</span>
            <span className="text-[11px] text-subtle">{projects.filter((p) => p.favorite).length}</span>
          </button>
          <button className={itemClass(isActive({ kind: 'recent' }))} onClick={() => onViewChange({ kind: 'recent' })}>
            <FolderOpen size={15} />
            <span>{t('app.recent')}</span>
          </button>
        </div>

        {tags.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {t('app.tags')}
            </div>
            <div className="flex flex-wrap gap-1 px-2">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => onViewChange({ kind: 'tag', value: t })}
                  className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                    isActive({ kind: 'tag', value: t })
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line text-subtle hover:text-ink'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-line p-2">
        <button className={itemClass(false)} onClick={onSettings}>
          <Settings size={15} />
          <span>{t('app.settings')}</span>
        </button>
      </div>
    </aside>
  )
}
