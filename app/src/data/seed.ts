// Deterministic fictional seed data. No real patient information.
// Totals are constructed so portfolio KPIs are derived from records, not hard-coded.
import { addDays, format, subDays } from 'date-fns'
import type {
  AdverseEvent, AppNotification, AuditEvent, Causality, ComplianceItem, ComplianceMilestone,
  DocCategory, HealthLevel, HealthSignals, LifecycleStage, Participant, ParticipantStatus,
  PortfolioStage, Severity, Site, Study, StudyCompliance, StudyDocument, StudyPhase, StudyType,
  TrialStatus, User, Visit, AEReviewStatus,
} from '@/types'
import { VISIT_SCHEDULE } from '@/types'

// ---------- utilities ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261004)
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min

export const TODAY = new Date(new Date().setHours(0, 0, 0, 0))
const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const daysAgo = (n: number) => iso(subDays(TODAY, n))
const daysAhead = (n: number) => iso(addDays(TODAY, n))

// ---------- people ----------
export const USERS: User[] = [
  { id: 'u1', name: 'Dr. Ananya Sharma', email: 'ananya.sharma@aiia.example.in', role: 'pi', department: 'Kayachikitsa', initials: 'AS' },
  { id: 'u2', name: 'Rahul Kumar', email: 'rahul.kumar@aiia.example.in', role: 'coordinator', department: 'Clinical Research Unit', initials: 'RK' },
  { id: 'u3', name: 'Prof. Meera Iyer', email: 'meera.iyer@aiia.example.in', role: 'ethics', department: 'Institutional Ethics Committee', initials: 'MI' },
  { id: 'u4', name: 'Dr. Priya Nair', email: 'priya.nair@aiia.example.in', role: 'pv', department: 'Pharmacovigilance Cell', initials: 'PN' },
  { id: 'u5', name: 'Arjun Menon', email: 'arjun.menon@aiia.example.in', role: 'data_manager', department: 'Data Management', initials: 'AM' },
  { id: 'u6', name: 'Dr. Vikram Rao', email: 'vikram.rao@aiia.example.in', role: 'management', department: 'Office of the Dean (Research)', initials: 'VR' },
]

const PIS = [
  'Dr. Ananya Sharma', 'Dr. Sanjay Gupta', 'Dr. Kavita Deshpande', 'Dr. Rohit Bansal', 'Dr. Lakshmi Pillai',
  'Dr. Imran Qureshi', 'Dr. Neha Joshi', 'Dr. Suresh Hegde', 'Dr. Farah Siddiqui', 'Dr. Manoj Tiwari',
]
const COORDINATORS = ['Rahul Kumar', 'Sneha Patil', 'Aditya Verma', 'Pooja Rawat', 'Karthik Subramanian', 'Divya Chauhan']

const DEPARTMENTS = [
  'Kayachikitsa', 'Panchakarma', 'Shalya Tantra', 'Prasuti Tantra & Stri Roga', 'Kaumarabhritya',
  'Dravyaguna', 'Rasa Shastra', 'Swasthavritta', 'Shalakya Tantra',
]

// ---------- sites ----------
const SITE_DEFS: [string, string, string, string][] = [
  ['AIIA Sarita Vihar (Main Campus)', 'New Delhi', 'Delhi', 'Dr. Ananya Sharma'],
  ['AIIA Satellite Institute', 'Panaji', 'Goa', 'Dr. Suresh Hegde'],
  ['Regional Ayurveda Research Centre', 'Jaipur', 'Rajasthan', 'Dr. Rohit Bansal'],
  ['Government Ayurveda College Hospital', 'Thiruvananthapuram', 'Kerala', 'Dr. Lakshmi Pillai'],
  ['Ayurveda Teaching Hospital', 'Pune', 'Maharashtra', 'Dr. Kavita Deshpande'],
  ['Integrative Medicine Centre', 'Bengaluru', 'Karnataka', 'Dr. Neha Joshi'],
  ['State Ayurveda Hospital', 'Lucknow', 'Uttar Pradesh', 'Dr. Manoj Tiwari'],
  ['Ayurveda Research Clinic', 'Ahmedabad', 'Gujarat', 'Dr. Sanjay Gupta'],
  ['Panchakarma Research Unit', 'Haridwar', 'Uttarakhand', 'Dr. Imran Qureshi'],
  ['Ayush Wellness Centre', 'Bhubaneswar', 'Odisha', 'Dr. Farah Siddiqui'],
  ['Ayurveda College Hospital', 'Nagpur', 'Maharashtra', 'Dr. Kavita Deshpande'],
  ['District Integrative Hospital', 'Patna', 'Bihar', 'Dr. Manoj Tiwari'],
  ['Ayurveda Research Hospital', 'Hyderabad', 'Telangana', 'Dr. Neha Joshi'],
  ['Regional Research Institute', 'Guwahati', 'Assam', 'Dr. Farah Siddiqui'],
  ['Ayurveda Medical College Hospital', 'Chandigarh', 'Chandigarh', 'Dr. Rohit Bansal'],
  ['Integrative Care Centre', 'Chennai', 'Tamil Nadu', 'Dr. Lakshmi Pillai'],
  ['Ayurveda Hospital & Research Centre', 'Bhopal', 'Madhya Pradesh', 'Dr. Sanjay Gupta'],
  ['Community Ayurveda Clinic', 'Dehradun', 'Uttarakhand', 'Dr. Imran Qureshi'],
]

export const SITES: Site[] = SITE_DEFS.map(([name, city, state, investigator], i) => {
  const active = i < 16
  return {
    id: `S${String(i + 1).padStart(2, '0')}`,
    name, city, state, investigator,
    status: active ? 'Active' : 'Activation Pending',
    activatedOn: active ? daysAgo(200 + i * 37) : undefined,
    participants: 0,
    visitCompletion: active ? int(82, 98) : 0,
    dataQuality: active ? int(84, 99) : 0,
    deviations: active ? int(0, 9) : 0,
  }
})

