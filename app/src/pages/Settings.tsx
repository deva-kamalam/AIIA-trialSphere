import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Check, Clock, Database, KeyRound, Laptop, Link2, Minus, Plug, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { ROLES, type Permission } from '@/auth/permissions'
import type { RequirementKey, RoleId } from '@/types'
import { hasSavedChanges, recordAudit, resetDemoData, studyService } from '@/services'
import { useAsync } from '@/lib/hooks'
import { cx } from '@/lib/format'
import { Badge, Button, Field, Input, PageHeader, Panel, Skeleton } from '@/components/ui/primitives'
import { Table, THead, Th, Td, Tr, Tabs } from '@/components/ui/data'
import { Modal } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'

type TabId = 'profile' | 'roles' | 'security' | 'regulatory' | 'integrations'
const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'roles', label: 'Roles & access' },
  { id: 'security', label: 'Security' },
  { id: 'regulatory', label: 'Regulatory frameworks' },
  { id: 'integrations', label: 'Data & integrations' },
]

export default function Settings() {
  const [tab, setTab] = useState<TabId>('profile')
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, access, security and institution-level configuration." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'regulatory' && <RegulatoryTab />}
      {tab === 'integrations' && <IntegrationsTab />}
    </div>
  )
}

// ---------------- Profile ----------------
type PrefKey = 'critical' | 'warning' | 'info' | 'completed'
const PREFS: { key: PrefKey; label: string; desc: string }[] = [
  { key: 'critical', label: 'Critical alerts', desc: 'Serious adverse events, overdue safety reports, expired approvals.' },
  { key: 'warning', label: 'Warnings', desc: 'Overdue visits, documents nearing expiry, open data queries.' },
  { key: 'info', label: 'Information', desc: 'Submissions, amendments and other status updates.' },
  { key: 'completed', label: 'Completed actions', desc: 'Approvals recorded, registrations completed, reviews closed.' },
]
const PREF_STORE = 'aiia.notificationPrefs'
const DEFAULT_PREFS: Record<PrefKey, boolean> = { critical: true, warning: true, info: true, completed: false }

function loadPrefs(): Record<PrefKey, boolean> {
  try {
    const raw = localStorage.getItem(PREF_STORE)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Record<PrefKey, boolean>>) } : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}

function ProfileTab() {
  const { user } = useAuth()
  const toast = useToast()
  const [saved, setSaved] = useState(loadPrefs)
  const [prefs, setPrefs] = useState(saved)
  const [saving, setSaving] = useState(false)
  const dirty = PREFS.some((p) => prefs[p.key] !== saved[p.key])

  const save = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 350))
    try { localStorage.setItem(PREF_STORE, JSON.stringify(prefs)) } catch { /* storage unavailable */ }
    const on = PREFS.filter((p) => prefs[p.key]).map((p) => p.label).join(', ') || 'None'
    const before = PREFS.filter((p) => saved[p.key]).map((p) => p.label).join(', ') || 'None'
    recordAudit('Updated notification preferences', 'User', user?.email ?? '', before, on)
    setSaved(prefs)
    setSaving(false)
    toast('success', 'Preferences saved')
  }

  if (!user) return null
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Profile" subtitle="Managed by your institution's identity administrator">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden>{user.initials}</span>
          <div>
            <div className="font-medium text-ink">{user.name}</div>
            <div className="text-[13px] text-muted">{ROLES[user.role].label}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="pf-name"><Input id="pf-name" value={user.name} readOnly disabled /></Field>
          <Field label="Email" htmlFor="pf-email"><Input id="pf-email" value={user.email} readOnly disabled /></Field>
          <Field label="Department" htmlFor="pf-dept"><Input id="pf-dept" value={user.department} readOnly disabled /></Field>
          <Field label="Role" htmlFor="pf-role"><Input id="pf-role" value={ROLES[user.role].label} readOnly disabled /></Field>
        </div>
        <p className="mt-3 text-xs text-faint">To change these details, contact the research office administrator.</p>
      </Panel>

      <Panel title="Notification preferences" subtitle="Choose which alerts appear in your notification centre">
        <div className="divide-y divide-line">
          {PREFS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-start gap-3 py-2.5 first:pt-0">
              <input type="checkbox" className="mt-1 size-4 accent-ink" checked={prefs[p.key]}
                onChange={(e) => setPrefs((s) => ({ ...s, [p.key]: e.target.checked }))} />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">{p.label}</span>
                <span className="block text-[13px] text-muted">{p.desc}</span>
              </span>
            </label>
          ))}
        </div>
        {!prefs.critical && (
          <p className="mt-2 rounded-[var(--radius-ctl)] bg-warn-soft px-3 py-2 text-[13px] text-warn">
            Turning off critical alerts may delay your response to safety events.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => setPrefs(saved)}>Reset</Button>
          <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>Save preferences</Button>
        </div>
      </Panel>
    </div>
  )
}

