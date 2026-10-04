// eCRF field definitions (CDASH-style field codes), seed values and validation rules.
import type { Participant, Study, Visit } from '@/types'
import { AGNI_OPTS, BALA_OPTS, KOSTHA_OPTS, PRAKRITI_OPTS, SATMYA_OPTS, VIKRITI_OPTS, ayurvedaFor, isoAdd, seeded, todayIso } from './shared'

export type Values = Record<string, string>
export type FieldKind = 'date' | 'number' | 'text' | 'textarea' | 'select' | 'radio' | 'derived'

export interface FieldDef {
  id: string
  code: string
  label: string
  kind: FieldKind
  unit?: string
  options?: readonly string[]
  required?: boolean
  /** Expected clinical range: outside it raises a soft (amber) check. */
  range?: [number, number]
  /** Plausibility limits: outside them is a hard (red) error. */
  hard?: [number, number]
  step?: string
  width?: string
  placeholder?: string
  showIf?: (v: Values) => boolean
}

export interface RowDef { label: string; fields: string[]; hint?: string; showIf?: (v: Values) => boolean }
export interface SectionDef { id: string; code: string; title: string; rows: RowDef[] }

const yes = (k: string) => (v: Values) => v[k] === 'Yes'

export const FIELDS: FieldDef[] = [
  { id: 'visdat', code: 'SV.SVSTDTC', label: 'Visit date', kind: 'date', required: true },
  { id: 'sysbp', code: 'VS.SYSBP', label: 'Systolic blood pressure', kind: 'number', unit: 'mmHg', required: true, range: [90, 160], hard: [50, 260], width: 'w-24' },
  { id: 'diabp', code: 'VS.DIABP', label: 'Diastolic blood pressure', kind: 'number', unit: 'mmHg', required: true, range: [60, 100], hard: [30, 160], width: 'w-24' },
  { id: 'vspos', code: 'VS.VSPOS', label: 'Position', kind: 'select', options: ['Sitting', 'Supine', 'Standing'], width: 'w-32' },
  { id: 'pulse', code: 'VS.PULSE', label: 'Heart rate', kind: 'number', unit: 'bpm', required: true, range: [50, 110], hard: [25, 220], width: 'w-28' },
  { id: 'temp', code: 'VS.TEMP', label: 'Temperature', kind: 'number', unit: '°C', required: true, range: [35.5, 38], hard: [32, 43], step: '0.1', width: 'w-28' },
  { id: 'resp', code: 'VS.RESP', label: 'Respiratory rate', kind: 'number', unit: '/min', required: true, range: [12, 24], hard: [5, 60], width: 'w-28' },
  { id: 'weight', code: 'VS.WEIGHT', label: 'Weight', kind: 'number', unit: 'kg', required: true, range: [35, 150], hard: [20, 250], step: '0.1', width: 'w-28' },
  { id: 'height', code: 'VS.HEIGHT', label: 'Height', kind: 'number', unit: 'cm', required: true, range: [130, 200], hard: [90, 230], step: '0.1', width: 'w-28' },
  { id: 'bmi', code: 'VS.BMI', label: 'BMI', kind: 'derived', unit: 'kg/m²', width: 'w-28' },

  { id: 'sympt', code: 'CA.SYMPT', label: 'Presenting symptoms', kind: 'textarea', required: true, placeholder: 'Describe symptoms reported since the last visit' },
  { id: 'finding', code: 'CA.FINDING', label: 'Clinical findings', kind: 'textarea', placeholder: 'Examination findings' },
  { id: 'outscr', code: 'CA.OUTSCR', label: 'Outcome measure score', kind: 'number', unit: '/ 40', required: true, hard: [0, 40], width: 'w-28' },
  { id: 'cgi', code: 'CA.CGIC', label: 'Global impression of change', kind: 'select', options: ['Much improved', 'Minimally improved', 'No change', 'Minimally worse', 'Much worse'], width: 'w-56' },

  { id: 'prakriti', code: 'AY.PRAKRITI', label: 'Prakriti', kind: 'select', options: PRAKRITI_OPTS, required: true, width: 'w-56' },
  { id: 'vikriti', code: 'AY.VIKRITI', label: 'Vikriti', kind: 'select', options: VIKRITI_OPTS, required: true, width: 'w-56' },
  { id: 'agni', code: 'AY.AGNI', label: 'Agni', kind: 'select', options: AGNI_OPTS, required: true, width: 'w-56' },
  { id: 'kostha', code: 'AY.KOSTHA', label: 'Kostha', kind: 'select', options: KOSTHA_OPTS, required: true, width: 'w-56' },
  { id: 'bala', code: 'AY.BALA', label: 'Bala', kind: 'select', options: BALA_OPTS, required: true, width: 'w-56' },
  { id: 'satmya', code: 'AY.SATMYA', label: 'Satmya', kind: 'select', options: SATMYA_OPTS, required: true, width: 'w-56' },

  { id: 'extrt', code: 'EX.EXTRT', label: 'Intervention', kind: 'derived' },
  { id: 'dose', code: 'EX.EXDOSE', label: 'Dose', kind: 'number', unit: 'g', required: true, hard: [0, 30], step: '0.5', width: 'w-24' },
  { id: 'freq', code: 'EX.EXDOSFRQ', label: 'Frequency', kind: 'select', options: ['OD (once daily)', 'BD (twice daily)', 'TDS (thrice daily)'], required: true, width: 'w-48' },
  { id: 'anupana', code: 'EX.ANUPANA', label: 'Anupana (vehicle)', kind: 'select', options: ['Lukewarm water', 'Milk', 'Honey', 'Ghee', 'Buttermilk'], width: 'w-48' },
  { id: 'comply', code: 'EX.COMPLY', label: 'Medication compliance', kind: 'radio', options: ['Excellent', 'Good', 'Poor'], required: true },
  { id: 'cmyn', code: 'CM.CMYN', label: 'Change in concomitant medication', kind: 'radio', options: ['Yes', 'No'], required: true },

  { id: 'aeyn', code: 'AE.AEYN', label: 'Any adverse event since last visit', kind: 'radio', options: ['Yes', 'No'], required: true },
  { id: 'aeterm', code: 'AE.AETERM', label: 'Event term', kind: 'text', required: true, placeholder: 'e.g. Loose stools', width: 'w-72', showIf: yes('aeyn') },
  { id: 'aesev', code: 'AE.AESEV', label: 'Severity', kind: 'select', options: ['Mild', 'Moderate', 'Severe'], required: true, width: 'w-40', showIf: yes('aeyn') },
  { id: 'aeser', code: 'AE.AESER', label: 'Serious', kind: 'radio', options: ['Yes', 'No'], required: true, showIf: yes('aeyn') },
]
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.id, f])) as Record<string, FieldDef>