// ---------- studies ----------
interface StudyDef {
  title: string
  short: string
  intervention: string
  comparator: string
}
const NAMED: StudyDef[] = [
  { title: 'Ayurvedic Intervention for Type 2 Diabetes', short: 'T2DM', intervention: 'Nisha-Amalaki formulation + Pathya diet regimen', comparator: 'Standard care (Metformin) alone' },
  { title: 'Ayurvedic Management of Osteoarthritis', short: 'Knee OA', intervention: 'Janu Basti with oral Yogaraja Guggulu', comparator: 'Physiotherapy + topical NSAID' },
  { title: 'Ayurvedic Intervention for PCOS', short: 'PCOS', intervention: 'Shatavari-based formulation + lifestyle module', comparator: 'Lifestyle module alone' },
  { title: 'Ayurveda-Based Supportive Therapy Study', short: 'Supportive care', intervention: 'Rasayana supportive regimen during chemotherapy', comparator: 'Standard supportive care' },
]
const MORE: [string, string][] = [
  ['Ayurvedic Management of Chronic Migraine', 'Migraine'],
  ['Panchakarma in Rheumatoid Arthritis', 'RA'],
  ['Ayurvedic Intervention in Non-Alcoholic Fatty Liver Disease', 'NAFLD'],
  ['Rasayana for Healthy Ageing in Older Adults', 'Healthy ageing'],
  ['Ayurvedic Management of Irritable Bowel Syndrome', 'IBS'],
  ['Yoga and Ayurveda for Generalised Anxiety', 'Anxiety'],
  ['Ayurvedic Intervention for Iron-Deficiency Anaemia in Adolescent Girls', 'Anaemia'],
  ['Ksharasutra Therapy in Fistula-in-Ano', 'Fistula'],
  ['Ayurvedic Management of Psoriasis', 'Psoriasis'],
  ['Nasya Therapy in Allergic Rhinitis', 'Rhinitis'],
  ['Ayurvedic Management of Essential Hypertension', 'Hypertension'],
  ['Shirodhara for Primary Insomnia', 'Insomnia'],
  ['Ayurvedic Intervention in Subclinical Hypothyroidism', 'Hypothyroidism'],
  ['Ayurvedic Management of Lumbar Spondylosis', 'Spondylosis'],
  ['Rasayana in Post-COVID Fatigue', 'Fatigue'],
  ['Ayurvedic Intervention in Dyslipidaemia', 'Dyslipidaemia'],
  ['Garbhini Paricharya and Pregnancy Outcomes', 'Antenatal'],
  ['Ayurvedic Management of Diabetic Peripheral Neuropathy', 'Neuropathy'],
  ['Ayurveda in Childhood Bronchial Asthma', 'Paediatric asthma'],
  ['Ayurvedic Management of Primary Dysmenorrhoea', 'Dysmenorrhoea'],
  ['Netra Tarpana in Computer Vision Syndrome', 'CVS'],
  ['Ayurvedic Intervention in Gout', 'Gout'],
  ['Ayurvedic Management of Chronic Kidney Disease Stage 3', 'CKD'],
  ['Ayurveda for Metabolic Syndrome in Adults', 'Metabolic syndrome'],
  ['Ayurvedic Management of Acid Peptic Disease', 'APD'],
  ['Jalaukavacharana in Varicose Ulcers', 'Varicose ulcer'],
  ['Ayurvedic Intervention in Frozen Shoulder', 'Frozen shoulder'],
  ['Ayurveda in Mild Cognitive Impairment', 'MCI'],
  ['Ayurvedic Management of Chronic Sinusitis', 'Sinusitis'],
  ['Ayurvedic Intervention in Obesity', 'Obesity'],
  ['Ayurveda in Menopausal Symptoms', 'Menopause'],
  ['Ayurvedic Management of Vitiligo', 'Vitiligo'],
  ['Ayurvedic Management of Haemorrhoids', 'Haemorrhoids'],
  ['Ayurvedic Intervention in Prediabetes', 'Prediabetes'],
  ['Ayurveda for Chemotherapy-Induced Nausea', 'CINV'],
  ['Ayurvedic Management of Plantar Fasciitis', 'Plantar fasciitis'],
  ['Ayurvedic Management of Cervical Spondylosis', 'Cervical spondylosis'],
  ['Ayurveda in Childhood Malnutrition', 'Malnutrition'],
  ['Ayurvedic Management of Chronic Urticaria', 'Urticaria'],
  ['Ayurvedic Intervention in Alcoholic Liver Disease', 'ALD'],
  ['Ayurveda in Recurrent Aphthous Ulcers', 'Aphthous ulcer'],
  ['Ayurvedic Management of Sciatica', 'Sciatica'],
  ['Ayurveda in Polyneuropathy of Ageing', 'Polyneuropathy'],
  ['Ayurvedic Intervention in Acne Vulgaris', 'Acne'],
  ['Ayurvedic Management of Chronic Constipation', 'Constipation'],
  ['Ayurveda in Seasonal Immunity (Ritucharya)', 'Ritucharya'],
  ['Ayurvedic Management of Benign Prostatic Hyperplasia', 'BPH'],
  ['Ayurveda in Dry Eye Disease', 'Dry eye'],
  ['Ayurvedic Management of Tension-Type Headache', 'TTH'],
  ['Ayurvedic Intervention in Hyperuricaemia', 'Hyperuricaemia'],
  ['Ayurveda in Post-Stroke Rehabilitation', 'Stroke rehab'],
  ['Ayurvedic Management of Diabetic Foot Ulcers', 'Diabetic foot'],
]

