// Browser persistence for the demo. Mutations made through services are saved to
// localStorage and restored on reload, so the demo behaves like a real system across
// refreshes. A real backend replaces this file entirely.
//
// Seed dates are generated relative to today, so a saved snapshot is only valid for the
// day it was written; on a new day the demo starts fresh from the seed.
import { format } from 'date-fns'
import {
  ADVERSE_EVENTS, AUDIT_EVENTS, COMPLIANCE, DOCUMENTS, NOTIFICATIONS, PARTICIPANTS, SITES, STUDIES, TODAY,
} from '@/data/seed'
import type { AdverseEvent, AppNotification, AuditEvent, Participant, StudyCompliance, StudyDocument, Study, Visit } from '@/types'

const KEY = 'aiia.demo-store.v1'
const DAY = format(TODAY, 'yyyy-MM-dd')

/** eCRF form data keyed by `${participantId}|${visitName}`. */
export interface EcrfQueryMsg { author: string; role: string; at: string; text: string }
export interface EcrfQuery { id: string; field: string; status: 'Open' | 'Closed'; messages: EcrfQueryMsg[] }
export interface EcrfRecord {
  participantId: string
  visit: string
  values: Record<string, string>
  state: 'Draft' | 'Complete' | 'Signed'
  savedAt: string
  savedBy: string
  signedBy?: string
  signedAt?: string
  queries: EcrfQuery[]
}

interface Snapshot {
  day: string
  studies: Study[]
  aes: AdverseEvent[]
  docs: StudyDocument[]
  compliance: StudyCompliance[]
  audit: AuditEvent[]
  notifications: AppNotification[]
  addedParticipants: Participant[]
  visitOverrides: [string, Partial<Visit>][]
  ecrf: [string, EcrfRecord][]
}

export const visitOverrides = new Map<string, Partial<Visit>>()
export const ecrfRecords = new Map<string, EcrfRecord>()
export const addedParticipants: Participant[] = []

function replace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

function hydrate() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const s = JSON.parse(raw) as Snapshot
    if (s.day !== DAY) {
      localStorage.removeItem(KEY)
      return
    }
    replace(STUDIES, s.studies)
    replace(ADVERSE_EVENTS, s.aes)
    replace(DOCUMENTS, s.docs)
    replace(COMPLIANCE, s.compliance)
    replace(AUDIT_EVENTS, s.audit)
    replace(NOTIFICATIONS, s.notifications)
    for (const p of s.addedParticipants) {
      addedParticipants.push(p)
      PARTICIPANTS.push(p)
    }
    s.visitOverrides.forEach(([k, v]) => visitOverrides.set(k, v))
    s.ecrf.forEach(([k, v]) => ecrfRecords.set(k, v))
    for (const site of SITES) site.participants = PARTICIPANTS.filter((p) => p.siteId === site.id && p.enrollmentDate).length
  } catch {
    // Corrupt or unavailable storage: fall back to the seed.
  }
}
hydrate()

let timer: ReturnType<typeof setTimeout> | undefined

/** Schedule a save of all mutable collections. Called after every mutation. */
export function commit() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const snap: Snapshot = {
      day: DAY,
      studies: STUDIES, aes: ADVERSE_EVENTS, docs: DOCUMENTS, compliance: COMPLIANCE,
      audit: AUDIT_EVENTS, notifications: NOTIFICATIONS, addedParticipants,
      visitOverrides: [...visitOverrides], ecrf: [...ecrfRecords],
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(snap))
    } catch {
      // Storage full or blocked: changes stay in memory for this session.
    }
  }, 250)
}

export function hasSavedChanges() {
  try { return localStorage.getItem(KEY) !== null } catch { return false }
}

/** Discard saved demo changes and reload from the seed. */
export function resetDemoData() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  window.location.reload()
}
