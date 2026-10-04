import { useCallback, useEffect, useMemo, useState } from 'react'

/** Load data from a service call. `reload` re-runs it after a mutation. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((d) => { if (alive) { setData(d); setError(null) } })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : 'Request failed') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload, setData }
}

export type SortDir = 'asc' | 'desc'

/** Client-side sorting for tables. */
export function useSort<T>(rows: T[], initial: { key: keyof T; dir: SortDir }) {
  const [sort, setSort] = useState(initial)
  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sort.key] as unknown
      const bv = b[sort.key] as unknown
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sort])
  const toggle = (key: keyof T) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  return { sorted, sort, toggle }
}

export function usePaged<T>(rows: T[], pageSize = 25) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safe = Math.min(page, pages - 1)
  // Back to the first page whenever the row count changes (e.g. a filter is applied).
  const [count, setCount] = useState(rows.length)
  if (count !== rows.length) {
    setCount(rows.length)
    setPage(0)
  }
  return {
    page: safe, pages, setPage,
    slice: rows.slice(safe * pageSize, safe * pageSize + pageSize),
    from: rows.length ? safe * pageSize + 1 : 0,
    to: Math.min(rows.length, safe * pageSize + pageSize),
    total: rows.length,
  }
}