export const SECTIONS: SectionDef[] = [
  { id: 'sv', code: 'SV', title: 'Visit details', rows: [{ label: 'Visit date', fields: ['visdat'] }] },
  {
    id: 'vs', code: 'VS', title: 'Vital signs', rows: [
      { label: 'Blood pressure', fields: ['sysbp', 'diabp'], hint: 'Systolic / diastolic, after 5 minutes rest' },
      { label: 'Position', fields: ['vspos'] },
      { label: 'Heart rate', fields: ['pulse'] },
      { label: 'Temperature', fields: ['temp'], hint: 'Oral' },
      { label: 'Respiratory rate', fields: ['resp'] },
      { label: 'Weight', fields: ['weight'] },
      { label: 'Height', fields: ['height'] },
      { label: 'BMI', fields: ['bmi'], hint: 'Calculated from weight and height' },
    ],
  },
  {
    id: 'ca', code: 'CA', title: 'Clinical assessment', rows: [
      { label: 'Presenting symptoms', fields: ['sympt'] },
      { label: 'Clinical findings', fields: ['finding'] },
      { label: 'Outcome measure score', fields: ['outscr'], hint: 'Protocol-specified symptom scale, 0 to 40' },
      { label: 'Global impression of change', fields: ['cgi'] },
    ],
  },
  {
    id: 'ay', code: 'AY', title: 'Ayurveda-specific assessment', rows: [
      { label: 'Prakriti', fields: ['prakriti'], hint: 'Constitution' },
      { label: 'Vikriti', fields: ['vikriti'], hint: 'Current dosha imbalance' },
      { label: 'Agni', fields: ['agni'], hint: 'Digestive capacity' },
      { label: 'Kostha', fields: ['kostha'], hint: 'Bowel nature' },
      { label: 'Bala', fields: ['bala'], hint: 'Strength' },
      { label: 'Satmya', fields: ['satmya'], hint: 'Adaptability' },
    ],
  },
  {
    id: 'ex', code: 'EX', title: 'Treatment information', rows: [
      { label: 'Intervention', fields: ['extrt'] },
      { label: 'Dose', fields: ['dose'], hint: 'Per administration' },
      { label: 'Frequency', fields: ['freq'] },
      { label: 'Anupana (vehicle)', fields: ['anupana'] },
      { label: 'Medication compliance', fields: ['comply'], hint: 'Excellent ≥90%, good 75–89%, poor <75% by pill count' },
      { label: 'Change in concomitant medication', fields: ['cmyn'] },
    ],
  },
  {
    id: 'ae', code: 'AE', title: 'Safety', rows: [
      { label: 'Any adverse event since last visit', fields: ['aeyn'] },
      { label: 'Event term', fields: ['aeterm'], showIf: yes('aeyn') },
      { label: 'Severity', fields: ['aesev'], showIf: yes('aeyn') },
      { label: 'Serious', fields: ['aeser'], showIf: yes('aeyn') },
    ],
  },
]

