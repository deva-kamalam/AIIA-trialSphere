import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, startOfMonth, subMonths } from 'date-fns'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Badge, Mono, Panel, Progress, StatusBadge } from '@/components/ui'
import { C, axisProps, gridProps } from '@/components/charts/palette'
import { ChartTooltip } from '@/components/charts/theme'
import { cx, daysFromToday, fmtNum, fmtShort, pct, relDue } from '@/lib/format'
import { UNDER_REVIEW, isOverdue } from '@/services'
import { TODAY } from '@/data/seed'
import type { RoleId, User } from '@/types'
import type { DashboardData } from './useDashboardData'
import { isRunning } from './useDashboardData'

// ---------- small building blocks ----------
function Stat({ label, value, tone, to, sub }: { label: string; value: ReactNode; tone?: 'crit' | 'warn' | 'ok'; to?: string; sub?: string }) {
  const body = (
    <>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cx('tnum mt-0.5 text-[22px] leading-tight font-semibold', tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : 'text-ink')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </>
  )
  return to ? (
    <Link to={to} className="group relative block rounded-md border border-line px-3 py-2.5 hover:border-ink-3">
      {body}
      <ArrowUpRight className="absolute top-2.5 right-2.5 size-3.5 text-faint opacity-0 group-hover:opacity-100" aria-hidden />
    </Link>
  ) : (
    <div className="rounded-md border border-line px-3 py-2.5">{body}</div>
  )
}

function ListRow({ left, right, tone, to }: { left: ReactNode; right: ReactNode; tone?: 'crit' | 'warn'; to?: string }) {
  const cls = cx('flex items-center justify-between gap-3 border-b border-line py-2 text-[13.5px] last:border-0', tone === 'crit' && 'text-crit')
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {tone && <AlertTriangle className={cx('size-3.5 shrink-0', tone === 'crit' ? 'text-crit' : 'text-warn')} aria-hidden />}
        <span className="min-w-0 truncate">{left}</span>
      </span>
      <span className="shrink-0 text-[12.5px] text-muted">{right}</span>
    </>
  )
  return to ? <Link to={to} className={cx(cls, 'hover:bg-canvas')}>{inner}</Link> : <div className={cls}>{inner}</div>
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

const more = (to: string, label = 'View all') => <Link to={to} className="text-[12.5px] font-medium text-info hover:underline">{label}</Link>

// ---------- role views ----------
function PiFocus({ d, user }: { d: DashboardData; user: User }) {
  const mine = d.studies.filter((s) => s.pi === user.name && s.stage !== 'Completed')
  const ids = new Set(mine.map((s) => s.id))
  const parts = d.participants.filter((p) => ids.has(p.studyId))
  const by = (st: string) => parts.filter((p) => p.status === st).length
  const enrolled = mine.reduce((a, s) => a + s.enrolled, 0)
  const target = mine.reduce((a, s) => a + s.target, 0)
  const upcoming = d.visits.filter((v) => ids.has(v.studyId) && v.status === 'Upcoming' && daysFromToday(v.scheduledDate) >= 0 && daysFromToday(v.scheduledDate) <= 7)
  const myAes = d.aes.filter((a) => ids.has(a.studyId))
  const openAes = myAes.filter((a) => a.reviewStatus !== 'Resolved')
  const deviations = mine.reduce((a, s) => a + s.deviations, 0)
  const dq = mine.length ? Math.round(mine.filter((s) => s.dataQuality).reduce((a, s) => a + s.dataQuality, 0) / Math.max(1, mine.filter((s) => s.dataQuality).length)) : 0
  return (
    <Panel title="Your studies" subtitle={`${mine.length} active studies where you are Principal Investigator`}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Recruitment">
          <div className="tnum text-[22px] font-semibold text-ink">{fmtNum(enrolled)} <span className="text-sm font-normal text-muted">of {fmtNum(target)}</span></div>
          <Progress value={pct(enrolled, target)} tone="ok" className="mt-2" label="Recruitment" />
          <div className="mt-3 space-y-0">
            {mine.slice(0, 4).map((s) => <ListRow key={s.id} to={`/studies/${s.id}`} left={<><Mono>{s.id}</Mono> <span className="text-muted">{s.shortTitle}</span></>} right={`${pct(s.enrolled, s.target)}%`} />)}
          </div>
        </Section>
        <Section title="Participant status" action={more('/participants?study=AYU-001')}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Active" value={fmtNum(by('Active'))} />
            <Stat label="Enrolled" value={fmtNum(by('Enrolled'))} />
            <Stat label="Screening" value={fmtNum(by('Screening'))} />
            <Stat label="Withdrawn" value={fmtNum(by('Withdrawn'))} tone={by('Withdrawn') > 30 ? 'warn' : undefined} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Deviations" value={deviations} tone={deviations > 10 ? 'warn' : undefined} />
            <Stat label="Safety events" value={openAes.length} sub="open" tone={openAes.some((a) => a.serious) ? 'crit' : undefined} to="/safety" />
            <Stat label="Data quality" value={`${dq}%`} tone={dq < 90 ? 'warn' : 'ok'} />
          </div>
        </Section>
        <Section title="Upcoming visits, next 7 days" action={more('/visits')}>
          <div className="tnum mb-1 text-[22px] font-semibold text-ink">{upcoming.length}</div>
          {upcoming.slice(0, 6).map((v) => (
            <ListRow key={v.id} to={`/participants/${v.participantId}`} left={<><Mono>{v.participantId}</Mono> <span className="text-muted">{v.visit}</span></>} right={fmtShort(v.scheduledDate)} />
          ))}
        </Section>
      </div>
    </Panel>
  )
}

