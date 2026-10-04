import type { ReactNode, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from 'lucide-react'
import { cx } from '@/lib/format'
import type { SortDir } from '@/lib/hooks'

// ---------- Table ----------
export function Table({ children, className, minWidth = 900 }: { children: ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cx('scroll-thin overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-[13.5px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-line bg-canvas/70 text-[12.5px] text-muted">{children}</thead>
}

export function Th({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx('px-3 py-2.5 font-medium whitespace-nowrap first:pl-4 last:pr-4', className)} {...rest}>{children}</th>
}

export function SortTh<K extends string>({ label, k, sort, onSort, className, align }: {
  label: string; k: K; sort: { key: unknown; dir: SortDir }; onSort: (k: K) => void; className?: string; align?: 'right'
}) {
  const active = sort.key === k
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cx('px-3 py-2.5 font-medium whitespace-nowrap first:pl-4 last:pr-4', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(k)} className={cx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink', align === 'right' && 'flex-row-reverse')}>
        {label}
        <Icon className={cx('size-3.5', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  )
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cx('px-3 py-2.5 align-middle first:pl-4 last:pr-4', className)}>{children}</td>
}

export function Tr({ children, onClick, className, active }: { children: ReactNode; onClick?: () => void; className?: string; active?: boolean }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cx('border-b border-line last:border-0', onClick && 'cursor-pointer hover:bg-canvas focus-visible:bg-canvas', active && 'bg-info-soft/50', className)}
    >
      {children}
    </tr>
  )
}

export function Pager({ page, pages, setPage, from, to, total, noun = 'records' }: {
  page: number; pages: number; setPage: (p: number) => void; from: number; to: number; total: number; noun?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[13px] text-muted">
      <span className="tnum">{from}–{to} of {total.toLocaleString('en-IN')} {noun}</span>
      <div className="flex items-center gap-1">
        <button className="rounded p-1.5 hover:bg-canvas disabled:opacity-30" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        <span className="tnum px-1">Page {page + 1} of {pages}</span>
        <button className="rounded p-1.5 hover:bg-canvas disabled:opacity-30" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  )
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: readonly (T | { id: T; label: string; count?: number })[]; value: T; onChange: (t: T) => void; className?: string
}) {
  return (
    <div role="tablist" className={cx('scroll-thin flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line', className)}>
      {tabs.map((t) => {
        const id = typeof t === 'string' ? t : t.id
        const label = typeof t === 'string' ? t : t.label
        const count = typeof t === 'string' ? undefined : t.count
        const active = id === value
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cx(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap',
              active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
            {count !== undefined && <span className={cx('tnum rounded px-1 text-xs', active ? 'bg-ink text-white' : 'bg-canvas text-muted')}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Segmented control ----------
export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-[var(--radius-ctl)] border border-line-2 bg-white p-0.5" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cx('rounded-[4px] px-2.5 font-medium', size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]', value === o.id ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Filter bar ----------
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center gap-2 border-b border-line px-4 py-3', className)}>{children}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-[var(--radius-ctl)] border border-line-2 bg-white pr-7 pl-8 text-[13px] placeholder:text-faint focus:border-info focus:ring-2 focus:ring-info/20 focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly (string | { value: string; label: string })[]; allLabel?: string
}) {
  const active = value !== ''
  return (
    <label className={cx('relative inline-flex h-8 items-center rounded-[var(--radius-ctl)] border text-[13px]', active ? 'border-ink bg-ink/[0.04]' : 'border-line-2 bg-white')}>
      <span className="pl-2.5 text-muted">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full max-w-[180px] cursor-pointer appearance-none truncate bg-transparent pr-6 pl-1 font-medium text-ink focus:outline-none">
        <option value="">{allLabel ?? 'All'}</option>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value
          const l = typeof o === 'string' ? o : o.label
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-1.5 size-3.5 text-faint" aria-hidden />
    </label>
  )
}

export function ClearFilters({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null
  return <button onClick={onClear} className="h-8 px-2 text-[13px] font-medium text-info hover:underline">Clear filters</button>
}
