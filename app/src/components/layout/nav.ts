import {
  LayoutDashboard, FlaskConical, Users, Building2, CalendarClock, ClipboardList, ShieldCheck,
  HeartPulse, FolderLock, BarChart3, Network, History, Settings, type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/auth/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  perm?: Permission
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/studies', label: 'Studies', icon: FlaskConical, perm: 'studies:view' },
  { to: '/participants', label: 'Participants', icon: Users, perm: 'participants:view' },
  { to: '/sites', label: 'Sites', icon: Building2, perm: 'sites:view' },
  { to: '/visits', label: 'Visits', icon: CalendarClock, perm: 'visits:view' },
  { to: '/ecrf', label: 'eCRF', icon: ClipboardList, perm: 'ecrf:view' },
  { to: '/ethics', label: 'Ethics & Regulatory', icon: ShieldCheck, perm: 'ethics:view' },
  { to: '/safety', label: 'Safety & Pharmacovigilance', icon: HeartPulse, perm: 'safety:view' },
  { to: '/documents', label: 'Documents', icon: FolderLock, perm: 'documents:view' },
  { to: '/analytics', label: 'Reports & Analytics', icon: BarChart3, perm: 'analytics:view' },
  { to: '/standards', label: 'Data Standards', icon: Network, perm: 'standards:view' },
  { to: '/audit', label: 'Audit Trail', icon: History, perm: 'audit:view' },
  { to: '/settings', label: 'Settings', icon: Settings, perm: 'settings:view' },
]
