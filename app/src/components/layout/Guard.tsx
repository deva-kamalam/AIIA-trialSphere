import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ROLES, type Permission } from '@/auth/permissions'
import { Button } from '@/components/ui'

export function PermissionDenied({ perm }: { perm?: Permission }) {
  const { user } = useAuth()
  const roleLabel = user ? ROLES[user.role].label : ''
  return (
    <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-panel)] border border-line bg-white px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-canvas">
        <Lock className="size-5 text-ink-3" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-ink">You don't have access to this area</h1>
      <p className="mt-2 text-sm text-muted">
        The {roleLabel} role can't open this module{perm ? ` (requires the ${perm} permission)` : ''}.
        Ask your study administrator if you need access.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/"><Button variant="primary">Go to dashboard</Button></Link>
      </div>
    </div>
  )
}

export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can } = useAuth()
  return can(perm) ? <>{children}</> : <PermissionDenied perm={perm} />
}
