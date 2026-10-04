import { request } from './api'
import { DOCUMENTS, TODAY } from '@/data/seed'
import type { DocCategory, StudyDocument } from '@/types'
import { format } from 'date-fns'
import { recordAudit } from './audit'
import { getSessionUser } from '@/auth/session'

export interface UploadInput {
  fileName: string
  studyId: string
  category: DocCategory
  version: string
  expiryDate?: string
  sizeKb: number
  note: string
  /** When set, the upload becomes a new version of this document. */
  replacesId?: string
}

export const documentService = {
  list: () => request((): StudyDocument[] => DOCUMENTS),
  upload: (input: UploadInput) =>
    request(() => {
      const user = getSessionUser()?.name ?? 'Unknown'
      const today = format(TODAY, 'yyyy-MM-dd')
      const entry = { version: input.version, uploadedBy: user, uploadedOn: today, status: 'Under Review' as const, note: input.note || 'New version' }
      const existing = input.replacesId ? DOCUMENTS.find((d) => d.id === input.replacesId) : undefined
      if (existing) {
        const prevVersion = existing.version
        existing.history.forEach((h) => { if (h.status !== 'Expired') h.status = 'Superseded' })
        existing.history.unshift(entry)
        Object.assign(existing, {
          name: input.fileName, version: input.version, uploadedBy: user, uploadedOn: today,
          status: 'Under Review', expiryDate: input.expiryDate ?? existing.expiryDate, sizeKb: input.sizeKb,
        })
        recordAudit('Uploaded new document version', 'Document', input.fileName, `v${prevVersion}`, `v${input.version}`)
        return existing
      }
      const doc: StudyDocument = {
        id: `DOC-${String(DOCUMENTS.length + 1).padStart(4, '0')}`,
        name: input.fileName, studyId: input.studyId, category: input.category, version: input.version,
        uploadedBy: user, uploadedOn: today, status: 'Under Review', expiryDate: input.expiryDate, sizeKb: input.sizeKb,
        history: [entry],
      }
      DOCUMENTS.unshift(doc)
      recordAudit('Uploaded document', 'Document', input.fileName, undefined, `v${input.version}`)
      return doc
    }),
}