// Portfolio shape: 5 planning, 6 ethics review, 24 recruiting, 12 active/follow-up, 9 completed = 56.
const STAGE_PLAN: PortfolioStage[] = [
  'Recruiting', 'Recruiting', 'Active / Follow-up', 'Recruiting', // AYU-001..004
  ...Array<PortfolioStage>(21).fill('Recruiting'),
  ...Array<PortfolioStage>(11).fill('Active / Follow-up'),
  ...Array<PortfolioStage>(6).fill('Ethics Review'),
  ...Array<PortfolioStage>(5).fill('Planning'),
  ...Array<PortfolioStage>(9).fill('Completed'),
]

const lifecycleFor = (stage: PortfolioStage): LifecycleStage => {
  switch (stage) {
    case 'Planning': return 'Protocol'
    case 'Ethics Review': return rand() < 0.5 ? 'Ethics' : 'CTRI'
    case 'Recruiting': return 'Recruitment'
    case 'Active / Follow-up': return rand() < 0.2 ? 'Database Lock' : 'Follow-up'
    case 'Completed': return 'Completed'
  }
}

const level = (pOk: number, pWarn: number): HealthLevel => {
  const r = rand()
  return r < pOk ? 'ok' : r < pOk + pWarn ? 'warn' : 'crit'
}

export function statusFromHealth(h: HealthSignals, stage: PortfolioStage): TrialStatus {
  if (stage === 'Completed') return 'Completed'
  const vals = Object.values(h)
  if (vals.includes('crit')) return 'Critical'
  if (vals.filter((v) => v === 'warn').length >= 2) return 'Attention Required'
  return 'On Track'
}

// Enrolment for the 36 recruiting/follow-up studies must sum to 3,842 with targets summing to 5,000.
// AYU-001 fixed at 1,248 / 1,500 per the brief.
function enrolmentPlan(): { enrolled: number; target: number }[] {
  const n = 36
  const targets: number[] = [1500]
  const rest = 5000 - 1500
  const weights = Array.from({ length: n - 1 }, () => 0.6 + rand())
  const wsum = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  weights.forEach((w, i) => {
    const t = i === n - 2 ? rest - acc : Math.max(20, Math.round((w / wsum) * rest / 10) * 10)
    targets.push(t)
    acc += t
  })
  const enrolled: number[] = [1248]
  const restEnrolled = 3842 - 1248
  const ratios = targets.slice(1).map(() => 0.45 + rand() * 0.55)
  const raw = targets.slice(1).map((t, i) => t * ratios[i])
  const rsum = raw.reduce((a, b) => a + b, 0)
  let eacc = 0
  raw.forEach((r, i) => {
    const e = i === raw.length - 1 ? restEnrolled - eacc : Math.min(targets[i + 1], Math.round((r / rsum) * restEnrolled))
    enrolled.push(e)
    eacc += e
  })
  return targets.map((t, i) => ({ target: t, enrolled: enrolled[i] }))
}
const ENROL = enrolmentPlan()

const TYPES: StudyType[] = ['Interventional', 'Interventional', 'Interventional', 'Observational', 'Pilot / Feasibility']
const PHASES: StudyPhase[] = ['Phase II', 'Phase III', 'Phase II', 'Pilot', 'Phase IV']

export const STUDIES: Study[] = STAGE_PLAN.map((stage, i) => {
  const id = `AYU-${String(i + 1).padStart(3, '0')}`
  const named = NAMED[i]
  const [moreTitle, moreShort] = MORE[(i - 4) % MORE.length] ?? ['', '']
  const title = named?.title ?? moreTitle
  const shortTitle = named?.short ?? moreShort
  const running = stage === 'Recruiting' || stage === 'Active / Follow-up'
  const runIdx = STAGE_PLAN.slice(0, i + 1).filter((s) => s === 'Recruiting' || s === 'Active / Follow-up').length - 1
  const { enrolled, target } = running
    ? ENROL[runIdx]
    : stage === 'Completed'
      ? (() => { const t = int(6, 30) * 10; return { target: t, enrolled: t - int(0, 12) } })()
      : { enrolled: 0, target: int(6, 40) * 10 }

  const siteCount = i === 0 ? 8 : running ? int(1, 5) : stage === 'Completed' ? int(1, 3) : int(1, 3)
  const siteIds = i === 0
    ? ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08']
    : Array.from(new Set(Array.from({ length: siteCount }, () => `S${String(int(1, 16)).padStart(2, '0')}`)))

  let health: HealthSignals
  if (i === 0) health = { recruitment: 'ok', dataCompletion: 'ok', deviations: 'warn', safetyReporting: 'warn', regulatory: 'warn', documents: 'ok' }
  else if (i === 1) health = { recruitment: 'ok', dataCompletion: 'ok', deviations: 'ok', safetyReporting: 'ok', regulatory: 'ok', documents: 'ok' }
  else if (i === 2) health = { recruitment: 'warn', dataCompletion: 'ok', deviations: 'warn', safetyReporting: 'crit', regulatory: 'ok', documents: 'warn' }
  else if (i === 3) health = { recruitment: 'warn', dataCompletion: 'warn', deviations: 'ok', safetyReporting: 'ok', regulatory: 'ok', documents: 'crit' }
  else if (stage === 'Completed') health = { recruitment: 'ok', dataCompletion: 'ok', deviations: 'ok', safetyReporting: 'ok', regulatory: 'ok', documents: 'ok' }
  else health = {
    recruitment: running ? level(0.7, 0.24) : 'ok',
    dataCompletion: running ? level(0.78, 0.2) : 'ok',
    deviations: running ? level(0.75, 0.22) : 'ok',
    safetyReporting: running ? level(0.9, 0.08) : 'ok',
    regulatory: level(0.72, 0.25),
    documents: level(0.78, 0.2),
  }

  const start = stage === 'Planning' ? daysAhead(int(30, 120)) : daysAgo(stage === 'Completed' ? int(700, 1200) : int(120, 640))
  const end = stage === 'Completed' ? daysAgo(int(20, 300)) : daysAhead(int(180, 720))

  return {
    id, title, shortTitle,
    type: i === 3 ? 'Supportive Care' : i < 3 ? 'Interventional' : pick(TYPES),
    phase: i === 0 ? 'Phase III' : i === 3 ? 'Phase II' : pick(PHASES),
    department: i === 0 ? 'Kayachikitsa' : i === 1 ? 'Panchakarma' : i === 2 ? 'Prasuti Tantra & Stri Roga' : pick(DEPARTMENTS),
    pi: i === 0 ? 'Dr. Ananya Sharma' : pick(PIS),
    coordinator: i === 0 ? 'Rahul Kumar' : pick(COORDINATORS),
    intervention: named?.intervention ?? 'Classical Ayurvedic formulation as per protocol',
    comparator: named?.comparator ?? 'Standard care',
    primaryObjective: `To evaluate the efficacy and safety of the study intervention in ${shortTitle.toLowerCase()}.`,
    siteIds,
    enrolled, target,
    startDate: i === 0 ? daysAgo(412) : start,
    expectedCompletion: i === 0 ? daysAhead(318) : end,
    stage,
    lifecycle: i === 0 ? 'Recruitment' : lifecycleFor(stage),
    status: statusFromHealth(health, stage),
    dataQuality: i === 0 ? 96 : stage === 'Planning' || stage === 'Ethics Review' ? 0 : health.dataCompletion === 'ok' ? int(92, 99) : health.dataCompletion === 'warn' ? int(82, 91) : int(70, 81),
    compliance: i === 0 ? 92 : health.regulatory === 'ok' ? int(94, 100) : health.regulatory === 'warn' ? int(80, 93) : int(62, 79),
    completedVisits: i === 0 ? 4892 : Math.round(enrolled * (running ? 3.2 + rand() * 1.5 : 6.6)),
    deviations: i === 0 ? 12 : running ? (health.deviations === 'ok' ? int(0, 4) : int(5, 14)) : 0,
    openQueries: i === 0 ? 27 : running ? int(0, 22) : 0,
    adverseEvents: 0, // filled from AE records below
    health,
    ctriNumber: stage === 'Planning' || (stage === 'Ethics Review' && rand() < 0.6) ? undefined : `CTRI/20${int(23, 26)}/${String(int(1, 12)).padStart(2, '0')}/0${int(50000, 99999)}`,
  }
})

