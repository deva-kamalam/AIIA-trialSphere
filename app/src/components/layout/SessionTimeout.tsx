import { useAuth } from '@/auth/useAuth'
import { Button, Modal } from '@/components/ui'

export function SessionTimeoutDialog() {
  const { idleWarning, stayActive, logout } = useAuth()
  return (
    <Modal
      open={idleWarning !== null}
      onClose={stayActive}
      size="sm"
      title="Your session is about to end"
      footer={
        <>
          <Button onClick={() => logout('manual')}>Sign out now</Button>
          <Button variant="primary" onClick={stayActive}>Stay signed in</Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        For security, you'll be signed out after 15 minutes without activity. Unsaved form entries will be lost.
      </p>
      <p className="tnum mt-3 text-3xl font-semibold text-ink" aria-live="polite">
        0:{String(idleWarning ?? 0).padStart(2, '0')}
      </p>
    </Modal>
  )
}
