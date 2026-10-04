import type { AdverseEvent, HealthLevel, HealthSignals, Study, StudyCompliance, StudyDocument } from '@/types'
import { daysFromToday, fmtNum, pct } from '@/lib/format'
import type { Tone } from '@/components/ui/primitives'

export const SIGNALS: { key: keyof HealthSignals; label: string }[] = [
  { key: 'recruitment', label: 'Recruitment' },
  { key: 'dataCompletion', label: 'Data completion' },
  { key: 'deviations', label: 'Protocol deviations' },
  { key: 'safetyReporting', label: 'Safety reporting' },
  { key: 'regulatory', label: 'Regulatory compliance' },
  { key: 'documents', label: 'Documentation' },
]

export const LEVEL_LABEL: Record<HealthLevel, string> = { ok: 'On track', warn: 'Attention', crit: 'Critical' }
export const LEVEL_TONE: Record<HealthLevel, Tone> = { ok: 'ok', warn: 'warn', crit: 'crit' }

export interface SignalExtras {
  compliance?: StudyCompliance | null
  aes?: AdverseEvent[]
  docs?: StudyDocument[]
}

const plural = (n: number, one: string, many = `${one}s`) => `${fmtNum(n)} ${n === 1 ? one : many}`

/** Short, measurable explanation for each operational signal, derived from the study record. */
export function explainSignal(study: Study, key: keyof HealthSignals, extras: SignalExtras = {}): string {
  const level = study.health[key]
  const notStarted = study.stage === 'Planning' || study.stage === 'Ethics Review'
  switch (key) {
    case 'recruitment': {
      if (notStarted) return 'Recruitment not started'
      const p = pct(study.enrolled, study.target)
      return `${p}% of target (${fmtNum(study.enrolled)} of ${fmtNum(study.target)})`
    }
    case 'dataCompletion':
      return notStarted ? 'No data collected yet' : `${study.dataQuality}% complete`
    case 'deviations':
      return study.deviations === 0 ? 'No open deviations' : `${plural(study.deviations, 'open deviation')}`
    case 'safetyReporting': {
      if (extras.aes) {
        const overdue = extras.aes.filter((a) => a.reviewStatus !== 'Resolved' && daysFromToday(a.dueDate) < 0).length
        if (overdue) return `${plural(overdue, 'overdue report')}`
        const open = extras.aes.filter((a) => a.reviewStatus !== 'Resolved').length
        return open ? `No overdue reports, ${open} in review` : 'No overdue reports'
      }
      return level === 'crit' ? 'Overdue safety report' : level === 'warn' ? 'Report due shortly' : 'No overdue reports'
    }
    case 'regulatory': {
      if (extras.compliance) {
        const items = extras.compliance.items.filter((i) => i.applicable && i.dueDate)
        const overdue = items.filter((i) => daysFromToday(i.dueDate!) < 0).length
        const upcoming = items.filter((i) => { const d = daysFromToday(i.dueDate!); return d >= 0 && d <= 60 }).length
        if (overdue) return `${plural(overdue, 'overdue obligation')}`
        if (upcoming) return `${plural(upcoming, 'upcoming deadline')}`
        return 'No deadlines in the next 60 days'
      }
      return level === 'crit' ? 'Obligation overdue' : level === 'warn' ? 'Upcoming deadlines' : 'All obligations current'
    }
    case 'documents': {
      if (extras.docs && extras.docs.length) {
        const expired = extras.docs.filter((d) => d.status === 'Expired').length
        const pending = extras.docs.filter((d) => d.status === 'Draft' || d.status === 'Under Review').length
        if (expired) return `${plural(expired, 'expired document')}${pending ? `, ${pending} pending` : ''}`
        if (pending) return `${plural(pending, 'document')} pending approval`
        return 'All required documents current'
      }
      return level === 'crit' ? 'Missing documents' : level === 'warn' ? 'Documents pending approval' : 'All required documents current'
    }
  }
}

/** Overall roll-up uses the same rules as the study status, so the two never disagree. */
export const rollup = (study: Study): string => study.status

export const recruitPct = (s: Study) => (s.target ? Math.round((s.enrolled / s.target) * 100) : 0)
