import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Modal } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { studyService } from '@/services'
import { cx, fmtDate } from '@/lib/format'
import type { Site, Study, StudyPhase, StudyType } from '@/types'

const TYPES: StudyType[] = ['Interventional', 'Observational', 'Pilot / Feasibility', 'Supportive Care']
const PHASES: StudyPhase[] = ['Pilot', 'Phase II', 'Phase III', 'Phase IV', 'N/A']
const STEPS = ['Basics', 'Team and sites', 'Design', 'Review'] as const

interface Form {
  title: string
  shortTitle: string
  type: StudyType | ''
  phase: StudyPhase | ''
  department: string
  pi: string
  coordinator: string
  siteIds: string[]
  intervention: string
  comparator: string
  primaryObjective: string
  target: string
  startDate: string
  expectedCompletion: string
}

const EMPTY: Form = {
  title: '', shortTitle: '', type: '', phase: '', department: '', pi: '', coordinator: '', siteIds: [],
  intervention: '', comparator: '', primaryObjective: '', target: '', startDate: '', expectedCompletion: '',
}

type Errors = Partial<Record<keyof Form, string>>

function validate(step: number, f: Form): Errors {
  const e: Errors = {}
  const req = (k: keyof Form, label: string) => { if (!String(f[k]).trim()) e[k] = `${label} is required` }
  if (step === 0) {
    req('title', 'Study title')
    if (f.title.trim() && f.title.trim().length < 10) e.title = 'Use the full protocol title (at least 10 characters)'
    req('shortTitle', 'Short title')
    req('type', 'Study type')
    req('phase', 'Study phase')
    req('department', 'Department')
  }
  if (step === 1) {
    req('pi', 'Principal investigator')
    req('coordinator', 'Study coordinator')
    if (!f.siteIds.length) e.siteIds = 'Select at least one site'
  }
  if (step === 2) {
    req('intervention', 'Intervention')
    req('comparator', 'Comparator')
    req('primaryObjective', 'Primary objective')
    const t = Number(f.target)
    if (!f.target.trim()) e.target = 'Target sample size is required'
    else if (!Number.isInteger(t) || t <= 0) e.target = 'Enter a whole number greater than 0'
    req('startDate', 'Start date')
    req('expectedCompletion', 'Expected completion')
    if (f.startDate && f.expectedCompletion && f.expectedCompletion <= f.startDate) e.expectedCompletion = 'Expected completion must be after the start date'
  }
  return e
}

