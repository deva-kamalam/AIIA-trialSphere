import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Clock } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ROLES } from '@/auth/permissions'
import { USERS } from '@/data/seed'
import { Button, Field, Input } from '@/components/ui'
import { LIFECYCLE } from '@/types'

const DEMO_PASSWORD = 'research2026'

export default function Login() {
  const { user, login, lastLogoutReason } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const emailErr = touched && !email ? 'Enter your institutional email.' : undefined
  const pwErr = touched && !password ? 'Enter your password.' : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!email || !password) return
    setBusy(true)
    const r = await login(email, password)
    setBusy(false)
    if (r.ok) navigate(from, { replace: true })
    else setError(r.error)
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      {/* Context panel */}
      <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_100%,rgba(14,138,126,0.28),transparent_60%)]" aria-hidden />
        <div className="relative flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="size-10" aria-hidden>
            <rect width="32" height="32" rx="6" fill="#1e3a64" />
            <path d="M9 23 16 8l7 15M11.8 17.5h8.4" stroke="#5fd1c1" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-wide text-white">AIIA</div>
            <div className="text-[13px] text-white/60">All India Institute of Ayurveda</div>
          </div>
        </div>

        <div className="relative max-w-[520px]">
          <p className="text-[28px] leading-snug font-medium text-white">
            Every study, from protocol to database lock, in one place.
          </p>
          {/* The study lifecycle as the visual: the thing this product tracks */}
          <ol className="mt-10 space-y-0" aria-label="Study lifecycle">
            {LIFECYCLE.map((s, i) => (
              <li key={s} className="flex items-stretch gap-4">
                <div className="flex flex-col items-center">
                  <span className={i < 5 ? 'mt-1 size-2.5 rounded-full bg-[#5fd1c1]' : i === 5 ? 'mt-1 size-2.5 rounded-full border-2 border-[#5fd1c1] bg-ink' : 'mt-1 size-2.5 rounded-full border border-white/30'} />
                  {i < LIFECYCLE.length - 1 && <span className={i < 5 ? 'w-px flex-1 bg-[#5fd1c1]/60' : 'w-px flex-1 bg-white/15'} />}
                </div>
                <div className={`pb-3 text-[13.5px] ${i <= 5 ? 'text-white/85' : 'text-white/40'}`}>{s}</div>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-white/45">Demo environment. All studies, participants and events shown are fictional.</p>
      </div>

      {/* Sign-in */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <div className="text-lg font-semibold text-ink">AIIA</div>
          </div>
          <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-ink">Clinical Research Platform</h1>
          <p className="mt-1.5 text-sm text-muted">Integrated Clinical Trial Management for Ayurveda Research</p>

          {lastLogoutReason === 'timeout' && (
            <div className="mt-6 flex gap-2.5 rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px] text-warn" role="status">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              You were signed out after 15 minutes of inactivity. Sign in again to continue.
            </div>
          )}

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Institutional email" htmlFor="email" error={emailErr}>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} invalid={!!emailErr} placeholder="name@aiia.example.in" />
            </Field>
            <Field label="Password" htmlFor="password" error={pwErr}>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} invalid={!!pwErr} />
            </Field>
            {error && <p className="rounded-md bg-crit-soft px-3 py-2 text-[13px] text-crit" role="alert">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy}>Sign In</Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[12.5px] text-muted">
            <Lock className="size-3.5" aria-hidden /> Secure research environment
          </div>

          <div className="mt-10 rounded-md border border-line bg-canvas px-4 py-3">
            <div className="text-[12.5px] font-medium text-ink">Demo accounts</div>
            <p className="mt-0.5 text-xs text-muted">Pick a role to fill in the form. Password: <span className="font-mono">{DEMO_PASSWORD}</span></p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword(DEMO_PASSWORD); setError(null) }}
                  className="rounded border border-line-2 bg-white px-2 py-1 text-xs text-ink-3 hover:border-ink-3 hover:text-ink"
                >
                  {ROLES[u.role].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
