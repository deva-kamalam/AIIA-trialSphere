import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, HelpCircle, Search, LogOut, ChevronDown, Check, AlertTriangle, AlertOctagon, Info, CheckCircle2, BookOpen, LifeBuoy, Keyboard,
} from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ROLES } from '@/auth/permissions'
import type { AppNotification, NotificationLevel, RoleId } from '@/types'
import { notificationService } from '@/services'
import { Popover, useToast } from '@/components/ui'
import { ago, cx } from '@/lib/format'
import { SearchPalette } from './SearchPalette'

const LEVEL: Record<NotificationLevel, { icon: typeof Bell; cls: string; label: string }> = {
  critical: { icon: AlertOctagon, cls: 'text-crit', label: 'Critical' },
  warning: { icon: AlertTriangle, cls: 'text-warn', label: 'Warning' },
  info: { icon: Info, cls: 'text-info', label: 'Information' },
  success: { icon: CheckCircle2, cls: 'text-ok', label: 'Completed' },
}
const ORDER: NotificationLevel[] = ['critical', 'warning', 'info', 'success']

function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const navigate = useNavigate()
  useEffect(() => { notificationService.list().then(setItems) }, [])
  const unread = items.filter((n) => !n.read).length
  const shown = useMemo(
    () => items.filter((n) => filter === 'all' || !n.read).sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level) || Number(a.read) - Number(b.read)),
    [items, filter],
  )
  const markRead = (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)))
    notificationService.markRead(id)
  }
  return (
    <Popover
      align="right"
      className="w-[min(400px,calc(100vw-1.5rem))]"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className="relative rounded-md p-2 text-ink-3 hover:bg-canvas hover:text-ink" aria-label={`Notifications, ${unread} unread`}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="tnum absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-crit px-1 text-[10px] leading-4 font-semibold text-white">{unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="font-semibold text-ink">Notifications</div>
            <div className="flex items-center gap-3 text-[13px]">
              <div className="flex rounded border border-line-2 p-0.5">
                {(['all', 'unread'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cx('rounded-[3px] px-2 py-0.5 text-xs capitalize', filter === f ? 'bg-ink text-white' : 'text-muted')}>{f}</button>
                ))}
              </div>
              <button
                disabled={!unread}
                onClick={() => { setItems((xs) => xs.map((x) => ({ ...x, read: true }))); notificationService.markAllRead() }}
                className="font-medium text-info hover:underline disabled:text-faint disabled:no-underline"
              >
                Mark all read
              </button>
            </div>
          </div>
          <ul className="scroll-thin max-h-[420px] overflow-y-auto">
            {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No unread notifications.</li>}
            {shown.map((n) => {
              const L = LEVEL[n.level]
              return (
                <li key={n.id} className={cx('group flex gap-3 border-b border-line px-4 py-3 last:border-0', !n.read && 'bg-info-soft/40')}>
                  <L.icon className={cx('mt-0.5 size-4 shrink-0', L.cls)} aria-label={L.label} />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => { markRead(n.id); close(); if (n.link) navigate(n.link) }}
                  >
                    <div className={cx('text-[13.5px] text-ink', !n.read && 'font-semibold')}>{n.title}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted">{n.detail}</div>
                    <div className="mt-1 text-[11.5px] text-faint">{ago(n.time)}</div>
                  </button>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="self-start rounded p-1 text-faint hover:bg-white hover:text-ok" aria-label="Mark as read" title="Mark as read">
                      <Check className="size-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Popover>
  )
}

function HelpMenu() {
  const toast = useToast()
  return (
    <Popover
      className="w-64 py-1.5"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className="rounded-md p-2 text-ink-3 hover:bg-canvas hover:text-ink" aria-label="Help">
          <HelpCircle className="size-[18px]" />
        </button>
      )}
    >
      {(close) => (
        <ul className="text-[13.5px]">
          {[
            { icon: BookOpen, label: 'User guide', msg: 'User guide opens in the institutional knowledge base.' },
            { icon: Keyboard, label: 'Keyboard shortcuts: Ctrl + K to search', msg: 'Press Ctrl + K anywhere to open search.' },
            { icon: LifeBuoy, label: 'Contact research IT support', msg: 'Support request form opened.' },
          ].map((i) => (
            <li key={i.label}>
              <button onClick={() => { close(); toast('info', i.msg) }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-ink hover:bg-canvas">
                <i.icon className="size-4 text-muted" aria-hidden />{i.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  )
}

function UserMenu() {
  const { user, logout, switchRole } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <Popover
      className="w-72"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className="flex items-center gap-2.5 rounded-md py-1 pr-1.5 pl-1 hover:bg-canvas">
          <span className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{user.initials}</span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-[13.5px] font-medium whitespace-nowrap text-ink">{user.name}</span>
            <span className="block text-xs whitespace-nowrap text-muted">{ROLES[user.role].label}</span>
          </span>
          <ChevronDown className="hidden size-4 text-faint xl:block" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-4 py-3">
            <div className="font-medium text-ink">{user.name}</div>
            <div className="text-[12.5px] text-muted">{user.email}</div>
            <div className="text-[12.5px] text-muted">{user.department}</div>
          </div>
          <div className="border-b border-line px-2 py-2">
            <div className="px-2 pb-1.5 text-xs text-muted">Demo mode: view as role</div>
            {(Object.keys(ROLES) as RoleId[]).map((r) => (
              <button
                key={r}
                onClick={() => { switchRole(r); close(); navigate('/'); toast('info', `Now viewing as ${ROLES[r].label}.`) }}
                className={cx('flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13.5px] hover:bg-canvas', r === user.role ? 'font-medium text-ink' : 'text-ink-3')}
              >
                {ROLES[r].label}
                {r === user.role && <Check className="size-4 text-ok" aria-hidden />}
              </button>
            ))}
          </div>
          <button onClick={() => logout('manual')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] text-ink hover:bg-canvas">
            <LogOut className="size-4 text-muted" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </Popover>
  )
}

export function Topbar({ leading }: { leading?: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const { user } = useAuth()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, select')) { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      {leading}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-9 w-full max-w-[460px] items-center gap-2 rounded-[var(--radius-ctl)] border border-line-2 bg-canvas px-3 text-left text-[13.5px] text-faint hover:border-ink-3"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate">Search studies, participants, documents, events</span>
        <kbd className="hidden rounded border border-line-2 bg-white px-1.5 font-sans text-[11px] text-muted sm:inline">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        {user && (
          <span className="mr-2 hidden items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-muted xl:inline-flex">
            Role <span className="font-medium text-ink">{ROLES[user.role].label}</span>
          </span>
        )}
        <Notifications />
        <HelpMenu />
        <div className="mx-1.5 h-6 w-px bg-line" aria-hidden />
        <UserMenu />
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
