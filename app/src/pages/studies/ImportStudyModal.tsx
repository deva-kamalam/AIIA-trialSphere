import { useRef, useState, type DragEvent } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud, X } from 'lucide-react'
import { Modal } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import { Badge, Button } from '@/components/ui/primitives'
import { cx } from '@/lib/format'

const ACCEPT = ['.xlsx', '.csv', '.json']
const COLUMNS = ['Study title', 'Principal investigator', 'Study type', 'Phase', 'Target'] as const

interface PreviewRow { values: string[]; issue?: string }
interface Parsed { file: File; rows: PreviewRow[]; total: number }

const SAMPLE: PreviewRow[] = [
  { values: ['Ayurvedic Management of Chronic Low Back Pain', 'Dr. Suresh Hegde', 'Interventional', 'Phase II', '180'] },
  { values: ['Rasayana in Mild Cognitive Decline', 'Dr. Neha Joshi', 'Pilot / Feasibility', 'Pilot', '60'] },
  { values: ['Ayurveda in Gestational Diabetes', 'Dr. Kavita Deshpande', 'Interventional', 'Phase II', ''], issue: 'Target sample size missing' },
]

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const KEYS: Record<(typeof COLUMNS)[number], string[]> = {
  'Study title': ['title', 'study title', 'studytitle'],
  'Principal investigator': ['pi', 'principal investigator', 'investigator'],
  'Study type': ['type', 'study type'],
  Phase: ['phase', 'study phase'],
  Target: ['target', 'target sample size', 'sample size'],
}

function toRow(rec: Record<string, unknown>): PreviewRow {
  const lower = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.toLowerCase().trim(), v]))
  const values = COLUMNS.map((c) => {
    const k = KEYS[c].find((x) => x in lower)
    return k ? String(lower[k] ?? '') : ''
  })
  const issue = !values[0] ? 'Study title missing' : !values[1] ? 'Principal investigator missing' : values[4] && !(Number(values[4]) > 0) ? 'Target must be greater than 0' : !values[4] ? 'Target sample size missing' : undefined
  return { values, issue }
}

async function parse(file: File): Promise<Parsed> {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (ext === '.xlsx') {
    await new Promise((r) => setTimeout(r, 500))
    return { file, rows: SAMPLE, total: SAMPLE.length }
  }
  const text = await file.text()
  let records: Record<string, unknown>[] = []
  if (ext === '.json') {
    const data: unknown = JSON.parse(text)
    const arr = Array.isArray(data) ? data : (data as { studies?: unknown[] })?.studies
    if (!Array.isArray(arr)) throw new Error('JSON must be an array of study records or { "studies": [...] }')
    records = arr.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) throw new Error('The file has no data rows below the header')
    const header = splitCsvLine(lines[0])
    records = lines.slice(1).map((l) => {
      const cells = splitCsvLine(l)
      return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
    })
  }
  if (!records.length) throw new Error('No study records found in the file')
  const rows = records.map(toRow)
  if (rows.every((r) => r.values.every((v) => !v))) throw new Error('No recognised columns. Expected title, pi, type, phase and target.')
  return { file, rows: rows.slice(0, 8), total: rows.length }
}

export function ImportStudyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setError(null); setParsed(null); setBusy(false) }
  }

  const handle = async (file?: File) => {
    if (!file) return
    setError(null)
    setParsed(null)
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''
    if (!ACCEPT.includes(ext)) { setError(`"${file.name}" is not a supported file. Use .xlsx, .csv or .json.`); return }
    if (file.size > 10 * 1024 * 1024) { setError('Files larger than 10 MB cannot be imported.'); return }
    setBusy(true)
    try { setParsed(await parse(file)) }
    catch (e) { setError(e instanceof Error ? `Could not read the file. ${e.message}` : 'Could not read the file.') }
    finally { setBusy(false) }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    void handle(e.dataTransfer.files[0])
  }

  const valid = parsed ? parsed.rows.filter((r) => !r.issue).length + Math.max(0, parsed.total - parsed.rows.length) : 0
  const issues = parsed ? parsed.rows.filter((r) => r.issue).length : 0

  const confirm = () => {
    toast('success', `${valid} ${valid === 1 ? 'study' : 'studies'} staged for review`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Import study"
      description="Upload a study register export. Records are validated and staged for review before they enter the portfolio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!parsed || valid === 0} onClick={confirm}>Stage for review</Button>
        </>
      }
    >
      {!parsed && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cx(
            'flex flex-col items-center justify-center rounded-[var(--radius-panel)] border-2 border-dashed px-6 py-10 text-center transition-colors',
            drag ? 'border-info bg-info-soft/50' : error ? 'border-crit/50 bg-crit-soft/30' : 'border-line-2 bg-canvas/50',
          )}
        >
          <UploadCloud className="mb-3 size-8 text-faint" aria-hidden />
          <p className="text-sm font-medium text-ink">{busy ? 'Reading file' : 'Drag a file here, or browse'}</p>
          <p className="mt-1 text-[13px] text-muted">Accepted formats: .xlsx, .csv, .json (up to 10 MB)</p>
          <Button size="sm" className="mt-4" loading={busy} onClick={() => input.current?.click()}>Browse files</Button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT.join(',')}
            className="sr-only"
            onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = '' }}
            aria-label="Choose file to import"
          />
        </div>
      )}
      {error && (
        <p className="mt-3 flex items-start gap-2 text-[13px] text-crit" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{error}
        </p>
      )}
      {!parsed && (
        <p className="mt-3 text-xs text-faint">Expected columns: title, pi, type, phase, target. Additional columns are ignored.</p>
      )}

      {parsed && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-line px-3 py-2.5">
            <FileSpreadsheet className="size-5 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{parsed.file.name}</p>
              <p className="text-xs text-muted">{(parsed.file.size / 1024).toFixed(1)} KB, {parsed.total} {parsed.total === 1 ? 'record' : 'records'} detected</p>
            </div>
            <button onClick={() => setParsed(null)} className="rounded p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Remove file"><X className="size-4" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="ok"><CheckCircle2 className="size-3.5" aria-hidden />{valid} ready</Badge>
            {issues > 0 && <Badge tone="warn"><AlertTriangle className="size-3.5" aria-hidden />{issues} need attention and will be skipped</Badge>}
          </div>
          <div className="scroll-thin overflow-x-auto rounded-[var(--radius-panel)] border border-line">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="border-b border-line bg-canvas/70 text-[12.5px] text-muted">
                <tr>{COLUMNS.map((c) => <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}<th className="px-3 py-2 font-medium">Validation</th></tr>
              </thead>
              <tbody>
                {parsed.rows.map((r, i) => (
                  <tr key={i} className={cx('border-b border-line last:border-0', r.issue && 'bg-warn-soft/40')}>
                    {r.values.map((v, j) => <td key={j} className="px-3 py-2 text-ink">{v || <span className="text-faint">—</span>}</td>)}
                    <td className="px-3 py-2 whitespace-nowrap">{r.issue ? <span className="text-warn">{r.issue}</span> : <span className="text-ok">Valid</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.total > parsed.rows.length && <p className="text-xs text-muted">Showing the first {parsed.rows.length} of {parsed.total} records.</p>}
        </div>
      )}
    </Modal>
  )
}
