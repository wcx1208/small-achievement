import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useData } from './DataContext'
import {
  clampFocusMinutes,
  sanitizePersistedFocus,
  type PersistedFocus,
} from './focusSanitize'
import { burstAt } from '../features/rewards/celebrate'
import { hapticSuccess, hapticTap } from '../lib/haptics'

/**
 * 全局番茄专注状态（Opus 报告 P0-1 / P0-2 / P1-3 / P1-4 的集中修复）：
 * - 状态提升到 Provider：切换 Tab、TodayPage 卸载都不会丢进度
 * - 基于挂钟时间戳计算，锁屏 / 后台节流不漂移，回前台立即校准
 * - 开始时预约系统级本地通知（APK 后台到点必响），暂停 / 结束时取消
 * - 进度持久化到独立 key：App 被杀后重启可恢复倒计时或补结算，不污染 settings 白名单
 */

const FOCUS_ACTIVE_KEY = 'xiaochengjiu/focus/active'
const FOCUS_DONE_NOTIFICATION_ID = 2002

export type FocusStatus = 'idle' | 'running' | 'paused' | 'done'

export interface FocusDoneResult {
  minutes: number
  taskId: string | null
  taskTitle: string | null
  /** true = 归零自动结算（含离开期间的补结算） */
  auto: boolean
}

export interface FocusSnapshot {
  status: FocusStatus
  secondsLeft: number
  elapsedSeconds: number
  minutes: number
  taskId: string | null
  taskTitle: string | null
  alsoCheckIn: boolean
}

interface FocusContextValue {
  focus: FocusSnapshot
  /** 最近一次完成的专注（done 状态展示数据），确认后清空 */
  done: FocusDoneResult | null
  modalOpen: boolean
  modalTaskTitle: string | null
  minutes: number
  alsoCheckIn: boolean
  setPresetMinutes: (m: number) => void
  setAlsoCheckIn: (v: boolean) => void
  openModal: (task: { id: string; title: string } | null) => void
  closeModal: () => void
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  reset: () => void
  completeEarly: () => Promise<boolean>
  acknowledgeDone: () => void
}

const FocusContext = createContext<FocusContextValue | null | undefined>(undefined)

function persist(a: PersistedFocus | null) {
  try {
    if (a) localStorage.setItem(FOCUS_ACTIVE_KEY, JSON.stringify(a))
    else localStorage.removeItem(FOCUS_ACTIVE_KEY)
  } catch {
    /* 存储异常不阻断主流程 */
  }
}

async function scheduleNative(target: number, taskTitle: string | null, minutes: number) {
  if (!Capacitor.isNativePlatform()) return
  if (!Number.isFinite(target) || target <= Date.now()) return
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: FOCUS_DONE_NOTIFICATION_ID,
          title: '🍅 专注时间到！',
          body: taskTitle
            ? `「${taskTitle}」已完成 ${minutes} 分钟专注，给自己鼓个掌吧 ✨`
            : `已完成 ${minutes} 分钟静心专注，休息一下眼睛吧 ✨`,
          schedule: { at: new Date(target), allowWhileIdle: true },
        },
      ],
    })
  } catch {
    /* 通知不可用时静默降级为应用内提醒 */
  }
}

