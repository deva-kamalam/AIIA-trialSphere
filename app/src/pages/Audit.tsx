import { useMemo, useState } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Download, History, Info, List, Rows3 } from 'lucide-react'
import { auditService } from '@/services'
import { useAsync, usePaged } from '@/lib/hooks'
import { cx, fmtTime } from '@/lib/format'
import type { AuditEvent } from '@/types'
import { Badge, Button, EmptyState, Mono, PageHeader, Panel, Skeleton, type Tone } from '@/components/ui/primitives'
import { ClearFilters, FilterBar, FilterSelect, Pager, SearchInput, Segmented, Table, THead, Th, Td, Tr } from '@/components/ui/data'
import { useToast } from '@/components/ui/toast'

type Category = 'Create' | 'Update' | 'Review' | 'Sign-in' | 'Export'
const CATEGORIES: Category[] = ['Create', 'Update', 'Review', 'Sign-in', 'Export']
const CAT_TONE: Record<Category, Tone> = { Create: 'ok', Update: 'info', Review: 'warn', 'Sign-in': 'neutral', Export: 'neutral' }

function categoryOf(e: AuditEvent): Category {
  const a = e.action.toLowerCase()
  if (e.objectType === 'Session' || /sign(ed)? (in|out)|timed out|demo role/.test(a)) return 'Sign-in'
  if (/export/.test(a)) return 'Export'
  if (/review|viewed|decision|signed|advanced/.test(a)) return 'Review'
  if (/^(created|uploaded|enrolled|reported|raised|recorded|generated)/.test(a)) return 'Create'
  return 'Update'
}

type DateRange = 'today' | '7' | '30' | 'all'
const DATE_OPTS: { id: DateRange; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: 'all', label: 'All' },
]
type View = 'ledger' | 'table'

const CODE_RE = /^(AIIA-|AYU-|AE-|AUD-|DOC-|Q-|S\d{2}\b)/

/** Object reference: codes in monospace, descriptive parts in plain text. */
function ObjectRef({ e }: { e: AuditEvent }) {
  const [head, ...rest] = e.objectId.split(', ')
  return (
    <span className="min-w-0">
      <span className="text-muted">{e.objectType}</span>{' '}
      {CODE_RE.test(head) ? <Mono className="text-ink">{head}</Mono> : <span className="text-ink">{head}</span>}
      {rest.length > 0 && <span className="text-ink">, {rest.join(', ')}</span>}
    </span>
  )
}

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMM yyyy')
}

