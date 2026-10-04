import { request } from './api'
import { COMPLIANCE, STUDIES, SITES } from '@/data/seed'
import type { Study, StudyCompliance, Site, ComplianceItem, IecDecisionRecord } from '@/types'
import { recordAudit } from './audit'

export const studyService = {
  list: () => request(() => STUDIES),
  get: (id: string) => request(() => STUDIES.find((s) => s.id === id) ?? null),
  create: (input: Omit<Study, 'id'>) =>
    request(() => {
      const id = `AYU-${String(STUDIES.length + 1).padStart(3, '0')}`
      const study: Study = { ...input, id }
      STUDIES.push(study)
      COMPLIANCE.push({
        studyId: id,
        items: [],
        timeline: [
          { label: 'Protocol drafted', state: 'pending' },
          { label: 'IEC submission', state: 'upcoming' },
          { label: 'CTRI registration', state: 'upcoming' },
        ],
      })
      recordAudit('Created study', 'Study', id, undefined, input.title)
      return study
    }),
  compliance: (id: string) => request(() => COMPLIANCE.find((c) => c.studyId === id) ?? null),
  allCompliance: () => request((): StudyCompliance[] => COMPLIANCE),
  setApplicability: (studyId: string, key: ComplianceItem['key'], applicable: boolean) =>
    request(() => {
      const c = COMPLIANCE.find((x) => x.studyId === studyId)
      const item = c?.items.find((i) => i.key === key)
      if (item) {
        item.applicable = applicable
        item.state = applicable ? 'warn' : 'na'
        item.detail = applicable ? 'Marked applicable — evidence required' : 'Not applicable (configured per study)'
        recordAudit('Changed regulatory applicability', 'Compliance', `${studyId}, ${item.label}`,
          applicable ? 'Not applicable' : 'Applicable', applicable ? 'Applicable' : 'Not applicable')
      }
      return c ?? null
    }),
  /** Record an Institutional Ethics Committee decision on a pending timeline milestone. */
  recordIecDecision: (studyId: string, milestoneIdx: number, rec: IecDecisionRecord) =>
    request(() => {
      const c = COMPLIANCE.find((x) => x.studyId === studyId)
      const m = c?.timeline[milestoneIdx]
      if (!c || !m) return null
      const prev = m.state
      m.decision = rec
      if (rec.decision === 'Queries raised') {
        m.state = 'pending'
        m.note = 'Queries raised, response awaited from study team'
      } else {
        m.state = 'done'
        m.date = rec.date
        m.note = rec.decision === 'Approved' ? 'Approved by IEC' : 'Approved with modifications'
        // An approved amendment or approval clears the matching requirement.
        const key = m.label.startsWith('Amendment') ? 'amendments' : m.label.startsWith('IEC') ? 'ethics' : null
        const item = key ? c.items.find((i) => i.key === key) : undefined
        if (item && item.applicable) {
          item.state = 'ok'
          item.detail = key === 'amendments' ? `${m.label} approved ${rec.date}` : `Approved ${rec.date}`
        }
      }
      recordAudit('Recorded IEC decision', 'Compliance', `${studyId}, ${m.label}`, prev, rec.decision)
      return c
    }),
}

export const siteService = {
  list: () => request((): Site[] => SITES),
  get: (id: string) => request(() => SITES.find((s) => s.id === id) ?? null),
}
