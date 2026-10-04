import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import type { Study } from '@/types'
import { TODAY } from '@/data/seed'
import { Mono } from '@/components/ui/primitives'
import { cx, fmtDate, pct } from '@/lib/format'

const ROW_LIMIT = 12

/** Gantt-style bars from start to expected completion with a today marker. */
export function StudyTimeline({ studies }: { studies: Study[] }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? studies : studies.slice(0, ROW_LIMIT)

  const { min, max, ticks } = useMemo(() => {
    if (!studies.length) return { min: 0, max: 1, ticks: [] as Date[] }
    const starts = studies.map((s) => parseISO(s.startDate).getTime())
    const ends = studies.map((s) => parseISO(s.expectedCompletion).getTime())
    const lo = startOfMonth(new Date(Math.min(...starts, TODAY.getTime())))
    const hi = addMonths(startOfMonth(new Date(Math.max(...ends, TODAY.getTime()))), 1)
    const spanMonths = (hi.getFullYear() - lo.getFullYear()) * 12 + hi.getMonth() - lo.getMonth()
    const step = spanMonths > 30 ? 6 : spanMonths > 14 ? 3 : 1
    const tk: Date[] = []
    let d = startOfMonth(lo)
    while (d.getMonth() % step !== 0) d = addMonths(d, 1)
    for (; d <= hi; d = addMonths(d, step)) tk.push(d)
    return { min: lo.getTime(), max: hi.getTime(), ticks: tk }
  }, [studies])

  const pos = (ms: number) => ((ms - min) / (max - min)) * 100
  const todayPos = pos(TODAY.getTime())

  return (
    <div>
      <div className="flex text-[11.5px] text-faint">
        <div className="w-[150px] shrink-0 sm:w-[190px]" />
        <div className="relative h-5 flex-1">
          {ticks.map((d) => (
            <span key={d.getTime()} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(d.getTime())}%` }}>
              {format(d, 'MMM yy')}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[150px] sm:left-[190px]" aria-hidden>
          {ticks.map((d) => (
            <span key={d.getTime()} className="absolute inset-y-0 w-px bg-line" style={{ left: `${pos(d.getTime())}%` }} />
          ))}
          <span className="absolute inset-y-0 w-px border-l border-dashed border-crit" style={{ left: `${todayPos}%` }} />
          <span className="absolute -top-0.5 -translate-x-1/2 rounded bg-crit px-1 text-[10.5px] font-medium text-white" style={{ left: `${todayPos}%` }}>Today</span>
        </div>
        <ul className="relative pt-4">
          {rows.map((s) => {
            const a = pos(parseISO(s.startDate).getTime())
            const b = pos(parseISO(s.expectedCompletion).getTime())
            const prog = Math.min(100, pct(s.enrolled, s.target))
            const tone = s.status === 'Critical' ? 'bg-crit' : s.status === 'Attention Required' ? 'bg-warn' : 'bg-ok'
            return (
              <li key={s.id} className="flex items-center py-1">
                <Link to={`/studies/${s.id}`} className="w-[150px] shrink-0 truncate pr-3 text-[12.5px] hover:underline sm:w-[190px]" title={s.title}>
                  <Mono className="text-ink">{s.id}</Mono> <span className="text-muted">{s.shortTitle}</span>
                </Link>
                <div className="relative h-5 flex-1">
                  <div
                    className={cx('absolute top-1 h-3 overflow-hidden rounded-sm opacity-90', tone === 'bg-ok' ? 'bg-ok/25' : tone === 'bg-warn' ? 'bg-warn/25' : 'bg-crit/25')}
                    style={{ left: `${a}%`, width: `${Math.max(0.8, b - a)}%` }}
                    title={`${s.id}: ${fmtDate(s.startDate)} to ${fmtDate(s.expectedCompletion)}, enrolment ${prog}% of target, ${s.status}`}
                  >
                    <div className={cx('h-full', tone)} style={{ width: `${prog}%` }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-ok" />On track</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-warn" />Attention required</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-crit" />Critical</span>
          <span>Solid fill shows enrolment against target</span>
        </div>
        {studies.length > ROW_LIMIT && (
          <button onClick={() => setShowAll((v) => !v)} className="font-medium text-info hover:underline">
            {showAll ? 'Show fewer' : `Show all ${studies.length} studies`}
          </button>
        )}
      </div>
    </div>
  )
}
