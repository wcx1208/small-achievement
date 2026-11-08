import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { DiaryEntry } from '../../data/types'
import { formatDateCN, todayStr, weekdayCN } from '../../lib/date'
import { Modal } from '../../components/Modal'
import { useData } from '../../store/DataContext'

/** 日记页（全屏覆盖层）：自带壁纸底衬遮住主页面，时间线列表 + 写/编辑弹窗 */
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
  // 安卓返回键：日记页开着时先返回主页（事件由 main.tsx 派发）
  useEffect(() => {
    const onBack = () => onClose()
    window.addEventListener('xcj:overlay-back', onBack)
    return () => window.removeEventListener('xcj:overlay-back', onBack)
  }, [onClose])

  const ctx = useData()
  if (!ctx) return null
  const { data, saveDiary, deleteDiary, today } = ctx
  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null)

  const entries = [...data.diaries].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" data-native-overlay="diary">
      {/* 壁纸底衬：遮住主页面，视觉上与主界面同一张壁纸 */}
      <div className="absolute inset-0" style={bg} />
      <div className="absolute inset-0 overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/70 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-slate-500 transition active:scale-95" aria-label="返回">
            ← 返回
          </button>
          <h1 className="text-base font-bold text-slate-800">📖 日记</h1>
          <button
            onClick={() => setEditing('new')}
            className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95"
          >
            ✍️ 写日记
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-16 pt-4">
        {entries.length === 0 ? (
          <div className="card mt-6 text-center">
            <p className="text-3xl">🌙</p>
            <p className="mt-2 text-sm text-slate-500">还没有日记</p>
            <p className="mt-1 text-xs text-slate-400">写给自己看的，一两句也行</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((d) => (
              <li key={d.id} className="card">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-orange-400">
                    {formatDateCN(d.date)} 星期{weekdayCN(d.date)}
                  </p>
                  <div className="flex items-center gap-1 text-slate-300">
                    <button onClick={() => setEditing(d)} className="px-1.5 text-xs transition hover:text-orange-500" aria-label="编辑">
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('删除这篇日记？') && await deleteDiary(d.id)) setEditing(null)
                      }}
                      className="px-1.5 text-xs transition hover:text-red-400"
                      aria-label="删除"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">{d.text}</p>
                {d.updatedAt - d.createdAt > 60_000 && <p className="mt-1.5 text-[10px] text-slate-300">已编辑</p>}
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
  onSave: (input: { id?: string; date: string; text: string }) => Promise<boolean | void> | boolean | void
}) {
  const [date, setDate] = useState(today)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  // 每次打开弹窗时，用被编辑的日记内容初始化
  const key = entry === 'new' ? 'new' : entry?.id ?? 'closed'
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (entry === 'new') {
      setDate(today)
      setText('')
    } else if (entry) {
      setDate(entry.date)
      setText(entry.text)
    }
  }

  const canSave = entry !== null && text.trim().length > 0 && !saving

  return (
    <Modal open={entry !== null} onClose={onClose} closeOnBackdrop={false}>
      <p className="text-center text-lg font-bold text-slate-800">{entry === 'new' ? '写日记 ✍️' : '编辑日记'}</p>
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        📅 日期
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          className="input flex-1 py-2"
        />
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今天过得怎么样？写给自己看的一段话…"
        maxLength={2000}
        rows={7}
        className="input mt-3 w-full resize-none leading-relaxed"
      />
      <p className="mt-1 text-right text-[10px] text-slate-300">{text.length}/2000</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          取消
        </button>
        <button
          onClick={async () => {
            if (!canSave || !entry) return
            setSaving(true)
            try {
              await onSave({ id: entry === 'new' ? undefined : entry.id, date, text: text.trim() })
            } finally {
              setSaving(false)
            }
          }}
          disabled={!canSave}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </Modal>
  )
}
