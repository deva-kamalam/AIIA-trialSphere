import { useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock, Download, File as FileGeneric, FileSpreadsheet, FileText, FolderOpen, History, Lock, UploadCloud, Upload, X,
} from 'lucide-react'
import { format } from 'date-fns'
import { documentService, studyService } from '@/services'
import { useAsync, useSort } from '@/lib/hooks'
import { useAuth } from '@/auth/useAuth'
import { cx, daysFromToday, fmtDate, relDue } from '@/lib/format'
import { TODAY } from '@/data/seed'
import {
  Badge, Button, ClearFilters, Drawer, EmptyState, Field, FilterBar, FilterSelect, Input, Modal, Mono, PageHeader, Pager,
  Panel, Progress, SearchInput, Select, Skeleton, SortTh, StatusBadge, Table, Td, THead, Tr, Textarea, useToast,
} from '@/components/ui'
import { DOC_CATEGORIES } from '@/types'
import type { ApprovalStatus, DocCategory, Study, StudyDocument } from '@/types'

const STATUSES: ApprovalStatus[] = ['Approved', 'Under Review', 'Draft', 'Expired', 'Superseded']
const PAGE_SIZE = 20
const MAX_BYTES = 20 * 1024 * 1024
const ACCEPT = ['.pdf', '.docx', '.xlsx']
const todayIso = format(TODAY, 'yyyy-MM-dd')

type CategoryKey = 'all' | 'expiring' | DocCategory

function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split('.').pop()?.toLowerCase()
  const Icon = ext === 'pdf' ? FileText : ext === 'xlsx' ? FileSpreadsheet : ext === 'docx' ? FileText : FileGeneric
  const color = ext === 'pdf' ? 'text-crit' : ext === 'xlsx' ? 'text-ok' : ext === 'docx' ? 'text-info' : 'text-faint'
  return <Icon className={cx('size-4 shrink-0', color, className)} aria-hidden />
}

function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
}

function parseVersion(v: string): [number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})$/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2])] : null
}
function versionGt(a: string, b: string) {
  const x = parseVersion(a), y = parseVersion(b)
  if (!x || !y) return false
  return x[0] > y[0] || (x[0] === y[0] && x[1] > y[1])
}

function ExpiryCell({ date }: { date?: string }) {
  if (!date) return <span className="text-faint">No expiry</span>
  const n = daysFromToday(date)
  const tone = n < 0 ? 'text-crit' : n <= 30 ? 'text-warn' : 'text-muted'
  return (
    <div className="leading-tight">
      <div className={cx('tnum', n <= 30 ? tone : 'text-ink')}>{fmtDate(date)}</div>
      <div className={cx('text-xs', tone, n <= 30 && 'font-medium')}>{n < 0 ? `Expired ${-n} day${n === -1 ? '' : 's'} ago` : relDue(date)}</div>
    </div>
  )
}

type Row = StudyDocument & { expirySort: string }