export function NewStudyWizard({ open, onClose, sites, pis, coordinators, departments }: {
  open: boolean; onClose: () => void; sites: Site[]; pis: string[]; coordinators: string[]; departments: string[]
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  // Reset the wizard each time it opens (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setStep(0); setForm(EMPTY); setErrors({}) }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const next = () => {
    const e = validate(step, form)
    setErrors(e)
    if (Object.keys(e).length === 0) setStep((s) => s + 1)
  }

  const submit = async () => {
    for (let i = 0; i < 3; i++) {
      const e = validate(i, form)
      if (Object.keys(e).length) { setErrors(e); setStep(i); return }
    }
    setSaving(true)
    try {
      const input: Omit<Study, 'id'> = {
        title: form.title.trim(), shortTitle: form.shortTitle.trim(),
        type: form.type as StudyType, phase: form.phase as StudyPhase, department: form.department,
        pi: form.pi, coordinator: form.coordinator,
        intervention: form.intervention.trim(), comparator: form.comparator.trim(), primaryObjective: form.primaryObjective.trim(),
        siteIds: form.siteIds, enrolled: 0, target: Number(form.target),
        startDate: form.startDate, expectedCompletion: form.expectedCompletion,
        stage: 'Planning', lifecycle: 'Protocol', status: 'On Track',
        dataQuality: 0, compliance: 0, completedVisits: 0, deviations: 0, openQueries: 0, adverseEvents: 0,
        health: { recruitment: 'ok', dataCompletion: 'ok', deviations: 'ok', safetyReporting: 'ok', regulatory: 'ok', documents: 'ok' },
      }
      const created = await studyService.create(input)
      toast('success', 'Study created')
      onClose()
      navigate(`/studies/${created.id}`)
    } catch {
      toast('error', 'The study could not be created. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites])
  const toggleSite = (id: string) =>
    set('siteIds', form.siteIds.includes(id) ? form.siteIds.filter((x) => x !== id) : [...form.siteIds, id])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New study"
      description="Register a study in planning. Ethics, CTRI and regulatory requirements are configured in the workspace afterwards."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="mr-auto">Cancel</Button>
          {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>Back</Button>}
          {step < 3
            ? <Button variant="primary" onClick={next}>Next</Button>
            : <Button variant="primary" onClick={submit} loading={saving}>Create study</Button>}
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cx(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < step ? 'bg-ok text-white' : i === step ? 'bg-ink text-white' : 'bg-canvas text-muted ring-1 ring-line-2',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cx('hidden text-[13px] whitespace-nowrap sm:inline', i === step ? 'font-medium text-ink' : 'text-muted')}>{s}</span>
            {i < STEPS.length - 1 && <span className={cx('h-px flex-1', i < step ? 'bg-ok' : 'bg-line-2')} aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Study title" required error={errors.title} htmlFor="ns-title" className="md:col-span-2">
            <Input id="ns-title" value={form.title} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Ayurvedic Management of Chronic Migraine" />
          </Field>
          <Field label="Short title" required error={errors.shortTitle} htmlFor="ns-short" hint="Used in lists and reports">
            <Input id="ns-short" value={form.shortTitle} invalid={!!errors.shortTitle} onChange={(e) => set('shortTitle', e.target.value)} placeholder="e.g. Migraine" />
          </Field>
          <Field label="Department" required error={errors.department} htmlFor="ns-dept">
            <Select id="ns-dept" value={form.department} invalid={!!errors.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Study type" required error={errors.type} htmlFor="ns-type">
            <Select id="ns-type" value={form.type} invalid={!!errors.type} onChange={(e) => set('type', e.target.value as StudyType)}>
              <option value="">Select type</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Study phase" required error={errors.phase} htmlFor="ns-phase">
            <Select id="ns-phase" value={form.phase} invalid={!!errors.phase} onChange={(e) => set('phase', e.target.value as StudyPhase)}>
              <option value="">Select phase</option>
              {PHASES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Principal investigator" required error={errors.pi} htmlFor="ns-pi">
            <Select id="ns-pi" value={form.pi} invalid={!!errors.pi} onChange={(e) => set('pi', e.target.value)}>
              <option value="">Select investigator</option>
              {pis.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Study coordinator" required error={errors.coordinator} htmlFor="ns-coord">
            <Select id="ns-coord" value={form.coordinator} invalid={!!errors.coordinator} onChange={(e) => set('coordinator', e.target.value)}>
              <option value="">Select coordinator</option>
              {coordinators.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">Sites<span className="ml-0.5 text-crit" aria-hidden>*</span></span>
              <span className="text-xs text-muted">{form.siteIds.length} selected</span>
            </div>
            <div className={cx('scroll-thin max-h-64 overflow-y-auto rounded-[var(--radius-ctl)] border', errors.siteIds ? 'border-crit' : 'border-line-2')}>
              {sites.map((s) => {
                const checked = form.siteIds.includes(s.id)
                return (
                  <label key={s.id} className={cx('flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas', checked && 'bg-info-soft/40')}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSite(s.id)} className="accent-ink" />
                    <span className="w-9 font-mono text-[12.5px] text-muted">{s.id}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{s.name}<span className="text-muted">, {s.city}</span></span>
                    {s.status !== 'Active' && <Badge tone="warn">{s.status}</Badge>}
                  </label>
                )
              })}
            </div>
            {errors.siteIds && <p className="mt-1 text-xs text-crit" role="alert">{errors.siteIds}</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Intervention" required error={errors.intervention} htmlFor="ns-int">
            <Input id="ns-int" value={form.intervention} invalid={!!errors.intervention} onChange={(e) => set('intervention', e.target.value)} placeholder="Formulation, dose and regimen" />
          </Field>
          <Field label="Comparator" required error={errors.comparator} htmlFor="ns-comp">
            <Input id="ns-comp" value={form.comparator} invalid={!!errors.comparator} onChange={(e) => set('comparator', e.target.value)} placeholder="e.g. Standard care" />
          </Field>
          <Field label="Primary objective" required error={errors.primaryObjective} htmlFor="ns-obj" className="md:col-span-2">
            <Textarea id="ns-obj" rows={3} value={form.primaryObjective} invalid={!!errors.primaryObjective} onChange={(e) => set('primaryObjective', e.target.value)} />
          </Field>
          <Field label="Target sample size" required error={errors.target} htmlFor="ns-target">
            <Input id="ns-target" type="number" min={1} inputMode="numeric" value={form.target} invalid={!!errors.target} onChange={(e) => set('target', e.target.value)} />
          </Field>
          <div className="hidden md:block" />
          <Field label="Start date" required error={errors.startDate} htmlFor="ns-start">
            <Input id="ns-start" type="date" value={form.startDate} invalid={!!errors.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Expected completion" required error={errors.expectedCompletion} htmlFor="ns-end">
            <Input id="ns-end" type="date" value={form.expectedCompletion} min={form.startDate || undefined} invalid={!!errors.expectedCompletion} onChange={(e) => set('expectedCompletion', e.target.value)} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <ReviewBlock title="Basics" onEdit={() => setStep(0)} rows={[
            ['Study title', form.title], ['Short title', form.shortTitle], ['Study type', form.type],
            ['Study phase', form.phase], ['Department', form.department],
          ]} />
          <ReviewBlock title="Team and sites" onEdit={() => setStep(1)} rows={[
            ['Principal investigator', form.pi], ['Study coordinator', form.coordinator],
            ['Sites', form.siteIds.map((id) => siteName.get(id)?.name ?? id).join(', ')],
          ]} />
          <ReviewBlock title="Design" onEdit={() => setStep(2)} rows={[
            ['Intervention', form.intervention], ['Comparator', form.comparator], ['Primary objective', form.primaryObjective],
            ['Target sample size', Number(form.target).toLocaleString('en-IN')], ['Start date', fmtDate(form.startDate)],
            ['Expected completion', fmtDate(form.expectedCompletion)],
          ]} />
          <p className="rounded-[var(--radius-ctl)] bg-info-soft px-3 py-2 text-[13px] text-info">
            The study will be created in the Planning stage at the Protocol step. The action is recorded in the audit trail.
          </p>
        </div>
      )}
    </Modal>
  )
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <button onClick={onEdit} className="text-[13px] font-medium text-info hover:underline">Edit</button>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 px-3 py-2.5 text-[13px] sm:grid-cols-[180px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-ink">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
