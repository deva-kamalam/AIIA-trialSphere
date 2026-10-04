import type { ReactNode } from 'react'
import { cx } from '@/lib/format'

export function KV({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}
