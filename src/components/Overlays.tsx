import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { Button, Modal } from './ui'

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex animate-fade-in items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-lg ${
            t.level === 'error' ? 'border-l-4 border-l-danger' : t.level === 'warn' ? 'border-l-4 border-l-warn' : ''
          }`}
        >
          {t.level === 'success' && <CheckCircle2 size={15} className="mt-0.5 text-ok" />}
          {t.level === 'error' && <XCircle size={15} className="mt-0.5 text-danger" />}
          {t.level === 'warn' && <AlertTriangle size={15} className="mt-0.5 text-warn" />}
          {t.level === 'info' && <Info size={15} className="mt-0.5 text-accent" />}
          <span className="flex-1 whitespace-pre-wrap break-words text-[12px] text-ink">{t.message}</span>
          <button className="text-subtle hover:text-ink" onClick={() => dismissToast(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const { confirmRequest, resolveConfirm } = useStore()
  if (!confirmRequest) return null
  const { title, message, confirmText = '确定', cancelText = '取消', danger } = confirmRequest
  const close = (value: boolean) => resolveConfirm(value)
  return (
    <Modal
      title={title}
      onClose={() => close(false)}
      width="w-[460px]"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {cancelText}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/80">{message}</p>
    </Modal>
  )
}
