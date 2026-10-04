import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowRight, Building2, Database, FileCheck2, FlaskConical, HeartPulse, Info, Layers, Network,
} from 'lucide-react'
import { Badge, EmptyState, Mono, PageHeader, Panel, type Tone } from '@/components/ui/primitives'
import { SearchInput, Table, THead, Th, Td, Tr, Segmented } from '@/components/ui/data'
import { cx } from '@/lib/format'

interface StdItem { code: string; name: string; desc: string; status: string; tone: Tone }

const CDISC: StdItem[] = [
  { code: 'CDASH', name: 'Clinical Data Acquisition Standards Harmonization', desc: 'Standard field names and layouts for how data is collected on eCRFs at the site.', status: 'Mapping in design', tone: 'info' },
  { code: 'SDTM', name: 'Study Data Tabulation Model', desc: 'Organises collected data into standard domains (DM, VS, AE, CM…) for review and submission.', status: 'Mapping in design', tone: 'info' },
  { code: 'ADaM', name: 'Analysis Data Model', desc: 'Analysis-ready datasets derived from SDTM, traceable back to the source records.', status: 'Planned', tone: 'neutral' },
]

const FHIR: StdItem[] = [
  { code: 'Patient', name: 'Demographics', desc: 'Pseudonymised participant demographics linked to a study subject identifier.', status: 'Mapping in design', tone: 'info' },
  { code: 'Observation', name: 'Vitals, labs, assessments', desc: 'Measurements such as blood pressure, weight, lab values and coded assessments.', status: 'Mapping in design', tone: 'info' },
  { code: 'Condition', name: 'Diagnoses and history', desc: 'Medical history and study indication, coded where a terminology is agreed.', status: 'Mapping in design', tone: 'info' },
  { code: 'Medication', name: 'Statement and request', desc: 'Concomitant medications and study interventions, including classical formulations.', status: 'Under review', tone: 'warn' },
  { code: 'Encounter', name: 'Visits', desc: 'Scheduled and unscheduled study visits exchanged with hospital systems.', status: 'Mapping in design', tone: 'info' },
  { code: 'Procedure', name: 'Therapies and procedures', desc: 'Procedures such as Panchakarma therapies performed during the study.', status: 'Under review', tone: 'warn' },
  { code: 'AdverseEvent', name: 'Safety information', desc: 'Adverse event details shared where appropriate and authorised.', status: 'Planned', tone: 'neutral' },
]

interface MapRow { field: string; fhir: string; cdisc: string; variable: string; group: 'Vitals' | 'Safety' | 'Clinical' | 'Operational' | 'Ayurveda'; flag?: string }

const MAPPINGS: MapRow[] = [
  { field: 'Blood pressure', fhir: 'Observation', cdisc: 'VS', variable: 'VSTESTCD = SYSBP / DIABP', group: 'Vitals' },
  { field: 'Heart rate', fhir: 'Observation', cdisc: 'VS', variable: 'VSTESTCD = HR', group: 'Vitals' },
  { field: 'Weight', fhir: 'Observation', cdisc: 'VS', variable: 'VSTESTCD = WEIGHT', group: 'Vitals' },
  { field: 'Adverse event', fhir: 'AdverseEvent', cdisc: 'AE', variable: 'AETERM, AESEV, AESER, AEREL', group: 'Safety' },
  { field: 'Medication', fhir: 'MedicationStatement / MedicationRequest', cdisc: 'CM', variable: 'CMTRT, CMDOSE, CMROUTE', group: 'Clinical' },
  { field: 'Demographics', fhir: 'Patient', cdisc: 'DM', variable: 'AGE, SEX, SITEID, USUBJID', group: 'Clinical' },
  { field: 'Medical history', fhir: 'Condition', cdisc: 'MH', variable: 'MHTERM, MHSTDTC', group: 'Clinical' },
  { field: 'Visit', fhir: 'Encounter', cdisc: 'SV', variable: 'VISIT, VISITNUM, SVSTDTC', group: 'Operational' },
  { field: 'Lab result', fhir: 'Observation', cdisc: 'LB', variable: 'LBTESTCD, LBORRES, LBORRESU', group: 'Clinical' },
  { field: 'Procedure', fhir: 'Procedure', cdisc: 'PR', variable: 'PRTRT, PRSTDTC', group: 'Clinical' },
  { field: 'Prakriti assessment', fhir: 'Observation (custom code)', cdisc: 'SUPPQUAL / custom domain', variable: 'QNAM = PRAKRITI', group: 'Ayurveda', flag: 'Needs validated instrument' },
]

