import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Download, FlaskConical, Plus, Upload } from 'lucide-react'
import { format, subMonths, subYears } from 'date-fns'
import { Button, EmptyState, HealthDot, MeterCell, Mono, PageHeader, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { ClearFilters, FilterBar, FilterSelect, Pager, SearchInput, SortTh, Table, Td, Th, THead, Tr } from '@/components/ui/data'
import { useToast } from '@/components/ui/toast'
import { useAsync, usePaged, useSort } from '@/lib/hooks'
import { cx, fmtDate, fmtNum } from '@/lib/format'
import { useAuth } from '@/auth/useAuth'
import { siteService, studyService } from '@/services'
import { TODAY } from '@/data/seed'
import { LIFECYCLE, PORTFOLIO_STAGES } from '@/types'
import type { PortfolioStage, Study, StudyType, TrialStatus } from '@/types'
import { LEVEL_LABEL, SIGNALS, recruitPct } from './studies/health'
import { NewStudyWizard } from './studies/NewStudyWizard'
import { ImportStudyModal } from './studies/ImportStudyModal'

type Row = Study & { recruit: number; siteCount: number; lifecycleIdx: number }

const STATUSES: TrialStatus[] = ['On Track', 'Attention Required', 'Critical', 'Completed']
const TYPES: StudyType[] = ['Interventional', 'Observational', 'Pilot / Feasibility', 'Supportive Care']
const DATE_OPTS = [
  { value: '6m', label: 'Started in last 6 months' },
  { value: '12m', label: 'Started in last 12 months' },
  { value: '2y', label: 'Started in last 2 years' },
  { value: 'upcoming', label: 'Upcoming' },
] as const
type StageFilter = 'all' | PortfolioStage
const STAGE_LABEL: Record<PortfolioStage, string> = {
  Planning: 'Planning', 'Ethics Review': 'Ethics review', Recruiting: 'Recruiting', 'Active / Follow-up': 'Active / follow-up', Completed: 'Completed',
}

function inDateRange(start: string, range: string) {
  const today = format(TODAY, 'yyyy-MM-dd')
  if (range === 'upcoming') return start > today
  const from = range === '6m' ? subMonths(TODAY, 6) : range === '12m' ? subMonths(TODAY, 12) : subYears(TODAY, 2)
  return start >= format(from, 'yyyy-MM-dd') && start <= today
}

const uniq = (xs: string[]) => Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b))

