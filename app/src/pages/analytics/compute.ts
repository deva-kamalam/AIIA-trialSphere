import {
  addMonths, differenceInCalendarMonths, endOfMonth, format, parseISO, startOfMonth, subDays, subMonths,
} from 'date-fns'
import type { AdverseEvent, Participant, PortfolioStage, Site, Study } from '@/types'
import { PORTFOLIO_STAGES } from '@/types'
import { TODAY } from '@/data/seed'

export type RangeId = '3' | '6' | '12' | 'all'
export const RANGES: { value: RangeId; label: string }[] = [
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

export interface Filters {
  study: string
  department: string
  site: string
  range: RangeId
  type: string
}

export const EMPTY_FILTERS: Filters = { study: '', department: '', site: '', range: '12', type: '' }

export interface Source {
  studies: Study[]
  participants: Participant[]
  sites: Site[]
  aes: AdverseEvent[]
}

const MAX_MONTHS = 48
const t = (d: string) => parseISO(d).getTime()
const round1 = (n: number) => Math.round(n * 10) / 10

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null
  return Math.round(((curr - prev) / prev) * 100)
}

export function changePhrase(noun: string, curr: number, prev: number, period = 'the previous quarter') {
  const c = pctChange(curr, prev)
  if (c === null) return `${noun} picked up from none in ${period}`
  if (c === 0) return `${noun} flat on ${period}`
  return `${noun} ${c > 0 ? 'up' : 'down'} ${Math.abs(c)}% on ${period}`
}

