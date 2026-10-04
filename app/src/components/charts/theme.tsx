// Shared chart tooltip and legend. Colours and axis styling live in palette.ts.
interface TipPayload { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

export function ChartTooltip({ active, payload, label, unit, labelFormatter }: {
  active?: boolean; payload?: TipPayload[]; label?: string | number; unit?: string; labelFormatter?: (l: string | number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(15,39,71,0.25)]">
      {label !== undefined && <div className="mb-1 font-medium text-ink">{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="tnum ml-auto pl-3 font-medium text-ink">
            {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={i.dashed ? { backgroundImage: `linear-gradient(90deg, ${i.color} 60%, transparent 0)`, backgroundSize: '5px 2px' } : { background: i.color, height: 8, width: 8, borderRadius: 2 }}
            aria-hidden
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}