const AYURVEDA: { term: string; desc: string }[] = [
  { term: 'Prakriti', desc: 'Constitutional type' },
  { term: 'Vikriti', desc: 'Current state of imbalance' },
  { term: 'Agni', desc: 'Digestive and metabolic capacity' },
  { term: 'Kostha', desc: 'Bowel nature' },
  { term: 'Bala', desc: 'Strength and vitality' },
  { term: 'Satmya', desc: 'Adaptability and suitability' },
  { term: 'Ahara', desc: 'Dietary pattern' },
  { term: 'Vihara', desc: 'Lifestyle and daily routine' },
]

const GROUPS = ['All', 'Vitals', 'Clinical', 'Safety', 'Operational', 'Ayurveda'] as const
type Group = (typeof GROUPS)[number]

function StandardCard({ icon: Icon, title, subtitle, items, footnote }: {
  icon: typeof Database; title: string; subtitle: string; items: StdItem[]; footnote: ReactNode
}) {
  return (
    <Panel
      title={<span className="inline-flex items-center gap-2"><Icon className="size-4 text-ink-3" aria-hidden />{title}</span>}
      subtitle={subtitle}
      bodyClass="p-0"
    >
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.code} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-px w-[100px] shrink-0 text-[13.5px] font-semibold text-ink">{i.code}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-ink">{i.name}</div>
              <p className="text-[13px] text-muted">{i.desc}</p>
            </div>
            <Badge tone={i.tone} className="mt-0.5 shrink-0">{i.status}</Badge>
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-canvas/60 px-4 py-2.5 text-xs text-muted">{footnote}</div>
    </Panel>
  )
}

function Node({ icon: Icon, title, sub, tone = 'default', className }: {
  icon: typeof Database; title: string; sub?: string; tone?: 'ink' | 'default' | 'soft'; className?: string
}) {
  return (
    <div className={cx(
      'flex items-center gap-2.5 rounded-[var(--radius-panel)] border px-3.5 py-2.5',
      tone === 'ink' ? 'border-ink bg-ink text-white' : tone === 'soft' ? 'border-info/30 bg-info-soft text-ink' : 'border-line-2 bg-white text-ink',
      className,
    )}>
      <Icon className={cx('size-4 shrink-0', tone === 'ink' ? 'text-white/80' : 'text-ink-3')} aria-hidden />
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold leading-tight">{title}</div>
        {sub && <div className={cx('text-xs leading-snug', tone === 'ink' ? 'text-white/70' : 'text-muted')}>{sub}</div>}
      </div>
    </div>
  )
}

function Down() {
  return <div className="flex justify-center py-1.5 text-faint" aria-hidden><ArrowDown className="size-4" /></div>
}

function Architecture() {
  return (
    <div className="mx-auto max-w-[720px]" role="img" aria-label="Architecture: AIIA CTMS feeds a canonical clinical data model, which feeds a CDISC and FHIR mapping layer, which connects to hospital systems, research databases and regulatory submissions.">
      <Node icon={Layers} title="AIIA CTMS" sub="Studies, participants, visits, eCRFs, safety, documents" tone="ink" className="mx-auto max-w-[420px]" />
      <Down />
      <Node icon={Database} title="Canonical clinical data model" sub="One internal representation, independent of any exchange format" className="mx-auto max-w-[420px]" />
      <Down />
      <div className="rounded-[var(--radius-panel)] border border-dashed border-line-2 p-3">
        <div className="mb-2 text-center text-[13px] font-medium text-ink">CDISC / FHIR mapping layer</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Node icon={FileCheck2} title="CDISC" sub="CDASH collection, SDTM tabulation, ADaM analysis" tone="soft" />
          <Node icon={HeartPulse} title="FHIR" sub="Patient, Observation, Condition, Encounter…" tone="soft" />
        </div>
      </div>
      <Down />
      <div className="mb-1.5 text-center text-[13px] text-muted">External research and hospital systems</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Node icon={Building2} title="Hospital systems" sub="HIS and EMR via FHIR" />
        <Node icon={Network} title="Research databases" sub="Registries, multicentre repositories" />
        <Node icon={FlaskConical} title="Regulatory submissions" sub="SDTM and ADaM datasets" />
      </div>
    </div>
  )
}