function CoordinatorFocus({ d, user }: { d: DashboardData; user: User }) {
  const mineStudies = new Set(d.studies.filter((s) => s.coordinator === user.name).map((s) => s.id))
  const vs = d.visits.filter((v) => mineStudies.has(v.studyId))
  const today = vs.filter((v) => daysFromToday(v.scheduledDate) === 0)
  const overdue = vs.filter((v) => v.status === 'Overdue')
  const missed = vs.filter((v) => v.status === 'Missed')
  const recentDone = vs.filter((v) => v.status === 'Completed' && daysFromToday(v.actualDate ?? v.scheduledDate) >= -10)
  const pendingEcrf = Math.round(recentDone.length * 0.35)
  const queries = d.studies.filter((s) => mineStudies.has(s.id)).reduce((a, s) => a + s.openQueries, 0)
  return (
    <Panel title="Today's work" subtitle={`${format(TODAY, 'EEEE d MMMM')}. Visits and data tasks for your assigned studies.`}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Today's visits" value={today.length} to="/visits" />
        <Stat label="Pending eCRFs" value={pendingEcrf} tone={pendingEcrf > 20 ? 'warn' : undefined} to="/ecrf" />
        <Stat label="Overdue visits" value={overdue.length} tone={overdue.length ? 'crit' : undefined} to="/visits?status=Overdue" />
        <Stat label="Missed visits" value={missed.length} tone={missed.length ? 'warn' : undefined} to="/visits?status=Missed" />
        <Stat label="Open queries" value={queries} tone={queries > 20 ? 'warn' : undefined} to="/ecrf" />
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <Section title="Today's visits" action={more('/visits')}>
          {today.length === 0 && <p className="py-4 text-sm text-muted">No visits scheduled today.</p>}
          {today.slice(0, 7).map((v) => (
            <ListRow key={v.id} to={`/participants/${v.participantId}`} left={<><Mono>{v.participantId}</Mono> <span className="text-muted">{v.visit}</span></>} right={<StatusBadge status={v.status} />} />
          ))}
        </Section>
        <Section title="Participant follow-ups" action={more('/visits?status=Overdue')}>
          {overdue.length === 0 && <p className="py-4 text-sm text-muted">No overdue follow-ups.</p>}
          {overdue.slice(0, 7).map((v) => (
            <ListRow key={v.id} tone="crit" to={`/visits?q=${v.participantId}`} left={<><Mono>{v.participantId}</Mono> <span>{v.visit}</span></>} right={relDue(v.scheduledDate)} />
          ))}
        </Section>
      </div>
    </Panel>
  )
}

