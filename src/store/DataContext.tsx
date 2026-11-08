import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Preferences } from '@capacitor/preferences'
import type { AppData, AppSettings, DiaryEntry, MoodLog, Note, Repeat, Task, Wallpaper } from '../data/types'
import * as storage from '../storage'
import { BADGE_MAP, evaluateBadges } from '../data/badges'
import type { BadgeDef } from '../data/badges'
import { DEFAULT_TAGS, NOTE_COLORS } from '../data/presets'
import { getStreak, getTodayStatus } from '../lib/stats'
import { todayStr } from '../lib/date'
import { refreshWidgetNow } from '../plugins/widget'
import { uid } from '../lib/uid'

/** 全局数据上下文：页面组件不直接碰 localStorage，一律通过这里的 action 修改 */

export interface MoodInput {
  date: string
  emoji: string
  score: number
  tags: string[]
  text: string
  relatedTaskId?: string
}

export type ToggleResult = 'added' | 'removed' | 'failed'

/** 把今日进度摘要写入原生存储（桌面小组件从 SharedPreferences 读取）并触发即时刷新 */
async function syncWidget(data: AppData, today = todayStr()) {
  try {
    const status = getTodayStatus(data.tasks, data.checkIns, today)
    await Preferences.set({
      key: 'widget',
      value: JSON.stringify({
        completed: status.completed,
        total: status.total,
        streak: getStreak(data.checkIns, today),
        date: today,
      }),
    })
    await refreshWidgetNow()
  } catch {
    /* 网页端无妨；原生端失败也不影响主流程 */
  }
}

interface DataContextValue {
  ready: boolean
  data: AppData
  today: string
  /** 启动时数据损坏或存储失败的一次性提示 */
  storageWarning: string | null
  corruptRaw: string | null
  dismissStorageWarning: () => void
  /** 待展示的解锁徽章队列（一次可能连解多个） */
  badgeQueue: BadgeDef[]
  ackBadge: () => void
  addTask: (title: string, repeat: Repeat) => Promise<boolean>
  renameTask: (id: string, title: string) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  setArchived: (id: string, archived: boolean) => Promise<boolean>
  toggleCheckIn: (taskId: string) => Promise<ToggleResult>
  addMoodLog: (input: MoodInput) => Promise<boolean>
  deleteMoodLog: (id: string) => Promise<boolean>
  saveDiary: (input: { id?: string; date: string; text: string }) => Promise<boolean>
  deleteDiary: (id: string) => Promise<boolean>
  saveNote: (input: { id?: string; text: string; color?: string }) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  setWallpaper: (w: Wallpaper) => Promise<boolean>
  setCustomIcon: (dataUrl: string | null) => Promise<boolean>
  updateSettings: (patch: Partial<AppSettings>) => Promise<boolean>
  importData: (raw: unknown) => Promise<boolean>
  resetData: (mode: 'seed' | 'empty') => Promise<boolean>
}

