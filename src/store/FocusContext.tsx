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

interface PersistedFocus {
  status: 'running' | 'paused'
  minutes: number
  /** running 时的挂钟目标结束时间 */
  targetEndTime: number | null
  /** paused 时的剩余秒数 */
  remainingAtPause: number | null
  taskId: string | null
  taskTitle: string | null
  alsoCheckIn: boolean
}

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
    (opts: { auto: boolean; viaRecovery?: boolean; session?: PersistedFocus }) => {
      if (settledRef.current) return
      const a = opts.session ?? activeRef.current
      if (!a || !ctx) return
      settledRef.current = true
      hapticSuccess()
      burstAt(window.innerWidth / 2, window.innerHeight / 2)
      // 原生端到点通知已由系统按预约时间发出；网页端在归零瞬间补发
      if (
        !Capacitor.isNativePlatform() &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification('🍅 专注时间到！', {
            body: a.taskTitle
              ? `「${a.taskTitle}」已完成 ${a.minutes} 分钟专注 ✨`
              : `已完成 ${a.minutes} 分钟静心专注 ✨`,
          })
        } catch {
          /* ignore */
        }
      }
      void ctx.addFocusSession({
        taskId: a.taskId ?? undefined,
        taskTitle: a.taskTitle ?? '自由专注',
        minutes: a.minutes,
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
      setActive(null)
      void cancelNative()
      setMinutes(a.minutes)
      setDone({ minutes: a.minutes, taskId: a.taskId, taskTitle: a.taskTitle, auto: opts.auto })
      ctx.notify(
        opts.viaRecovery
          ? `你在离开期间完成了一次 ${a.minutes} 分钟专注，已自动记录 🍅`
          : `🎉 达成 ${a.minutes} 分钟静心专注！为你点赞 ✨`,
      )
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

  // 启动恢复：App 被杀后按持久化状态恢复倒计时或补结算（P1-4）
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
      const p = JSON.parse(raw) as PersistedFocus
      if (p.status === 'running' && typeof p.targetEndTime === 'number' && p.targetEndTime > 0) {
        if (p.targetEndTime > Date.now() + 1000) {
          activeRef.current = p
          setActive(p)
          setMinutes(p.minutes)
          setSecondsLeft(Math.ceil((p.targetEndTime - Date.now()) / 1000))
          void scheduleNative(p.targetEndTime, p.taskTitle, p.minutes)
          ctx.notify(`🍅 已恢复专注计时，剩余 ${Math.ceil((p.targetEndTime - Date.now()) / 60000)} 分钟`)
        } else {
          settle({ auto: true, viaRecovery: true, session: p })
        }
        return
      }
      if (p.status === 'paused') {
        activeRef.current = p
        setActive(p)
        setMinutes(p.minutes)
        setSecondsLeft(p.remainingAtPause ?? p.minutes * 60)
      }
    } catch {
      /* 持久化数据损坏时按空白处理 */
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
    const next: PersistedFocus = {
      status: 'running',
      minutes,
      targetEndTime: Date.now() + minutes * 60_000,
      remainingAtPause: null,
      taskId: modalTask?.id ?? null,
      taskTitle: modalTask?.title ?? null,
      alsoCheckIn,
    }
    activeRef.current = next
    setActive(next)
    setSecondsLeft(minutes * 60)
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
    const base = a.remainingAtPause ?? a.minutes * 60
    if (base <= 0) return
    const next: PersistedFocus = {
      ...a,
      status: 'running',
      targetEndTime: Date.now() + base * 1000,
      remainingAtPause: null,
    }
    activeRef.current = next
    setActive(next)
    persist(next)
    const target = next.targetEndTime as number
    void scheduleNative(target, next.taskTitle, next.minutes)
  }, [])

  const reset = useCallback(() => {
    activeRef.current = null
    setActive(null)
    setSecondsLeft(minutes * 60)
    persist(null)
    void cancelNative()
    settledRef.current = false
  }, [minutes])

  const completeEarly = useCallback(async () => {
    const a = activeRef.current
    if (!a || !ctx) return false
    const total = a.minutes * 60
    const elapsed =
      a.status === 'running' && a.targetEndTime
        ? total - Math.max(0, Math.ceil((a.targetEndTime - Date.now()) / 1000))
        : total - (a.remainingAtPause ?? 0)
    const elapsedMin = Math.max(1, Math.round(elapsed / 60))
    const ok = await ctx.addFocusSession({
      taskId: a.taskId ?? undefined,
      taskTitle: a.taskTitle ?? '自由专注',
      minutes: elapsedMin,
      date: ctx.today,
    })
    if (!ok) return false
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
    setMinutes(a.minutes)
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
    setMinutes(m)
    setSecondsLeft(m * 60)
  }, [])

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
    const total = minutes * 60
    let status: FocusStatus = 'idle'
    let secondsLeft: number
    if (done) {
      status = 'done'
      secondsLeft = 0
    } else if (active?.status === 'running') {
      status = 'running'
      secondsLeft = active.targetEndTime
        ? Math.max(0, Math.ceil((active.targetEndTime - Date.now()) / 1000))
        : 0
    } else if (active?.status === 'paused') {
      status = 'paused'
      secondsLeft = active.remainingAtPause ?? 0
    } else {
      secondsLeft = total
    }
    return {
      status,
      secondsLeft,
      elapsedSeconds: Math.max(0, total - secondsLeft),
      minutes,
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
    minutes,
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