function EthicsFocus({ d }: { d: DashboardData }) {
  const pending = d.studies.filter((s) => s.stage === 'Ethics Review')
  const amendments = d.compliance.flatMap((c) => c.timeline.filter((t) => t.label.startsWith('Amendment') && t.state === 'pending').map((t) => ({ ...t, studyId: c.studyId })))
  const saes = d.aes.filter((a) => a.serious && a.reviewStatus !== 'Resolved')
  const deadlines = d.compliance
    .flatMap((c) => c.items.filter((i) => (i.key === 'ethics' || i.key === 'periodicReports') && i.dueDate && i.applicable).map((i) => ({ ...i, studyId: c.studyId })))
    .filter((i) => daysFromToday(i.dueDate!) <= 60)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const consent = d.compliance.filter((c) => d.studies.find((s) => s.id === c.studyId && isRunning(s))).slice(0, 5)
  return (
    <Panel title="Committee review queue" subtitle="Submissions, amendments and safety events awaiting the Institutional Ethics Committee.">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Pending studies" value={pending.length} to="/ethics" />
        <Stat label="Protocol amendments" value={amendments.length} tone={amendments.length ? 'warn' : undefined} to="/ethics" />
        <Stat label="SAEs requiring review" value={saes.length} tone={saes.length ? 'crit' : undefined} to="/safety" />
        <Stat label="Approval deadlines, 60 days" value={deadlines.length} tone={deadlines.some((x) => daysFromToday(x.dueDate!) < 0) ? 'crit' : 'warn'} to="/ethics" />
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <Section title="Pending studies and amendments">
          {pending.slice(0, 4).map((s) => <ListRow key={s.id} to={`/studies/${s.id}`} left={<><Mono>{s.id}</Mono> <span className="text-muted">{s.shortTitle}</span></>} right="Initial review" />)}
          {amendments.slice(0, 4).map((a) => <ListRow key={a.studyId + a.label} tone="warn" to="/ethics" left={<><Mono>{a.studyId}</Mono> {a.label}</>} right={a.note ?? 'Pending'} />)}
        </Section>
        <Section title="SAEs requiring review" action={more('/safety')}>
          {saes.map((a) => <ListRow key={a.id} tone="crit" to={`/safety?event=${a.id}`} left={<><Mono>{a.id}</Mono> {a.event}</>} right={a.studyId} />)}
          {saes.length === 0 && <p className="py-4 text-sm text-muted">No open serious adverse events.</p>}
        </Section>
        <Section title="Approval deadlines">
          {deadlines.slice(0, 6).map((i) => <ListRow key={i.studyId + i.key} tone={daysFromToday(i.dueDate!) < 0 ? 'crit' : daysFromToday(i.dueDate!) <= 14 ? 'warn' : undefined} to="/ethics" left={<><Mono>{i.studyId}</Mono> {i.label}</>} right={relDue(i.dueDate)} />)}
        </Section>
      </div>
      <div className="mt-5">
        <Section title="Current consent versions">
          <div className="flex flex-wrap gap-2">
            {consent.map((c) => <Badge key={c.studyId} tone="neutral"><Mono>{c.studyId}</Mono> {c.items.find((i) => i.key === 'consent')?.detail}</Badge>)}
          </div>
        </Section>
      </div>
    </Panel>
  )
}

function PvFocus({ d }: { d: DashboardData }) {
  const open = d.aes.filter((a) => a.reviewStatus !== 'Resolved')
  const nw = d.aes.filter((a) => a.reviewStatus === 'New')
  const saes = d.aes.filter((a) => a.serious)
  const causality = d.aes.filter((a) => a.reviewStatus === 'Causality Assessment')
  const reviews = d.aes.filter((a) => UNDER_REVIEW.includes(a.reviewStatus))
  const deadlines = [...open].sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || Number(b.serious) - Number(a.serious) || a.dueDate.localeCompare(b.dueDate))
  return (
    <Panel title="Safety queue" subtitle="Adverse events that need assessment or reporting.">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="New AEs" value={nw.length} tone={nw.length ? 'warn' : undefined} to="/safety" />
        <Stat label="SAEs" value={saes.length} sub={`${saes.filter((a) => a.reviewStatus !== 'Resolved').length} open`} tone="crit" to="/safety" />
        <Stat label="Causality assessments" value={causality.length} to="/safety" />
        <Stat label="Pending reviews" value={reviews.length} to="/safety" />
        <Stat label="Overdue reports" value={open.filter(isOverdue).length} tone="crit" to="/safety" />
      </div>
      <div className="mt-5">
        <Section title="Reporting deadlines" action={more('/safety')}>
          <div className="grid gap-x-8 lg:grid-cols-2">
            {deadlines.slice(0, 10).map((a) => (
              <ListRow key={a.id} tone={isOverdue(a) ? 'crit' : a.serious ? 'warn' : undefined} to={`/safety?event=${a.id}`}
                left={<><Mono>{a.id}</Mono> {a.event} <span className="text-muted">({a.reviewStatus})</span></>} right={isOverdue(a) ? relDue(a.dueDate) : `due ${fmtShort(a.dueDate)}`} />
            ))}
          </div>
        </Section>
      </div>
    </Panel>
  )
}

