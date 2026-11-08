import { formatDateCN, formatTime } from '../../lib/date'
import { useData } from '../../store/DataContext'

/** 今日页的心情日记卡片：最近 10 条，支持删除 */
export function MoodSection({ onWrite }: { onWrite: () => void }) {
  const ctx = useData()
  if (!ctx) return null
  const { data, deleteMoodLog, today } = ctx
  const logs = [...data.moodLogs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">心情</h2>
        <button
          onClick={onWrite}
          className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-600 transition active:scale-95"
        >
          ✏️ 写心情
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">记下第一笔心情吧 🌱</p>
      ) : (
        <ul className="space-y-2.5">
          {logs.map((m) => (
            <li key={m.id} className="flex items-start gap-3 rounded-2xl bg-orange-50/70 p-3 dark:bg-slate-800/60">
              <span className="text-2xl leading-none">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                  <span>
                    {m.date === today ? '今天' : formatDateCN(m.date)} {formatTime(m.createdAt)}
                  </span>
                  {m.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-1.5 py-0.5 text-orange-400 dark:bg-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
                {m.text && <p className="mt-1 break-words text-sm leading-relaxed text-slate-600">{m.text}</p>}
              </div>
              <button
                onClick={async () => {
                  if (window.confirm('删除这条心情记录？')) await deleteMoodLog(m.id)
                }}
                aria-label="删除"
                className="-my-1 p-1.5 text-slate-300 transition hover:text-red-400 dark:text-slate-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
