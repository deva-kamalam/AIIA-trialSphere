import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RoleId, User } from '@/types'
import { USERS } from '@/data/seed'
import { getSessionUser, setSessionUser } from './session'
import { can as canRole } from './permissions'
import { AuthCtx, type AuthState } from './useAuth'
import { recordAudit } from '@/services/audit'

const IDLE_LIMIT_MS = 15 * 60 * 1000
const WARN_BEFORE_MS = 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getSessionUser())
  const [idleWarning, setIdleWarning] = useState<number | null>(null)
  const [lastLogoutReason, setReason] = useState<'manual' | 'timeout' | null>(null)
  const lastActive = useRef(0)
  const idleWarningRef = useRef<number | null>(null)
  useEffect(() => { idleWarningRef.current = idleWarning }, [idleWarning])

  const logout = useCallback((reason: 'manual' | 'timeout' = 'manual') => {
    if (reason === 'timeout') recordAudit('Session timed out', 'Session', getSessionUser()?.email ?? '')
    else recordAudit('Signed out', 'Session', getSessionUser()?.email ?? '')
    setSessionUser(null)
    setUser(null)
    setIdleWarning(null)
    setReason(reason)
  }, [])

  const login: AuthState['login'] = useCallback(async (email, password) => {
    await new Promise((r) => setTimeout(r, 450))
    const e = email.trim().toLowerCase()
    if (!e.endsWith('.in') && !e.endsWith('.org')) return { ok: false, error: 'Use your institutional email address.' }
    if (password.length < 8) return { ok: false, error: 'Email or password is incorrect.' }
    // Demo: any institutional email signs in; known addresses get their own role.
    const known = USERS.find((u) => u.email === e)
    const u: User = known ?? { ...USERS[0], email: e }
    setSessionUser(u)
    setUser(u)
    setReason(null)
    lastActive.current = Date.now()
    recordAudit('Signed in', 'Session', u.email)
    return { ok: true }
  }, [])

  const switchRole = useCallback((role: RoleId) => {
    setUser((prev) => {
      if (!prev) return prev
      // Demo mode: each role maps to its sample user so names match the view.
      const sample = USERS.find((u) => u.role === role) ?? prev
      const next = { ...sample, role }
      setSessionUser(next)
      recordAudit('Switched demo role', 'Session', next.email, prev.role, role)
      return next
    })
  }, [])

  const stayActive = useCallback(() => {
    lastActive.current = Date.now()
    setIdleWarning(null)
  }, [])

  // Idle tracking
  useEffect(() => {
    if (!user) return
    lastActive.current = Date.now()
    const bump = () => {
      if (idleWarningRef.current === null) lastActive.current = Date.now()
    }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }))
    const t = setInterval(() => {
      const idle = Date.now() - lastActive.current
      if (idle >= IDLE_LIMIT_MS) logout('timeout')
      else if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) setIdleWarning(Math.ceil((IDLE_LIMIT_MS - idle) / 1000))
    }, 1000)
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump))
      clearInterval(t)
    }
  }, [user, logout])

  const value = useMemo<AuthState>(() => ({
    user, login, logout, switchRole,
    can: (p) => (user ? canRole(user.role, p) : false),
    idleWarning, stayActive, lastLogoutReason,
  }), [user, login, logout, switchRole, idleWarning, stayActive, lastLogoutReason])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}


