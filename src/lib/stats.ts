import type { CheckIn, MoodLog, Task } from '../data/types'
import { addDays, isValidDateKey, todayStr } from './date'

/** 纯统计函数：连胜、今日状态、热力图/趋势数据 */

/** 连胜天数：从今天（未打卡则从昨天）往回数连续有打卡的天数 */
export function getStreak(checkIns: CheckIn[], today = todayStr()): number {
  const days = new Set(checkIns.map((c) => c.date).filter(isValidDateKey))
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export interface TodayStatus {
  pending: Task[]
  doneToday: { task: Task; checkIn: CheckIn }[]
  total: number
  completed: number
}

/** 今日页分组：待完成 / 已完成（单次任务完成后不再进入待办） */
export function getTodayStatus(tasks: Task[], checkIns: CheckIn[], today = todayStr()): TodayStatus {
  const active = tasks.filter((t) => !t.archived)
  const todays = checkIns.filter((c) => c.date === today)
  const pending: Task[] = []
  const doneToday: { task: Task; checkIn: CheckIn }[] = []

  for (const task of active) {
    const ci = todays.find((c) => c.taskId === task.id)
    if (ci) {
      doneToday.push({ task, checkIn: ci })
      continue
    }
    if (task.repeat === 'daily') {
      pending.push(task)
    } else {
      // 单次任务：历史上完成过就不再出现在今日待办
      const everDone = checkIns.some((c) => c.taskId === task.id)
      if (!everDone) pending.push(task)
    }
  }

  return { pending, doneToday, total: pending.length + doneToday.length, completed: doneToday.length }
}

/** 每日打卡次数（热力图数据源） */
export function countsByDay(checkIns: CheckIn[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const c of checkIns) {
    if (isValidDateKey(c.date)) map[c.date] = (map[c.date] ?? 0) + 1
  }
  return map
}

/** 每日平均心情分（趋势折线数据源，1~5，无记录的日期为 null） */
export function scoreByDay(moodLogs: MoodLog[], days: string[]): (number | null)[] {
  const map: Record<string, { sum: number; n: number }> = {}
  for (const m of moodLogs) {
    if (!isValidDateKey(m.date) || !Number.isFinite(m.score)) continue
    if (!map[m.date]) map[m.date] = { sum: 0, n: 0 }
    map[m.date].sum += m.score
    map[m.date].n += 1
  }
  return days.map((d) => (map[d] ? Number((map[d].sum / map[d].n).toFixed(2)) : null))
}

/** 坚持率：给定日期范围内「有打卡的天数」占比；分母从首次使用（范围内首次打卡）开始 */
export function adherence(checkIns: CheckIn[], days: string[]): { hit: number; total: number; rate: number } {
  const set = new Set(checkIns.map((c) => c.date))
  const earliest = [...set].sort()[0]
  const start = earliest && days.length > 0 && earliest > days[0] ? earliest : days[0] ?? ''
  const scoped = days.filter((d) => d >= start)
  const hit = scoped.filter((d) => set.has(d)).length
  const total = scoped.length
  return { hit, total, rate: total ? hit / total : 0 }
}

/** 历史最长连胜（高光时刻用）：扫描全部有打卡的日期，找最长连续段 */
export function getLongestStreak(checkIns: CheckIn[]): number {
  const days = [...new Set(checkIns.map((c) => c.date).filter(isValidDateKey))].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/** 标签使用频次（高频心情） */
export function tagFrequency(moodLogs: MoodLog[]): { tag: string; n: number }[] {
  const map: Record<string, number> = {}
  for (const m of moodLogs) for (const t of m.tags) map[t] = (map[t] ?? 0) + 1
  return Object.entries(map)
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n)
}
