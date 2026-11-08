import type {
  AppData,
  AppSettings,
  Badge,
  CheckIn,
  DiaryEntry,
  MoodLog,
  Note,
  Task,
  ThemeMode,
  Wallpaper,
} from '../data/types'
import { BADGE_MAP } from '../data/badges'
import { NOTE_COLORS, findPreset } from '../data/presets'
import { dateAt, isValidDateKey, todayStr } from '../lib/date'
import { uid } from '../lib/uid'

/**
 * 独立存储模块：整个 App 的所有数据读写都必须经过这里。
 * 启动、迁移和导入统一走 normalizeData，畸形备份不会进入渲染层。
 */

export const STORAGE_KEY = 'xiaochengjiu/data/v1'
const CORRUPT_KEY = 'xiaochengjiu/data/corrupt'
const DATA_VERSION = 1
const MAX_WALLPAPER_DATA_URL = 1_200_000
const MAX_ICON_DATA_URL = 800_000

export interface LoadResult {
  data: AppData
  warning?: string
  corruptRaw?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asText(value: unknown, max = 5000): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function asId(value: unknown): string {
  const id = asText(value, 100).trim()
  return id || uid()
}

function asTime(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function asTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto'
}

export function defaultSettings(): AppSettings {
  return {
    wallpaper: { type: 'preset', value: 'sunrise' },
    customTags: [],
    theme: 'auto',
    reminder: { enabled: false, time: '21:00' },
  }
}

function normalizeWallpaper(value: unknown): Wallpaper {
  if (isRecord(value)) {
    if (value.type === 'image') {
      const url = asText(value.value, MAX_WALLPAPER_DATA_URL + 1)
      if (url.startsWith('data:image/') && url.length <= MAX_WALLPAPER_DATA_URL) {
        const opacity = typeof value.opacity === 'number' && Number.isFinite(value.opacity)
          ? Math.min(1, Math.max(0.3, value.opacity))
          : 1
        return { type: 'image', value: url, opacity }
      }
    }
    if (value.type === 'preset' && typeof value.value === 'string' && findPreset(value.value)) {
      return { type: 'preset', value: value.value }
    }
  }
  return { type: 'preset', value: 'sunrise' }
}

function normalizeSettings(value: unknown): AppSettings {
  const raw = isRecord(value) ? value : {}
  const customTags: string[] = []
  if (Array.isArray(raw.customTags)) {
    for (const item of raw.customTags) {
      const tag = asText(item, 12).trim()
      if (tag && !customTags.includes(tag)) customTags.push(tag)
      if (customTags.length >= 40) break
    }
  }

  const reminderRaw = isRecord(raw.reminder) ? raw.reminder : {}
  const time = typeof reminderRaw.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(reminderRaw.time)
    ? reminderRaw.time
    : '21:00'

  const settings: AppSettings = {
    wallpaper: normalizeWallpaper(raw.wallpaper),
    customTags,
    theme: asTheme(raw.theme),
    reminder: { enabled: reminderRaw.enabled === true, time },
  }
  const icon = asText(raw.customIcon, MAX_ICON_DATA_URL + 1)
  if (icon.startsWith('data:image/') && icon.length <= MAX_ICON_DATA_URL) settings.customIcon = icon
  return settings
}

/** 单一清洗入口：缺字段补默认值，非法记录直接丢弃，合法记录去重 */
export function normalizeData(value: unknown): AppData {
  const raw = isRecord(value) ? value : {}
  const now = Date.now()
  const taskIds = new Set<string>()
  const checkInIds = new Set<string>()
  const checkInKeys = new Set<string>()
  const moodIds = new Set<string>()
  const badgeIds = new Set<string>()
  const diaryIds = new Set<string>()
  const noteIds = new Set<string>()

  const tasks: Task[] = []
  if (Array.isArray(raw.tasks)) {
    for (const item of raw.tasks) {
      if (!isRecord(item)) continue
      const title = asText(item.title, 60).trim()
      if (!title) continue
      const id = asId(item.id)
      if (taskIds.has(id)) continue
      taskIds.add(id)
      tasks.push({
        id,
        title,
        repeat: item.repeat === 'daily' ? 'daily' : 'once',
        createdAt: asTime(item.createdAt, now),
        archived: item.archived === true,
      })
    }
  }

  const checkIns: CheckIn[] = []
  if (Array.isArray(raw.checkIns)) {
    for (const item of raw.checkIns) {
      if (!isRecord(item)) continue
      const taskId = asText(item.taskId, 100).trim()
      if (!taskId || !isValidDateKey(item.date)) continue
      const key = `${taskId}|${item.date}`
      if (checkInKeys.has(key)) continue
      checkInKeys.add(key)
      let id = asId(item.id)
      while (checkInIds.has(id)) id = uid()
      checkInIds.add(id)
      checkIns.push({
        id,
        taskId,
        date: item.date,
        completedAt: asTime(item.completedAt, dateAt(item.date, 20) ?? now),
      })
    }
  }

  const moodLogs: MoodLog[] = []
  if (Array.isArray(raw.moodLogs)) {
    for (const item of raw.moodLogs) {
      if (!isRecord(item) || !isValidDateKey(item.date)) continue
      const id = asId(item.id)
      if (moodIds.has(id)) continue
      const scoreRaw = Number(item.score)
      if (!Number.isFinite(scoreRaw)) continue
      const score = Math.min(5, Math.max(1, Math.round(scoreRaw)))
      const tags: string[] = []
      if (Array.isArray(item.tags)) {
        for (const tagValue of item.tags) {
          const tag = asText(tagValue, 12).trim()
          if (tag && !tags.includes(tag)) tags.push(tag)
          if (tags.length >= 12) break
        }
      }
      const emoji = asText(item.emoji, 8).trim() || ['', '😣', '☹️', '😐', '🙂', '😊'][score]
      const relatedTaskId = asText(item.relatedTaskId, 100).trim() || undefined
      moodIds.add(id)
      moodLogs.push({
        id,
        date: item.date,
        emoji,
        score,
        tags,
        text: asText(item.text, 500),
        createdAt: asTime(item.createdAt, dateAt(item.date, 21) ?? now),
        ...(relatedTaskId ? { relatedTaskId } : {}),
      })
    }
  }

  const badges: Badge[] = []
  if (Array.isArray(raw.badges)) {
    for (const item of raw.badges) {
      if (!isRecord(item)) continue
      const id = asText(item.id, 80)
      if (!BADGE_MAP[id] || badgeIds.has(id)) continue
      badgeIds.add(id)
      badges.push({ id, unlockedAt: asTime(item.unlockedAt, now) })
    }
  }

  const diaries: DiaryEntry[] = []
  if (Array.isArray(raw.diaries)) {
    for (const item of raw.diaries) {
      if (!isRecord(item) || !isValidDateKey(item.date)) continue
      const text = asText(item.text, 10000).trim()
      if (!text) continue
      const id = asId(item.id)
      if (diaryIds.has(id)) continue
      const createdAt = asTime(item.createdAt, now)
      diaryIds.add(id)
      diaries.push({
        id,
        date: item.date,
        text,
        createdAt,
        updatedAt: Math.max(createdAt, asTime(item.updatedAt, createdAt)),
      })
    }
  }

  const notes: Note[] = []
  if (Array.isArray(raw.notes)) {
    for (const item of raw.notes) {
      if (!isRecord(item)) continue
      const text = asText(item.text, 1000).trim()
      if (!text) continue
      const id = asId(item.id)
      if (noteIds.has(id)) continue
      const createdAt = asTime(item.createdAt, now)
      const color = typeof item.color === 'string' && NOTE_COLORS.some((c) => c.id === item.color)
        ? item.color
        : 'amber'
      noteIds.add(id)
      notes.push({
        id,
        text,
        color,
        createdAt,
        updatedAt: Math.max(createdAt, asTime(item.updatedAt, createdAt)),
      })
    }
  }

  return {
    version: DATA_VERSION,
    tasks,
    checkIns,
    moodLogs,
    badges,
    diaries,
    notes,
    settings: normalizeSettings(raw.settings),
  }
}

export function emptyData(settings: AppSettings = defaultSettings()): AppData {
  return {
    version: DATA_VERSION,
    tasks: [],
    checkIns: [],
    moodLogs: [],
    badges: [],
    diaries: [],
    notes: [],
    settings,
  }
}

function recordCount(data: AppData): number {
  return data.tasks.length + data.checkIns.length + data.moodLogs.length +
    data.badges.length + data.diaries.length + data.notes.length
}

function rawRecordCount(raw: Record<string, unknown>): number {
  return ['tasks', 'checkIns', 'moodLogs', 'badges', 'diaries', 'notes'].reduce((sum, key) => {
    const value = raw[key]
    return sum + (Array.isArray(value) ? value.length : 0)
  }, 0)
}

/** 导入前预检：兼容 {app,schema,data} 外壳，但必须至少包含任务和打卡数组 */
export function normalizeBackup(value: unknown): AppData {
  if (!isRecord(value)) throw new Error('备份根节点不是对象')
  if (!Array.isArray(value.tasks) || !Array.isArray(value.checkIns)) {
    throw new Error('备份缺少任务或打卡数据')
  }
  const normalized = normalizeData(value)
  if (rawRecordCount(value) > 0 && recordCount(normalized) === 0) {
    throw new Error('备份中没有可识别的记录')
  }
  return normalized
}

/** 首次启动的示例数据：含近 8 天的打卡历史与 4 条心情，方便立刻体验连胜/热力图/徽章 */
export function createSeedData(): AppData {
  const now = Date.now()
  const today = todayStr()

  const mkTask = (title: string, repeat: Task['repeat'], createdDaysAgo: number): Task => ({
    id: uid(),
    title,
    repeat,
    createdAt: dateAt(addDaysSafe(today, -createdDaysAgo), 8, 30) ?? now,
    archived: false,
  })

  const walk = mkTask('晨间散步', 'daily', 9)
  const water = mkTask('喝够 8 杯水', 'daily', 9)
  const read = mkTask('阅读 10 页', 'daily', 8)
  const desk = mkTask('收拾书桌', 'once', 7)
  const tasks = [walk, water, read, desk]

  // 近 8 天的打卡：每天至少 1 次（连胜 9 天，含今天），分布有疏密更真实
  const plan: [number, Task[]][] = [
    [-8, [walk, water, read]],
    [-7, [walk, water]],
    [-6, [walk, water, read]],
    [-5, [walk, read]],
    [-4, [walk, water]],
    [-3, [read, water]],
    [-2, [walk, water, read]],
    [-1, [walk, water]],
  ]
  const checkIns: CheckIn[] = []
  for (const [offset, list] of plan) {
    const ds = addDaysSafe(today, offset)
    for (const t of list) {
      checkIns.push({
        id: uid(),
        taskId: t.id,
        date: ds,
        completedAt: dateAt(ds, 20, 0) ?? now,
      })
    }
  }
  checkIns.push({ id: uid(), taskId: walk.id, date: today, completedAt: now - 2 * 3600_000 })

  const moodLogs: MoodLog[] = [
    {
      id: uid(),
      date: today,
      emoji: '😊',
      score: 5,
      tags: ['开心'],
      text: '散步完神清气爽，今天也要加油呀！',
      createdAt: now - 1.5 * 3600_000,
      relatedTaskId: walk.id,
    },
    {
      id: uid(),
      date: addDaysSafe(today, -3),
      emoji: '🙂',
      score: 4,
      tags: ['满足'],
      text: '今天节奏刚刚好，读完书很满足。',
      createdAt: dateAt(addDaysSafe(today, -3), 21, 30) ?? now,
    },
    {
      id: uid(),
      date: addDaysSafe(today, -6),
      emoji: '😐',
      score: 3,
      tags: ['疲惫'],
      text: '有点累，但还是把打卡完成了。',
      createdAt: dateAt(addDaysSafe(today, -6), 22, 0) ?? now,
    },
    {
      id: uid(),
      date: addDaysSafe(today, -8),
      emoji: '🙂',
      score: 4,
      tags: ['期待', '开心'],
      text: '开始记录的第一天，感觉不错！',
      createdAt: dateAt(addDaysSafe(today, -8), 21, 0) ?? now,
    },
  ]

  const dayTs = (offset: number, h: number) => dateAt(addDaysSafe(today, offset), h, 0) ?? now
  const badges: Badge[] = [
    { id: 'first-checkin', unlockedAt: dayTs(-8, 20) },
    { id: 'mood-1', unlockedAt: dayTs(-8, 21) },
    { id: 'streak-3', unlockedAt: dayTs(-6, 20) },
    { id: 'total-10', unlockedAt: dayTs(-5, 20) },
    { id: 'streak-7', unlockedAt: dayTs(-2, 20) },
  ]

  const diaries: DiaryEntry[] = [
    {
      id: uid(),
      date: today,
      text: '今天开始用「小成就」记录自己。晚上散步的时候风很舒服，突然觉得坚持一件小事也没那么难，记一笔。',
      createdAt: now - 3 * 3600_000,
      updatedAt: now - 3 * 3600_000,
    },
  ]
  const notes: Note[] = [
    { id: uid(), text: '记得给妈妈打个电话 ☎️', color: 'amber', createdAt: now - 5 * 3600_000, updatedAt: now - 5 * 3600_000 },
    { id: uid(), text: '周末想去的那家面馆\n导航搜「老周家」', color: 'sky', createdAt: now - 26 * 3600_000, updatedAt: now - 26 * 3600_000 },
  ]

  return {
    version: DATA_VERSION,
    tasks,
    checkIns,
    moodLogs,
    badges,
    diaries,
    notes,
    settings: { ...defaultSettings(), wallpaper: { type: 'preset', value: 'sunrise' } },
  }
}

function addDaysSafe(ds: string, offset: number): string {
  const [y, m, d] = ds.split('-').map(Number)
  const value = new Date(y, m - 1, d)
  value.setDate(value.getDate() + offset)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function corruptResult(raw: string): LoadResult {
  try {
    localStorage.setItem(CORRUPT_KEY, raw)
  } catch {
    /* 配额不足时仍把原文返回给当前会话，至少允许用户立刻下载 */
  }
  return {
    data: emptyData(),
    warning: '原数据无法读取，已切换到安全空白模式。原始内容已保留，请先下载备份再重新开始。',
    corruptRaw: raw,
  }
}

export async function loadData(): Promise<LoadResult> {
  const rawText = localStorage.getItem(STORAGE_KEY)
  if (rawText === null) {
    // 新用户从空白开始，避免把示例打卡误认为自己的成就；示例数据仍可从「我的」手动恢复。
    const fresh = emptyData()
    try {
      await saveData(fresh)
      return { data: fresh }
    } catch (error) {
      return { data: fresh, warning: (error as Error).message }
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return corruptResult(rawText)
  }
  if (!isRecord(parsed)) return corruptResult(rawText)

  try {
    const data = normalizeData(parsed)
    if (rawRecordCount(parsed) > 0 && recordCount(data) === 0) return corruptResult(rawText)
    return { data }
  } catch {
    return corruptResult(rawText)
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error('本地存储空间不足，保存失败。请先导出备份，或换一张体积更小的壁纸。')
  }
}

export function getRawSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function getCorruptSnapshot(): string | null {
  try {
    return localStorage.getItem(CORRUPT_KEY)
  } catch {
    return null
  }
}

export async function clearStorage(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(CORRUPT_KEY)
}

/** 兼容旧代码的默认设置常量；不要直接修改它 */
export const DEFAULT_SETTINGS: AppSettings = defaultSettings()
