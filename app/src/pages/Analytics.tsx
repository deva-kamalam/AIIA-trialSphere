import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, BarChart3, Download, FlaskConical, ShieldAlert, Users, Database } from 'lucide-react'
import { participantService, safetyService, siteService, studyService } from '@/services'
import { useAsync } from '@/lib/hooks'
import { fmtNum } from '@/lib/format'
import { Button, EmptyState, Kpi, PageHeader, Panel, Skeleton } from '@/components/ui/primitives'
import { ClearFilters, FilterSelect } from '@/components/ui/data'
import { useToast } from '@/components/ui/toast'
import { C, SERIES, axisProps, gridProps } from '@/components/charts/palette'
import { ChartTooltip, Legend } from '@/components/charts/theme'
import type { StudyType } from '@/types'
import { RANGES, EMPTY_FILTERS, changePhrase, compute, toCsv, type Filters, type RangeId, type Source } from './analytics/compute'
import { StudyTimeline } from './analytics/Timeline'

const STUDY_TYPES: StudyType[] = ['Interventional', 'Observational', 'Pilot / Feasibility', 'Supportive Care']
const BAND = { ok: C.teal, warn: C.amber, crit: C.red }
const H = 260

function ChartPanel({ title, takeaway, legend, children }: { title: string; takeaway: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <Panel title={title} subtitle={takeaway}>
      {legend && <div className="mb-3">{legend}</div>}
      {children}
    </Panel>
  )
}

function NoData({ text = 'No records for the current filters.' }: { text?: string }) {
  return <div className="flex items-center justify-center text-sm text-faint" style={{ height: H }}>{text}</div>
}

