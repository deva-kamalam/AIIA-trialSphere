import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { cx } from '@/lib/format'
import { toneFor, type Tone } from './tone'

export type { Tone }

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: LucideIcon
  loading?: boolean
}
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 disabled:bg-ink/50',
  secondary: 'bg-white text-ink border border-line-2 hover:border-ink-3 hover:bg-canvas disabled:text-faint',
  ghost: 'text-ink-3 hover:bg-ink/5 hover:text-ink disabled:text-faint',
  danger: 'bg-crit text-white hover:bg-crit/90 disabled:bg-crit/50',
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-ctl)] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  )
})

// ---------- Badge ----------
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  crit: 'bg-crit-soft text-crit',
  info: 'bg-info-soft text-info',
  neutral: 'bg-canvas text-muted ring-1 ring-inset ring-line',
  ink: 'bg-ink text-white',
}
export function Badge({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <Badge tone={toneFor(status)} dot className={className}>{status}</Badge>
}

// ---------- Panel ----------
export function Panel({ title, subtitle, actions, children, className, bodyClass, id }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string
}) {
  return (
    <section id={id} className={cx('rounded-[var(--radius-panel)] border border-line bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClass)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------- KPI ----------
export function Kpi({ label, value, delta, deltaTone, hint, icon: Icon, onClick, tone }: {
  label: string; value: ReactNode; delta?: string; deltaTone?: Tone; hint?: string; icon?: LucideIcon; onClick?: () => void; tone?: Tone
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cx(
        'group relative flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-line bg-white px-4 py-3 text-left',
        onClick && 'transition-colors hover:border-ink-3',
      )}
    >
      {tone && tone !== 'neutral' && (
        <span className={cx('absolute inset-y-3 left-0 w-[3px] rounded-r', tone === 'crit' ? 'bg-crit' : tone === 'warn' ? 'bg-warn' : tone === 'ok' ? 'bg-ok' : 'bg-info')} aria-hidden />
      )}
      <div className="flex items-center justify-between gap-2 text-[13px] text-muted">
        <span className="truncate">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-faint" aria-hidden />}
      </div>
      <div className="tnum mt-1 text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">{value}</div>
      {(delta || hint) && (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs whitespace-nowrap">
          {delta && <span className={cx('shrink-0 font-medium', TONES[deltaTone ?? 'neutral'].split(' ').find((c) => c.startsWith('text-')))}>{delta}</span>}
          {hint && <span className="truncate text-faint">{hint}</span>}
        </div>
      )}
    </Comp>
  )
}

// ---------- Progress ----------
export function Progress({ value, tone = 'ink', className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const bar = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : tone === 'crit' ? 'bg-crit' : tone === 'info' ? 'bg-info' : 'bg-ink'
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-line', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full', bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function MeterCell({ value, warnBelow = 85, critBelow = 75, suffix = '%' }: { value: number; warnBelow?: number; critBelow?: number; suffix?: string }) {
  const tone: Tone = value < critBelow ? 'crit' : value < warnBelow ? 'warn' : 'ok'
  return (
    <div className="flex min-w-[96px] items-center gap-2">
      <Progress value={value} tone={tone} className="w-14" />
      <span className="tnum text-[13px] text-ink">{value}{suffix}</span>
    </div>
  )
}

// ---------- Form fields ----------
export function Field({ label, hint, error, children, required, htmlFor, className }: {
  label: string; hint?: string; error?: string; children: ReactNode; required?: boolean; htmlFor?: string; className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}{required && <span className="ml-0.5 text-crit" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-crit" role="alert">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  )
}

const inputBase = 'h-9 w-full rounded-[var(--radius-ctl)] border bg-white px-2.5 text-sm text-ink placeholder:text-faint focus:border-info focus:outline-none focus:ring-2 focus:ring-info/20 disabled:bg-canvas'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cx(inputBase, invalid ? 'border-crit' : 'border-line-2', className)} aria-invalid={invalid || undefined} {...rest} />
  },
)

export function Select({ className, children, invalid, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx(inputBase, 'pr-8', invalid ? 'border-crit' : 'border-line-2', className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx(inputBase, 'h-auto min-h-20 py-2', invalid ? 'border-crit' : 'border-line-2', className)} aria-invalid={invalid || undefined} {...rest} />
}

export function RadioGroup<T extends string>({ name, value, options, onChange, invalid }: {
  name: string; value: T | ''; options: readonly T[]; onChange: (v: T) => void; invalid?: boolean
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o}
          className={cx(
            'flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-ctl)] border px-3 text-sm',
            value === o ? 'border-ink bg-ink/[0.04] text-ink' : invalid ? 'border-crit/60' : 'border-line-2 text-ink-3 hover:border-ink-3',
          )}
        >
          <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="accent-ink" />
          {o}
        </label>
      ))}
    </div>
  )
}

// ---------- States ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded bg-line/70', className)} />
}

export function EmptyState({ icon: Icon, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 size-8 text-faint" aria-hidden />}
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-[48ch] text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function HealthDot({ level, label }: { level: 'ok' | 'warn' | 'crit' | 'na'; label?: string }) {
  const c = level === 'ok' ? 'bg-ok' : level === 'warn' ? 'bg-warn' : level === 'crit' ? 'bg-crit' : 'bg-line-2'
  return <span className={cx('inline-block size-2.5 rounded-full', c)} role="img" aria-label={label ?? level} title={label} />
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[12.5px] tracking-tight whitespace-nowrap', className)}>{children}</span>
}
