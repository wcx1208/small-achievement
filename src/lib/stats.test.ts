import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adherence,
  categoryBreakdown,
  focusSummary,
  getGrowthLevel,
  getLongestStreak,
  getStreak,
  getTaskStreak,
  getTaskTotalCount,
  getTodayStatus,
  getWeeklyOverview,
  weeklyActivity,
} from './stats'
import { evaluateBadges } from '../data/badges'
import type { AppData, CheckIn, Task } from '../data/types'
import { defaultSettings } from '../storage'
import { addDays, todayStr } from './date'

const sampleTasks: Task[] = [
  { id: 't1', title: '晨起喝水', repeat: 'daily', category: 'health', createdAt: 1000, archived: false },
  { id: 't2', title: '阅读 10 页', repeat: 'daily', category: 'study', createdAt: 1000, archived: false },
  { id: 't3', title: '整理书桌', repeat: 'once', category: 'life', createdAt: 1000, archived: false },
]

const sampleCheckIns: CheckIn[] = [
  { id: 'c1', taskId: 't1', date: '2026-11-06', completedAt: 1000 },
  { id: 'c2', taskId: 't1', date: '2026-11-07', completedAt: 2000 },
  { id: 'c3', taskId: 't1', date: '2026-11-08', completedAt: 3000 },
  { id: 'c4', taskId: 't2', date: '2026-11-08', completedAt: 3500 },
]

test('getStreak and getTaskStreak calculate consecutive days accurately', () => {
  assert.equal(getStreak(sampleCheckIns, '2026-11-08'), 3)
  assert.equal(getTaskStreak('t1', sampleCheckIns, '2026-11-08'), 3)
  assert.equal(getTaskStreak('t2', sampleCheckIns, '2026-11-08'), 1)
  assert.equal(getTaskTotalCount('t1', sampleCheckIns), 3)
})

test('getTodayStatus partitions pending and completed tasks for target date', () => {
  const statusToday = getTodayStatus(sampleTasks, sampleCheckIns, '2026-11-08')
  assert.equal(statusToday.completed, 2)
  assert.equal(statusToday.pending.length, 1)
  assert.equal(statusToday.pending[0].id, 't3')

  const statusYesterday = getTodayStatus(sampleTasks, sampleCheckIns, '2026-11-07')
  assert.equal(statusYesterday.completed, 1)
  assert.equal(statusYesterday.pending.length, 2)
})

test('categoryBreakdown, weeklyActivity, and getWeeklyOverview aggregate check-ins properly', () => {
  const breakdown = categoryBreakdown(sampleTasks, sampleCheckIns)
  const health = breakdown.find((b) => b.id === 'health')
  const study = breakdown.find((b) => b.id === 'study')
  assert.equal(health?.count, 3)
  assert.equal(health?.percent, 75)
  assert.equal(study?.count, 1)
  assert.equal(study?.percent, 25)

  const week = weeklyActivity(sampleCheckIns, '2026-11-08')
  assert.equal(week.length, 7)
  assert.equal(week[6].date, '2026-11-08')
  assert.equal(week[6].count, 2)

  const overview = getWeeklyOverview(
    {
      tasks: sampleTasks,
      checkIns: sampleCheckIns,
      moodLogs: [{ id: 'm1', date: '2026-11-08', score: 5, emoji: '😊', tags: ['开心'], text: '很棒', createdAt: 3600 }],
      diaries: [{ date: '2026-11-08' }],
      focusSessions: [{ id: 'f1', date: '2026-11-08', minutes: 25, completedAt: 3700 }],
      waterLogs: { '2026-11-08': 6 },
    },
    '2026-11-08',
  )
  assert.equal(overview.days.length, 7)
  assert.equal(overview.activeDaysCount, 3)
  assert.equal(overview.totalCompletedTasks, 4)
  const lastDay = overview.days[6]
  assert.equal(lastDay.date, '2026-11-08')
  assert.equal(lastDay.completed, 2)
  assert.equal(lastDay.total, 3)
  assert.equal(lastDay.rate, 67)
  assert.deepEqual(lastDay.completedTitles, ['晨起喝水', '阅读 10 页'])
  assert.equal(lastDay.moodEmoji, '😊')
  assert.equal(lastDay.waterCups, 6)
  assert.equal(lastDay.focusMinutes, 25)
  assert.equal(lastDay.diaryCount, 1)
})

