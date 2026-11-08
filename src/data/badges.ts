import type { AppData } from './types'
import { getStreak } from '../lib/stats'

/** 徽章定义与解锁判定 */

export interface BadgeStats {
  totalCheckIns: number
  streak: number
  moodCount: number
}

export interface BadgeDef {
  id: string
  emoji: string
  name: string
  desc: string
  check: (s: BadgeStats) => boolean
}

export const BADGES: BadgeDef[] = [
  { id: 'first-checkin', emoji: '🌱', name: '第一步', desc: '完成了第一次打卡', check: (s) => s.totalCheckIns >= 1 },
  { id: 'streak-3', emoji: '🔥', name: '三日之约', desc: '连续打卡 3 天', check: (s) => s.streak >= 3 },
  { id: 'streak-7', emoji: '⭐', name: '一周星光', desc: '连续打卡 7 天', check: (s) => s.streak >= 7 },
  { id: 'streak-30', emoji: '🏆', name: '三十天里程碑', desc: '连续打卡 30 天', check: (s) => s.streak >= 30 },
  { id: 'total-10', emoji: '✨', name: '小试身手', desc: '累计打卡 10 次', check: (s) => s.totalCheckIns >= 10 },
  { id: 'total-50', emoji: '🌟', name: '积少成多', desc: '累计打卡 50 次', check: (s) => s.totalCheckIns >= 50 },
  { id: 'total-100', emoji: '💯', name: '百次之旅', desc: '累计打卡 100 次', check: (s) => s.totalCheckIns >= 100 },
  { id: 'mood-1', emoji: '💭', name: '心情起点', desc: '第一次记录心情', check: (s) => s.moodCount >= 1 },
  { id: 'mood-10', emoji: '🪞', name: '觉察之旅', desc: '记录心情满 10 条', check: (s) => s.moodCount >= 10 },
  { id: 'mood-30', emoji: '🌈', name: '情绪观察员', desc: '记录心情满 30 条', check: (s) => s.moodCount >= 30 },
]

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.id, b]))

export function badgeStats(data: AppData): BadgeStats {
  return {
    totalCheckIns: data.checkIns.length,
    streak: getStreak(data.checkIns),
    moodCount: data.moodLogs.length,
  }
}

/** 找出「条件已满足但尚未解锁」的徽章 id 列表 */
export function evaluateBadges(data: AppData): string[] {
  const owned = new Set(data.badges.map((b) => b.id))
  const s = badgeStats(data)
  return BADGES.filter((b) => !owned.has(b.id) && b.check(s)).map((b) => b.id)
}
