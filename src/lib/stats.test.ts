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
  const unlocked = evaluateBadges(appData)
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
