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
 * - 支持绑定具体任务或自由专注
 * - 运行中点关闭会触发二次确认（防误触丢失进度），支持后台继续计时
 * - 计时归零时即使弹窗已关闭也会发送本地通知与应用内提醒
 */
export function FocusModal({ open, task, onClose, onCompleted, onStateChange }: FocusModalProps) {
  const ctx = useData()
  const [minutes, setMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [alsoCheckIn, setAlsoCheckIn] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const activeTaskRef = useRef<Task | null>(task)
  const prevTaskIdRef = useRef<string | undefined>(task?.id)

  // 仅在未运行且切换了目标任务时重置计时器；若正在运行中再次打开弹窗，保留当前倒计时进度
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
        setAlsoCheckIn(true)
      }
    }
  }, [open, task, running, secondsLeft, minutes])

  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange

  // 同步运行状态给父组件（用于今日页入口红点与倒计时展示）
  useEffect(() => {
    onStateChangeRef.current?.({
      running,
      secondsLeft,
      minutes,
      taskTitle: (activeTaskRef.current ?? task)?.title,
    })
  }, [running, secondsLeft, minutes, task])

  // 后台可持续运行的倒计时器（不因 open=false 而中断）
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id)
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  // 倒计时自然归零时的自动通知与完成结算
  const handledZeroRef = useRef(false)
  useEffect(() => {
    if (secondsLeft === 0 && !handledZeroRef.current && ctx) {
      handledZeroRef.current = true
      const currentTask = activeTaskRef.current ?? task
      hapticSuccess()
      void fireFocusDoneNotification(currentTask?.title, minutes)
      if (!open) {
        ctx.notify(`🍅 ${minutes} 分钟专注已完成！点开「番茄专注」可查看记录 ✨`)
        void ctx.addFocusSession({
          taskId: currentTask?.id,
          taskTitle: currentTask?.title ?? '自由专注',
          minutes,
          date: ctx.today,
        })
      } else {
        ctx.notify(`🎉 ${minutes} 分钟专注时间到！太棒啦`)
      }
    } else if (secondsLeft > 0) {
      handledZeroRef.current = false
    }
  }, [secondsLeft, open, minutes, task, ctx])

  if (!ctx) return null
  const { addFocusSession, toggleCheckIn, data, today, notify } = ctx

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
    setConfirmExit(false)
  }

  const requestClose = () => {
    if (running && secondsLeft > 0) {
      setConfirmExit(true)
      return
    }
    setConfirmExit(false)
    onClose()
  }

  const abandonAndClose = () => {
    setRunning(false)
    setSecondsLeft(minutes * 60)
    setConfirmExit(false)
    onClose()
    notify('已结束本次专注，随时可以重新开始 🌱')
  }

  const keepInBackgroundAndClose = () => {
    setConfirmExit(false)
    onClose()
    notify('🍅 专注已在后台继续计时，到点会提醒你')
  }

  const startOrToggle = async () => {
    if (!running && secondsLeft === totalSeconds) {
      activeTaskRef.current = task
      prevTaskIdRef.current = task?.id
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          /* ignore */
        }
      }
    }
    setConfirmExit(false)
    setRunning((r) => !r)
  }

  const handleComplete = async () => {
    if (saving) return
    setSaving(true)
    try {
      const elapsedMinutes =
        secondsLeft === 0
          ? minutes
          : Math.max(1, Math.round((totalSeconds - secondsLeft) / 60) || minutes)
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
      setSecondsLeft(minutes * 60)
      setConfirmExit(false)
      burstAt(window.innerWidth / 2, window.innerHeight / 2)
      hapticTap()
      notify(`已完成 ${elapsedMinutes} 分钟专注 🍅`)
      onCompleted?.(currentTask, elapsedMinutes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={requestClose} closeOnBackdrop={!running}>
      <div className="text-center">
        <p className="text-xs font-medium text-orange-500">🍅 番茄专注空间</p>
        <h3 className="mt-1 text-[18px] font-bold text-slate-800">
          {currentTask ? `专注：${currentTask.title}` : '静心自由专注'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {running ? '放下杂念，只做眼前这一件小事…' : '万事开头难，先专注几分钟就是胜利'}
        </p>
      </div>

      {/* 时长档位选择 */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {PRESET_MINUTES.map((p) => {
          const active = minutes === p.min
          return (
            <button
              key={p.min}
              type="button"
              disabled={running}
              onClick={() => selectPreset(p.min)}
              className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium transition duration-150 ${
                active
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-orange-50/80 text-slate-600 hover:bg-orange-100/70 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* 居中倒计时圆环 */}
      <div className="my-5 flex justify-center">
        <ProgressRing progress={running || secondsLeft < totalSeconds ? elapsedRatio : 1} size={164} stroke={12}>
          <span className="font-mono text-3xl font-bold tracking-tight text-slate-800 tabular-nums">
            {mm}:{ss}
          </span>
          <span className="mt-1 text-xs text-slate-500">
            {secondsLeft === 0 ? '时间到 🎉' : running ? '专注进行中' : '准备就绪'}
          </span>
        </ProgressRing>
      </div>

      {/* 运行中点关闭时的二次确认防丢进度提示框 */}
      {confirmExit && (
        <div
          role="alert"
          className="anim-fade-in mb-4 rounded-2xl border border-amber-200 bg-amber-50/95 p-3.5 text-left dark:border-amber-800/70 dark:bg-slate-800"
        >
          <p className="text-[14px] font-semibold text-slate-800">专注还在进行中 🍅</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
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

      {currentTask && !isAlreadyCheckedToday && (
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
                setConfirmExit(false)
              }}
              className="min-h-[44px] shrink-0 rounded-2xl bg-orange-50 px-4 py-2.5 text-xs font-medium text-orange-600 dark:bg-slate-800 dark:text-orange-400"
            >
              重置
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleComplete()}
          className="min-h-[44px] w-full rounded-2xl border border-orange-200/80 bg-orange-50/70 py-2.5 text-xs font-semibold text-orange-600 transition duration-150 hover:bg-orange-100/80 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800/80 dark:text-orange-400"
        >
          {saving ? '记录中…' : `✨ 完成本次专注并记入统计（+${minutes} 分钟）`}
        </button>
      </div>
    </Modal>
  )
}