export const visible = (f: FieldDef, v: Values) => !f.showIf || f.showIf(v)

export function bmiOf(v: Values): string {
  const w = Number(v.weight), h = Number(v.height)
  if (!v.weight || !v.height || !w || !h) return ''
  return (w / (h / 100) ** 2).toFixed(1)
}

export interface Issue { field: string; level: 'error' | 'warn'; message: string }

export function validate(v: Values, ctx: { enrollmentDate?: string; visit?: Visit }): Issue[] {
  const out: Issue[] = []
  for (const f of FIELDS) {
    if (f.kind === 'derived' || !visible(f, v)) continue
    const raw = (v[f.id] ?? '').trim()
    if (!raw) {
      if (f.required) out.push({ field: f.id, level: 'error', message: 'Required field missing' })
      continue
    }
    if (f.kind === 'number') {
      const n = Number(raw)
      if (Number.isNaN(n)) { out.push({ field: f.id, level: 'error', message: 'Enter a numeric value' }); continue }
      if (f.hard && (n < f.hard[0] || n > f.hard[1])) { out.push({ field: f.id, level: 'error', message: `Value not plausible, allowed ${f.hard[0]}–${f.hard[1]} ${f.unit ?? ''}`.trim() }); continue }
      if (f.range && (n < f.range[0] || n > f.range[1])) out.push({ field: f.id, level: 'warn', message: 'Value outside expected range — please verify' })
    }
  }
  if (v.visdat) {
    if (ctx.enrollmentDate && v.visdat < ctx.enrollmentDate && ctx.visit?.visit !== 'Screening') out.push({ field: 'visdat', level: 'error', message: 'Visit date cannot precede enrollment date' })
    else if (v.visdat > todayIso()) out.push({ field: 'visdat', level: 'error', message: 'Visit date cannot be in the future' })
    else if (ctx.visit && ctx.visit.windowDays >= 0) {
      const lo = isoAdd(ctx.visit.scheduledDate, -ctx.visit.windowDays)
      const hi = isoAdd(ctx.visit.scheduledDate, ctx.visit.windowDays)
      if (v.visdat < lo || v.visdat > hi) out.push({ field: 'visdat', level: 'warn', message: 'Visit date outside protocol window — please verify' })
    }
  }
  const sys = Number(v.sysbp), dia = Number(v.diabp)
  if (v.sysbp && v.diabp && sys && dia && dia >= sys) out.push({ field: 'diabp', level: 'error', message: 'Diastolic must be lower than systolic' })
  return out
}

// ---------- seed values ----------
const SYMPTOMS = [
  'Reduced polyuria and fatigue since last visit. Occasional tingling in feet in the evening.',
  'Mild improvement in joint stiffness; morning stiffness now about 20 minutes.',
  'No new complaints. Appetite and sleep reported as normal.',
  'Intermittent bloating after meals, less frequent than at baseline.',
  'Reports better energy levels. Occasional headache, relieved by rest.',
]
const FINDINGS = [
  'No pedal oedema. Peripheral pulses palpable. Monofilament sensation intact bilaterally.',
  'Mild crepitus right knee, no effusion. Range of movement improved.',
  'General examination unremarkable. Tongue mildly coated (sama).',
  'Abdomen soft, non-tender. No organomegaly.',
]

