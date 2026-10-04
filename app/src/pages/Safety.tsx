import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity, AlertOctagon, AlertTriangle, ChevronDown, ChevronRight, Clock, FilePlus2, ShieldAlert, Siren,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { format, startOfMonth, subMonths } from 'date-fns'
import { participantService, safetyService, studyService, UNDER_REVIEW, isOverdue } from '@/services'
import type { NewAdverseEvent } from '@/services'
import { useAsync, useSort } from '@/lib/hooks'
import { useAuth } from '@/auth/useAuth'
import { cx, daysFromToday, fmtDate } from '@/lib/format'
import { TODAY } from '@/data/seed'
import {
  Badge, Button, ClearFilters, EmptyState, Field, FilterBar, FilterSelect, Input, Kpi, Modal, Mono, PageHeader, Pager,
  Panel, RadioGroup, SearchInput, Select, Skeleton, SortTh, StatusBadge, Table, Td, THead, Th, Tr, useToast, Textarea,
} from '@/components/ui'
import { C, axisProps, gridProps } from '@/components/charts/palette'
import { ChartTooltip, Legend } from '@/components/charts/theme'
import { AE_WORKFLOW } from '@/types'
import type { AdverseEvent, AEReviewStatus, Causality, Participant, Severity, Study } from '@/types'

const STAGE_LABEL: Record<AEReviewStatus, string> = {
  New: 'Adverse event',
  'Medical Review': 'Medical review',
  'Seriousness Assessment': 'Seriousness assessment',
  'Causality Assessment': 'Causality assessment',
  Reporting: 'Regulatory / ethics reporting',
  Resolved: 'Resolution',
}
const SEVERITIES: Severity[] = ['Mild', 'Moderate', 'Severe']
const CAUSALITIES: Causality[] = ['Unrelated', 'Unlikely', 'Possible', 'Probable', 'Certain']
const OUTCOMES: AdverseEvent['outcome'][] = ['Recovering', 'Recovered', 'Ongoing', 'Not recovered']
const ACTIONS = ['None', 'Dose unchanged', 'Dose reduced', 'Study intervention interrupted', 'Study intervention discontinued', 'Symptomatic treatment']
const CRITERIA = ['Death', 'Life-threatening', 'Hospitalisation (initial or prolonged)', 'Persistent or significant disability', 'Congenital anomaly', 'Other important medical event'] as const
const PAGE_SIZE = 15
const todayIso = format(TODAY, 'yyyy-MM-dd')

