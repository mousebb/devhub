import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import type { ServiceStatus } from '@shared/types'

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'success' | 'warn'

const BTN: Record<BtnVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  ghost: 'text-ink hover:bg-surface2',
  outline: 'border border-line text-ink hover:bg-surface2',
  danger: 'bg-danger text-white hover:brightness-110',
  success: 'bg-ok text-white hover:brightness-110',
  warn: 'bg-warn text-white hover:brightness-110'
}

export function Button({
  variant = 'outline',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${BTN[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function IconButton({
  title,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-subtle focus:border-accent ${className}`}
    />
  )
}

export function TextArea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-subtle focus:border-accent ${className}`}
    />
  )
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent ${className}`}
    >
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[13px] text-ink"
    >
      <span
        className={`relative h-4 w-8 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-subtle">{label}</span>
        {hint && <span className="text-[11px] text-subtle/70">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'w-[720px]'
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div
        className={`${width} max-h-full animate-pop-in overflow-hidden rounded-xl border border-line bg-surface shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          <IconButton onClick={onClose} title="关闭">
            <X size={16} />
          </IconButton>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

const STATUS_META: Record<ServiceStatus, { color: string; label: string }> = {
  stopped: { color: 'bg-subtle', label: 'Stopped' },
  starting: { color: 'bg-warn', label: 'Starting' },
  running: { color: 'bg-ok', label: 'Running' },
  exited: { color: 'bg-subtle/60', label: 'Exited' },
  error: { color: 'bg-danger', label: 'Error' }
}

export function StatusDot({
  status,
  showLabel = true,
  pulse = true
}: {
  status: ServiceStatus
  showLabel?: boolean
  pulse?: boolean
}) {
  const meta = STATUS_META[status] ?? STATUS_META.stopped
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-subtle">
      <span className="relative inline-flex h-2 w-2">
        {status === 'running' && pulse && (
          <span className={`absolute inline-flex h-2 w-2 animate-ping rounded-full ${meta.color} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.color}`} />
      </span>
      {showLabel && <span className="text-ink/80">{meta.label}</span>}
    </span>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border border-line bg-surface2 px-1.5 py-0.5 text-[11px] text-subtle ${className}`}
    >
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="text-subtle/60">{icon}</div>}
      <div className="text-[14px] font-medium text-ink/80">{title}</div>
      {hint && <div className="max-w-md text-[12px] text-subtle">{hint}</div>}
    </div>
  )
}
