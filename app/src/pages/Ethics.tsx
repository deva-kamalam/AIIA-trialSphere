import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, Circle, Gavel, Info, Lock, ShieldCheck, XCircle,
} from 'lucide-react'
import { studyService } from '@/services'
import { useAsync } from '@/lib/hooks'
import { useAuth } from '@/auth/useAuth'
import { cx, daysFromToday, fmtDate, relDue } from '@/lib/format'
import { TODAY } from '@/data/seed'
import { format } from 'date-fns'
import {
  Badge, Button, EmptyState, Field, Input, Kpi, Mono, PageHeader, Panel, RadioGroup, Skeleton, StatusBadge, Textarea,
  Modal, useToast, FilterBar, SearchInput, Segmented, Table, THead, Th, Td, Tr,
} from '@/components/ui'
import type { ComplianceItem, ComplianceMilestone, IecDecision, RequirementKey, Study, StudyCompliance } from '@/types'
import { Switch } from './compliance/Switch'

const COLUMNS: { key: RequirementKey; label: string }[] = [
  { key: 'ethics', label: 'Ethics approval' },
  { key: 'ctri', label: 'CTRI registration' },
  { key: 'protocol', label: 'Protocol version' },
  { key: 'consent', label: 'Informed consent' },
  { key: 'regulatoryDocs', label: 'Regulatory documents' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'amendments', label: 'Amendments' },
  { key: 'safetyReporting', label: 'Safety reporting' },
  { key: 'periodicReports', label: 'Annual / periodic reports' },
  { key: 'ndct', label: 'NDCT Rules 2019' },
]

const DEADLINE_LABEL: Partial<Record<RequirementKey, string>> = {
  ethics: 'IEC approval validity ends',
  insurance: 'Insurance policy expires',
  periodicReports: 'Annual / periodic report due',
}

const DECISIONS: readonly IecDecision[] = ['Approved', 'Approved with modifications', 'Queries raised']

const todayIso = format(TODAY, 'yyyy-MM-dd')

function stateLabel(s: ComplianceItem['state']) {
  return s === 'ok' ? 'Complete' : s === 'warn' ? 'Attention' : s === 'crit' ? 'Overdue' : 'N/A'
}

function StateChip({ item, compact }: { item?: ComplianceItem; compact?: boolean }) {
  if (!item) return <span className="text-faint">—</span>
  const s = item.state
  const cls = s === 'ok'
    ? 'bg-ok-soft text-ok'
    : s === 'warn'
      ? 'bg-warn-soft text-warn'
      : s === 'crit'
        ? 'bg-crit-soft text-crit'
        : 'border border-dashed border-line-2 text-faint'
  const Icon = s === 'ok' ? Check : s === 'warn' ? AlertTriangle : s === 'crit' ? XCircle : null
  return (
    <span
      title={`${item.label}: ${item.detail}`}
      className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', cls, compact && 'min-w-[78px] justify-center')}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {stateLabel(s)}
    </span>
  )
}

function dueTone(d?: string) {
  if (!d) return 'text-muted'
  const n = daysFromToday(d)
  return n < 0 ? 'text-crit' : n <= 30 ? 'text-warn' : 'text-muted'
}


