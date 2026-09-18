import { useState } from 'react'
import { Check, Folder, Loader2, Scan, Sparkles } from 'lucide-react'
import type { DetectedProject } from '@shared/types'
import { STACK_LABELS, createDefaultService } from '@shared/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { Badge, Button, Field, Input, Modal } from './ui'

interface Props {
  onClose: () => void
  onManual: (path: string) => void
}

export function AddProjectWizard({ onClose, onManual }: Props) {
  const { saveProject, toast, config } = useStore()
  const { t } = useT()
  const [root, setRoot] = useState('')
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<DetectedProject[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scanned, setScanned] = useState(false)
  const [group, setGroup] = useState('')

  const scan = async (dir?: string) => {
    const target = dir ?? root
    if (!target) {
      toast('warn', t('wiz.pickFolder'))
      return
    }
    setScanning(true)
    setScanned(false)
    try {
      const found = (await window.devhub.scanDirectory(target, 2)).filter((r) => r.isProject)
      setResults(found)
      setSelected(new Set(found.map((r) => r.path)))
      setScanned(true)
      // 识别出多个子项目（如前后端）时，自动以父目录名预填分组，点击一次即可成组；
      // 仅识别到单个项目则清空分组，避免上一个目录的分组名串到本次
      if (found.length >= 2) {
        const name = target.split(/[\\/]/).filter(Boolean).pop() ?? ''
        if (name) setGroup(name)
      } else {
        setGroup('')
      }
      if (!found.length) toast('info', t('wiz.noProjectHint'))
    } finally {
      setScanning(false)
    }
  }

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const createSelected = async () => {
    const chosen = results.filter((r) => selected.has(r.path))
    if (!chosen.length) return
    for (const item of chosen) {
      const project = {
        id: `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: item.name,
        path: item.path,
        group: group.trim(),
        tags: [STACK_LABELS[item.stack]],
        notes: '',
        favorite: false,
        icon: '📦',
        services: [
          createDefaultService({
            name: item.suggestions[0]?.label ?? 'dev',
            cwd: item.path,
            command: item.suggestions[0]?.command ?? '',
            terminalMode: config.settings.defaultTerminalMode
          })
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      await saveProject(project)
    }
    toast('success', t('wiz.added', { n: chosen.length }))
    onClose()
  }

  return (
    <Modal
      title={t('wiz.title')}
      onClose={onClose}
      width="w-[720px]"
      footer={
        <>
          <Button variant="ghost" onClick={() => onManual(root)}>
            {t('wiz.manual')}
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('act.cancel')}
          </Button>
          <Button variant="primary" disabled={!selected.size} onClick={() => void createSelected()}>
            {t('wiz.addSelected', { n: selected.size })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('wiz.scanRoot')} hint={t('wiz.scanRootHint')}>
          <div className="flex gap-2">
            <Input
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              placeholder="E:\Projects"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void scan()
              }}
            />
            <Button
              variant="outline"
              onClick={async () => {
                const dir = await window.devhub.pickDirectory()
                if (dir) {
                  setRoot(dir)
                  void scan(dir)
                }
              }}
            >
              <Folder size={13} /> {t('act.browse')}
            </Button>
            <Button variant="primary" onClick={() => void scan()} disabled={scanning}>
              {scanning ? <Loader2 size={13} className="animate-spin" /> : <Scan size={13} />} {t('wiz.scan')}
            </Button>
          </div>
        </Field>

        <Field label={t('wiz.groupLabel')} hint={t('wiz.groupHint')}>
          <Input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder={t('wiz.groupPlaceholder')}
          />
        </Field>

        <div className="rounded-lg border border-line">
          {!scanned ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[12px] text-subtle">
              <Sparkles size={20} />
              {t('wiz.hintPick')}
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-subtle">{t('wiz.noneFound')}</div>
          ) : (
            <div className="max-h-[340px] divide-y divide-line overflow-y-auto">
              {results.map((item) => {
                const active = selected.has(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => toggle(item.path)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      active ? 'bg-accent/10' : 'hover:bg-surface2'
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                        active ? 'border-accent bg-accent text-white' : 'border-line'
                      }`}
                    >
                      {active && <Check size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{item.name}</span>
                        <Badge>{STACK_LABELS[item.stack]}</Badge>
                      </span>
                      <span className="block truncate text-[11px] text-subtle">{item.path}</span>
                      {item.suggestions[0] && (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-accent">
                          {item.suggestions[0].command}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
