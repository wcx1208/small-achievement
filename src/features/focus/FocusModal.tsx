import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Task } from '../../data/types'
import { Modal } from '../../components/Modal'
import { ProgressRing } from '../../components/ProgressRing'
import { useData } from '../../store/DataContext'
import { burstAt } from '../rewards/celebrate'
import { hapticSuccess, hapticTap } from '../../lib/haptics'

const PRESET_MINUTES = [
  { min: 5, label: '5 分钟 · 破冰起步' },
  { min: 15, label: '15 分钟 · 轻量专注' },
  { min: 25, label: '25 分钟 · 标准番茄' },
  { min: 45, label: '45 分钟 · 深度心流' },
]

const FOCUS_DONE_NOTIFICATION_ID = 2002

async function fireFocusDoneNotification(taskTitle?: string, minutes?: number) {
  const title = '🍅 专注时间到！'
  const body = taskTitle
    ? `「${taskTitle}」已完成 ${minutes ?? 25} 分钟专注，给自己鼓个掌吧 ✨`
    : `已完成 ${minutes ?? 25} 分钟静心专注，休息一下眼睛吧 ✨`
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions()
      if (perm.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: FOCUS_DONE_NOTIFICATION_ID,
              title,
              body,
              schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true },
            },
          ],
        })
        return
      }
    }
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    /* 通知权限未开时静默降级至应用内横幅 */
  }
}

export interface FocusRunningState {
  running: boolean
  secondsLeft: number
  minutes: number
  taskTitle?: string
}

interface FocusModalProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onCompleted?: (task: Task | null, minutes: number) => void
  onStateChange?: (state: FocusRunningState) => void
}

/**
 * 番茄专注计时器：
 * - 基于挂钟时间戳（targetEndTime）差值计算，彻底杜绝锁屏/切后台导致的定时器冻结与漂移
 * - 页面可见性恢复（visibilitychange）时立刻精确校准
 * - 倒计时归零自动结算落库与联动打卡，避免遗漏
 */