function dueText(d: string) {
  const n = daysFromToday(d)
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`
  if (n === 0) return 'Due today'
  return `Due in ${n} day${n === 1 ? '' : 's'}`
}
function urgency(ae: AdverseEvent): 'crit' | 'warn' | 'info' {
  if (isOverdue(ae)) return 'crit'
  if (ae.serious || daysFromToday(ae.dueDate) <= 3) return 'warn'
  return 'info'
}

type Row = AdverseEvent & { studyLabel: string }

export default function Safety() {
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useAsync(() => Promise.all([safetyService.list(), studyService.list()]))
  const events = useMemo(() => data?.[0] ?? [], [data])
  const studies = useMemo(() => data?.[1] ?? [], [data])
  const studyById = useMemo(() => new Map(studies.map((s) => [s.id, s])), [studies])

  const [study, setStudy] = useState('')
  const [severity, setSeverity] = useState('')
  const [serious, setSerious] = useState('')
  const [causality, setCausality] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)

  // ---------- KPIs ----------
  const kpi = useMemo(() => ({
    total: events.length,
    serious: events.filter((e) => e.serious).length,
    review: events.filter((e) => UNDER_REVIEW.includes(e.reviewStatus)).length,
    overdue: events.filter(isOverdue).length,
  }), [events])

  const actionList = useMemo(() => events
    .filter((e) => e.reviewStatus !== 'Resolved')
    .sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1
      if (ao !== bo) return ao - bo
      if (a.serious !== b.serious) return a.serious ? -1 : 1
      return a.dueDate.localeCompare(b.dueDate)
    }), [events])

  const stageCounts = useMemo(() => {
    const m = new Map<AEReviewStatus, number>()
    for (const s of AE_WORKFLOW) m.set(s, 0)
    for (const e of events) m.set(e.reviewStatus, (m.get(e.reviewStatus) ?? 0) + 1)
    return m
  }, [events])

  // ---------- table ----------
  const filtered: Row[] = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return events
      .filter((e) => !study || e.studyId === study)
      .filter((e) => !severity || e.severity === severity)
      .filter((e) => !serious || (serious === 'Yes') === e.serious)
      .filter((e) => !causality || e.causality === causality)
      .filter((e) => !status || e.reviewStatus === status)
      .filter((e) => !needle || `${e.id} ${e.participantId} ${e.event} ${e.reporter}`.toLowerCase().includes(needle))
      .map((e) => ({ ...e, studyLabel: e.studyId }))
  }, [events, study, severity, serious, causality, status, q])
  const { sorted, sort, toggle } = useSort<Row>(filtered, { key: 'reportedDate', dir: 'desc' })
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const anyFilter = !!(study || severity || serious || causality || status || q)

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0) }
  const clearFilters = () => { setStudy(''); setSeverity(''); setSerious(''); setCausality(''); setStatus(''); setQ(''); setPage(0) }

  // Focus a specific event: clear filters, jump to its page, expand and scroll.
  const focusEvent = (id: string) => {
    clearFilters()
    setExpanded(id)
    setPendingFocus(id)
    // Give up quietly if the event never appears (e.g. a failed reload).
    setTimeout(() => setPendingFocus((p) => (p === id ? null : p)), 4000)
  }
  useEffect(() => {
    if (!pendingFocus || !data) return
    const idx = sorted.findIndex((r) => r.id === pendingFocus)
    if (idx < 0) return // filters still clearing, or data still reloading
    const target = Math.floor(idx / PAGE_SIZE)
    if (target !== safePage) { setPage(target); return }
    const t = setTimeout(() => {
      document.getElementById(`ae-${pendingFocus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingFocus(null)
    }, 60)
    return () => clearTimeout(t)
  }, [pendingFocus, data, sorted, safePage, anyFilter])

  // Query params: ?event=AE-00121, ?new=1
  useEffect(() => {
    if (!data) return
    const ev = params.get('event')
    const isNew = params.get('new') === '1'
    if (!ev && !isNew) return
    if (ev) {
      if (events.some((e) => e.id === ev)) focusEvent(ev)
      else toast('warning', `Adverse event ${ev} was not found`)
    }
    if (isNew) {
      if (can('safety:report')) setReportOpen(true)
      else toast('warning', 'Your role cannot report adverse events')
    }
    const next = new URLSearchParams(params)
    next.delete('event'); next.delete('new')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params])

  const advance = async (ae: AdverseEvent) => {
    const idx = AE_WORKFLOW.indexOf(ae.reviewStatus)
    const next = AE_WORKFLOW[idx + 1]
    if (!next) return
    setAdvancing(ae.id)
    try {
      await safetyService.advance(ae.id)
      toast('success', `${ae.id} advanced to ${STAGE_LABEL[next].toLowerCase()}`)
      reload()
    } catch {
      toast('error', 'Could not advance the event. Try again.')
    } finally {
      setAdvancing(null)
    }
  }

  // ---------- charts ----------
  const monthly = useMemo(() => {
    const months = Array.from({ length: 9 }, (_, i) => startOfMonth(subMonths(TODAY, 8 - i)))
    return months.map((m) => {
      const key = format(m, 'yyyy-MM')
      const inMonth = events.filter((e) => e.reportedDate.startsWith(key))
      return { month: format(m, 'MMM'), 'Non-serious': inMonth.filter((e) => !e.serious).length, Serious: inMonth.filter((e) => e.serious).length }
    })
  }, [events])
  const causalityDist = useMemo(() => CAUSALITIES.map((c) => ({ name: c, count: events.filter((e) => e.causality === c).length })), [events])

  const loadingFirst = loading && !data

  return (
    <div>
      <PageHeader
        title="Safety & Pharmacovigilance"
        subtitle="Adverse event capture, medical review, seriousness and causality assessment, and regulatory or ethics reporting across studies."
        actions={can('safety:report') && <Button variant="primary" icon={FilePlus2} onClick={() => setReportOpen(true)}>Report adverse event</Button>}
      />

      {error && <div className="mb-4 rounded-[var(--radius-panel)] border border-crit/30 bg-crit-soft px-4 py-3 text-sm text-crit">{error}</div>}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loadingFirst ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <Kpi label="Total adverse events" value={kpi.total} hint="All studies, all time" icon={Activity} onClick={clearFilters} />
            <Kpi label="Serious adverse events" value={kpi.serious} hint="Meets seriousness criteria" icon={ShieldAlert} tone="crit" onClick={() => { clearFilters(); setSerious('Yes') }} />
            <Kpi label="Events under review" value={kpi.review} hint="Medical, seriousness or causality" icon={Clock} tone="warn" />
            <Kpi label="Overdue reports" value={kpi.overdue} hint="Past action due date" icon={AlertOctagon} tone={kpi.overdue ? 'crit' : 'ok'} />
          </>
        )}
      </div>

      {/* Action required */}
      <Panel
        className="mb-5"
        title={<span className="flex items-center gap-2"><Siren className="size-4 text-crit" aria-hidden />Action required</span>}
        subtitle="Open events sorted by urgency: overdue first, then serious events, then by due date."
        actions={<Badge tone={kpi.overdue ? 'crit' : 'warn'}>{actionList.length} open</Badge>}
        bodyClass="p-0"
      >
        {loadingFirst ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : actionList.length === 0 ? (
          <EmptyState title="No open safety actions" body="All adverse events have been resolved." />
        ) : (
          <ul className="scroll-thin max-h-[340px] divide-y divide-line overflow-y-auto">
            {actionList.map((e) => {
              const u = urgency(e)
              return (
                <li key={e.id}>
                  <button
                    onClick={() => focusEvent(e.id)}
                    className={cx('flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-2.5 pr-4 pl-0 text-left hover:bg-canvas', u === 'crit' && 'bg-crit-soft/40')}
                  >
                    <span className={cx('h-9 w-1 shrink-0 rounded-r', u === 'crit' ? 'bg-crit' : u === 'warn' ? 'bg-warn' : 'bg-info/50')} aria-hidden />
                    <span className="w-[86px] shrink-0"><Mono className="text-ink">{e.id}</Mono></span>
                    <span className="min-w-[200px] flex-1">
                      <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                        {e.event}
                        {e.serious && <Badge tone="crit">Serious</Badge>}
                      </span>
                      <span className="text-[12.5px] text-muted"><Mono>{e.participantId}</Mono>, {e.studyId}, {e.severity.toLowerCase()}</span>
                    </span>
                    <span className="w-[200px] shrink-0"><StatusBadge status={e.reviewStatus} /></span>
                    <span className={cx('w-[130px] shrink-0 text-right text-[13px] font-medium', u === 'crit' ? 'text-crit' : u === 'warn' ? 'text-warn' : 'text-muted')}>
                      {u === 'crit' && <AlertTriangle className="mr-1 inline size-3.5 -translate-y-px" aria-hidden />}
                      {dueText(e.dueDate)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* Workflow */}
      <Panel className="mb-5" title="Safety review workflow" subtitle="Events at each stage. Select a stage to filter the table.">
        <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {AE_WORKFLOW.map((s, i) => {
            const active = status === s
            const count = stageCounts.get(s) ?? 0
            const open = s !== 'Resolved' && count > 0
            return (
              <li key={s} className="relative">
                <button
                  onClick={() => { setStatus(active ? '' : s); setPage(0) }}
                  aria-pressed={active}
                  className={cx(
                    'flex h-full w-full flex-col rounded-[var(--radius-panel)] border px-3 py-2.5 text-left transition-colors',
                    active ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink-3',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cx('flex size-5 items-center justify-center rounded-full text-[11px] font-semibold', active ? 'bg-white text-ink' : s === 'Resolved' ? 'bg-ok-soft text-ok' : 'bg-canvas text-ink-3 ring-1 ring-line')}>{i + 1}</span>
                    <span className={cx('text-[13px] font-medium', active ? 'text-white' : 'text-ink')}>{STAGE_LABEL[s]}</span>
                  </span>
                  <span className={cx('tnum mt-1.5 text-[22px] leading-none font-semibold', active ? 'text-white' : open ? 'text-ink' : 'text-muted')}>{loadingFirst ? '…' : count}</span>
                  <span className={cx('mt-1 text-xs', active ? 'text-white/80' : 'text-faint')}>{s === 'Resolved' ? 'Closed' : count ? 'Awaiting action' : 'None waiting'}</span>
                </button>
                {i < AE_WORKFLOW.length - 1 && (
                  <ChevronRight className="absolute top-1/2 -right-2 z-[1] hidden size-4 -translate-y-1/2 rounded-full bg-white text-faint xl:block" aria-hidden />
                )}
              </li>
            )
          })}
        </ol>
      </Panel>

      {/* Table */}
      <Panel className="mb-5" title="Adverse events" bodyClass="p-0" actions={<span className="text-[13px] text-muted">{filtered.length} of {events.length}</span>}>
        <FilterBar>
          <SearchInput value={q} onChange={resetPage(setQ)} placeholder="Search event, participant or ID" className="w-full sm:w-64" />
          <FilterSelect label="Study" value={study} onChange={resetPage(setStudy)} options={studies.filter((s) => events.some((e) => e.studyId === s.id)).map((s) => s.id)} />
          <FilterSelect label="Severity" value={severity} onChange={resetPage(setSeverity)} options={SEVERITIES} />
          <FilterSelect label="Serious" value={serious} onChange={resetPage(setSerious)} options={['Yes', 'No']} />
          <FilterSelect label="Causality" value={causality} onChange={resetPage(setCausality)} options={CAUSALITIES} />
          <FilterSelect label="Review status" value={status} onChange={resetPage(setStatus)} options={AE_WORKFLOW} />
          <ClearFilters show={anyFilter} onClear={clearFilters} />
        </FilterBar>
        {loadingFirst ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={Activity} title="No adverse events match these filters" action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>} />
        ) : (
          <>
            <Table minWidth={1100}>
              <THead>
                <tr>
                  <Th className="w-8"><span className="sr-only">Expand</span></Th>
                  <SortTh label="Event ID" k="id" sort={sort} onSort={toggle} />
                  <SortTh label="Participant" k="participantId" sort={sort} onSort={toggle} />
                  <SortTh label="Study" k="studyId" sort={sort} onSort={toggle} />
                  <SortTh label="Event" k="event" sort={sort} onSort={toggle} />
                  <SortTh label="Severity" k="severity" sort={sort} onSort={toggle} />
                  <SortTh label="Serious?" k="serious" sort={sort} onSort={toggle} />
                  <SortTh label="Causality" k="causality" sort={sort} onSort={toggle} />
                  <SortTh label="Reported" k="reportedDate" sort={sort} onSort={toggle} />
                  <SortTh label="Review status" k="reviewStatus" sort={sort} onSort={toggle} />
                </tr>
              </THead>
              <tbody>
                {slice.map((e) => {
                  const open = expanded === e.id
                  const overdue = isOverdue(e)
                  return (
                    <Fragment key={e.id}>
                      <Tr onClick={() => setExpanded(open ? null : e.id)} active={open} className={cx(overdue && !open && 'bg-crit-soft/30')}>
                        <Td className="w-8 text-faint">
                          <span id={`ae-${e.id}`} className="scroll-mt-24" />
                          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                        </Td>
                        <Td>
                          <span className="flex items-center gap-1.5">
                            {overdue && <AlertTriangle className="size-3.5 text-crit" aria-label="Overdue" />}
                            <Mono className="text-ink">{e.id}</Mono>
                          </span>
                        </Td>
                        <Td><Mono>{e.participantId}</Mono></Td>
                        <Td><Mono>{e.studyId}</Mono></Td>
                        <Td className="max-w-[280px]"><span className="line-clamp-1">{e.event}</span></Td>
                        <Td><SeverityLabel s={e.severity} /></Td>
                        <Td>{e.serious ? <Badge tone="crit">Yes</Badge> : <span className="text-muted">No</span>}</Td>
                        <Td>{e.causality}</Td>
                        <Td className="tnum whitespace-nowrap">{fmtDate(e.reportedDate)}</Td>
                        <Td><StatusBadge status={e.reviewStatus} /></Td>
                      </Tr>
                      {open && (
                        <tr className="border-b border-line bg-canvas/60">
                          <td colSpan={10} className="px-4 py-4">
                            <EventDetail
                              ae={e}
                              study={studyById.get(e.studyId)}
                              canReview={can('safety:review')}
                              canSeeParticipant={can('participants:view')}
                              busy={advancing === e.id}
                              onAdvance={() => advance(e)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </Table>
            <Pager
              page={safePage}
              pages={pages}
              setPage={setPage}
              from={safePage * PAGE_SIZE + 1}
              to={Math.min(sorted.length, safePage * PAGE_SIZE + PAGE_SIZE)}
              total={sorted.length}
              noun="events"
            />
          </>
        )}
      </Panel>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Adverse events by month" subtitle="Reported date, last 9 months" actions={<Legend items={[{ label: 'Non-serious', color: C.sky }, { label: 'Serious', color: C.red }]} />}>
          {loadingFirst ? <Skeleton className="h-[240px]" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
                <Bar dataKey="Non-serious" stackId="a" fill={C.sky} maxBarSize={36} />
                <Bar dataKey="Serious" stackId="a" fill={C.red} radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel className="lg:col-span-2" title="Causality distribution" subtitle="Investigator assessment, all events">
          {loadingFirst ? <Skeleton className="h-[240px]" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={causalityDist} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="name" width={72} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
                <Bar dataKey="count" name="Events" radius={[0, 3, 3, 0]} maxBarSize={22}>
                  {causalityDist.map((d) => (
                    <Cell key={d.name} fill={d.name === 'Probable' || d.name === 'Certain' ? C.amber : d.name === 'Possible' ? C.ink3 : C.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <p className="mt-4 text-xs text-faint">
        The platform can be designed to interoperate with national Ayush pharmacovigilance infrastructure rather than duplicate it.
      </p>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        studies={studies.filter((s) => s.stage === 'Recruiting' || s.stage === 'Active / Follow-up')}
        onCreated={(ae) => {
          setReportOpen(false)
          toast('success', 'Adverse event reported')
          reload()
          focusEvent(ae.id)
        }}
      />
    </div>
  )
}

function SeverityLabel({ s }: { s: Severity }) {
  const c = s === 'Severe' ? 'bg-crit' : s === 'Moderate' ? 'bg-warn' : 'bg-line-2'
  return <span className="inline-flex items-center gap-1.5"><span className={cx('size-2 rounded-full', c)} aria-hidden />{s}</span>
}

function EventDetail({ ae, study, canReview, canSeeParticipant, busy, onAdvance }: {
  ae: AdverseEvent; study?: Study; canReview: boolean; canSeeParticipant: boolean; busy: boolean; onAdvance: () => void
}) {
  const idx = AE_WORKFLOW.indexOf(ae.reviewStatus)
  const next = AE_WORKFLOW[idx + 1]
  const overdue = isOverdue(ae)
  const facts: [string, ReactNode][] = [
    ['Onset date', fmtDate(ae.onsetDate)],
    ['Expectedness', ae.expected ? 'Expected' : 'Unexpected'],
    ['Action taken', ae.actionTaken],
    ['Outcome', <StatusBadge key="o" status={ae.outcome} />],
    ['Reporter', ae.reporter],
    ['Action due', ae.reviewStatus === 'Resolved'
      ? <span key="d" className="text-muted">{fmtDate(ae.dueDate)}, closed</span>
      : <span key="d" className={cx('font-medium', overdue ? 'text-crit' : daysFromToday(ae.dueDate) <= 3 ? 'text-warn' : 'text-ink')}>{fmtDate(ae.dueDate)}, {dueText(ae.dueDate).toLowerCase()}</span>],
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span>{study ? study.shortTitle : ae.studyId}</span>
          {canSeeParticipant && <Link to={`/participants/${ae.participantId}`} className="font-medium text-info hover:underline">Open participant profile</Link>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-faint">{k}</dt>
              <dd className="mt-0.5 text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {ae.seriousnessCriteria?.length ? (
          <div className="mt-3 text-[13px]">
            <div className="text-faint">Seriousness criteria</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{ae.seriousnessCriteria.map((c) => <Badge key={c} tone="crit">{c}</Badge>)}</div>
          </div>
        ) : null}
        {ae.narrative && (
          <div className="mt-3 text-[13px]">
            <div className="text-faint">Narrative</div>
            <p className="mt-0.5 max-w-[60ch] text-ink">{ae.narrative}</p>
          </div>
        )}
      </div>
      <div className="lg:col-span-3">
        <div className="mb-2 text-[13px] font-medium text-ink">Workflow progress</div>
        <ol className="flex flex-wrap items-start gap-y-3">
          {AE_WORKFLOW.map((s, i) => {
            const done = i < idx || (ae.reviewStatus === 'Resolved' && i === idx)
            const current = i === idx && ae.reviewStatus !== 'Resolved'
            return (
              <li key={s} className="flex min-w-[96px] flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={cx('h-px flex-1', i === 0 ? 'opacity-0' : i <= idx ? 'bg-ok' : 'bg-line-2')} />
                  <span className={cx(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    done ? 'bg-ok text-white' : current ? (overdue ? 'bg-crit text-white' : 'bg-warn text-white') : 'bg-white text-faint ring-1 ring-line-2',
                  )}>{i + 1}</span>
                  <span className={cx('h-px flex-1', i === AE_WORKFLOW.length - 1 ? 'opacity-0' : i < idx ? 'bg-ok' : 'bg-line-2')} />
                </div>
                <span className={cx('mt-1.5 px-1 text-xs leading-tight', current ? 'font-medium text-ink' : done ? 'text-ink-3' : 'text-faint')}>{STAGE_LABEL[s]}</span>
              </li>
            )
          })}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {next ? (
            canReview ? (
              <Button variant="primary" size="sm" loading={busy} onClick={onAdvance}>Advance to {STAGE_LABEL[next].toLowerCase()}</Button>
            ) : (
              <span className="text-xs text-faint">Review actions are available to the pharmacovigilance team.</span>
            )
          ) : (
            <span className="text-[13px] text-ok">Review complete. Event resolved.</span>
          )}
        </div>
      </div>
    </div>
  )
}

interface FormState {
  studyId: string; participantId: string; event: string; onsetDate: string; severity: Severity | ''
  serious: 'Yes' | 'No' | ''; criteria: string[]; causality: Causality | ''; expected: 'Yes' | 'No' | ''
  actionTaken: string; outcome: AdverseEvent['outcome'] | ''; narrative: string
}
const EMPTY: FormState = {
  studyId: '', participantId: '', event: '', onsetDate: '', severity: '', serious: '', criteria: [], causality: '',
  expected: '', actionTaken: '', outcome: '', narrative: '',
}

function ReportModal({ open, onClose, studies, onCreated }: {
  open: boolean; onClose: () => void; studies: Study[]; onCreated: (ae: AdverseEvent) => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const { data: participants, loading: pLoading } = useAsync<Participant[]>(() => (open ? participantService.list() : Promise.resolve([])), [open])

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setF(EMPTY); setErrors({}) }
  }

  const eligible = useMemo(
    () => (participants ?? []).filter((p) => p.studyId === f.studyId && !!p.enrollmentDate && p.status !== 'Screen Failure' && p.status !== 'Screening' && p.status !== 'Withdrawn'),
    [participants, f.studyId],
  )

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v, ...(k === 'studyId' ? { participantId: '' } : {}), ...(k === 'serious' && v === 'No' ? { criteria: [] } : {}) }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async () => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!f.studyId) e.studyId = 'Select a study.'
    if (!f.participantId) e.participantId = 'Select the participant.'
    if (f.event.trim().length < 3) e.event = 'Enter the adverse event term (at least 3 characters).'
    if (!f.onsetDate) e.onsetDate = 'Enter the onset date.'
    else if (f.onsetDate > todayIso) e.onsetDate = 'Onset date cannot be in the future.'
    if (!f.severity) e.severity = 'Select severity.'
    if (!f.serious) e.serious = 'Indicate whether the event is serious.'
    if (f.serious === 'Yes' && f.criteria.length === 0) e.criteria = 'Select at least one seriousness criterion.'
    if (!f.causality) e.causality = 'Select causality.'
    if (!f.expected) e.expected = 'Indicate expectedness.'
    if (!f.actionTaken) e.actionTaken = 'Select the action taken.'
    if (!f.outcome) e.outcome = 'Select the outcome.'
    setErrors(e)
    if (Object.keys(e).length) { toast('error', 'Check the highlighted fields'); return }
    setSaving(true)
    try {
      const input: NewAdverseEvent = {
        studyId: f.studyId, participantId: f.participantId, event: f.event.trim(), onsetDate: f.onsetDate,
        severity: f.severity as Severity, serious: f.serious === 'Yes', causality: f.causality as Causality,
        expected: f.expected === 'Yes', actionTaken: f.actionTaken, outcome: f.outcome as AdverseEvent['outcome'],
        reporter: user?.name ?? 'Unknown',
        seriousnessCriteria: f.serious === 'Yes' ? f.criteria : undefined,
        narrative: f.narrative.trim() || undefined,
      }
      const ae = await safetyService.create(input)
      onCreated(ae)
    } catch {
      toast('error', 'Could not report the event. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Report adverse event"
      description="Serious events are due for review within 1 day, non-serious events within 14 days."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>Report adverse event</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Study" required htmlFor="ae-study" error={errors.studyId}>
          <Select id="ae-study" value={f.studyId} onChange={(e) => set('studyId', e.target.value)} invalid={!!errors.studyId}>
            <option value="">Select study</option>
            {studies.map((s) => <option key={s.id} value={s.id}>{s.id}, {s.shortTitle}</option>)}
          </Select>
        </Field>
        <Field label="Participant" required htmlFor="ae-participant" error={errors.participantId} hint={f.studyId ? `${eligible.length} enrolled participants` : 'Select a study first'}>
          <Select id="ae-participant" value={f.participantId} onChange={(e) => set('participantId', e.target.value)} disabled={!f.studyId || pLoading} invalid={!!errors.participantId}>
            <option value="">{pLoading ? 'Loading participants' : 'Select participant'}</option>
            {eligible.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
          </Select>
        </Field>
        <Field label="Adverse event term" required htmlFor="ae-term" error={errors.event} className="md:col-span-2">
          <Input id="ae-term" value={f.event} onChange={(e) => set('event', e.target.value)} placeholder="For example, nausea, headache, loose stools" invalid={!!errors.event} />
        </Field>
        <Field label="Onset date" required htmlFor="ae-onset" error={errors.onsetDate}>
          <Input id="ae-onset" type="date" max={todayIso} value={f.onsetDate} onChange={(e) => set('onsetDate', e.target.value)} invalid={!!errors.onsetDate} />
        </Field>
        <Field label="Severity" required error={errors.severity}>
          <RadioGroup name="ae-sev" value={f.severity} options={SEVERITIES} onChange={(v) => set('severity', v)} invalid={!!errors.severity} />
        </Field>
        <Field label="Serious adverse event" required error={errors.serious}>
          <RadioGroup name="ae-serious" value={f.serious} options={['Yes', 'No'] as const} onChange={(v) => set('serious', v)} invalid={!!errors.serious} />
        </Field>
        <Field label="Expected" required error={errors.expected} hint="Listed in the reference safety information">
          <RadioGroup name="ae-expected" value={f.expected} options={['Yes', 'No'] as const} onChange={(v) => set('expected', v)} invalid={!!errors.expected} />
        </Field>
        {f.serious === 'Yes' && (
          <fieldset className={cx('rounded-[var(--radius-ctl)] border p-3 md:col-span-2', errors.criteria ? 'border-crit/60 bg-crit-soft/30' : 'border-line bg-canvas/60')}>
            <legend className="px-1 text-[13px] font-medium text-ink">Seriousness criteria<span className="ml-0.5 text-crit">*</span></legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CRITERIA.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-4 accent-ink"
                    checked={f.criteria.includes(c)}
                    onChange={(e) => set('criteria', e.target.checked ? [...f.criteria, c] : f.criteria.filter((x) => x !== c))}
                  />
                  {c}
                </label>
              ))}
            </div>
            {errors.criteria && <p className="mt-2 text-xs text-crit" role="alert">{errors.criteria}</p>}
          </fieldset>
        )}
        <Field label="Causality" required htmlFor="ae-caus" error={errors.causality}>
          <Select id="ae-caus" value={f.causality} onChange={(e) => set('causality', e.target.value as Causality)} invalid={!!errors.causality}>
            <option value="">Select causality</option>
            {CAUSALITIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Action taken" required htmlFor="ae-action" error={errors.actionTaken}>
          <Select id="ae-action" value={f.actionTaken} onChange={(e) => set('actionTaken', e.target.value)} invalid={!!errors.actionTaken}>
            <option value="">Select action</option>
            {ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </Select>
        </Field>
        <Field label="Outcome" required htmlFor="ae-outcome" error={errors.outcome}>
          <Select id="ae-outcome" value={f.outcome} onChange={(e) => set('outcome', e.target.value as AdverseEvent['outcome'])} invalid={!!errors.outcome}>
            <option value="">Select outcome</option>
            {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Narrative" htmlFor="ae-narr" hint="Optional. Brief clinical description." className="md:col-span-2">
          <Textarea id="ae-narr" value={f.narrative} onChange={(e) => set('narrative', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
