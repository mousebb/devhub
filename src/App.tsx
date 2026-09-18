import { useMemo, useState } from 'react'
import { PackageOpen, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { StoreProvider, useStore } from './lib/store'
import { useT } from './lib/i18n'
import type { ProjectConfig } from '@shared/types'
import { Sidebar, type View } from './components/Sidebar'
import { ProjectCard } from './components/ProjectCard'
import { GroupCard } from './components/GroupCard'
import { ProjectDetail } from './components/ProjectDetail'
import { ProjectEditor, newProjectDraft } from './components/ProjectEditor'
import { AddProjectWizard } from './components/AddProjectWizard'
import { SettingsPage } from './components/SettingsPage'
import { ConfirmDialog, Toasts } from './components/Overlays'
import { Button, EmptyState, Input, Select } from './components/ui'

type SortMode = 'name' | 'recent' | 'created'

const SIDEBAR_KEY = 'devhub.sidebarCollapsed'

function Shell() {
  const { config, runtime, ready } = useStore()
  const { t } = useT()
  const [view, setView] = useState<View>({ kind: 'all' })
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('name')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProjectConfig | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      localStorage.setItem(SIDEBAR_KEY, v ? '0' : '1')
      return !v
    })
  }

  const runningCount = Object.values(runtime).filter(
    (r) => r.status === 'running' || r.status === 'starting'
  ).length

  const projects = useMemo(() => {
    let list = config.projects
    if (view.kind === 'favorites') list = list.filter((p) => p.favorite)
    if (view.kind === 'group') list = list.filter((p) => p.group === view.value)
    if (view.kind === 'tag') list = list.filter((p) => p.tags.includes(view.value!))

    const kw = query.trim().toLowerCase()
    if (kw) {
      list = list.filter((p) =>
        [p.name, p.path, p.group, p.notes, ...p.tags, ...p.services.map((s) => `${s.name} ${s.command}`)]
          .join(' ')
          .toLowerCase()
          .includes(kw)
      )
    }

    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'recent') sorted.sort((a, b) => (b.lastStartedAt ?? 0) - (a.lastStartedAt ?? 0))
    if (sort === 'created') sorted.sort((a, b) => b.createdAt - a.createdAt)
    return sorted
  }, [config.projects, view, query, sort])

  const selected = config.projects.find((p) => p.id === selectedId) ?? null

  // 在「全部项目 / 分组」视图下，按 group 字段把成员项目折叠成一张分组卡片；
  // 其它视图（收藏 / 最近 / 标签 / 搜索）保持平铺，避免层级混乱。
  const shouldGroup = view.kind === 'all' || view.kind === 'group'
  const { groups, ungrouped } = useMemo(() => {
    const byGroup = new Map<string, ProjectConfig[]>()
    const loose: ProjectConfig[] = []
    for (const p of projects) {
      if (p.group) {
        if (!byGroup.has(p.group)) byGroup.set(p.group, [])
        byGroup.get(p.group)!.push(p)
      } else {
        loose.push(p)
      }
    }
    const g = [...byGroup.entries()].map(([name, members]) => ({ name, members }))
    return { groups: g, ungrouped: loose }
  }, [projects])

  const openProject = (id: string) => {
    setSelectedId(id)
    void window.devhub.touchProject(id)
  }

  const viewTitle =
    view.kind === 'all'
      ? t('app.allProjects')
      : view.kind === 'favorites'
        ? t('app.favorites')
        : view.kind === 'recent'
          ? t('app.recent')
          : view.value!

  return (
    <div className="flex h-full">
      <Sidebar
        projects={config.projects}
        runtime={runtime}
        view={view}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onViewChange={(v) => {
          setView(v)
          setSelectedId(null)
          setSettingsOpen(false)
        }}
        onOpenProject={(id) => {
          setSettingsOpen(false)
          openProject(id)
        }}
        onSettings={() => {
          setSettingsOpen(true)
          setSelectedId(null)
        }}
        runningCount={runningCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {settingsOpen ? (
          <SettingsPage onBack={() => setSettingsOpen(false)} />
        ) : selected ? (
          <ProjectDetail
            project={selected}
            onBack={() => {
              setSelectedId(null)
            }}
            onEdit={() => setEditing(selected)}
          />
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line px-6 py-3">
              <h1 className="text-[16px] font-semibold text-ink">{viewTitle}</h1>
              <span className="text-[12px] text-subtle">{t('app.projectsCount', { n: projects.length })}</span>
              <div className="relative w-72">
                <Search size={14} className="absolute left-2.5 top-2 text-subtle" />
                <Input
                  className="!py-1 !pl-8"
                  placeholder={t('list.searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <span className="flex-1" />
              <div className="flex items-center gap-1 text-[12px] text-subtle">
                <SlidersHorizontal size={13} />
                <Select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                  <option value="name">{t('list.sortName')}</option>
                  <option value="recent">{t('list.sortRecent')}</option>
                  <option value="created">{t('list.sortCreated')}</option>
                </Select>
              </div>
              <Button variant="primary" onClick={() => setWizardOpen(true)}>
                <Plus size={14} /> {t('list.addProject')}
              </Button>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!ready ? (
                <div className="py-16 text-center text-[13px] text-subtle">{t('list.loading')}</div>
              ) : projects.length === 0 ? (
                <EmptyState
                  icon={<PackageOpen size={28} />}
                  title={config.projects.length ? t('list.emptyMatchTitle') : t('list.emptyTitle')}
                  hint={config.projects.length ? t('list.emptyMatchHint') : t('list.emptyHint')}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {shouldGroup ? (
                    <>
                      {groups.map((g) => (
                        <GroupCard
                          key={`group:${g.name}`}
                          groupName={g.name}
                          members={g.members}
                          onOpenProject={openProject}
                          onEdit={(p) => setEditing(p)}
                        />
                      ))}
                      {ungrouped.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onOpen={() => openProject(project.id)}
                          onEdit={() => setEditing(project)}
                        />
                      ))}
                    </>
                  ) : (
                    projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onOpen={() => openProject(project.id)}
                        onEdit={() => setEditing(project)}
                      />
                    ))
                  )}
                </div>
              )}
            </main>
          </>
        )}
      </div>

      {editing && <ProjectEditor project={editing} onClose={() => setEditing(null)} />}
      {wizardOpen && (
        <AddProjectWizard
          onClose={() => setWizardOpen(false)}
          onManual={(path) => {
            setWizardOpen(false)
            setEditing(newProjectDraft(path))
          }}
        />
      )}

      <Toasts />
      <ConfirmDialog />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
