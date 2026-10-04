import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge, Mono, Panel, Progress, Segmented, StatusBadge, Table, THead, Th, Td, Tr } from '@/components/ui'
import { C, axisProps, gridProps } from '@/components/charts/palette'
import { ChartTooltip, Legend } from '@/components/charts/theme'
import { cx, fmtNum, pct } from '@/lib/format'
import type { HealthLevel, HealthSignals, PortfolioStage, Site, Study, TrialStatus } from '@/types'
import { PORTFOLIO_STAGES } from '@/types'
import { format } from 'date-fns'
import { TODAY } from '@/data/seed'

// ---------------- Portfolio distribution ----------------
const STAGE_COLOR: Record<PortfolioStage, string> = {
  Planning: '#9aa8ba',
  'Ethics Review': C.amber,
  Recruiting: C.sky,
  'Active / Follow-up': C.ink,
  Completed: C.teal,
}

export function PortfolioPanel({ studies, selected, onSelect }: { studies: Study[]; selected: PortfolioStage | null; onSelect: (s: PortfolioStage | null) => void }) {
  const rows = PORTFOLIO_STAGES.map((stage) => {
    const list = studies.filter((s) => s.stage === stage)
    return { stage, count: list.length, participants: list.reduce((a, s) => a + s.enrolled, 0), attention: list.filter((s) => s.status === 'Critical' || s.status === 'Attention Required').length }
  })
  const max = Math.max(...rows.map((r) => r.count))
  const total = studies.length
  return (
    <Panel
      title="Trial portfolio"
      subtitle={`${total} studies across the lifecycle. Select a stage to filter the health table.`}
      actions={selected && <button onClick={() => onSelect(null)} className="text-[13px] font-medium text-info hover:underline">Show all stages</button>}
    >
      {/* Proportional strip */}
      <div className="flex h-3 overflow-hidden rounded-sm" aria-hidden>
        {rows.map((r) => (
          <div key={r.stage} style={{ width: `${(r.count / total) * 100}%`, background: STAGE_COLOR[r.stage], opacity: selected && selected !== r.stage ? 0.25 : 1 }} className="border-r-2 border-white last:border-0" />
        ))}
      </div>
      <ul className="mt-4 space-y-1">
        {rows.map((r) => {
          const on = selected === r.stage
          return (
            <li key={r.stage}>
              <button
                onClick={() => onSelect(on ? null : r.stage)}
                aria-pressed={on}
                className={cx('grid w-full grid-cols-[minmax(150px,1fr)_1.6fr_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors', on ? 'bg-info-soft/60' : 'hover:bg-canvas', selected && !on && 'opacity-55')}
              >
                <span className="flex items-center gap-2 text-[13.5px] text-ink">
                  <span className="size-2.5 rounded-sm" style={{ background: STAGE_COLOR[r.stage] }} aria-hidden />
                  {r.stage}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-canvas">
                  <span className="block h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: STAGE_COLOR[r.stage] }} />
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="tnum w-7 text-right text-[15px] font-semibold text-ink">{r.count}</span>
                  {r.attention > 0 ? <span className="tnum w-24 text-xs whitespace-nowrap text-warn">{r.attention} need attention</span> : <span className="w-24" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <div>
          <dt className="text-[13px] text-muted">Need attention</dt>
          <dd className="tnum text-lg font-semibold text-warn">{rows.reduce((a, r) => a + r.attention, 0)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Departments</dt>
          <dd className="tnum text-lg font-semibold text-ink">{new Set(studies.map((s) => s.department)).size}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Participants ever enrolled</dt>
          <dd className="tnum text-lg font-semibold text-ink">{fmtNum(rows.reduce((a, r) => a + r.participants, 0))}</dd>
        </div>
      </dl>
    </Panel>
  )
}

// ---------------- Recruitment ----------------
type Range = '6' | '12' | 'all'

export function RecruitmentPanel({ months, enrolled, target }: { months: { month: string; key: string; enrolled: number; target: number | null }[]; enrolled: number; target: number }) {
  const [range, setRange] = useState<Range>('12')
  const nowKey = format(TODAY, 'yyyy-MM')
  const nowIdx = months.findIndex((m) => m.key === nowKey)
  const shown = useMemo(() => {
    if (range === 'all') return months
    const n = Number(range)
    return months.slice(Math.max(0, nowIdx - n + 1))
  }, [months, range, nowIdx])
  const progress = pct(enrolled, target)
  return (
    <Panel
      title="Recruitment"
      subtitle="Cumulative enrolment across recruiting and follow-up studies against the planned pace."
      actions={<Segmented size="sm" value={range} onChange={setRange} options={[{ id: '6', label: '6 months' }, { id: '12', label: '12 months' }, { id: 'all', label: 'All' }]} />}
    >
      <div className="mb-4 grid grid-cols-3 gap-4 border-b border-line pb-4">
        <div>
          <div className="text-[13px] text-muted">Recruitment progress</div>
          <div className="tnum text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">{progress}%</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Enrolled</div>
          <div className="tnum text-xl font-semibold text-ink">{fmtNum(enrolled)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Target</div>
          <div className="tnum text-xl font-semibold text-ink">{fmtNum(target)}</div>
        </div>
        <Progress value={progress} tone="ok" className="col-span-3" label="Recruitment progress" />
      </div>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={shown} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="enrolFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.teal} stopOpacity={0.18} />
                <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axisProps} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} width={44} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine x={format(TODAY, 'MMM yy')} stroke={C.axis} strokeDasharray="3 3" label={{ value: 'Today', position: 'insideTopRight', fill: C.axis, fontSize: 11 }} />
            <Line type="monotone" dataKey="target" name="Target pace" stroke={C.ink3} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="enrolled" name="Enrolled" stroke={C.teal} strokeWidth={2} fill="url(#enrolFill)" connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2"><Legend items={[{ label: 'Enrolled', color: C.teal }, { label: 'Target pace', color: C.ink3, dashed: true }]} /></div>
    </Panel>
  )
}

// ---------------- Trial health ----------------
const SIGNALS: { key: keyof HealthSignals; label: string; short: string }[] = [
  { key: 'recruitment', label: 'Recruitment', short: 'Rec' },
  { key: 'dataCompletion', label: 'Data completion', short: 'Data' },
  { key: 'deviations', label: 'Protocol deviations', short: 'Dev' },
  { key: 'safetyReporting', label: 'Safety reporting', short: 'Safety' },
  { key: 'regulatory', label: 'Regulatory compliance', short: 'Reg' },
  { key: 'documents', label: 'Documentation', short: 'Docs' },
]
const LEVEL_LABEL: Record<HealthLevel, string> = { ok: 'On track', warn: 'Attention', crit: 'Critical' }
const LEVEL_CELL: Record<HealthLevel, string> = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit' }

function SignalCells({ h }: { h: HealthSignals }) {
  return (
    <div className="flex gap-[3px]" role="list" aria-label="Health signals">
      {SIGNALS.map((s) => (
        <span key={s.key} role="listitem" title={`${s.label}: ${LEVEL_LABEL[h[s.key]]}`} aria-label={`${s.label}: ${LEVEL_LABEL[h[s.key]]}`} className={cx('h-5 w-[18px] rounded-[3px]', LEVEL_CELL[h[s.key]], h[s.key] === 'ok' && 'opacity-80')} />
      ))}
    </div>
  )
}

const STATUS_FILTERS: TrialStatus[] = ['On Track', 'Attention Required', 'Critical', 'Completed']

function metricTone(v: number, warn: number, crit: number) {
  return v < crit ? 'text-crit' : v < warn ? 'text-warn' : 'text-ink'
}

export function TrialHealthTable({ studies, sites, stage, onClearStage }: { studies: Study[]; sites: Site[]; stage: PortfolioStage | null; onClearStage: () => void }) {
  const [status, setStatus] = useState<TrialStatus | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const navigate = useNavigate()
  const siteName = (id: string) => { const s = sites.find((x) => x.id === id); return s ? `${s.city}` : id }

  const base = studies.filter((s) => s.stage !== 'Planning' && s.stage !== 'Ethics Review')
  const filtered = base.filter((s) => (!stage || s.stage === stage) && (!status || s.status === status))
  const rows = showAll ? filtered : filtered.slice(0, 8)
  const counts = Object.fromEntries(STATUS_FILTERS.map((f) => [f, base.filter((s) => (!stage || s.stage === stage) && s.status === f).length]))

  return (
    <Panel
      title="Trial health"
      subtitle="Operational signals per study. These are measurable indicators, not clinical judgements."
      bodyClass="p-0"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {stage && <Badge tone="info">Stage: {stage} <button onClick={onClearStage} className="ml-1 hover:text-ink" aria-label="Clear stage filter">×</button></Badge>}
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(status === f ? null : f)}
              aria-pressed={status === f}
              className={cx('inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-ctl)] border px-2 text-xs font-medium', status === f ? 'border-ink bg-ink text-white' : 'border-line-2 text-ink-3 hover:border-ink-3')}
            >
              {f}<span className="tnum opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      }
    >
      <Table minWidth={1000}>
        <THead>
          <tr>
            <Th className="w-8" aria-label="Expand" />
            <Th>Study ID</Th>
            <Th>Study name</Th>
            <Th>Phase</Th>
            <Th>Site</Th>
            <Th>Recruitment</Th>
            <Th>Data quality</Th>
            <Th>Compliance</Th>
            <Th>
              <span className="inline-flex gap-[3px] font-normal" aria-label="Signals: recruitment, data, deviations, safety, regulatory, documents">
                {SIGNALS.map((s) => <span key={s.key} className="w-[18px] text-center text-[10.5px]" title={s.label}>{s.short.slice(0, 2)}</span>)}
              </span>
            </Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((s) => {
            const rec = pct(s.enrolled, s.target)
            const expanded = open === s.id
            return (
              <Fragment key={s.id}>
                <Tr onClick={() => navigate(`/studies/${s.id}`)} active={expanded}>
                  <Td className="pr-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpen(expanded ? null : s.id) }}
                      className="rounded p-0.5 text-faint hover:bg-white hover:text-ink"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${s.id}`}
                    >
                      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  </Td>
                  <Td><Mono className="text-ink">{s.id}</Mono></Td>
                  <Td className="max-w-[260px] min-w-[200px]"><span className="line-clamp-1 font-medium text-ink" title={s.title}>{s.title}</span></Td>
                  <Td className="whitespace-nowrap text-muted">{s.phase}</Td>
                  <Td className="max-w-[150px] truncate whitespace-nowrap text-muted">{siteName(s.siteIds[0])}{s.siteIds.length > 1 && <span className="text-faint"> +{s.siteIds.length - 1}</span>}</Td>
                  <Td>
                    <div className="flex min-w-[130px] items-center gap-2">
                      <Progress value={rec} tone={s.health.recruitment} className="w-14" />
                      <span className="tnum text-[13px] text-ink">{fmtNum(s.enrolled)}<span className="text-faint">/{fmtNum(s.target)}</span></span>
                    </div>
                  </Td>
                  <Td><span className={cx('tnum', metricTone(s.dataQuality, 92, 82))}>{s.dataQuality}%</span></Td>
                  <Td><span className={cx('tnum', metricTone(s.compliance, 94, 80))}>{s.compliance}%</span></Td>
                  <Td><SignalCells h={s.health} /></Td>
                  <Td><StatusBadge status={s.status} /></Td>
                </Tr>
                {expanded && (
                  <tr className="border-b border-line bg-canvas/60">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="grid gap-x-6 gap-y-2 pl-8 sm:grid-cols-2 lg:grid-cols-3">
                        {SIGNALS.map((sig) => (
                          <div key={sig.key} className="flex items-center gap-2 text-[13px]">
                            <span className={cx('size-2.5 rounded-sm', LEVEL_CELL[s.health[sig.key]])} aria-hidden />
                            <span className="text-muted">{sig.label}</span>
                            <span className="ml-auto font-medium text-ink lg:ml-0">{signalDetail(s, sig.key)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pl-8 text-[13px]">
                        <Link to={`/studies/${s.id}`} className="font-medium text-info hover:underline">Open study workspace</Link>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">No studies match these filters.</td></tr>
          )}
        </tbody>
      </Table>
      {filtered.length > 8 && (
        <div className="border-t border-line px-4 py-2.5 text-[13px]">
          <button onClick={() => setShowAll((v) => !v)} className="font-medium text-info hover:underline">
            {showAll ? 'Show fewer' : `Show all ${filtered.length} studies`}
          </button>
        </div>
      )}
    </Panel>
  )
}

function signalDetail(s: Study, k: keyof HealthSignals): string {
  const lvl = s.health[k]
  switch (k) {
    case 'recruitment': return `${pct(s.enrolled, s.target)}% of target${lvl === 'ok' ? '' : ', behind pace'}`
    case 'dataCompletion': return `${s.dataQuality}% complete, ${s.openQueries} open queries`
    case 'deviations': return `${s.deviations} open`
    case 'safetyReporting': return lvl === 'crit' ? '1 overdue report' : 'No overdue reports'
    case 'regulatory': return lvl === 'ok' ? 'No pending items' : lvl === 'warn' ? '2 upcoming deadlines' : 'Annual report overdue'
    case 'documents': return lvl === 'ok' ? 'Complete' : lvl === 'warn' ? '1 pending approval' : '3 missing documents'
  }
}
