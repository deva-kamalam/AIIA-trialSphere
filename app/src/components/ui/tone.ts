export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral' | 'ink'

const STATUS_TONE: Record<string, Tone> = {
  'On Track': 'ok', Completed: 'ok', Approved: 'ok', Active: 'ok', Enrolled: 'info', Resolved: 'ok', Recovered: 'ok',
  'Attention Required': 'warn', 'Under Review': 'warn', Upcoming: 'info', Screening: 'info', Draft: 'neutral',
  'Activation Pending': 'warn', Recovering: 'info',
  Critical: 'crit', Overdue: 'crit', Missed: 'crit', Expired: 'crit', Withdrawn: 'neutral', 'Screen Failure': 'neutral',
  Superseded: 'neutral', Closed: 'neutral', New: 'crit', 'Medical Review': 'warn', 'Seriousness Assessment': 'warn',
  'Causality Assessment': 'warn', Reporting: 'info', Ongoing: 'warn', 'Not recovered': 'crit',
  Planning: 'neutral', 'Ethics Review': 'warn', Recruiting: 'info', 'Active / Follow-up': 'ok',
}
export const toneFor = (status: string): Tone => STATUS_TONE[status] ?? 'neutral'
