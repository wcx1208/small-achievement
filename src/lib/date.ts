/** 日期工具：全部基于本地时区，date 字符串统一为 YYYY-MM-DD */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDateKey(ds: unknown): ds is string {
  if (typeof ds !== 'string') return false
  const match = DATE_RE.exec(ds)
  if (!match) return false
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const parsed = new Date(y, m - 1, d)
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d
}

function parseDateKey(ds: string): Date | null {
  if (!isValidDateKey(ds)) return null
  const [y, m, d] = ds.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dateStr(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return dateStr(new Date())
}

/** 将本地日期字符串转成当天指定时刻的毫秒时间戳，避免 UTC 解析偏移 */
export function dateAt(ds: string, hour = 0, minute = 0): number | null {
  const d = parseDateKey(ds)
  if (!d) return null
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

export function addDays(ds: string, n: number): string {
  const d = parseDateKey(ds)
  if (!d || !Number.isFinite(n)) return ds
  d.setDate(d.getDate() + n)
  return dateStr(d)
}

/** 最近 n 天（含今天），按时间正序返回 */
export function lastNDays(n: number, today = todayStr()): string[] {
  const safeN = Math.max(0, Math.floor(n))
  return Array.from({ length: safeN }, (_, i) => addDays(today, -(safeN - 1 - i)))
}

/** 本周从周一到今天的日期列表（坚持率用） */
export function weekToDateDays(today = todayStr()): string[] {
  const base = parseDateKey(today)
  if (!base) return []
  const offset = (base.getDay() + 6) % 7
  return Array.from({ length: offset + 1 }, (_, i) => addDays(today, -offset + i))
}

/** 本月 1 号到今天的日期列表（坚持率用） */
export function monthToDateDays(today = todayStr()): string[] {
  const base = parseDateKey(today)
  if (!base) return []
  const y = base.getFullYear()
  const m = base.getMonth() + 1
  const d = base.getDate()
  return Array.from({ length: d }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayCN(ds: string): string {
  const d = parseDateKey(ds)
  return d ? WEEK[d.getDay()] : ''
}

export function formatDateCN(ds: string): string {
  const d = parseDateKey(ds)
  return d ? `${d.getMonth() + 1}月${d.getDate()}日` : '日期未知'
}

export function formatTime(ts: number): string {
  if (!Number.isFinite(ts)) return '--:--'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return '早上好'
  if (h >= 11 && h < 13) return '中午好'
  if (h >= 13 && h < 18) return '下午好'
  return '晚上好'
}
