import { createContext, useContext } from 'react'
import type { RoleId, User } from '@/types'
import type { Permission } from './permissions'

export interface AuthState {
  user: User | null
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: (reason?: 'manual' | 'timeout') => void
  switchRole: (role: RoleId) => void
  can: (p: Permission) => boolean
  /** Seconds left before automatic sign-out; null while the user is active. */
  idleWarning: number | null
  stayActive: () => void
  lastLogoutReason: 'manual' | 'timeout' | null
}

export const AuthCtx = createContext<AuthState | null>(null)

export function useAuth() {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