function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function Studies() {
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, loading } = useAsync(() => Promise.all([studyService.list(), siteService.list()]))
  const studies = useMemo(() => data?.[0] ?? [], [data])
  const sites = useMemo(() => data?.[1] ?? [], [data])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [dept, setDept] = useState('')
  const [type, setType] = useState('')
  const [site, setSite] = useState('')
  const [range, setRange] = useState('')
  const [stage, setStage] = useState<StageFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [wizard, setWizard] = useState(false)
  const [importing, setImporting] = useState(false)

  const pi = params.get('pi') ?? ''
  const setPi = (v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set('pi', v)
    else next.delete('pi')
    setParams(next, { replace: true })
  }

  const rows: Row[] = useMemo(
    () => studies.map((s) => ({ ...s, recruit: recruitPct(s), siteCount: s.siteIds.length, lifecycleIdx: LIFECYCLE.indexOf(s.lifecycle) })),
    [studies],
  )

  // Everything except the stage control, so stage counts reflect the other filters.
  const baseFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((s) =>
      (!needle || [s.id, s.title, s.shortTitle, s.pi, s.department, s.ctriNumber ?? ''].some((x) => x.toLowerCase().includes(needle))) &&
      (!status || s.status === status) &&
      (!dept || s.department === dept) &&
      (!pi || s.pi === pi) &&
      (!type || s.type === type) &&
      (!site || s.siteIds.includes(site)) &&
      (!range || inDateRange(s.startDate, range)),
    )
  }, [rows, q, status, dept, pi, type, site, range])

  const filtered = useMemo(() => (stage === 'all' ? baseFiltered : baseFiltered.filter((s) => s.stage === stage)), [baseFiltered, stage])
  const stageCounts = useMemo(() => {
    const m = new Map<StageFilter, number>([['all', baseFiltered.length]])
    PORTFOLIO_STAGES.forEach((st) => m.set(st, baseFiltered.filter((s) => s.stage === st).length))
    return m
  }, [baseFiltered])

  const { sorted, sort, toggle } = useSort<Row>(filtered, { key: 'id', dir: 'asc' })
  const paged = usePaged(sorted, 15)

  const options = useMemo(() => ({
    depts: uniq(studies.map((s) => s.department)),
    pis: uniq(studies.map((s) => s.pi)),
    coordinators: uniq(studies.map((s) => s.coordinator)),
    sites: sites.map((s) => ({ value: s.id, label: `${s.id} ${s.name}` })),
  }), [studies, sites])

  const anyFilter = !!(q || status || dept || pi || type || site || range || stage !== 'all')
  const clear = () => { setQ(''); setStatus(''); setDept(''); setType(''); setSite(''); setRange(''); setStage('all'); setPi('') }

  const toggleRow = (id: string) => setExpanded((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const exportCsv = () => {
    const header = ['Study ID', 'Study title', 'Short title', 'Department', 'Principal investigator', 'Study coordinator', 'Study type', 'Phase',
      'Stage', 'Lifecycle', 'Sites', 'Enrolled', 'Target', 'Recruitment %', 'Compliance %', 'Status', 'Start date', 'Expected completion', 'CTRI number']
    const lines = sorted.map((s) => [s.id, s.title, s.shortTitle, s.department, s.pi, s.coordinator, s.type, s.phase, s.stage, s.lifecycle,
      s.siteCount, s.enrolled, s.target, s.recruit, s.compliance, s.status, s.startDate, s.expectedCompletion, s.ctriNumber ?? ''].map(csvCell).join(','))
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aiia-studies-${format(TODAY, 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast('success', `Exported ${sorted.length} ${sorted.length === 1 ? 'study' : 'studies'} to CSV`)
  }

  return (
    <div>
      <PageHeader
        title="Clinical Studies"
        subtitle="Portfolio of studies across departments and sites. Select a study to open its workspace."
        actions={
          <>
            <Button icon={Upload} onClick={() => setImporting(true)}>Import study</Button>
            <Button icon={Download} onClick={exportCsv} disabled={loading || sorted.length === 0}>Export</Button>
            {can('studies:create') && <Button variant="primary" icon={Plus} onClick={() => setWizard(true)}>New study</Button>}
          </>
        }
      />

      <div className="scroll-thin mb-3 overflow-x-auto">
        <div className="inline-flex rounded-[var(--radius-ctl)] border border-line-2 bg-white p-0.5" role="group" aria-label="Filter by stage">
          {(['all', ...PORTFOLIO_STAGES] as StageFilter[]).map((st) => {
            const active = stage === st
            return (
              <button
                key={st}
                onClick={() => setStage(st)}
                aria-pressed={active}
                className={cx('flex h-8 items-center gap-1.5 rounded-[4px] px-3 text-[13px] font-medium whitespace-nowrap', active ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
              >
                {st === 'all' ? 'All' : STAGE_LABEL[st]}
                <span className={cx('tnum rounded px-1 text-xs', active ? 'bg-white/20 text-white' : 'bg-canvas text-muted')}>{loading ? '–' : stageCounts.get(st) ?? 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="rounded-[var(--radius-panel)] border border-line bg-white">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search study ID, title, investigator" className="w-full sm:w-72" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES} />
          <FilterSelect label="Department" value={dept} onChange={setDept} options={options.depts} />
          <FilterSelect label="Principal investigator" value={pi} onChange={setPi} options={options.pis} />
          <FilterSelect label="Study type" value={type} onChange={setType} options={TYPES} />
          <FilterSelect label="Site" value={site} onChange={setSite} options={options.sites} />
          <FilterSelect label="Date" value={range} onChange={setRange} options={DATE_OPTS} allLabel="Any time" />
          <ClearFilters show={anyFilter} onClear={clear} />
        </FilterBar>

        <Table minWidth={1180}>
          <THead>
            <tr>
              <Th className="w-8" aria-label="Expand" />
              <SortTh label="Study ID" k="id" sort={sort} onSort={toggle} />
              <SortTh label="Study title" k="title" sort={sort} onSort={toggle} />
              <SortTh label="Principal investigator" k="pi" sort={sort} onSort={toggle} />
              <SortTh label="Sites" k="siteCount" sort={sort} onSort={toggle} />
              <SortTh label="Participants" k="enrolled" sort={sort} onSort={toggle} />
              <SortTh label="Recruitment" k="recruit" sort={sort} onSort={toggle} />
              <SortTh label="Current phase" k="lifecycleIdx" sort={sort} onSort={toggle} />
              <SortTh label="Compliance" k="compliance" sort={sort} onSort={toggle} />
              <SortTh label="Status" k="status" sort={sort} onSort={toggle} />
            </tr>
          </THead>
          <tbody>
            {loading && Array.from({ length: 8 }, (_, i) => (
              <tr key={i} className="border-b border-line">
                <Td colSpan={10}><Skeleton className="h-5 w-full" /></Td>
              </tr>
            ))}
            {!loading && paged.slice.map((s) => {
              const open = expanded.has(s.id)
              const notStarted = s.stage === 'Planning' || s.stage === 'Ethics Review'
              return (
                <Fragment key={s.id}>
                  <Tr onClick={() => navigate(`/studies/${s.id}`)} active={open}>
                    <Td className="w-8 !pr-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleRow(s.id) }}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-expanded={open}
                        aria-label={open ? `Collapse ${s.id}` : `Expand ${s.id}`}
                        className="rounded p-1 text-muted hover:bg-line/60 hover:text-ink"
                      >
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </Td>
                    <Td><Mono className="text-ink">{s.id}</Mono></Td>
                    <Td className="max-w-[320px]">
                      <div className="truncate font-medium text-ink" title={s.title}>{s.title}</div>
                      <div className="truncate text-xs text-muted">{s.department}</div>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-3">{s.pi}</Td>
                    <Td className="tnum">{s.siteCount}</Td>
                    <Td className="tnum whitespace-nowrap">
                      <span className="text-ink">{fmtNum(s.enrolled)}</span>
                      <span className="text-faint"> / {fmtNum(s.target)}</span>
                    </Td>
                    <Td>{notStarted ? <span className="text-[13px] text-faint">Not started</span> : <MeterCell value={s.recruit} warnBelow={60} critBelow={35} />}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="text-ink">{s.lifecycle}</div>
                      <div className="text-xs text-muted">{s.phase}</div>
                    </Td>
                    <Td><MeterCell value={s.compliance} warnBelow={90} critBelow={80} /></Td>
                    <Td><StatusBadge status={s.status} /></Td>
                  </Tr>
                  {open && (
                    <tr className="border-b border-line bg-canvas/60">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="grid grid-cols-1 gap-x-8 gap-y-4 pl-8 lg:grid-cols-[1.4fr_1fr]">
                          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                            <Detail label="Intervention" value={s.intervention} />
                            <Detail label="Comparator" value={s.comparator} />
                            <Detail label="Primary objective" value={s.primaryObjective} wide />
                            <Detail label="Study coordinator" value={s.coordinator} />
                            <Detail label="Start date" value={`${fmtDate(s.startDate)}, expected completion ${fmtDate(s.expectedCompletion)}`} />
                          </dl>
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className="mb-2 text-[13px] text-muted">Trial health signals</div>
                              <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                                {SIGNALS.map((sig) => (
                                  <li key={sig.key} className="flex items-center gap-2 text-[13px]">
                                    <HealthDot level={s.health[sig.key]} label={`${sig.label}: ${LEVEL_LABEL[s.health[sig.key]]}`} />
                                    <span className="text-ink">{sig.label}</span>
                                    <span className="ml-auto text-xs text-muted">{LEVEL_LABEL[s.health[sig.key]]}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <Button size="sm" variant="primary" onClick={() => navigate(`/studies/${s.id}`)}>Open workspace</Button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!loading && paged.total === 0 && (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    icon={FlaskConical}
                    title="No studies match these filters"
                    body="Try removing a filter or searching by study ID."
                    action={anyFilter ? <Button size="sm" onClick={clear}>Clear filters</Button> : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        {!loading && paged.total > 0 && <Pager {...paged} noun="studies" />}
      </section>

      {pi && !loading && (
        <p className="mt-3 text-[13px] text-muted">
          Showing studies led by {pi}. <Link to="/studies" className="font-medium text-info hover:underline">Show all investigators</Link>
        </p>
      )}

      <NewStudyWizard
        open={wizard}
        onClose={() => setWizard(false)}
        sites={sites}
        pis={options.pis}
        coordinators={options.coordinators}
        departments={options.depts}
      />
      <ImportStudyModal open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cx(wide && 'sm:col-span-2')}>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  )
}
