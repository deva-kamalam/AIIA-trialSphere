import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { FlaskConical, Users, Megaphone, Building2, ListChecks, HeartPulse, AlertTriangle, AlertOctagon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ROLES } from '@/auth/permissions'
import { Drawer, Kpi, PageHeader, Skeleton } from '@/components/ui'
import { TODAY } from '@/data/seed'
import { cx, fmtNum, pct, relDue } from '@/lib/format'
import type { PortfolioStage } from '@/types'
import { useDashboardData } from './dashboard/useDashboardData'
import { PortfolioPanel, RecruitmentPanel, TrialHealthTable } from './dashboard/Overview'
import { RoleFocus } from './dashboard/RoleFocus'

export default function Dashboard() {
  const { user, can } = useAuth()
  const { data, derived, loading } = useDashboardData()
  const [stage, setStage] = useState<PortfolioStage | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const navigate = useNavigate()

  if (!user) return null
  const role = user.role
  const focusFirst = role === 'coordinator' || role === 'pv' || role === 'ethics' || role === 'data_manager'

  if (loading || !data || !derived) {
    return (
      <div>
        <PageHeader title="Clinical Research Overview" subtitle="Monitor ongoing studies, recruitment, compliance, safety and data quality." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[92px]" />)}</div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2"><Skeleton className="h-[380px]" /><Skeleton className="h-[380px]" /></div>
      </div>
    )
  }

  const critActions = derived.actions.filter((a) => a.tone === 'crit').length
  const openSerious = data.aes.filter((a) => a.serious && a.reviewStatus !== 'Resolved').length
  const go = (to: string, perm?: Parameters<typeof can>[0]) => (!perm || can(perm) ? () => navigate(to) : undefined)

  const charts = (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
      <PortfolioPanel studies={data.studies} selected={stage} onSelect={(s) => { setStage(s); if (s) document.getElementById('trial-health')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
      <RecruitmentPanel months={derived.months} enrolled={derived.enrolled} target={derived.target} />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Clinical Research Overview"
        subtitle="Monitor ongoing studies, recruitment, compliance, safety and data quality."
        actions={
          <div className="text-left text-[13px] text-muted xl:text-right">
            <div>Viewing as <span className="font-medium text-ink">{ROLES[role].label}</span></div>
            <div>Data as of {format(TODAY, 'd MMM yyyy')}</div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Active studies" value={derived.active.length} icon={FlaskConical} hint={`${data.studies.length} in portfolio`} onClick={go('/studies', 'studies:view')} />
        <Kpi label="Participants" value={fmtNum(derived.enrolled)} icon={Users} delta={`+${fmtNum(derived.last30)}`} deltaTone="ok" hint="enrolled in last 30 days" onClick={go('/participants', 'participants:view')} />
        <Kpi label="Recruiting studies" value={derived.recruiting} icon={Megaphone} hint={`${pct(derived.enrolled, derived.target)}% of target enrolled`} onClick={go('/studies', 'studies:view')} />
        <Kpi label="Active sites" value={derived.activeSites} icon={Building2} hint={`${data.sites.length - derived.activeSites} awaiting activation`} onClick={go('/sites', 'sites:view')} />
        <Kpi label="Pending actions" value={derived.actions.length} icon={ListChecks} tone={critActions ? 'crit' : 'warn'} delta={`${critActions} critical`} deltaTone="crit" hint="Open list" onClick={() => setActionsOpen(true)} />
        <Kpi label="Safety events" value={data.aes.length} icon={HeartPulse} tone={openSerious ? 'crit' : undefined} delta={`${derived.serious} serious`} deltaTone="crit" hint={`${derived.underReview} under review`} onClick={go('/safety', 'safety:view')} />
      </div>

      <div className="mt-4 space-y-4">
        {focusFirst ? (
          <>
            <RoleFocus role={role} d={data} user={user} />
            {charts}
          </>
        ) : (
          <>
            {charts}
            <RoleFocus role={role} d={data} user={user} />
          </>
        )}
        <div id="trial-health" className="scroll-mt-20">
          <TrialHealthTable studies={data.studies} sites={data.sites} stage={stage} onClearStage={() => setStage(null)} />
        </div>
      </div>

      <Drawer open={actionsOpen} onClose={() => setActionsOpen(false)} title={`Pending actions (${derived.actions.length})`}>
        <p className="border-b border-line px-5 py-3 text-[13px] text-muted">
          Overdue safety reports, regulatory items due within 30 days and expiring documents across active studies.
        </p>
        <ul>
          {derived.actions.map((a) => (
            <li key={a.id} className="border-b border-line">
              <Link to={a.link} onClick={() => setActionsOpen(false)} className="flex gap-3 px-5 py-3 hover:bg-canvas">
                {a.tone === 'crit' ? <AlertOctagon className="mt-0.5 size-4 shrink-0 text-crit" aria-label="Critical" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Attention" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] text-ink">{a.title}</span>
                  <span className="block truncate text-[12.5px] text-muted">{a.detail}</span>
                </span>
                {a.due && <span className={cx('shrink-0 text-xs', a.tone === 'crit' ? 'text-crit' : 'text-warn')}>{relDue(a.due)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Drawer>
    </div>
  )
}
