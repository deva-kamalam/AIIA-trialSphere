import { request } from './api'
import { ADVERSE_EVENTS, STUDIES, TODAY } from '@/data/seed'
import type { AdverseEvent, AEReviewStatus } from '@/types'
import { AE_WORKFLOW } from '@/types'
import { addDays, format } from 'date-fns'
import { recordAudit } from './audit'

export const UNDER_REVIEW: AEReviewStatus[] = ['Medical Review', 'Seriousness Assessment', 'Causality Assessment']

export const isOverdue = (ae: AdverseEvent) => ae.reviewStatus !== 'Resolved' && new Date(ae.dueDate) < TODAY
export const needsAction = (ae: AdverseEvent) => ae.reviewStatus !== 'Resolved'

export type NewAdverseEvent = Omit<AdverseEvent, 'id' | 'reportedDate' | 'reviewStatus' | 'dueDate'>

export const safetyService = {
  list: () => request((): AdverseEvent[] => ADVERSE_EVENTS),
  create: (input: NewAdverseEvent) =>
    request(() => {
      const num = 9 + ADVERSE_EVENTS.length
      const ae: AdverseEvent = {
        ...input,
        id: `AE-${String(num).padStart(5, '0')}`,
        reportedDate: format(TODAY, 'yyyy-MM-dd'),
        reviewStatus: 'New',
        dueDate: format(addDays(TODAY, input.serious ? 1 : 14), 'yyyy-MM-dd'),
      }
      ADVERSE_EVENTS.push(ae)
      const s = STUDIES.find((x) => x.id === ae.studyId)
      if (s) s.adverseEvents++
      recordAudit('Reported adverse event', 'Adverse Event', ae.id, undefined, `${ae.event} (${ae.severity}${ae.serious ? ', serious' : ''})`)
      return ae
    }),
  advance: (id: string) =>
    request(() => {
      const ae = ADVERSE_EVENTS.find((a) => a.id === id)
      if (!ae) return null
      const idx = AE_WORKFLOW.indexOf(ae.reviewStatus)
      if (idx < AE_WORKFLOW.length - 1) {
        const prev = ae.reviewStatus
        ae.reviewStatus = AE_WORKFLOW[idx + 1]
        if (ae.reviewStatus === 'Resolved') ae.outcome = 'Recovered'
        recordAudit('Advanced safety review', 'Adverse Event', id, prev, ae.reviewStatus)
      }
      return ae
    }),
}
