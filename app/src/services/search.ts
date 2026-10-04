import { request } from './api'
import { ADVERSE_EVENTS, DOCUMENTS, PARTICIPANTS, SITES, STUDIES, scheduleFor } from '@/data/seed'
import type { SearchResult } from '@/types'

const PER_KIND = 5

export const searchService = {
  query: (raw: string) =>
    request((): SearchResult[] => {
      const q = raw.trim().toLowerCase()
      if (q.length < 2) return []
      const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(q))
      const out: SearchResult[] = []

      const studies = STUDIES.filter((s) => has(s.id, s.title, s.shortTitle, s.department))
      out.push(...studies.slice(0, PER_KIND).map((s) => ({
        kind: 'Study' as const, id: s.id, title: `${s.id} — ${s.title}`, subtitle: `${s.pi}, ${s.stage}`, link: `/studies/${s.id}`,
      })))

      // A study code also surfaces its participants: IDs embed the code without the hyphen.
      const compact = q.replace('-', '')
      const parts = PARTICIPANTS.filter((p) => p.id.toLowerCase().includes(q) || p.id.toLowerCase().includes(compact))
      out.push(...parts.slice(0, PER_KIND).map((p) => ({
        kind: 'Participant' as const, id: p.id, title: p.id, subtitle: `${p.studyId}, ${p.status}, ${p.currentVisit}`, link: `/participants/${p.id}`,
      })))

      const sites = SITES.filter((s) => has(s.id, s.name, s.city, s.state))
      out.push(...sites.slice(0, PER_KIND).map((s) => ({
        kind: 'Site' as const, id: s.id, title: `${s.name}, ${s.city}`, subtitle: `${s.status}, ${s.participants} participants`, link: `/sites?site=${s.id}`,
      })))

      const investigators = Array.from(new Set(STUDIES.map((s) => s.pi))).filter((n) => has(n))
      out.push(...investigators.slice(0, PER_KIND).map((n) => ({
        kind: 'Investigator' as const, id: n, title: n,
        subtitle: `Principal Investigator on ${STUDIES.filter((s) => s.pi === n).length} studies`,
        link: `/studies?pi=${encodeURIComponent(n)}`,
      })))

      const docs = DOCUMENTS.filter((d) => has(d.name, d.studyId, d.category))
      out.push(...docs.slice(0, PER_KIND).map((d) => ({
        kind: 'Document' as const, id: d.id, title: d.name, subtitle: `${d.category}, v${d.version}, ${d.status}`, link: `/documents?q=${encodeURIComponent(d.name)}`,
      })))

      const aes = ADVERSE_EVENTS.filter((a) => has(a.id, a.event, a.studyId, a.participantId)).reverse()
      out.push(...aes.slice(0, PER_KIND).map((a) => ({
        kind: 'Safety Event' as const, id: a.id, title: `${a.id} — ${a.event}`, subtitle: `${a.studyId}, ${a.severity}, ${a.reviewStatus}`, link: `/safety?event=${a.id}`,
      })))

      const visits = parts.slice(0, 3).flatMap((p) => scheduleFor(p).filter((v) => v.status !== 'Completed').slice(0, 2))
      out.push(...visits.slice(0, PER_KIND).map((v) => ({
        kind: 'Visit' as const, id: v.id, title: `${v.participantId} — ${v.visit}`, subtitle: `${v.status}, scheduled ${v.scheduledDate}`, link: `/visits?q=${v.participantId}`,
      })))
      return out
    }),
}
