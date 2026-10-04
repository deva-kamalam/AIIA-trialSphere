import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, FileSignature, Lock, MessageSquareWarning, Save, SearchX, ShieldCheck,
} from 'lucide-react'
import { ecrfService, participantService, siteService, studyService, type EcrfRecord } from '@/services'
import { useAsync } from '@/lib/hooks'
import { cx, fmtDate } from '@/lib/format'
import { useAuth } from '@/auth/useAuth'
import { TODAY } from '@/data/seed'
import { VISIT_SCHEDULE } from '@/types'
import type { Participant, Site, Study, Visit } from '@/types'
import { Badge, Button, EmptyState, Input, Mono, PageHeader, Panel, Progress, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { Modal, Popover } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import {
  DEFAULT_PID, DEFAULT_VISIT, FIELD, FIELDS, SECTIONS, bmiOf, seedQueries, seedValues, validate, visible,
  type DataQuery, type FieldDef, type Issue, type Values,
} from './participants/ecrfModel'
import { hashStr, visitLabel } from './participants/shared'

type FormState = 'Draft' | 'Complete' | 'Signed'

export default function Ecrf() {
  const [params, setParams] = useSearchParams()
  const pid = (params.get('participant') ?? DEFAULT_PID).trim().toUpperCase()
  const rawVisit = params.get('visit') ?? DEFAULT_VISIT
  const visitName = /^\d+$/.test(rawVisit) ? VISIT_SCHEDULE[Number(rawVisit)] ?? DEFAULT_VISIT : rawVisit

  const { data: participants, loading: pLoading } = useAsync(() => participantService.list(), [])
  const { data: schedule, loading: sLoading } = useAsync(() => participantService.schedule(pid), [pid])
  const { data: studies } = useAsync(() => studyService.list(), [])
  const { data: sites } = useAsync(() => siteService.list(), [])
  const { data: saved, loading: rLoading } = useAsync(() => ecrfService.get(pid, visitName), [pid, visitName])

  const p = participants?.find((x) => x.id === pid)
  const study = studies?.find((s) => s.id === p?.studyId)
  const site = sites?.find((s) => s.id === p?.siteId)
  const visit = schedule?.find((v) => v.visit === visitName)

  const go = (participant: string, v: string) =>
    setParams((prev) => { const n = new URLSearchParams(prev); n.set('participant', participant); n.set('visit', v); return n }, { replace: true })

  const loading = pLoading || sLoading || rLoading || !studies || !sites

  return (
    <div>
      <PageHeader
        title="Electronic case report forms"
        subtitle="Structured visit data entry with edit checks, data queries and investigator sign-off."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <SubjectPicker key={pid} participants={participants ?? []} pid={pid} visitName={visitName} schedule={schedule ?? []} onChange={go} />
        </aside>
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-96 w-full" /></div>
          ) : !p ? (
            <Panel><EmptyState icon={SearchX} title="Participant not found" body={`No participant record matches ${pid}. Choose a participant from the list on the left.`} /></Panel>
          ) : !visit ? (
            <Panel><EmptyState icon={SearchX} title="Visit not found" body={`${visitName} is not part of this participant's schedule.`} /></Panel>
          ) : (
            <EcrfForm key={`${p.id}|${visit.visit}|${saved?.savedAt ?? 'seed'}`} p={p} visit={visit} study={study} site={site} saved={saved} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- Left rail: participant + visit ----------------
function SubjectPicker({ participants, pid, visitName, schedule, onChange }: {
  participants: Participant[]; pid: string; visitName: string; schedule: Visit[]; onChange: (pid: string, visit: string) => void
}) {
  const [text, setText] = useState(pid)
  const [err, setErr] = useState('')
  const matches = useMemo(() => {
    const q = text.trim().toUpperCase()
    if (q.length < 2) return []
    return participants.filter((x) => x.id.includes(q)).slice(0, 30)
  }, [participants, text])
  const apply = () => {
    const id = text.trim().toUpperCase()
    if (id === pid) return
    const hit = participants.find((x) => x.id === id)
    if (!hit) { setErr('No participant with this ID'); return }
    setErr('')
    onChange(id, hit.currentVisit === 'Screening' ? 'Screening' : visitName)
  }
  return (
    <section className="rounded-[var(--radius-panel)] border border-line bg-white p-4">
      <label htmlFor="crf-pid" className="text-[13px] font-medium text-ink">Participant</label>
      <Input
        id="crf-pid"
        list="crf-pid-list"
        value={text}
        invalid={!!err}
        onChange={(e) => setText(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
        className="mt-1 font-mono text-[13px]"
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id="crf-pid-list">{matches.map((m) => <option key={m.id} value={m.id} />)}</datalist>
      {err ? <p className="mt-1 text-xs text-crit" role="alert">{err}</p> : <p className="mt-1 text-xs text-faint">Type part of an ID to search</p>}

      <label htmlFor="crf-visit" className="mt-3 block text-[13px] font-medium text-ink">Visit</label>
      <Select id="crf-visit" value={visitName} onChange={(e) => onChange(pid, e.target.value)} className="mt-1">
        {(schedule.length ? schedule.map((v) => v.visit) : VISIT_SCHEDULE).map((v) => {
          const s = schedule.find((x) => x.visit === v)
          return <option key={v} value={v}>{visitLabel(v)}{s ? ` (${s.status.toLowerCase()})` : ''}</option>
        })}
      </Select>
    </section>
  )
}

// ---------------- The form ----------------
function EcrfForm({ p, visit, study, site, saved }: { p: Participant; visit: Visit; study?: Study; site?: Site; saved: EcrfRecord | null }) {
  const { user, can } = useAuth()
  const toast = useToast()
  const seed = useMemo(() => seedValues(p, visit, study), [p, visit, study])
  const isDefault = p.id === DEFAULT_PID && visit.visit === DEFAULT_VISIT
  const seedState: FormState = !seed.filled || isDefault ? 'Draft' : hashStr(`${p.id}:${visit.visit}`) % 3 === 0 ? 'Complete' : 'Signed'
  // A record saved earlier in this demo takes precedence over generated seed values.
  const initialState: FormState = saved?.state ?? seedState

  const [values, setValues] = useState<Values>(saved?.values ?? seed.values)
  const [state, setState] = useState<FormState>(initialState)
  const [lastSaved, setLastSaved] = useState<Date | null>(
    saved ? new Date(saved.savedAt)
      : seed.filled ? (isDefault ? new Date(new Date(TODAY).setHours(9, 42)) : new Date(`${visit.actualDate ?? visit.scheduledDate}T16:20:00`)) : null,
  )
  const [savedBy, setSavedBy] = useState(saved?.savedBy ?? (isDefault ? 'Rahul Kumar' : visit.coordinator))
  const [signed, setSigned] = useState<{ by: string; at: Date } | null>(
    saved?.signedBy && saved.signedAt ? { by: saved.signedBy, at: new Date(saved.signedAt) }
      : !saved && seedState === 'Signed' ? { by: site?.investigator ?? 'Site investigator', at: new Date(`${visit.actualDate ?? visit.scheduledDate}T18:05:00`) } : null,
  )
  const [queries, setQueries] = useState<DataQuery[]>(() => saved?.queries ?? seedQueries(p.id, visit.visit))
  const [showAll, setShowAll] = useState(seed.filled || !!saved)

  const persist = (next: { state: FormState; queries?: DataQuery[]; signed?: { by: string; at: Date } | null }) => {
    const sig = next.signed === undefined ? signed : next.signed
    const rec: EcrfRecord = {
      participantId: p.id, visit: visit.visit, values, state: next.state,
      savedAt: new Date().toISOString(), savedBy: user?.name ?? 'Unknown',
      signedBy: sig?.by, signedAt: sig?.at.toISOString(), queries: next.queries ?? queries,
    }
    return ecrfService.save(rec, saved?.values ?? seed.values, (k) => (FIELD[k] ? `${FIELD[k].label} (${FIELD[k].code})` : k))
  }
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [verified, setVerified] = useState(false)
  const [blocked, setBlocked] = useState<null | { errors: Issue[]; needVerify: boolean }>(null)
  const [signOpen, setSignOpen] = useState(false)

  const missed = visit.status === 'Missed'
  const canEdit = can('ecrf:edit')
  const readOnly = !canEdit || state === 'Signed' || missed
  const isPI = user?.role === 'pi'

  const v: Values = useMemo(() => ({ ...values, bmi: bmiOf(values) }), [values])
  const issues = useMemo(() => validate(v, { enrollmentDate: p.enrollmentDate, visit }), [v, p.enrollmentDate, visit])
  const issueFor = (id: string) => issues.find((i) => i.field === id && (i.level === 'warn' || showAll || touched.has(id) || i.message !== 'Required field missing'))
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warn')
  const openQueries = queries.filter((q) => q.status === 'Open')

  const required = FIELDS.filter((f) => f.required && f.kind !== 'derived' && visible(f, v))
  const filledReq = required.filter((f) => (v[f.id] ?? '').trim() !== '' && !errors.some((e) => e.field === f.id))
  const progress = required.length ? (filledReq.length / required.length) * 100 : 0

  const set = (id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }))
    setTouched((t) => (t.has(id) ? t : new Set(t).add(id)))
    setBlocked(null)
    if (state === 'Complete') setState('Draft')
    setVerified(false)
  }

  const saveDraft = () => {
    setShowAll(true)
    setLastSaved(new Date())
    setSavedBy(user?.name ?? 'You')
    if (state !== 'Complete') setState('Draft')
    persist({ state: state === 'Complete' ? 'Complete' : 'Draft' })
    toast('success', 'Draft saved')
  }
  const markComplete = () => {
    setShowAll(true)
    const needVerify = warnings.length > 0 && !verified
    if (errors.length || needVerify) {
      setBlocked({ errors, needVerify })
      document.getElementById('crf-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setBlocked(null)
    setState('Complete')
    setLastSaved(new Date())
    setSavedBy(user?.name ?? 'You')
    persist({ state: 'Complete' })
    toast('success', 'Form marked complete')
  }
  const focusField = (id: string) => {
    const el = document.getElementById(`f-${id}`) ?? document.querySelector<HTMLElement>(`[name="f-${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => el?.focus(), 250)
  }
  const respond = (qid: string, text: string) => {
    const nextQs: DataQuery[] = queries.map((q) => q.id === qid ? { ...q, status: 'Closed', messages: [...q.messages, { author: user?.name ?? 'You', role: 'Site', at: format(new Date(), 'yyyy-MM-dd'), text }] } : q)
    setQueries(nextQs)
    ecrfService.respondQuery(p.id, visit.visit, {
      participantId: p.id, visit: visit.visit, values, state, savedAt: new Date().toISOString(), savedBy: user?.name ?? 'Unknown',
      signedBy: signed?.by, signedAt: signed?.at.toISOString(), queries: nextQs,
    }, qid)
    toast('success', `Query ${qid} answered and closed`)
  }

  const sectionStats = SECTIONS.map((s) => {
    const fields = s.rows.filter((r) => !r.showIf || r.showIf(v)).flatMap((r) => r.fields).map((id) => FIELD[id]).filter((f) => f.kind !== 'derived')
    const req = fields.filter((f) => f.required)
    const done = req.filter((f) => (v[f.id] ?? '').trim() !== '' && !errors.some((e) => e.field === f.id)).length
    const ids = new Set(fields.map((f) => f.id))
    return {
      s, req: req.length, done,
      err: issues.filter((i) => ids.has(i.field) && i.level === 'error' && (showAll || i.message !== 'Required field missing')).length,
      warn: issues.filter((i) => ids.has(i.field) && i.level === 'warn').length,
      q: openQueries.filter((q) => ids.has(q.field)).length,
    }
  })

  const stateTone = state === 'Signed' ? 'ok' : state === 'Complete' ? 'info' : 'neutral'

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 space-y-4">
        {/* Header */}
        <section id="crf-top" className="scroll-mt-4 rounded-[var(--radius-panel)] border border-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">{visitLabel(visit.visit)}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <Link to={`/participants/${p.id}`} className="text-info hover:underline"><Mono>{p.id}</Mono></Link>
                <span><Mono>{p.studyId}</Mono> {study?.shortTitle}</span>
                <span>{site?.name ?? p.siteId}</span>
                <span>Target {fmtDate(visit.scheduledDate)}{visit.windowDays ? `, ±${visit.windowDays} days` : ''}</span>
                <span>CRF version 2.1</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <div className="flex items-center gap-2">
                {openQueries.length > 0 && <Badge tone="warn"><MessageSquareWarning className="size-3.5" aria-hidden />{openQueries.length} open {openQueries.length === 1 ? 'query' : 'queries'}</Badge>}
                <Badge tone={stateTone} dot>{state}</Badge>
              </div>
              <span className="text-xs text-muted">
                {lastSaved ? `Last saved ${format(lastSaved, 'd MMM yyyy, HH:mm')} by ${savedBy}` : 'Not saved yet'}
              </span>
              {signed && state === 'Signed' && <span className="text-xs text-ok">Signed by {signed.by}, {format(signed.at, 'd MMM yyyy, HH:mm')}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
            <span className="text-[13px] whitespace-nowrap text-muted">Required fields</span>
            <Progress value={progress} tone={progress === 100 ? 'ok' : 'info'} className="flex-1" label="Required fields completed" />
            <span className="tnum text-[13px] font-medium whitespace-nowrap text-ink">{filledReq.length} of {required.length}</span>
          </div>
          {readOnly && (
            <div className="flex items-center gap-2 border-t border-line bg-canvas/70 px-4 py-2 text-[13px] text-muted">
              <Lock className="size-4" aria-hidden />
              {missed ? 'This visit was missed. No data is expected; record the reason as a protocol deviation.'
                : state === 'Signed' ? 'This form has been signed by the investigator and is locked for editing.'
                : 'Read-only. Your role can view eCRF data but cannot edit it.'}
            </div>
          )}
        </section>

        {blocked && (
          <section className="rounded-[var(--radius-panel)] border border-crit/40 bg-crit-soft px-4 py-3" role="alert">
            <div className="flex items-center gap-2 font-medium text-crit"><AlertCircle className="size-4" aria-hidden />Form cannot be marked complete</div>
            <ul className="mt-2 space-y-1 text-[13px]">
              {blocked.errors.map((e, i) => (
                <li key={i}>
                  <button onClick={() => focusField(e.field)} className="text-left text-ink hover:underline">
                    <span className="font-medium">{FIELD[e.field]?.label}</span> <Mono className="text-faint">{FIELD[e.field]?.code}</Mono>: {e.message}
                  </button>
                </li>
              ))}
              {blocked.needVerify && (
                <li className="text-ink">{warnings.length} value{warnings.length === 1 ? ' is' : 's are'} outside the expected range. Confirm "Values verified against source" below before completing.</li>
              )}
            </ul>
          </section>
        )}

        {/* Sections */}
        {SECTIONS.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-4 rounded-[var(--radius-panel)] border border-line bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-line bg-canvas/60 px-4 py-2">
              <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
              <Mono className="text-[11.5px] text-faint">{s.code}</Mono>
            </header>
            <div>
              {s.rows.filter((r) => !r.showIf || r.showIf(v)).map((r) => (
                <FormRow
                  key={r.label}
                  label={r.label}
                  hint={r.hint}
                  fields={r.fields.map((id) => FIELD[id])}
                  values={v}
                  readOnly={readOnly}
                  issueFor={issueFor}
                  queries={queries}
                  onChange={set}
                  onBlur={(id) => setTouched((t) => (t.has(id) ? t : new Set(t).add(id)))}
                  onRespond={respond}
                  canRespond={canEdit && !missed}
                />
              ))}
              {s.id === 'ae' && v.aeyn === 'Yes' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-warn-soft/50 px-4 py-2.5 text-[13px] text-ink">
                  <AlertTriangle className="size-4 text-warn" aria-hidden />
                  Adverse events must also be reported to the pharmacovigilance cell.
                  <Link to="/safety?new=1" className="inline-flex items-center gap-1 font-medium text-info hover:underline">Report adverse event<ExternalLink className="size-3.5" aria-hidden /></Link>
                </div>
              )}
            </div>
          </section>
        ))}

        {/* Footer actions */}
        <div className="sticky bottom-0 z-10 -mx-1 rounded-[var(--radius-panel)] border border-line bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              {warnings.length > 0 && !readOnly ? (
                <label className={cx('inline-flex cursor-pointer items-center gap-2 rounded px-1.5 py-1', blocked?.needVerify && 'ring-2 ring-crit/50')}>
                  <input type="checkbox" checked={verified} onChange={(e) => { setVerified(e.target.checked); setBlocked(null) }} className="size-4 accent-ink" />
                  <span className="text-ink">Values verified against source</span>
                  <span className="text-warn">({warnings.length} outside expected range)</span>
                </label>
              ) : (
                <span className="text-muted">
                  {errors.length && showAll ? <span className="text-crit">{errors.length} {errors.length === 1 ? 'error' : 'errors'} to resolve</span> : state === 'Signed' ? 'Signed and locked' : 'No outstanding edit checks'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={Save} onClick={saveDraft} disabled={readOnly}>Save draft</Button>
              <Button variant="primary" icon={CheckCircle2} onClick={markComplete} disabled={readOnly || state === 'Complete'}>
                {state === 'Complete' ? 'Completed' : 'Mark complete'}
              </Button>
              <SignButton
                disabledReason={
                  state === 'Signed' ? 'Form already signed'
                  : !isPI ? 'Only the principal investigator can sign eCRFs'
                  : state !== 'Complete' ? 'Mark the form complete before signing'
                  : openQueries.length ? 'Resolve open data queries before signing'
                  : null
                }
                onClick={() => setSignOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section index */}
      <aside className="hidden xl:block">
        <nav className="sticky top-4 rounded-[var(--radius-panel)] border border-line bg-white p-3" aria-label="Form sections">
          <div className="mb-2 px-1 text-[13px] font-medium text-ink">Sections</div>
          <ol className="space-y-0.5">
            {sectionStats.map(({ s, req, done, err, warn, q }) => {
              const complete = req > 0 ? done === req && err === 0 : err === 0
              return (
                <li key={s.id}>
                  <button
                    onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-[13px] hover:bg-canvas"
                  >
                    {complete ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-label="Complete" />
                      : err ? <AlertCircle className="size-4 shrink-0 text-crit" aria-label="Has errors" />
                      : <span className="size-4 shrink-0 rounded-full border-2 border-line-2" aria-label="Incomplete" />}
                    <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
                    {q > 0 && <MessageSquareWarning className="size-3.5 text-warn" aria-label="Open query" />}
                    {warn > 0 && <span className="size-1.5 rounded-full bg-warn" aria-label="Range check" />}
                    <span className="tnum text-xs text-faint">{done}/{req}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 space-y-1.5 border-t border-line px-1 pt-3 text-xs text-muted">
            <div className="flex justify-between"><span>Errors</span><span className={cx('tnum font-medium', errors.length && showAll ? 'text-crit' : 'text-ink')}>{showAll ? errors.length : errors.filter((e) => e.message !== 'Required field missing').length}</span></div>
            <div className="flex justify-between"><span>Range checks</span><span className={cx('tnum font-medium', warnings.length ? 'text-warn' : 'text-ink')}>{warnings.length}</span></div>
            <div className="flex justify-between"><span>Open queries</span><span className={cx('tnum font-medium', openQueries.length ? 'text-warn' : 'text-ink')}>{openQueries.length}</span></div>
          </div>
          <p className="mt-3 px-1 text-[11.5px] leading-snug text-faint">Field codes follow CDASH naming conventions. Mapping to SDTM is conceptual and configured per study.</p>
        </nav>
      </aside>

      {signOpen && (
        <SignModal
          onClose={() => setSignOpen(false)}
          onSign={() => {
            const at = new Date()
            setSigned({ by: user?.name ?? 'Investigator', at })
            setState('Signed')
            setLastSaved(at)
            setSavedBy(user?.name ?? 'Investigator')
            persist({ state: 'Signed', signed: { by: user?.name ?? 'Investigator', at } })
            setSignOpen(false)
            toast('success', 'Form signed')
          }}
          label={`${p.id}, ${visitLabel(visit.visit)}`}
          name={user?.name ?? ''}
        />
      )}
    </div>
  )
}

// ---------------- Row + controls ----------------
function FormRow({ label, hint, fields, values, readOnly, issueFor, queries, onChange, onBlur, onRespond, canRespond }: {
  label: string; hint?: string; fields: FieldDef[]; values: Values; readOnly: boolean
  issueFor: (id: string) => Issue | undefined; queries: DataQuery[]
  onChange: (id: string, v: string) => void; onBlur: (id: string) => void; onRespond: (qid: string, text: string) => void; canRespond: boolean
}) {
  const required = fields.some((f) => f.required)
  const rowIssues = fields.map((f) => issueFor(f.id)).filter((i): i is Issue => !!i)
  const err = rowIssues.find((i) => i.level === 'error')
  const warn = rowIssues.find((i) => i.level === 'warn')
  const rowQueries = queries.filter((q) => fields.some((f) => f.id === q.field))
  const labelFor = fields[0] && fields[0].kind !== 'radio' && fields[0].kind !== 'derived' ? `f-${fields[0].id}` : undefined
  return (
    <div className={cx(
      'grid grid-cols-1 gap-x-4 gap-y-1.5 border-b border-line px-4 py-2.5 last:border-0 md:grid-cols-[240px_minmax(0,1fr)]',
      err ? 'bg-crit-soft/40' : warn ? 'bg-warn-soft/40' : undefined,
    )}>
      <div className="pt-1.5">
        <label htmlFor={labelFor} className="block text-[13px] leading-tight font-medium text-ink">
          {label}{required && <span className="ml-0.5 text-crit" aria-hidden>*</span>}
        </label>
        <div className="mt-0.5 flex flex-wrap gap-x-2">
          <Mono className="text-[11px] text-faint">{fields.map((f) => f.code).join(' / ')}</Mono>
        </div>
        {hint && <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{hint}</div>}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted" aria-hidden>/</span>}
              <Control f={f} value={values[f.id] ?? ''} readOnly={readOnly} invalid={issueFor(f.id)?.level === 'error'} warn={issueFor(f.id)?.level === 'warn'} onChange={(val) => onChange(f.id, val)} onBlur={() => onBlur(f.id)} />
            </div>
          ))}
          {rowQueries.map((q) => <QueryBadge key={q.id} q={q} onRespond={onRespond} canRespond={canRespond} />)}
        </div>
        {rowIssues.map((i, k) => (
          <p key={k} className={cx('mt-1 flex items-center gap-1.5 text-xs font-medium', i.level === 'error' ? 'text-crit' : 'text-warn')} role={i.level === 'error' ? 'alert' : undefined}>
            {i.level === 'error' ? <AlertCircle className="size-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="size-3.5 shrink-0" aria-hidden />}
            {fields.length > 1 && <span className="font-normal text-muted">{FIELD[i.field].label}:</span>}
            {i.message}
          </p>
        ))}
      </div>
    </div>
  )
}

function Control({ f, value, readOnly, invalid, warn, onChange, onBlur }: {
  f: FieldDef; value: string; readOnly: boolean; invalid: boolean; warn: boolean; onChange: (v: string) => void; onBlur: () => void
}) {
  const id = `f-${f.id}`
  const warnCls = warn && !invalid ? 'border-warn' : undefined
  if (f.kind === 'derived') {
    return (
      <div className={cx('relative', f.width ?? 'w-full max-w-xl')}>
        <div className={cx('flex h-9 items-center rounded-[var(--radius-ctl)] border border-line bg-canvas px-2.5 text-sm text-ink', f.unit && 'pr-14')}>
          {value || <span className="text-faint">—</span>}
        </div>
        {f.unit && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-faint">{f.unit}</span>}
      </div>
    )
  }
  if (f.kind === 'textarea') {
    return <Textarea id={id} value={value} disabled={readOnly} invalid={invalid} placeholder={readOnly ? undefined : f.placeholder} rows={2} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={cx('w-full max-w-xl min-h-16', warnCls)} />
  }
  if (f.kind === 'select') {
    return (
      <Select id={id} value={value} disabled={readOnly} invalid={invalid} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={cx(f.width ?? 'w-56', warnCls)}>
        <option value="">Select</option>
        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    )
  }
  if (f.kind === 'radio') {
    return (
      <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-1.5">
        {f.options?.map((o) => (
          <label key={o} className={cx(
            'flex h-8 items-center gap-2 rounded-[var(--radius-ctl)] border px-2.5 text-[13px]',
            readOnly ? 'cursor-default' : 'cursor-pointer',
            value === o ? 'border-ink bg-ink/[0.04] text-ink' : invalid ? 'border-crit/60 text-ink-3' : 'border-line-2 text-ink-3 hover:border-ink-3',
          )}>
            <input type="radio" name={id} value={o} checked={value === o} disabled={readOnly} onChange={() => onChange(o)} onBlur={onBlur} className="accent-ink" />
            {o}
          </label>
        ))}
      </div>
    )
  }
  return (
    <div className={cx('relative', f.kind === 'date' ? 'w-44' : f.width ?? 'w-72')}>
      <Input
        id={id}
        type={f.kind === 'number' ? 'text' : f.kind}
        inputMode={f.kind === 'number' ? 'decimal' : undefined}
        value={value}
        disabled={readOnly}
        invalid={invalid}
        placeholder={readOnly ? undefined : f.placeholder}
        max={f.kind === 'date' ? format(TODAY, 'yyyy-MM-dd') : undefined}
        onChange={(e) => onChange(f.kind === 'number' ? e.target.value.replace(/[^\d.-]/g, '') : e.target.value)}
        onBlur={onBlur}
        className={cx('tnum', f.unit && (f.unit.length > 3 ? 'pr-14' : 'pr-11'), warnCls)}
        aria-describedby={undefined}
      />
      {f.unit && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-faint">{f.unit}</span>}
    </div>
  )
}

function QueryBadge({ q, onRespond, canRespond }: { q: DataQuery; onRespond: (qid: string, text: string) => void; canRespond: boolean }) {
  const [text, setText] = useState('')
  const open = q.status === 'Open'
  return (
    <Popover
      align="left"
      className="w-[min(360px,calc(100vw-3rem))]"
      trigger={({ toggle }) => (
        <button onClick={toggle} type="button" className={cx(
          'inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium',
          open ? 'bg-warn-soft text-warn ring-1 ring-warn/30 ring-inset hover:bg-warn-soft/70' : 'bg-ok-soft text-ok',
        )}>
          {open ? <MessageSquareWarning className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
          {open ? 'Data query open' : 'Query closed'}
        </button>
      )}
    >
      {(close) => (
        <div className="text-[13px]">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <Mono className="font-medium text-ink">{q.id}</Mono>
            <Badge tone={open ? 'warn' : 'ok'}>{open ? 'Open' : 'Closed'}</Badge>
          </div>
          <ol className="max-h-64 space-y-3 overflow-y-auto px-3 py-3">
            {q.messages.map((m, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-ink">{m.author}</span>
                  <span className="text-faint">{m.role}, {fmtDate(m.at)}</span>
                </div>
                <p className="mt-0.5 text-ink-3">{m.text}</p>
              </li>
            ))}
          </ol>
          {open && canRespond && (
            <div className="border-t border-line px-3 py-2.5">
              <label htmlFor={`qr-${q.id}`} className="text-xs font-medium text-ink">Response</label>
              <Textarea id={`qr-${q.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} className="mt-1 min-h-14 text-[13px]" placeholder="e.g. Verified against source worksheet; value confirmed." />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={close}>Cancel</Button>
                <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => { onRespond(q.id, text.trim()); setText(''); close() }}>Respond</Button>
              </div>
            </div>
          )}
          {open && !canRespond && <p className="border-t border-line px-3 py-2 text-xs text-muted">Your role cannot respond to data queries.</p>}
        </div>
      )}
    </Popover>
  )
}

