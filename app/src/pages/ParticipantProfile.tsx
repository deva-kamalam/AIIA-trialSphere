import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ClipboardList, FileText, ShieldCheck, UserX, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { participantService, safetyService, siteService, studyService } from '@/services'
import { useAsync } from '@/lib/hooks'
import { cx, daysFromToday, fmtDate, fmtShort, relDue } from '@/lib/format'
import { useAuth } from '@/auth/useAuth'
import type { Participant, Site, Study, Visit } from '@/types'
import { Badge, Button, EmptyState, Kpi, Mono, PageHeader, Panel, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { THead, Table, Tabs, Td, Th, Tr } from '@/components/ui/data'
import { C, axisProps, gridProps } from '@/components/charts/palette'
import { ChartTooltip } from '@/components/charts/theme'
import {
  FORM_TONE, LAB_DEFS, ayurvedaFor, conMedsFor, daysLate, daysPastWindow, deviationsFor, formStatus, formsForVisit,
  hashStr, isoAdd, labFlag, labsFor, visitIndex,
} from './participants/shared'
import { KV } from './participants/KV'

const TABS = ['Overview', 'Visits', 'eCRF', 'Labs', 'Medications', 'Adverse Events', 'Protocol Deviations', 'Documents'] as const
type Tab = (typeof TABS)[number]

export default function ParticipantProfile() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data: p, loading } = useAsync(() => participantService.get(id), [id])
  const { data: schedule } = useAsync(() => participantService.schedule(id), [id])
  const { data: studies } = useAsync(() => studyService.list(), [])
  const { data: sites } = useAsync(() => siteService.list(), [])
  const { data: aes } = useAsync(() => safetyService.list(), [])

  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : 'Overview'
  const setTab = (t: Tab) => setParams((prev) => { const n = new URLSearchParams(prev); if (t === 'Overview') n.delete('tab'); else n.set('tab', t); return n }, { replace: true })

  const study = studies?.find((s) => s.id === p?.studyId)
  const site = sites?.find((s) => s.id === p?.siteId)
  const myAes = useMemo(() => (aes ?? []).filter((a) => a.participantId === id), [aes, id])
  const deviations = useMemo(() => (p && schedule ? deviationsFor(p, schedule) : []), [p, schedule])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (!p) {
    return (
      <Panel>
        <EmptyState
          icon={UserX}
          title="Participant not found"
          body={`No participant record matches ${id}. Check the ID, or the record may belong to a study you are not assigned to.`}
          action={<Button icon={ArrowLeft} onClick={() => nav('/participants')}>Back to participants</Button>}
        />
      </Panel>
    )
  }

  const sched = schedule ?? []
  const tabs = TABS.map((t) => ({
    id: t,
    label: t,
    count: t === 'Adverse Events' ? myAes.length : t === 'Protocol Deviations' ? deviations.length : undefined,
  }))

  return (
    <div>
      <PageHeader
        title={<>Participant <span className="font-mono text-[20px] tracking-tight">{p.id}</span></>}
        subtitle="Pseudonymised record. Identifiable source documents are held at the site."
        actions={
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => nav('/participants')}>Participants</Button>
            {can('ecrf:view') && (
              <Button icon={ClipboardList} onClick={() => nav(`/ecrf?participant=${p.id}&visit=${encodeURIComponent(p.currentVisit)}`)}>Open eCRF</Button>
            )}
          </>
        }
      />

      <section className="mb-4 rounded-[var(--radius-panel)] border border-line bg-white px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4 xl:grid-cols-7">
          <KV label="Study" className="col-span-2 md:col-span-2">
            <Link to={`/studies/${p.studyId}`} className="text-info hover:underline">
              <Mono>{p.studyId}</Mono> <span className="font-normal">{study?.title ?? ''}</span>
            </Link>
          </KV>
          <KV label="Site"><span title={site?.name}>{site ? `${site.name}` : p.siteId}</span></KV>
          <KV label="Enrollment date">{p.enrollmentDate ? fmtDate(p.enrollmentDate) : 'Not enrolled'}</KV>
          <KV label="Current status"><StatusBadge status={p.status} /></KV>
          <KV label="Prakriti">{p.prakriti}</KV>
          <KV label="Age, sex">{p.age} years, {p.sex === 'F' ? 'female' : 'male'}</KV>
        </dl>
      </section>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'Overview' && <Overview p={p} schedule={sched} aeCount={myAes.length} openAes={myAes.filter((a) => a.reviewStatus !== 'Resolved').length} />}
      {tab === 'Visits' && <VisitsTab schedule={sched} />}
      {tab === 'eCRF' && <EcrfTab p={p} schedule={sched} />}
      {tab === 'Labs' && <LabsTab p={p} schedule={sched} />}
      {tab === 'Medications' && <MedsTab p={p} study={study} schedule={sched} />}
      {tab === 'Adverse Events' && (
        <Panel title="Adverse events" subtitle="Events reported for this participant across all visits." bodyClass="p-0"
          actions={can('safety:report') && <Button size="sm" onClick={() => nav('/safety?new=1')}>Report adverse event</Button>}>
          {myAes.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No adverse events reported" body="Adverse events recorded in the eCRF safety section appear here once submitted." />
          ) : (
            <Table minWidth={960}>
              <THead><tr><Th>Event ID</Th><Th>Event</Th><Th>Onset</Th><Th>Severity</Th><Th>Serious</Th><Th>Causality</Th><Th>Review status</Th><Th>Outcome</Th></tr></THead>
              <tbody>
                {myAes.map((a) => (
                  <Tr key={a.id} onClick={() => nav(`/safety?event=${a.id}`)}>
                    <Td><Link to={`/safety?event=${a.id}`} className="text-info hover:underline" onClick={(e) => e.stopPropagation()}><Mono>{a.id}</Mono></Link></Td>
                    <Td className="font-medium">{a.event}</Td>
                    <Td className="tnum">{fmtDate(a.onsetDate)}</Td>
                    <Td><Badge tone={a.severity === 'Severe' ? 'crit' : a.severity === 'Moderate' ? 'warn' : 'neutral'}>{a.severity}</Badge></Td>
                    <Td>{a.serious ? <Badge tone="crit">Serious</Badge> : 'No'}</Td>
                    <Td>{a.causality}</Td>
                    <Td><StatusBadge status={a.reviewStatus} /></Td>
                    <Td><StatusBadge status={a.outcome} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
      {tab === 'Protocol Deviations' && (
        <Panel title="Protocol deviations" subtitle="Deviations logged against this participant, with corrective and preventive action." bodyClass="p-0">
          {deviations.length === 0 ? (
            <EmptyState icon={Check} title="No protocol deviations recorded" body="All visits so far were conducted within their protocol windows." />
          ) : (
            <Table minWidth={960}>
              <THead><tr><Th>Deviation ID</Th><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Classification</Th><Th>Status</Th><Th>CAPA</Th></tr></THead>
              <tbody>
                {deviations.map((d) => (
                  <Tr key={d.id}>
                    <Td><Mono>{d.id}</Mono></Td>
                    <Td className="tnum whitespace-nowrap">{fmtDate(d.date)}</Td>
                    <Td className="whitespace-nowrap">{d.category}</Td>
                    <Td className="max-w-[320px]">{d.description}</Td>
                    <Td><Badge tone={d.severity === 'Major' ? 'crit' : 'warn'}>{d.severity}</Badge></Td>
                    <Td><Badge tone={d.status === 'Open' ? 'warn' : 'neutral'}>{d.status}</Badge></Td>
                    <Td className="max-w-[280px] text-muted">{d.capa}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
      {tab === 'Documents' && <DocsTab p={p} schedule={sched} site={site} />}
    </div>
  )
}

// ---------------- Overview ----------------
function Overview({ p, schedule, aeCount, openAes }: { p: Participant; schedule: Visit[]; aeCount: number; openAes: number }) {
  const done = schedule.filter((v) => v.status === 'Completed').length
  const next = schedule.find((v) => v.status === 'Upcoming' || v.status === 'Overdue')
  const daysOn = p.enrollmentDate ? -daysFromToday(p.enrollmentDate) : null
  const ayur = ayurvedaFor(p)
  const latest = [...schedule].reverse().find((v) => v.status === 'Completed')
  const queries = schedule.reduce((n, v) => n + formsForVisit(v.visit).filter((f) => formStatus(p.id, v, f, v === latest) === 'Open query').length, 0)
  const nextOverdue = next?.status === 'Overdue'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Visits completed" value={`${done} of ${schedule.length}`} hint={schedule.some((v) => v.status === 'Missed') ? `${schedule.filter((v) => v.status === 'Missed').length} missed` : 'None missed'} />
        <Kpi label="Next visit" value={next ? fmtShort(next.scheduledDate) : '—'} hint={next ? `${next.visit}, ${relDue(next.scheduledDate)}` : 'No visits scheduled'} tone={nextOverdue ? 'crit' : undefined} />
        <Kpi label="Days on study" value={daysOn ?? '—'} hint={p.enrollmentDate ? `Since ${fmtDate(p.enrollmentDate)}` : 'Awaiting enrollment'} />
        <Kpi label="Open data queries" value={queries} tone={queries ? 'warn' : undefined} hint={queries ? 'Response needed from site' : 'All queries resolved'} />
        <Kpi label="Adverse events" value={aeCount} hint={openAes ? `${openAes} under review` : 'None open'} tone={openAes ? 'warn' : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Visit timeline" subtitle="Protocol schedule with target and actual dates" className="xl:col-span-2">
          {p.status === 'Screen Failure' && (
            <p className="mb-3 rounded-[var(--radius-ctl)] bg-canvas px-3 py-2 text-[13px] text-muted">Participant did not meet eligibility criteria at screening. No further visits are scheduled.</p>
          )}
          <Timeline schedule={schedule} screenFailure={p.status === 'Screen Failure'} />
        </Panel>
        <Panel title="Ayurveda assessment" subtitle={p.enrollmentDate ? `Recorded at baseline, ${fmtDate(p.enrollmentDate)}` : 'Recorded at screening'}>
          <dl className="divide-y divide-line">
            {([
              ['Prakriti', ayur.prakriti, 'Constitution'],
              ['Vikriti', ayur.vikriti, 'Current dosha imbalance'],
              ['Agni', ayur.agni, 'Digestive capacity'],
              ['Kostha', ayur.kostha, 'Bowel nature'],
              ['Bala', ayur.bala, 'Strength'],
              ['Satmya', ayur.satmya, 'Adaptability'],
            ] as const).map(([k, v, d]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <dt>
                  <div className="text-sm font-medium text-ink">{k}</div>
                  <div className="text-xs text-faint">{d}</div>
                </dt>
                <dd className="text-right text-sm text-ink">{p.prakriti === 'Not assessed' ? <span className="text-faint">Not assessed</span> : v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-faint">Assessed by the site investigator using the protocol-specified Prakriti assessment tool.</p>
        </Panel>
      </div>
    </div>
  )
}

function Timeline({ schedule, screenFailure }: { schedule: Visit[]; screenFailure: boolean }) {
  const firstUpcoming = schedule.findIndex((v) => v.status === 'Upcoming')
  return (
    <ol className="relative">
      {schedule.map((v, i) => {
        const na = screenFailure && i > 0
        const last = i === schedule.length - 1
        const doneSeg = v.status === 'Completed' && schedule[i + 1]?.status === 'Completed'
        const past = daysPastWindow(v)
        const late = daysLate(v.scheduledDate)
        const isNext = i === firstUpcoming
        return (
          <li key={v.id} className="relative flex gap-4 pb-5 last:pb-0">
            {!last && <span className={cx('absolute top-7 bottom-0 left-[13px] w-0.5', doneSeg ? 'bg-ok' : 'bg-line')} aria-hidden />}
            <span
              className={cx(
                'relative z-[1] mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2',
                na ? 'border-line bg-canvas' :
                v.status === 'Completed' ? 'border-ok bg-ok text-white' :
                v.status === 'Missed' ? 'border-crit bg-crit text-white' :
                v.status === 'Overdue' ? 'border-crit bg-crit-soft text-crit' :
                isNext ? 'border-info bg-white' : 'border-line-2 bg-white',
              )}
              aria-hidden
            >
              {!na && v.status === 'Completed' && <Check className="size-4" strokeWidth={3} />}
              {!na && v.status === 'Missed' && <X className="size-4" strokeWidth={3} />}
              {!na && v.status === 'Overdue' && <AlertTriangle className="size-3.5" />}
              {!na && v.status === 'Upcoming' && isNext && <span className="size-2 rounded-full bg-info" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cx('font-medium', na ? 'text-faint' : 'text-ink')}>{v.visit}</span>
                <span className="text-xs text-faint">Visit {i}</span>
                {na ? <Badge>Not applicable</Badge> : (
                  <>
                    <StatusBadge status={v.status} />
                    {isNext && <Badge tone="info">Next</Badge>}
                  </>
                )}
              </div>
              {!na && (
                <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-[13px] text-muted sm:grid-cols-3">
                  <span>Target <span className="tnum text-ink">{fmtDate(v.scheduledDate)}</span></span>
                  <span>Window {v.windowDays ? `±${v.windowDays} days` : 'same day'}</span>
                  {v.status === 'Completed' && v.actualDate && (
                    <span>Actual <span className="tnum text-ink">{fmtDate(v.actualDate)}</span></span>
                  )}
                  {v.status === 'Overdue' && (
                    <span className="font-medium text-crit">
                      {past > 0 ? `${past} day${past === 1 ? '' : 's'} past window` : `${late} day${late === 1 ? '' : 's'} past target, window closes ${relDue(isoAdd(v.scheduledDate, v.windowDays)).toLowerCase()}`}
                    </span>
                  )}
                  {v.status === 'Missed' && <span className="font-medium text-crit">Not conducted within window</span>}
                  {v.status === 'Upcoming' && <span>Due {relDue(v.scheduledDate).toLowerCase()}</span>}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------- Visits ----------------
function VisitsTab({ schedule }: { schedule: Visit[] }) {
  return (
    <Panel title="Visit schedule" bodyClass="p-0">
      <Table minWidth={900}>
        <THead><tr><Th>Visit</Th><Th>Target date</Th><Th>Window</Th><Th>Actual date</Th><Th>Deviation from target</Th><Th>Status</Th><Th>Coordinator</Th></tr></THead>
        <tbody>
          {schedule.map((v, i) => {
            const off = v.actualDate ? Math.round((new Date(v.actualDate).getTime() - new Date(v.scheduledDate).getTime()) / 86400000) : null
            const outside = off !== null && Math.abs(off) > v.windowDays
            return (
              <Tr key={v.id} className={v.status === 'Overdue' || v.status === 'Missed' ? 'shadow-[inset_3px_0_0_var(--color-crit)]' : undefined}>
                <Td className="whitespace-nowrap"><span className="font-medium text-ink">{v.visit}</span> <span className="text-xs text-faint">Visit {i}</span></Td>
                <Td className="tnum">{fmtDate(v.scheduledDate)}</Td>
                <Td className="tnum">{v.windowDays ? `±${v.windowDays} days` : 'Same day'}</Td>
                <Td className="tnum">{fmtDate(v.actualDate)}</Td>
                <Td className={cx('tnum', outside ? 'font-medium text-warn' : 'text-muted')}>
                  {off === null ? '—' : off === 0 ? 'On target' : `${off > 0 ? '+' : ''}${off} day${Math.abs(off) === 1 ? '' : 's'}`}
                  {outside && ' (outside window)'}
                </Td>
                <Td><StatusBadge status={v.status} /></Td>
                <Td>{v.coordinator}</Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </Panel>
  )
}

// ---------------- eCRF ----------------
function EcrfTab({ p, schedule }: { p: Participant; schedule: Visit[] }) {
  const latest = [...schedule].reverse().find((v) => v.status === 'Completed')
  const rows = schedule.flatMap((v) => formsForVisit(v.visit).map((form, fi) => ({ v, form, fi, status: formStatus(p.id, v, form, v === latest) })))
  const tally = rows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc }, {})
  return (
    <Panel
      title="Case report forms"
      subtitle="Forms by visit. Open a form to review or enter data."
      bodyClass="p-0"
      actions={
        <div className="flex flex-wrap gap-1.5">
          {(['Signed', 'Complete', 'Open query', 'Not started'] as const).map((s) => (
            <Badge key={s} tone={FORM_TONE[s]}>{s} <span className="tnum">{tally[s] ?? 0}</span></Badge>
          ))}
        </div>
      }
    >
      <Table minWidth={820}>
        <THead><tr><Th>Visit</Th><Th>Form</Th><Th>Status</Th><Th>Last updated</Th><Th className="text-right">Action</Th></tr></THead>
        <tbody>
          {rows.map(({ v, form, fi, status }) => {
            const updated = v.actualDate ? isoAdd(v.actualDate, (hashStr(form + p.id) % 4)) : undefined
            return (
              <tr key={`${v.id}-${form}`} className={cx('border-b border-line last:border-0', fi === 0 && 'border-t border-t-line-2')}>
                <Td className="align-top whitespace-nowrap">{fi === 0 && <><span className="font-medium text-ink">{v.visit}</span> <span className="text-xs text-faint">Visit {visitIndex(v.visit)}</span></>}</Td>
                <Td>{form}</Td>
                <Td><Badge tone={FORM_TONE[status]} dot>{status}</Badge></Td>
                <Td className="tnum text-muted">{updated && status !== 'Not started' ? fmtDate(updated) : '—'}</Td>
                <Td className="text-right">
                  {status !== 'Not done' && (
                    <Link to={`/ecrf?participant=${p.id}&visit=${encodeURIComponent(v.visit)}`} className="text-[13px] font-medium text-info hover:underline">
                      {status === 'Not started' ? 'Enter data' : status === 'Open query' ? 'Review query' : 'View form'}
                    </Link>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Panel>
  )
}

// ---------------- Labs ----------------
function LabsTab({ p, schedule }: { p: Participant; schedule: Visit[] }) {
  const rows = useMemo(() => labsFor(p, schedule), [p, schedule])
  if (rows.length === 0) {
    return <Panel><EmptyState icon={FileText} title="No laboratory results yet" body="Results appear once samples from the screening visit are reported by the central lab." /></Panel>
  }
  const chart = rows.map((r) => ({ visit: r.visit, HbA1c: r.hba1c }))
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel title="Laboratory results" subtitle="Central laboratory values by visit. H and L mark values outside the reference range." className="xl:col-span-2" bodyClass="p-0">
        <Table minWidth={720}>
          <THead>
            <tr>
              <Th>Visit</Th><Th>Collected</Th>
              {LAB_DEFS.map((d) => (
                <Th key={d.key} className="text-right">
                  <div>{d.label}</div>
                  <div className="text-[11.5px] font-normal text-faint">{d.low}–{d.high} {d.unit}</div>
                </Th>
              ))}
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.visit}>
                <Td className="font-medium whitespace-nowrap text-ink">{r.visit}</Td>
                <Td className="tnum whitespace-nowrap">{fmtDate(r.date)}</Td>
                {LAB_DEFS.map((d) => {
                  const v = r[d.key]
                  const flag = labFlag(d, v)
                  return (
                    <Td key={d.key} className="text-right">
                      <span className={cx('tnum', flag && 'font-semibold text-crit')}>{v.toFixed(d.dp)}</span>
                      <span className={cx('ml-1 inline-block w-3 text-[11px] font-semibold', flag ? 'text-crit' : 'text-transparent')} aria-label={flag ? (flag === 'H' ? 'high' : 'low') : undefined}>{flag ?? '·'}</span>
                    </Td>
                  )
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel title="HbA1c trend" subtitle="Upper reference limit 5.6%">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="visit" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />
            <YAxis {...axisProps} domain={[4, 'auto']} />
            <ReferenceLine y={5.6} stroke={C.amber} strokeDasharray="4 3" />
            <Tooltip content={<ChartTooltip unit="%" />} />
            <Line type="monotone" dataKey="HbA1c" stroke={C.ink} strokeWidth={2} dot={{ r: 3, fill: C.ink }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

// ---------------- Medications ----------------
function MedsTab({ p, study, schedule }: { p: Participant; study?: Study; schedule: Visit[] }) {
  const meds = conMedsFor(p)
  const r = hashStr(`${p.id}:ip`)
  const compliance = 78 + (r % 21)
  const dispensed = schedule.filter((v) => v.status === 'Completed' && visitIndex(v.visit) >= 1)
  return (
    <div className="space-y-4">
      <Panel title="Study intervention" subtitle="As specified in the protocol for this participant's allocation">
        {!p.enrollmentDate ? (
          <p className="text-sm text-muted">Intervention starts after enrollment and randomisation.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
            <KV label="Intervention" className="col-span-2">{study?.intervention ?? 'As per protocol'}</KV>
            <KV label="Dose, frequency">{p.studyId === 'AYU-001' ? '3 g, twice daily after meals' : 'As per protocol'}</KV>
            <KV label="Start date">{fmtDate(p.enrollmentDate)}</KV>
            <KV label="Dispensing visits">{dispensed.length}</KV>
            <KV label="Compliance (pill count)">
              <span className={compliance < 80 ? 'text-warn' : undefined}>{compliance}%</span>
            </KV>
          </dl>
        )}
      </Panel>
      <Panel title="Concomitant medication" subtitle="Medication taken alongside the study intervention" bodyClass="p-0">
        {meds.length === 0 ? (
          <EmptyState title="No concomitant medication recorded" />
        ) : (
          <Table minWidth={860}>
            <THead><tr><Th>Medication</Th><Th>Dose</Th><Th>Route</Th><Th>Frequency</Th><Th>Indication</Th><Th>Start date</Th><Th>Status</Th></tr></THead>
            <tbody>
              {meds.map((m) => (
                <Tr key={m.name}>
                  <Td className="font-medium text-ink">{m.name}</Td>
                  <Td className="tnum">{m.dose}</Td>
                  <Td>{m.route}</Td>
                  <Td>{m.frequency}</Td>
                  <Td>{m.indication}</Td>
                  <Td className="tnum">{fmtDate(m.start)}</Td>
                  <Td><Badge tone={m.ongoing ? 'info' : 'neutral'}>{m.ongoing ? 'Ongoing' : 'Stopped'}</Badge></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}

// ---------------- Documents ----------------
function DocsTab({ p, schedule, site }: { p: Participant; schedule: Visit[]; site?: Site }) {
  const code = p.id.split('-').slice(1).join('-')
  const inv = site?.investigator ?? 'Site investigator'
  const docs: { id: string; name: string; version: string; date: string; by: string; status: string }[] = [
    { id: `ICF-${code}`, name: 'Informed consent form (signed)', version: 'v3.0', date: p.screeningDate, by: `Participant, witnessed by ${inv}`, status: 'Signed' },
    { id: `PIS-${code}`, name: 'Participant information sheet (acknowledged)', version: 'v3.0', date: p.screeningDate, by: 'Participant', status: 'Signed' },
    { id: `ELG-${code}`, name: 'Eligibility checklist', version: 'v2.1', date: isoAdd(p.screeningDate, 1), by: inv, status: p.status === 'Screen Failure' ? 'Not eligible' : 'Signed' },
  ]
  if (p.enrollmentDate) docs.push({ id: `RND-${code}`, name: 'Randomisation confirmation', version: 'v1.0', date: p.enrollmentDate, by: 'Central randomisation system', status: 'Generated' })
  schedule.filter((v) => v.status === 'Completed' && ['Baseline', 'Day 30', 'Day 90'].includes(v.visit)).forEach((v) =>
    docs.push({ id: `LAB-${code}-${visitIndex(v.visit)}`, name: `Laboratory report, ${v.visit}`, version: 'v1.0', date: v.actualDate ?? v.scheduledDate, by: 'Central laboratory', status: 'Reviewed' }))
  if (p.status === 'Withdrawn') docs.push({ id: `WDR-${code}`, name: 'Withdrawal of consent form', version: 'v1.0', date: p.lastVisit ?? p.screeningDate, by: inv, status: 'Signed' })
  return (
    <Panel title="Participant documents" subtitle="Document metadata only. Signed originals are filed in the investigator site file." bodyClass="p-0">
      <Table minWidth={860}>
        <THead><tr><Th>Document ID</Th><Th>Document</Th><Th>Version</Th><Th>Date</Th><Th>Signed or issued by</Th><Th>Status</Th></tr></THead>
        <tbody>
          {docs.map((d) => (
            <Tr key={d.id}>
              <Td><Mono>{d.id}</Mono></Td>
              <Td className="font-medium text-ink">{d.name}</Td>
              <Td className="tnum">{d.version}</Td>
              <Td className="tnum whitespace-nowrap">{fmtDate(d.date)}</Td>
              <Td>{d.by}</Td>
              <Td><Badge tone={d.status === 'Not eligible' ? 'neutral' : 'ok'} dot>{d.status}</Badge></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  )
}
