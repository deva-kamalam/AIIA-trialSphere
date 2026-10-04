// Shared chart colours and axis styling so every Recharts chart reads as one system.
export const C = {
  ink: '#0f2747',
  ink3: '#3a5580',
  sky: '#2f6fb2',
  teal: '#0e8a7e',
  amber: '#c98a1c',
  red: '#b42318',
  grid: '#e3e8ef',
  axis: '#8795a8',
  muted: '#cfd7e2',
}

/** Ordered categorical palette (validated for distinctness on white). */
export const SERIES = ['#0f2747', '#2f6fb2', '#0e8a7e', '#c98a1c', '#8a5cb8', '#b42318', '#5fa8d3', '#6b7a8f']

export const axisProps = {
  tick: { fill: C.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: C.grid },
} as const

export const gridProps = { stroke: C.grid, strokeDasharray: '0', vertical: false } as const
