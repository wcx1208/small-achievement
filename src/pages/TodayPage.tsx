import { useState } from 'react'
import type { MouseEvent } from 'react'
import type { Task, ThemeMode } from '../data/types'
import { MOOD_OPTIONS } from '../data/presets'
import { useData } from '../store/DataContext'
import { focusSummary, getGrowthLevel, getStreak, getTodayStatus } from '../lib/stats'
import { formatDateCN, greeting, weekdayCN } from '../lib/date'
import { hapticTap } from '../lib/haptics'
import { ProgressRing } from '../components/ProgressRing'
import { WeeklyOverview } from '../components/WeeklyOverview'
import { QuickAdd, TaskList } from '../features/tasks/TaskList'
import { MoodModal } from '../features/mood/MoodModal'
import { MoodSection } from '../features/mood/MoodSection'
import { DailyQuote } from '../features/rewards/DailyQuote'
import { FocusModal } from '../features/focus/FocusModal'
import type { FocusRunningState } from '../features/focus/FocusModal'
import { burstAt } from '../features/rewards/celebrate'

const THEME_BADGE: Record<ThemeMode, { icon: string; label: string }> = {
  auto: { icon: '🌓', label: '自动' },
  light: { icon: '☀️', label: '浅色' },
  dark: { icon: '🌙', label: '深色' },
}

/**
 * 今日页（渐变毛玻璃 & 清晰信息层级版）：
 * 1. 顶部身份栏：日期问候 + 渐变毛玻璃等级能量徽标 + 三态主题快捷切换胶囊
 * 2. 最大视觉焦点（.glass-hero）：进度环 + 连胜看板 + 专注（带运行红点）/日记/便签毛玻璃快捷入口
 * 3. 核心行动区：待完成/已完成打卡清单（Finch 质感卡片） + 快速添加
 * 4. 回溯与情绪区：周视图横滑补打卡 + 心情速记 + 情绪手账流
 * 5. 页面最底部区域：水光渐变毛玻璃「💧 元气饮水站」（.glass-water） + 每日一签彩蛋
 */