export function FocusModal({ open, task, onClose, onCompleted, onStateChange }: FocusModalProps) {
  const ctx = useData()
  const [minutes, setMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [alsoCheckIn, setAlsoCheckIn] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [isDoneCelebrated, setIsDoneCelebrated] = useState(false)

  const activeTaskRef = useRef<Task | null>(task)
  const prevTaskIdRef = useRef<string | undefined>(task?.id)
  const targetEndTimeRef = useRef<number | null>(null)
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted
  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange

  // 切换任务时重置，未运行时保持同步
  useEffect(() => {
    if (open) {
      setConfirmExit(false)
      if (!running && secondsLeft === minutes * 60) {
        activeTaskRef.current = task
        prevTaskIdRef.current = task?.id
      } else if (!running && task?.id !== prevTaskIdRef.current) {
        activeTaskRef.current = task
        prevTaskIdRef.current = task?.id
        setMinutes(25)
        setSecondsLeft(25 * 60)
        targetEndTimeRef.current = null
        setAlsoCheckIn(true)
        setIsDoneCelebrated(false)
      }
    }
  }, [open, task, running, secondsLeft, minutes])

  // 同步运行状态给父级组件（用于首页入口红点与倒计时显示）
  useEffect(() => {
    onStateChangeRef.current?.({
      running,
      secondsLeft,
      minutes,
      taskTitle: (activeTaskRef.current ?? task)?.title,
    })
  }, [running, secondsLeft, minutes, task])

  // 基于时间戳差值的定时器，杜绝锁屏与后台节流漂移
  useEffect(() => {
    if (!running) return

    const tick = () => {
      if (!targetEndTimeRef.current) return
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        setRunning(false)
        targetEndTimeRef.current = null
      }
    }

    const intervalId = window.setInterval(tick, 500)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [running])

  // 倒计时自然归零时的自动结算与通知
  const handledZeroRef = useRef(false)
  useEffect(() => {
    if (secondsLeft === 0 && !handledZeroRef.current && ctx) {
      handledZeroRef.current = true
      setIsDoneCelebrated(true)
      const currentTask = activeTaskRef.current ?? task
      hapticSuccess()
      burstAt(window.innerWidth / 2, window.innerHeight / 2)
      void fireFocusDoneNotification(currentTask?.title, minutes)

      // 自动落库记录
      void ctx.addFocusSession({
        taskId: currentTask?.id,
        taskTitle: currentTask?.title ?? '自由专注',
        minutes,
        date: ctx.today,
      })

      // 联动任务打卡
      if (currentTask && alsoCheckIn) {
        const isAlreadyChecked = ctx.data.checkIns.some(
          (c) => c.taskId === currentTask.id && c.date === ctx.today
        )
        if (!isAlreadyChecked) {
          void ctx.toggleCheckIn(currentTask.id, ctx.today)
        }
      }

      ctx.notify(`🎉 达成 ${minutes} 分钟静心专注！为你点赞 ✨`)
      onCompletedRef.current?.(currentTask, minutes)
    } else if (secondsLeft > 0) {
      handledZeroRef.current = false
    }
  }, [secondsLeft, minutes, task, alsoCheckIn, ctx])

  if (!ctx) return null
  const { data, today, notify, addFocusSession, toggleCheckIn } = ctx

  const currentTask = activeTaskRef.current ?? task
  const totalSeconds = minutes * 60
  const elapsedRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  const isAlreadyCheckedToday = currentTask
    ? data.checkIns.some((c) => c.taskId === currentTask.id && c.date === today)
    : false

  const selectPreset = (m: number) => {
    setMinutes(m)
    setSecondsLeft(m * 60)
    setRunning(false)
    targetEndTimeRef.current = null
    setConfirmExit(false)
    setIsDoneCelebrated(false)
  }

  const requestClose = () => {
    if (running && secondsLeft > 0) {
      setConfirmExit(true)
      return
    }
    setConfirmExit(false)
    setIsDoneCelebrated(false)
    onClose()
  }

  const abandonAndClose = () => {
    setRunning(false)
    targetEndTimeRef.current = null
    setSecondsLeft(minutes * 60)
    setConfirmExit(false)
    setIsDoneCelebrated(false)
    onClose()
    notify('已结束本次专注，随时可以重新开始 🌱')
  }

  const keepInBackgroundAndClose = () => {
    setConfirmExit(false)
    onClose()
    notify('🍅 专注已在后台继续计时，到点会提醒你')
  }

  const startOrToggle = async () => {
    if (!running) {
      // 开启前请求通知权限
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          /* ignore */
        }
      }
      activeTaskRef.current = task
      prevTaskIdRef.current = task?.id
      targetEndTimeRef.current = Date.now() + secondsLeft * 1000
      setRunning(true)
      setIsDoneCelebrated(false)
      hapticTap()
    } else {
      // 暂停
      targetEndTimeRef.current = null
      setRunning(false)
      hapticTap()
    }
    setConfirmExit(false)
  }

  // 手动提前结算
  const handleManualComplete = async () => {
    if (saving) return
    setSaving(true)
    try {
      const elapsedMinutes =
        secondsLeft === 0
          ? minutes
          : Math.max(1, Math.round((totalSeconds - secondsLeft) / 60))
      const ok = await addFocusSession({
        taskId: currentTask?.id,
        taskTitle: currentTask?.title ?? '自由专注',
        minutes: elapsedMinutes,
        date: today,
      })
      if (!ok) return
      if (currentTask && alsoCheckIn && !isAlreadyCheckedToday) {
        await toggleCheckIn(currentTask.id, today)
      }
      setRunning(false)
      targetEndTimeRef.current = null
      setSecondsLeft(minutes * 60)
      setConfirmExit(false)
      setIsDoneCelebrated(false)
      burstAt(window.innerWidth / 2, window.innerHeight / 2)
      hapticSuccess()
      notify(`已完成 ${elapsedMinutes} 分钟专注 🍅`)
      onCompletedRef.current?.(currentTask, elapsedMinutes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={requestClose} closeOnBackdrop={!running}>
      <div className="text-center">
        <p className="text-xs font-semibold text-orange-500">🍅 番茄专注空间</p>
        <h3 className="mt-1 text-[18px] font-bold text-slate-800">
          {currentTask ? `专注：${currentTask.title}` : '静心自由专注'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {isDoneCelebrated
            ? '本次专注圆满达成，每一份沉浸都值得被看见 ✨'
            : running
              ? '放下杂念，只做眼前这一件小事…'
              : '万事开头难，先专注几分钟就是胜利 🌱'}
        </p>
      </div>

      {/* 预设档位（仅在未运行时可选） */}
      {!isDoneCelebrated && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PRESET_MINUTES.map((p) => {
            const active = minutes === p.min
            return (
              <button
                key={p.min}
                type="button"
                disabled={running}
                onClick={() => selectPreset(p.min)}
                className={`min-h-[44px] rounded-2xl px-3 py-2 text-xs font-medium transition duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                    : 'bg-orange-50/80 text-slate-600 hover:bg-orange-100/70 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 居中倒计时圆环与完成仪式感 */}
      <div className="my-5 flex justify-center">
        <ProgressRing
          progress={isDoneCelebrated ? 1 : running || secondsLeft < totalSeconds ? elapsedRatio : 1}
          size={168}
          stroke={12}
        >
          {isDoneCelebrated ? (
            <div className="anim-badge-pop text-center">
              <span className="text-3xl">🎉</span>
              <p className="mt-1 text-[16px] font-extrabold text-orange-500">圆满达成</p>
              <p className="text-[11px] text-slate-500">+{minutes} 分钟</p>
            </div>
          ) : (
            <>
              <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-800 tabular-nums">
                {mm}:{ss}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {secondsLeft === 0 ? '时间到 🎉' : running ? '专注进行中' : '准备就绪'}
              </span>
            </>
          )}
        </ProgressRing>
      </div>

      {/* 运行中关闭防误触提示 */}
      {confirmExit && (
        <div
          role="alert"
          className="anim-fade-in mb-4 rounded-2xl border border-amber-200 bg-amber-50/95 p-3.5 text-left dark:border-amber-800/70 dark:bg-slate-800"
        >
          <p className="text-[14px] font-semibold text-slate-800">专注还在进行中 🍅</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            你可以让它在后台继续倒计时（到点会提醒你），或者结束本次专注。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmExit(false)}
              className="min-h-[44px] flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs dark:bg-slate-700 dark:text-slate-100"
            >
              留在当前页
            </button>
            <button
              type="button"
              onClick={keepInBackgroundAndClose}
              className="min-h-[44px] flex-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-2xs"
            >
              后台继续计时
            </button>
            <button
              type="button"
              onClick={abandonAndClose}
              className="min-h-[44px] rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/60 dark:text-red-300"
            >
              放弃本次
            </button>
          </div>
        </div>
      )}

      {currentTask && !isAlreadyCheckedToday && !isDoneCelebrated && (
        <label className="mb-4 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={alsoCheckIn}
            onChange={(e) => setAlsoCheckIn(e.target.checked)}
            className="h-4 w-4 rounded accent-orange-500"
          />
          <span>完成专注时同时为「{currentTask.title}」打卡</span>
        </label>
      )}

      {/* 底部操作按钮 */}
      {isDoneCelebrated ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIsDoneCelebrated(false)
              setSecondsLeft(minutes * 60)
            }}
            className="min-h-[44px] flex-1 rounded-2xl bg-orange-50 px-4 py-2.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-100 dark:bg-slate-800 dark:text-orange-400"
          >
            再来一次
          </button>
          <button
            type="button"
            onClick={requestClose}
            className="btn-primary min-h-[44px] flex-1"
          >
            完成并关闭
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-4 py-2.5 text-[14px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {running ? '收起' : '关闭'}
            </button>
            {secondsLeft > 0 && (
              <button
                type="button"
                onClick={() => void startOrToggle()}
                className="btn-primary min-h-[44px] flex-1"
              >
                {running ? '⏸ 暂停' : secondsLeft < totalSeconds ? '▶️ 继续专注' : '▶️ 开始专注'}
              </button>
            )}
            {secondsLeft < totalSeconds && !running && (
              <button
                type="button"
                onClick={() => {
                  setSecondsLeft(totalSeconds)
                  targetEndTimeRef.current = null
                  setConfirmExit(false)
                }}
                className="min-h-[44px] shrink-0 rounded-2xl bg-orange-50 px-4 py-2.5 text-xs font-medium text-orange-600 dark:bg-slate-800 dark:text-orange-400"
              >
                重置
              </button>
            )}
          </div>

          {secondsLeft < totalSeconds && !running && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleManualComplete()}
              className="min-h-[44px] w-full rounded-2xl border border-orange-200/80 bg-orange-50/70 py-2.5 text-xs font-semibold text-orange-600 transition duration-150 hover:bg-orange-100/80 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800/80 dark:text-orange-400"
            >
              {saving ? '记录中…' : `提前结算本次专注（已完成 ${Math.max(1, Math.round((totalSeconds - secondsLeft) / 60))} 分钟）`}
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
