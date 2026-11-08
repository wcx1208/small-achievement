import { useData } from '../store/DataContext'
import { adherence, getLongestStreak, getStreak, tagFrequency } from '../lib/stats'
import { formatDateCN, dateStr, lastNDays, monthToDateDays, weekToDateDays } from '../lib/date'
import { BADGES, BADGE_MAP } from '../data/badges'
import { Heatmap } from '../features/stats/Heatmap'
import { MoodTrend } from '../features/stats/MoodTrend'

/** 统计页：总量卡片 + 90 天热力图 + 30 天心情趋势 + 高频标签 */
export function StatsPage() {
  const ctx = useData()
  if (!ctx) return null
  const { data, today } = ctx
  const streak = getStreak(data.checkIns, today)
  const days30 = lastNDays(30, today)
  const recentMoods = data.moodLogs.filter((m) => m.date >= days30[0] && m.date <= today)
  const avgMood = recentMoods.length
    ? recentMoods.reduce((sum, m) => sum + m.score, 0) / recentMoods.length
    : null
  const tagFreq = tagFrequency(data.moodLogs).slice(0, 6)
  const knownBadges = data.badges.filter((b) => BADGE_MAP[b.id])

  const cards = [
    { icon: '✅', label: '累计打卡', value: String(data.checkIns.length) },
    { icon: '🔥', label: '当前连胜', value: String(streak) },
    { icon: '💭', label: '心情记录', value: String(data.moodLogs.length) },
    { icon: '🏅', label: '解锁徽章', value: `${knownBadges.length}/${BADGES.length}` },
  ]

  // 高光时刻：里程碑 + 徽章解锁时间线
  const allCheckDates = data.checkIns.map((c) => c.date).sort()
  const allMoodDates = data.moodLogs.map((m) => m.date).sort()
  const highlights = [
    { icon: '🌱', label: '第一次打卡', value: allCheckDates[0] ? formatDateCN(allCheckDates[0]) : '还没开始' },
    { icon: '🏆', label: '历史最长连胜', value: `${getLongestStreak(data.checkIns)} 天` },
    { icon: '✅', label: '累计打卡', value: `${data.checkIns.length} 次` },
    { icon: '💭', label: '第一次记心情', value: allMoodDates[0] ? formatDateCN(allMoodDates[0]) : '期待第一笔' },
  ]
  const badgeTimeline = [...knownBadges].sort((a, b) => b.unlockedAt - a.unlockedAt).slice(0, 3)
  // 坚持率：范围内有打卡的天数占比；分母从首次打卡开始，不把开始使用前的日子算作失败
  const week = adherence(data.checkIns, weekToDateDays(today))
  const month = adherence(data.checkIns, monthToDateDays(today))
  const rates = [
    { label: '本周（开始记录后）', ...week },
    { label: '本月（开始记录后）', ...month },
  ]

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-800">统计</h1>
        <p className="mt-0.5 text-xs text-slate-400">看看自己一路走来的痕迹</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-3 p-4">
            <span className="text-xl">{c.icon}</span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none text-slate-800">{c.value}</p>
              <p className="mt-1 text-[11px] text-slate-400">{c.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* 高光时刻 */}
      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">✨ 高光时刻</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {highlights.map((h) => (
            <div key={h.label} className="flex items-center gap-2.5">
              <span className="text-lg">{h.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-700">{h.value}</p>
                <p className="text-[10px] text-slate-400">{h.label}</p>
              </div>
            </div>
          ))}
        </div>
        {badgeTimeline.length > 0 && (
          <div className="mt-4 border-t border-orange-50 pt-3 dark:border-slate-700">
            <p className="mb-2 text-[11px] text-slate-400">最近的徽章解锁</p>
            <div className="space-y-1.5">
              {badgeTimeline.map((b) => {
                const def = BADGE_MAP[b.id]
                return (
                  <div key={b.id} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-base">{def?.emoji ?? '🏅'}</span>
                    <span className="font-medium text-slate-600">{def?.name ?? b.id}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{formatDateCN(dateStr(new Date(b.unlockedAt)))}</span>
                  </div>
                )
              })}
              {data.badges.length > 3 && <p className="text-[10px] text-slate-300">…以及更早的 {knownBadges.length - 3} 枚</p>}
            </div>
          </div>
        )}
      </section>

      {/* 坚持率：本周 / 本月 */}
      <section className="card">
        <h2 className="mb-1 text-sm font-bold text-slate-700">📅 坚持率</h2>
        <p className="mb-3 text-[11px] text-slate-400">范围内有打卡的天数占比，断签一天不用怕，第二天补上就好</p>
        <div className="space-y-3">
          {rates.map((r) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-semibold text-orange-500">
                  {Math.round(r.rate * 100)}% <span className="text-[10px] font-normal text-slate-400">({r.hit}/{r.total} 天)</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-orange-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                  style={{ width: `${Math.round(r.rate * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-sm font-bold text-slate-700">近 90 天打卡热力图</h2>
        <Heatmap checkIns={data.checkIns} today={today} />
        <p className="mt-1 text-[11px] text-slate-400">颜色越深，当天完成得越多</p>
      </section>

      <section className="card">
        <h2 className="mb-2 text-sm font-bold text-slate-700">近 30 天心情趋势</h2>
        <MoodTrend moodLogs={data.moodLogs} today={today} />
        <p className="mt-1 text-[11px] text-slate-400">
          近 30 天平均心情 {avgMood != null ? avgMood.toFixed(1) : '—'} 分 · {recentMoods.length} 条记录（😊 5 分 ~ 😣 1 分）
        </p>
      </section>

      {tagFreq.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-bold text-slate-700">高频心情标签</h2>
          <div className="flex flex-wrap gap-2">
            {tagFreq.map((t) => (
              <span key={t.tag} className="rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-500">
                {t.tag} × {t.n}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
