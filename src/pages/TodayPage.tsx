import { useState } from 'react'
import type { Task } from '../data/types'
import { useData } from '../store/DataContext'
import { getStreak, getTodayStatus } from '../lib/stats'
import { formatDateCN, greeting, weekdayCN } from '../lib/date'
import { ProgressRing } from '../components/ProgressRing'
import { QuickAdd, TaskList } from '../features/tasks/TaskList'
import { MoodModal } from '../features/mood/MoodModal'
import { MoodSection } from '../features/mood/MoodSection'
import { DailyQuote } from '../features/rewards/DailyQuote'

/** 今日页：问候 + 日记/便签显著入口 + 进度环/连胜 + 快速添加 + 任务分区 + 心情 */
export function TodayPage({
  showQuote,
  onOpenDiary,
  onOpenNotes,
}: {
  showQuote: (kind: 'task' | 'mood') => void
  onOpenDiary: () => void
  onOpenNotes: () => void
}) {
  const ctx = useData()
  if (!ctx) return null
  const { data, addMoodLog, today } = ctx
  const [checkin, setCheckin] = useState<Task | null>(null)
  const [diaryOpen, setDiaryOpen] = useState(false)

  const status = getTodayStatus(data.tasks, data.checkIns, today)
  const streak = getStreak(data.checkIns, today)
  const hasHistory = data.checkIns.length > 0

  // 顶部的一句状态文案：只在断签时使用温和表达，绝不指责
  const heroText =
    status.total === 0
      ? '添加一件今天想做的小事，开始第一个打卡吧 🌱'
      : status.completed === status.total
        ? '今天的任务全部完成，太棒了！🎉'
        : streak === 0 && hasHistory
          ? '上次断了一下下也没关系，今天重新出发就很棒 🌱'
          : streak > 0
            ? `再完成 ${status.total - status.completed} 件，今天就圆满啦`
            : '从一件小事开始，攒下属于你的第一个连胜 💪'

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs text-slate-400">
          {formatDateCN(today)} 星期{weekdayCN(today)}
        </p>
        <h1 className="mt-0.5 text-xl font-bold text-slate-800">{greeting()} 👋</h1>
      </header>

      {/* 日记 / 便签：放在页面最显眼的位置 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenDiary}
          className="rounded-3xl bg-gradient-to-br from-orange-400 to-amber-400 p-4 text-left text-white shadow-md shadow-orange-200 transition active:scale-[0.97]"
        >
          <span className="text-2xl">📖</span>
          <p className="mt-1 text-[15px] font-bold">写日记</p>
          <p className="text-[11px] text-white/85">把今天记下来 · {data.diaries.length} 篇</p>
        </button>
        <button
          onClick={onOpenNotes}
          className="rounded-3xl bg-gradient-to-br from-rose-400 to-pink-400 p-4 text-left text-white shadow-md shadow-rose-200 transition active:scale-[0.97]"
        >
          <span className="text-2xl">🗒️</span>
          <p className="mt-1 text-[15px] font-bold">便签</p>
          <p className="text-[11px] text-white/85">随手一记 · {data.notes.length} 张</p>
        </button>
      </div>

      {/* 每日一签 */}
      <DailyQuote />

      {/* 今日完成度进度环 + 连胜天数 */}
      <section className="card flex items-center gap-5">
        <ProgressRing progress={status.total ? status.completed / status.total : 0}>
          <span className="text-lg font-bold leading-none text-slate-800">
            {status.completed}
            <span className="text-xs font-normal text-slate-400">/{status.total}</span>
          </span>
          <span className="mt-1 text-[10px] text-slate-400">今日完成</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1">
            <span className="text-2xl">🔥</span>
            <span className="text-2xl font-bold text-orange-500">{streak}</span>
            <span className="text-sm text-slate-500">天连胜</span>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{heroText}</p>
        </div>
      </section>

      <QuickAdd />
      <TaskList onChecked={(task) => setCheckin(task)} />
      <MoodSection onWrite={() => setDiaryOpen(true)} />

      <p className="pb-2 text-center text-[11px] text-slate-400">小成就 · 记录每一件小事，攒起你的成就感 ✨</p>

      {/* 打卡成功后的心情引导 */}
      <MoodModal
        open={!!checkin}
        mode="checkin"
        taskTitle={checkin?.title}
        onClose={() => setCheckin(null)}
        onSkip={() => {
          setCheckin(null)
          showQuote('task')
        }}
        onSubmit={async (input) => {
          const task = checkin
          const ok = await addMoodLog({ ...input, relatedTaskId: task?.id })
          if (!ok) return false
          setCheckin(null)
          showQuote('mood')
          return true
        }}
      />

      {/* 主动写心情日记（支持补记历史日期） */}
      <MoodModal
        open={diaryOpen}
        mode="diary"
        onClose={() => setDiaryOpen(false)}
        onSubmit={async (input) => {
          const ok = await addMoodLog(input)
          if (!ok) return false
          setDiaryOpen(false)
          showQuote('mood')
          return true
        }}
      />
    </div>
  )
}