const FLOW = [
  { title: 'Data collection', sub: 'eCRF fields aligned to CDASH' },
  { title: 'Data management', sub: 'Queries, cleaning, coding' },
  { title: 'Standardised dataset', sub: 'SDTM domains' },
  { title: 'Analysis', sub: 'ADaM datasets and reports' },
]

export default function DataStandards() {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<Group>('All')

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return MAPPINGS.filter((m) =>
      (group === 'All' || m.group === group) &&
      (!s || [m.field, m.fhir, m.cdisc, m.variable].some((x) => x.toLowerCase().includes(s))),
    )
  }, [q, group])

  return (
    <div>
      <PageHeader
        title="Data Standards & Interoperability"
        subtitle="How study data is intended to be structured for research standards (CDISC) and healthcare exchange (FHIR)."
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-warn/30 bg-warn-soft px-4 py-3 text-[13.5px] text-ink">
        <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <p><span className="font-medium">Conceptual reference.</span> Mappings shown here illustrate the intended design and are not a final regulatory implementation.</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StandardCard icon={FileCheck2} title="CDISC" subtitle="Clinical research data standardization" items={CDISC}
          footnote="Target versions and controlled terminology are to be confirmed with the data management team." />
        <StandardCard icon={HeartPulse} title="FHIR" subtitle="Healthcare interoperability" items={FHIR}
          footnote="Exchange with hospital systems would occur only under an authorised research workflow." />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel title="Architecture" subtitle="The interface is decoupled from exchange formats through a canonical model." className="xl:col-span-3">
          <Architecture />
        </Panel>
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Panel title="Data flow" subtitle="From the site to an analysis-ready dataset">
            <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch xl:flex-col">
              {FLOW.map((s, i) => (
                <li key={s.title} className="flex flex-1 items-center gap-2 sm:flex-col sm:items-stretch xl:flex-row xl:items-center">
                  <div className="flex flex-1 items-center gap-3 rounded-[var(--radius-ctl)] border border-line bg-canvas/50 px-3 py-2">
                    <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-ink">{s.title}</div>
                      <div className="text-xs text-muted">{s.sub}</div>
                    </div>
                  </div>
                  {i < FLOW.length - 1 && <ArrowRight className="hidden size-4 shrink-0 self-center text-faint sm:block xl:hidden" aria-hidden />}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Ayurveda-specific data elements" subtitle="Not covered by standard CDISC domains or FHIR profiles">
            <div className="grid grid-cols-2 gap-2">
              {AYURVEDA.map((a) => (
                <div key={a.term} className="rounded-[var(--radius-ctl)] border border-line px-3 py-2">
                  <div className="text-[13.5px] font-medium text-ink">{a.term}</div>
                  <div className="text-xs text-muted">{a.desc}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              These elements should be based on standardized and validated instruments where possible, captured with a documented
              method, and represented through supplemental qualifiers or custom codes until agreed terminologies exist.
            </p>
          </Panel>
        </div>
      </div>

      <Panel title="Data mapping" subtitle="Internal fields and their intended FHIR resources and CDISC domains" bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search fields, resources, domains" className="w-full sm:w-72" />
          <Segmented size="sm" options={GROUPS.map((g) => ({ id: g, label: g }))} value={group} onChange={setGroup} />
          <span className="ml-auto text-[13px] text-muted">{rows.length} of {MAPPINGS.length} mappings</span>
        </div>
        {rows.length ? (
          <Table minWidth={760}>
            <THead><tr><Th>Internal field</Th><Th>FHIR resource</Th><Th>CDISC domain</Th><Th>Variable</Th><Th>Notes</Th></tr></THead>
            <tbody>
              {rows.map((m) => (
                <Tr key={m.field}>
                  <Td className="font-medium text-ink">{m.field}</Td>
                  <Td className="text-ink">{m.fhir}</Td>
                  <Td><Mono className="font-medium">{m.cdisc}</Mono></Td>
                  <Td><Mono className="text-muted">{m.variable}</Mono></Td>
                  <Td>{m.flag ? <Badge tone="warn" dot>{m.flag}</Badge> : <span className="text-[13px] text-faint">Conceptual</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={Database} title="No mappings match" body="Try a different search term or category." />
        )}
      </Panel>
    </div>
  )
}