function SignButton({ disabledReason, onClick }: { disabledReason: string | null; onClick: () => void }) {
  if (!disabledReason) return <Button variant="primary" icon={FileSignature} onClick={onClick}>Sign</Button>
  return (
    <span className="group relative inline-flex" tabIndex={0} aria-describedby="sign-tip">
      <Button icon={FileSignature} disabled className="pointer-events-none">Sign</Button>
      <span id="sign-tip" role="tooltip" className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 hidden w-max max-w-[260px] rounded-md bg-ink px-2.5 py-1.5 text-xs text-white group-hover:block group-focus:block">
        {disabledReason}
      </span>
    </span>
  )
}

function SignModal({ onClose, onSign, label, name }: { onClose: () => void; onSign: () => void; label: string; name: string }) {
  const [pw, setPw] = useState('')
  const [ack, setAck] = useState(false)
  const [tried, setTried] = useState(false)
  const pwErr = pw.length < 8 ? 'Enter your password to sign.' : undefined
  const submit = () => { setTried(true); if (!pwErr && ack) onSign() }
  return (
    <Modal open onClose={onClose} size="sm" title="Sign case report form" description={label}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={FileSignature} onClick={submit}>Sign form</Button></>}>
      <div className="space-y-3 text-[13px]">
        <div className="flex gap-2 rounded-[var(--radius-ctl)] bg-canvas px-3 py-2 text-ink-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          Signing confirms you have reviewed the data in this form. The form will be locked and the signature recorded in the audit trail.
        </div>
        <label className={cx('flex items-start gap-2', tried && !ack && 'text-crit')}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-ink" />
          <span>I, {name}, confirm the data recorded in this form is accurate and complete to the best of my knowledge.</span>
        </label>
        <div>
          <label htmlFor="sign-pw" className="text-[13px] font-medium text-ink">Password</label>
          <Input id="sign-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={tried && !!pwErr} className="mt-1" autoComplete="current-password" onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
          {tried && pwErr && <p className="mt-1 text-xs text-crit">{pwErr}</p>}
        </div>
      </div>
    </Modal>
  )
}
