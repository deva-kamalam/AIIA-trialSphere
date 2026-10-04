import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, FileText, ShieldCheck, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addMonths, endOfMonth, format, isAfter, parseISO, startOfMonth } from 'date-fns'
import { Badge, EmptyState, HealthDot, MeterCell, Mono, Panel, Progress, StatusBadge } from '@/components/ui/primitives'
import type { Tone } from '@/components/ui/primitives'
import { Table, Td, Th, THead, Tr } from '@/components/ui/data'
import { C, axisProps, gridProps } from '@/components/charts/palette'
import { ChartTooltip, Legend } from '@/components/charts/theme'
import { cx, daysFromToday, fmtDate, fmtNum, relDue } from '@/lib/format'
import { TODAY } from '@/data/seed'
import type { AdverseEvent, Participant, ParticipantStatus, Site, Study, StudyCompliance, StudyDocument } from '@/types'

const dueTone = (d: string): Tone => { const n = daysFromToday(d); return n < 0 ? 'crit' : n <= 30 ? 'warn' : 'neutral' }

// ---------- Overview ----------
export function OverviewTab({ study, participants, compliance }: { study: Study; participants: Participant[]; compliance: StudyCompliance | null }) {
  const series = useMemo(() => {
    const start = parseISO(study.startDate)
    const end = parseISO(study.expectedCompletion)
    if (isAfter(start, TODAY)) return []
    const dates = participants.filter((p) => p.enrollmentDate).map((p) => p.enrollmentDate!).sort()
    const span = Math.max(1, end.getTime() - start.getTime())
    const out: { month: string; enrolled: number; pace: number; added: number }[] = []
    let i = 0
    for (let m = startOfMonth(start); !isAfter(m, TODAY); m = addMonths(m, 1)) {
      const monthEnd = endOfMonth(m)
      const cutoff = format(isAfter(monthEnd, TODAY) ? TODAY : monthEnd, 'yyyy-MM-dd')
      const before = i
      while (i < dates.length && dates[i] <= cutoff) i++
      const frac = Math.min(1, Math.max(0, (Math.min(monthEnd.getTime(), TODAY.getTime()) - start.getTime()) / span))
      out.push({ month: format(m, 'MMM yy'), enrolled: i, added: i - before, pace: Math.round(study.target * frac) })
    }
    return out
  }, [study, participants])

  const statusCounts = useMemo(() => {
    const order: ParticipantStatus[] = ['Screening', 'Enrolled', 'Active', 'Completed', 'Withdrawn', 'Screen Failure']
    const total = participants.length
    return order.map((s) => {
      const n = participants.filter((p) => p.status === s).length
      return { status: s, n, share: total ? (n / total) * 100 : 0 }
    })
  }, [participants])

  const deadlines = useMemo(() => {
    if (!compliance) return []
    const items = compliance.items
      .filter((i) => i.applicable && i.dueDate)
      .map((i) => ({ label: i.label, detail: i.detail, date: i.dueDate! }))
    const milestones = compliance.timeline
      .filter((t) => t.date && (t.state === 'pending' || t.state === 'overdue'))
      .map((t) => ({ label: t.label, detail: t.note ?? 'Pending', date: t.date! }))
    return [...items, ...milestones].filter((d) => daysFromToday(d.date) <= 120).sort((a, b) => a.date.localeCompare(b.date))
  }, [compliance])

  const last = series[series.length - 1]
  const statusTone: Record<ParticipantStatus, Tone> = { Screening: 'info', Enrolled: 'info', Active: 'ok', Completed: 'ink', Withdrawn: 'neutral', 'Screen Failure': 'neutral' }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel
        className="xl:col-span-2"
        title="Recruitment by month"
        subtitle={last ? `${fmtNum(last.enrolled)} enrolled against a planned pace of ${fmtNum(last.pace)} to date` : 'Cumulative enrolment against the planned pace'}
        actions={series.length ? <Legend items={[{ label: 'Enrolled (cumulative)', color: C.ink }, { label: 'Target pace', color: C.amber, dashed: true }]} /> : undefined}
      >
        {series.length && last.enrolled > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="enrolFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.ink} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={C.ink} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...axisProps} width={52} tickFormatter={(v: number) => fmtNum(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="enrolled" name="Enrolled" stroke={C.ink} strokeWidth={2} fill="url(#enrolFill)" />
                <Line type="linear" dataKey="pace" name="Target pace" stroke={C.amber} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={Users} title="Recruitment has not started" body="Enrolment will be charted here once the first participant is enrolled." />
        )}
      </Panel>

      <Panel title="Participant status" subtitle={`${fmtNum(participants.length)} screened or enrolled`}>
        {participants.length ? (
          <ul className="space-y-3">
            {statusCounts.map((s) => (
              <li key={s.status}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-ink">{s.status}</span>
                  <span className="tnum text-muted"><span className="font-medium text-ink">{fmtNum(s.n)}</span> ({s.share.toFixed(1)}%)</span>
                </div>
                <Progress value={s.share} tone={statusTone[s.status]} label={s.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No participants yet" />
        )}
      </Panel>

      <Panel className="xl:col-span-3" title="Upcoming deadlines" subtitle="Regulatory and reporting dates in the next 120 days, configured for this study">
        {deadlines.length ? (
          <ul className="divide-y divide-line">
            {deadlines.map((d, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <CalendarClock className="size-4 text-faint" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{d.label}</div>
                  <div className="text-xs text-muted">{d.detail}</div>
                </div>
                <span className="tnum text-[13px] text-muted">{fmtDate(d.date)}</span>
                <Badge tone={dueTone(d.date)}>{relDue(d.date)}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarClock} title="No deadlines in the next 120 days" />
        )}
      </Panel>
    </div>
  )
}

// ---------- Sites ----------
export function SitesTab({ sites, participants }: { sites: Site[]; participants: Participant[] }) {
  if (!sites.length) return <Panel><EmptyState title="No sites assigned" /></Panel>
  return (
    <Panel bodyClass="p-0" title="Study sites" subtitle={`${sites.length} ${sites.length === 1 ? 'site' : 'sites'} assigned to this study`}>
      <Table minWidth={860}>
        <THead>
          <tr><Th>Site ID</Th><Th>Site</Th><Th>Site investigator</Th><Th>Status</Th><Th>Enrolled in study</Th><Th>Visit completion</Th><Th>Data quality</Th><Th /></tr>
        </THead>
        <tbody>
          {sites.map((s) => {
            const n = participants.filter((p) => p.siteId === s.id && p.enrollmentDate).length
            return (
              <Tr key={s.id}>
                <Td><Mono>{s.id}</Mono></Td>
                <Td><div className="font-medium text-ink">{s.name}</div><div className="text-xs text-muted">{s.city}, {s.state}</div></Td>
                <Td className="text-ink-3">{s.investigator}</Td>
                <Td><StatusBadge status={s.status} /></Td>
                <Td className="tnum">{fmtNum(n)}</Td>
                <Td>{s.status === 'Active' ? <MeterCell value={s.visitCompletion} /> : <span className="text-faint">—</span>}</Td>
                <Td>{s.status === 'Active' ? <MeterCell value={s.dataQuality} /> : <span className="text-faint">—</span>}</Td>
                <Td className="text-right"><Link to={`/sites?site=${s.id}`} className="text-[13px] font-medium text-info hover:underline">Site details</Link></Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </Panel>
  )
}

// ---------- Participants ----------
export function ParticipantsTab({ study, participants, sites }: { study: Study; participants: Participant[]; sites: Site[] }) {
  const siteName = new Map(sites.map((s) => [s.id, s.name]))
  const first = participants.slice(0, 20)
  return (
    <Panel
      bodyClass="p-0"
      title="Participants"
      subtitle={`Showing ${first.length} of ${fmtNum(participants.length)}. Identifiers are anonymised.`}
      actions={participants.length > 0 && <Link to={`/participants?study=${study.id}`} className="text-[13px] font-medium text-info hover:underline">View all {fmtNum(participants.length)} participants</Link>}
    >
      {first.length ? (
        <Table minWidth={820}>
          <THead>
            <tr><Th>Participant ID</Th><Th>Site</Th><Th>Status</Th><Th>Current visit</Th><Th>Enrolled on</Th><Th>Next visit</Th></tr>
          </THead>
          <tbody>
            {first.map((p) => (
              <Tr key={p.id}>
                <Td><Link to={`/participants/${p.id}`} className="text-info hover:underline"><Mono>{p.id}</Mono></Link></Td>
                <Td className="text-ink-3">{siteName.get(p.siteId) ?? p.siteId}</Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td>{p.currentVisit}</Td>
                <Td className="tnum">{fmtDate(p.enrollmentDate)}</Td>
                <Td className="tnum">
                  {p.nextVisit ? <span className={cx(daysFromToday(p.nextVisit) < 0 && 'text-crit')}>{fmtDate(p.nextVisit)}</span> : <span className="text-faint">—</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={Users} title="No participants yet" body="Participants appear here after screening begins." />
      )}
    </Panel>
  )
}

// ---------- Safety ----------
export function SafetyTab({ aes }: { aes: AdverseEvent[] }) {
  const rows = [...aes].sort((a, b) => b.reportedDate.localeCompare(a.reportedDate))
  const open = rows.filter((a) => a.reviewStatus !== 'Resolved').length
  const serious = rows.filter((a) => a.serious).length
  return (
    <Panel
      bodyClass="p-0"
      title="Adverse events"
      subtitle={`${rows.length} reported, ${open} in review, ${serious} serious`}
      actions={<Link to="/safety" className="text-[13px] font-medium text-info hover:underline">Open safety module</Link>}
    >
      {rows.length ? (
        <Table minWidth={980}>
          <THead>
            <tr><Th>Event ID</Th><Th>Participant</Th><Th>Event</Th><Th>Severity</Th><Th>Seriousness</Th><Th>Causality</Th><Th>Review status</Th><Th>Due</Th></tr>
          </THead>
          <tbody>
            {rows.map((a) => {
              const resolved = a.reviewStatus === 'Resolved'
              return (
                <Tr key={a.id}>
                  <Td><Link to={`/safety?event=${a.id}`} className="text-info hover:underline"><Mono>{a.id}</Mono></Link></Td>
                  <Td><Mono className="text-ink-3">{a.participantId}</Mono></Td>
                  <Td className="text-ink">{a.event}</Td>
                  <Td><Badge tone={a.severity === 'Severe' ? 'crit' : a.severity === 'Moderate' ? 'warn' : 'neutral'}>{a.severity}</Badge></Td>
                  <Td>{a.serious ? <Badge tone="crit">Serious</Badge> : <span className="text-muted">Non-serious</span>}</Td>
                  <Td className="text-ink-3">{a.causality}</Td>
                  <Td><StatusBadge status={a.reviewStatus} /></Td>
                  <Td className="whitespace-nowrap">{resolved ? <span className="text-faint">—</span> : <Badge tone={dueTone(a.dueDate)}>{relDue(a.dueDate)}</Badge>}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={ShieldCheck} title="No adverse events reported" />
      )}
    </Panel>
  )
}

// ---------- Compliance ----------
export function ComplianceTab({ compliance }: { compliance: StudyCompliance | null }) {
  if (!compliance) return <Panel><EmptyState title="Compliance profile not configured" /></Panel>
  const stateLabel = { ok: 'Complete', warn: 'Attention', crit: 'Action required', na: 'Not applicable' } as const
  const dot = { done: 'bg-ok', pending: 'bg-warn', overdue: 'bg-crit', upcoming: 'bg-line-2' } as const
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel className="xl:col-span-2" bodyClass="p-0" title="Regulatory requirements" subtitle="Applicability is configured per study by the regulatory team, never assumed.">
        {compliance.items.length ? (
          <Table minWidth={720}>
            <THead><tr><Th>Requirement</Th><Th>Applicability</Th><Th>State</Th><Th>Detail</Th><Th>Due</Th></tr></THead>
            <tbody>
              {compliance.items.map((i) => (
                <Tr key={i.key} className={cx(!i.applicable && 'text-faint')}>
                  <Td className={cx('font-medium', i.applicable ? 'text-ink' : 'text-faint')}>{i.label}</Td>
                  <Td>{i.applicable ? 'Applicable' : 'Not applicable'}</Td>
                  <Td><span className="inline-flex items-center gap-2 whitespace-nowrap"><HealthDot level={i.state} />{stateLabel[i.state]}</span></Td>
                  <Td className="text-ink-3">{i.detail}</Td>
                  <Td className="whitespace-nowrap">{i.dueDate ? <Badge tone={dueTone(i.dueDate)}>{relDue(i.dueDate)}</Badge> : <span className="text-faint">—</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Requirements not configured yet" body="Configure applicable ethics, CTRI and regulatory requirements in the Ethics and regulatory module." />
        )}
      </Panel>
      <Panel title="Compliance timeline">
        <ol className="relative">
          {compliance.timeline.map((t, idx) => (
            <li key={idx} className="relative flex gap-3 pb-4 last:pb-0">
              {idx < compliance.timeline.length - 1 && <span className="absolute top-3 left-[5px] h-full w-px bg-line" aria-hidden />}
              <span className={cx('relative mt-1 size-[11px] shrink-0 rounded-full ring-2 ring-white', dot[t.state])} aria-hidden />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{t.label}</div>
                <div className="text-xs text-muted">
                  {t.date ? fmtDate(t.date) : 'Not scheduled'}
                  {t.note && <span className={cx('ml-1', t.state === 'overdue' ? 'text-crit' : t.state === 'pending' ? 'text-warn' : '')}>({t.note})</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}

// ---------- Documents ----------
export function DocumentsTab({ study, docs }: { study: Study; docs: StudyDocument[] }) {
  return (
    <Panel
      bodyClass="p-0"
      title="Study documents"
      subtitle={`${docs.length} controlled ${docs.length === 1 ? 'document' : 'documents'}`}
      actions={<Link to={`/documents?q=${study.id}`} className="text-[13px] font-medium text-info hover:underline">Open in document management</Link>}
    >
      {docs.length ? (
        <Table minWidth={860}>
          <THead><tr><Th>Document</Th><Th>Category</Th><Th>Version</Th><Th>Status</Th><Th>Uploaded</Th><Th>Expiry</Th></tr></THead>
          <tbody>
            {docs.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <Link to={`/documents?q=${encodeURIComponent(d.name)}`} className="flex items-center gap-2 text-ink hover:text-info">
                    <FileText className="size-4 shrink-0 text-faint" aria-hidden />
                    <span className="truncate">{d.name}</span>
                  </Link>
                  <div className="pl-6"><Mono className="text-faint">{d.id}</Mono></div>
                </Td>
                <Td className="text-ink-3">{d.category}</Td>
                <Td className="tnum">v{d.version}</Td>
                <Td><StatusBadge status={d.status} /></Td>
                <Td className="whitespace-nowrap"><div className="tnum">{fmtDate(d.uploadedOn)}</div><div className="text-xs text-muted">{d.uploadedBy}</div></Td>
                <Td className="whitespace-nowrap">
                  {d.expiryDate ? <span className={cx('tnum', daysFromToday(d.expiryDate) < 0 ? 'text-crit' : daysFromToday(d.expiryDate) <= 30 ? 'text-warn' : '')}>{fmtDate(d.expiryDate)}</span> : <span className="text-faint">—</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={FileText} title="No documents uploaded" body="Protocol, ethics approval and consent documents will appear here once uploaded." />
      )}
    </Panel>
  )
}
