import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../store/DataContext'
import { formatDateCN, lastNDays, weekToDateDays } from '../lib/date'
import { getWeeklyOverview } from '../lib/stats'
import { hapticTap } from '../lib/haptics'

type RangeMode = '7d' | 'week' | '14d'

/**
 * 横向滚动周视图组件：
 * - 统一 p-5 内边距与字号体系，所有交互按钮 ≥ 44px 热区
 * - 点击任意日期卡片即可快速切换 activeDate，展开对应日记录速览，支持一键跳转补打卡
 */
export function WeeklyOverview({
  onJumpToTasks,
  onOpenMood,
  onOpenDiary,
}: {
  onJumpToTasks?: () => void
  onOpenMood?: () => void
  onOpenDiary?: () => void
}) {
  const ctx = useData()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [rangeMode, setRangeMode] = useState<RangeMode>('7d')

  if (!ctx) return null
  const { data, today, selectedDate, setSelectedDate } = ctx
  const activeDate = selectedDate || today

  const dayDates = useMemo(() => {
    if (rangeMode === 'week') {
      const wk = weekToDateDays(today)
      return wk.length >= 4 ? wk : lastNDays(7, today)
    }
    if (rangeMode === '14d') return lastNDays(14, today)
    return lastNDays(7, today)
  }, [rangeMode, today])

  const overview = useMemo(
    () => getWeeklyOverview(data, today, dayDates),
    [data, today, dayDates],
  )

  const selectedDayItem =
    overview.days.find((d) => d.date === activeDate) ??
    overview.days[overview.days.length - 1]

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeBtn = el.querySelector<HTMLElement>(`[data-date="${activeDate}"]`)
    if (activeBtn) {
      const targetLeft =
        activeBtn.offsetLeft - el.clientWidth / 2 + activeBtn.clientWidth / 2
      el.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    } else {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    }
  }, [rangeMode, activeDate])

  const scrollByOffset = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <section className="card" aria-label="本周打卡横滑周视图">
      {/* 顶部标题栏 + 范围切换 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-slate-800">📅 周视图与补打卡</h2>
            <span className="text-xs font-medium text-orange-500 tabular-nums">
              · 已打卡 {overview.activeDaysCount}/{overview.totalDaysCount} 天
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            点选过去日期可查看记录或补打卡
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-2xl bg-orange-50/90 p-1 text-xs font-medium dark:bg-slate-800">
            {(
              [
                { id: '7d', label: '近7天' },
                { id: 'week', label: '本周' },
                { id: '14d', label: '近14天' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  hapticTap()
                  setRangeMode(tab.id)
                }}
                className={`min-h-[38px] rounded-xl px-2.5 py-1.5 transition duration-150 ${
                  rangeMode === tab.id
                    ? 'bg-orange-500 font-semibold text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-800 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => scrollByOffset(-240)}
              aria-label="向左滚动日期"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-base text-slate-600 transition hover:bg-orange-100 dark:bg-slate-800 dark:text-slate-200"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollByOffset(240)}
              aria-label="向右滚动日期"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-base text-slate-600 transition hover:bg-orange-100 dark:bg-slate-800 dark:text-slate-200"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* 周汇总微统计横条 */}
      <div className="mt-3 flex min-h-[40px] items-center justify-between rounded-2xl bg-orange-50/60 px-3.5 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
          <span>
            累计完成 <strong className="font-bold text-orange-500">{overview.totalCompletedTasks}</strong> 项
          </span>
          <span aria-hidden="true">·</span>
          <span>
            日均完成率 <strong className="font-bold text-orange-500">{overview.averageRate}%</strong>
          </span>
        </div>
        {activeDate !== today ? (
          <button
            type="button"
            onClick={() => {
              hapticTap()
              setSelectedDate(today)
            }}
            className="min-h-[36px] shrink-0 px-2 font-semibold text-orange-500 hover:underline"
          >
            回到今天 ↺
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">⇄ 横滑浏览</span>
        )}
      </div>

      {/* 横向滚动日期卡片容器 */}
      <div
        ref={scrollRef}
        className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1.5 scroll-smooth"
      >
        {overview.days.map((d) => {
          const isSelected = d.date === activeDate
          const isFull = d.total > 0 && d.completed >= d.total
          const hasCheck = d.completed > 0

          return (
            <button
              key={d.date}
              type="button"
              data-date={d.date}
              onClick={() => {
                hapticTap()
                setSelectedDate(d.date)
              }}
              aria-label={`选择日期 ${d.date}，完成 ${d.completed}/${d.total}`}
              aria-pressed={isSelected}
              className={`group relative flex w-[116px] shrink-0 snap-start flex-col justify-between rounded-2xl p-3 text-left transition duration-150 active:scale-[0.97] ${
                isSelected
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm ring-2 ring-orange-300/70 dark:ring-orange-500/40'
                  : hasCheck
                    ? 'bg-orange-50/85 text-slate-700 hover:bg-orange-100/80 dark:bg-slate-800/90 dark:text-slate-200'
                    : 'bg-slate-50/90 text-slate-500 hover:bg-slate-100 dark:bg-slate-800/45 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-bold">{d.weekday}</span>
                <span
                  className={`tabular-nums ${
                    isSelected ? 'text-white/90' : 'text-slate-400'
                  }`}
                >
                  {d.shortDate}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-0.5 tabular-nums">
                  <span className="text-[18px] font-extrabold leading-none">{d.completed}</span>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    /{d.total}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isSelected
                      ? 'text-white/95'
                      : isFull
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : hasCheck
                          ? 'text-orange-500'
                          : 'text-slate-400'
                  }`}
                >
                  {isFull ? '🌟 圆满' : `${d.rate}%`}
                </span>
              </div>

              <div
                className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${
                  isSelected ? 'bg-white/25' : 'bg-orange-100/90 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isSelected
                      ? 'bg-white'
                      : isFull
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-orange-400 to-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, d.rate)}%` }}
                />
              </div>

              <p
                className={`mt-2 truncate text-[11px] ${
                  isSelected
                    ? 'text-white/90'
                    : hasCheck
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-400'
                }`}
              >
                {d.completedTitles.length > 0
                  ? `✓ ${d.completedTitles[0]}${d.completedTitles.length > 1 ? ` 等${d.completedTitles.length}项` : ''}`
                  : '点按查看或补卡'}
              </p>
            </button>
          )
        })}
      </div>

      {/* 选中日期的记录速览与一键跳转栏（所有按钮 ≥44px 热区） */}
      {selectedDayItem && (
        <div className="mt-3 rounded-2xl border border-orange-100/90 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-200">
              <span className="text-orange-500">
                {selectedDayItem.isToday ? '今日记录' : `${formatDateCN(selectedDayItem.date)} (${selectedDayItem.weekday})`}
              </span>
              <span aria-hidden="true"> · </span>
              <span>完成 {selectedDayItem.completed}/{selectedDayItem.total} 项</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onJumpToTasks && (
                <button
                  type="button"
                  onClick={() => {
                    hapticTap()
                    onJumpToTasks()
                  }}
                  className="min-h-[44px] rounded-xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-600 transition duration-150 hover:bg-orange-200/80 active:scale-95 dark:bg-slate-800 dark:text-orange-400"
                >
                  🎯 {selectedDayItem.isToday ? '去打卡清单' : '去补打卡'}
                </button>
              )}
              {onOpenMood && (
                <button
                  type="button"
                  onClick={() => {
                    hapticTap()
                    onOpenMood()
                  }}
                  className="min-h-[44px] rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition duration-150 hover:bg-amber-100 active:scale-95 dark:bg-slate-800 dark:text-amber-300"
                >
                  💭 {selectedDayItem.moodEmoji ? `${selectedDayItem.moodEmoji} 心情` : '记心情'}
                </button>
              )}
              {onOpenDiary && (
                <button
                  type="button"
                  onClick={() => {
                    hapticTap()
                    onOpenDiary()
                  }}
                  className="min-h-[44px] rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition duration-150 hover:bg-rose-100 active:scale-95 dark:bg-slate-800 dark:text-rose-300"
                >
                  📖 日记({selectedDayItem.diaryCount})
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {selectedDayItem.completedTitles.length > 0
              ? `已完成：${selectedDayItem.completedTitles.join(' · ')}`
              : `这一天还没有打卡记录，点上方「${selectedDayItem.isToday ? '去打卡清单' : '去补打卡'}」即可记录 🌱`}
          </p>
        </div>
      )}
    </section>
  )
}
