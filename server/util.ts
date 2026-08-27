import { toHiragana, toKana } from 'wanakana'

const SEOUL = 'Asia/Seoul'

export function todaySeoul(timeZone = SEOUL): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

export function addDays(isoDate: string, days: number, timeZone = SEOUL): string {
  const utc = new Date(`${isoDate}T12:00:00+09:00`)
  utc.setUTCDate(utc.getUTCDate() + days)
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(utc)
}

export function escapeLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function searchVariants(raw: string): string[] {
  const q = raw.trim()
  if (!q) return []
  const set = new Set<string>([q, toHiragana(q)])
  if (/^[a-zA-Z']+$/.test(q)) {
    set.add(toKana(q.toLowerCase()))
    set.add(toHiragana(toKana(q.toLowerCase())))
  }
  return [...set].filter(Boolean)
}