export const studyById = (id: string) => STUDIES.find((s) => s.id === id)

// ---------- participants ----------
const PRAKRITI = ['Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha', 'Pitta', 'Kapha', 'Vata', 'Sama']

function visitOffsets(): number[] {
  return [-7, 0, 7, 30, 60, 90, 120] // days from enrolment for each VISIT_SCHEDULE entry
}

export const PARTICIPANTS: Participant[] = []
for (const s of STUDIES) {
  if (s.enrolled === 0 && s.stage !== 'Recruiting') continue
  const code = s.id.replace('-', '')
  const studyStart = new Date(s.startDate)
  const span = Math.max(30, Math.round((TODAY.getTime() - studyStart.getTime()) / 86400000))
  const screenedExtra = s.stage === 'Recruiting' ? Math.max(2, Math.round(s.enrolled * 0.06)) : 0
  const failures = s.stage === 'Completed' ? 0 : Math.round(s.enrolled * 0.03)
  const total = s.enrolled + screenedExtra + failures
  for (let n = 1; n <= total; n++) {
    const id = `AIIA-${code}-${String(n).padStart(4, '0')}`
    const siteId = s.siteIds[n % s.siteIds.length]
    let status: ParticipantStatus
    if (n > s.enrolled + screenedExtra) status = 'Screen Failure'
    else if (n > s.enrolled) status = 'Screening'
    else if (s.stage === 'Completed') status = rand() < 0.94 ? 'Completed' : 'Withdrawn'
    else {
      const r = rand()
      status = r < 0.05 ? 'Withdrawn' : r < 0.2 ? 'Completed' : r < 0.32 ? 'Enrolled' : 'Active'
    }
    // Enrolment spread across the study's running period, later IDs enrolled later.
    // Screening / screen-failure records sit in the last few weeks.
    const enrolOffset = n <= s.enrolled
      ? Math.round(((n - 1) / Math.max(1, s.enrolled)) * (span - 6))
      : span - int(2, 24)
    const enrolDate = addDays(studyStart, Math.min(span - 1, enrolOffset))
    const screening = iso(subDays(enrolDate, int(3, 10)))
    const daysIn = Math.round((TODAY.getTime() - enrolDate.getTime()) / 86400000)
    const offs = visitOffsets()
    let currentIdx = offs.findIndex((o) => o > daysIn)
    if (currentIdx === -1) currentIdx = offs.length - 1
    if (status === 'Screening' || status === 'Screen Failure') currentIdx = 0
    if (status === 'Completed') currentIdx = offs.length - 1
    const lastIdx = Math.max(0, currentIdx - 1)
    const enrolled = status !== 'Screening' && status !== 'Screen Failure'
    PARTICIPANTS.push({
      id,
      studyId: s.id,
      siteId,
      screeningDate: screening,
      enrollmentDate: enrolled ? iso(enrolDate) : undefined,
      age: s.id === 'AYU-003' ? int(19, 38) : int(28, 72),
      sex: s.id === 'AYU-003' ? 'F' : rand() < 0.52 ? 'F' : 'M',
      currentVisit: VISIT_SCHEDULE[currentIdx],
      status,
      lastVisit: enrolled ? iso(addDays(enrolDate, offs[lastIdx])) : screening,
      nextVisit: status === 'Active' || status === 'Enrolled' ? iso(addDays(enrolDate, offs[currentIdx])) : undefined,
      prakriti: pick(PRAKRITI),
    })
  }
}
for (const site of SITES) site.participants = PARTICIPANTS.filter((p) => p.siteId === site.id && p.enrollmentDate).length

export const participantById = (id: string) => PARTICIPANTS.find((p) => p.id === id)

