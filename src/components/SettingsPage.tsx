import { useEffect, useState } from 'react'
import { Check, Copy, Download, FolderOpen, Info, Loader2, Upload, X } from 'lucide-react'
import type { AppInfo } from '@shared/ipc'
import type { EnvInfoEntry, TerminalMode, ToolInfo } from '@shared/types'
import { TERMINAL_MODE_LABELS } from '@shared/types'
import { LANG_OPTIONS, terminalModeLabel, type Lang } from '@shared/i18n'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { Badge, Button, Select, Toggle } from './ui'

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { config, updateSettings, toast, refresh } = useStore()
  const { t, lang } = useT()
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
        <h1 className="text-[18px] font-semibold text-ink">{t('set.title')}</h1>
        <span className="flex-1" />
        <Button variant="outline" onClick={onBack}>
          {t('set.back')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[13px] font-semibold text-ink">{t('set.general')}</h2>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">{t('set.language')}</span>
            <Select
              value={lang}
              onChange={(e) => void updateSettings({ language: e.target.value as Lang })}
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">{t('set.theme')}</span>
            <Select value={s.theme} onChange={(e) => void updateSettings({ theme: e.target.value as typeof s.theme })}>
              <option value="dark">{t('set.themeDark')}</option>
              <option value="light">{t('set.themeLight')}</option>
              <option value="system">{t('set.themeSystem')}</option>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">{t('set.defaultRunMode')}</span>
            <Select
              value={s.defaultTerminalMode}
              onChange={(e) => void updateSettings({ defaultTerminalMode: e.target.value as TerminalMode })}
            >
              {Object.keys(TERMINAL_MODE_LABELS).map((k) => (
                <option key={k} value={k}>
                  {terminalModeLabel(lang, k)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink/80">{t('set.maxLogLines')}</span>
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
            label={t('set.checkPorts')}
          />
          <Toggle
            checked={s.confirmBeforeStopAll}
            onChange={(v) => void updateSettings({ confirmBeforeStopAll: v })}
            label={t('set.confirmStopAll')}
          />
          <Toggle
            checked={s.minimizeToTray}
            onChange={(v) => void updateSettings({ minimizeToTray: v })}
            label={t('set.minimizeToTray')}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[13px] font-semibold text-ink">{t('set.config')}</h2>
          <div className="space-y-1 text-[12px] text-subtle">
            <div className="flex items-center gap-2">
              <span className="w-20 text-ink/70">{t('set.version')}</span>
              <span>{info?.version ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-ink/70">{t('set.dataDir')}</span>
              <span className="truncate">{info?.dataDir ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-ink/70">{t('set.configFile')}</span>
              <span className="truncate">{info?.configPath ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-ink/70">{t('set.logDir')}</span>
              <span className="truncate">{info?.logDir ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-ink/70">{t('set.projectCount')}</span>
              <span>{config.projects.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              onClick={async () => {
                const res = await window.devhub.exportConfig()
                if (!res.canceled) toast('success', t('set.exported', { path: res.path ?? '' }))
              }}
            >
              <Download size={13} /> {t('set.exportConfig')}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await window.devhub.importConfig()
                if (!res.canceled) {
                  await refresh()
                  toast('success', t('set.imported'))
                }
              }}
            >
              <Upload size={13} /> {t('set.importConfig')}
            </Button>
            <Button variant="ghost" onClick={() => info && void window.devhub.openExplorer(info.dataDir)}>
              <FolderOpen size={13} /> {t('set.dataDir')}
            </Button>
            <Button variant="ghost" onClick={() => info && void window.devhub.openExplorer(info.logDir)}>
              <FolderOpen size={13} /> {t('set.logDir')}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-subtle">{t('set.dataNote')}</p>
        </section>

        <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-ink">{t('set.env')}</h2>
            <Info size={13} className="text-subtle" />
          </div>
          <p className="text-[11px] text-subtle">{t('set.envNote')}</p>
          <div className="space-y-1">
            {env.map((item) => (
              <div key={item.key} className="rounded-md border border-line bg-canvas px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-accent">{item.key}</span>
                  <span className="flex-1" />
                  <button
                    className="text-subtle hover:text-ink"
                    title={t('act.copy')}
                    onClick={() => void navigator.clipboard.writeText(item.value)}
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div className="log-line max-h-20 overflow-auto break-all text-subtle">
                  {item.value || t('set.notSet')}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-ink">{t('set.tools')}</h2>
            {loadingTools && <Loader2 size={13} className="animate-spin text-subtle" />}
          </div>
          <p className="text-[11px] text-subtle">{t('set.toolsNote')}</p>
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
                  {tool.found ? tool.path : t('set.notFound')}
                </span>
                {tool.version && <Badge>{tool.version.slice(0, 24)}</Badge>}
              </div>
            ))}
            {!tools.length && !loadingTools && <div className="text-[12px] text-subtle">{t('set.detectFailed')}</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

