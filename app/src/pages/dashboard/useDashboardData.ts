import { useMemo } from 'react'
import { addMonths, format, parseISO, startOfMonth, subDays } from 'date-fns'
import { useAsync } from '@/lib/hooks'
import { participantService, safetyService, studyService, siteService, visitService, documentService, UNDER_REVIEW, isOverdue } from '@/services'
import { TODAY } from '@/data/seed'
import { daysFromToday } from '@/lib/format'
import type { AdverseEvent, Participant, Site, Study, StudyCompliance, StudyDocument, Visit } from '@/types'

export interface PendingAction {
  id: string
  tone: 'crit' | 'warn'
  title: string
  detail: string
  link: string
  due?: string
}

export interface DashboardData {
  studies: Study[]
  participants: Participant[]
  aes: AdverseEvent[]
  sites: Site[]
  visits: Visit[]
  compliance: StudyCompliance[]
  documents: StudyDocument[]
}

const isActiveStage = (s: Study) => s.stage === 'Ethics Review' || s.stage === 'Recruiting' || s.stage === 'Active / Follow-up'
export const isRunning = (s: Study) => s.stage === 'Recruiting' || s.stage === 'Active / Follow-up'

export function useDashboardData() {
  const { data, loading } = useAsync<DashboardData>(async () => {
    const [studies, participants, aes, sites, visits, compliance, documents] = await Promise.all([
      studyService.list(), participantService.list(), safetyService.list(), siteService.list(),
      visitService.window(30, 30), studyService.allCompliance(), documentService.list(),
    ])
    return { studies, participants, aes, sites, visits, compliance, documents }
  })

  const derived = useMemo(() => {
    if (!data) return null
    const { studies, participants, aes, sites, visits, compliance, documents } = data
    const active = studies.filter(isActiveStage)
    const running = studies.filter(isRunning)
    const runningIds = new Set(running.map((s) => s.id))
    const enrolled = running.reduce((a, s) => a + s.enrolled, 0)
    const target = running.reduce((a, s) => a + s.target, 0)
    const enrolledParticipants = participants.filter((p) => p.enrollmentDate && runningIds.has(p.studyId))
    const last30 = enrolledParticipants.filter((p) => daysFromToday(p.enrollmentDate!) >= -30).length
    const prev30 = enrolledParticipants.filter((p) => { const d = daysFromToday(p.enrollmentDate!); return d < -30 && d >= -60 }).length

    // Cumulative recruitment by month vs a linear target pace to the portfolio target.
    const months: { month: string; key: string; enrolled: number; target: number | null; projected?: number }[] = []
    const first = startOfMonth(subDays(TODAY, 540))
    const planEnd = addMonths(startOfMonth(TODAY), 8)
    const totalSpan = planEnd.getTime() - first.getTime()
    const byMonth = new Map<string, number>()
    for (const p of enrolledParticipants) {
      const k = p.enrollmentDate!.slice(0, 7)
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1)
    }
    const before = enrolledParticipants.filter((p) => parseISO(p.enrollmentDate!) < first).length
    let cum = before
    for (let m = first; m <= planEnd; m = addMonths(m, 1)) {
      const key = format(m, 'yyyy-MM')
      const past = m <= TODAY
      if (past) cum += byMonth.get(key) ?? 0
      months.push({
        month: format(m, 'MMM yy'),
        key,
        enrolled: past ? cum : NaN,
        target: Math.round(target * ((m.getTime() - first.getTime() + 30 * 86400000) / (totalSpan + 30 * 86400000))),
      })
    }

    const underReview = aes.filter((a) => UNDER_REVIEW.includes(a.reviewStatus)).length
    const serious = aes.filter((a) => a.serious).length
    const overdueAes = aes.filter(isOverdue)

    // Pending actions: things with an owner and a deadline across the portfolio.
    const actions: PendingAction[] = []
    for (const a of aes) {
      if (a.reviewStatus === 'Resolved') continue
      if (isOverdue(a)) actions.push({ id: a.id, tone: 'crit', title: `${a.serious ? 'SAE' : 'AE'} report overdue: ${a.event}`, detail: `${a.id}, ${a.studyId}`, link: `/safety?event=${a.id}`, due: a.dueDate })
      else if (a.reviewStatus === 'New') actions.push({ id: a.id, tone: 'warn', title: `New adverse event awaiting medical review`, detail: `${a.id}, ${a.event}, ${a.studyId}`, link: `/safety?event=${a.id}`, due: a.dueDate })
    }
    for (const c of compliance) {
      const s = studies.find((x) => x.id === c.studyId)
      if (!s || !isActiveStage(s)) continue
      for (const i of c.items) {
        if (i.state === 'crit') actions.push({ id: `${c.studyId}-${i.key}`, tone: 'crit', title: `${i.label}: ${i.detail}`, detail: c.studyId, link: '/ethics', due: i.dueDate })
        else if (i.state === 'warn' && i.dueDate && daysFromToday(i.dueDate) <= 30) actions.push({ id: `${c.studyId}-${i.key}`, tone: 'warn', title: `${i.label} due soon`, detail: `${c.studyId}, ${i.detail}`, link: '/ethics', due: i.dueDate })
      }
    }
    for (const d of documents) {
      if (d.expiryDate && d.status !== 'Expired' && daysFromToday(d.expiryDate) <= 30 && daysFromToday(d.expiryDate) >= 0) {
        actions.push({ id: d.id, tone: 'warn', title: `Document expires soon: ${d.category}`, detail: d.name, link: `/documents?q=${encodeURIComponent(d.name)}`, due: d.expiryDate })
      }
    }
    actions.sort((a, b) => (a.tone === b.tone ? (a.due ?? '9').localeCompare(b.due ?? '9') : a.tone === 'crit' ? -1 : 1))

    const overdueVisits = visits.filter((v) => v.status === 'Overdue')

    return {
      active, running, enrolled, target, last30, prev30, months, underReview, serious, overdueAes,
      actions, overdueVisits,
      activeSites: sites.filter((s) => s.status === 'Active').length,
      recruiting: studies.filter((s) => s.stage === 'Recruiting').length,
    }
  }, [data])

  return { data, derived, loading }
}