export default function Documents() {
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useAsync(() => Promise.all([documentService.list(), studyService.list()]))
  const docs = useMemo(() => data?.[0] ?? [], [data])
  const studies = useMemo(() => data?.[1] ?? [], [data])

  const [category, setCategory] = useState<CategoryKey>(params.get('expiring') ? 'expiring' : 'all')
  const [study, setStudy] = useState(params.get('study') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [upload, setUpload] = useState<{ open: boolean; replaces?: StudyDocument }>({ open: false })

  // React to global-search links that change the query string while mounted.
  const paramKey = params.toString()
  const [seenParams, setSeenParams] = useState(paramKey)
  if (paramKey !== seenParams) {
    setSeenParams(paramKey)
    const pq = params.get('q')
    if (pq !== null) { setQ(pq); setPage(0) }
    if (params.get('expiring')) { setCategory('expiring'); setPage(0) }
  }

  const isExpiring = (d: StudyDocument) => !!d.expiryDate && daysFromToday(d.expiryDate) <= 30 && d.status !== 'Superseded'

  const counts = useMemo(() => {
    const m = new Map<CategoryKey, number>()
    m.set('all', docs.length)
    m.set('expiring', docs.filter(isExpiring).length)
    for (const c of DOC_CATEGORIES) m.set(c, docs.filter((d) => d.category === c).length)
    return m
  }, [docs])

  const filtered: Row[] = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return docs
      .filter((d) => category === 'all' || (category === 'expiring' ? isExpiring(d) : d.category === category))
      .filter((d) => !study || d.studyId === study)
      .filter((d) => !status || d.status === status)
      .filter((d) => !needle || `${d.name} ${d.id} ${d.studyId} ${d.uploadedBy} ${d.category}`.toLowerCase().includes(needle))
      .map((d) => ({ ...d, expirySort: d.expiryDate ?? '9999-12-31' }))
  }, [docs, category, study, status, q])

  const { sorted, sort, toggle } = useSort<Row>(filtered, category === 'expiring' ? { key: 'expirySort', dir: 'asc' } : { key: 'uploadedOn', dir: 'desc' })
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const anyFilter = !!(study || status || q)

  const resetPage = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(0) }
  const clearFilters = () => {
    setStudy(''); setStatus(''); setQ(''); setPage(0)
    const next = new URLSearchParams(params)
    next.delete('q'); next.delete('study'); next.delete('status')
    setParams(next, { replace: true })
  }
  const pickCategory = (c: CategoryKey) => {
    setCategory(c); setPage(0)
    if (c !== 'expiring' && params.get('expiring')) {
      const next = new URLSearchParams(params); next.delete('expiring'); setParams(next, { replace: true })
    }
  }

  const openDoc = docs.find((d) => d.id === openId) ?? null
  const studyById = useMemo(() => new Map(studies.map((s) => [s.id, s])), [studies])
  const loadingFirst = loading && !data

  const categoryItems: { key: CategoryKey; label: string }[] = [
    { key: 'all', label: 'All documents' },
    ...DOC_CATEGORIES.map((c) => ({ key: c as CategoryKey, label: c })),
  ]

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Central repository for protocols, approvals, consent forms and study reports, with version history and expiry tracking."
        actions={can('documents:upload') && <Button variant="primary" icon={Upload} onClick={() => setUpload({ open: true })}>Upload document</Button>}
      />
      <p className="-mt-3 mb-5 flex items-center gap-1.5 text-[13px] text-muted">
        <Lock className="size-3.5 text-faint" aria-hidden />
        Files are access-controlled by role. Every upload and new version is recorded in the audit trail.
      </p>

      {error && <div className="mb-4 rounded-[var(--radius-panel)] border border-crit/30 bg-crit-soft px-4 py-3 text-sm text-crit">{error}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Document categories" className="self-start rounded-[var(--radius-panel)] border border-line bg-white p-2">
          <ul className="space-y-0.5">
            {categoryItems.map((c, i) => (
              <li key={c.key}>
                {i === 1 && <div className="mx-2 my-1.5 border-t border-line" />}
                <CategoryButton label={c.label} count={counts.get(c.key) ?? 0} active={category === c.key} onClick={() => pickCategory(c.key)} icon={c.key === 'all' ? FolderOpen : undefined} loading={loadingFirst} />
              </li>
            ))}
            <li><div className="mx-2 my-1.5 border-t border-line" /></li>
            <li>
              <CategoryButton
                label="Expiring in 30 days"
                count={counts.get('expiring') ?? 0}
                active={category === 'expiring'}
                onClick={() => pickCategory('expiring')}
                icon={CalendarClock}
                tone="warn"
                loading={loadingFirst}
              />
            </li>
          </ul>
        </nav>

        <Panel
          title={category === 'all' ? 'All documents' : category === 'expiring' ? 'Expiring in 30 days or expired' : category}
          actions={<span className="text-[13px] text-muted">{filtered.length} documents</span>}
          bodyClass="p-0"
          className="min-w-0"
        >
          <FilterBar>
            <SearchInput value={q} onChange={resetPage(setQ)} placeholder="Search name, ID or uploader" className="w-full sm:w-64" />
            <FilterSelect label="Study" value={study} onChange={resetPage(setStudy)} options={studies.filter((s) => docs.some((d) => d.studyId === s.id)).map((s) => s.id)} />
            <FilterSelect label="Status" value={status} onChange={resetPage(setStatus)} options={STATUSES} />
            <ClearFilters show={anyFilter} onClear={clearFilters} />
          </FilterBar>
          {loadingFirst ? (
            <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : sorted.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No documents match" body="Try another category or clear the filters." action={anyFilter ? <Button size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
          ) : (
            <>
              <Table minWidth={980}>
                <THead>
                  <tr>
                    <SortTh label="Document name" k="name" sort={sort} onSort={toggle} />
                    <SortTh label="Study" k="studyId" sort={sort} onSort={toggle} />
                    <SortTh label="Version" k="version" sort={sort} onSort={toggle} />
                    <SortTh label="Uploaded by" k="uploadedBy" sort={sort} onSort={toggle} />
                    <SortTh label="Upload date" k="uploadedOn" sort={sort} onSort={toggle} />
                    <SortTh label="Approval status" k="status" sort={sort} onSort={toggle} />
                    <SortTh label="Expiry date" k="expirySort" sort={sort} onSort={toggle} />
                  </tr>
                </THead>
                <tbody>
                  {slice.map((d) => (
                    <Tr key={d.id} onClick={() => setOpenId(d.id)} active={openId === d.id}>
                      <Td className="max-w-[360px]">
                        <div className="flex items-center gap-2">
                          <FileIcon name={d.name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink" title={d.name}>{d.name}</div>
                            <div className="text-xs text-faint">{d.category}, {fmtSize(d.sizeKb)}</div>
                          </div>
                        </div>
                      </Td>
                      <Td><Mono>{d.studyId}</Mono></Td>
                      <Td className="tnum">v{d.version}</Td>
                      <Td className="whitespace-nowrap">{d.uploadedBy}</Td>
                      <Td className="tnum whitespace-nowrap">{fmtDate(d.uploadedOn)}</Td>
                      <Td><StatusBadge status={d.status} /></Td>
                      <Td className="whitespace-nowrap"><ExpiryCell date={d.expiryDate} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pager page={safePage} pages={pages} setPage={setPage} from={safePage * PAGE_SIZE + 1} to={Math.min(sorted.length, safePage * PAGE_SIZE + PAGE_SIZE)} total={sorted.length} noun="documents" />
            </>
          )}
        </Panel>
      </div>

      <Drawer open={!!openDoc} onClose={() => setOpenId(null)} title="Document details" width="max-w-xl">
        {openDoc && (
          <DocumentDetail
            doc={openDoc}
            study={studyById.get(openDoc.studyId)}
            canUpload={can('documents:upload')}
            onDownload={() => toast('info', `Download started: ${openDoc.name}`)}
            onNewVersion={() => setUpload({ open: true, replaces: openDoc })}
          />
        )}
      </Drawer>

      <UploadModal
        open={upload.open}
        replaces={upload.replaces}
        studies={studies}
        onClose={() => setUpload({ open: false })}
        onUploaded={(doc) => {
          setUpload({ open: false })
          toast('success', 'Document uploaded')
          reload()
          if (openId) setOpenId(doc.id)
        }}
      />
    </div>
  )
}

function CategoryButton({ label, count, active, onClick, icon: Icon, tone, loading }: {
  label: string; count: number; active: boolean; onClick: () => void; icon?: typeof FolderOpen; tone?: 'warn'; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex w-full items-center gap-2 rounded-[var(--radius-ctl)] px-2.5 py-1.5 text-left text-[13.5px]',
        active ? 'bg-ink text-white' : 'text-ink-3 hover:bg-canvas hover:text-ink',
      )}
    >
      {Icon && <Icon className={cx('size-4 shrink-0', active ? 'text-white' : tone === 'warn' ? 'text-warn' : 'text-faint')} aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cx(
        'tnum rounded px-1.5 text-xs',
        active ? 'bg-white/15 text-white' : tone === 'warn' && count > 0 ? 'bg-warn-soft font-medium text-warn' : 'text-faint',
      )}>{loading ? '…' : count}</span>
    </button>
  )
}

function DocumentDetail({ doc, study, canUpload, onDownload, onNewVersion }: {
  doc: StudyDocument; study?: Study; canUpload: boolean; onDownload: () => void; onNewVersion: () => void
}) {
  const meta: [string, ReactNode][] = [
    ['Document ID', <Mono key="id">{doc.id}</Mono>],
    ['Study', study ? <span key="s"><Mono>{study.id}</Mono> <span className="text-muted">{study.shortTitle}</span></span> : doc.studyId],
    ['Category', doc.category],
    ['Current version', `v${doc.version}`],
    ['Approval status', <StatusBadge key="st" status={doc.status} />],
    ['Uploaded by', doc.uploadedBy],
    ['Upload date', fmtDate(doc.uploadedOn)],
    ['File size', fmtSize(doc.sizeKb)],
    ['Expiry date', <ExpiryCell key="e" date={doc.expiryDate} />],
  ]
  return (
    <div>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-ctl)] bg-canvas ring-1 ring-line"><FileIcon name={doc.name} className="size-5" /></span>
          <div className="min-w-0">
            <div className="font-semibold break-all text-ink">{doc.name}</div>
            <div className="mt-0.5 text-[13px] text-muted">Version {doc.version}, {doc.status.toLowerCase()}, uploaded {fmtDate(doc.uploadedOn)}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" icon={Download} onClick={onDownload}>Download</Button>
          {canUpload && <Button size="sm" variant="primary" icon={Upload} onClick={onNewVersion}>Upload new version</Button>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line px-5 py-4 text-[13px]">
        {meta.map(([k, v]) => (
          <div key={k}>
            <dt className="text-faint">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="px-5 py-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink"><History className="size-4 text-faint" aria-hidden />Version history</h3>
        <ol>
          {doc.history.map((h, i) => {
            const current = i === 0
            const muted = h.status === 'Superseded'
            const last = i === doc.history.length - 1
            return (
              <li key={`${h.version}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && <span className="absolute top-6 bottom-0 left-[9px] w-px bg-line-2" aria-hidden />}
                <span className={cx('relative z-[1] mt-1 size-[19px] shrink-0 rounded-full border-2', current ? 'border-ink bg-ink' : 'border-line-2 bg-white')} aria-hidden />
                <div className={cx('min-w-0 flex-1 rounded-[var(--radius-ctl)] px-3 py-2', current ? 'bg-info-soft/60 ring-1 ring-info/20' : '', muted && 'opacity-70')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('tnum font-medium', current ? 'text-ink' : 'text-ink-3')}>Version {h.version}</span>
                    <StatusBadge status={h.status} />
                    {current && <Badge tone="ink">Current</Badge>}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">{h.uploadedBy}, {fmtDate(h.uploadedOn)}</div>
                  {h.note && <div className="mt-1 text-[12.5px] text-ink-3">{h.note}</div>}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

interface UploadForm { studyId: string; category: DocCategory | ''; version: string; expiryDate: string; note: string }

function UploadModal({ open, replaces, studies, onClose, onUploaded }: {
  open: boolean; replaces?: StudyDocument; studies: Study[]; onClose: () => void; onUploaded: (d: StudyDocument) => void
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [drag, setDrag] = useState(false)
  const [f, setF] = useState<UploadForm>({ studyId: '', category: '', version: '1.0', expiryDate: '', note: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof UploadForm, string>>>({})
  const [progress, setProgress] = useState<number | null>(null)

  // Reset the form each time the modal opens (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setFile(null); setFileError(''); setErrors({}); setProgress(null); setDrag(false)
      if (replaces) {
        const v = parseVersion(replaces.version)
        setF({ studyId: replaces.studyId, category: replaces.category, version: v ? `${v[0]}.${v[1] + 1}` : '', expiryDate: replaces.expiryDate && replaces.expiryDate > todayIso ? replaces.expiryDate : '', note: '' })
      } else {
        setF({ studyId: '', category: '', version: '1.0', expiryDate: '', note: '' })
      }
    }
  }

  const acceptFile = (fl: File | undefined) => {
    if (!fl) return
    const ext = `.${fl.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ACCEPT.includes(ext)) { setFile(null); setFileError('Only PDF, Word (.docx) and Excel (.xlsx) files can be uploaded.'); return }
    if (fl.size > MAX_BYTES) { setFile(null); setFileError(`File is ${(fl.size / 1024 / 1024).toFixed(1)} MB. The maximum size is 20 MB.`); return }
    if (fl.size === 0) { setFile(null); setFileError('The selected file is empty.'); return }
    setFile(fl); setFileError('')
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDrag(false)
    if (progress !== null) return
    acceptFile(e.dataTransfer.files?.[0])
  }

  const set = <K extends keyof UploadForm>(k: K, v: UploadForm[K]) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })) }

  const submit = () => {
    const e: Partial<Record<keyof UploadForm, string>> = {}
    if (!file) setFileError('Select a file to upload.')
    if (!f.studyId) e.studyId = 'Select a study.'
    if (!f.category) e.category = 'Select a category.'
    if (!parseVersion(f.version)) e.version = 'Use a version number like 1.0 or 3.2.'
    else if (replaces && !versionGt(f.version, replaces.version)) e.version = `Must be higher than the current version ${replaces.version}.`
    if (f.expiryDate && f.expiryDate <= todayIso) e.expiryDate = 'Expiry date must be in the future.'
    if (replaces && f.note.trim().length < 5) e.note = 'Describe what changed in this version.'
    setErrors(e)
    if (!file || Object.keys(e).length) return

    setProgress(0)
    const started = Date.now()
    const timer = setInterval(() => {
      const p = Math.min(100, ((Date.now() - started) / 1200) * 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(timer)
        documentService.upload({
          fileName: file.name,
          studyId: f.studyId,
          category: f.category as DocCategory,
          version: f.version.trim(),
          expiryDate: f.expiryDate || undefined,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          note: f.note.trim(),
          replacesId: replaces?.id,
        })
          .then(onUploaded)
          .catch(() => { toast('error', 'Upload failed. Try again.'); setProgress(null) })
      }
    }, 60)
  }

  const uploading = progress !== null

  return (
    <Modal
      open={open}
      onClose={() => { if (!uploading) onClose() }}
      size="lg"
      title={replaces ? 'Upload new version' : 'Upload document'}
      description={replaces ? `Replaces ${replaces.name} (v${replaces.version}). The current version will be marked superseded.` : 'New documents start as under review until approved.'}
      footer={<>
        <Button onClick={onClose} disabled={uploading}>Cancel</Button>
        <Button variant="primary" icon={UploadCloud} onClick={submit} loading={uploading}>{replaces ? 'Upload new version' : 'Upload document'}</Button>
      </>}
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); inputRef.current?.click() } }}
          role="button"
          tabIndex={0}
          aria-label="Choose a file to upload"
          className={cx(
            'flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-panel)] border-2 border-dashed px-4 py-7 text-center transition-colors',
            drag ? 'border-info bg-info-soft' : fileError ? 'border-crit/60 bg-crit-soft/30' : 'border-line-2 bg-canvas/60 hover:border-ink-3',
            uploading && 'cursor-default opacity-70',
          )}
        >
          <UploadCloud className={cx('mb-2 size-7', drag ? 'text-info' : 'text-faint')} aria-hidden />
          <p className="text-sm font-medium text-ink">{drag ? 'Drop the file to attach it' : 'Drag and drop a file here, or click to browse'}</p>
          <p className="mt-0.5 text-xs text-muted">PDF, DOCX or XLSX, up to 20 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(',')}
            className="hidden"
            onChange={(e) => { acceptFile(e.target.files?.[0]); e.target.value = '' }}
          />
        </div>
        {fileError && <p className="-mt-2 text-xs text-crit" role="alert">{fileError}</p>}
        {file && (
          <div className="flex items-center gap-3 rounded-[var(--radius-ctl)] border border-line px-3 py-2">
            <FileIcon name={file.name} className="size-5" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{file.name}</div>
              <div className="text-xs text-muted">{fmtSize(file.size / 1024)}</div>
              {uploading && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={progress ?? 0} tone={progress === 100 ? 'ok' : 'info'} label="Upload progress" />
                  <span className="tnum w-10 text-right text-xs text-muted">{Math.round(progress ?? 0)}%</span>
                </div>
              )}
            </div>
            {!uploading && (
              <button onClick={() => setFile(null)} className="rounded p-1 text-faint hover:bg-canvas hover:text-ink" aria-label="Remove selected file"><X className="size-4" /></button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Study" required htmlFor="up-study" error={errors.studyId}>
            <Select id="up-study" value={f.studyId} onChange={(e) => set('studyId', e.target.value)} disabled={!!replaces || uploading} invalid={!!errors.studyId}>
              <option value="">Select study</option>
              {studies.map((s) => <option key={s.id} value={s.id}>{s.id}, {s.shortTitle}</option>)}
            </Select>
          </Field>
          <Field label="Category" required htmlFor="up-cat" error={errors.category}>
            <Select id="up-cat" value={f.category} onChange={(e) => set('category', e.target.value as DocCategory)} disabled={!!replaces || uploading} invalid={!!errors.category}>
              <option value="">Select category</option>
              {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Version" required htmlFor="up-ver" error={errors.version} hint={replaces ? `Current version is ${replaces.version}` : 'Major.minor, for example 1.0 or 3.2'}>
            <Input id="up-ver" value={f.version} onChange={(e) => set('version', e.target.value)} disabled={uploading} invalid={!!errors.version} inputMode="decimal" />
          </Field>
          <Field label="Expiry date" htmlFor="up-exp" error={errors.expiryDate} hint="Optional. Use for approvals, policies and certificates.">
            <Input id="up-exp" type="date" min={todayIso} value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} disabled={uploading} invalid={!!errors.expiryDate} />
          </Field>
          <Field label="Change note" required={!!replaces} htmlFor="up-note" error={errors.note} className="md:col-span-2">
            <Textarea id="up-note" value={f.note} onChange={(e) => set('note', e.target.value)} disabled={uploading} placeholder={replaces ? 'For example, incorporates IEC comments of 12 Sep' : 'Optional context for reviewers'} invalid={!!errors.note} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