// ---------- visits ----------
// Full schedule for one participant. Missed/overdue states are seeded deterministically from the ID.
export function scheduleFor(p: Participant): Visit[] {
  const base = p.enrollmentDate ? new Date(p.enrollmentDate) : new Date(p.screeningDate)
  const study = studyById(p.studyId)
  const hash = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const names = p.enrollmentDate ? VISIT_SCHEDULE : VISIT_SCHEDULE.slice(0, 1)
  const visits = names.map((visit, idx): Visit => {
    const scheduled = addDays(base, visitOffsets()[idx])
    const diff = Math.round((scheduled.getTime() - TODAY.getTime()) / 86400000)
    let status: Visit['status']
    let actual: string | undefined
    if (!p.enrollmentDate && idx > 0) status = 'Upcoming'
    else if (p.status === 'Withdrawn' && diff > -30 && diff < 0) status = 'Missed'
    else if (diff < -7) {
      const missed = (hash + idx) % 97 === 0
      status = missed ? 'Missed' : 'Completed'
      actual = missed ? undefined : iso(addDays(scheduled, idx < 2 ? 0 : ((hash >> idx) % 5) - 2))
    } else if (diff < 0) {
      const done = (hash + idx) % 23 !== 0
      status = done ? 'Completed' : 'Overdue'
      actual = done ? iso(addDays(scheduled, idx < 2 ? 0 : (hash % 3) - 1)) : undefined
    } else status = 'Upcoming'
    return {
      id: `${p.id}-V${idx}`,
      participantId: p.id,
      studyId: p.studyId,
      siteId: p.siteId,
      visit,
      scheduledDate: iso(scheduled),
      actualDate: actual,
      status,
      coordinator: study?.coordinator ?? 'Rahul Kumar',
      windowDays: idx < 2 ? 0 : idx < 4 ? 3 : 7,
    }
  })
  // Withdrawn participants have no further scheduled visits after withdrawal.
  return p.status === 'Withdrawn' ? visits.filter((v) => v.status !== 'Upcoming' && new Date(v.scheduledDate) < TODAY) : visits
}

// ---------- adverse events (116 total, 4 serious, 12 under review, 2 overdue) ----------
const AE_TERMS: [string, Severity][] = [
  ['Nausea', 'Mild'], ['Loose stools', 'Mild'], ['Headache', 'Mild'], ['Abdominal discomfort', 'Mild'],
  ['Skin rash', 'Mild'], ['Dizziness', 'Mild'], ['Acidity / heartburn', 'Mild'], ['Fatigue', 'Mild'],
  ['Elevated ALT', 'Moderate'], ['Hypoglycaemia', 'Moderate'], ['Vomiting', 'Moderate'], ['Joint swelling', 'Moderate'],
  ['Pruritus', 'Mild'], ['Insomnia', 'Mild'], ['Constipation', 'Mild'], ['Palpitations', 'Moderate'],
]
const CAUS: Causality[] = ['Unrelated', 'Unlikely', 'Possible', 'Possible', 'Probable']
const REPORTERS = ['Dr. Ananya Sharma', 'Rahul Kumar', 'Sneha Patil', 'Dr. Lakshmi Pillai', 'Aditya Verma']
const runningStudies = STUDIES.filter((s) => s.enrolled > 0 && s.stage !== 'Completed')

export const ADVERSE_EVENTS: AdverseEvent[] = []
{
  // Study allocation: 38 for AYU-001, the rest spread across other running studies.
  const allocation: string[] = [...Array(38).fill('AYU-001')]
  while (allocation.length < 116) allocation.push(runningStudies[1 + Math.floor(rand() * (runningStudies.length - 1))].id)
  // Shuffle deterministically, but keep the brief's example as the newest (AE-00124).
  for (let i = allocation.length - 2; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [allocation[i], allocation[j]] = [allocation[j], allocation[i]] }
  allocation[115] = 'AYU-001'
  allocation[112] = 'AYU-001'
  allocation[108] = 'AYU-003'
  // Rebalance so AYU-001 keeps exactly 38 events after pinning.
  const fixed = new Set([108, 112, 115])
  let diff = allocation.filter((x) => x === 'AYU-001').length - 38
  for (let i = 0; diff !== 0 && i < allocation.length; i++) {
    if (fixed.has(i)) continue
    if (diff > 0 && allocation[i] === 'AYU-001') { allocation[i] = 'AYU-005'; diff-- }
    else if (diff < 0 && allocation[i] !== 'AYU-001') { allocation[i] = 'AYU-001'; diff++ }
  }

  const underReview: AEReviewStatus[] = ['Medical Review', 'Seriousness Assessment', 'Causality Assessment']
  allocation.forEach((studyId, k) => {
    const num = 9 + k // AE-00009 .. AE-00124
    const id = `AE-${String(num).padStart(5, '0')}`
    const pool = PARTICIPANTS.filter((p) => p.studyId === studyId && p.enrollmentDate)
    const participant = k === 115 ? 'AIIA-AYU001-0034' : pool[Math.floor(rand() * pool.length)].id
    const recency = 115 - k // 0 = newest
    const reported = daysAgo(Math.round(recency * 2.6) + int(0, 2))
    let [term, sev] = pick(AE_TERMS)
    let serious = false
    let reviewStatus: AEReviewStatus = 'Resolved'
    let causality = pick(CAUS)

    if (k === 115) { term = 'Nausea'; sev = 'Mild'; causality = 'Possible'; reviewStatus = 'Medical Review' }
    else if (recency <= 1) reviewStatus = 'New'
    else if (recency <= 13) reviewStatus = underReview[recency % 3]
    else if (recency <= 16) reviewStatus = 'Reporting'
    if (k === 112) { term = 'Hospitalisation — severe hypoglycaemia'; sev = 'Severe'; serious = true; reviewStatus = 'Seriousness Assessment'; causality = 'Possible' }
    if (k === 108) { term = 'Drug-induced liver injury (suspected)'; sev = 'Severe'; serious = true; reviewStatus = 'Reporting'; causality = 'Probable' }
    if (k === 80) { term = 'Hospitalisation — acute gastroenteritis'; sev = 'Severe'; serious = true; causality = 'Unlikely' }
    if (k === 41) { term = 'Fall with wrist fracture'; sev = 'Severe'; serious = true; causality = 'Unrelated' }

    const resolved = reviewStatus === 'Resolved'
    // Open events get a future action deadline; the two overdue items are explicit SAEs.
    let due = resolved ? iso(addDays(new Date(reported), 14)) : daysAhead(int(2, 20))
    if (k === 112) due = daysAgo(1)
    if (k === 108) due = daysAgo(2)
    ADVERSE_EVENTS.push({
      id, participantId: participant, studyId, event: term, severity: sev, serious, causality,
      expected: !serious && rand() < 0.7,
      onsetDate: iso(subDays(new Date(reported), int(0, 3))),
      reportedDate: reported,
      reviewStatus,
      dueDate: due,
      actionTaken: serious ? 'Study intervention interrupted' : resolved ? 'None' : pick(['None', 'Dose unchanged', 'Symptomatic treatment']),
      outcome: resolved ? 'Recovered' : serious ? 'Recovering' : 'Ongoing',
      reporter: pick(REPORTERS),
    })
  })
}
for (const s of STUDIES) s.adverseEvents = ADVERSE_EVENTS.filter((a) => a.studyId === s.id).length

