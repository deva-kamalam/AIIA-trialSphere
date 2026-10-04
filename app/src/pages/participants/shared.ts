// Page-local helpers for participant, visit and eCRF pages.
// Per-participant clinical values are generated deterministically from the participant ID
// so they stay stable across reloads (no real patient data).
import { addDays, format, parseISO } from 'date-fns'
import { VISIT_SCHEDULE } from '@/types'
import type { Participant, Visit, VisitName } from '@/types'
import { TODAY } from '@/data/seed'

export const todayIso = () => format(TODAY, 'yyyy-MM-dd')
export const isoAdd = (d: string, n: number) => format(addDays(parseISO(d), n), 'yyyy-MM-dd')

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seeded(seed: string) {
  let a = hashStr(seed) || 1
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number, dp = 1) => Math.round((min + next() * (max - min)) * 10 ** dp) / 10 ** dp,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
  }
}

export const visitIndex = (v: string) => VISIT_SCHEDULE.indexOf(v as VisitName)
export const visitLabel = (v: string) => {
  const i = visitIndex(v)
  return i >= 0 ? `Visit ${i} — ${v}` : v
}

/** Days past the end of the visit window (scheduled + window). 0 if not overdue. */
export function daysPastWindow(v: Pick<Visit, 'scheduledDate' | 'windowDays'>) {
  const end = addDays(parseISO(v.scheduledDate), v.windowDays)
  const diff = Math.round((TODAY.getTime() - end.getTime()) / 86400000)
  return Math.max(0, diff)
}

export function daysLate(scheduled: string) {
  return Math.round((TODAY.getTime() - parseISO(scheduled).getTime()) / 86400000)
}

// ---------- Ayurveda vocabularies (standard classical categories) ----------
export const PRAKRITI_OPTS = ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'Sama (Tridoshaja)'] as const
export const VIKRITI_OPTS = ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'Tridoshaja'] as const
export const AGNI_OPTS = ['Samagni', 'Vishamagni', 'Tikshnagni', 'Mandagni'] as const
export const KOSTHA_OPTS = ['Mridu', 'Madhyama', 'Krura'] as const
export const BALA_OPTS = ['Pravara', 'Madhyama', 'Avara'] as const
export const SATMYA_OPTS = ['Pravara', 'Madhyama', 'Avara'] as const

export interface AyurvedaAssessment {
  prakriti: string; vikriti: string; agni: string; kostha: string; bala: string; satmya: string
}

export function ayurvedaFor(p: Pick<Participant, 'id' | 'prakriti'>): AyurvedaAssessment {
  const r = seeded(`${p.id}:ayur`)
  const prak = p.prakriti === 'Sama' ? 'Sama (Tridoshaja)' : p.prakriti
  return {
    prakriti: prak,
    vikriti: r.next() < 0.55 ? (prak.startsWith('Sama') ? 'Kapha' : prak.split('-')[0]) : r.pick(VIKRITI_OPTS),
    agni: r.pick(['Mandagni', 'Mandagni', 'Vishamagni', 'Samagni', 'Tikshnagni']),
    kostha: r.pick(KOSTHA_OPTS),
    bala: r.pick(['Madhyama', 'Madhyama', 'Pravara', 'Avara']),
    satmya: r.pick(['Madhyama', 'Madhyama', 'Pravara', 'Avara']),
  }
}

// ---------- Labs ----------
export interface LabDef { key: 'hba1c' | 'fbs' | 'alt' | 'creat'; label: string; unit: string; low: number; high: number; dp: number }
export const LAB_DEFS: LabDef[] = [
  { key: 'hba1c', label: 'HbA1c', unit: '%', low: 4.0, high: 5.6, dp: 1 },
  { key: 'fbs', label: 'Fasting blood sugar', unit: 'mg/dL', low: 70, high: 100, dp: 0 },
  { key: 'alt', label: 'ALT (SGPT)', unit: 'U/L', low: 7, high: 56, dp: 0 },
  { key: 'creat', label: 'Serum creatinine', unit: 'mg/dL', low: 0.6, high: 1.2, dp: 2 },
]
export const LAB_VISITS: VisitName[] = ['Screening', 'Baseline', 'Day 30', 'Day 60', 'Day 90', 'Final Visit']