async function cancelNative() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: FOCUS_DONE_NOTIFICATION_ID }] })
  } catch {
    /* ignore */
  }
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const ctx = useData()
  const [minutes, setMinutes] = useState(25)
  const [alsoCheckIn, setAlsoCheckIn] = useState(true)
  const [active, setActive] = useState<PersistedFocus | null>(null)
  const [done, setDone] = useState<FocusDoneResult | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTask, setModalTask] = useState<{ id: string; title: string } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [tick, forceTick] = useState(0)
  const activeRef = useRef<PersistedFocus | null>(null)
  const settledRef = useRef(false)
  const hydratedRef = useRef(false)

  // 状态镜像：定时回调读取最新值
  activeRef.current = active

  /** 结算：落库 + 联动打卡 + 清持久化（settledRef 保证只执行一次） */
  const settle = useCallback(
    (opts: { auto: boolean; viaRecovery?: boolean; stale?: boolean; session?: PersistedFocus }) => {
      if (settledRef.current) return
      const a = opts.session ?? activeRef.current
      if (!a || !ctx) return
      settledRef.current = true
      const safeMinutes = clampFocusMinutes(a.minutes)
      if (!opts.stale) {
        hapticSuccess()
        burstAt(window.innerWidth / 2, window.innerHeight / 2)
      }
      // 原生端到点通知已由系统按预约时间发出；网页端在归零瞬间补发（超龄补记不弹窗）
      if (
        !opts.stale &&
        !Capacitor.isNativePlatform() &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification('🍅 专注时间到！', {
            body: a.taskTitle
              ? `「${a.taskTitle}」已完成 ${safeMinutes} 分钟专注 ✨`
              : `已完成 ${safeMinutes} 分钟静心专注 ✨`,
          })
        } catch {
          /* ignore */
        }
      }
      void ctx.addFocusSession({
        taskId: a.taskId ?? undefined,
        taskTitle: a.taskTitle ?? '自由专注',
        minutes: safeMinutes,
        date: ctx.today,
      })
      if (
        a.taskId &&
        a.alsoCheckIn &&
        !ctx.data.checkIns.some((c) => c.taskId === a.taskId && c.date === ctx.today)
      ) {
        void ctx.toggleCheckIn(a.taskId, ctx.today)
      }
      persist(null)
      activeRef.current = null
      setActive(null)
      void cancelNative()
      setMinutes(safeMinutes)
      setDone({ minutes: safeMinutes, taskId: a.taskId, taskTitle: a.taskTitle, auto: opts.auto })
      if (opts.stale) {
        ctx.notify(`🍅 发现一次较早前的 ${safeMinutes} 分钟专注尚未收尾，已为你温和补记入账 ✨`)
      } else if (opts.viaRecovery) {
        ctx.notify(`你在离开期间完成了一次 ${safeMinutes} 分钟专注，已自动记入今日成就 🍅`)
      } else {
        ctx.notify(`🎉 达成 ${safeMinutes} 分钟静心专注！为你点赞 ✨`)
      }
    },
    [ctx],
  )

  // 挂钟倒计时：每秒校准；锁屏 / 后台回来立即按时间差补齐
  useEffect(() => {
    if (active?.status !== 'running' || !active.targetEndTime) return
    const tickFn = () => {
      const a = activeRef.current
      if (!a || a.status !== 'running' || !a.targetEndTime) return
      const remaining = Math.max(0, Math.ceil((a.targetEndTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      forceTick((n) => n + 1)
      if (remaining <= 0) settle({ auto: true })
    }
    tickFn()
    const id = window.setInterval(tickFn, 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tickFn()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active, settle])

  // 启动恢复：App 被杀后按持久化状态恢复倒计时、补结算或清理损坏/超龄会话（P1-4 / P2-5）
  useEffect(() => {
    if (!ctx || !ctx.ready || hydratedRef.current) return
    hydratedRef.current = true
    let raw: string | null = null
    try {
      raw = localStorage.getItem(FOCUS_ACTIVE_KEY)
    } catch {
      return
    }
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as unknown
      const result = sanitizePersistedFocus(parsed)
      if (result.kind === 'running') {
        activeRef.current = result.session
        setActive(result.session)
        setMinutes(result.session.minutes)
        setSecondsLeft(result.secondsLeft)
        void scheduleNative(
          result.session.targetEndTime as number,
          result.session.taskTitle,
          result.session.minutes,
        )
        const remainMin = Math.max(1, Math.ceil(result.secondsLeft / 60))
        ctx.notify(`🍅 已为你接续专注计时，还剩 ${remainMin} 分钟`)
        return
      }
      if (result.kind === 'paused') {
        activeRef.current = result.session
        setActive(result.session)
        setMinutes(result.session.minutes)
        setSecondsLeft(result.secondsLeft)
        return
      }
      if (result.kind === 'settle-recovered') {
        settle({ auto: true, viaRecovery: true, session: result.session })
        return
      }
      if (result.kind === 'settle-stale') {
        settle({ auto: true, viaRecovery: true, stale: true, session: result.session })
        return
      }
      persist(null)
      void cancelNative()
      ctx.notify('上次专注计时状态异常，已为你自动重置，随时可以重新开始 🍅')
    } catch {
      persist(null)
      void cancelNative()
      ctx.notify('上次专注计时状态异常，已为你自动重置，随时可以重新开始 🍅')
    }
  }, [ctx, settle])

  const start = useCallback(async () => {
    const a = activeRef.current
    if (a) return
    if (
      !Capacitor.isNativePlatform() &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission()
      } catch {
        /* ignore */
      }
    }
    const safeMinutes = clampFocusMinutes(minutes)
    const next: PersistedFocus = {
      status: 'running',
      minutes: safeMinutes,
      targetEndTime: Date.now() + safeMinutes * 60_000,
      remainingAtPause: null,
      taskId: modalTask?.id ?? null,
      taskTitle: modalTask?.title ?? null,
      alsoCheckIn,
    }
    activeRef.current = next
    setActive(next)
    setMinutes(safeMinutes)
    setSecondsLeft(safeMinutes * 60)
    persist(next)
    settledRef.current = false
    hapticTap()
    const target = next.targetEndTime as number
    void scheduleNative(target, next.taskTitle, next.minutes)
  }, [minutes, modalTask, alsoCheckIn])

  const pause = useCallback(() => {
    const a = activeRef.current
    if (!a || a.status !== 'running' || !a.targetEndTime) return
    const remaining = Math.max(0, Math.ceil((a.targetEndTime - Date.now()) / 1000))
    const next: PersistedFocus = { ...a, status: 'paused', targetEndTime: null, remainingAtPause: remaining }
    activeRef.current = next
    setActive(next)
    setSecondsLeft(remaining)
    persist(next)
    void cancelNative()
    hapticTap()
  }, [])

  const resume = useCallback(async () => {
    const a = activeRef.current
    if (!a || a.status !== 'paused') return
    const safeMinutes = clampFocusMinutes(a.minutes)
    const rawRemaining = a.remainingAtPause
    const base =
      typeof rawRemaining === 'number' && Number.isFinite(rawRemaining) && rawRemaining > 0
        ? Math.min(safeMinutes * 60, Math.ceil(rawRemaining))
        : safeMinutes * 60
    if (base <= 0) return
    const next: PersistedFocus = {
      ...a,
      minutes: safeMinutes,
      status: 'running',
      targetEndTime: Date.now() + base * 1000,
      remainingAtPause: null,
    }
    activeRef.current = next
    setActive(next)
    setMinutes(safeMinutes)
    persist(next)
    const target = next.targetEndTime as number
    void scheduleNative(target, next.taskTitle, next.minutes)
  }, [])

  const reset = useCallback(() => {
    const safeMinutes = clampFocusMinutes(minutes)
    activeRef.current = null
    setActive(null)
    setMinutes(safeMinutes)
    setSecondsLeft(safeMinutes * 60)
    persist(null)
    void cancelNative()
    settledRef.current = false
  }, [minutes])

  const completeEarly = useCallback(async () => {
    if (settledRef.current) return false
    const a = activeRef.current
    if (!a || !ctx) return false
    settledRef.current = true
    const safeMinutes = clampFocusMinutes(a.minutes)
    const total = safeMinutes * 60
    const remaining =
      a.status === 'running' && a.targetEndTime
        ? Math.max(0, Math.ceil((a.targetEndTime - Date.now()) / 1000))
        : typeof a.remainingAtPause === 'number' && Number.isFinite(a.remainingAtPause)
          ? Math.max(0, a.remainingAtPause)
          : 0
    const elapsed = Math.max(0, total - remaining)
    const elapsedMin = clampFocusMinutes(Math.max(1, Math.round(elapsed / 60)), 1)
    const ok = await ctx.addFocusSession({
      taskId: a.taskId ?? undefined,
      taskTitle: a.taskTitle ?? '自由专注',
      minutes: elapsedMin,
      date: ctx.today,
    })
    if (!ok) {
      settledRef.current = false
      return false
    }
    if (
      a.taskId &&
      a.alsoCheckIn &&
      !ctx.data.checkIns.some((c) => c.taskId === a.taskId && c.date === ctx.today)
    ) {
      void ctx.toggleCheckIn(a.taskId, ctx.today)
    }
    persist(null)
    activeRef.current = null
    setActive(null)
    void cancelNative()
    burstAt(window.innerWidth / 2, window.innerHeight / 2)
    hapticSuccess()
    ctx.notify(`已完成 ${elapsedMin} 分钟专注 🍅`)
    setMinutes(safeMinutes)
    setDone({ minutes: elapsedMin, taskId: a.taskId, taskTitle: a.taskTitle, auto: false })
    return true
  }, [ctx])

  /** done 状态收尾：回到空闲并重置为整段时长，杜绝重复记账入口（P0-2） */
  const acknowledgeDone = useCallback(() => {
    setDone(null)
    settledRef.current = false
    persist(null)
  }, [])

  const setPresetMinutes = useCallback((m: number) => {
    if (activeRef.current) return
    const safeMinutes = clampFocusMinutes(m, minutes)
    setMinutes(safeMinutes)
    setSecondsLeft(safeMinutes * 60)
  }, [minutes])

  const openModal = useCallback((task: { id: string; title: string } | null) => {
    setModalTask(task)
    setModalOpen(true)
  }, [])

  // 无条件重置 done 与 settledRef，彻底消除陈旧闭包依赖（Opus/Neon 报告 P0 #4）
  const closeModal = useCallback(() => {
    setModalOpen(false)
    setDone(null)
    settledRef.current = false
  }, [])

  const setAlsoCheckInValue = useCallback((v: boolean) => {
    setAlsoCheckIn(v)
    const a = activeRef.current
    if (a) {
      const next = { ...a, alsoCheckIn: v }
      activeRef.current = next
      setActive(next)
      persist(next)
    }
  }, [])

  const focus: FocusSnapshot = useMemo(() => {
    const safeMinutes = clampFocusMinutes(minutes)
    const total = safeMinutes * 60
    let status: FocusStatus = 'idle'
    let nextSecondsLeft: number
    if (done) {
      status = 'done'
      nextSecondsLeft = 0
    } else if (active?.status === 'running') {
      status = 'running'
      nextSecondsLeft = active.targetEndTime
        ? Math.max(0, Math.ceil((active.targetEndTime - Date.now()) / 1000))
        : 0
    } else if (active?.status === 'paused') {
      status = 'paused'
      nextSecondsLeft = active.remainingAtPause ?? 0
    } else {
      nextSecondsLeft = total
    }
    return {
      status,
      secondsLeft: nextSecondsLeft,
      elapsedSeconds: Math.max(0, total - nextSecondsLeft),
      minutes: safeMinutes,
      taskId: active?.taskId ?? modalTask?.id ?? null,
      taskTitle: active?.taskTitle ?? modalTask?.title ?? null,
      alsoCheckIn: active?.alsoCheckIn ?? alsoCheckIn,
    }
    // tick 驱动 running 状态每秒重算剩余时间
  }, [done, active, minutes, alsoCheckIn, modalTask, tick])

  const value: FocusContextValue = {
    focus,
    done,
    modalOpen,
    modalTaskTitle: modalTask?.title ?? focus.taskTitle,
    minutes: focus.minutes,
    alsoCheckIn: focus.alsoCheckIn,
    setPresetMinutes,
    setAlsoCheckIn: setAlsoCheckInValue,
    openModal,
    closeModal,
    start,
    pause,
    resume,
    reset,
    completeEarly,
    acknowledgeDone,
  }

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
}

/** 未在 Provider 内使用时抛错。Provider 包裹整棵应用树，正常使用中不会返回 null */
export function useFocus(): FocusContextValue {
  const v = useContext(FocusContext)
  if (v === undefined || v === null) throw new Error('useFocus 必须在 FocusProvider 内使用')
  return v
}