export default function Ethics() {
  const { user, can } = useAuth()
  const toast = useToast()
  const { data, loading, error, setData } = useAsync(() => Promise.all([studyService.list(), studyService.allCompliance()]))
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [view, setView] = useState<'all' | 'attention'>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [decisionFor, setDecisionFor] = useState<{ studyId: string; idx: number; label: string } | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const studies = useMemo(() => data?.[0] ?? [], [data])
  const compliance = useMemo(() => data?.[1] ?? [], [data])
  const byStudy = useMemo(() => new Map(compliance.map((c) => [c.studyId, c])), [compliance])
  const studyById = useMemo(() => new Map(studies.map((s) => [s.id, s])), [studies])

  const canConfigure = can('ethics:configure') || user?.role === 'pi'
  const isEthics = user?.role === 'ethics'

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const active = studies.filter((s) => s.status !== 'Completed')
    let fully = 0, attention = 0, critical = 0, next30 = 0
    for (const s of active) {
      const c = byStudy.get(s.id)
      if (!c) continue
      const applicable = c.items.filter((i) => i.applicable && i.state !== 'na')
      if (applicable.length && applicable.every((i) => i.state === 'ok')) fully++
      for (const i of c.items) {
        if (i.state === 'warn') attention++
        if (i.state === 'crit') critical++
        if (i.dueDate && i.applicable) {
          const n = daysFromToday(i.dueDate)
          if (n >= 0 && n <= 30) next30++
        }
      }
    }
    return { fully, attention, critical, next30, active: active.length }
  }, [studies, byStudy])

  // ---------- matrix rows ----------
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return studies
      .filter((s) => includeCompleted || s.status !== 'Completed')
      .filter((s) => !needle || `${s.id} ${s.shortTitle} ${s.title} ${s.pi}`.toLowerCase().includes(needle))
      .filter((s) => {
        if (view === 'all') return true
        const c = byStudy.get(s.id)
        return !!c?.items.some((i) => i.state === 'warn' || i.state === 'crit')
      })
  }, [studies, includeCompleted, q, view, byStudy])

  const selected: Study | undefined = (selectedId ? studyById.get(selectedId) : undefined) ?? rows[0]
  const selComp: StudyCompliance | undefined = selected ? byStudy.get(selected.id) : undefined

  // ---------- deadlines ----------
  const deadlines = useMemo(() => {
    const out: { studyId: string; label: string; detail: string; date: string; key: RequirementKey }[] = []
    for (const c of compliance) {
      const s = studyById.get(c.studyId)
      if (!s || s.status === 'Completed') continue
      for (const i of c.items) {
        if (!i.dueDate || !i.applicable) continue
        const n = daysFromToday(i.dueDate)
        if (n <= 60) out.push({ studyId: c.studyId, label: DEADLINE_LABEL[i.key] ?? i.label, detail: i.detail, date: i.dueDate, key: i.key })
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [compliance, studyById])

  const select = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const toggleApplicability = async (item: ComplianceItem, next: boolean) => {
    if (!selected) return
    setBusyKey(item.key)
    try {
      const updated = await studyService.setApplicability(selected.id, item.key, next)
      if (updated) {
        setData((d) => (d ? [d[0], d[1].map((c) => (c.studyId === updated.studyId ? updated : c))] : d))
      }
      toast('success', `${item.label} marked ${next ? 'applicable' : 'not applicable'} for ${selected.id}`)
    } catch {
      toast('error', 'Could not update applicability. Try again.')
    } finally {
      setBusyKey(null)
    }
  }

  // Decisions are stored on the milestone by the service; nothing to merge locally.
  const milestoneView = (_studyId: string, _idx: number, m: ComplianceMilestone) => m

  return (
    <div>
      <PageHeader
        title="Ethics & Regulatory Compliance"
        subtitle="Ethics committee approvals, CTRI registration and regulatory obligations across the study portfolio. Requirements are configured per study, not assumed."
      />

      {error && <div className="mb-4 rounded-[var(--radius-panel)] border border-crit/30 bg-crit-soft px-4 py-3 text-sm text-crit">{error}</div>}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Kpi label="Studies fully compliant" value={`${kpis.fully} / ${kpis.active}`} hint="Active studies, all applicable items complete" icon={ShieldCheck} tone="ok" />
            <Kpi label="Items needing attention" value={kpis.attention} hint="Pending review or evidence" icon={AlertTriangle} tone="warn" onClick={() => setView('attention')} />
            <Kpi label="Overdue or critical" value={kpis.critical} hint="Past due date" icon={XCircle} tone={kpis.critical ? 'crit' : 'ok'} onClick={() => setView('attention')} />
            <Kpi label="Deadlines in next 30 days" value={kpis.next30} hint="Approvals, policies and reports" icon={CalendarClock} tone="info" />
          </>
        )}
      </div>

      <Panel
        title="Portfolio compliance matrix"
        subtitle="Select a study to see requirement details, the ethics timeline and applicability settings."
        bodyClass="p-0"
        className="mb-5"
      >
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search study, title or PI" className="w-full sm:w-64" />
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[{ id: 'all', label: 'All studies' }, { id: 'attention', label: 'Needs attention' }]}
          />
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <Switch checked={includeCompleted} onChange={setIncludeCompleted} label="Include completed studies" />
            Include completed studies
          </label>
        </FilterBar>
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No studies match" body="Adjust the search or switch back to all studies." />
        ) : (
          <Table minWidth={1320} className="max-h-[540px] overflow-y-auto">
            <THead>
              <tr>
                <Th className="sticky top-0 left-0 z-20 bg-canvas">Study</Th>
                {COLUMNS.map((c) => <Th key={c.key} className="sticky top-0 z-10 bg-canvas text-center">{c.label}</Th>)}
              </tr>
            </THead>
            <tbody>
              {rows.map((s) => {
                const c = byStudy.get(s.id)
                const active = selected?.id === s.id
                return (
                  <Tr key={s.id} onClick={() => select(s.id)} active={active}>
                    <Td className={cx('sticky left-0 z-[1] min-w-[230px]', active ? 'bg-info-soft' : 'bg-white')}>
                      <div className="flex items-center gap-2">
                        <Mono className="text-ink">{s.id}</Mono>
                        {s.status === 'Completed' && <Badge>Completed</Badge>}
                      </div>
                      <div className="max-w-[240px] truncate text-[12.5px] text-muted">{s.shortTitle}</div>
                    </Td>
                    {COLUMNS.map((col) => (
                      <Td key={col.key} className="text-center">
                        <StateChip item={c?.items.find((i) => i.key === col.key)} compact />
                      </Td>
                    ))}
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-ok" />Complete</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-warn" />Attention required</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-crit" />Overdue or critical</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm border border-dashed border-line-2" />Not applicable to this study</span>
          <span className="ml-auto">{rows.length} studies shown</span>
        </div>
      </Panel>

      <div ref={detailRef} className="grid scroll-mt-4 grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {loading && !data ? (
            <Skeleton className="h-96" />
          ) : !selected || !selComp ? (
            <Panel><EmptyState title="Select a study" body="Choose a study in the matrix to see its compliance detail." /></Panel>
          ) : (
            <>
              <Panel
                title={<span className="flex flex-wrap items-center gap-2"><Mono>{selected.id}</Mono><span>{selected.shortTitle}</span></span>}
                subtitle={`${selected.type}, ${selected.phase}. PI ${selected.pi}. ${selected.ctriNumber ? `CTRI ${selected.ctriNumber}` : 'CTRI registration pending'}`}
                actions={<><StatusBadge status={selected.status} /><Link to={`/studies/${selected.id}`} className="text-[13px] font-medium text-info hover:underline">Open study workspace</Link></>}
                bodyClass="p-0"
              >
                <div className="grid grid-cols-1 md:grid-cols-5">
                  <div className="border-line md:col-span-3 md:border-r">
                    <h3 className="px-4 pt-3 pb-2 text-[13px] font-medium text-muted">Requirements</h3>
                    <ul className="divide-y divide-line">
                      {selComp.items.map((i) => (
                        <li key={i.key} className={cx('flex items-start gap-3 px-4 py-2.5', i.state === 'na' && 'opacity-70')}>
                          <div className="w-[86px] shrink-0 pt-0.5"><StateChip item={i} compact /></div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-medium text-ink">{i.label}</div>
                            <div className="text-[12.5px] text-muted">{i.detail}</div>
                          </div>
                          {i.dueDate && i.applicable && (
                            <div className="shrink-0 text-right text-[12.5px]">
                              <div className="tnum text-ink">{fmtDate(i.dueDate)}</div>
                              <div className={cx('font-medium', dueTone(i.dueDate))}>{relDue(i.dueDate)}</div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="md:col-span-2">
                    <h3 className="px-4 pt-3 pb-2 text-[13px] font-medium text-muted">Ethics and regulatory timeline</h3>
                    <ol className="px-4 pb-4">
                      {selComp.timeline.map((raw, idx) => {
                        const m = milestoneView(selected.id, idx, raw)
                        const last = idx === selComp.timeline.length - 1
                        const Icon = m.state === 'done' ? Check : m.state === 'pending' ? AlertTriangle : m.state === 'overdue' ? XCircle : Circle
                        const ring = m.state === 'done'
                          ? 'bg-ok text-white'
                          : m.state === 'pending'
                            ? 'bg-warn-soft text-warn ring-1 ring-warn/40'
                            : m.state === 'overdue'
                              ? 'bg-crit-soft text-crit ring-1 ring-crit/40'
                              : 'bg-white text-faint ring-1 ring-line-2'
                        return (
                          <li key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                            {!last && <span className={cx('absolute top-7 bottom-0 left-[13px] w-px', m.state === 'done' ? 'bg-ok/50' : 'bg-line-2')} aria-hidden />}
                            <span className={cx('relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full', ring)}>
                              <Icon className="size-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className={cx('text-[13.5px] font-medium', m.state === 'upcoming' ? 'text-muted' : 'text-ink')}>{m.label}</div>
                              <div className="text-[12.5px] text-muted">
                                {m.date ? fmtDate(m.date) : m.state === 'upcoming' ? 'Not started' : ''}
                              </div>
                              {m.state === 'pending' && <div className="mt-0.5 text-[12.5px] font-medium text-warn">{m.note ?? 'Pending review'}</div>}
                              {m.state === 'overdue' && <div className="mt-0.5 text-[12.5px] font-medium text-crit">{m.note ?? 'Overdue'}</div>}
                              {m.state === 'done' && m.decision && (
                                <div className="mt-0.5 text-[12.5px] text-ok">{m.note}, recorded by {m.decision.by}</div>
                              )}
                              {m.decision?.remarks && <div className="mt-1 rounded bg-canvas px-2 py-1 text-[12.5px] text-muted">{m.decision.remarks}</div>}
                              {isEthics && m.state === 'pending' && (
                                <Button size="sm" variant="secondary" icon={Gavel} className="mt-2" onClick={() => setDecisionFor({ studyId: selected.id, idx, label: m.label })}>
                                  Record IEC decision
                                </Button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Regulatory applicability"
                subtitle="Applicability depends on study type, intervention, product category, design and site. It is configured per study rather than assumed."
                actions={!canConfigure ? <Badge tone="neutral"><Lock className="size-3" aria-hidden />Read only</Badge> : undefined}
              >
                {!canConfigure && (
                  <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-ctl)] bg-info-soft px-3 py-2 text-[13px] text-info">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>Only the principal investigator or a user with regulatory configuration rights can change applicability. Your role can view the current settings.</span>
                  </div>
                )}
                <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  {selComp.items.map((i) => (
                    <li key={i.key} className="flex items-center justify-between gap-3 border-b border-line py-2.5">
                      <div className="min-w-0">
                        <div className="text-[13.5px] text-ink">{i.label}</div>
                        <div className="text-xs text-faint">{i.applicable ? 'Applicable to this study' : 'Not applicable to this study'}</div>
                      </div>
                      <Switch
                        checked={i.applicable}
                        disabled={!canConfigure}
                        busy={busyKey === i.key}
                        label={`${i.label} applicable`}
                        onChange={(v) => toggleApplicability(i, v)}
                      />
                    </li>
                  ))}
                </ul>
                {canConfigure && <p className="mt-3 text-xs text-faint">Changes are recorded in the audit trail with the previous and new value.</p>}
              </Panel>
            </>
          )}
        </div>

        <Panel
          title="Upcoming deadlines and expiries"
          subtitle="Next 60 days across active studies, plus anything overdue"
          bodyClass="p-0"
          className="self-start"
        >
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : deadlines.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No deadlines in the next 60 days" />
          ) : (
            <ul className="scroll-thin max-h-[640px] divide-y divide-line overflow-y-auto">
              {deadlines.map((d, i) => {
                const n = daysFromToday(d.date)
                const tone = n < 0 ? 'crit' : n <= 30 ? 'warn' : 'neutral'
                return (
                  <li key={`${d.studyId}-${d.key}-${i}`}>
                    <button onClick={() => select(d.studyId)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-canvas">
                      <span className={cx('mt-1 h-8 w-[3px] shrink-0 rounded', tone === 'crit' ? 'bg-crit' : tone === 'warn' ? 'bg-warn' : 'bg-line-2')} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium text-ink">{d.label}</div>
                        <div className="truncate text-[12.5px] text-muted"><Mono>{d.studyId}</Mono> {studyById.get(d.studyId)?.shortTitle}</div>
                      </div>
                      <div className="shrink-0 text-right text-[12.5px]">
                        <div className="tnum text-ink">{fmtDate(d.date)}</div>
                        <div className={cx('font-medium', tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : 'text-muted')}>{relDue(d.date)}</div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <DecisionModal
        target={decisionFor}
        onClose={() => setDecisionFor(null)}
        onSave={(rec) => {
          if (!decisionFor) return
          const target = decisionFor
          studyService.recordIecDecision(target.studyId, target.idx, { ...rec, by: user?.name ?? 'Ethics Committee' }).then((updated) => {
            if (updated) setData((d) => (d ? [d[0], d[1].map((c) => (c.studyId === updated.studyId ? updated : c))] : d))
            toast('success', `IEC decision recorded for ${target.studyId}: ${rec.decision}`)
          })
          setDecisionFor(null)
        }}
      />
    </div>
  )
}

function DecisionModal({ target, onClose, onSave }: {
  target: { studyId: string; label: string } | null
  onClose: () => void
  onSave: (r: { decision: IecDecision; date: string; remarks: string }) => void
}) {
  const [decision, setDecision] = useState<IecDecision | ''>('')
  const [date, setDate] = useState(todayIso)
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lastTarget, setLastTarget] = useState(target)

  if (target !== lastTarget) {
    setLastTarget(target)
    setDecision(''); setDate(todayIso); setRemarks(''); setErrors({})
  }

  const submit = () => {
    const e: Record<string, string> = {}
    if (!decision) e.decision = 'Select the committee decision.'
    if (!date) e.date = 'Enter the decision date.'
    else if (date > todayIso) e.date = 'Decision date cannot be in the future.'
    if ((decision === 'Queries raised' || decision === 'Approved with modifications') && remarks.trim().length < 10) {
      e.remarks = 'Describe the queries or required modifications (at least 10 characters).'
    }
    setErrors(e)
    if (Object.keys(e).length || !decision) return
    onSave({ decision, date, remarks: remarks.trim() })
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title="Record IEC decision"
      description={target ? `${target.studyId}, ${target.label}` : undefined}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Record decision</Button></>}
    >
      <div className="space-y-4">
        <Field label="Decision" required error={errors.decision}>
          <RadioGroup name="iec-decision" value={decision} options={DECISIONS} onChange={setDecision} invalid={!!errors.decision} />
        </Field>
        <Field label="Decision date" required htmlFor="iec-date" error={errors.date}>
          <Input id="iec-date" type="date" value={date} max={todayIso} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} className="max-w-[200px]" />
        </Field>
        <Field label="Remarks" htmlFor="iec-remarks" error={errors.remarks} hint="Required when queries are raised or modifications are requested.">
          <Textarea id="iec-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} invalid={!!errors.remarks} placeholder="Committee observations, conditions or queries for the study team" />
        </Field>
      </div>
    </Modal>
  )
}
