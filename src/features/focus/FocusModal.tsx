import { useState } from 'react'
import { useData } from '../../store/DataContext'
import { useFocus } from '../../store/FocusContext'
import { Modal } from '../../components/Modal'
import { ProgressRing } from '../../components/ProgressRing'

const PRESET_MINUTES = [
  { min: 5, label: '5 分钟 · 破冰起步' },
  { min: 15, label: '15 分钟 · 轻量专注' },
  { min: 25, label: '25 分钟 · 标准番茄' },
  { min: 45, label: '45 分钟 · 深度心流' },
]

/** 番茄专注弹窗：纯展示与控制，全部计时 / 结算逻辑在 FocusContext（全局存活，切 Tab 不丢） */
export function FocusModal() {
  const dataCtx = useData()
  const {
    focus,
    done,
    modalOpen,
    minutes,
    alsoCheckIn,
    setPresetMinutes,
    setAlsoCheckIn,
    closeModal,
    start,
    pause,
    resume,
    reset,
    completeEarly,
    acknowledgeDone,
  } = useFocus()
  // 所有 Hooks 必须在 early return 之前调用（Opus/Neon 报告 P0 #2）
  const [confirmExit, setConfirmExit] = useState(false)
  if (!dataCtx) return null
  const { data } = dataCtx

  const status = focus.status
  const totalSeconds = minutes * 60
  const elapsedRatio = totalSeconds > 0 ? focus.elapsedSeconds / totalSeconds : 0
  const mm = String(Math.floor(focus.secondsLeft / 60)).padStart(2, '0')
  const ss = String(focus.secondsLeft % 60).padStart(2, '0')
  const isAlreadyCheckedToday = focus.taskId
    ? data.checkIns.some((c) => c.taskId === focus.taskId && c.date === dataCtx.today)
    : false

  /** 关闭请求：运行中先弹确认，防误触 */
  const requestClose = () => {
    if (status === 'running') {
      setConfirmExit(true)
      return
    }
    acknowledgeDone()
    closeModal()
  }

  const startOrToggle = () => {
    if (status === 'paused') void resume()
    else if (status === 'idle') void start()
  }

  return (
    <Modal open={modalOpen} onClose={requestClose} closeOnBackdrop={status !== 'running'}>
      <div className="text-center">
        <p className="text-xs font-semibold text-orange-500">🍅 番茄专注空间</p>
        <h3 className="mt-1 text-[18px] font-bold text-slate-800">
          {focus.taskTitle ? `专注：${focus.taskTitle}` : '静心自由专注'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {status === 'done'
            ? '本次专注圆满达成，每一份沉浸都值得被看见 ✨'
            : status === 'running'
              ? '放下杂念，只做眼前这一件小事…'
              : '万事开头难，先专注几分钟就是胜利 🌱'}
        </p>
      </div>

      {/* 预设档位（仅在空闲时可选） */}
      {status === 'idle' && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PRESET_MINUTES.map((p) => {
            const active = minutes === p.min
            return (
              <button
                key={p.min}
                type="button"
                onClick={() => setPresetMinutes(p.min)}
                className={`min-h-[44px] rounded-2xl px-3 py-2 text-xs font-medium transition duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                    : 'bg-orange-50/80 text-slate-600 hover:bg-orange-100/70 dark:bg-slate-800 dark:text-slate-200'
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
        <ProgressRing progress={status === 'done' ? 1 : status === 'idle' ? 1 : elapsedRatio} size={168} stroke={12}>
          {status === 'done' ? (
            <div className="anim-badge-pop text-center">
              <span className="text-3xl">🎉</span>
              <p className="mt-1 text-[16px] font-extrabold text-orange-500">圆满达成</p>
              <p className="text-[11px] text-slate-500">+{done?.minutes ?? minutes} 分钟</p>
            </div>
          ) : (
            <>
              <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-800 tabular-nums">
                {mm}:{ss}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {status === 'running' ? '专注进行中' : status === 'paused' ? '已暂停' : '准备就绪'}
              </span>
            </>
          )}
        </ProgressRing>
      </div>

      {/* 运行中关闭防误触提示 */}
      {confirmExit && status === 'running' && (
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
              onClick={() => {
                setConfirmExit(false)
                closeModal()
              }}
              className="min-h-[44px] flex-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-2xs"
            >
              后台继续计时
            </button>
            <button
              type="button"
              onClick={() => {
                reset()
                setConfirmExit(false)
                closeModal()
              }}
              className="min-h-[44px] rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/60 dark:text-red-300"
            >
              放弃本次
            </button>
          </div>
        </div>
      )}

      {focus.taskId && !isAlreadyCheckedToday && status !== 'done' && status !== 'running' && (
        <label className="mb-4 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={alsoCheckIn}
            onChange={(e) => setAlsoCheckIn(e.target.checked)}
            className="h-4 w-4 rounded accent-orange-500"
          />
          <span>完成专注时同时为「{focus.taskTitle}」打卡</span>
        </label>
      )}

      {/* 底部操作按钮（按状态切换） */}
      {status === 'done' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              acknowledgeDone()
              closeModal()
            }}
            className="min-h-[44px] flex-1 rounded-2xl bg-orange-50 px-4 py-2.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-100 dark:bg-slate-800 dark:text-orange-400"
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
              {status === 'running' ? '收起' : '关闭'}
            </button>
            {(status === 'idle' || status === 'paused') && (
              <button type="button" onClick={startOrToggle} className="btn-primary min-h-[44px] flex-1">
                {status === 'paused' ? '▶️ 继续专注' : '▶️ 开始专注'}
              </button>
            )}
            {status === 'running' && (
              <button type="button" onClick={pause} className="btn-primary min-h-[44px] flex-1">
                ⏸ 暂停
              </button>
            )}
            {status === 'paused' && (
              <button
                type="button"
                onClick={reset}
                className="min-h-[44px] shrink-0 rounded-2xl bg-orange-50 px-4 py-2.5 text-xs font-medium text-orange-600 dark:bg-slate-800 dark:text-orange-400"
              >
                重置
              </button>
            )}
          </div>

          {/* 提前结算：仅在暂停且有实际投入时出现；归零自动结算后绝不重复出现（P0-2） */}
          {status === 'paused' && focus.elapsedSeconds >= 60 && (
            <button
              type="button"
              onClick={() => void completeEarly().then((ok) => ok && closeModal())}
              className="min-h-[44px] w-full rounded-2xl border border-orange-200/80 bg-orange-50/70 py-2.5 text-xs font-semibold text-orange-600 transition duration-150 hover:bg-orange-100/80 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800/80 dark:text-orange-400"
            >
              提前结算本次专注（已完成 {Math.max(1, Math.round(focus.elapsedSeconds / 60))} 分钟）
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
