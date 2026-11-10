import { useState } from 'react'
import { formatDateCN, formatTime } from '../../lib/date'
import { useData } from '../../store/DataContext'

/** 情绪手账卡片：最近 10 条情绪流，带完整空状态引导与 ≥44×44px 触控热区 */
export function MoodSection({ onWrite }: { onWrite: () => void }) {
  const ctx = useData()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  if (!ctx) return null
  const { data, deleteMoodLog, today, notify } = ctx
  const logs = [...data.moodLogs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold text-slate-800">💭 情绪手账流</h2>
          <p className="mt-0.5 text-xs text-slate-500">接纳每一种情绪，好坏都值得被温柔看见</p>
        </div>
        <button
          type="button"
          onClick={onWrite}
          className="min-h-[44px] shrink-0 rounded-xl bg-orange-100 px-3.5 py-2 text-xs font-semibold text-orange-600 transition duration-150 hover:bg-orange-200/70 active:scale-95 dark:bg-slate-800 dark:text-orange-400"
        >
          ✏️ 记心情
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl bg-orange-50/50 px-4 py-6 text-center dark:bg-slate-800/50">
          <p className="text-3xl">🌤</p>
          <p className="mt-2 text-[14px] font-medium text-slate-700">
            还没有心情记录，此刻哪怕只有一点点小情绪也值得留存
          </p>
          <button
            type="button"
            onClick={onWrite}
            className="btn-primary mt-3 text-xs"
          >
            ✏️ 记下第一笔心情
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {logs.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-2xl bg-orange-50/65 p-3.5 dark:bg-slate-800/65"
            >
              <span className="mt-0.5 text-2xl leading-none">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                  <span>
                    {m.date === today ? '今天' : formatDateCN(m.date)} {formatTime(m.createdAt)}
                  </span>
                  {m.tags.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-orange-500">{m.tags.join(' / ')}</span>
                    </>
                  )}
                </div>
                {m.text && (
                  <p className="mt-1 break-words text-[14px] leading-relaxed text-slate-700">
                    {m.text}
                  </p>
                )}
              </div>
              {confirmId !== m.id ? (
                <button
                  type="button"
                  onClick={() => setConfirmId(m.id)}
                  aria-label="删除心情记录"
                  className="-my-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm text-slate-400 transition duration-150 hover:bg-red-50 hover:text-red-500 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (await deleteMoodLog(m.id)) {
                      setConfirmId(null)
                      notify('已删除一条心情记录')
                    }
                  }}
                  className="min-h-[44px] shrink-0 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
                >
                  确认删除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
