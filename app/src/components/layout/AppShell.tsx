import { useEffect, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { cx } from '@/lib/format'
import { NAV } from './nav'
import { Topbar } from './Topbar'
import { SessionTimeoutDialog } from './SessionTimeout'
import { ErrorBoundary } from './ErrorBoundary'

function Brand({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#1e3a64" />
        <path d="M9 23 16 8l7 15M11.8 17.5h8.4" stroke="#5fd1c1" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-wide text-white">AIIA</div>
          <div className="text-[12px] text-white/60">Clinical Research</div>
        </div>
      )}
    </div>
  )
}

const WIDE = '(min-width: 1280px)'
function useWide() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(WIDE).matches,
  )
}

export function AppShell() {
  const { can } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('aiia.nav.collapsed') === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()
  // On tablet widths the sidebar is always the icon rail; expanding opens it as an overlay.
  const wide = useWide()
  const compact = wide ? collapsed : true

  // Close the mobile drawer on navigation.
  const [navPath, setNavPath] = useState(loc.pathname)
  if (navPath !== loc.pathname) {
    setNavPath(loc.pathname)
    setMobileOpen(false)
  }
  useEffect(() => {
    try { localStorage.setItem('aiia.nav.collapsed', collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  const items = NAV.filter((n) => !n.perm || can(n.perm))

  const nav = (compact: boolean) => (
    <nav aria-label="Main" className="scroll-thin flex-1 overflow-y-auto px-2 pb-4">
      <ul className="space-y-0.5">
        {items.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.to === '/'}
              title={compact ? n.label : undefined}
              className={({ isActive }) => cx(
                'group flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] transition-colors',
                isActive ? 'bg-white/[0.12] font-medium text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                compact && 'justify-center px-0',
              )}
            >
              {({ isActive }) => (
                <>
                  <n.icon className={cx('size-[18px] shrink-0', isActive ? 'text-[#5fd1c1]' : 'text-white/50 group-hover:text-white/80')} aria-hidden />
                  {!compact && <span className="truncate">{n.label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop / tablet sidebar */}
      <div className={cx('hidden shrink-0 bg-ink md:block', compact ? 'w-[68px]' : 'w-[248px]')}>
      <aside className="sticky top-0 flex h-screen flex-col">
        <Brand compact={compact} />
        {nav(compact)}
        <button
          onClick={() => (wide ? setCollapsed((c) => !c) : setMobileOpen(true))}
          className={cx('m-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-white/55 hover:bg-white/[0.06] hover:text-white', compact && 'justify-center')}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {compact ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
        </button>
      </aside>
      </div>

      {/* Mobile off-canvas */}
      {mobileOpen && (
        <div className="anim-fade fixed inset-0 z-40 bg-ink/40 xl:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="flex h-full w-[260px] flex-col bg-ink" onClick={(e) => e.stopPropagation()}>
            <Brand compact={false} />
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          leading={
            <button className="rounded p-1.5 text-ink-3 hover:bg-canvas md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
          }
        />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <ErrorBoundary key={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className="border-t border-line px-6 py-3 text-xs text-faint lg:px-8">
          AIIA Clinical Research Platform. Demo environment: all records are fictional.
        </footer>
      </div>
      <SessionTimeoutDialog />
    </div>
  )
}