function initials(name: string) {
  if (name === 'System') return 'SY'
  return name.replace(/^(Dr\.|Prof\.)\s+/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function Diff({ e }: { e: AuditEvent }) {
  if (!e.previous && !e.next) return <p className="text-[13px] text-faint">No value change recorded</p>
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-[var(--radius-ctl)] border border-crit/15 bg-crit-soft/50 px-2.5 py-1.5">
        <div className="text-[11.5px] text-muted">Previous value</div>
        {e.previous
          ? <div className="text-[13px] text-crit/80 line-through decoration-crit/40">{e.previous}</div>
          : <div className="text-[13px] text-faint">None</div>}
      </div>
      <div className="rounded-[var(--radius-ctl)] border border-ok/20 bg-ok-soft/70 px-2.5 py-1.5">
        <div className="text-[11.5px] text-muted">New value</div>
        {e.next ? <div className="text-[13px] font-medium text-ok">{e.next}</div> : <div className="text-[13px] text-faint">None</div>}
      </div>
    </div>
  )
}

export default function Audit() {
  const toast = useToast()
  const { data, loading, error } = useAsync(() => auditService.list())
  const [now] = useState(() => Date.now())
  const [q, setQ] = useState('')
  const [user, setUser] = useState('')
  const [objectType, setObjectType] = useState('')
  const [cat, setCat] = useState('')
  const [range, setRange] = useState<DateRange>('30')
  const [view, setView] = useState<View>('ledger')

  const events = useMemo(() => (data ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [data])
  const users = useMemo(() => Array.from(new Set(events.map((e) => e.user))).sort(), [events])
  const objectTypes = useMemo(() => Array.from(new Set(events.map((e) => e.objectType))).sort(), [events])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return events.filter((e) => {
      const ts = parseISO(e.timestamp)
      if (range === 'today' && !isToday(ts)) return false
      if (range !== 'today' && range !== 'all' && now - ts.getTime() > Number(range) * 86400000) return false
      if (user && e.user !== user) return false
      if (objectType && e.objectType !== objectType) return false
      if (cat && categoryOf(e) !== cat) return false
      if (s && ![e.user, e.role, e.action, e.objectType, e.objectId, e.previous, e.next, e.id].some((x) => x?.toLowerCase().includes(s))) return false
      return true
    })
  }, [now, events, q, user, objectType, cat, range])

  const groups = useMemo(() => {
    const out: { label: string; items: AuditEvent[] }[] = []
    for (const e of filtered) {
      const label = dayLabel(parseISO(e.timestamp))
      const g = out[out.length - 1]
      if (g && g.label === label) g.items.push(e)
      else out.push({ label, items: [e] })
    }
    return out
  }, [filtered])

  const paged = usePaged(filtered, 25)
  const dirty = !!(q || user || objectType || cat || range !== '30')
  const clear = () => { setQ(''); setUser(''); setObjectType(''); setCat(''); setRange('30') }

  const exportCsv = () => {
    const head = ['Event ID', 'Timestamp', 'User', 'Role', 'Action', 'Action type', 'Object type', 'Object', 'Previous value', 'New value', 'IP address']
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const lines = [head, ...filtered.map((e) => [
      e.id, format(parseISO(e.timestamp), 'yyyy-MM-dd HH:mm:ss'), e.user, e.role, e.action, categoryOf(e), e.objectType,
      e.objectId, e.previous ?? '', e.next ?? '', e.ip,
    ])].map((r) => r.map(esc).join(','))
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `aiia-audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('success', 'Audit log exported')
  }

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="Who changed what, when, and from where across studies, participants, safety and documents."
        actions={<Button icon={Download} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>}
      />

      <div className="mb-4 flex items-start gap-2 text-[13px] text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>Entries are recorded for create, update, review and sign-in actions. Records shown are read-only in this interface.</p>
      </div>

      <Panel bodyClass="p-0">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search user, action, object or value" className="w-full sm:w-72" />
          <FilterSelect label="User" value={user} onChange={setUser} options={users} />
          <FilterSelect label="Action" value={cat} onChange={setCat} options={CATEGORIES} />
          <FilterSelect label="Object" value={objectType} onChange={setObjectType} options={objectTypes} />
          <Segmented size="sm" options={DATE_OPTS} value={range} onChange={setRange} />
          <ClearFilters show={dirty} onClear={clear} />
          <div className="ml-auto flex items-center gap-3">
            <span className="tnum text-[13px] text-muted">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
            <div className="inline-flex rounded-[var(--radius-ctl)] border border-line-2 bg-white p-0.5" role="group" aria-label="View">
              {([['ledger', 'Ledger', Rows3], ['table', 'Table', List]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
                  className={cx('inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-medium', view === id ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
                  <Icon className="size-3.5" aria-hidden />{label}
                </button>
              ))}
            </div>
          </div>
        </FilterBar>

        {error && <p className="px-4 py-6 text-sm text-crit">The audit log could not be loaded. {error}</p>}

        {loading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !filtered.length ? (
          <EmptyState icon={History} title="No audit entries match" body="Widen the date range or clear filters to see more activity."
            action={dirty ? <Button onClick={clear}>Clear filters</Button> : undefined} />
        ) : view === 'ledger' ? (
          <div>
            {groups.map((g) => (
              <section key={g.label}>
                <h3 className="sticky top-0 z-[1] border-b border-line bg-canvas/95 px-4 py-1.5 text-[13px] font-medium text-ink backdrop-blur">
                  {g.label} <span className="font-normal text-faint">{g.items.length} {g.items.length === 1 ? 'entry' : 'entries'}</span>
                </h3>
                <ol>
                  {g.items.map((e) => {
                    const c = categoryOf(e)
                    return (
                      <li key={e.id} className="grid grid-cols-[52px_1fr] gap-x-3 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[60px_1fr]">
                        <div className="tnum pt-0.5 text-[13px] font-medium text-ink">{fmtTime(e.timestamp)}</div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', e.user === 'System' ? 'bg-canvas text-muted ring-1 ring-line' : 'bg-ink/10 text-ink')} aria-hidden>
                                {initials(e.user)}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[13.5px]">
                                  <span className="font-medium text-ink">{e.user}</span> <span className="text-muted">{e.role}</span>
                                </div>
                                <div className="text-[13.5px] text-ink">{e.action}</div>
                                <div className="text-[13px]"><ObjectRef e={e} /></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-faint">
                              <Badge tone={CAT_TONE[c]}>{c}</Badge>
                              <Mono className="text-faint">{e.id}</Mono>
                              <span>IP {e.ip}</span>
                            </div>
                          </div>
                          <div className="mt-2 sm:pl-[38px]"><Diff e={e} /></div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <>
            <Table minWidth={1080}>
              <THead><tr><Th>User</Th><Th>Timestamp</Th><Th>Action</Th><Th>Object</Th><Th>Previous value</Th><Th>New value</Th><Th>IP address</Th></tr></THead>
              <tbody>
                {paged.slice.map((e) => (
                  <Tr key={e.id}>
                    <Td><div className="font-medium text-ink">{e.user}</div><div className="text-xs text-muted">{e.role}</div></Td>
                    <Td className="tnum whitespace-nowrap text-ink">{format(parseISO(e.timestamp), 'd MMM yyyy, HH:mm')}</Td>
                    <Td><div className="text-ink">{e.action}</div><Badge tone={CAT_TONE[categoryOf(e)]} className="mt-0.5">{categoryOf(e)}</Badge></Td>
                    <Td className="max-w-[260px]"><ObjectRef e={e} /></Td>
                    <Td className="max-w-[200px]">{e.previous ? <span className="text-crit/80 line-through decoration-crit/40">{e.previous}</span> : <span className="text-faint">—</span>}</Td>
                    <Td className="max-w-[240px]">{e.next ? <span className="font-medium text-ok">{e.next}</span> : <span className="text-faint">—</span>}</Td>
                    <Td className="tnum text-faint">{e.ip}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pager {...paged} noun="entries" />
          </>
        )}
      </Panel>
    </div>
  )
}
