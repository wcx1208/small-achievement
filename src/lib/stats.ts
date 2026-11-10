import type { CheckIn, FocusSession, MoodLog, Task, TaskCategory } from '../data/types'
import { TASK_CATEGORIES } from '../data/presets'
import { addDays, isValidDateKey, lastNDays, todayStr, weekdayCN } from './date'

/** 纯统计函数：连胜、今日/指定日状态、单任务连胜、分类占比、热力图/趋势数据 */

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

/** 单个任务的连续打卡天数 */
export function getTaskStreak(taskId: string, checkIns: CheckIn[], today = todayStr()): number {
  const days = new Set(
    checkIns
      .filter((c) => c.taskId === taskId && isValidDateKey(c.date))
      .map((c) => c.date),
  )
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 单个任务累计打卡次数 */
export function getTaskTotalCount(taskId: string, checkIns: CheckIn[]): number {
  let count = 0
  for (const c of checkIns) {
    if (c.taskId === taskId) count++
  }
  return count
}

export interface TodayStatus {
  pending: Task[]
  doneToday: { task: Task; checkIn: CheckIn }[]
  total: number
  completed: number
}

/** 指定日期分组：待完成 / 已完成（单次任务在其它日期已完成则不再进入待办） */
export function getTodayStatus(tasks: Task[], checkIns: CheckIn[], targetDate = todayStr()): TodayStatus {
  const active = tasks.filter((t) => !t.archived)
  const todays = checkIns.filter((c) => c.date === targetDate)
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
      // 单次任务：如果在其它天已完成过，就不再出现在当前日待办
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

/** 最近 7 天每日打卡次数列表（用于周节奏柱状概览与日期切换条） */
export function weeklyActivity(
  checkIns: CheckIn[],
  today = todayStr(),
): { date: string; weekday: string; dayNum: string; count: number }[] {
  const counts = countsByDay(checkIns)
  return lastNDays(7, today).map((d) => ({
    date: d,
    weekday: d === today ? '今' : weekdayCN(d),
    dayNum: d.slice(8).replace(/^0/, ''),
    count: counts[d] ?? 0,
  }))
}

export interface DayOverviewItem {
  date: string
  weekday: string
  shortDate: string
  dayNum: string
  isToday: boolean
  completed: number
  total: number
  rate: number
  completedTitles: string[]
  moodEmoji?: string
  moodText?: string
  diaryCount: number
  focusMinutes: number
  waterCups: number
}

export interface WeeklyOverviewSummary {
  days: DayOverviewItem[]
  activeDaysCount: number
  totalDaysCount: number
  totalCompletedTasks: number
  averageRate: number
}

/** 生成横向滚动周视图的每日打卡与记录概览数据 */
export function getWeeklyOverview(
  data: {
    tasks: Task[]
    checkIns: CheckIn[]
    moodLogs: MoodLog[]
    diaries?: { date: string }[]
    focusSessions?: FocusSession[]
    waterLogs?: Record<string, number>
  },
  today = todayStr(),
  dayDates: string[] = lastNDays(7, today),
): WeeklyOverviewSummary {
  const safeDates = dayDates.length > 0 ? dayDates : [today]
  const days: DayOverviewItem[] = safeDates.map((d) => {
    const status = getTodayStatus(data.tasks, data.checkIns, d)
    const rate = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0
    const dayMood = data.moodLogs.find((m) => m.date === d)
    const diaryCount = (data.diaries ?? []).filter((entry) => entry.date === d).length
    const focusMinutes = (data.focusSessions ?? [])
      .filter((s) => s.date === d && Number.isFinite(s.minutes) && s.minutes > 0)
      .reduce((sum, s) => sum + s.minutes, 0)
    const waterCups = (data.waterLogs ?? {})[d] ?? 0
    const [, mStr = '', dStr = ''] = d.split('-')

    return {
      date: d,
      weekday: d === today ? '今天' : `周${weekdayCN(d)}`,
      shortDate: `${Number(mStr)}/${Number(dStr)}`,
      dayNum: dStr.replace(/^0/, ''),
      isToday: d === today,
      completed: status.completed,
      total: status.total,
      rate,
      completedTitles: status.doneToday.map((item) => item.task.title),
      moodEmoji: dayMood?.emoji,
      moodText: dayMood?.text || (dayMood?.tags?.length ? dayMood.tags.join('·') : undefined),
      diaryCount,
      focusMinutes,
      waterCups,
    }
  })

  const activeDaysCount = days.filter((d) => d.completed > 0).length
  const totalDaysCount = days.length
  const totalCompletedTasks = days.reduce((sum, d) => sum + d.completed, 0)
  const averageRate =
    totalDaysCount > 0 ? Math.round(days.reduce((sum, d) => sum + d.rate, 0) / totalDaysCount) : 0

  return {
    days,
    activeDaysCount,
    totalDaysCount,
    totalCompletedTasks,
    averageRate,
  }
}


/** 任务分类打卡分布统计 */
export function categoryBreakdown(
  tasks: Task[],
  checkIns: CheckIn[],
): { id: TaskCategory; label: string; icon: string; count: number; percent: number }[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const counts: Record<TaskCategory, number> = {
    health: 0,
    study: 0,
    work: 0,
    life: 0,
    mind: 0,
  }
  let total = 0
  for (const c of checkIns) {
    const task = taskMap.get(c.taskId)
    const cat: TaskCategory = task?.category ?? 'life'
    counts[cat] = (counts[cat] ?? 0) + 1
    total++
  }
  return TASK_CATEGORIES.map((meta) => ({
    id: meta.id,
    label: meta.label,
    icon: meta.icon,
    count: counts[meta.id] ?? 0,
    percent: total > 0 ? Math.round(((counts[meta.id] ?? 0) / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count)
}

/** 专注时长汇总 */
export function focusSummary(
  sessions: FocusSession[] = [],
  today = todayStr(),
): { todayMinutes: number; totalMinutes: number; totalSessions: number } {
  let todayMinutes = 0
  let totalMinutes = 0
  for (const s of sessions) {
    if (!Number.isFinite(s.minutes) || s.minutes <= 0) continue
    totalMinutes += s.minutes
    if (s.date === today) todayMinutes += s.minutes
  }
  return { todayMinutes, totalMinutes, totalSessions: sessions.length }
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

export interface GrowthLevelInfo {
  level: number
  title: string
  icon: string
  totalXP: number
  todayXP: number
  currentFloor: number
  nextTarget: number
  progressPct: number
}

const LEVEL_TIERS = [
  { level: 1, title: '初萌新芽', icon: '🌱', floor: 0, next: 80 },
  { level: 2, title: '晨露微光', icon: '💧', floor: 80, next: 200 },
  { level: 3, title: '向阳小树', icon: '🌿', floor: 200, next: 400 },
  { level: 4, title: '繁花满枝', icon: '🌸', floor: 400, next: 700 },
  { level: 5, title: '星光漫游', icon: '✨', floor: 700, next: 1200 },
  { level: 6, title: '岁月收藏家', icon: '🏆', floor: 1200, next: 2000 },
]

/** 计算用户成长能量值与等级：打卡+10、心情+8、日记+15、便签+5、专注每分钟+1、饮水每杯+2 */
export function getGrowthLevel(
  data: {
    checkIns: CheckIn[]
    moodLogs: MoodLog[]
    diaries: { date: string }[]
    notes: unknown[]
    focusSessions?: FocusSession[]
    waterLogs?: Record<string, number>
  },
  today = todayStr(),
): GrowthLevelInfo {
  const focusMins = (data.focusSessions ?? []).reduce((s, f) => s + (f.minutes || 0), 0)
  const totalWaterCups = Object.values(data.waterLogs ?? {}).reduce((s, n) => s + (n || 0), 0)
  const totalXP =
    data.checkIns.length * 10 +
    data.moodLogs.length * 8 +
    data.diaries.length * 15 +
    data.notes.length * 5 +
    focusMins +
    totalWaterCups * 2

  const todayCheckIns = data.checkIns.filter((c) => c.date === today).length
  const todayMoods = data.moodLogs.filter((m) => m.date === today).length
  const todayDiaries = data.diaries.filter((d) => d.date === today).length
  const todayFocus = (data.focusSessions ?? [])
    .filter((f) => f.date === today)
    .reduce((s, f) => s + (f.minutes || 0), 0)
  const todayWater = (data.waterLogs ?? {})[today] ?? 0
  const todayXP =
    todayCheckIns * 10 + todayMoods * 8 + todayDiaries * 15 + todayFocus + todayWater * 2

  let tier = LEVEL_TIERS[0]
  for (const t of LEVEL_TIERS) {
    if (totalXP >= t.floor) tier = t
  }
  const span = Math.max(1, tier.next - tier.floor)
  const progressPct = Math.min(100, Math.max(0, Math.round(((totalXP - tier.floor) / span) * 100)))

  return {
    level: tier.level,
    title: tier.title,
    icon: tier.icon,
    totalXP,
    todayXP,
    currentFloor: tier.floor,
    nextTarget: tier.next,
    progressPct,
  }
}