function ManagementFocus({ d }: { d: DashboardData }) {
  const active = d.sites.filter((s) => s.status === 'Active').sort((a, b) => b.participants - a.participants).slice(0, 8)
  const running = d.studies.filter(isRunning)
  const avgCompliance = Math.round(running.reduce((a, s) => a + s.compliance, 0) / running.length)
  const attention = d.studies.filter((s) => s.status === 'Critical' || s.status === 'Attention Required')
  const months = Array.from({ length: 9 }, (_, i) => startOfMonth(subMonths(TODAY, 8 - i)))
  const trend = months.map((m) => {
    const key = format(m, 'yyyy-MM')
    const list = d.aes.filter((a) => a.reportedDate.startsWith(key))
    return { month: format(m, 'MMM'), 'Non-serious': list.filter((a) => !a.serious).length, Serious: list.filter((a) => a.serious).length }
  })
  return (
    <Panel title="Institutional view" subtitle="Aggregated across departments and sites. No participant-level data is shown here.">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Total studies" value={d.studies.length} to="/studies" />
        <Stat label="Studies needing attention" value={attention.length} tone="warn" to="/studies" />
        <Stat label="Average compliance" value={`${avgCompliance}%`} tone={avgCompliance < 90 ? 'warn' : 'ok'} to="/ethics" />
        <Stat label="Completed studies" value={d.studies.filter((s) => s.stage === 'Completed').length} />
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <Section title="Site performance" action={more('/sites')}>
          {active.map((s) => (
            <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_120px_48px] items-center gap-3 border-b border-line py-1.5 text-[13px] last:border-0">
              <span className="truncate text-ink">{s.city} <span className="text-faint">{s.name}</span></span>
              <Progress value={s.visitCompletion} tone={s.visitCompletion < 88 ? 'warn' : 'ok'} label={`${s.city} visit completion`} />
              <span className="tnum text-right text-muted">{s.visitCompletion}%</span>
            </div>
          ))}
          <p className="mt-1.5 text-xs text-faint">Visit completion rate, sites ordered by participants.</p>
        </Section>
        <Section title="Safety trends" action={more('/analytics')}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f7fa' }} />
                <Bar dataKey="Non-serious" stackId="a" fill={C.sky} isAnimationActive={false} />
                <Bar dataKey="Serious" stackId="a" fill={C.red} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </Panel>
  )
}

function DataManagerFocus({ d }: { d: DashboardData }) {
  const running = d.studies.filter(isRunning)
  const queries = running.reduce((a, s) => a + s.openQueries, 0)
  const low = [...running].sort((a, b) => a.dataQuality - b.dataQuality).slice(0, 6)
  const missing = d.visits.filter((v) => v.status === 'Missed').length
  return (
    <Panel title="Data quality" subtitle="Queries, missing data and completeness across running studies.">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Open queries" value={queries} tone="warn" to="/ecrf" />
        <Stat label="Missed visits, 30 days" value={missing} tone={missing ? 'warn' : undefined} to="/visits?status=Missed" />
        <Stat label="Average completeness" value={`${Math.round(running.reduce((a, s) => a + s.dataQuality, 0) / running.length)}%`} />
        <Stat label="Studies below 90%" value={running.filter((s) => s.dataQuality < 90).length} tone="warn" />
      </div>
      <div className="mt-5">
        <Section title="Lowest completeness">
          {low.map((s) => <ListRow key={s.id} tone={s.dataQuality < 82 ? 'crit' : s.dataQuality < 92 ? 'warn' : undefined} to={`/studies/${s.id}`} left={<><Mono>{s.id}</Mono> {s.shortTitle}</>} right={`${s.dataQuality}%, ${s.openQueries} queries`} />)}
        </Section>
      </div>
    </Panel>
  )
}

export function RoleFocus({ role, d, user }: { role: RoleId; d: DashboardData; user: User }) {
  switch (role) {
    case 'pi': return <PiFocus d={d} user={user} />
    case 'coordinator': return <CoordinatorFocus d={d} user={user} />
    case 'ethics': return <EthicsFocus d={d} />
    case 'pv': return <PvFocus d={d} />
    case 'management': return <ManagementFocus d={d} />
    case 'data_manager': return <DataManagerFocus d={d} />
  }
}