// ---------- compliance ----------
const REQS: [ComplianceItem['key'], string][] = [
  ['ethics', 'Ethics Committee Approval'], ['ctri', 'CTRI Registration'], ['protocol', 'Protocol Version'],
  ['consent', 'Informed Consent Version'], ['regulatoryDocs', 'Regulatory Documents'], ['insurance', 'Insurance'],
  ['amendments', 'Amendments'], ['safetyReporting', 'Safety Reporting'], ['periodicReports', 'Annual / Periodic Reports'],
  ['ndct', 'NDCT Rules 2019 obligations'],
]

function complianceFor(s: Study): StudyCompliance {
  const early = s.stage === 'Planning'
  const ethicsReview = s.stage === 'Ethics Review'
  const regLevel = s.health.regulatory
  // NDCT applicability is configured per study; default off for observational and classical-formulation studies.
  const ndctApplicable = s.type === 'Interventional' && s.id === 'AYU-004'
  const items: ComplianceItem[] = REQS.map(([key, label], idx) => {
    let applicable = true
    if (key === 'ndct') applicable = ndctApplicable
    if (key === 'insurance') applicable = s.type !== 'Observational'
    let state: ComplianceItem['state'] = 'ok'
    let detail = ''
    let dueDate: string | undefined
    if (early) state = idx < 3 ? 'warn' : 'na'
    else if (ethicsReview && (key === 'ethics' || key === 'ctri')) state = 'warn'
    else if (regLevel !== 'ok' && (idx === 6 || idx === 8)) state = regLevel
    if (!applicable) state = 'na'
    switch (key) {
      case 'ethics': detail = state === 'ok' ? `IEC/AIIA/${s.id}/2025 — valid to ${format(addDays(TODAY, 40 + idx * 13), 'd MMM yyyy')}` : 'Submitted, awaiting IEC decision'; dueDate = state === 'ok' ? daysAhead(40 + idx * 13) : undefined; break
      case 'ctri': detail = s.ctriNumber ?? 'Registration pending'; break
      case 'protocol': detail = s.id === 'AYU-001' ? 'v3.2 approved' : `v${int(1, 3)}.${int(0, 2)} approved`; break
      case 'consent': detail = s.id === 'AYU-001' ? 'ICF v2.1 (English, Hindi)' : `ICF v${int(1, 2)}.0`; break
      case 'regulatoryDocs': detail = state === 'ok' ? 'Complete' : 'Pending'; break
      case 'insurance': detail = applicable ? `Policy valid to ${format(addDays(TODAY, 21), 'd MMM yyyy')}` : 'Not applicable to this design'; dueDate = applicable ? daysAhead(21) : undefined; break
      case 'amendments': detail = state === 'ok' ? 'No pending amendments' : 'Amendment #2 pending review'; break
      case 'safetyReporting': {
        const overdue = ADVERSE_EVENTS.filter((a) => a.studyId === s.id && a.reviewStatus !== 'Resolved' && new Date(a.dueDate) < TODAY).length
        detail = overdue ? `${overdue} safety report${overdue > 1 ? 's' : ''} overdue` : 'No overdue reports'
        if (overdue) state = s.health.safetyReporting === 'crit' ? 'crit' : 'warn'
        break
      }
      case 'periodicReports': detail = state === 'ok' ? 'Next annual report due in 94 days' : state === 'crit' ? 'Annual report overdue by 6 days' : 'Annual report due in 12 days'; dueDate = daysAhead(state === 'ok' ? 94 : state === 'crit' ? -6 : 12); break
      case 'ndct': detail = applicable ? 'Applicable — configured by regulatory team' : 'Not applicable (configured per study)'; break
    }
    return { key, label, applicable, state, detail, dueDate }
  })

  const t = (d: number) => daysAgo(d)
  const timeline: ComplianceMilestone[] = early
    ? [
        { label: 'Protocol drafted', date: t(14), state: 'done' },
        { label: 'Scientific review', state: 'pending', note: 'Scheduled' },
        { label: 'IEC submission', state: 'upcoming' },
        { label: 'CTRI registration', state: 'upcoming' },
        { label: 'Site activation', state: 'upcoming' },
      ]
    : ethicsReview
      ? [
          { label: 'Protocol submitted', date: t(48), state: 'done' },
          { label: 'IEC review', date: t(20), state: 'pending', note: 'Queries raised — response due' },
          { label: 'IEC approval', state: 'upcoming' },
          { label: 'CTRI registration', state: 'upcoming' },
          { label: 'Site activation', state: 'upcoming' },
        ]
      : [
          { label: 'Protocol submitted', date: t(520), state: 'done' },
          { label: 'IEC approval', date: t(470), state: 'done' },
          { label: 'CTRI registration', date: t(452), state: 'done' },
          { label: 'Site activation', date: t(430), state: 'done' },
          { label: 'Amendment #1', date: t(210), state: 'done' },
          regLevel === 'ok'
            ? { label: 'Annual report', date: t(60), state: 'done' }
            : regLevel === 'crit'
              ? { label: 'Annual report', date: t(6), state: 'overdue', note: 'Overdue by 6 days' }
              : { label: 'Amendment #2', date: t(9), state: 'pending', note: 'Pending review' },
        ]
  return { studyId: s.id, items, timeline }
}
export const COMPLIANCE: StudyCompliance[] = STUDIES.map(complianceFor)

