import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, FlaskConical, User, Building2, FileText, Stethoscope, HeartPulse, CalendarClock, CornerDownLeft, Loader2 } from 'lucide-react'
import { searchService } from '@/services'
import type { SearchResult } from '@/types'
import { cx } from '@/lib/format'

const ICON: Record<SearchResult['kind'], typeof Search> = {
  Study: FlaskConical, Participant: User, Site: Building2, Document: FileText, Investigator: Stethoscope, 'Safety Event': HeartPulse, Visit: CalendarClock,
}
const KIND_ORDER: SearchResult['kind'][] = ['Study', 'Participant', 'Document', 'Safety Event', 'Visit', 'Site', 'Investigator']
const SUGGESTIONS = ['AYU-001', 'AIIA-AYU001-0034', 'Protocol', 'Nausea', 'Jaipur', 'Dr. Ananya']

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  // Results are tagged with the query they answer, so "loading" is simply a stale tag.
  const [resolved, setResolved] = useState<{ q: string; results: SearchResult[] }>({ q: '', results: [] })
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setQ('')
  }
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  const short = q.trim().length < 2
  useEffect(() => {
    if (short) return
    const t = setTimeout(() => {
      searchService.query(q).then((r) => { setResolved({ q, results: r }); setActive(0) })
    }, 120)
    return () => clearTimeout(t)
  }, [q, short])
  const results = useMemo(() => (short ? [] : resolved.results), [short, resolved])
  const loading = !short && resolved.q !== q

  const grouped = useMemo(() => {
    const g = KIND_ORDER.map((k) => ({ kind: k, items: results.filter((r) => r.kind === k) })).filter((x) => x.items.length)
    return g
  }, [results])
  const flat = grouped.flatMap((g) => g.items)

  const go = (r: SearchResult) => { onClose(); navigate(r.link) }

  if (!open) return null
  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Global search" className="anim-rise w-full max-w-2xl overflow-hidden rounded-[var(--radius-panel)] bg-white shadow-[0_24px_60px_-12px_rgba(15,39,71,0.4)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {loading ? <Loader2 className="size-5 animate-spin text-faint" /> : <Search className="size-5 text-faint" aria-hidden />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
              if (e.key === 'Enter' && flat[active]) go(flat[active])
            }}
            placeholder="Search studies, participants, sites, documents, investigators, events, visits"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-line-2 px-1.5 text-[11px] text-muted">Esc</kbd>
        </div>
        <div className="scroll-thin max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-4 py-4">
              <div className="mb-2 text-xs text-muted">Try</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setQ(s)} className="rounded border border-line-2 px-2 py-1 text-[13px] text-ink-3 hover:border-ink-3 hover:text-ink">{s}</button>
                ))}
              </div>
            </div>
          ) : !loading && flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">Nothing matches "{q}". Check the study or participant code.</div>
          ) : (
            grouped.map((g) => (
              <div key={g.kind} className="py-1.5">
                <div className="px-4 py-1 text-xs font-medium text-muted">{g.kind === 'Study' ? 'Studies' : g.kind === 'Safety Event' ? 'Safety events' : `${g.kind}s`}</div>
                {g.items.map((r) => {
                  const idx = flat.indexOf(r)
                  const I = ICON[r.kind]
                  return (
                    <button
                      key={r.kind + r.id}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => go(r)}
                      className={cx('flex w-full items-center gap-3 px-4 py-2 text-left', idx === active ? 'bg-info-soft/60' : 'hover:bg-canvas')}
                    >
                      <I className="size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-ink">{r.title}</span>
                        <span className="block truncate text-xs text-muted">{r.subtitle}</span>
                      </span>
                      {idx === active && <CornerDownLeft className="size-3.5 text-faint" aria-hidden />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
