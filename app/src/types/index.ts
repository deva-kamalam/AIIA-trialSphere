// Domain models for the AIIA CTMS. These mirror what a backend API would return.

export type RoleId = 'pi' | 'coordinator' | 'ethics' | 'pv' | 'data_manager' | 'management'

export interface User {
  id: string
  name: string
  email: string
  role: RoleId
  department: string
  initials: string
}

export type HealthLevel = 'ok' | 'warn' | 'crit'
export type TrialStatus = 'On Track' | 'Attention Required' | 'Critical' | 'Completed'

export const PORTFOLIO_STAGES = ['Planning', 'Ethics Review', 'Recruiting', 'Active / Follow-up', 'Completed'] as const
export type PortfolioStage = (typeof PORTFOLIO_STAGES)[number]

export const LIFECYCLE = [
  'Protocol', 'Ethics', 'CTRI', 'Site Activation', 'Recruitment', 'Follow-up', 'Database Lock', 'Completed',
] as const
export type LifecycleStage = (typeof LIFECYCLE)[number]

export type StudyType = 'Interventional' | 'Observational' | 'Pilot / Feasibility' | 'Supportive Care'
export type StudyPhase = 'Pilot' | 'Phase II' | 'Phase III' | 'Phase IV' | 'N/A'

export interface HealthSignals {
  recruitment: HealthLevel
  dataCompletion: HealthLevel
  deviations: HealthLevel
  safetyReporting: HealthLevel
  regulatory: HealthLevel
  documents: HealthLevel
}

export interface Study {
  id: string
  title: string
  shortTitle: string
  type: StudyType
  phase: StudyPhase
  department: string
  pi: string
  coordinator: string
  intervention: string
  comparator: string
  primaryObjective: string
  siteIds: string[]
  enrolled: number
  target: number
  startDate: string
  expectedCompletion: string
  stage: PortfolioStage
  lifecycle: LifecycleStage
  status: TrialStatus
  dataQuality: number // % complete & clean
  compliance: number // % of applicable requirements satisfied
  completedVisits: number
  deviations: number
  openQueries: number
  adverseEvents: number
  health: HealthSignals
  ctriNumber?: string
}

export interface Site {
  id: string
  name: string
  city: string
  state: string
  investigator: string
  status: 'Active' | 'Activation Pending' | 'Closed'
  activatedOn?: string
  participants: number
  visitCompletion: number
  dataQuality: number
  deviations: number
}

export type ParticipantStatus = 'Screening' | 'Enrolled' | 'Active' | 'Completed' | 'Withdrawn' | 'Screen Failure'

export const VISIT_SCHEDULE = ['Screening', 'Baseline', 'Day 7', 'Day 30', 'Day 60', 'Day 90', 'Final Visit'] as const
export type VisitName = (typeof VISIT_SCHEDULE)[number]

export interface Participant {
  id: string // anonymised, e.g. AIIA-AYU001-0001
  studyId: string
  siteId: string
  screeningDate: string
  enrollmentDate?: string
  age: number
  sex: 'F' | 'M'
  currentVisit: VisitName
  status: ParticipantStatus
  lastVisit?: string
  nextVisit?: string
  prakriti: string
}

export type VisitStatus = 'Completed' | 'Upcoming' | 'Missed' | 'Overdue'

export interface Visit {
  id: string
  participantId: string
  studyId: string
  siteId: string
  visit: VisitName
  scheduledDate: string
  actualDate?: string
  status: VisitStatus
  coordinator: string
  windowDays: number
}

export type Severity = 'Mild' | 'Moderate' | 'Severe'
export type Causality = 'Unrelated' | 'Unlikely' | 'Possible' | 'Probable' | 'Certain'
export type AEReviewStatus =
  | 'New' | 'Medical Review' | 'Seriousness Assessment' | 'Causality Assessment' | 'Reporting' | 'Resolved'

export const AE_WORKFLOW: AEReviewStatus[] = [
  'New', 'Medical Review', 'Seriousness Assessment', 'Causality Assessment', 'Reporting', 'Resolved',
]

export interface AdverseEvent {
  id: string
  participantId: string
  studyId: string
  event: string
  severity: Severity
  serious: boolean
  causality: Causality
  expected: boolean
  onsetDate: string
  reportedDate: string
  reviewStatus: AEReviewStatus
  dueDate: string
  actionTaken: string
  outcome: 'Recovering' | 'Recovered' | 'Ongoing' | 'Not recovered'
  reporter: string
  seriousnessCriteria?: string[]
  narrative?: string
}

export type ApprovalStatus = 'Approved' | 'Under Review' | 'Draft' | 'Expired' | 'Superseded'

export const DOC_CATEGORIES = [
  'Protocol', 'Ethics Approval', 'CTRI', 'Consent Forms', 'Investigator Documents',
  'Regulatory Documents', 'Monitoring Reports', 'Safety Reports', 'Study Reports',
] as const
export type DocCategory = (typeof DOC_CATEGORIES)[number]

export interface DocVersion {
  version: string
  uploadedBy: string
  uploadedOn: string
  status: ApprovalStatus
  note: string
}

export interface StudyDocument {
  id: string
  name: string
  studyId: string
  category: DocCategory
  version: string
  uploadedBy: string
  uploadedOn: string
  status: ApprovalStatus
  expiryDate?: string
  sizeKb: number
  history: DocVersion[]
}

export type RequirementKey =
  | 'ethics' | 'ctri' | 'protocol' | 'consent' | 'regulatoryDocs' | 'insurance'
  | 'amendments' | 'safetyReporting' | 'periodicReports' | 'ndct'

export interface ComplianceItem {
  key: RequirementKey
  label: string
  applicable: boolean
  state: HealthLevel | 'na'
  detail: string
  dueDate?: string
}

export type IecDecision = 'Approved' | 'Approved with modifications' | 'Queries raised'

export interface IecDecisionRecord {
  decision: IecDecision
  date: string
  remarks: string
  by: string
}

export interface ComplianceMilestone {
  label: string
  date?: string
  state: 'done' | 'pending' | 'overdue' | 'upcoming'
  note?: string
  decision?: IecDecisionRecord
}

export interface StudyCompliance {
  studyId: string
  items: ComplianceItem[]
  timeline: ComplianceMilestone[]
}

export interface AuditEvent {
  id: string
  timestamp: string
  user: string
  role: string
  action: string
  objectType: string
  objectId: string
  previous?: string
  next?: string
  ip: string
}

export type NotificationLevel = 'critical' | 'warning' | 'info' | 'success'

export interface AppNotification {
  id: string
  level: NotificationLevel
  title: string
  detail: string
  time: string
  read: boolean
  link?: string
}

export interface SearchResult {
  kind: 'Study' | 'Participant' | 'Site' | 'Document' | 'Investigator' | 'Safety Event' | 'Visit'
  id: string
  title: string
  subtitle: string
  link: string
}
