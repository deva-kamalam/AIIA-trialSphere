import { cx } from '@/lib/format'

/** Accessible on/off switch used for per-study configuration toggles. */
export function Switch({ checked, onChange, disabled, label, busy }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; busy?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-info/30 focus-visible:outline-none',
        checked ? 'bg-ok' : 'bg-line-2',
        (disabled || busy) && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className={cx('inline-block size-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}
