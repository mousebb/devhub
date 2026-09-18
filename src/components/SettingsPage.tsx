import { useEffect, useState } from 'react'
import { Check, Copy, Download, FolderOpen, Info, Loader2, Upload, X } from 'lucide-react'
import type { AppInfo } from '@shared/ipc'
import type { EnvInfoEntry, TerminalMode, ToolInfo } from '@shared/types'
import { TERMINAL_MODE_LABELS } from '@shared/types'
import { useStore } from '../lib/store'
import { Badge, Button, Select, Toggle } from './ui'

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { config, updateSettings, toast, refresh } = useStore()
  const [info, setInfo] = useState<AppInfo>()
  const [env, setEnv] = useState<EnvInfoEntry[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [loadingTools, setLoadingTools] = useState(true)

  useEffect(() => {
    void window.devhub.getAppInfo().then(setInfo)
    void window.devhub.getEnvInfo().then(setEnv)
    setLoadingTools(true)
    void window.devhub.getTools().then((t) => {
      setTools(t)
      setLoadingTools(false)
    })
  }, [])

  const s = config.settings

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-[18px] font-semibold text-ink">设置</h1>
        <span className="flex-1" />
        <Button variant="outline" onClick={onBack}>
          返回项目列表
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[13px] font-semibold text-ink">通用</h2>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">主题</span>
            <Select value={s.theme} onChange={(e) => void updateSettings({ theme: e.target.value as typeof s.theme })}>
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">默认运行方式</span>
            <Select
              value={s.defaultTerminalMode}
              onChange={(e) => void updateSettings({ defaultTerminalMode: e.target.value as TerminalMode })}
            >
              {Object.entries(TERMINAL_MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">内存日志上限（行）</span>
            <input
              type="number"
              className="w-24 rounded-md border border-line bg-canvas px-2 py-1 text-[13px] text-ink outline-none focus:border-accent"
              value={s.maxLogLines}
              onChange={(e) => void updateSettings({ maxLogLines: Number(e.target.value) || 1000 })}
            />
          </div>
          <Toggle
            checked={s.checkPorts}
            onChange={(v) => void updateSettings({ checkPorts: v })}
            label="启动前检测端口占用"
          />
          <Toggle
            checked={s.confirmBeforeStopAll}
            onChange={(v) => void updateSettings({ confirmBeforeStopAll: v })}
            label="停止全部前确认"
          />
          <Toggle
            checked={s.minimizeToTray}
            onChange={(v) => void updateSettings({ minimizeToTray: v })}
            label="关闭窗口时最小化到托盘"
          />
        </section>

        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[13px] font-semibold text-ink">配置</h2>
          <div className="space-y-1 text-[12px] text-subtle">
            <div className="flex items-center gap-2">
              <span className="w-20 text-ink/70">版本</span>
              <span>{info?.version ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-ink/70">数据目录</span>
              <span className="truncate">{info?.dataDir ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-ink/70">配置文件</span>
              <span className="truncate">{info?.configPath ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-ink/70">日志目录</span>
              <span className="truncate">{info?.logDir ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-ink/70">项目数</span>
              <span>{config.projects.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              onClick={async () => {
                const res = await window.devhub.exportConfig()
                if (!res.canceled) toast('success', `已导出到 ${res.path}`)
              }}
            >
              <Download size={13} /> 导出配置
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await window.devhub.importConfig()
                if (!res.canceled) {
                  await refresh()
                  toast('success', '已导入配置')
                }
              }}
            >
              <Upload size={13} /> 导入配置
            </Button>
            <Button variant="ghost" onClick={() => info && void window.devhub.openExplorer(info.dataDir)}>
              <FolderOpen size={13} /> 数据目录
            </Button>
            <Button variant="ghost" onClick={() => info && void window.devhub.openExplorer(info.logDir)}>
              <FolderOpen size={13} /> 日志目录
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-subtle">
            配置与日志都放在 <span className="font-mono">DevHub 自身目录下的 data\</span>（不再占用 C
            盘用户目录），依然不会写入被管理的项目目录。导出时会剔除标记为「密钥」的环境变量值。
          </p>
        </section>

        <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-ink">环境（只读）</h2>
            <Info size={13} className="text-subtle" />
          </div>
          <p className="text-[11px] text-subtle">DevHub 继承当前用户环境，且不会修改 PATH / NODE_PATH / PYTHONPATH。</p>
          <div className="space-y-1">
            {env.map((item) => (
              <div key={item.key} className="rounded-md border border-line bg-canvas px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-accent">{item.key}</span>
                  <span className="flex-1" />
                  <button
                    className="text-subtle hover:text-ink"
                    title="复制"
                    onClick={() => void navigator.clipboard.writeText(item.value)}
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div className="log-line max-h-20 overflow-auto break-all text-subtle">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-ink">可用工具</h2>
            {loadingTools && <Loader2 size={13} className="animate-spin text-subtle" />}
          </div>
          <p className="text-[11px] text-subtle">
            DevHub 不管理、也不安装这些运行时 —— 能否使用取决于你自己的 Windows 环境。
          </p>
          <div className="space-y-1">
            {tools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-2 rounded-md border border-line bg-canvas px-2 py-1.5">
                {tool.found ? (
                  <Check size={13} className="text-ok" />
                ) : (
                  <X size={13} className="text-subtle/60" />
                )}
                <span className="w-16 font-mono text-[12px] text-ink">{tool.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-subtle">
                  {tool.found ? tool.path : '未找到'}
                </span>
                {tool.version && <Badge>{tool.version.slice(0, 24)}</Badge>}
              </div>
            ))}
            {!tools.length && !loadingTools && <div className="text-[12px] text-subtle">未能检测</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