export interface LabRow { visit: VisitName; date: string; hba1c: number; fbs: number; alt: number; creat: number }

export function labsFor(p: Participant, schedule: Visit[]): LabRow[] {
  const r = seeded(`${p.id}:labs`)
  const diabetic = p.studyId === 'AYU-001'
  let hba1c = diabetic ? r.float(7.2, 9.4) : r.float(5.0, 6.1)
  let fbs = diabetic ? r.int(138, 196) : r.int(82, 108)
  const altBase = r.int(18, 44)
  const creatBase = r.float(0.7, 1.1, 2)
  const spikeAt = r.int(2, 5) // one visit may show a transient ALT rise
  const rows: LabRow[] = []
  LAB_VISITS.forEach((visit, i) => {
    const v = schedule.find((s) => s.visit === visit)
    if (!v || v.status !== 'Completed') return
    if (i >= 2) {
      hba1c = Math.max(diabetic ? 6.1 : 4.9, Math.round((hba1c - (diabetic ? r.float(0.15, 0.45, 2) : r.float(-0.1, 0.12, 2))) * 10) / 10)
      fbs = Math.max(diabetic ? 104 : 78, fbs - (diabetic ? r.int(4, 16) : r.int(-5, 5)))
    }
    rows.push({
      visit,
      date: v.actualDate ?? v.scheduledDate,
      hba1c,
      fbs,
      alt: i === spikeAt && r.next() < 0.35 ? r.int(58, 84) : altBase + r.int(-6, 8),
      creat: Math.round((creatBase + r.float(-0.08, 0.1, 2)) * 100) / 100,
    })
  })
  return rows
}

export function labFlag(def: LabDef, value: number): 'H' | 'L' | null {
  if (value > def.high) return 'H'
  if (value < def.low) return 'L'
  return null
}

// ---------- Medications ----------
export interface ConMed { name: string; dose: string; route: string; frequency: string; indication: string; start: string; ongoing: boolean }
const CONMEDS: Omit<ConMed, 'start' | 'ongoing'>[] = [
  { name: 'Metformin', dose: '500 mg', route: 'Oral', frequency: 'BD', indication: 'Type 2 diabetes mellitus' },
  { name: 'Amlodipine', dose: '5 mg', route: 'Oral', frequency: 'OD', indication: 'Essential hypertension' },
  { name: 'Atorvastatin', dose: '10 mg', route: 'Oral', frequency: 'OD (night)', indication: 'Dyslipidaemia' },
  { name: 'Pantoprazole', dose: '40 mg', route: 'Oral', frequency: 'OD (before breakfast)', indication: 'Gastritis' },
  { name: 'Paracetamol', dose: '500 mg', route: 'Oral', frequency: 'PRN', indication: 'Headache' },
  { name: 'Cholecalciferol', dose: '60,000 IU', route: 'Oral', frequency: 'Weekly', indication: 'Vitamin D deficiency' },
  { name: 'Levothyroxine', dose: '50 mcg', route: 'Oral', frequency: 'OD (empty stomach)', indication: 'Hypothyroidism' },
]
export function conMedsFor(p: Participant): ConMed[] {
  const r = seeded(`${p.id}:cm`)
  const base = p.enrollmentDate ?? p.screeningDate
  const pool = p.studyId === 'AYU-001' ? CONMEDS : CONMEDS.slice(1)
  const n = r.int(p.studyId === 'AYU-001' ? 1 : 0, 3)
  const chosen: ConMed[] = []
  const used = new Set<string>()
  if (p.studyId === 'AYU-001') { chosen.push({ ...CONMEDS[0], start: isoAdd(base, -r.int(200, 900)), ongoing: true }); used.add('Metformin') }
  while (chosen.length < n) {
    const m = r.pick(pool)
    if (used.has(m.name)) continue
    used.add(m.name)
    const prn = m.frequency === 'PRN'
    chosen.push({ ...m, start: prn ? isoAdd(base, r.int(5, 40)) : isoAdd(base, -r.int(60, 1200)), ongoing: !prn })
  }
  return chosen
}