test('focusSummary, getGrowthLevel, and evaluateBadges work with focus sessions and waterLogs', () => {
  const summary = focusSummary(
    [
      { id: 'f1', date: '2026-11-08', minutes: 25, completedAt: 1000 },
      { id: 'f2', date: '2026-11-07', minutes: 15, completedAt: 900 },
    ],
    '2026-11-08',
  )
  assert.equal(summary.todayMinutes, 25)
  assert.equal(summary.totalMinutes, 40)
  assert.equal(summary.totalSessions, 2)

  const appData: AppData = {
    version: 1,
    tasks: sampleTasks,
    checkIns: sampleCheckIns,
    moodLogs: [],
    badges: [],
    diaries: [],
    notes: [],
    focusSessions: [{ id: 'f1', date: '2026-11-08', minutes: 25, completedAt: 1000 }],
    waterLogs: { '2026-11-08': 5 },
    settings: defaultSettings(),
  }
  // 徽章判定以「今天」为基准计算连胜，这里用相对今天的三天，
  // 避免测试写死日期后隔天就变红
  const recentCheckIns: CheckIn[] = [0, 1, 2].map((i) => ({
    id: `r${i}`,
    taskId: 't1',
    date: addDays(todayStr(), -i),
    completedAt: 1000 + i,
  }))
  const unlocked = evaluateBadges({
    ...appData,
    checkIns: recentCheckIns,
    focusSessions: [{ id: 'f1', date: todayStr(), minutes: 25, completedAt: 1000 }],
    waterLogs: { [todayStr()]: 5 },
  })
  assert.ok(unlocked.includes('first-checkin'))
  assert.ok(unlocked.includes('streak-3'))
  assert.ok(unlocked.includes('focus-1'))

  const growth = getGrowthLevel(appData, '2026-11-08')
  assert.equal(growth.totalXP, 4 * 10 + 25 + 5 * 2)
  assert.equal(growth.level, 1)
})

test('adherence and longestStreak handle gaps gracefully', () => {
  const days = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
  const adh = adherence(sampleCheckIns, days)
  assert.equal(adh.hit, 3)
  assert.equal(adh.total, 3)
  assert.equal(getLongestStreak(sampleCheckIns), 3)
})

test('deleting a task with cascaded checkIn cleanup resets streak, daily count, task count, and adherence', () => {
  const tasksAfterDelete = sampleTasks.filter((t) => t.id !== 't1')
  const checkInsAfterDelete = sampleCheckIns.filter((c) => c.taskId !== 't1')

  // 原先 t1 贡献了 11-06、11-07、11-08 三天连胜；删除 t1 并级联清理 checkIns 后，只剩 t2 在 11-08 的打卡
  assert.equal(getStreak(checkInsAfterDelete, '2026-11-08'), 1)
  assert.equal(getTaskTotalCount('t1', checkInsAfterDelete), 0)

  const dayCounts = weeklyActivity(checkInsAfterDelete, '2026-11-08')
  assert.equal(dayCounts.find((d) => d.date === '2026-11-06')?.count, 0)
  assert.equal(dayCounts.find((d) => d.date === '2026-11-07')?.count, 0)
  assert.equal(dayCounts.find((d) => d.date === '2026-11-08')?.count, 1)

  const statusAfterDelete = getTodayStatus(tasksAfterDelete, checkInsAfterDelete, '2026-11-08')
  assert.equal(statusAfterDelete.completed, 1)
  assert.equal(statusAfterDelete.total, 2)

  const adhAfterDelete = adherence(checkInsAfterDelete, ['2026-11-06', '2026-11-07', '2026-11-08'])
  assert.equal(adhAfterDelete.hit, 1)
  assert.equal(adhAfterDelete.total, 1)
})

test('recreating a once task after deletion does not stay hidden due to orphan checkIns', () => {
  // 模拟：t-once 在 2026-11-06 打卡完成，随后被删除并级联清除了 checkIns，之后重建了同 ID 的单次任务
  const onceTask: Task = { id: 't-once', title: '交材料', repeat: 'once', createdAt: 2000, archived: false }
  const cleanedCheckIns = sampleCheckIns.filter((c) => c.taskId !== 't-once')

  const status = getTodayStatus([onceTask], cleanedCheckIns, '2026-11-08')
  assert.equal(status.pending.length, 1)
  assert.equal(status.pending[0].id, 't-once')
  assert.equal(status.doneToday.length, 0)
})