// undefined 表示「不在 Provider 内」，null 表示「数据仍在加载中」
const DataContext = createContext<DataContextValue | null | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [today, setToday] = useState(todayStr())
  const [badgeQueue, setBadgeQueue] = useState<BadgeDef[]>([])
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [corruptRaw, setCorruptRaw] = useState<string | null>(null)
  const dataRef = useRef<AppData | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await storage.loadData()
        if (cancelled) return
        // 老数据可能缺少后续版本新增的徽章：静默补齐内存状态，避免下一次操作一次弹很多个。
        const missingBadges = evaluateBadges(result.data)
        const hydrated = missingBadges.length
          ? {
              ...result.data,
              badges: [
                ...result.data.badges,
                ...missingBadges.map((id) => ({ id, unlockedAt: Date.now() })),
              ],
            }
          : result.data
        dataRef.current = hydrated
        setData(hydrated)
        setStorageWarning(result.warning ?? null)
        setCorruptRaw(result.corruptRaw ?? null)
        void syncWidget(hydrated)
      } catch (error) {
        if (cancelled) return
        const fallback = storage.emptyData()
        dataRef.current = fallback
        setData(fallback)
        setStorageWarning((error as Error).message || '数据读取失败，已进入安全模式。')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // 跨天后自动刷新所有以 today 为基准的派生数据；回到前台时也会补一次检查。
  useEffect(() => {
    let timer: number | undefined
    let appListener: { remove: () => Promise<void> } | undefined
    let disposed = false
    const refresh = () => {
      const next = todayStr()
      setToday((prev) => (prev === next ? prev : next))
    }
    const scheduleMidnight = () => {
      window.clearTimeout(timer)
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 0, 0)
      timer = window.setTimeout(() => {
        refresh()
        scheduleMidnight()
      }, Math.max(1000, next.getTime() - now.getTime()))
    }
    const onVisible = () => {
      if (document.hidden) return
      refresh()
      scheduleMidnight()
    }
    scheduleMidnight()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        refresh()
        scheduleMidnight()
      }).then((handle) => {
        if (disposed) void handle.remove()
        else appListener = handle
      })
    }
    return () => {
      disposed = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      void appListener?.remove()
    }
  }, [])

  // 跨天/回前台时，小组件即使没有新操作也要从“昨天”切到今天。
  useEffect(() => {
    if (dataRef.current) void syncWidget(dataRef.current, today)
  }, [today])

  /** 统一提交入口：串行写入，避免连续点击时后一次覆盖前一次；返回真实成败 */
  const commit = useCallback(async (updater: (current: AppData) => AppData, announceBadges = true): Promise<boolean> => {
    let succeeded = false
    const run = async () => {
      const current = dataRef.current
      if (!current) return
      try {
        let next = updater(current)
        const newIds = evaluateBadges(next)
        if (newIds.length) {
          next = {
            ...next,
            badges: [...next.badges, ...newIds.map((id) => ({ id, unlockedAt: Date.now() }))],
          }
        }
        await storage.saveData(next)
        dataRef.current = next
        setData(next)
        if (newIds.length) {
          setBadgeQueue((q) => (announceBadges ? [...q, ...newIds.map((id) => BADGE_MAP[id])] : q))
        }
        const currentDay = todayStr()
        setToday((prev) => (prev === currentDay ? prev : currentDay))
        void syncWidget(next, currentDay)
        succeeded = true
      } catch (error) {
        alert((error as Error).message || '保存失败，请稍后再试。')
      }
    }
    const queued = saveChain.current.then(run, run)
    saveChain.current = queued
    await queued
    return succeeded
  }, [])

  const addTask = useCallback(async (title: string, repeat: Repeat) => {
    const clean = title.trim().slice(0, 60)
    if (!clean) return false
    return commit((current) => {
      const task: Task = { id: uid(), title: clean, repeat, createdAt: Date.now(), archived: false }
      return { ...current, tasks: [...current.tasks, task] }
    })
  }, [commit])

  const renameTask = useCallback(async (id: string, title: string) => {
    const clean = title.trim().slice(0, 60)
    if (!clean) return false
    return commit((current) => ({
      ...current,
      tasks: current.tasks.map((t) => (t.id === id ? { ...t, title: clean } : t)),
    }))
  }, [commit])

  const deleteTask = useCallback(async (id: string) => {
    return commit((current) => ({ ...current, tasks: current.tasks.filter((t) => t.id !== id) }))
  }, [commit])

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    return commit((current) => ({
      ...current,
      tasks: current.tasks.map((t) => (t.id === id ? { ...t, archived } : t)),
    }))
  }, [commit])

  const toggleCheckIn = useCallback(async (taskId: string): Promise<ToggleResult> => {
    let result: ToggleResult = 'failed'
    const currentDay = todayStr()
    setToday((prev) => (prev === currentDay ? prev : currentDay))
    const ok = await commit((current) => {
      const existing = current.checkIns.find((c) => c.taskId === taskId && c.date === currentDay)
      if (existing) {
        result = 'removed'
        return {
          ...current,
          checkIns: current.checkIns.filter((c) => !(c.taskId === taskId && c.date === currentDay)),
        }
      }
      result = 'added'
      return {
        ...current,
        checkIns: [...current.checkIns, { id: uid(), taskId, date: currentDay, completedAt: Date.now() }],
      }
    })
    return ok ? result : 'failed'
  }, [commit])

  const addMoodLog = useCallback(async (input: MoodInput) => {
    return commit((current) => {
      const log: MoodLog = { id: uid(), createdAt: Date.now(), ...input }
      const merged = new Set(current.settings.customTags)
      for (const t of input.tags) if (!DEFAULT_TAGS.includes(t)) merged.add(t)
      return {
        ...current,
        moodLogs: [log, ...current.moodLogs],
        settings: { ...current.settings, customTags: [...merged] },
      }
    })
  }, [commit])

  const deleteMoodLog = useCallback(async (id: string) => {
    return commit((current) => ({ ...current, moodLogs: current.moodLogs.filter((m) => m.id !== id) }))
  }, [commit])

  /** 日记：新建或编辑（带 id 即编辑），updatedAt 记录最后修改时间 */
  const saveDiary = useCallback(async (input: { id?: string; date: string; text: string }) => {
    const text = input.text.trim()
    if (!text) return false
    return commit((current) => {
      const now = Date.now()
      let diaries: DiaryEntry[]
      if (input.id) {
        diaries = current.diaries.map((d) =>
          d.id === input.id ? { ...d, date: input.date, text, updatedAt: now } : d,
        )
      } else {
        diaries = [...current.diaries, { id: uid(), date: input.date, text, createdAt: now, updatedAt: now }]
      }
      return { ...current, diaries }
    })
  }, [commit])

  const deleteDiary = useCallback(async (id: string) => {
    return commit((current) => ({ ...current, diaries: current.diaries.filter((d) => d.id !== id) }))
  }, [commit])

  /** 便签：新建或编辑；不指定颜色时新便签随机取色 */
  const saveNote = useCallback(async (input: { id?: string; text: string; color?: string }) => {
    const text = input.text.trim()
    if (!text) return false
    return commit((current) => {
      const now = Date.now()
      let notes: Note[]
      if (input.id) {
        notes = current.notes.map((n) =>
          n.id === input.id ? { ...n, text, color: input.color ?? n.color, updatedAt: now } : n,
        )
      } else {
        const color = input.color ?? NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id
        notes = [...current.notes, { id: uid(), text, color, createdAt: now, updatedAt: now }]
      }
      return { ...current, notes }
    })
  }, [commit])

  const deleteNote = useCallback(async (id: string) => {
    return commit((current) => ({ ...current, notes: current.notes.filter((n) => n.id !== id) }))
  }, [commit])

  const setWallpaper = useCallback(async (w: Wallpaper) => {
    return commit((current) => ({ ...current, settings: { ...current.settings, wallpaper: w } }))
  }, [commit])

  /** 自定义 App 图标：传 null 清除恢复默认 */
  const setCustomIcon = useCallback(async (dataUrl: string | null) => {
    return commit((current) => {
      const settings = { ...current.settings }
      if (dataUrl) settings.customIcon = dataUrl
      else delete settings.customIcon
      return { ...current, settings }
    })
  }, [commit])

  /** 通用设置更新（主题 / 提醒等） */
  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    return commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [commit])

  /** 导入备份：先完整清洗，全部合法后才替换，失败不会改变现有数据 */
  const importData = useCallback(async (raw: unknown) => {
    let normalized: AppData
    try {
      normalized = storage.normalizeBackup(raw)
    } catch (error) {
      alert((error as Error).message || '备份格式不正确')
      return false
    }
    return commit(() => normalized, false)
  }, [commit])

  const resetData = useCallback(async (mode: 'seed' | 'empty') => {
    return commit((current) =>
      mode === 'seed'
        ? { ...storage.createSeedData(), settings: current.settings }
        : storage.emptyData(current.settings),
      false,
    )
  }, [commit])

  const ackBadge = useCallback(() => setBadgeQueue((q) => q.slice(1)), [])
  const dismissStorageWarning = useCallback(() => setStorageWarning(null), [])

  const value: DataContextValue | null = data
    ? {
        ready: true,
        data,
        today,
        storageWarning,
        corruptRaw,
        dismissStorageWarning,
        badgeQueue,
        ackBadge,
        addTask,
        renameTask,
        deleteTask,
        setArchived,
        toggleCheckIn,
        addMoodLog,
        deleteMoodLog,
        saveDiary,
        deleteDiary,
        saveNote,
        deleteNote,
        setWallpaper,
        setCustomIcon,
        updateSettings,
        importData,
        resetData,
      }
    : null

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue | null {
  const ctx = useContext(DataContext)
  if (ctx === undefined) throw new Error('useData 必须在 DataProvider 内使用')
  return ctx // 数据加载完成前为 null，由调用方展示启动画面
}
