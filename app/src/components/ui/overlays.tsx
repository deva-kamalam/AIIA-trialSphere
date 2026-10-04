import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, X, Info, XCircle } from 'lucide-react'
import { cx } from '@/lib/format'
import { ToastCtx, type ToastKind } from './toast'

// ---------- Modal ----------
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')?.focus(), 20)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose])
  if (!open) return null
  const w = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-xl'
  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('anim-rise w-full rounded-[var(--radius-panel)] bg-white shadow-[0_20px_50px_-12px_rgba(15,39,71,0.35)]', w)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <button data-close onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Close dialog">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Drawer (right side) ----------
export function Drawer({ open, onClose, title, children, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="anim-fade fixed inset-0 z-40 bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" className={cx('anim-rise absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl', width)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="font-semibold text-ink">{title}</div>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Close panel"><X className="size-4" /></button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}

// ---------- Popover / dropdown ----------
export function Popover({ trigger, children, align = 'right', className, open: controlled, onOpenChange }: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  className?: string
  open?: boolean
  onOpenChange?: (o: boolean) => void
}) {
  const [inner, setInner] = useState(false)
  const open = controlled ?? inner
  const setOpen = useCallback((o: boolean) => { setInner(o); onOpenChange?.(o) }, [onOpenChange])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, setOpen])
  const close = () => setOpen(false)
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div className={cx('anim-rise absolute top-full z-30 mt-1.5 rounded-[var(--radius-panel)] border border-line bg-white shadow-[0_12px_32px_-8px_rgba(15,39,71,0.22)]', align === 'right' ? 'right-0' : 'left-0', className)}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}

// ---------- Toasts ----------
interface Toast { id: number; kind: ToastKind; message: string }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setItems((t) => [...t, { id, kind, message }])
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const icon = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
  const color = { success: 'text-ok', error: 'text-crit', warning: 'text-warn', info: 'text-info' }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
          {items.map((t) => {
            const I = icon[t.kind]
            return (
              <div key={t.id} className="anim-rise pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-line bg-white px-3.5 py-3 text-sm text-ink shadow-[0_12px_32px_-8px_rgba(15,39,71,0.25)]">
                <I className={cx('mt-0.5 size-4 shrink-0', color[t.kind])} aria-hidden />
                <span>{t.message}</span>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
