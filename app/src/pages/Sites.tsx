import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, CalendarCheck, Clock, MapPin, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, Kpi, MeterCell, Mono, PageHeader, Panel, Progress, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { ClearFilters, FilterBar, FilterSelect, SearchInput, SortTh, Table, Td, THead, Tr } from '@/components/ui/data'
import { Drawer } from '@/components/ui/overlays'
import { C, axisProps } from '@/components/charts/palette'
import { ChartTooltip } from '@/components/charts/theme'
import { useAsync, useSort } from '@/lib/hooks'
import { cx, fmtDate, fmtNum } from '@/lib/format'
import { siteService, studyService } from '@/services'
import type { Site, Study } from '@/types'

const STATUSES: Site['status'][] = ['Active', 'Activation Pending', 'Closed']

export default function Sites() {
  const [params, setParams] = useSearchParams()
  const { data, loading } = useAsync(() => Promise.all([siteService.list(), studyService.list()]))
  const sites = useMemo(() => data?.[0] ?? [], [data])
  const studies = useMemo(() => data?.[1] ?? [], [data])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [state, setState] = useState('')

  const studiesBySite = useMemo(() => {
    const m = new Map<string, Study[]>()
    for (const s of studies) for (const id of s.siteIds) m.set(id, [...(m.get(id) ?? []), s])
    return m
  }, [studies])

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    return sites.filter((s) =>
      (!n || [s.id, s.name, s.city, s.state, s.investigator].some((x) => x.toLowerCase().includes(n))) &&
      (!status || s.status === status) &&
      (!state || s.state === state),
    )
  }, [sites, q, status, state])
  const { sorted, sort, toggle } = useSort<Site>(filtered, { key: 'id', dir: 'asc' })

  const active = useMemo(() => sites.filter((s) => s.status === 'Active'), [sites])
  const pending = sites.filter((s) => s.status === 'Activation Pending')
  const totalParticipants = sites.reduce((a, s) => a + s.participants, 0)
  const avgVisit = active.length ? Math.round((active.reduce((a, s) => a + s.visitCompletion, 0) / active.length) * 10) / 10 : 0
  const states = useMemo(() => Array.from(new Set(sites.map((s) => s.state))).sort(), [sites])

  const chartData = useMemo(
    () => [...active].sort((a, b) => b.participants - a.participants).map((s) => ({ label: `${s.id} ${s.city}`, participants: s.participants, id: s.id })),
    [active],
  )

  const selectedId = params.get('site')
  const selected = sites.find((s) => s.id === selectedId) ?? null
  const openSite = (id: string) => { const n = new URLSearchParams(params); n.set('site', id); setParams(n, { replace: true }) }
  const closeSite = () => { const n = new URLSearchParams(params); n.delete('site'); setParams(n, { replace: true }) }

  const anyFilter = !!(q || status || state)

  return (
    <div>
      <PageHeader title="Sites" subtitle="Participating sites, activation status and operational performance across the network." />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {loading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[86px]" />) : (
          <>
            <Kpi label="Active sites" value={active.length} icon={Building2} hint={`of ${sites.length} in network`} onClick={() => setStatus('Active')} />
            <Kpi label="Activation pending" value={pending.length} icon={Clock} tone={pending.length ? 'warn' : undefined} hint="Awaiting site initiation" onClick={() => setStatus('Activation Pending')} />
            <Kpi label="Participants across sites" value={fmtNum(totalParticipants)} icon={Users} hint="Enrolled to date" />
            <Kpi label="Average visit completion" value={`${avgVisit}%`} icon={CalendarCheck} hint="Active sites" tone={avgVisit < 85 ? 'warn' : undefined} />
          </>
        )}
      </div>

      <section className="rounded-[var(--radius-panel)] border border-line bg-white">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search site, city or investigator" className="w-full sm:w-72" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES} />
          <FilterSelect label="State" value={state} onChange={setState} options={states} />
          <ClearFilters show={anyFilter} onClear={() => { setQ(''); setStatus(''); setState('') }} />
          <span className="ml-auto text-[13px] text-muted tnum">{sorted.length} of {sites.length} sites</span>
        </FilterBar>
        <Table minWidth={1080}>
          <THead>
            <tr>
              <SortTh label="Site ID" k="id" sort={sort} onSort={toggle} />
              <SortTh label="Site name" k="name" sort={sort} onSort={toggle} />
              <SortTh label="Site investigator" k="investigator" sort={sort} onSort={toggle} />
              <SortTh label="Status" k="status" sort={sort} onSort={toggle} />
              <SortTh label="Participants" k="participants" sort={sort} onSort={toggle} />
              <SortTh label="Visit completion" k="visitCompletion" sort={sort} onSort={toggle} />
              <SortTh label="Data quality" k="dataQuality" sort={sort} onSort={toggle} />
              <SortTh label="Deviations" k="deviations" sort={sort} onSort={toggle} />
              <SortTh label="Activated on" k="activatedOn" sort={sort} onSort={toggle} />
            </tr>
          </THead>
          <tbody>
            {loading && Array.from({ length: 8 }, (_, i) => (
              <tr key={i} className="border-b border-line"><Td colSpan={9}><Skeleton className="h-5 w-full" /></Td></tr>
            ))}
            {!loading && sorted.map((s) => {
              const isActive = s.status === 'Active'
              return (
                <Tr key={s.id} onClick={() => openSite(s.id)} active={s.id === selectedId}>
                  <Td><Mono className="text-ink">{s.id}</Mono></Td>
                  <Td>
                    <div className="font-medium text-ink">{s.name}</div>
                    <div className="text-xs text-muted">{s.city}, {s.state}</div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-3">{s.investigator}</Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td className="tnum">{fmtNum(s.participants)}</Td>
                  <Td>{isActive ? <MeterCell value={s.visitCompletion} /> : <span className="text-faint">—</span>}</Td>
                  <Td>{isActive ? <MeterCell value={s.dataQuality} warnBelow={90} critBelow={85} /> : <span className="text-faint">—</span>}</Td>
                  <Td className={cx('tnum', s.deviations >= 7 && 'font-medium text-warn')}>{isActive ? s.deviations : <span className="text-faint">—</span>}</Td>
                  <Td className="tnum whitespace-nowrap">{s.activatedOn ? fmtDate(s.activatedOn) : <span className="text-faint">Not activated</span>}</Td>
                </Tr>
              )
            })}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={9}><EmptyState icon={MapPin} title="No sites match these filters" body="Try a different search or clear the filters." /></td></tr>
            )}
          </tbody>
        </Table>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Participants per active site" subtitle="Enrolled participants, all studies">
          {loading ? <Skeleton className="h-[420px]" /> : (
            <div style={{ height: Math.max(220, chartData.length * 26 + 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap={6}>
                  <CartesianGrid stroke={C.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmtNum(v)} />
                  <YAxis type="category" dataKey="label" {...axisProps} width={150} interval={0} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: C.grid, opacity: 0.5 }} />
                  <Bar
                    dataKey="participants"
                    name="Participants"
                    radius={[0, 3, 3, 0]}
                    cursor="pointer"
                    onClick={(d) => { const id = (d as { payload?: { id?: string } }).payload?.id; if (id) openSite(id) }}
                  >
                    {chartData.map((d) => <Cell key={d.id} fill={d.id === selectedId ? C.sky : C.ink} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Activation pending" subtitle="Sites awaiting initiation">
          {loading ? <Skeleton className="h-40" /> : pending.length ? (
            <ul className="divide-y divide-line">
              {pending.map((s) => (
                <li key={s.id}>
                  <button onClick={() => openSite(s.id)} className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-canvas">
                    <Mono className="mt-0.5 text-muted">{s.id}</Mono>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                      <span className="block text-xs text-muted">{s.city}, {s.state}, {s.investigator}</span>
                    </span>
                    <span className="text-xs whitespace-nowrap text-muted">{(studiesBySite.get(s.id) ?? []).length} studies</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="All sites are active" />}
        </Panel>
      </div>

      <Drawer
        open={!!selected}
        onClose={closeSite}
        width="max-w-xl"
        title={selected ? <span className="flex items-center gap-2"><Mono className="text-muted">{selected.id}</Mono>{selected.name}</span> : ''}
      >
        {selected && <SiteDetail site={selected} studies={studiesBySite.get(selected.id) ?? []} />}
      </Drawer>
      {selectedId && !loading && !selected && (
        <p className="mt-3 text-[13px] text-crit" role="alert">Site {selectedId} was not found.</p>
      )}
    </div>
  )
}

function SiteDetail({ site, studies }: { site: Site; studies: Study[] }) {
  const isActive = site.status === 'Active'
  const running = studies.filter((s) => s.stage !== 'Completed')
  const completed = studies.length - running.length
  return (
    <div className="space-y-5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={site.status} />
        <span className="flex items-center gap-1 text-[13px] text-muted"><MapPin className="size-3.5" aria-hidden />{site.city}, {site.state}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
        <div><dt className="text-[13px] text-muted">Site investigator</dt><dd className="text-ink">{site.investigator}</dd></div>
        <div><dt className="text-[13px] text-muted">Activated on</dt><dd className="text-ink">{site.activatedOn ? fmtDate(site.activatedOn) : 'Not activated'}</dd></div>
        <div><dt className="text-[13px] text-muted">Participants enrolled</dt><dd className="tnum text-ink">{fmtNum(site.participants)}</dd></div>
        <div><dt className="text-[13px] text-muted">Open protocol deviations</dt><dd className="tnum text-ink">{isActive ? site.deviations : '—'}</dd></div>
      </dl>

      {isActive ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Metric label="Visit completion" value={site.visitCompletion} warn={85} crit={75} />
          <Metric label="Data quality" value={site.dataQuality} warn={90} crit={85} />
        </div>
      ) : (
        <p className="rounded-[var(--radius-ctl)] bg-warn-soft px-3 py-2 text-[13px] text-warn">
          Site initiation is pending. Performance metrics will appear after activation.
        </p>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink">Studies at this site</h3>
          <span className="text-xs text-muted">{running.length} running, {completed} completed</span>
        </div>
        {studies.length ? (
          <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line">
            {studies.map((s) => (
              <li key={s.id}>
                <Link to={`/studies/${s.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-canvas">
                  <Mono className="text-ink">{s.id}</Mono>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-ink">{s.title}</span>
                    <span className="block text-xs text-muted">{s.pi}, {s.stage}</span>
                  </span>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No studies assigned to this site" />
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, warn, crit }: { label: string; value: number; warn: number; crit: number }) {
  const tone = value < crit ? 'crit' : value < warn ? 'warn' : 'ok'
  return (
    <div className="rounded-[var(--radius-panel)] border border-line px-3 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="tnum text-lg font-semibold text-ink">{value}%</span>
      </div>
      <Progress value={value} tone={tone} className="mt-2" label={label} />
    </div>
  )
}
