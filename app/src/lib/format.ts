import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { TODAY } from '@/data/seed'

export const fmtDate = (d?: string) => (d ? format(parseISO(d), 'd MMM yyyy') : '—')
export const fmtShort = (d?: string) => (d ? format(parseISO(d), 'd MMM') : '—')
export const fmtTime = (d: string) => format(parseISO(d), 'HH:mm')
export const fmtNum = (n: number) => n.toLocaleString('en-IN')
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
export const daysFromToday = (d: string) => differenceInCalendarDays(parseISO(d), TODAY)
export const ago = (d: string) => formatDistanceToNowStrict(parseISO(d), { addSuffix: true })

/** "in 12 days", "today", "6 days overdue" */
export function relDue(d?: string) {
  if (!d) return '—'
  const n = daysFromToday(d)
  if (n === 0) return 'Today'
  if (n > 0) return `in ${n} day${n === 1 ? '' : 's'}`
  return `${-n} day${n === -1 ? '' : 's'} overdue`
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}
