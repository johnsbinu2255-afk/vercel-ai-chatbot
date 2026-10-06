import { DAY, fd, startOfDay } from '@/lib/shop/format'

export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const PERIODS: [PeriodType, string][] = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['quarter', 'Quarter'],
  ['year', 'Year']
]

export const PREVIOUS: Record<PeriodType, string> = {
  day: 'yesterday',
  week: 'last week',
  month: 'last month',
  quarter: 'last quarter',
  year: 'last year'
}

/** Moves to the start of the local day nearest to t (safe across clock changes). */
function day(t: number) {
  return startOfDay(t + DAY / 2)
}

/**
 * [start, end) of a period. `off` 0 is the current one, -1 the one before.
 * Quarters and years follow the Indian financial year (April to March).
 */
export function periodRange(type: PeriodType, off: number, now = Date.now()): [number, number] {
  const n = new Date(now)
  const y = n.getFullYear()
  const m = n.getMonth()
  const today = startOfDay(now)
  if (type === 'day') {
    const s = startOfDay(today + off * DAY + (off ? DAY / 2 : 0))
    return [s, day(s + DAY)]
  }
  if (type === 'week') {
    const dow = (new Date(today).getDay() + 6) % 7
    const s = day(today - dow * DAY + off * 7 * DAY)
    return [s, day(s + 7 * DAY)]
  }
  if (type === 'month') {
    return [new Date(y, m + off, 1).getTime(), new Date(y, m + off + 1, 1).getTime()]
  }
  if (type === 'quarter') {
    const qs = m - (((m + 9) % 12) % 3) + off * 3
    return [new Date(y, qs, 1).getTime(), new Date(y, qs + 3, 1).getTime()]
  }
  const fy = m >= 3 ? y : y - 1
  return [new Date(fy + off, 3, 1).getTime(), new Date(fy + off + 1, 3, 1).getTime()]
}

function fyLabel(start: Date) {
  const s = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1
  return `FY ${s}-${String(s + 1).slice(2)}`
}

export function periodLabel(type: PeriodType, r: [number, number], off: number) {
  const a = new Date(r[0])
  const z = new Date(r[1] - 1)
  const short = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short' })
  if (type === 'day') {
    if (off === 0) return 'Today'
    if (off === -1) return 'Yesterday'
    return a.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
  if (type === 'week') {
    return (
      a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' – ' +
      z.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    )
  }
  if (type === 'month') {
    return a.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }
  if (type === 'quarter') {
    const q = Math.floor(((a.getMonth() + 9) % 12) / 3) + 1
    return `Q${q} ${fyLabel(a)} · ${short(a)} – ${short(z)}`
  }
  return `${fyLabel(a)} · Apr – Mar`
}

export interface Bucket {
  start: number
  label: string
  full: string
}

/** The bars of the sales chart for a period. */
export function buckets(type: PeriodType, r: [number, number]): Bucket[] {
  const out: Bucket[] = []
  if (type === 'day') {
    for (let h = 0; h < 24; h++) {
      const ampm = (x: number) => `${x % 12 || 12} ${x < 12 || x === 24 ? 'am' : 'pm'}`
      out.push({
        start: r[0] + h * 3600e3,
        label: h % 3 === 0 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : '',
        full: `${ampm(h)} – ${ampm(h + 1)}`
      })
    }
  } else if (type === 'week' || type === 'month') {
    for (let a = r[0]; a < r[1]; a = day(a + DAY)) {
      const d = new Date(a)
      out.push({
        start: a,
        label:
          type === 'week'
            ? d.toLocaleDateString('en-IN', { weekday: 'short' })
            : d.getDate() === 1 || d.getDate() % 5 === 0
            ? String(d.getDate())
            : '',
        full: fd(a)
      })
    }
  } else if (type === 'quarter') {
    for (let a = r[0]; a < r[1]; a += 7 * DAY) {
      out.push({
        start: a,
        label:
          out.length % 3 === 0
            ? new Date(a).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '',
        full: 'Week of ' + fd(a)
      })
    }
  } else {
    const s = new Date(r[0])
    for (let i = 0; i < 12; i++) {
      const a = new Date(s.getFullYear(), s.getMonth() + i, 1)
      out.push({
        start: a.getTime(),
        label: a.toLocaleDateString('en-IN', { month: 'short' }).slice(0, 3),
        full: a.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      })
    }
  }
  return out
}
