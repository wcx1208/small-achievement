import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { DiaryEntry } from '../../data/types'
import { DIARY_PROMPTS, DIARY_WEATHERS, MOOD_OPTIONS } from '../../data/presets'
import { formatDateCN, weekdayCN } from '../../lib/date'
import { Modal } from '../../components/Modal'
import { useData } from '../../store/DataContext'

/** 日记页（全屏覆盖层）：自带壁纸底衬，支持搜索、天气/心情印记与写作引导模板 */
export function DiaryPage({
  onClose,
  bg,
  showQuote,
}: {
  onClose: () => void
  bg: CSSProperties
  showQuote: (kind: 'task' | 'mood') => void
}) {
  const ctx = useData()
  if (!ctx) return null
  return <DiaryPageInner onClose={onClose} bg={bg} showQuote={showQuote} />
}

function DiaryPageInner({
  onClose,
  bg,
  showQuote,
}: {
  onClose: () => void
  bg: CSSProperties
  showQuote: (kind: 'task' | 'mood') => void
}) {
  useEffect(() => {
    const onBack = () => onClose()
    window.addEventListener('xcj:overlay-back', onBack)
    return () => window.removeEventListener('xcj:overlay-back', onBack)
  }, [onClose])

  const ctx = useData()
  if (!ctx) return null
  const { data, saveDiary, deleteDiary, today, notify } = ctx
  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null)
  const [query, setQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const sorted = [...data.diaries].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  )
  const q = query.trim().toLowerCase()
  const entries = q
    ? sorted.filter(
        (d) =>
          d.text.toLowerCase().includes(q) ||
          d.date.includes(q) ||
          (d.weather ?? '').toLowerCase().includes(q) ||
          (d.mood ?? '').toLowerCase().includes(q),
      )
    : sorted

  const totalChars = data.diaries.reduce((sum, d) => sum + d.text.length, 0)

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" data-native-overlay="diary">
      <div className="absolute inset-0" style={bg} />
      <div className="absolute inset-0 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-white/60 bg-white/85 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-3.5 py-2 text-[14px] font-medium text-slate-600 transition hover:bg-orange-50 active:scale-95 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="返回"
            >
              ← 返回
            </button>
            <div className="text-center">
              <h1 className="text-[18px] font-bold text-slate-800">📖 岁月日记</h1>
              <p className="text-xs text-slate-500 tabular-nums">
                共 {data.diaries.length} 篇 · 累计 {totalChars} 字
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="min-h-[44px] rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition active:scale-95"
            >
              ✍️ 写日记
            </button>
          </div>
        </header>

        <main className="stagger-list mx-auto max-w-2xl space-y-4 px-4 pb-20 pt-4">
          {data.diaries.length > 0 && (
            <div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 搜索日记内容、日期或天气…"
                aria-label="搜索日记"
                className="input w-full bg-white/90! text-[14px] dark:bg-slate-900/85!"
              />
            </div>
          )}

          {entries.length === 0 ? (
            <div className="card text-center">
              <p className="text-3xl">🌙</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-700">
                {q ? '没有找到匹配的日记' : '还没有日记，一两句生活碎片也很珍贵'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {q ? '换个关键词试试吧' : '写给自己看的，今天的小确幸或小烦恼都可以留在这里'}
              </p>
              <button
                type="button"
                onClick={() => (q ? setQuery('') : setEditing('new'))}
                className="btn-primary mt-4 text-xs"
              >
                {q ? '清空搜索条件' : '✍️ 写下第一篇日记'}
              </button>
            </div>
          ) : (
            <ul className="stagger-list space-y-4">
              {entries.map((d) => (
                <li key={d.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-semibold text-orange-500">
                        {formatDateCN(d.date)} 星期{weekdayCN(d.date)}
                      </span>
                      {d.weather && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{d.weather}</span>
                        </>
                      )}
                      {d.mood && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{d.mood}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400 tabular-nums">{d.text.length} 字</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditing(d)}
                        className="min-h-[44px] min-w-[44px] rounded-xl px-3 py-2 font-medium text-slate-600 transition hover:bg-orange-50 hover:text-orange-500 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        编辑
                      </button>
                      {confirmDeleteId !== d.id ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(d.id)}
                          className="min-h-[44px] min-w-[44px] rounded-xl px-3 py-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-slate-800"
                        >
                          删除
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (await deleteDiary(d.id)) {
                              setConfirmDeleteId(null)
                              notify('已删除日记')
                            }
                          }}
                          className="min-h-[44px] rounded-xl bg-red-500 px-3.5 py-2 font-semibold text-white"
                        >
                          确认删除
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
                    {d.text}
                  </p>
                  {d.updatedAt - d.createdAt > 60_000 && (
                    <p className="mt-2 text-xs text-slate-400">已编辑</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>

        <DiaryEditor
          entry={editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const ok = await saveDiary(input)
            if (!ok) return false
            setEditing(null)
            showQuote('mood')
            return true
          }}
        />
      </div>
    </div>
  )
}

function DiaryEditor({
  entry,
  today,
  onClose,
  onSave,
}: {
  entry: DiaryEntry | 'new' | null
  today: string
  onClose: () => void
  onSave: (input: {
    id?: string
    date: string
    text: string
    weather?: string
    mood?: string
  }) => Promise<boolean | void> | boolean | void
}) {
  const [date, setDate] = useState(today)
  const [text, setText] = useState('')
  const [weather, setWeather] = useState('☀️ 晴朗')
  const [mood, setMood] = useState('😊 开心')
  const [saving, setSaving] = useState(false)

  const key = entry === 'new' ? 'new' : entry?.id ?? 'closed'
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (entry === 'new') {
      setDate(today)
      setText('')
      setWeather('☀️ 晴朗')
      setMood('😊 开心')
    } else if (entry) {
      setDate(entry.date)
      setText(entry.text)
      setWeather(entry.weather ?? '☀️ 晴朗')
      setMood(entry.mood ?? '😊 开心')
    }
  }

  const canSave = entry !== null && text.trim().length > 0 && !saving

  const applyPrompt = (tpl: string) => {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${tpl}` : tpl))
  }

  return (
    <Modal open={entry !== null} onClose={onClose} closeOnBackdrop={false}>
      <p className="text-center text-[18px] font-bold text-slate-800">
        {entry === 'new' ? '写日记 ✍️' : '编辑日记'}
      </p>

      <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        📅 日期
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          className="input flex-1 py-2 text-[14px]"
        />
      </label>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">天气</span>
          {DIARY_WEATHERS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWeather(w.label)}
              className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs transition ${
                weather === w.label
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">状态</span>
          {MOOD_OPTIONS.map((m) => {
            const stamp = `${m.emoji} ${m.label}`
            return (
              <button
                key={m.emoji}
                type="button"
                onClick={() => setMood(stamp)}
                className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs transition ${
                  mood === stamp
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {stamp}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">写作引导：</span>
        {DIARY_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPrompt(p.template)}
            className="min-h-[38px] rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-orange-600 transition hover:bg-amber-100 dark:bg-slate-800 dark:text-orange-400"
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今天过得怎么样？写给自己看的一段话…"
        maxLength={2000}
        rows={5}
        className="input mt-3 w-full resize-none leading-relaxed"
      />
      <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">{text.length}/2000</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          取消
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!canSave || !entry) return
            setSaving(true)
            try {
              await onSave({
                id: entry === 'new' ? undefined : entry.id,
                date,
                text: text.trim(),
                weather,
                mood,
              })
            } finally {
              setSaving(false)
            }
          }}
          disabled={!canSave}
          className="btn-primary min-h-[44px] flex-1 disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存日记'}
        </button>
      </div>
    </Modal>
  )
}