// ---------- documents ----------
const DOC_TEMPLATES: [DocCategory, string, string][] = [
  ['Protocol', 'Protocol', 'pdf'],
  ['Ethics Approval', 'IEC_Approval_Letter', 'pdf'],
  ['CTRI', 'CTRI_Registration_Certificate', 'pdf'],
  ['Consent Forms', 'ICF_English', 'pdf'],
  ['Consent Forms', 'ICF_Hindi', 'pdf'],
  ['Investigator Documents', 'PI_CV_and_GCP_Training', 'pdf'],
  ['Regulatory Documents', 'Insurance_Certificate', 'pdf'],
  ['Monitoring Reports', 'Site_Monitoring_Visit_Report', 'docx'],
  ['Safety Reports', 'DSMB_Safety_Summary', 'pdf'],
  ['Study Reports', 'Interim_Progress_Report', 'docx'],
]
const UPLOADERS = ['Rahul Kumar', 'Dr. Ananya Sharma', 'Sneha Patil', 'Arjun Menon', 'Prof. Meera Iyer']

export const DOCUMENTS: StudyDocument[] = []
{
  let n = 1
  for (const s of STUDIES.slice(0, 14)) {
    for (const [category, base, ext] of DOC_TEMPLATES) {
      if (s.stage === 'Planning' && category !== 'Protocol') continue
      const isProtocol = category === 'Protocol'
      const version = s.id === 'AYU-001' && isProtocol ? '3.2' : isProtocol ? `${int(1, 3)}.${int(0, 2)}` : category === 'Consent Forms' ? `${int(1, 2)}.${int(0, 1)}` : '1.0'
      const uploaded = s.id === 'AYU-001' && isProtocol ? daysAgo(22) : daysAgo(int(5, 300))
      const expires = category === 'Ethics Approval' || category === 'Regulatory Documents'
      let expiry = expires ? daysAhead(int(-5, 300)) : undefined
      if (s.id === 'AYU-001' && category === 'Regulatory Documents') expiry = daysAhead(21)
      if (s.id === 'AYU-002' && category === 'Ethics Approval') expiry = daysAhead(27)
      const expired = expiry && new Date(expiry) < TODAY
      const status = expired ? 'Expired' : s.health.documents === 'crit' && category === 'Monitoring Reports' ? 'Draft' : rand() < 0.1 ? 'Under Review' : 'Approved'
      const major = parseInt(version)
      const minor = parseInt(version.split('.')[1] ?? '0')
      const history = [] as StudyDocument['history']
      const steps: string[] = []
      for (let m = 1; m <= major; m++) steps.push(`${m}.0`)
      if (minor > 0) steps.push(version)
      steps.forEach((v, idx) => {
        const last = idx === steps.length - 1
        history.push({
          version: v,
          uploadedBy: last ? (s.id === 'AYU-001' && isProtocol ? 'Rahul Kumar' : pick(UPLOADERS)) : pick(UPLOADERS),
          uploadedOn: last ? uploaded : daysAgo(300 + (steps.length - idx) * 90),
          status: last ? status : 'Superseded',
          note: idx === 0 ? 'Initial version' : last ? 'Incorporates IEC comments' : 'Amendment',
        })
      })
      DOCUMENTS.push({
        id: `DOC-${String(n++).padStart(4, '0')}`,
        name: `${s.id}_${base}${isProtocol ? `_v${version}` : ''}.${ext}`,
        studyId: s.id,
        category,
        version,
        uploadedBy: history[history.length - 1].uploadedBy,
        uploadedOn: uploaded,
        status,
        expiryDate: expiry,
        sizeKb: int(120, 4800),
        history: history.reverse(),
      })
    }
  }
}

