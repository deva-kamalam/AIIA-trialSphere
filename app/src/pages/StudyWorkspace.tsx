import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, AlertTriangle, Building2, CalendarCheck, Check, ChevronLeft, ClipboardList, FileQuestion, FlaskConical, Target, Users } from 'lucide-react'
import { Badge, Button, EmptyState, HealthDot, Kpi, Mono, Panel, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { toneFor } from '@/components/ui/tone'
import { Tabs } from '@/components/ui/data'
import { useAsync } from '@/lib/hooks'
import { cx, fmtDate, fmtNum, pct } from '@/lib/format'
import { documentService, participantService, safetyService, siteService, studyService } from '@/services'
import { LIFECYCLE } from '@/types'
import type { Study } from '@/types'
import { LEVEL_LABEL, SIGNALS, explainSignal, rollup } from './studies/health'
import type { SignalExtras } from './studies/health'
import { ComplianceTab, DocumentsTab, OverviewTab, ParticipantsTab, SafetyTab, SitesTab } from './studies/WorkspaceTabs'

type TabId = 'overview' | 'sites' | 'participants' | 'safety' | 'compliance' | 'documents'

export default function StudyWorkspace() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState<TabId>('overview')
  const navigate = useNavigate()
  const { data, loading } = useAsync(
    () => Promise.all([
      studyService.get(id), studyService.compliance(id), siteService.list(),
      participantService.list(), safetyService.list(), documentService.list(),
    ]),
    [id],
  )

  const view = useMemo(() => {
    if (!data || !data[0]) return null
    const [study, compliance, allSites, allParticipants, allAes, allDocs] = data
    return {
      study,
      compliance,
      sites: allSites.filter((s) => study.siteIds.includes(s.id)),
      participants: allParticipants.filter((p) => p.studyId === study.id),
      aes: allAes.filter((a) => a.studyId === study.id),
      docs: allDocs.filter((d) => d.studyId === study.id),
    }
  }, [data])

  if (loading) return <WorkspaceSkeleton />
  if (!view) {
    return (
      <div>
        <BackLink />
        <Panel>
          <EmptyState
            icon={FileQuestion}
            title={`Study ${id} was not found`}
            body="The study may have been removed, or the link is incorrect. Check the study ID and try again."
            action={<Button variant="primary" onClick={() => navigate('/studies')}>Back to studies</Button>}
          />
        </Panel>
      </div>
    )
  }

  const { study, compliance, sites, participants, aes, docs } = view
  const extras: SignalExtras = { compliance, aes, docs }
  const activeSites = sites.filter((s) => s.status === 'Active').length
  const openAes = aes.filter((a) => a.reviewStatus !== 'Resolved').length

  return (
    <div>
      <BackLink />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Mono className="rounded bg-ink px-1.5 py-0.5 text-white">{study.id}</Mono>
            <StatusBadge status={study.status} />
            <Badge>{study.stage}</Badge>
          </div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">{study.title}</h1>
          <p className="mt-1 max-w-[80ch] text-sm text-muted">{study.primaryObjective}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={Users} onClick={() => navigate(`/participants?study=${study.id}`)}>Participants</Button>
          <Button icon={ClipboardList} onClick={() => navigate(`/documents?q=${study.id}`)}>Documents</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Study details">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13.5px] sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="Principal investigator" value={<Link to={`/studies?pi=${encodeURIComponent(study.pi)}`} className="hover:text-info hover:underline">{study.pi}</Link>} />
            <Meta label="Study coordinator" value={study.coordinator} />
            <Meta label="Department" value={study.department} />
            <Meta label="Study type" value={study.type} />
            <Meta label="Study phase" value={study.phase} />
            <Meta label="Number of sites" value={`${sites.length} (${activeSites} active)`} />
            <Meta label="Start date" value={fmtDate(study.startDate)} />
            <Meta label="Expected completion" value={fmtDate(study.expectedCompletion)} />
            <Meta label="CTRI number" value={study.ctriNumber ? <Mono>{study.ctriNumber}</Mono> : <span className="text-warn">Registration pending</span>} />
            <Meta label="Intervention" value={study.intervention} wide />
            <Meta label="Comparator" value={study.comparator} />
          </dl>
        </Panel>
        <TrialHealth study={study} extras={extras} />
      </div>

      <Panel className="mt-4" title="Study lifecycle" subtitle={`Currently at ${study.lifecycle}`} bodyClass="p-0">
        <Lifecycle current={study.lifecycle} />
      </Panel>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Participants enrolled" value={fmtNum(study.enrolled)} icon={Users} hint={`${pct(study.enrolled, study.target)}% of target`} />
        <Kpi label="Target" value={fmtNum(study.target)} icon={Target} hint={`${fmtNum(Math.max(0, study.target - study.enrolled))} remaining`} />
        <Kpi label="Active sites" value={fmtNum(activeSites)} icon={Building2} hint={`of ${sites.length} assigned`} />
        <Kpi label="Completed visits" value={fmtNum(study.completedVisits)} icon={CalendarCheck} />
        <Kpi label="Protocol deviations" value={fmtNum(study.deviations)} icon={AlertTriangle} tone={study.health.deviations === 'ok' ? undefined : study.health.deviations} hint={study.deviations ? 'Open' : undefined} />
        <Kpi label="Open data queries" value={fmtNum(study.openQueries)} icon={Activity} tone={study.openQueries > 20 ? 'warn' : undefined} />
        <Kpi label="Adverse events" value={fmtNum(study.adverseEvents)} icon={FlaskConical} hint={openAes ? `${openAes} in review` : 'None in review'} tone={study.health.safetyReporting === 'ok' ? undefined : study.health.safetyReporting} />
      </div>

      <Tabs<TabId>
        className="mt-6 mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'sites', label: 'Sites', count: sites.length },
          { id: 'participants', label: 'Participants', count: participants.length },
          { id: 'safety', label: 'Safety', count: aes.length },
          { id: 'compliance', label: 'Compliance' },
          { id: 'documents', label: 'Documents', count: docs.length },
        ]}
      />
      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab study={study} participants={participants} compliance={compliance} />}
        {tab === 'sites' && <SitesTab sites={sites} participants={participants} />}
        {tab === 'participants' && <ParticipantsTab study={study} participants={participants} sites={sites} />}
        {tab === 'safety' && <SafetyTab aes={aes} />}
        {tab === 'compliance' && <ComplianceTab compliance={compliance} />}
        {tab === 'documents' && <DocumentsTab study={study} docs={docs} />}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <Link to="/studies" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />Clinical Studies
      </Link>
    </nav>
  )
}