// ---------------- Roles ----------------
const MATRIX: { label: string; perms: Permission[] }[] = [
  { label: 'View studies', perms: ['studies:view'] },
  { label: 'Create and edit studies', perms: ['studies:edit', 'studies:create'] },
  { label: 'Manage participants', perms: ['participants:edit'] },
  { label: 'Record visits', perms: ['visits:edit'] },
  { label: 'Edit eCRFs', perms: ['ecrf:edit'] },
  { label: 'Ethics review', perms: ['ethics:review'] },
  { label: 'Report adverse events', perms: ['safety:report'] },
  { label: 'Safety review', perms: ['safety:review'] },
  { label: 'Upload documents', perms: ['documents:upload'] },
  { label: 'Analytics', perms: ['analytics:view'] },
  { label: 'Data standards', perms: ['standards:view'] },
  { label: 'Audit trail', perms: ['audit:view'] },
]
const ROLE_IDS = Object.keys(ROLES) as RoleId[]

function RolesTab() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Access matrix" subtitle="Permissions granted to each role. Study-level assignment further limits what each person can see." bodyClass="p-0">
        <Table minWidth={860}>
          <THead>
            <tr>
              <Th>Permission</Th>
              {ROLE_IDS.map((r) => (
                <Th key={r} className={cx('text-center', user?.role === r && 'text-ink')}>
                  {ROLES[r].label}{user?.role === r && <span className="ml-1 text-xs font-normal text-info">(you)</span>}
                </Th>
              ))}
            </tr>
          </THead>
          <tbody>
            {MATRIX.map((row) => (
              <Tr key={row.label}>
                <Td className="font-medium text-ink">{row.label}</Td>
                {ROLE_IDS.map((r) => {
                  const ok = row.perms.some((p) => ROLES[r].permissions.includes(p))
                  return (
                    <Td key={r} className={cx('text-center', user?.role === r && 'bg-info-soft/40')}>
                      {ok
                        ? <Check className="mx-auto size-4 text-ok" aria-label="Granted" />
                        : <Minus className="mx-auto size-4 text-line-2" aria-label="Not granted" />}
                    </Td>
                  )
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ROLE_IDS.map((r) => (
          <div key={r} className={cx('rounded-[var(--radius-panel)] border bg-white px-4 py-3', user?.role === r ? 'border-ink' : 'border-line')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{ROLES[r].label}</span>
              {user?.role === r && <Badge tone="info">Current role</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-muted">{ROLES[r].summary}</p>
            <p className="mt-2 text-xs text-faint">{ROLES[r].permissions.length} permissions</p>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted">In demo mode, the active role can be switched from the user menu in the top bar to preview each view.</p>
    </div>
  )
}

// ---------------- Security ----------------
function SecurityTab() {
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [saving, setSaving] = useState(false)
  const [signedOut, setSignedOut] = useState<string[]>([])

  const sessions = [
    { id: 'this', device: 'This device', detail: `${browserName()} on ${osName()}`, ip: '10.12.4.21', when: 'Active now', icon: Laptop, current: true },
    { id: 'm1', device: 'Mobile browser', detail: 'Safari on iOS', ip: '10.12.9.88', when: 'Last active 2 days ago', icon: Smartphone, current: false },
  ].filter((s) => !signedOut.includes(s.id))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!form.current) errs.current = 'Enter your current password.'
    if (form.next.length < 12) errs.next = 'Use at least 12 characters.'
    else if (!/\d/.test(form.next)) errs.next = 'Include at least one number.'
    else if (form.next === form.current) errs.next = 'Choose a password different from your current one.'
    if (!form.confirm) errs.confirm = 'Confirm the new password.'
    else if (form.confirm !== form.next) errs.confirm = 'Passwords do not match.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    recordAudit('Changed password', 'User', user?.email ?? '')
    setSaving(false)
    setForm({ current: '', next: '', confirm: '' })
    toast('success', 'Password updated')
  }

  const upd = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const strength = [form.next.length >= 12, /\d/.test(form.next), /[A-Z]/.test(form.next) && /[a-z]/.test(form.next), /[^A-Za-z0-9]/.test(form.next)]

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Panel title="Session timeout">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <div>
              <div className="font-medium text-ink">15 minutes of inactivity</div>
              <p className="mt-1 text-[13px] text-muted">
                You are signed out automatically after 15 minutes without mouse, keyboard or touch activity. A warning appears one
                minute before, with the option to stay signed in. Unsaved form entries may be lost when the session ends.
              </p>
              <p className="mt-2 text-xs text-faint">Set by the institution administrator.</p>
            </div>
          </div>
        </Panel>
        <Panel title="Active sessions" subtitle="Devices currently signed in to your account" bodyClass="p-0">
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <s.icon className="size-5 shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                    {s.device}{s.current && <Badge tone="ok" dot>Current</Badge>}
                  </div>
                  <div className="text-[13px] text-muted">{s.detail}, IP {s.ip}</div>
                  <div className="text-xs text-faint">{s.when}</div>
                </div>
                {!s.current && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    setSignedOut((x) => [...x, s.id])
                    recordAudit('Signed out remote session', 'Session', user?.email ?? '', s.detail)
                    toast('success', 'Session signed out')
                  }}>Sign out</Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Change password" subtitle="Use a long passphrase you do not use elsewhere">
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <Field label="Current password" htmlFor="pw-cur" error={errors.current} required>
            <Input id="pw-cur" type="password" autoComplete="current-password" value={form.current} onChange={upd('current')} invalid={!!errors.current} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={errors.next} hint="At least 12 characters, including a number." required>
            <Input id="pw-new" type="password" autoComplete="new-password" value={form.next} onChange={upd('next')} invalid={!!errors.next} />
          </Field>
          {form.next && (
            <div className="flex items-center gap-2" aria-hidden>
              {strength.map((ok, i) => <span key={i} className={cx('h-1 flex-1 rounded-full', ok ? 'bg-ok' : 'bg-line')} />)}
              <span className="w-16 text-right text-xs text-muted">{strength.filter(Boolean).length >= 3 ? 'Strong' : strength.filter(Boolean).length === 2 ? 'Fair' : 'Weak'}</span>
            </div>
          )}
          <Field label="Confirm new password" htmlFor="pw-conf" error={errors.confirm} required>
            <Input id="pw-conf" type="password" autoComplete="new-password" value={form.confirm} onChange={upd('confirm')} invalid={!!errors.confirm} />
          </Field>
          <div className="mt-1 flex justify-end">
            <Button type="submit" variant="primary" icon={KeyRound} loading={saving}>Update password</Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

function browserName() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Browser'
}
function osName() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'unknown OS'
}

// ---------------- Regulatory ----------------
const FRAMEWORKS: { name: string; key: RequirementKey; desc: string }[] = [
  { name: 'IEC approval', key: 'ethics', desc: 'Institutional Ethics Committee approval before initiation, and for each amendment.' },
  { name: 'CTRI registration', key: 'ctri', desc: 'Prospective registration with the Clinical Trials Registry of India and annual updates.' },
  { name: 'New Drugs and Clinical Trials Rules, 2019', key: 'ndct', desc: 'Obligations under the NDCT Rules where the regulatory team marks them applicable to a study.' },
  { name: 'Ayush pharmacovigilance reporting', key: 'safetyReporting', desc: 'Adverse event reporting to the Ayush pharmacovigilance programme within configured timelines.' },
  { name: 'Institutional SOPs', key: 'regulatoryDocs', desc: 'AIIA standard operating procedures for trial conduct, documentation and data handling.' },
]

function RegulatoryTab() {
  const { data, loading } = useAsync(() => studyService.allCompliance())
  const counts = useMemo(() => {
    const out: Partial<Record<RequirementKey, number>> = {}
    for (const c of data ?? []) for (const i of c.items) if (i.applicable) out[i.key] = (out[i.key] ?? 0) + 1
    return out
  }, [data])
  const total = data?.length ?? 0

  return (
    <Panel title="Regulatory frameworks" subtitle="Frameworks the institution tracks. Whether each applies is configured per study by the regulatory team, never assumed." bodyClass="p-0">
      <ul className="divide-y divide-line">
        {FRAMEWORKS.map((f) => (
          <li key={f.key} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{f.name}</div>
              <p className="text-[13px] text-muted">{f.desc}</p>
              <p className="mt-1 text-xs text-faint">Applies to: configured per study</p>
            </div>
            <div className="text-right">
              {loading ? <Skeleton className="h-5 w-24" /> : (
                <>
                  <div className="tnum text-[15px] font-semibold text-ink">{counts[f.key] ?? 0} <span className="text-[13px] font-normal text-muted">of {total}</span></div>
                  <div className="text-xs text-muted">studies marked applicable</div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-canvas/60 px-4 py-2.5 text-xs text-muted">
        Applicability can be changed from each study's regulatory checklist on the Ethics & regulatory page.
      </div>
    </Panel>
  )
}

// ---------------- Integrations ----------------
const INTEGRATIONS = [
  { id: 'fhir', name: 'FHIR endpoint', desc: 'Exchange Patient, Observation, Encounter and related resources with hospital information systems.', icon: Link2 },
  { id: 'cdisc', name: 'CDISC export', desc: 'Generate SDTM-structured datasets from locked study data for analysis and submission.', icon: Plug },
  { id: 'sso', name: 'Institutional sign-in', desc: 'Single sign-on with the institution directory for staff accounts.', icon: UserRound },
]

function IntegrationsTab() {
  const [open, setOpen] = useState<(typeof INTEGRATIONS)[number] | null>(null)
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <div key={i.id} className="flex flex-col rounded-[var(--radius-panel)] border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-[var(--radius-ctl)] bg-canvas text-ink-3"><i.icon className="size-4" aria-hidden /></span>
              <Badge tone="neutral">Not connected</Badge>
            </div>
            <div className="mt-3 font-medium text-ink">{i.name}</div>
            <p className="mt-1 flex-1 text-[13px] text-muted">{i.desc}</p>
            <div className="mt-4"><Button size="sm" onClick={() => setOpen(i)}>Configure</Button></div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted">Mappings for these integrations are described on the Data standards page and are conceptual until implemented.</p>
      <DemoDataPanel />
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Configure ${open.name}` : ''}
        description="Requires backend setup"
        footer={<Button variant="primary" onClick={() => setOpen(null)}>Close</Button>}
      >
        <div className="space-y-3 text-sm text-ink">
          <p>This integration cannot be enabled from the browser. It requires server-side configuration by the institution's IT and data management teams, including:</p>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-muted">
            <li>A secured service endpoint and credentials stored on the server, not in the browser</li>
            <li>Agreed data mappings and terminology, validated against the study protocol</li>
            <li>Approval of the data flow by the data management lead and, where required, the ethics committee</li>
            <li>Test exchanges in a non-production environment before go-live</li>
          </ul>
          <p className="text-[13px] text-muted">Contact the research office to start this request.</p>
        </div>
      </Modal>
    </>
  )
}

function DemoDataPanel() {
  const [confirm, setConfirm] = useState(false)
  const saved = hasSavedChanges()
  return (
    <Panel
      className="mt-6"
      title="Demo data"
      subtitle="Changes you make in this demo (new studies, adverse events, uploads, eCRF entries, visit updates and decisions) are kept in this browser until the end of the day."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-[13.5px] text-ink">
          <Database className="size-4 text-muted" aria-hidden />
          {saved ? 'This browser has saved demo changes.' : 'No demo changes saved. You are viewing the original sample data.'}
        </div>
        <Button variant="danger" disabled={!saved} onClick={() => setConfirm(true)}>Reset demo data</Button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title="Reset demo data?"
        description="This can't be undone."
        footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={resetDemoData}>Reset demo data</Button></>}
      >
        <p className="text-sm text-muted">All changes saved in this browser are discarded and the original sample data is reloaded. Your sign-in is kept.</p>
      </Modal>
    </Panel>
  )
}