// ---------- audit trail ----------
const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString()
export const AUDIT_EVENTS: AuditEvent[] = [
  { id: 'AUD-20931', timestamp: at(4), user: 'Dr. Ananya Sharma', role: 'Principal Investigator', action: 'Updated participant visit record', objectType: 'Visit', objectId: 'AIIA-AYU001-0001, Day 30', previous: 'Weight = 68.4 kg', next: 'Weight = 67.9 kg', ip: '10.12.4.21' },
  { id: 'AUD-20930', timestamp: at(8), user: 'Rahul Kumar', role: 'Study Coordinator', action: 'Uploaded document', objectType: 'Document', objectId: 'AYU-001_Protocol_v3.2.pdf', previous: 'v3.1', next: 'v3.2', ip: '10.12.4.37' },
  { id: 'AUD-20929', timestamp: at(42), user: 'System', role: 'Automated', action: 'Generated compliance reminder', objectType: 'Compliance', objectId: 'AYU-001, CTRI', next: 'Annual CTRI update due in 30 days', ip: '—' },
  { id: 'AUD-20928', timestamp: at(76), user: 'Dr. Priya Nair', role: 'Pharmacovigilance', action: 'Reviewed adverse event', objectType: 'Adverse Event', objectId: 'AE-00124', previous: 'New', next: 'Medical Review', ip: '10.12.6.14' },
  { id: 'AUD-20927', timestamp: at(95), user: 'Arjun Menon', role: 'Data Manager', action: 'Raised data query', objectType: 'eCRF', objectId: 'AIIA-AYU002-0117, Day 60', next: 'Query Q-4471: Systolic BP 182 — please verify', ip: '10.12.5.9' },
  { id: 'AUD-20926', timestamp: at(130), user: 'Sneha Patil', role: 'Study Coordinator', action: 'Enrolled participant', objectType: 'Participant', objectId: 'AIIA-AYU003-0212', previous: 'Screening', next: 'Enrolled', ip: '10.12.4.52' },
  { id: 'AUD-20925', timestamp: at(181), user: 'Prof. Meera Iyer', role: 'Ethics Committee', action: 'Recorded IEC decision', objectType: 'Amendment', objectId: 'AYU-007, Amendment #1', previous: 'Under Review', next: 'Approved', ip: '10.12.8.3' },
  { id: 'AUD-20924', timestamp: at(240), user: 'Dr. Ananya Sharma', role: 'Principal Investigator', action: 'Signed eCRF', objectType: 'eCRF', objectId: 'AIIA-AYU001-0088, Baseline', previous: 'Complete', next: 'Signed', ip: '10.12.4.21' },
  { id: 'AUD-20923', timestamp: at(312), user: 'Dr. Vikram Rao', role: 'Management', action: 'Exported portfolio report', objectType: 'Report', objectId: 'Portfolio summary (PDF)', ip: '10.12.1.5' },
  { id: 'AUD-20922', timestamp: at(390), user: 'Rahul Kumar', role: 'Study Coordinator', action: 'Rescheduled visit', objectType: 'Visit', objectId: 'AIIA-AYU001-0412, Day 60', previous: daysAgo(1), next: daysAhead(2), ip: '10.12.4.37' },
  { id: 'AUD-20921', timestamp: at(460), user: 'System', role: 'Automated', action: 'Flagged visit as overdue', objectType: 'Visit', objectId: 'AIIA-AYU002-0233, Day 30', previous: 'Upcoming', next: 'Overdue', ip: '—' },
  { id: 'AUD-20920', timestamp: at(610), user: 'Arjun Menon', role: 'Data Manager', action: 'Closed data query', objectType: 'eCRF', objectId: 'AIIA-AYU001-0034, Day 7', previous: 'Open', next: 'Closed — source verified', ip: '10.12.5.9' },
  { id: 'AUD-20919', timestamp: at(820), user: 'Dr. Priya Nair', role: 'Pharmacovigilance', action: 'Updated causality', objectType: 'Adverse Event', objectId: 'AE-00117', previous: 'Possible', next: 'Probable', ip: '10.12.6.14' },
  { id: 'AUD-20918', timestamp: at(1100), user: 'Sneha Patil', role: 'Study Coordinator', action: 'Recorded consent', objectType: 'Participant', objectId: 'AIIA-AYU003-0214', next: 'ICF v1.1 signed', ip: '10.12.4.52' },
  { id: 'AUD-20917', timestamp: at(1440), user: 'Dr. Ananya Sharma', role: 'Principal Investigator', action: 'Changed role permissions', objectType: 'Study team', objectId: 'AYU-001', previous: 'Aditya Verma: View', next: 'Aditya Verma: Edit visits', ip: '10.12.4.21' },
  { id: 'AUD-20916', timestamp: at(1720), user: 'System', role: 'Automated', action: 'Session timed out', objectType: 'Session', objectId: 'karthik.s@aiia.example.in', ip: '10.12.7.40' },
  { id: 'AUD-20915', timestamp: at(2050), user: 'Prof. Meera Iyer', role: 'Ethics Committee', action: 'Viewed SAE report', objectType: 'Adverse Event', objectId: 'AE-00121', ip: '10.12.8.3' },
  { id: 'AUD-20914', timestamp: at(2600), user: 'Rahul Kumar', role: 'Study Coordinator', action: 'Activated site', objectType: 'Site', objectId: 'S08, Ayurveda Research Clinic, Ahmedabad', previous: 'Activation Pending', next: 'Active', ip: '10.12.4.37' },
]

// ---------- notifications ----------
const OVERDUE_VISITS = PARTICIPANTS.filter((p) => p.status !== 'Completed' && p.status !== 'Screen Failure').reduce((n, p) => n + scheduleFor(p).filter((v) => v.status === 'Overdue').length, 0)
export const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', level: 'critical', title: 'SAE requires review', detail: 'AE-00121, hospitalisation with severe hypoglycaemia (AYU-001). The expedited report is overdue.', time: at(25), read: false, link: '/safety?event=AE-00121' },
  { id: 'n2', level: 'warning', title: `${OVERDUE_VISITS} participant visits are overdue`, detail: 'Past their target date and not yet recorded. Review the visit schedule.', time: at(70), read: false, link: '/visits?status=Overdue' },
  { id: 'n3', level: 'warning', title: '2 regulatory documents expire within 30 days', detail: 'AYU-001 insurance certificate and AYU-002 IEC approval letter.', time: at(180), read: false, link: '/documents?expiring=30' },
  { id: 'n4', level: 'warning', title: '27 clinical data queries remain open', detail: 'AYU-001 has 27 open queries; 9 are older than 14 days.', time: at(300), read: false, link: '/ecrf' },
  { id: 'n5', level: 'info', title: 'Amendment #2 submitted to IEC', detail: 'AYU-001 protocol v3.2 is awaiting committee review.', time: at(560), read: true, link: '/ethics' },
  { id: 'n6', level: 'success', title: 'CTRI registration completed', detail: 'AYU-038 registration number recorded.', time: at(1300), read: true, link: '/ethics' },
  { id: 'n7', level: 'success', title: 'Ethics approval recorded', detail: 'AYU-007 Amendment #1 approved by IEC.', time: at(1500), read: true, link: '/ethics' },
]