export function compute(src: Source, f: Filters) {
  // ---- window ----
  const attrStudies = src.studies.filter((s) =>
    (!f.study || s.id === f.study) &&
    (!f.department || s.department === f.department) &&
    (!f.type || s.type === f.type) &&
    (!f.site || s.siteIds.includes(f.site)),
  )
  const attrIds = new Set(attrStudies.map((s) => s.id))
  const scopedParticipantsAll = src.participants.filter((p) => attrIds.has(p.studyId) && (!f.site || p.siteId === f.site))

  let months: number
  if (f.range === 'all') {
    const dates = scopedParticipantsAll.map((p) => p.enrollmentDate).filter((d): d is string => !!d)
      .concat(attrStudies.filter((s) => t(s.startDate) <= TODAY.getTime()).map((s) => s.startDate))
    const earliest = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : format(TODAY, 'yyyy-MM-dd')
    months = Math.min(MAX_MONTHS, differenceInCalendarMonths(TODAY, parseISO(earliest)) + 1)
  } else months = Number(f.range)
  const windowStart = startOfMonth(subMonths(TODAY, months - 1))
  const ws = windowStart.getTime()
  const inWindow = (d?: string) => !!d && t(d) >= ws && t(d) <= TODAY.getTime() + 86400000

  // Studies in scope: match the attribute filters and were not already finished before the window opened.
  const studies = attrStudies.filter((s) => t(s.expectedCompletion) >= ws)
  const studyIds = new Set(studies.map((s) => s.id))
  const participants = scopedParticipantsAll.filter((p) => studyIds.has(p.studyId))
  const partSite = new Map(src.participants.map((p) => [p.id, p.siteId]))
  const aesAll = src.aes.filter((a) => studyIds.has(a.studyId) && (!f.site || partSite.get(a.participantId) === f.site))
  const aes = aesAll.filter((a) => inWindow(a.reportedDate))
  const enrolledInWindow = participants.filter((p) => inWindow(p.enrollmentDate))

  const monthKeys = Array.from({ length: months }, (_, i) => addMonths(windowStart, i))
  const label = (d: Date) => format(d, months > 18 ? 'MMM yy' : 'MMM')

  // ---- recruitment trend ----
  const running = studies.filter((s) => s.stage !== 'Planning' && s.stage !== 'Ethics Review')
  const recruitment = monthKeys.map((m) => {
    const mEnd = endOfMonth(m).getTime()
    const mStart = m.getTime()
    let enrolled = 0
    let cumulative = 0
    for (const p of participants) {
      if (!p.enrollmentDate) continue
      const pt = t(p.enrollmentDate)
      if (pt <= mEnd) cumulative++
      if (pt >= mStart && pt <= mEnd) enrolled++
    }
    let pace = 0
    for (const s of running) {
      const st = t(s.startDate), en = t(s.expectedCompletion)
      const share = en > st ? Math.min(1, Math.max(0, (Math.min(mEnd, TODAY.getTime()) - st) / (en - st))) : 1
      pace += s.target * share
    }
    return { month: label(m), enrolled, cumulative, pace: Math.round(pace) }
  })
  const d90 = subDays(TODAY, 90).getTime(), d180 = subDays(TODAY, 180).getTime()
  let last90 = 0, prev90 = 0
  for (const p of participants) {
    if (!p.enrollmentDate) continue
    const pt = t(p.enrollmentDate)
    if (pt > d90) last90++
    else if (pt > d180) prev90++
  }
  const lastPoint = recruitment[recruitment.length - 1]
  const paceGap = lastPoint && lastPoint.pace ? Math.round((lastPoint.cumulative / lastPoint.pace) * 100) : null

  // ---- trial completion (portfolio stage) ----
  const stageCounts = PORTFOLIO_STAGES.map((stage) => ({ stage: stage as PortfolioStage, count: studies.filter((s) => s.stage === stage).length }))
  const dueNext12 = studies.filter((s) => s.stage !== 'Completed' && t(s.expectedCompletion) <= addMonths(TODAY, 12).getTime()).length

  // ---- site performance ----
  const siteRows = src.sites
    .filter((s) => (f.site ? s.id === f.site : studies.some((st) => st.siteIds.includes(s.id))))
    .map((s) => ({
      id: s.id, name: s.name, city: s.city, visitCompletion: s.visitCompletion,
      participants: participants.filter((p) => p.siteId === s.id && p.enrollmentDate).length,
    }))
    .filter((r) => r.participants > 0)
    .sort((a, b) => b.participants - a.participants)

  // ---- retention by study ----
  const retention = studies
    .map((s) => {
      const ps = participants.filter((p) => p.studyId === s.id && p.enrollmentDate)
      const withdrawn = ps.filter((p) => p.status === 'Withdrawn').length
      return { id: s.id, n: ps.length, retained: ps.length ? round1(((ps.length - withdrawn) / ps.length) * 100) : 0, withdrawn: ps.length ? round1((withdrawn / ps.length) * 100) : 0, withdrawnN: withdrawn }
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 10)
  const enrolledAll = participants.filter((p) => p.enrollmentDate)
  const withdrawnAll = enrolledAll.filter((p) => p.status === 'Withdrawn').length
  const retentionRate = enrolledAll.length ? round1(((enrolledAll.length - withdrawnAll) / enrolledAll.length) * 100) : 0

  // ---- deviations ----
  const deviations = studies.filter((s) => s.deviations > 0).map((s) => ({ id: s.id, deviations: s.deviations, short: s.shortTitle }))
    .sort((a, b) => b.deviations - a.deviations).slice(0, 10)
  const totalDeviations = studies.reduce((a, s) => a + s.deviations, 0)

  // ---- adverse events by month ----
  const aeMonthly = monthKeys.map((m) => {
    const mStart = m.getTime(), mEnd = endOfMonth(m).getTime()
    const inM = aes.filter((a) => { const x = t(a.reportedDate); return x >= mStart && x <= mEnd })
    return { month: label(m), serious: inM.filter((a) => a.serious).length, nonSerious: inM.filter((a) => !a.serious).length }
  })
  let ae90 = 0, aePrev90 = 0
  for (const a of aesAll) {
    const x = t(a.reportedDate)
    if (x > d90) ae90++
    else if (x > d180) aePrev90++
  }
  const seriousN = aes.filter((a) => a.serious).length

  // ---- data quality distribution ----
  const dqStudies = studies.filter((s) => s.dataQuality > 0)
  const BINS: { label: string; min: number; max: number; band: 'crit' | 'warn' | 'ok' }[] = [
    { label: 'Below 80%', min: 0, max: 79, band: 'crit' },
    { label: '80–84%', min: 80, max: 84, band: 'warn' },
    { label: '85–89%', min: 85, max: 89, band: 'warn' },
    { label: '90–94%', min: 90, max: 94, band: 'ok' },
    { label: '95–100%', min: 95, max: 100, band: 'ok' },
  ]
  const dqBins = BINS.map((b) => ({ ...b, count: dqStudies.filter((s) => s.dataQuality >= b.min && s.dataQuality <= b.max).length }))
  const sortedDq = dqStudies.map((s) => s.dataQuality).sort((a, b) => a - b)
  const medianDq = sortedDq.length ? sortedDq[Math.floor(sortedDq.length / 2)] : 0
  const openQueries = studies.reduce((a, s) => a + s.openQueries, 0)

  // ---- timeline ----
  const timeline = studies
    .filter((s) => s.stage === 'Recruiting' || s.stage === 'Active / Follow-up')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const dueSoon = timeline.filter((s) => t(s.expectedCompletion) <= addMonths(TODAY, 6).getTime()).length

  return {
    studies, participants, aes, enrolledInWindow, months, windowStart,
    recruitment, last90, prev90, paceGap,
    stageCounts, dueNext12,
    siteRows,
    retention, retentionRate, withdrawnAll, enrolledAll: enrolledAll.length,
    deviations, totalDeviations,
    aeMonthly, ae90, aePrev90, seriousN,
    dqBins, medianDq, openQueries, dqStudies: dqStudies.length,
    timeline, dueSoon,
  }
}

export type Metrics = ReturnType<typeof compute>

function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(m: Metrics, f: Filters, filterLabels: Record<string, string>) {
  const rows: (string | number)[][] = []
  rows.push(['AIIA CTMS analytics report'])
  rows.push(['Generated', format(new Date(), 'd MMM yyyy HH:mm')])
  rows.push(['Period', RANGES.find((r) => r.value === f.range)?.label ?? ''])
  Object.entries(filterLabels).forEach(([k, v]) => rows.push([k, v]))
  rows.push([])
  rows.push(['Metric', 'Value'])
  rows.push(['Studies in scope', m.studies.length])
  rows.push(['Participants enrolled in period', m.enrolledInWindow.length])
  rows.push(['Enrolled, last 90 days', m.last90])
  rows.push(['Enrolled, previous 90 days', m.prev90])
  rows.push(['Retention rate (%)', m.retentionRate])
  rows.push(['Withdrawn participants', m.withdrawnAll])
  rows.push(['Protocol deviations', m.totalDeviations])
  rows.push(['Adverse events in period', m.aes.length])
  rows.push(['Serious adverse events in period', m.seriousN])
  rows.push(['Median data quality (%)', m.medianDq])
  rows.push(['Open data queries', m.openQueries])
  rows.push(['Studies due to complete within 6 months', m.dueSoon])
  rows.push([])
  rows.push(['Study ID', 'Title', 'Department', 'Type', 'Stage', 'Status', 'Enrolled', 'Target', 'Deviations', 'Open queries', 'Data quality (%)', 'Adverse events in period', 'Start', 'Expected completion'])
  for (const s of m.studies) {
    rows.push([s.id, s.title, s.department, s.type, s.stage, s.status, s.enrolled, s.target, s.deviations, s.openQueries, s.dataQuality,
      m.aes.filter((a) => a.studyId === s.id).length, s.startDate, s.expectedCompletion])
  }
  rows.push([])
  rows.push(['Month', 'Enrolled', 'Cumulative enrolled', 'Target pace', 'Serious AEs', 'Non-serious AEs'])
  m.recruitment.forEach((r, i) => rows.push([r.month, r.enrolled, r.cumulative, r.pace, m.aeMonthly[i].serious, m.aeMonthly[i].nonSerious]))
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}
