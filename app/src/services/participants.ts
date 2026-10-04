import { request } from './api'
import { PARTICIPANTS, scheduleFor, TODAY } from '@/data/seed'
import type { Participant, Visit } from '@/types'
import { addDays, subDays } from 'date-fns'
import { recordAudit } from './audit'
import { addedParticipants, visitOverrides } from './store'

const withOverrides = (v: Visit): Visit => ({ ...v, ...visitOverrides.get(v.id) })

export interface ScreenInput {
  studyId: string
  siteId: string
  age: number
  sex: 'F' | 'M'
  screeningDate: string
}

export const participantService = {
  list: () => request((): Participant[] => PARTICIPANTS),
  get: (id: string) => request(() => PARTICIPANTS.find((p) => p.id === id) ?? null),
  schedule: (id: string) =>
    request((): Visit[] => {
      const p = PARTICIPANTS.find((x) => x.id === id)
      return p ? scheduleFor(p).map(withOverrides) : []
    }),
  /** Register a newly screened participant with the next pseudonymised ID for the study. */
  screen: (input: ScreenInput) =>
    request((): Participant => {
      const code = input.studyId.replace('-', '')
      const n = PARTICIPANTS.filter((p) => p.studyId === input.studyId).length + 1
      const p: Participant = {
        id: `AIIA-${code}-${String(n).padStart(4, '0')}`,
        studyId: input.studyId,
        siteId: input.siteId,
        screeningDate: input.screeningDate,
        age: input.age,
        sex: input.sex,
        currentVisit: 'Screening',
        status: 'Screening',
        lastVisit: input.screeningDate,
        prakriti: 'Not assessed',
      }
      PARTICIPANTS.push(p)
      addedParticipants.push(p)
      recordAudit('Screened participant', 'Participant', p.id, undefined, 'Screening')
      return p
    }),
}

/** Visits whose scheduled date falls within [today - back, today + ahead]. */
function visitsInWindow(back: number, ahead: number): Visit[] {
  const from = subDays(TODAY, back).getTime()
  const to = addDays(TODAY, ahead).getTime()
  const out: Visit[] = []
  for (const p of PARTICIPANTS) {
    if (p.status === 'Screen Failure' || p.status === 'Completed') continue
    for (const raw of scheduleFor(p)) {
      const v = withOverrides(raw)
      const t = new Date(v.scheduledDate).getTime()
      if (t >= from && t <= to) out.push(v)
    }
  }
  return out.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
}

export const visitService = {
  window: (back = 21, ahead = 42) => request(() => visitsInWindow(back, ahead)),
  markCompleted: (visit: Visit, actualDate: string) =>
    request(() => {
      visitOverrides.set(visit.id, { ...visitOverrides.get(visit.id), status: 'Completed', actualDate })
      recordAudit('Marked visit completed', 'Visit', `${visit.participantId}, ${visit.visit}`, visit.status, 'Completed')
      return { ...visit, status: 'Completed' as const, actualDate }
    }),
  reschedule: (visit: Visit, date: string) =>
    request(() => {
      visitOverrides.set(visit.id, { ...visitOverrides.get(visit.id), scheduledDate: date, status: 'Upcoming' })
      recordAudit('Rescheduled visit', 'Visit', `${visit.participantId}, ${visit.visit}`, visit.scheduledDate, date)
      return { ...visit, scheduledDate: date, status: 'Upcoming' as const }
    }),
}
