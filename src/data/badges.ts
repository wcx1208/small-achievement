import type { AppData } from './types'
import { getStreak } from '../lib/stats'

/** 徽章定义与解锁判定（支持进度百分比计算） */

export interface BadgeStats {
  totalCheckIns: number
  streak: number
  moodCount: number
  diaryCount: number
  focusCount: number
}

export interface BadgeDef {
  id: string
  emoji: string
  name: string
  desc: string
  check: (s: BadgeStats) => boolean
  progress: (s: BadgeStats) => { current: number; target: number }
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first-checkin',
    emoji: '🌱',
    name: '初露新芽',
    desc: '完成第 1 次微习惯打卡',
    check: (s) => s.totalCheckIns >= 1,
    progress: (s) => ({ current: Math.min(1, s.totalCheckIns), target: 1 }),
  },
  {
    id: 'streak-3',
    emoji: '🔥',
    name: '三日之约',
    desc: '连续打卡满 3 天',
    check: (s) => s.streak >= 3,
    progress: (s) => ({ current: Math.min(3, s.streak), target: 3 }),
  },
  {
    id: 'streak-7',
    emoji: '⭐',
    name: '七日星光',
    desc: '连续打卡满 7 天',
    check: (s) => s.streak >= 7,
    progress: (s) => ({ current: Math.min(7, s.streak), target: 7 }),
  },
  {
    id: 'streak-30',
    emoji: '🏆',
    name: '满月同行',
    desc: '连续打卡满 30 天',
    check: (s) => s.streak >= 30,
    progress: (s) => ({ current: Math.min(30, s.streak), target: 30 }),
  },
  {
    id: 'total-10',
    emoji: '✨',
    name: '微光成束',
    desc: '累计完成 10 次打卡',
    check: (s) => s.totalCheckIns >= 10,
    progress: (s) => ({ current: Math.min(10, s.totalCheckIns), target: 10 }),
  },
  {
    id: 'total-50',
    emoji: '🌟',
    name: '步履不停',
    desc: '累计完成 50 次打卡',
    check: (s) => s.totalCheckIns >= 50,
    progress: (s) => ({ current: Math.min(50, s.totalCheckIns), target: 50 }),
  },
  {
    id: 'total-100',
    emoji: '💯',
    name: '百次笃行',
    desc: '累计完成 100 次打卡',
    check: (s) => s.totalCheckIns >= 100,
    progress: (s) => ({ current: Math.min(100, s.totalCheckIns), target: 100 }),
  },
  {
    id: 'mood-1',
    emoji: '💭',
    name: '初听心声',
    desc: '记下第 1 条当下心情',
    check: (s) => s.moodCount >= 1,
    progress: (s) => ({ current: Math.min(1, s.moodCount), target: 1 }),
  },
  {
    id: 'mood-10',
    emoji: '🪞',
    name: '温柔觉察',
    desc: '累计记录 10 条心情',
    check: (s) => s.moodCount >= 10,
    progress: (s) => ({ current: Math.min(10, s.moodCount), target: 10 }),
  },
  {
    id: 'mood-30',
    emoji: '🌈',
    name: '心晴捕手',
    desc: '累计记录 30 条心情',
    check: (s) => s.moodCount >= 30,
    progress: (s) => ({ current: Math.min(30, s.moodCount), target: 30 }),
  },
  {
    id: 'diary-3',
    emoji: '📖',
    name: '岁月留痕',
    desc: '写下 3 篇生活日记',
    check: (s) => s.diaryCount >= 3,
    progress: (s) => ({ current: Math.min(3, s.diaryCount), target: 3 }),
  },
  {
    id: 'focus-1',
    emoji: '🍅',
    name: '心流时刻',
    desc: '完成 1 次番茄静心专注',
    check: (s) => s.focusCount >= 1,
    progress: (s) => ({ current: Math.min(1, s.focusCount), target: 1 }),
  },
]

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.id, b]))

export function badgeStats(data: AppData): BadgeStats {
  return {
    totalCheckIns: data.checkIns.length,
    streak: getStreak(data.checkIns),
    moodCount: data.moodLogs.length,
    diaryCount: data.diaries.length,
    focusCount: (data.focusSessions ?? []).length,
  }
}

/** 找出「条件已满足但尚未解锁」的徽章 id 列表 */
export function evaluateBadges(data: AppData): string[] {
  const owned = new Set(data.badges.map((b) => b.id))
  const s = badgeStats(data)
  return BADGES.filter((b) => !owned.has(b.id) && b.check(s)).map((b) => b.id)
}