// ---------- Protocol deviations ----------
export interface Deviation { id: string; date: string; category: string; description: string; severity: 'Minor' | 'Major'; status: 'Open' | 'Closed'; capa: string }
export function deviationsFor(p: Participant, schedule: Visit[]): Deviation[] {
  const h = hashStr(p.id)
  const out: Deviation[] = []
  let seq = 0
  const nextId = () => `PD-${String(1000 + (h % 8000) + seq++).padStart(4, '0')}`
  for (const v of schedule) {
    if (v.status === 'Completed' && v.actualDate && v.windowDays > 0) {
      const off = Math.abs(Math.round((parseISO(v.actualDate).getTime() - parseISO(v.scheduledDate).getTime()) / 86400000))
      if (off > v.windowDays) out.push({ id: nextId(), date: v.actualDate, category: 'Visit window', description: `${v.visit} conducted ${off} days from target date (window ±${v.windowDays} days).`, severity: 'Minor', status: 'Closed', capa: 'Coordinator reminded of visit window; reminder calls set 3 days prior.' })
    }
    if (v.status === 'Missed') out.push({ id: nextId(), date: isoAdd(v.scheduledDate, v.windowDays + 1), category: 'Missed visit', description: `${v.visit} not conducted within the protocol window.`, severity: 'Major', status: daysLate(v.scheduledDate) > 30 ? 'Closed' : 'Open', capa: 'Participant contacted; reason documented in source notes.' })
  }
  if (out.length === 0 && h % 3 === 0 && p.enrollmentDate) {
    out.push({ id: nextId(), date: isoAdd(p.enrollmentDate, 7 + (h % 20)), category: 'Investigational product', description: 'Study medication dispensed 2 days after the scheduled dispensing date due to pharmacy stock transfer.', severity: 'Minor', status: 'Closed', capa: 'Buffer stock maintained at site pharmacy.' })
  }
  return out.slice(0, 2)
}

// ---------- eCRF forms per visit ----------
export type FormStatus = 'Signed' | 'Complete' | 'Open query' | 'Not started' | 'Not done'
export function formsForVisit(visit: VisitName): string[] {
  if (visit === 'Screening') return ['Demographics', 'Informed consent', 'Eligibility criteria', 'Medical history', 'Vital signs']
  if (visit === 'Baseline') return ['Vital signs', 'Ayurveda assessment', 'Laboratory results', 'Randomisation', 'Concomitant medication']
  const base = ['Vital signs', 'Clinical assessment', 'Ayurveda assessment', 'Treatment compliance', 'Adverse event review']
  if (visit === 'Day 30' || visit === 'Day 90') base.splice(3, 0, 'Laboratory results')
  if (visit === 'Final Visit') base.push('End of study')
  return base
}
export function formStatus(pid: string, v: Visit, form: string, latestCompleted: boolean): FormStatus {
  if (v.status === 'Missed') return 'Not done'
  if (v.status !== 'Completed') return 'Not started'
  const h = hashStr(`${pid}:${v.visit}:${form}`)
  if (h % 9 === 0) return 'Open query'
  if (latestCompleted) return h % 2 === 0 ? 'Complete' : 'Signed'
  return h % 7 === 0 ? 'Complete' : 'Signed'
}
export const FORM_TONE: Record<FormStatus, 'ok' | 'info' | 'warn' | 'neutral' | 'crit'> = {
  Signed: 'ok', Complete: 'info', 'Open query': 'warn', 'Not started': 'neutral', 'Not done': 'crit',
}