export default function Analytics() {
  const toast = useToast()
  const [params] = useSearchParams()
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, study: params.get('study') ?? '', site: params.get('site') ?? '' })
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }))

  const { data, loading, error } = useAsync<Source>(async () => {
    const [studies, participants, sites, aes] = await Promise.all([
      studyService.list(), participantService.list(), siteService.list(), safetyService.list(),
    ])
    return { studies, participants, sites, aes }
  })

  const m = useMemo(() => (data ? compute(data, f) : null), [data, f])
  const departments = useMemo(() => Array.from(new Set(data?.studies.map((s) => s.department) ?? [])).sort(), [data])
  const dirty = f.study !== '' || f.department !== '' || f.site !== '' || f.type !== '' || f.range !== EMPTY_FILTERS.range

  const exportReport = () => {
    if (!m || !data) return
    const labels: Record<string, string> = {
      Study: f.study || 'All studies',
      Department: f.department || 'All departments',
      Site: f.site ? `${f.site}, ${data.sites.find((s) => s.id === f.site)?.name ?? ''}` : 'All sites',
      'Study type': f.type || 'All types',
    }
    const blob = new Blob([toCsv(m, f, labels)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aiia-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('success', 'Report exported')
  }

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        subtitle="Recruitment, site, safety, data quality and timeline analytics across the research portfolio."
        actions={<Button variant="primary" icon={Download} onClick={exportReport} disabled={!m || m.studies.length === 0}>Export report</Button>}
      />

      <div className="mb-4 rounded-[var(--radius-panel)] border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <FilterSelect label="Study" value={f.study} onChange={(v) => set('study', v)} allLabel="All studies"
            options={(data?.studies ?? []).map((s) => ({ value: s.id, label: `${s.id} ${s.shortTitle}` }))} />
          <FilterSelect label="Department" value={f.department} onChange={(v) => set('department', v)} options={departments} />
          <FilterSelect label="Site" value={f.site} onChange={(v) => set('site', v)} allLabel="All sites"
            options={(data?.sites ?? []).map((s) => ({ value: s.id, label: `${s.city}, ${s.name}` }))} />
          <FilterSelect label="Study type" value={f.type} onChange={(v) => set('type', v)} options={STUDY_TYPES} />
          <label className="relative inline-flex h-8 items-center rounded-[var(--radius-ctl)] border border-line-2 bg-white text-[13px]">
            <span className="pl-2.5 text-muted">Period:</span>
            <select value={f.range} onChange={(e) => set('range', e.target.value as RangeId)} className="h-full cursor-pointer appearance-none bg-transparent pr-3 pl-1 font-medium text-ink focus:outline-none">
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <ClearFilters show={dirty} onClear={() => setF(EMPTY_FILTERS)} />
          {m && <span className="ml-auto text-[13px] text-muted">{m.studies.length} {m.studies.length === 1 ? 'study' : 'studies'} in scope</span>}
        </div>
      </div>

      {error && <Panel><p className="text-sm text-crit">Analytics could not be loaded. {error}</p></Panel>}

      {loading || !m ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[340px]" />)}
        </div>
      ) : m.studies.length === 0 ? (
        <Panel>
          <EmptyState icon={BarChart3} title="No studies match these filters"
            body="Try a wider period or remove a filter. Studies that finished before the selected period are excluded."
            action={<Button onClick={() => setF(EMPTY_FILTERS)}>Clear filters</Button>} />
        </Panel>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Enrolled in period" value={fmtNum(m.enrolledInWindow.length)} icon={Users}
              delta={changePhrase('', m.last90, m.prev90, 'prior 90 days').trim()} deltaTone={m.last90 >= m.prev90 ? 'ok' : 'warn'} />
            <Kpi label="Retention" value={`${m.retentionRate}%`} icon={Activity} hint={`${fmtNum(m.withdrawnAll)} withdrawn`}
              tone={m.retentionRate < 90 ? 'warn' : undefined} />
            <Kpi label="Protocol deviations" value={fmtNum(m.totalDeviations)} icon={FlaskConical} hint={`across ${m.studies.length} studies`} />
            <Kpi label="Adverse events in period" value={fmtNum(m.aes.length)} icon={ShieldAlert} hint={`${m.seriousN} serious`}
              tone={m.seriousN > 0 ? 'crit' : undefined} />
            <Kpi label="Median data quality" value={m.dqStudies ? `${m.medianDq}%` : '—'} icon={Database} hint={`${fmtNum(m.openQueries)} open queries`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RecruitmentPanel m={m} />
            <CompletionPanel m={m} />
            <SitePanel m={m} />
            <RetentionPanel m={m} />
            <DeviationPanel m={m} />
            <AePanel m={m} />
            <QualityPanel m={m} />
            <ChartPanel
              title="Study timeline"
              takeaway={m.timeline.length
                ? `${m.timeline.length} running ${m.timeline.length === 1 ? 'study' : 'studies'}; ${m.dueSoon} due to complete within 6 months`
                : 'No recruiting or follow-up studies in scope'}
            >
              {m.timeline.length ? <StudyTimeline studies={m.timeline} /> : <NoData text="No running studies for the current filters." />}
            </ChartPanel>
          </div>
        </>
      )}
    </div>
  )
}

type M = ReturnType<typeof compute>

function RecruitmentPanel({ m }: { m: M }) {
  const has = m.recruitment.some((r) => r.cumulative > 0)
  const pace = m.paceGap === null ? '' : `, cumulative at ${m.paceGap}% of target pace`
  return (
    <ChartPanel
      title="Recruitment trend"
      takeaway={has ? `${changePhrase('Enrolment', m.last90, m.prev90)}${pace}` : 'No enrolments recorded for the current filters'}
      legend={has && <Legend items={[{ label: 'Enrolled per month', color: C.muted }, { label: 'Cumulative enrolled', color: C.ink }, { label: 'Target pace', color: C.amber, dashed: true }]} />}
    >
      {has ? (
        <ResponsiveContainer width="100%" height={H}>
          <ComposedChart data={m.recruitment} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
            <YAxis yAxisId="c" {...axisProps} width={52} tickFormatter={(v: number) => fmtNum(v)} />
            <YAxis yAxisId="m" orientation="right" {...axisProps} width={36} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
            <Bar yAxisId="m" dataKey="enrolled" name="Enrolled" fill={C.muted} radius={[2, 2, 0, 0]} maxBarSize={22} />
            <Line yAxisId="c" dataKey="cumulative" name="Cumulative" stroke={C.ink} strokeWidth={2} dot={false} />
            <Line yAxisId="c" dataKey="pace" name="Target pace" stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </ChartPanel>
  )
}

function CompletionPanel({ m }: { m: M }) {
  const total = m.stageCounts.reduce((a, s) => a + s.count, 0)
  const done = m.stageCounts.find((s) => s.stage === 'Completed')?.count ?? 0
  return (
    <ChartPanel
      title="Trial completion"
      takeaway={`${done} of ${total} studies completed; ${m.dueNext12} more planned to complete in the next 12 months`}
    >
      <ResponsiveContainer width="100%" height={H}>
        <BarChart data={m.stageCounts} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="stage" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11.5 }} />
          <YAxis {...axisProps} allowDecimals={false} width={40} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
          <Bar dataKey="count" name="Studies" radius={[3, 3, 0, 0]} maxBarSize={56}>
            {m.stageCounts.map((s, i) => <Cell key={s.stage} fill={s.stage === 'Completed' ? C.teal : SERIES[i === 0 ? 7 : i]} />)}
            <LabelList dataKey="count" position="top" fill={C.ink} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  )
}