export const DEFAULT_PID = 'AIIA-AYU001-0001'
export const DEFAULT_VISIT = 'Day 30'

export function seedValues(p: Participant, visit: Visit | undefined, study: Study | undefined): { values: Values; filled: boolean } {
  const ayur = ayurvedaFor(p)
  const base: Values = { extrt: study?.intervention ?? 'As per protocol', vspos: 'Sitting' }
  if (!visit || visit.status !== 'Completed') return { values: { ...base, visdat: '' }, filled: false }
  const pr = seeded(`${p.id}:body`)
  const height = pr.int(150, 178)
  const baseWeight = pr.float(52, 84)
  if (p.id === DEFAULT_PID && visit.visit === DEFAULT_VISIT) {
    return {
      filled: true,
      values: {
        ...base,
        visdat: visit.actualDate ?? visit.scheduledDate,
        sysbp: '128', diabp: '82', pulse: '74', temp: '36.8', resp: '', weight: '68.4', height: '162',
        sympt: SYMPTOMS[0], finding: FINDINGS[0], outscr: '18', cgi: 'Minimally improved',
        prakriti: ayur.prakriti, vikriti: ayur.vikriti, agni: ayur.agni, kostha: ayur.kostha, bala: ayur.bala, satmya: ayur.satmya,
        dose: '3', freq: 'BD (twice daily)', anupana: 'Lukewarm water', comply: 'Good', cmyn: 'No', aeyn: 'No',
      },
    }
  }
  const r = seeded(`${p.id}:${visit.visit}:crf`)
  const ae = r.next() < 0.1
  return {
    filled: true,
    values: {
      ...base,
      visdat: visit.actualDate ?? visit.scheduledDate,
      sysbp: String(r.int(112, 138)), diabp: String(r.int(70, 88)), pulse: String(r.int(64, 88)),
      temp: r.float(36.4, 37.2).toFixed(1), resp: String(r.int(14, 20)),
      weight: (baseWeight + r.float(-1.2, 1.2)).toFixed(1), height: String(height),
      sympt: r.pick(SYMPTOMS), finding: r.pick(FINDINGS), outscr: String(r.int(8, 26)), cgi: r.pick(['Much improved', 'Minimally improved', 'Minimally improved', 'No change']),
      prakriti: ayur.prakriti, vikriti: ayur.vikriti, agni: ayur.agni, kostha: ayur.kostha, bala: ayur.bala, satmya: ayur.satmya,
      dose: '3', freq: 'BD (twice daily)', anupana: r.pick(['Lukewarm water', 'Milk', 'Lukewarm water']), comply: r.pick(['Excellent', 'Good', 'Good', 'Poor']),
      cmyn: 'No', aeyn: ae ? 'Yes' : 'No',
      ...(ae ? { aeterm: r.pick(['Loose stools', 'Mild nausea', 'Acidity / heartburn']), aesev: 'Mild', aeser: 'No' } : {}),
    },
  }
}

// ---------- queries ----------
export interface QueryMsg { author: string; role: string; at: string; text: string }
export interface DataQuery { id: string; field: string; status: 'Open' | 'Closed'; messages: QueryMsg[] }

export function seedQueries(pid: string, visit: string): DataQuery[] {
  if (pid !== DEFAULT_PID || visit !== DEFAULT_VISIT) return []
  return [
    {
      id: 'Q-4471', field: 'weight', status: 'Open',
      messages: [{ author: 'Arjun Menon', role: 'Data Manager', at: isoAdd(todayIso(), -2), text: 'Weight changed by >2 kg since Day 7 — please confirm source.' }],
    },
    {
      id: 'Q-4480', field: 'outscr', status: 'Open',
      messages: [{ author: 'Arjun Menon', role: 'Data Manager', at: isoAdd(todayIso(), -1), text: 'Score entered as 18; source worksheet items total 16. Please reconcile.' }],
    },
  ]
}