function Meta({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={cx('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  )
}

function TrialHealth({ study, extras }: { study: Study; extras: SignalExtras }) {
  const overall = rollup(study)
  const tone = toneFor(overall)
  return (
    <Panel
      title="Trial health"
      actions={<Badge tone={tone} dot>{overall}</Badge>}
      bodyClass="p-0"
    >
      <ul className="divide-y divide-line">
        {SIGNALS.map((s) => {
          const level = study.health[s.key]
          return (
            <li key={s.key} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-1.5"><HealthDot level={level} label={LEVEL_LABEL[level]} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{s.label}</span>
                  <span className={cx('text-xs font-medium', level === 'ok' ? 'text-ok' : level === 'warn' ? 'text-warn' : 'text-crit')}>{LEVEL_LABEL[level]}</span>
                </div>
                <div className="text-[13px] text-muted">{explainSignal(study, s.key, extras)}</div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="border-t border-line bg-canvas/60 px-4 py-2.5">
        <p className="text-sm text-ink">Trial health: <span className="font-semibold">{overall}</span></p>
        <p className="mt-0.5 text-xs text-muted">An operational indicator based on measurable signals, not a clinical judgement.</p>
      </div>
    </Panel>
  )
}

function Lifecycle({ current }: { current: Study['lifecycle'] }) {
  const idx = LIFECYCLE.indexOf(current)
  const allDone = current === 'Completed'
  return (
    <div className="scroll-thin overflow-x-auto px-4 py-5">
      <ol className="flex min-w-[860px] items-start">
        {LIFECYCLE.map((step, i) => {
          const done = i < idx || allDone
          const isCurrent = i === idx && !allDone
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center text-center" aria-current={isCurrent ? 'step' : undefined}>
              {i > 0 && (
                <span className={cx('absolute top-[15px] right-1/2 h-0.5 w-full', i <= idx || allDone ? 'bg-ok' : 'bg-line')} aria-hidden />
              )}
              <span
                className={cx(
                  'relative z-10 flex size-8 items-center justify-center rounded-full text-[13px] font-semibold',
                  done && 'bg-ok text-white',
                  isCurrent && 'bg-ink text-white ring-4 ring-ink/15',
                  !done && !isCurrent && 'border border-line-2 bg-white text-faint',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cx('mt-2 px-1 text-[13px] leading-tight', isCurrent ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-faint')}>{step}</span>
              {isCurrent && <span className="mt-1 rounded bg-ink/[0.06] px-1.5 py-0.5 text-[11.5px] font-medium text-ink">Current stage</span>}
              {done && <span className="sr-only">Completed</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function WorkspaceSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-2 h-5 w-48" />
      <Skeleton className="mb-6 h-7 w-[28rem] max-w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-56 xl:col-span-2" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="mt-4 h-28" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    </div>
  )
}
