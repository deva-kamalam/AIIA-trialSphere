import { request } from './api'
import { recordAudit } from './audit'
import { ecrfRecords, type EcrfRecord } from './store'

export type { EcrfRecord, EcrfQuery, EcrfQueryMsg } from './store'

const key = (participantId: string, visit: string) => `${participantId}|${visit}`

export const ecrfService = {
  /** Saved form data, or null when the form has never been saved in this demo. */
  get: (participantId: string, visit: string) => request(() => ecrfRecords.get(key(participantId, visit)) ?? null),

  /**
   * Save form data. `baseline` is what the form showed before any save in this demo
   * (the pre-filled values), so the first save still records field-level changes.
   */
  save: (rec: EcrfRecord, baseline: Record<string, string> = {}, labelOf: (field: string) => string = (f) => f) =>
    request(() => {
      const prev = ecrfRecords.get(key(rec.participantId, rec.visit))
      const before = prev?.values ?? baseline
      ecrfRecords.set(key(rec.participantId, rec.visit), rec)
      const target = `${rec.participantId}, ${rec.visit}`
      // Each changed field with its previous and new value.
      const changed = Object.keys(rec.values).filter((k) => (before[k] ?? '') !== (rec.values[k] ?? ''))
      for (const k of changed.slice(0, 8)) recordAudit('Updated eCRF field', 'eCRF', `${target}, ${labelOf(k)}`, before[k] || '(empty)', rec.values[k] || '(empty)')
      const prevState = prev?.state ?? 'Draft'
      if (prevState !== rec.state) {
        const action = rec.state === 'Signed' ? 'Signed eCRF' : rec.state === 'Complete' ? 'Marked eCRF complete' : 'Reopened eCRF'
        recordAudit(action, 'eCRF', target, prevState, rec.state)
      } else if (changed.length === 0) {
        recordAudit('Saved eCRF draft', 'eCRF', target)
      }
      return rec
    }),

  respondQuery: (participantId: string, visit: string, rec: EcrfRecord, queryId: string) =>
    request(() => {
      ecrfRecords.set(key(participantId, visit), rec)
      recordAudit('Answered data query', 'eCRF', `${participantId}, ${visit}, ${queryId}`, 'Open', 'Closed')
      return rec
    }),
}
