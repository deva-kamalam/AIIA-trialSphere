import { request } from './api'
import { AUDIT_EVENTS } from '@/data/seed'
import { getSessionUser } from '@/auth/session'
import { ROLES } from '@/auth/permissions'
import { commit } from './store'

/** Append an audit entry for a user action. Client-side only in this demo build. */
export function recordAudit(action: string, objectType: string, objectId: string, previous?: string, next?: string) {
  const u = getSessionUser()
  AUDIT_EVENTS.unshift({
    id: `AUD-${20932 + AUDIT_EVENTS.length}`,
    timestamp: new Date().toISOString(),
    user: u?.name ?? 'System',
    role: u ? ROLES[u.role].label : 'Automated',
    action, objectType, objectId, previous, next,
    ip: u ? '10.12.4.21' : '—',
  })
  commit()
}

export const auditService = {
  list: () => request(() => AUDIT_EVENTS),
}
