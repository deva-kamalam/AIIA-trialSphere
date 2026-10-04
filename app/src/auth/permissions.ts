import type { RoleId } from '@/types'

export type Permission =
  | 'studies:view' | 'studies:edit' | 'studies:create'
  | 'participants:view' | 'participants:edit'
  | 'visits:view' | 'visits:edit'
  | 'ecrf:view' | 'ecrf:edit'
  | 'sites:view'
  | 'ethics:view' | 'ethics:review' | 'ethics:configure'
  | 'safety:view' | 'safety:report' | 'safety:review'
  | 'documents:view' | 'documents:upload'
  | 'analytics:view'
  | 'standards:view'
  | 'audit:view'
  | 'settings:view'

export interface RoleDef {
  id: RoleId
  label: string
  summary: string
  permissions: Permission[]
}

const ALL_VIEW: Permission[] = [
  'studies:view', 'participants:view', 'visits:view', 'ecrf:view', 'sites:view', 'ethics:view',
  'safety:view', 'documents:view', 'analytics:view', 'standards:view', 'settings:view',
]

export const ROLES: Record<RoleId, RoleDef> = {
  pi: {
    id: 'pi', label: 'Principal Investigator', summary: 'Can view and edit assigned studies.',
    permissions: [...ALL_VIEW, 'studies:edit', 'studies:create', 'participants:edit', 'visits:edit', 'ecrf:edit', 'safety:report', 'documents:upload', 'audit:view'],
  },
  coordinator: {
    id: 'coordinator', label: 'Study Coordinator', summary: 'Can manage assigned participants and visits.',
    permissions: ['studies:view', 'participants:view', 'participants:edit', 'visits:view', 'visits:edit', 'ecrf:view', 'ecrf:edit', 'sites:view', 'safety:view', 'safety:report', 'documents:view', 'documents:upload', 'settings:view'],
  },
  ethics: {
    id: 'ethics', label: 'Ethics Committee', summary: 'Can review ethics-related records.',
    permissions: ['studies:view', 'ethics:view', 'ethics:review', 'safety:view', 'documents:view', 'audit:view', 'settings:view'],
  },
  pv: {
    id: 'pv', label: 'Pharmacovigilance', summary: 'Can access safety records.',
    permissions: ['studies:view', 'safety:view', 'safety:report', 'safety:review', 'documents:view', 'analytics:view', 'standards:view', 'settings:view'],
  },
  data_manager: {
    id: 'data_manager', label: 'Data Manager', summary: 'Can review eCRFs, queries and data quality.',
    permissions: ['studies:view', 'participants:view', 'visits:view', 'ecrf:view', 'ecrf:edit', 'sites:view', 'analytics:view', 'standards:view', 'audit:view', 'documents:view', 'settings:view'],
  },
  management: {
    id: 'management', label: 'Management', summary: 'Can view aggregated dashboards.',
    permissions: ['studies:view', 'sites:view', 'ethics:view', 'safety:view', 'analytics:view', 'standards:view', 'documents:view', 'audit:view', 'settings:view'],
  },
}

export const can = (role: RoleId, p: Permission) => ROLES[role].permissions.includes(p)

/** Participant-level detail (age, sex, profile) is hidden from aggregate-only roles. */
export const canSeeParticipantDetail = (role: RoleId) => can(role, 'participants:view')