export function TodayPage({
  showQuote,
  onOpenDiary,
  onOpenNotes,
  focusTrigger,
  onFocusRunningChange,
  onCycleTheme,
  themeMode = 'auto',
}: {
  showQuote: (kind: 'task' | 'mood') => void
  onOpenDiary: () => void
  onOpenNotes: () => void
  focusTrigger?: number
  onFocusRunningChange?: (running: boolean) => void
  onCycleTheme?: () => void
  themeMode?: ThemeMode
}) {
  const ctx = useData()
  const [checkin, setCheckin] = useState<Task | null>(null)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [preselectedMoodIdx, setPreselectedMoodIdx] = useState<number | null>(null)
  const [focusTask, setFocusTask] = useState<Task | null>(null)
  const [focusOpen, setFocusOpen] = useState(false)
  const [lastTrigger, setLastTrigger] = useState(focusTrigger ?? 0)
  const [focusState, setFocusState] = useState<FocusRunningState>({
    running: false,
    secondsLeft: 25 * 60,
    minutes: 25,
  })
  const [waterBounceKey, setWaterBounceKey] = useState(0)
  const [lastTappedCup, setLastTappedCup] = useState<number | null>(null)

  if (focusTrigger && focusTrigger !== lastTrigger) {
    setLastTrigger(focusTrigger)
    setFocusTask(null)
    setFocusOpen(true)
  }

  if (!ctx) return null
  const { data, addMoodLog, setWaterCups, today, selectedDate, notify } = ctx

  const activeDate = selectedDate || today
  const status = getTodayStatus(data.tasks, data.checkIns, activeDate)
  const streak = getStreak(data.checkIns, today)
  const focus = focusSummary(data.focusSessions ?? [], activeDate)
  const growth = getGrowthLevel(data, today)
  const waterCups = (data.waterLogs ?? {})[activeDate] ?? 0
  const waterPct = Math.min(100, Math.round((waterCups / 8) * 100))
  const todayMood = data.moodLogs.find((m) => m.date === activeDate)
  const hasHistory = data.checkIns.length > 0

  const heroText =
    status.total === 0
      ? '今天还没有安排小事，从最轻松的一件开始吧 🌱'
      : status.completed === status.total
        ? `${activeDate === today ? '今天' : formatDateCN(activeDate)}的小事全部完成，为你鼓掌 🎉`
        : streak === 0 && hasHistory
          ? '偶尔断签一天也没关系，今天重新出发就很棒 🌱'
          : streak > 0
            ? `再完成 ${status.total - status.completed} 件，${activeDate === today ? '今天' : '这一天'}就圆满啦`
            : '从眼前的一件小事开始，攒下第一个连胜 💪'

  const handleDrinkWater = async (nextCups: number, cupIdx?: number, e?: MouseEvent<HTMLButtonElement>) => {
    const clamped = Math.max(0, Math.min(12, nextCups))
    const ok = await setWaterCups(clamped, activeDate)
    if (ok) {
      hapticTap()
      setWaterBounceKey((k) => k + 1)
      if (cupIdx !== undefined) {
        setLastTappedCup(cupIdx)
        window.setTimeout(() => setLastTappedCup((c) => (c === cupIdx ? null : c)), 320)
      }
      if (clamped === 8 && waterCups < 8) {
        const rect = e?.currentTarget.getBoundingClientRect()
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
        const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
        burstAt(x, y)
        notify('🎉 今日 8 杯水目标达成！身体元气满满 💧')
      }
    }
  }

  const focusMm = String(Math.floor(focusState.secondsLeft / 60)).padStart(2, '0')
  const focusSs = String(focusState.secondsLeft % 60).padStart(2, '0')
  const themeBadge = THEME_BADGE[themeMode]

  return (
    <div className="stagger-list space-y-4">
      {/* 顶部紧凑身份栏：问候语 + 渐变毛玻璃等级能量徽标 + 三态主题快捷胶囊 */}
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 tabular-nums">
            {formatDateCN(today)} · 星期{weekdayCN(today)}
          </p>
          <h1 className="mt-0.5 text-[20px] font-bold tracking-tight text-slate-800">
            {greeting()} 👋
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* 能量条浓缩为渐变毛玻璃小型徽标 */}
          <div
            aria-label={`当前等级 Lv.${growth.level} ${growth.title}，能量 ${growth.totalXP}`}
            className="glass-pill inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-700 tabular-nums"
          >
            <span className="text-base leading-none">{growth.icon}</span>
            <span>Lv.{growth.level} {growth.title}</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-bold text-orange-500">⚡{growth.totalXP}</span>
          </div>

          {/* 移动端一键切换 浅色 / 深色 / 跟随系统 三态主题 */}
          {onCycleTheme && (
            <button
              type="button"
              onClick={onCycleTheme}
              aria-label={`切换主题（当前：${themeBadge.label}）`}
              title={`当前主题：${themeBadge.label}（点按切换 浅色/深色/跟随系统）`}
              className="glass-pill flex h-11 w-11 items-center justify-center rounded-2xl text-base active:scale-90 lg:hidden"
            >
              {themeBadge.icon}
            </button>
          )}
        </div>
      </header>

      {/* 主体网格：移动端单列直达，桌面端双栏 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* 左栏（首屏核心行动区）：进度环+连胜主看板 → 今日打卡列表 → 快速添加 */}
        <div className="stagger-list space-y-4 lg:col-span-7">
          {/* 视觉焦点 1：暖光渐变毛玻璃进度环 + 连胜核心看板 (.glass-hero) */}
          <section className="glass-hero">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-orange-400/20 blur-2xl dark:bg-orange-500/15"
            />
            <div className="relative flex items-center gap-4">
              <ProgressRing
                progress={status.total ? status.completed / status.total : 0}
                size={96}
                stroke={10}
              >
                <span className="text-[18px] font-bold leading-none text-slate-800 tabular-nums">
                  {status.completed}
                  <span className="text-xs font-normal text-slate-400">/{status.total}</span>
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  {activeDate === today ? '今日进度' : formatDateCN(activeDate)}
                </span>
              </ProgressRing>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <p className="flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-2xl leading-none">🔥</span>
                    <span className="text-2xl font-extrabold text-orange-500">{streak}</span>
                    <span className="text-xs font-semibold text-slate-600">天连胜</span>
                  </p>
                  <span className="rounded-full bg-orange-500/12 px-2.5 py-0.5 text-xs font-semibold text-orange-600 tabular-nums dark:bg-orange-400/15 dark:text-orange-300">
                    完成率 {status.total ? Math.round((status.completed / status.total) * 100) : 0}%
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{heroText}</p>
              </div>
            </div>

            {/* 看板底部三大高频毛玻璃子卡（番茄专注带运行中红点提示） */}
            <div className="relative mt-4 grid grid-cols-3 gap-2.5 border-t border-white/50 pt-3.5 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setFocusTask(null)
                  setFocusOpen(true)
                }}
                className="glass-subcard relative flex min-h-[50px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center hover:border-orange-300 active:scale-95"
              >
                {focusState.running && (
                  <span
                    aria-label="专注进行中"
                    className="absolute right-2.5 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"
                  />
                )}
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap tabular-nums">
                  🍅 {focusState.running ? `${focusMm}:${focusSs}` : '番茄专注'}
                </span>
                <span className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  {focusState.running ? '计时进行中' : `今日 ${focus.todayMinutes}m`}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenDiary}
                className="glass-subcard flex min-h-[50px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center hover:border-orange-300 active:scale-95"
              >
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">📖 岁月日记</span>
                <span className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  {data.diaries.length} 篇记录
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenNotes}
                className="glass-subcard flex min-h-[50px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center hover:border-orange-300 active:scale-95"
              >
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">🗒️ 灵感便签</span>
                <span className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  {data.notes.length} 张便签
                </span>
              </button>
            </div>
          </section>

          {/* 视觉焦点 2：待完成 / 已完成打卡清单 */}
          <div id="today-task-list-section" className="scroll-mt-20">
            <TaskList
              onChecked={(task, isRetroactive) => {
                if (isRetroactive) {
                  showQuote('task')
                } else {
                  setCheckin(task)
                }
              }}
              onStartFocus={(task) => {
                setFocusTask(task)
                setFocusOpen(true)
              }}
            />
          </div>

          {/* 视觉焦点 3：快速添加新习惯 */}
          <QuickAdd />
        </div>

        {/* 右栏（次级回溯与陪伴区）：周视图横滑补打卡 → 心情速记 → 情绪手账流 */}
        <div className="stagger-list space-y-4 lg:col-span-5">
          {/* 周视图横滑日历（查看过去几天或补打卡） */}
          <WeeklyOverview
            onJumpToTasks={() => {
              document
                .getElementById('today-task-list-section')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            onOpenMood={() => {
              setPreselectedMoodIdx(null)
              setDiaryOpen(true)
            }}
            onOpenDiary={onOpenDiary}
          />

          {/* 心情速记毛玻璃卡 */}
          <section className="card" aria-label="心情速记">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-slate-800">🌤 心情速记</h2>
              <span className="text-xs font-medium text-orange-500">点选表情即记</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">接纳当下的每一种小情绪</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map((m, i) => (
                <button
                  key={m.emoji}
                  type="button"
                  onClick={() => {
                    setPreselectedMoodIdx(i)
                    setDiaryOpen(true)
                  }}
                  aria-label={`快速记录心情：${m.label}`}
                  className="glass-subcard flex min-h-[54px] flex-col items-center justify-center rounded-2xl py-2 transition duration-150 hover:border-orange-300 active:scale-90"
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <span className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setPreselectedMoodIdx(null)
                setDiaryOpen(true)
              }}
              className="glass-subcard mt-3 flex min-h-[44px] w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs text-slate-600 transition duration-150 hover:border-orange-300 dark:text-slate-300"
            >
              <span className="truncate">
                {todayMood
                  ? `今日心情：${todayMood.emoji} ${todayMood.text || todayMood.tags.join('·') || '已记录'}`
                  : '今天还没记心情，点此写一句'}
              </span>
              <span className="ml-2 shrink-0 font-semibold text-orange-500">去记录 ›</span>
            </button>
          </section>

          {/* 情绪手账时间流 */}
          <MoodSection
            onWrite={() => {
              setPreselectedMoodIdx(null)
              setDiaryOpen(true)
            }}
          />
        </div>
      </div>

      {/* 页面最下方专属：水光蓝渐变毛玻璃「💧 元气饮水站」 */}
      <section className="glass-water" aria-label="元气饮水站">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl dark:bg-sky-500/15"
        />
        <div className="relative flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold text-slate-800">💧 元气饮水站</h2>
          <div
            key={waterBounceKey}
            className="anim-water-pop rounded-2xl border border-sky-200/80 bg-white/75 px-3 py-1 text-xs font-extrabold text-sky-600 backdrop-blur-xs tabular-nums dark:border-sky-800/60 dark:bg-slate-900/70 dark:text-sky-300"
          >
            {waterCups}/8 杯 · {waterCups * 250}ml
          </div>
        </div>
        <p className="relative mt-1 text-xs text-slate-500">
          每天 8 杯温水（2000ml），点按水滴即记 ✨
        </p>

        {/* 水光流线进度条 */}
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-sky-200/55 dark:bg-slate-800/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400 transition-all duration-300"
            style={{ width: `${waterPct}%` }}
          />
        </div>

        {/* 8 颗毛玻璃水滴热区（≥44×44px，带弹跳反馈） */}
        <div className="relative mt-3.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => {
            const filled = i < waterCups
            const isBouncing = lastTappedCup === i
            return (
              <button
                key={i}
                type="button"
                onClick={(e) =>
                  void handleDrinkWater(filled && waterCups === i + 1 ? i : i + 1, i, e)
                }
                aria-label={`第 ${i + 1} 杯水`}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-2xl text-base transition duration-150 active:scale-90 ${
                  isBouncing ? 'anim-water-pop' : ''
                } ${
                  filled
                    ? 'bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-xs'
                    : 'border border-sky-200/70 bg-white/65 text-sky-400 hover:bg-white/90 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-400'
                }`}
              >
                <span className="text-base leading-none">💧</span>
                <span className={`mt-0.5 text-[10px] font-semibold tabular-nums ${filled ? 'text-white/95' : 'text-slate-400'}`}>
                  {i + 1}杯
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative mt-3 flex gap-2">
          {waterCups > 0 && (
            <button
              type="button"
              onClick={(e) => void handleDrinkWater(waterCups - 1, waterCups - 1, e)}
              aria-label="减少一杯水"
              className="min-h-[44px] shrink-0 rounded-2xl border border-sky-200/80 bg-white/70 px-4 py-2.5 text-xs font-semibold text-slate-600 transition duration-150 hover:bg-white active:scale-95 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
            >
              -1 杯
            </button>
          )}
          <button
            type="button"
            onClick={(e) => void handleDrinkWater(Math.min(12, waterCups + 1), waterCups, e)}
            className="min-h-[44px] flex-1 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 py-2.5 text-xs font-semibold text-white shadow-xs transition duration-150 hover:from-sky-600 hover:to-cyan-600 active:scale-[0.98]"
          >
            + 喝一杯温水（+250ml · 当前 {waterCups} 杯）
          </button>
        </div>
      </section>

      {/* 页面底部彩蛋：每日一签 */}
      <DailyQuote />

      <p className="pb-2 text-center text-xs text-slate-400">
        小成就 · 记录每一件小事，攒起看得见的成就感 ✨
      </p>

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

      {/* 主动写心情日记（支持预选表情与补记历史日期） */}
      <MoodModal
        open={diaryOpen}
        mode="diary"
        initialIdx={preselectedMoodIdx}
        onClose={() => setDiaryOpen(false)}
        onSubmit={async (input) => {
          const ok = await addMoodLog(input)
          if (!ok) return false
          setDiaryOpen(false)
          showQuote('mood')
          return true
        }}
      />

      {/* 番茄专注弹窗（支持后台持续计时与防误触二次确认） */}
      <FocusModal
        open={focusOpen}
        task={focusTask}
        onClose={() => setFocusOpen(false)}
        onCompleted={() => showQuote('task')}
        onStateChange={(st) => {
          setFocusState(st)
          onFocusRunningChange?.(st.running)
        }}
      />
    </div>
  )
}
