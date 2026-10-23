// How dates and counts read on screen. The API sends ISO dates in UTC and raw
// numbers; the design shows dates as 2026.10.12 and times as 2026.10.12 06:00.

const pad = (n: number) => String(n).padStart(2, '0')

/** 2026-10-12T06:00:00Z -> "2026.10.12". Dates are shown in UTC so server and browser agree. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())}`
}

/** "2026.10.12 06:00" in UTC. */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatDate(iso)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** 148 -> "148", 1214 -> "1,214". Written out so the server and the browser never disagree. */
export function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
