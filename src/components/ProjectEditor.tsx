import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Folder,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import type { DetectedProject, EnvVar, ProjectConfig, ServiceConfig, TerminalMode } from '@shared/types'
import { TERMINAL_MODE_LABELS, createDefaultService, createId } from '@shared/types'
import { useStore } from '../lib/store'
import { Button, Field, IconButton, Input, Modal, Select, TextArea, Toggle } from './ui'

interface Props {
  project: ProjectConfig
  onClose: () => void
}

export function ProjectEditor({ project, onClose }: Props) {
  const { saveProject, toast, config } = useStore()
  const [draft, setDraft] = useState<ProjectConfig>({ ...project })
  const [detected, setDetected] = useState<Record<string, DetectedProject | undefined>>({})

  const patch = (p: Partial<ProjectConfig>) => setDraft((d) => ({ ...d, ...p }))

  const updateService = (id: string, p: Partial<ServiceConfig>) =>
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.id === id ? { ...s, ...p } : s)) }))

  const removeService = (id: string) =>
    setDraft((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }))

  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const services = [...d.services]
      const target = index + dir
      if (target < 0 || target >= services.length) return d
      ;[services[index], services[target]] = [services[target], services[index]]
      return { ...d, services }
    })

  const addService = () =>
    setDraft((d) => ({
      ...d,
      services: [
        ...d.services,
        createDefaultService({
          name: `Service ${d.services.length + 1}`,
          cwd: d.path,
          terminalMode: config.settings.defaultTerminalMode
        })
      ]
    }))

  const detectScripts = async (serviceId: string, cwd: string) => {
    if (!cwd) {
      toast('warn', '请先填写工作目录')
      return
    }
    const results = await window.devhub.scanDirectory(cwd, 0)
    const found = results.find((r) => r.isProject)
    setDetected((prev) => ({ ...prev, [serviceId]: found }))
    if (!found) toast('info', '未在该目录识别到项目（package.json / pubspec.yaml / requirements.txt 等）')
  }

  const addDetectedServices = async () => {
    if (!draft.path) {
      toast('warn', '请先填写项目目录')
      return
    }
    const results = (await window.devhub.scanDirectory(draft.path, 2)).filter((r) => r.isProject)
    if (!results.length) {
      toast('info', '没有扫描到可识别的项目')
      return
    }
    const services: ServiceConfig[] = results.map((r) =>
      createDefaultService({
        name: r.name,
        cwd: r.path,
        command: r.suggestions[0]?.command ?? '',
        terminalMode: config.settings.defaultTerminalMode
      })
    )
    setDraft((d) => ({ ...d, services: [...d.services, ...services] }))
    toast('success', `已添加 ${services.length} 个服务，请检查命令是否正确`)
  }

  const browse = async (setter: (value: string) => void) => {
    const dir = await window.devhub.pickDirectory()
    if (dir) setter(dir)
  }

  const save = async () => {
    const cleaned: ProjectConfig = {
      ...draft,
      name: draft.name.trim() || '未命名项目',
      services: draft.services.map((s) => ({
        ...s,
        name: s.name.trim() || 'Service',
        command: s.command.trim(),
        cwd: (s.cwd || draft.path).trim(),
        env: s.env.filter((e) => e.key.trim())
      })),
      updatedAt: Date.now()
    }
    await saveProject(cleaned)
    onClose()
  }

  return (
    <Modal
      title={project.id && config.projects.some((p) => p.id === project.id) ? `编辑项目 · ${project.name}` : '新建项目'}
      onClose={onClose}
      width="w-[860px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 基本信息 */}
        <div className="grid grid-cols-[64px_1fr] gap-3">
          <Field label="图标">
            <Input value={draft.icon} maxLength={2} onChange={(e) => patch({ icon: e.target.value })} />
          </Field>
          <Field label="项目名称">
            <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="ComHome" />
          </Field>
        </div>

        <Field label="项目目录" hint="DevHub 不会写入项目目录">
          <div className="flex gap-2">
            <Input value={draft.path} onChange={(e) => patch({ path: e.target.value })} placeholder="E:\Projects\ComHome" />
            <Button variant="outline" onClick={() => void browse((v) => patch({ path: v }))}>
              <Folder size={13} /> 浏览
            </Button>
            <Button variant="outline" onClick={() => void addDetectedServices()}>
              <Sparkles size={13} /> 扫描子项目
            </Button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="分组" hint="填同一个分组名的多个项目会合并成一张卡片，可一键启停全部成员（如前后端）">
            <Input value={draft.group} onChange={(e) => patch({ group: e.target.value })} placeholder="如 MyApp（前后端同名）" />
          </Field>
          <Field label="标签" hint="逗号分隔">
            <Input
              value={draft.tags.join(', ')}
              onChange={(e) =>
                patch({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
              }
              placeholder="Node, Backend"
            />
          </Field>
        </div>

        <Field label="备注">
          <TextArea rows={2} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>

        <div className="flex items-center gap-4">
          <Toggle checked={draft.favorite} onChange={(v) => patch({ favorite: v })} label="收藏" />
        </div>

        {/* 服务列表 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">服务（{draft.services.length}）</span>
            <Button variant="outline" onClick={addService}>
              <Plus size={13} /> 添加服务
            </Button>
          </div>

          <div className="space-y-3">
            {draft.services.map((service, index) => (
              <div key={service.id} className="rounded-lg border border-line bg-canvas p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="w-40 rounded-md border border-line bg-surface px-2 py-1 text-[13px] font-medium text-ink outline-none focus:border-accent"
                    value={service.name}
                    onChange={(e) => updateService(service.id, { name: e.target.value })}
                  />
                  <span className="text-[11px] text-subtle">#{index + 1} 启动顺序</span>
                  <span className="flex-1" />
                  <IconButton title="上移" onClick={() => move(index, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton title="下移" onClick={() => move(index, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton title="删除服务" onClick={() => removeService(service.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Field label="工作目录">
                        <div className="flex gap-2">
                          <Input
                            value={service.cwd}
                            onChange={(e) => updateService(service.id, { cwd: e.target.value })}
                            placeholder={draft.path || 'E:\\Projects\\ComHome\\backend'}
                          />
                          <Button variant="outline" onClick={() => void browse((v) => updateService(service.id, { cwd: v }))}>
                            <Folder size={13} />
                          </Button>
                          <Button variant="outline" onClick={() => void detectScripts(service.id, service.cwd || draft.path)}>
                            <Search size={13} /> 检测
                          </Button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <Field label="启动命令">
                    <Input
                      className="font-mono"
                      value={service.command}
                      onChange={(e) => updateService(service.id, { command: e.target.value })}
                      placeholder="npm run start:dev"
                    />
                  </Field>

                  {detected[service.id]?.scripts?.length ? (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5">
                      <span className="text-[11px] text-subtle">检测到脚本：</span>
                      {detected[service.id]!.scripts.map((s) => (
                        <button
                          key={s.name}
                          onClick={() => updateService(service.id, { command: s.command })}
                          className="rounded border border-line bg-surface2 px-1.5 py-0.5 text-[11px] text-ink hover:border-accent hover:text-accent"
                        >
                          {s.name}
                        </button>
                      ))}
                      <span className="flex-1" />
                      <IconButton title="关闭" onClick={() => setDetected((p) => ({ ...p, [service.id]: undefined }))}>
                        <X size={13} />
                      </IconButton>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-4 gap-2">
                    <Field label="启动延迟(ms)">
                      <Input
                        type="number"
                        value={service.startupDelay}
                        onChange={(e) => updateService(service.id, { startupDelay: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="端口" hint="逗号分隔">
                      <Input
                        value={service.ports.join(',')}
                        onChange={(e) =>
                          updateService(service.id, {
                            ports: e.target.value
                              .split(',')
                              .map((p) => Number(p.trim()))
                              .filter((n) => Number.isFinite(n) && n > 0)
                          })
                        }
                        placeholder="3000"
                      />
                    </Field>
                    <Field label="运行方式">
                      <Select
                        value={service.terminalMode}
                        onChange={(e) => updateService(service.id, { terminalMode: e.target.value as TerminalMode })}
                      >
                        {Object.entries(TERMINAL_MODE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="flex flex-col justify-end gap-1.5 pb-1">
                      <Toggle
                        checked={service.enabled}
                        onChange={(v) => updateService(service.id, { enabled: v })}
                        label="参与启动全部"
                      />
                      <Toggle
                        checked={service.autoRestart}
                        onChange={(v) => updateService(service.id, { autoRestart: v })}
                        label="崩溃自动重启"
                      />
                    </div>
                  </div>

                  <EnvVarEditor
                    env={service.env}
                    onChange={(env) => updateService(service.id, { env })}
                  />
                </div>
              </div>
            ))}

            {draft.services.length === 0 && (
              <div className="rounded-lg border border-dashed border-line p-6 text-center text-[12px] text-subtle">
                还没有服务。点击「添加服务」手动添加，或点「扫描子项目」自动识别。
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function EnvVarEditor({ env, onChange }: { env: EnvVar[]; onChange: (env: EnvVar[]) => void }) {
  const update = (index: number, patch: Partial<EnvVar>) =>
    onChange(env.map((e, i) => (i === index ? { ...e, ...patch } : e)))

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium text-subtle">环境变量（仅作用于该服务子进程）</span>
        <Button variant="ghost" onClick={() => onChange([...env, { key: '', value: '', secret: false }])}>
          <Plus size={12} /> 添加
        </Button>
      </div>
      {env.length > 0 && (
        <div className="space-y-1">
          {env.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                className="!w-48 font-mono"
                placeholder="KEY"
                value={item.key}
                onChange={(e) => update(index, { key: e.target.value })}
              />
              <Input
                className="flex-1 font-mono"
                placeholder="value"
                type={item.secret ? 'password' : 'text'}
                value={item.value}
                onChange={(e) => update(index, { value: e.target.value })}
              />
              <label className="flex items-center gap-1 text-[11px] text-subtle">
                <input type="checkbox" checked={item.secret} onChange={(e) => update(index, { secret: e.target.checked })} />
                密钥
              </label>
              <IconButton title="删除" onClick={() => onChange(env.filter((_, i) => i !== index))}>
                <Trash2 size={13} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function newProjectDraft(path?: string): ProjectConfig {
  const now = Date.now()
  return {
    id: createId('prj'),
    name: path ? path.split(/[\\/]/).filter(Boolean).pop() ?? 'New Project' : 'New Project',
    path: path ?? '',
    group: '',
    tags: [],
    notes: '',
    favorite: false,
    icon: '📦',
    services: [],
    createdAt: now,
    updatedAt: now
  }
}
