import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { participantService, siteService, studyService } from '@/services'
import { useAsync, useSort, usePaged } from '@/lib/hooks'
import { cx, daysFromToday, fmtDate, fmtNum } from '@/lib/format'
import { useAuth } from '@/auth/useAuth'
import { VISIT_SCHEDULE } from '@/types'
import type { Participant, ParticipantStatus, Site, Study } from '@/types'
import { Button, EmptyState, Field, Input, Mono, PageHeader, RadioGroup, Select, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import { ClearFilters, FilterBar, FilterSelect, Pager, SearchInput, SortTh, THead, Table, Td, Th, Tr } from '@/components/ui/data'
import { todayIso } from './participants/shared'

const STATUSES: ParticipantStatus[] = ['Screening', 'Enrolled', 'Active', 'Completed', 'Withdrawn', 'Screen Failure']
const ENROL_RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 365 days' },
]

type Row = Participant & { siteName: string }

const CHIP_TONE: Record<ParticipantStatus, string> = {
  Screening: 'bg-info', Enrolled: 'bg-info', Active: 'bg-ok', Completed: 'bg-ok', Withdrawn: 'bg-faint', 'Screen Failure': 'bg-line-2',
}

export default function Participants() {
  const nav = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { data, loading, reload } = useAsync(() => participantService.list(), [])
  const { data: sites } = useAsync(() => siteService.list(), [])
  const { data: studies } = useAsync(() => studyService.list(), [])
  const [added, setAdded] = useState<Participant[]>([])
  const [addOpen, setAddOpen] = useState(false)

  const f = {
    study: params.get('study') ?? '',
    site: params.get('site') ?? '',
    status: params.get('status') ?? '',
    visit: params.get('visit') ?? '',
    enrolled: params.get('enrolled') ?? '',
    q: params.get('q') ?? '',
  }
  const setF = (k: keyof typeof f, v: string) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      if (v) n.set(k, v)
      else n.delete(k)
      return n
    }, { replace: true })
  const clearAll = () => setParams(new URLSearchParams(), { replace: true })
  const anyFilter = Object.values(f).some(Boolean)

  const siteName = useMemo(() => new Map((sites ?? []).map((s) => [s.id, s.name])), [sites])

  const all: Row[] = useMemo(
    () => [...added, ...(data ?? []).filter((p) => !added.some((a) => a.id === p.id))].map((p) => ({ ...p, siteName: siteName.get(p.siteId) ?? p.siteId })),
    [data, added, siteName],
  )

  // Everything except status, so the chips show counts for the current slice.
  const baseFiltered = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const minDays = f.enrolled ? -Number(f.enrolled) : null
    return all.filter((p) => {
      if (f.study && p.studyId !== f.study) return false
      if (f.site && p.siteId !== f.site) return false
      if (f.visit && p.currentVisit !== f.visit) return false
      if (minDays !== null) {
        if (!p.enrollmentDate) return false
        const d = daysFromToday(p.enrollmentDate)
        if (d < minDays || d > 0) return false
      }
      if (q && !p.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [all, f.study, f.site, f.visit, f.enrolled, f.q])

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ParticipantStatus, number>
    for (const p of baseFiltered) c[p.status]++
    return c
  }, [baseFiltered])

  const filtered = useMemo(() => (f.status ? baseFiltered.filter((p) => p.status === f.status) : baseFiltered), [baseFiltered, f.status])
  const { sorted, sort, toggle } = useSort<Row>(filtered, { key: 'id', dir: 'asc' })
  // Newly screened rows stay pinned to the top of the list.
  const ordered = useMemo(() => {
    if (!added.length) return sorted
    const ids = new Set(added.map((a) => a.id))
    return [...sorted.filter((r) => ids.has(r.id)), ...sorted.filter((r) => !ids.has(r.id))]
  }, [sorted, added])
  const paged = usePaged(ordered, 25)

  const studyOpts = useMemo(() => {
    const ids = new Set(all.map((p) => p.studyId))
    return (studies ?? []).filter((s) => ids.has(s.id)).map((s) => ({ value: s.id, label: `${s.id} ${s.shortTitle}` }))
  }, [studies, all])
  const siteOpts = useMemo(() => {
    const scope = f.study ? (studies ?? []).find((s) => s.id === f.study)?.siteIds : undefined
    return (sites ?? []).filter((s) => !scope || scope.includes(s.id)).map((s) => ({ value: s.id, label: `${s.name}, ${s.city}` }))
  }, [sites, studies, f.study])

  return (
    <div>
      <PageHeader
        title="Participants"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <ShieldCheck className="size-4 text-ok" aria-hidden />
            Records are pseudonymised with study-specific IDs. No names or contact details are shown.
          </span>
        }
        actions={can('participants:edit') && <Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>Add participant</Button>}
      />

      {/* Status chips */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {STATUSES.map((s) => {
          const active = f.status === s
          return (
            <button
              key={s}
              onClick={() => setF('status', active ? '' : s)}
              aria-pressed={active}
              className={cx(
                'flex items-center justify-between gap-2 rounded-[var(--radius-panel)] border bg-white px-3 py-2.5 text-left transition-colors',
                active ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink-3',
              )}
            >
              <span className="flex items-center gap-2 text-[13px] text-muted">
                <span className={cx('size-2 rounded-full', CHIP_TONE[s])} aria-hidden />
                {s}
              </span>
              {loading ? <Skeleton className="h-5 w-10" /> : <span className="tnum text-lg font-semibold text-ink">{fmtNum(counts[s])}</span>}
            </button>
          )
        })}
      </div>

      <section className="rounded-[var(--radius-panel)] border border-line bg-white">
        <FilterBar>
          <SearchInput value={f.q} onChange={(v) => setF('q', v)} placeholder="Search participant ID" className="w-full sm:w-60" />
          <FilterSelect label="Study" value={f.study} onChange={(v) => { setF('study', v) }} options={studyOpts} />
          <FilterSelect label="Site" value={f.site} onChange={(v) => setF('site', v)} options={siteOpts} />
          <FilterSelect label="Status" value={f.status} onChange={(v) => setF('status', v)} options={STATUSES} />
          <FilterSelect label="Visit" value={f.visit} onChange={(v) => setF('visit', v)} options={VISIT_SCHEDULE} />
          <FilterSelect label="Enrolled" value={f.enrolled} onChange={(v) => setF('enrolled', v)} options={ENROL_RANGES} allLabel="Any time" />
          <ClearFilters show={anyFilter} onClear={clearAll} />
          <span className="tnum ml-auto text-[13px] text-muted">{loading ? '' : `${fmtNum(filtered.length)} participants`}</span>
        </FilterBar>

        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No participants match these filters" body="Try widening the enrollment date range or clearing the site filter." action={<Button onClick={clearAll}>Clear filters</Button>} />
        ) : (
          <>
            <Table minWidth={1280}>
              <THead>
                <tr>
                  <SortTh label="Participant ID" k="id" sort={sort} onSort={toggle} />
                  <SortTh label="Study" k="studyId" sort={sort} onSort={toggle} />
                  <SortTh label="Site" k="siteName" sort={sort} onSort={toggle} />
                  <SortTh label="Screening" k="screeningDate" sort={sort} onSort={toggle} />
                  <SortTh label="Enrollment" k="enrollmentDate" sort={sort} onSort={toggle} />
                  <SortTh label="Age" k="age" sort={sort} onSort={toggle} />
                  <Th>Sex</Th>
                  <SortTh label="Current visit" k="currentVisit" sort={sort} onSort={toggle} />
                  <SortTh label="Study status" k="status" sort={sort} onSort={toggle} />
                  <SortTh label="Last visit" k="lastVisit" sort={sort} onSort={toggle} />
                  <SortTh label="Next visit" k="nextVisit" sort={sort} onSort={toggle} />
                </tr>
              </THead>
              <tbody>
                {paged.slice.map((p) => {
                  const nd = p.nextVisit ? daysFromToday(p.nextVisit) : null
                  const overdue = nd !== null && nd < 0
                  const severe = nd !== null && nd < -3
                  return (
                    <Tr key={p.id} onClick={() => nav(`/participants/${p.id}`)}>
                      <Td><Mono className="text-ink">{p.id}</Mono></Td>
                      <Td><Mono className="text-ink-3">{p.studyId}</Mono></Td>
                      <Td className="max-w-[220px]"><span className="block truncate" title={p.siteName}>{p.siteName}</span></Td>
                      <Td className="tnum whitespace-nowrap">{fmtDate(p.screeningDate)}</Td>
                      <Td className="tnum whitespace-nowrap">{p.enrollmentDate ? fmtDate(p.enrollmentDate) : <span className="text-faint">Not enrolled</span>}</Td>
                      <Td className="tnum">{p.age}</Td>
                      <Td>{p.sex}</Td>
                      <Td className="whitespace-nowrap">{p.currentVisit}</Td>
                      <Td><StatusBadge status={p.status} /></Td>
                      <Td className="tnum whitespace-nowrap">{fmtDate(p.lastVisit)}</Td>
                      <Td className="whitespace-nowrap">
                        {p.nextVisit ? (
                          <span
                            className={cx('tnum inline-flex items-center gap-1 rounded px-1.5 py-0.5', overdue && (severe ? 'bg-crit-soft text-crit' : 'bg-warn-soft text-warn'))}
                            title={overdue ? `${-nd!} day${nd === -1 ? '' : 's'} overdue` : undefined}
                          >
                            {overdue && <AlertTriangle className="size-3.5" aria-hidden />}
                            {fmtDate(p.nextVisit)}
                            {overdue && <span className="sr-only">, {-nd!} days overdue</span>}
                          </span>
                        ) : <span className="text-faint">—</span>}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <Pager {...paged} noun="participants" />
          </>
        )}
      </section>

      {addOpen && studies && sites && (
        <AddParticipantModal
          studies={studies}
          sites={sites}
          existing={all}
          defaultStudy={f.study}
          onClose={() => setAddOpen(false)}
          onAdd={async (p) => {
            const created = await participantService.screen({ studyId: p.studyId, siteId: p.siteId, age: p.age, sex: p.sex, screeningDate: p.screeningDate })
            setAdded((a) => [created, ...a])
            setAddOpen(false)
            toast('success', `Participant screened as ${created.id}`)
            clearAll()
            reload()
          }}
        />
      )}
    </div>
  )
}

function AddParticipantModal({ studies, sites, existing, defaultStudy, onClose, onAdd }: {
  studies: Study[]; sites: Site[]; existing: Participant[]; defaultStudy: string; onClose: () => void; onAdd: (p: Participant) => void
}) {
  const recruiting = studies.filter((s) => s.stage === 'Recruiting')
  const [studyId, setStudyId] = useState(recruiting.some((s) => s.id === defaultStudy) ? defaultStudy : recruiting[0]?.id ?? '')
  const study = studies.find((s) => s.id === studyId)
  const studySites = sites.filter((s) => study?.siteIds.includes(s.id) && s.status === 'Active')
  const [siteId, setSiteId] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'Female' | 'Male' | ''>('')
  const [date, setDate] = useState(todayIso())
  const [submitted, setSubmitted] = useState(false)

  const femaleOnly = studyId === 'AYU-003'
  const ageRange = femaleOnly ? [18, 45] : [18, 80]
  const errors: Record<string, string> = {}
  if (!studyId) errors.study = 'Select a study.'
  if (!siteId) errors.site = 'Select a site.'
  const ageN = Number(age)
  if (!age) errors.age = 'Enter age in years.'
  else if (!Number.isInteger(ageN) || ageN < ageRange[0] || ageN > ageRange[1]) errors.age = `Age must be between ${ageRange[0]} and ${ageRange[1]} years for this protocol.`
  if (!sex) errors.sex = 'Select sex.'
  else if (femaleOnly && sex !== 'Female') errors.sex = 'This protocol enrols female participants only.'
  if (!date) errors.date = 'Enter the screening date.'
  else if (date > todayIso()) errors.date = 'Screening date cannot be in the future.'
  const valid = Object.keys(errors).length === 0
  const show = (k: string) => (submitted ? errors[k] : undefined)

  const nextId = () => {
    const code = studyId.replace('-', '')
    const prefix = `AIIA-${code}-`
    const max = existing.reduce((m, p) => (p.id.startsWith(prefix) ? Math.max(m, Number(p.id.slice(prefix.length)) || 0) : m), 0)
    return `${prefix}${String(max + 1).padStart(4, '0')}`
  }

  const submit = () => {
    setSubmitted(true)
    if (!valid || !sex) return
    onAdd({
      id: nextId(), studyId, siteId, screeningDate: date, age: ageN, sex: sex === 'Female' ? 'F' : 'M',
      currentVisit: 'Screening', status: 'Screening', lastVisit: date, prakriti: 'Not assessed',
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add participant"
      description="Registers a screening record. An anonymised participant ID is assigned automatically."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Screen participant</Button></>}
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <Field label="Study" required htmlFor="ap-study" error={show('study')} className="sm:col-span-2">
          <Select id="ap-study" value={studyId} invalid={!!show('study')} onChange={(e) => { setStudyId(e.target.value); setSiteId(''); if (e.target.value === 'AYU-003') setSex('Female') }}>
            {recruiting.map((s) => <option key={s.id} value={s.id}>{s.id}: {s.title}</option>)}
          </Select>
        </Field>
        <Field label="Site" required htmlFor="ap-site" error={show('site')} className="sm:col-span-2" hint={studySites.length ? undefined : 'No active sites for this study.'}>
          <Select id="ap-site" value={siteId} invalid={!!show('site')} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Select site</option>
            {studySites.map((s) => <option key={s.id} value={s.id}>{s.name}, {s.city}</option>)}
          </Select>
        </Field>
        <Field label="Age (years)" required htmlFor="ap-age" error={show('age')} hint={`Protocol range ${ageRange[0]}–${ageRange[1]}`}>
          <Input id="ap-age" type="number" inputMode="numeric" min={ageRange[0]} max={ageRange[1]} value={age} invalid={!!show('age')} onChange={(e) => setAge(e.target.value)} />
        </Field>
        <Field label="Screening date" required htmlFor="ap-date" error={show('date')}>
          <Input id="ap-date" type="date" max={todayIso()} value={date} invalid={!!show('date')} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Sex" required error={show('sex')} className="sm:col-span-2">
          <RadioGroup name="ap-sex" value={sex} options={femaleOnly ? (['Female'] as const) : (['Female', 'Male'] as const)} onChange={(v) => setSex(v)} invalid={!!show('sex')} />
        </Field>
        <p className="text-xs text-muted sm:col-span-2">Do not record names, phone numbers or addresses. Identifiable source documents stay at the site.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
