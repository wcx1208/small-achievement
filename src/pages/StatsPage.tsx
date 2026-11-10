import { useData } from '../store/DataContext'
import {
  adherence,
  categoryBreakdown,
  focusSummary,
  getLongestStreak,
  getStreak,
  tagFrequency,
  weeklyActivity,
} from '../lib/stats'
import { formatDateCN, dateStr, lastNDays, monthToDateDays, weekToDateDays } from '../lib/date'
import { BADGES, BADGE_MAP } from '../data/badges'
import { Heatmap } from '../features/stats/Heatmap'
import { MoodTrend } from '../features/stats/MoodTrend'

/** 统计页：统一 p-5 内边距、space-y-4 间距、17-20px 标题体系与 stagger 卡片入场 */
export function StatsPage() {
  const ctx = useData()
  if (!ctx) return null
  const { data, today } = ctx
  const streak = getStreak(data.checkIns, today)
  const focus = focusSummary(data.focusSessions ?? [], today)
  const days30 = lastNDays(30, today)
  const recentMoods = data.moodLogs.filter((m) => m.date >= days30[0] && m.date <= today)
  const avgMood = recentMoods.length
    ? recentMoods.reduce((sum, m) => sum + m.score, 0) / recentMoods.length
    : null
  const tagFreq = tagFrequency(data.moodLogs).slice(0, 8)
  const knownBadges = data.badges.filter((b) => BADGE_MAP[b.id])
  const weekBars = weeklyActivity(data.checkIns, today)
  const maxWeekCount = Math.max(1, ...weekBars.map((w) => w.count))
  const categories = categoryBreakdown(data.tasks, data.checkIns)

  const cards = [
    { icon: '✅', label: '累计打卡', value: `${data.checkIns.length} 次` },
    { icon: '🔥', label: '当前连胜', value: `${streak} 天` },
    { icon: '🍅', label: '累计专注', value: `${focus.totalMinutes} 分钟` },
    { icon: '🏅', label: '解锁徽章', value: `${knownBadges.length}/${BADGES.length}` },
  ]

  const allCheckDates = data.checkIns.map((c) => c.date).sort()
  const allMoodDates = data.moodLogs.map((m) => m.date).sort()
  const highlights = [
    { icon: '🌱', label: '第一次打卡', value: allCheckDates[0] ? formatDateCN(allCheckDates[0]) : '还没开始' },
    { icon: '🏆', label: '历史最长连胜', value: `${getLongestStreak(data.checkIns)} 天` },
    { icon: '📖', label: '岁月日记与便签', value: `${data.diaries.length} 篇 · ${data.notes.length} 张` },
    { icon: '💭', label: '第一次记心情', value: allMoodDates[0] ? formatDateCN(allMoodDates[0]) : '期待第一笔' },
  ]
  const badgeTimeline = [...knownBadges].sort((a, b) => b.unlockedAt - a.unlockedAt).slice(0, 4)

  const week = adherence(data.checkIns, weekToDateDays(today))
  const month = adherence(data.checkIns, monthToDateDays(today))
  const rates = [
    { label: '本周坚持率（开始记录后）', ...week },
    { label: '本月坚持率（开始记录后）', ...month },
  ]

  return (
    <div className="stagger-list space-y-4">
      <header>
        <h1 className="text-[20px] font-bold tracking-tight text-slate-800">成长统计</h1>
        <p className="mt-0.5 text-xs text-slate-500">看看自己一路走来的痕迹与情绪脉络</p>
      </header>

      {/* 核心指标四宫格（统一 p-5 卡片） */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-3">
            <span className="text-2xl">{c.icon}</span>
            <div className="min-w-0">
              <p className="text-[18px] font-bold leading-none text-slate-800 tabular-nums">{c.value}</p>
              <p className="mt-1.5 text-xs text-slate-500">{c.label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="stagger-list grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 近 7 日打卡节奏柱状图 */}
        <section className="card">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold text-slate-800">📊 近 7 日完成节奏</h2>
            <span className="text-xs text-slate-500 tabular-nums">
              近 7 日共 {weekBars.reduce((s, x) => s + x.count, 0)} 次打卡
            </span>
          </div>
          <div className="grid grid-cols-7 items-end gap-2 pt-2" style={{ height: 132 }}>
            {weekBars.map((item) => {
              const heightPct = item.count > 0 ? Math.max(18, Math.round((item.count / maxWeekCount) * 100)) : 8
              return (
                <div key={item.date} className="flex h-full flex-col items-center justify-end gap-1">
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {item.count > 0 ? item.count : ''}
                  </span>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-6 rounded-t-lg transition-all duration-300 ${
                        item.count > 0
                          ? 'bg-gradient-to-t from-orange-500 to-amber-400'
                          : 'bg-orange-100/70 dark:bg-slate-700'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    {item.weekday}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* 习惯领域分布 */}
        <section className="card">
          <h2 className="mb-1 text-[17px] font-bold text-slate-800">🌿 习惯领域分布</h2>
          <p className="mb-3 text-xs text-slate-500">你在不同生活维度的投入占比</p>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between text-[14px] tabular-nums">
                  <span className="font-medium text-slate-700">
                    {cat.icon} {cat.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {cat.count} 次 · {cat.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-orange-100/80 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 坚持率：本周 / 本月 */}
        <section className="card flex flex-col justify-between">
          <div>
            <h2 className="mb-1 text-[17px] font-bold text-slate-800">📅 坚持率</h2>
            <p className="mb-3 text-xs text-slate-500">范围内有打卡的天数占比，断签一天不用怕，第二天补上就好</p>
            <div className="space-y-3.5">
              {rates.map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between text-[14px] tabular-nums">
                    <span className="text-slate-600">{r.label}</span>
                    <span className="font-semibold text-orange-500">
                      {Math.round(r.rate * 100)}%{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({r.hit}/{r.total} 天)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-orange-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                      style={{ width: `${Math.round(r.rate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-orange-50 pt-3.5 text-center dark:border-slate-700">
            <div>
              <p className="text-[15px] font-bold text-slate-800 tabular-nums">{new Set(allCheckDates).size} 天</p>
              <p className="mt-0.5 text-xs text-slate-500">累计活跃天数</p>
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-800 tabular-nums">
                {allCheckDates.length
                  ? (data.checkIns.length / Math.max(1, new Set(allCheckDates).size)).toFixed(1)
                  : '0.0'}{' '}
                次
              </p>
              <p className="mt-0.5 text-xs text-slate-500">活跃日均打卡</p>
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-800 tabular-nums">{focus.totalSessions} 次</p>
              <p className="mt-0.5 text-xs text-slate-500">番茄专注场次</p>
            </div>
          </div>
        </section>

        {/* 高光时刻 */}
        <section className="card">
          <h2 className="mb-3 text-[17px] font-bold text-slate-800">✨ 高光时刻</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            {highlights.map((h) => (
              <div key={h.label} className="flex items-center gap-2.5">
                <span className="text-xl">{h.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-800 tabular-nums">{h.value}</p>
                  <p className="text-xs text-slate-500">{h.label}</p>
                </div>
              </div>
            ))}
          </div>
          {badgeTimeline.length > 0 && (
            <div className="mt-4 border-t border-orange-50 pt-3.5 dark:border-slate-700">
              <p className="mb-2 text-xs text-slate-500">最近的徽章解锁</p>
              <div className="space-y-2">
                {badgeTimeline.map((b) => {
                  const def = BADGE_MAP[b.id]
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-[14px] text-slate-600 tabular-nums">
                      <span className="text-base">{def?.emoji ?? '🏅'}</span>
                      <span className="font-medium text-slate-700">{def?.name ?? b.id}</span>
                      <span className="ml-auto text-xs text-slate-500">
                        {formatDateCN(dateStr(new Date(b.unlockedAt)))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* 90 天热力图 */}
        <section className="card">
          <h2 className="mb-2 text-[17px] font-bold text-slate-800">🔥 近 90 天打卡热力图</h2>
          <Heatmap checkIns={data.checkIns} today={today} />
          <p className="mt-1 text-xs text-slate-500">颜色越深，代表当天完成的小事越多</p>
        </section>

        {/* 30 天心情趋势 */}
        <section className="card">
          <h2 className="mb-2 text-[17px] font-bold text-slate-800">🌈 近 30 天心情趋势</h2>
          <MoodTrend moodLogs={data.moodLogs} today={today} />
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            近 30 天平均心情 {avgMood != null ? avgMood.toFixed(1) : '—'} 分 · {recentMoods.length} 条记录（😊 5 分 ~ 😣 1 分）
          </p>
        </section>
      </div>

      {tagFreq.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-[17px] font-bold text-slate-800">💭 高频情绪关键词</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-slate-600 tabular-nums">
            {tagFreq.map((t, i) => (
              <span key={t.tag} className="inline-flex items-center gap-1">
                <span className="font-medium text-orange-500">{t.tag}</span>
                <span className="text-xs text-slate-500">({t.n})</span>
                {i < tagFreq.length - 1 && <span aria-hidden="true" className="ml-2 text-slate-300 dark:text-slate-600">·</span>}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
