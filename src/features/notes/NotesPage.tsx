import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Note } from '../../data/types'
import { NOTE_COLORS, noteColorClass } from '../../data/presets'
import { dateStr, formatDateCN, formatTime } from '../../lib/date'
import { Modal } from '../../components/Modal'
import { useData } from '../../store/DataContext'

/** 便签页（全屏覆盖层）：自带壁纸底衬，顶部快速输入 + 双列彩色便签墙 */
export function NotesPage({ onClose, bg }: { onClose: () => void; bg: CSSProperties }) {
  const ctx = useData()
  if (!ctx) return null
  return <NotesPageInner onClose={onClose} bg={bg} />
}

function NotesPageInner({ onClose, bg }: { onClose: () => void; bg: CSSProperties }) {
  // 安卓返回键：便签页开着时先返回主页（事件由 main.tsx 派发）
  useEffect(() => {
    const onBack = () => onClose()
    window.addEventListener('xcj:overlay-back', onBack)
    return () => window.removeEventListener('xcj:overlay-back', onBack)
  }, [onClose])

  const ctx = useData()
  if (!ctx) return null
  const { data, saveNote } = ctx
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [adding, setAdding] = useState(false)

  const notes = [...data.notes].sort((a, b) => b.updatedAt - a.updatedAt)

  const quickAdd = async () => {
    const t = draft.trim()
    if (!t || adding) return
    setAdding(true)
    try {
      if (await saveNote({ text: t })) setDraft('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" data-native-overlay="notes">
      {/* 壁纸底衬：遮住主页面，视觉上与主界面同一张壁纸 */}
      <div className="absolute inset-0" style={bg} />
      <div className="absolute inset-0 overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/70 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-slate-500 transition active:scale-95" aria-label="返回">
            ← 返回
          </button>
          <h1 className="text-base font-bold text-slate-800">🗒️ 便签</h1>
          <span className="text-xs text-slate-400">{notes.length} 张</span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-16 pt-4">
        {/* 快速新建：一句话回车即贴 */}
        <div className="card flex gap-2 p-3!">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void quickAdd()}
            placeholder="记点什么，回车就贴上墙…"
            maxLength={500}
            className="input flex-1 bg-white! py-2.5! text-sm dark:bg-slate-800!"
          />
          <button
            onClick={() => void quickAdd()}
            disabled={!draft.trim() || adding}
            className="btn-primary shrink-0 px-4! py-2.5! text-sm disabled:opacity-40"
          >
            {adding ? '贴上中' : '贴上'}
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="card mt-6 text-center">
            <p className="text-3xl">🗂️</p>
            <p className="mt-2 text-sm text-slate-500">墙上还空着</p>
            <p className="mt-1 text-xs text-slate-400">待办、灵感、提醒，想到就贴一张</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 items-start gap-3">
            {notes.map((n, i) => (
              <button
                key={n.id}
                onClick={() => setEditing(n)}
                className={`rounded-2xl border p-3 text-left shadow-sm transition active:scale-[0.97] ${noteColorClass(n.color)}`}
                style={{ transform: `rotate(${i % 2 === 0 ? '-0.6deg' : '0.6deg'})` }}
              >
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{n.text}</p>
                <p className="mt-2 text-[10px] text-slate-400">
                  {formatDateCN(dateStr(new Date(n.updatedAt)))} {formatTime(n.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>

      <NoteEditor
        note={editing}
        onClose={() => setEditing(null)}
      />
      </div>
    </div>
  )
}

function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const ctx = useData()
  if (!ctx) return null
  const { saveNote, deleteNote } = ctx
  const [text, setText] = useState('')
  const [color, setColor] = useState('amber')
  const [saving, setSaving] = useState(false)

  const key = note?.id ?? 'closed'
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (note) {
      setText(note.text)
      setColor(note.color)
    }
  }

  return (
    <Modal open={note !== null} onClose={onClose} closeOnBackdrop={false}>
      <p className="text-center text-lg font-bold text-slate-800">编辑便签</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={5}
        autoFocus
        className="input mt-4 w-full resize-none leading-relaxed"
      />
      <div className="mt-3 flex items-center gap-2">
        {NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => setColor(c.id)}
            aria-label={`颜色 ${c.id}`}
            className={`h-8 w-8 rounded-full border-2 ${c.card} ${color === c.id ? 'ring-2 ring-orange-400' : ''}`}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={async () => {
            if (note && window.confirm('删除这张便签？') && await deleteNote(note.id)) {
              onClose()
            }
          }}
          className="shrink-0 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-red-400 dark:bg-slate-800"
        >
          删除
        </button>
        <button
          onClick={async () => {
            if (!note || !text.trim() || saving) return
            setSaving(true)
            try {
              if (await saveNote({ id: note.id, text: text.trim(), color })) onClose()
            } finally {
              setSaving(false)
            }
          }}
          disabled={!text.trim() || saving}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </Modal>
  )
}