function SitePanel({ m }: { m: M }) {
  const rows = m.siteRows.slice(0, 10).map((r) => {
    const band: keyof typeof BAND = r.visitCompletion >= 90 ? 'ok' : r.visitCompletion >= 80 ? 'warn' : 'crit'
    return { ...r, band }
  })
  const total = m.siteRows.reduce((a, r) => a + r.participants, 0)
  const low = m.siteRows.filter((r) => r.visitCompletion < 80).length
  const top = m.siteRows[0]
  return (
    <ChartPanel
      title="Site performance"
      takeaway={top
        ? `${top.city} holds ${Math.round((top.participants / Math.max(1, total)) * 100)}% of participants; ${low ? `${low} ${low === 1 ? 'site' : 'sites'} below 80% visit completion` : 'all sites at or above 80% visit completion'}`
        : 'No site enrolments for the current filters'}
      legend={top && <Legend items={[{ label: 'Visit completion 90% or more', color: BAND.ok }, { label: '80–89%', color: BAND.warn }, { label: 'Below 80%', color: BAND.crit }]} />}
    >
      {rows.length ? (
        <ResponsiveContainer width="100%" height={Math.max(H, rows.length * 26)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey="city" {...axisProps} width={120} interval={0} />
            <Tooltip
              cursor={{ fill: C.grid, opacity: 0.4 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof rows)[number] | undefined
                if (!active || !p) return null
                return (
                  <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(15,39,71,0.25)]">
                    <div className="font-medium text-ink">{p.name}, {p.city}</div>
                    <div className="mt-1 text-muted">Participants <span className="tnum font-medium text-ink">{fmtNum(p.participants)}</span></div>
                    <div className="text-muted">Visit completion <span className="tnum font-medium text-ink">{p.visitCompletion}%</span></div>
                  </div>
                )
              }}
            />
            <Bar dataKey="participants" name="Participants" radius={[0, 3, 3, 0]} maxBarSize={18}>
              {rows.map((r) => <Cell key={r.id} fill={BAND[r.band]} />)}
              <LabelList dataKey="participants" position="right" fill={C.ink} fontSize={11.5} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </ChartPanel>
  )
}

function RetentionPanel({ m }: { m: M }) {
  const lowest = [...m.retention].sort((a, b) => a.retained - b.retained)[0]
  return (
    <ChartPanel
      title="Participant retention"
      takeaway={m.retention.length
        ? `Overall retention ${m.retentionRate}%${lowest && m.retention.length > 1 ? `; lowest in ${lowest.id} at ${lowest.retained}%` : ''}`
        : 'No enrolled participants for the current filters'}
      legend={m.retention.length > 0 && <Legend items={[{ label: 'Retained', color: C.teal }, { label: 'Withdrawn', color: C.red }]} />}
    >
      {m.retention.length ? (
        <ResponsiveContainer width="100%" height={Math.max(H, m.retention.length * 26)}>
          <BarChart data={m.retention} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} stackOffset="expand">
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
            <YAxis type="category" dataKey="id" {...axisProps} width={72} interval={0} tick={{ ...axisProps.tick, fontFamily: 'var(--font-mono)', fontSize: 11.5 }} />
            <Tooltip content={<ChartTooltip unit="%" />} cursor={{ fill: C.grid, opacity: 0.4 }} />
            <Bar dataKey="retained" name="Retained" stackId="r" fill={C.teal} maxBarSize={18} />
            <Bar dataKey="withdrawn" name="Withdrawn" stackId="r" fill={C.red} maxBarSize={18} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </ChartPanel>
  )
}

function DeviationPanel({ m }: { m: M }) {
  const top = m.deviations[0]
  return (
    <ChartPanel
      title="Protocol deviations"
      takeaway={top
        ? `${top.id} accounts for ${Math.round((top.deviations / Math.max(1, m.totalDeviations)) * 100)}% of ${m.totalDeviations} recorded deviations`
        : 'No protocol deviations recorded for the current filters'}
      legend={top && <Legend items={[{ label: '10 or more', color: C.red }, { label: '5–9', color: C.amber }, { label: 'Fewer than 5', color: C.ink3 }]} />}
    >
      {m.deviations.length ? (
        <ResponsiveContainer width="100%" height={H}>
          <BarChart data={m.deviations} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="id" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
            <YAxis {...axisProps} allowDecimals={false} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
            <Bar dataKey="deviations" name="Deviations" radius={[3, 3, 0, 0]} maxBarSize={36}>
              {m.deviations.map((d) => <Cell key={d.id} fill={d.deviations >= 10 ? C.red : d.deviations >= 5 ? C.amber : C.ink3} />)}
              <LabelList dataKey="deviations" position="top" fill={C.ink} fontSize={11.5} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <NoData text="No protocol deviations recorded." />}
    </ChartPanel>
  )
}

function AePanel({ m }: { m: M }) {
  const has = m.aes.length > 0
  return (
    <ChartPanel
      title="Adverse events"
      takeaway={has
        ? `${m.seriousN} serious of ${m.aes.length} events in period; ${changePhrase('reports', m.ae90, m.aePrev90)}`
        : 'No adverse events reported in the selected period'}
      legend={has && <Legend items={[{ label: 'Serious', color: C.red }, { label: 'Non-serious', color: C.sky }]} />}
    >
      {has ? (
        <ResponsiveContainer width="100%" height={H}>
          <BarChart data={m.aeMonthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axisProps} allowDecimals={false} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
            <Bar dataKey="serious" name="Serious" stackId="ae" fill={C.red} maxBarSize={26} />
            <Bar dataKey="nonSerious" name="Non-serious" stackId="ae" fill={C.sky} maxBarSize={26} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </ChartPanel>
  )
}

function QualityPanel({ m }: { m: M }) {
  const below85 = m.dqBins.filter((b) => b.max < 85).reduce((a, b) => a + b.count, 0)
  return (
    <ChartPanel
      title="Data quality"
      takeaway={m.dqStudies
        ? `Median ${m.medianDq}% complete and clean; ${below85} ${below85 === 1 ? 'study' : 'studies'} below 85%, ${fmtNum(m.openQueries)} open queries`
        : 'No studies collecting data for the current filters'}
      legend={m.dqStudies > 0 && <Legend items={[{ label: '90% or more', color: BAND.ok }, { label: '80–89%', color: BAND.warn }, { label: 'Below 80%', color: BAND.crit }]} />}
    >
      {m.dqStudies ? (
        <ResponsiveContainer width="100%" height={H}>
          <BarChart data={m.dqBins} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval={0} />
            <YAxis {...axisProps} allowDecimals={false} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.4 }} />
            <Bar dataKey="count" name="Studies" radius={[3, 3, 0, 0]} maxBarSize={56}>
              {m.dqBins.map((b) => <Cell key={b.label} fill={BAND[b.band]} />)}
              <LabelList dataKey="count" position="top" fill={C.ink} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </ChartPanel>
  )
}
