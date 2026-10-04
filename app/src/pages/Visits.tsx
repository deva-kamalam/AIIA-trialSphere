import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CalendarDays, CalendarX2, CheckCircle2, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek, subDays,
} from 'date-fns'
import { studyService, visitService } from '@/services'
import { useAsync, useSort, usePaged } from '@/lib/hooks'
import { cx, daysFromToday, fmtDate, fmtNum } from '@/lib/format'
import { useAuth } from '@/auth/useAuth'
import { TODAY } from '@/data/seed'
import type { Visit, VisitStatus } from '@/types'
import { Badge, Button, EmptyState, Field, Input, Kpi, Mono, PageHeader, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import { ClearFilters, FilterBar, FilterSelect, Pager, SearchInput, Segmented, SortTh, THead, Table, Td, Th, Tr } from '@/components/ui/data'
import { daysPastWindow, isoAdd, todayIso } from './participants/shared'

const STATUSES: VisitStatus[] = ['Completed', 'Upcoming', 'Overdue', 'Missed']
const BACK = 21
const AHEAD = 42

const PILL: Record<VisitStatus, { cls: string; word: string }> = {
  Completed: { cls: 'bg-ok-soft text-ok', word: 'done' },
  Upcoming: { cls: 'bg-info-soft text-info', word: 'due' },
  Overdue: { cls: 'bg-crit-soft text-crit', word: 'overdue' },
  Missed: { cls: 'bg-crit text-white', word: 'missed' },
}

export default function Visits() {
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { data, loading, setData } = useAsync(() => visitService.window(BACK, AHEAD), [])
  const { data: studies } = useAsync(() => studyService.list(), [])
  const [view, setView] = useState<'calendar' | 'table'>('calendar')
  const [month, setMonth] = useState(() => startOfMonth(TODAY))
  const [completeFor, setCompleteFor] = useState<Visit | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<Visit | null>(null)

  const f = {
    study: params.get('study') ?? '',
    status: params.get('status') ?? '',
    coord: params.get('coordinator') ?? '',
    q: params.get('q') ?? '',
    day: params.get('day') ?? '',
  }
  const setF = (k: 'study' | 'status' | 'coordinator' | 'q' | 'day', v: string) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      if (v) n.set(k, v)
      else n.delete(k)
      return n
    }, { replace: true })
  const anyFilter = !!(f.study || f.status || f.coord || f.q || f.day)
  const clearAll = () => setParams(new URLSearchParams(), { replace: true })

  const visits = useMemo(() => data ?? [], [data])
  const today = todayIso()

  const coordinators = useMemo(() => [...new Set(visits.map((v) => v.coordinator))].sort(), [visits])
  const studyOpts = useMemo(() => {
    const ids = [...new Set(visits.map((v) => v.studyId))].sort()
    const short = new Map((studies ?? []).map((s) => [s.id, s.shortTitle]))
    return ids.map((id) => ({ value: id, label: short.get(id) ? `${id} ${short.get(id)}` : id }))
  }, [visits, studies])

  // Scope used for workload KPIs: study + coordinator only.
  const scoped = useMemo(() => visits.filter((v) => (!f.study || v.studyId === f.study) && (!f.coord || v.coordinator === f.coord)), [visits, f.study, f.coord])
  const kpi = useMemo(() => {
    const in14 = isoAdd(today, 14)
    let todayN = 0, upcoming = 0, overdue = 0, missed = 0
    for (const v of scoped) {
      if (v.scheduledDate === today && v.status !== 'Missed') todayN++
      if (v.status === 'Upcoming' && v.scheduledDate > today && v.scheduledDate <= in14) upcoming++
      if (v.status === 'Overdue') overdue++
      if (v.status === 'Missed') missed++
    }
    return { todayN, upcoming, overdue, missed }
  }, [scoped, today])

  // All filters except the selected day (calendar counts use this).
  const filteredNoDay = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return scoped.filter((v) => {
      if (f.status && v.status !== f.status) return false
      if (q && !(v.participantId.toLowerCase().includes(q) || v.visit.toLowerCase().includes(q))) return false
      return true
    })
  }, [scoped, f.status, f.q])
  const filtered = useMemo(() => (f.day ? filteredNoDay.filter((v) => v.scheduledDate === f.day) : filteredNoDay), [filteredNoDay, f.day])

  const { sorted, sort, toggle } = useSort<Visit>(filtered, { key: 'scheduledDate', dir: 'asc' })
  const paged = usePaged(sorted, 25)

  const byDay = useMemo(() => {
    const m = new Map<string, Record<VisitStatus, number>>()
    for (const v of filteredNoDay) {
      let c = m.get(v.scheduledDate)
      if (!c) { c = { Completed: 0, Upcoming: 0, Overdue: 0, Missed: 0 }; m.set(v.scheduledDate, c) }
      c[v.status]++
    }
    return m
  }, [filteredNoDay])

  const applyUpdate = (u: Visit) => setData((prev) => (prev ? prev.map((v) => (v.id === u.id ? u : v)) : prev))

  return (
    <div>
      <PageHeader
        title="Visits"
        subtitle={`Visit schedule and coordinator workload, ${fmtDate(format(subDays(TODAY, BACK), 'yyyy-MM-dd'))} to ${fmtDate(isoAdd(today, AHEAD))}.`}
        actions={<Segmented options={[{ id: 'calendar', label: 'Calendar' }, { id: 'table', label: 'Table' }] as const} value={view} onChange={setView} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Today's visits" value={loading ? <Skeleton className="h-7 w-12" /> : fmtNum(kpi.todayN)} icon={CalendarDays} hint={format(TODAY, 'EEEE, d MMM')}
          onClick={() => { setF('day', f.day === today ? '' : today) }} />
        <Kpi label="Upcoming" value={loading ? <Skeleton className="h-7 w-12" /> : fmtNum(kpi.upcoming)} icon={Clock} hint="Next 14 days" tone="info"
          onClick={() => setF('status', f.status === 'Upcoming' ? '' : 'Upcoming')} />
        <Kpi label="Overdue" value={loading ? <Skeleton className="h-7 w-12" /> : fmtNum(kpi.overdue)} icon={AlertTriangle} hint="Past target date, not completed" tone={kpi.overdue ? 'crit' : undefined}
          onClick={() => setF('status', f.status === 'Overdue' ? '' : 'Overdue')} />
        <Kpi label="Missed" value={loading ? <Skeleton className="h-7 w-12" /> : fmtNum(kpi.missed)} icon={CalendarX2} hint="Window closed without a visit" tone={kpi.missed ? 'crit' : undefined}
          onClick={() => setF('status', f.status === 'Missed' ? '' : 'Missed')} />
      </div>

      <section className="rounded-[var(--radius-panel)] border border-line bg-white">
        <FilterBar>
          <SearchInput value={f.q} onChange={(v) => setF('q', v)} placeholder="Search participant ID or visit" className="w-full sm:w-64" />
          <FilterSelect label="Study" value={f.study} onChange={(v) => setF('study', v)} options={studyOpts} />
          <FilterSelect label="Status" value={f.status} onChange={(v) => setF('status', v)} options={STATUSES} />
          <FilterSelect label="Coordinator" value={f.coord} onChange={(v) => setF('coordinator', v)} options={coordinators} />
          {f.day && (
            <span className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-ctl)] border border-ink bg-ink/[0.04] pr-1 pl-2.5 text-[13px] font-medium text-ink">
              {fmtDate(f.day)}
              <button onClick={() => setF('day', '')} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Clear day filter"><X className="size-3.5" /></button>
            </span>
          )}
          <ClearFilters show={anyFilter} onClear={clearAll} />
        </FilterBar>

        {view === 'calendar' && (
          <MonthCalendar month={month} setMonth={setMonth} byDay={byDay} selected={f.day} onSelect={(d) => setF('day', d === f.day ? '' : d)} loading={loading} />
        )}

        <div className={cx('flex flex-wrap items-center justify-between gap-2 px-4 py-2.5', view === 'calendar' && 'border-t border-line')}>
          <h2 className="text-[15px] font-semibold text-ink">
            {f.day ? `Visits on ${fmtDate(f.day)}` : 'Visit list'}
          </h2>
          <span className="tnum text-[13px] text-muted">{loading ? '' : `${fmtNum(filtered.length)} visits`}</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CalendarClock} title={f.day ? 'No visits scheduled on this day' : 'No visits match these filters'} body="Select another day in the calendar or clear the filters." action={anyFilter ? <Button onClick={clearAll}>Clear filters</Button> : undefined} />
        ) : (
          <>
            <Table minWidth={1180}>
              <THead>
                <tr>
                  <SortTh label="Participant" k="participantId" sort={sort} onSort={toggle} />
                  <SortTh label="Study" k="studyId" sort={sort} onSort={toggle} />
                  <SortTh label="Visit" k="visit" sort={sort} onSort={toggle} />
                  <SortTh label="Scheduled" k="scheduledDate" sort={sort} onSort={toggle} />
                  <Th>Window</Th>
                  <SortTh label="Actual" k="actualDate" sort={sort} onSort={toggle} />
                  <SortTh label="Status" k="status" sort={sort} onSort={toggle} />
                  <SortTh label="Coordinator" k="coordinator" sort={sort} onSort={toggle} />
                  {can('visits:edit') && <Th className="text-right">Actions</Th>}
                </tr>
              </THead>
              <tbody>
                {paged.slice.map((v) => {
                  const overdue = v.status === 'Overdue'
                  const past = daysPastWindow(v)
                  const earliest = isoAdd(v.scheduledDate, -v.windowDays)
                  const canComplete = v.status !== 'Completed' && earliest <= today
                  const d = daysFromToday(v.scheduledDate)
                  return (
                    <Tr key={v.id} className={overdue || v.status === 'Missed' ? 'shadow-[inset_3px_0_0_var(--color-crit)]' : undefined}>
                      <Td><Link to={`/participants/${v.participantId}`} className="text-info hover:underline"><Mono>{v.participantId}</Mono></Link></Td>
                      <Td><Mono className="text-ink-3">{v.studyId}</Mono></Td>
                      <Td className="whitespace-nowrap">{v.visit}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="tnum">{fmtDate(v.scheduledDate)}</span>
                        {v.scheduledDate === today && <Badge tone="ink" className="ml-1.5">Today</Badge>}
                      </Td>
                      <Td className="tnum text-muted">{v.windowDays ? `±${v.windowDays} days` : 'Same day'}</Td>
                      <Td className="tnum whitespace-nowrap">{fmtDate(v.actualDate)}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {overdue && <AlertTriangle className="size-4 text-crit" aria-hidden />}
                          <StatusBadge status={v.status} />
                          {overdue && <span className="text-xs text-crit">{past > 0 ? `${past}d past window` : `${-d}d late`}</span>}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">{v.coordinator}</Td>
                      {can('visits:edit') && (
                        <Td className="text-right whitespace-nowrap">
                          {v.status !== 'Completed' ? (
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="ghost" icon={CheckCircle2} disabled={!canComplete} title={canComplete ? undefined : 'Visit window has not opened yet'} onClick={() => setCompleteFor(v)}>Mark completed</Button>
                              <Button size="sm" variant="ghost" icon={CalendarClock} onClick={() => setRescheduleFor(v)}>Reschedule</Button>
                            </div>
                          ) : <span className="text-xs text-faint">No action</span>}
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <Pager {...paged} noun="visits" />
          </>
        )}
      </section>

      {completeFor && (
        <CompleteModal
          visit={completeFor}
          onClose={() => setCompleteFor(null)}
          onDone={(u) => { applyUpdate(u); setCompleteFor(null); toast('success', 'Visit marked completed') }}
        />
      )}
      {rescheduleFor && (
        <RescheduleModal
          visit={rescheduleFor}
          onClose={() => setRescheduleFor(null)}
          onDone={(u) => { applyUpdate(u); setRescheduleFor(null); toast('success', 'Visit rescheduled') }}
        />
      )}
    </div>
  )
}

// ---------------- Calendar ----------------
function MonthCalendar({ month, setMonth, byDay, selected, onSelect, loading }: {
  month: Date; setMonth: (d: Date) => void; byDay: Map<string, Record<VisitStatus, number>>; selected: string; onSelect: (d: string) => void; loading: boolean
}) {
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const today = todayIso()
  const from = format(subDays(TODAY, BACK), 'yyyy-MM-dd')
  const to = isoAdd(today, AHEAD)
  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(addMonths(month, -1))} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
          <h2 className="min-w-[140px] text-center text-[15px] font-semibold text-ink">{format(month, 'MMMM yyyy')}</h2>
          <button onClick={() => setMonth(addMonths(month, 1))} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Next month"><ChevronRight className="size-4" /></button>
          <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(TODAY))} className="ml-1">This month</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {(Object.keys(PILL) as VisitStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5"><span className={cx('size-2.5 rounded-sm', PILL[s].cls)} aria-hidden />{s}</span>
          ))}
        </div>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-[var(--radius-ctl)] border border-line">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="border-b border-line bg-canvas/70 px-2 py-1.5 text-[12.5px] font-medium text-muted">{d}</div>
          ))}
          {days.map((d, i) => {
            const iso = format(d, 'yyyy-MM-dd')
            const inMonth = isSameMonth(d, month)
            const c = byDay.get(iso)
            const total = c ? c.Completed + c.Upcoming + c.Overdue + c.Missed : 0
            const isSel = selected === iso
            const outside = iso < from || iso > to
            return (
              <button
                key={iso}
                onClick={() => onSelect(iso)}
                aria-pressed={isSel}
                aria-label={`${format(d, 'd MMMM')}, ${total} visits`}
                className={cx(
                  'relative flex min-h-[92px] flex-col items-stretch gap-1 border-line p-1.5 text-left transition-colors',
                  i % 7 !== 6 && 'border-r', i < days.length - 7 && 'border-b',
                  inMonth ? 'bg-white hover:bg-canvas' : 'bg-canvas/50 hover:bg-canvas',
                  isSel && 'z-[1] ring-2 ring-ink ring-inset',
                )}
              >
                <span className={cx(
                  'tnum inline-flex size-6 items-center justify-center rounded-full text-[12.5px]',
                  iso === today ? 'bg-ink font-semibold text-white' : inMonth ? 'text-ink' : 'text-faint',
                )}>{format(d, 'd')}</span>
                {loading ? null : c ? (
                  <span className="flex flex-col gap-0.5">
                    {(['Overdue', 'Missed', 'Upcoming', 'Completed'] as VisitStatus[]).filter((s) => c[s] > 0).map((s) => (
                      <span key={s} className={cx('tnum truncate rounded px-1.5 py-px text-[11.5px] font-medium', PILL[s].cls)}>
                        {c[s]} {PILL[s].word}
                      </span>
                    ))}
                  </span>
                ) : outside && inMonth ? <span className="text-[11px] text-faint">Not loaded</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------- Modals ----------------
function CompleteModal({ visit, onClose, onDone }: { visit: Visit; onClose: () => void; onDone: (v: Visit) => void }) {
  const today = todayIso()
  const earliest = isoAdd(visit.scheduledDate, -visit.windowDays)
  const [date, setDate] = useState(visit.scheduledDate <= today ? (visit.scheduledDate < earliest ? earliest : visit.scheduledDate) : today)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const error = !date ? 'Enter the actual visit date.'
    : date > today ? 'Actual date cannot be in the future.'
    : date < earliest ? `Actual date cannot be before the window opens (${fmtDate(earliest)}).`
    : undefined
  const outside = !error && date > isoAdd(visit.scheduledDate, visit.windowDays)
  const submit = async () => {
    setTouched(true)
    if (error) return
    setBusy(true)
    const u = await visitService.markCompleted(visit, date)
    setBusy(false)
    onDone(u)
  }
  return (
    <Modal open onClose={onClose} size="sm" title="Mark visit completed" description={`${visit.participantId}, ${visit.visit}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Mark completed</Button></>}>
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 rounded-[var(--radius-ctl)] bg-canvas px-3 py-2 text-[13px]">
          <dt className="text-muted">Scheduled</dt><dd className="tnum text-right text-ink">{fmtDate(visit.scheduledDate)}</dd>
          <dt className="text-muted">Window</dt><dd className="tnum text-right text-ink">{visit.windowDays ? `±${visit.windowDays} days` : 'Same day'}</dd>
        </dl>
        <Field label="Actual visit date" required htmlFor="cm-date" error={touched ? error : undefined} hint={`Between ${fmtDate(earliest)} and today`}>
          <Input id="cm-date" type="date" value={date} min={earliest} max={today} invalid={touched && !!error} onChange={(e) => { setDate(e.target.value); setTouched(true) }} />
        </Field>
        {outside && (
          <p className="flex gap-2 rounded-[var(--radius-ctl)] bg-warn-soft px-3 py-2 text-[13px] text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            This date is outside the protocol window. Record a protocol deviation for this visit.
          </p>
        )}
      </div>
    </Modal>
  )
}

function RescheduleModal({ visit, onClose, onDone }: { visit: Visit; onClose: () => void; onDone: (v: Visit) => void }) {
  const today = todayIso()
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const error = !date ? 'Choose a new date.'
    : date < today ? 'New date cannot be in the past.'
    : date === visit.scheduledDate ? 'Choose a date different from the current schedule.'
    : undefined
  const windowEnd = isoAdd(visit.scheduledDate, visit.windowDays)
  const windowStart = isoAdd(visit.scheduledDate, -visit.windowDays)
  const outside = !error && (date > windowEnd || date < windowStart)
  const submit = async () => {
    setTouched(true)
    if (error) return
    setBusy(true)
    const u = await visitService.reschedule(visit, date)
    setBusy(false)
    onDone(u)
  }
  return (
    <Modal open onClose={onClose} size="sm" title="Reschedule visit" description={`${visit.participantId}, ${visit.visit}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Reschedule</Button></>}>
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 rounded-[var(--radius-ctl)] bg-canvas px-3 py-2 text-[13px]">
          <dt className="text-muted">Current date</dt><dd className="tnum text-right text-ink">{fmtDate(visit.scheduledDate)}</dd>
          <dt className="text-muted">Protocol window</dt><dd className="tnum text-right text-ink">{visit.windowDays ? `${fmtDate(windowStart)} to ${fmtDate(windowEnd)}` : 'Same day'}</dd>
        </dl>
        <Field label="New visit date" required htmlFor="rs-date" error={touched ? error : undefined}>
          <Input id="rs-date" type="date" value={date} min={today} invalid={touched && !!error} onChange={(e) => { setDate(e.target.value); setTouched(true) }} />
        </Field>
        {outside && (
          <p className="flex gap-2 rounded-[var(--radius-ctl)] bg-warn-soft px-3 py-2 text-[13px] text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            The new date falls outside the protocol window ({visit.windowDays ? `±${visit.windowDays} days` : 'same day'}). A protocol deviation will need to be recorded.
          </p>
        )}
        {date && !error && <p className="text-xs text-muted">Visit will be scheduled for {fmtDate(date)} ({format(parseISO(date), 'EEEE')}).</p>}
      </div>
    </Modal>
  )
}
