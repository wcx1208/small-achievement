import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Note } from '../../data/types'
import { NOTE_COLORS, noteColorClass } from '../../data/presets'
import { dateStr, formatDateCN, formatTime } from '../../lib/date'
import { Modal } from '../../components/Modal'
import { useData } from '../../store/DataContext'

/** 便签页（全屏覆盖层）：自带壁纸底衬，支持置顶、按色筛选、搜索与快速贴墙 */
export function NotesPage({ onClose, bg }: { onClose: () => void; bg: CSSProperties }) {
  const ctx = useData()
  if (!ctx) return null
  return <NotesPageInner onClose={onClose} bg={bg} />
}

function NotesPageInner({ onClose, bg }: { onClose: () => void; bg: CSSProperties }) {
  useEffect(() => {
    const onBack = () => onClose()
    window.addEventListener('xcj:overlay-back', onBack)
    return () => window.removeEventListener('xcj:overlay-back', onBack)
  }, [onClose])

  const ctx = useData()
  if (!ctx) return null
  const { data, saveNote, togglePinNote, notify } = ctx
  const [draft, setDraft] = useState('')
  const [draftColor, setDraftColor] = useState('amber')
  const [filterColor, setFilterColor] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [adding, setAdding] = useState(false)

  const sorted = [...data.notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
  const q = query.trim().toLowerCase()
  const notes = sorted.filter((n) => {
    if (filterColor !== 'all' && n.color !== filterColor) return false
    if (q && !n.text.toLowerCase().includes(q)) return false
    return true
  })

  const quickAdd = async () => {
    const t = draft.trim()
    if (!t || adding) return
    setAdding(true)
    try {
      if (await saveNote({ text: t, color: draftColor })) {
        setDraft('')
        notify('便签已贴上墙 🗒️')
      }
    } finally {
      setAdding(false)
    }
  }

  const focusDraftInput = () => {
    const el = document.getElementById('notes-overlay-input') as HTMLInputElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" data-native-overlay="notes">
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
            <h1 className="text-[18px] font-bold text-slate-800">🗒️ 灵感便签墙</h1>
            <span className="text-xs text-slate-500 tabular-nums">{data.notes.length} 张</span>
          </div>
        </header>

        <main className="stagger-list mx-auto max-w-2xl space-y-4 px-4 pb-20 pt-4">
          {/* 快速新建：一句话回车即贴 + 配色预选 */}
          <section className="card">
            <div className="flex gap-2">
              <input
                id="notes-overlay-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void quickAdd()}
                placeholder="记点灵感、书单或备忘，回车即贴上墙…"
                aria-label="新便签内容"
                maxLength={500}
                className="input flex-1 bg-white! text-[14px] dark:bg-slate-800!"
              />
              <button
                type="button"
                onClick={() => void quickAdd()}
                disabled={!draft.trim() || adding}
                className="btn-primary min-h-[44px] shrink-0 px-4 text-xs disabled:opacity-40"
              >
                {adding ? '贴上中' : '贴上'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="mr-1 text-xs text-slate-500">纸张色</span>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraftColor(c.id)}
                    aria-label={`选择${c.name}色`}
                    className="grid h-11 w-11 place-items-center rounded-xl transition hover:bg-orange-50/60 dark:hover:bg-slate-800"
                  >
                    <span
                      className={`h-6 w-6 rounded-full border transition ${c.card} ${
                        draftColor === c.id ? 'scale-110 ring-2 ring-orange-400' : 'opacity-75'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">点按便签可编辑或置顶</span>
            </div>
          </section>

          {/* 搜索与颜色筛选 */}
          {data.notes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 搜索便签…"
                aria-label="搜索便签"
                className="input min-w-[140px] flex-1 bg-white/90! text-xs dark:bg-slate-900/85!"
              />
              <div className="flex items-center gap-1 rounded-2xl bg-white/85 p-1 dark:bg-slate-900/85">
                <button
                  type="button"
                  onClick={() => setFilterColor('all')}
                  className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                    filterColor === 'all' ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  全部
                </button>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFilterColor(c.id)}
                    className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                      filterColor === c.id ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <div className="card text-center">
              <p className="text-3xl">🗂️</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-700">
                {q || filterColor !== 'all' ? '没有匹配的便签' : '便签墙上还空着呢'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {q || filterColor !== 'all'
                  ? '可以清空筛选条件查看全部便签'
                  : '待办、灵感、书单、提醒，想到就随手贴一张吧'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (q || filterColor !== 'all') {
                    setQuery('')
                    setFilterColor('all')
                  } else {
                    focusDraftInput()
                  }
                }}
                className="btn-primary mt-4 text-xs"
              >
                {q || filterColor !== 'all' ? '查看全部便签' : '🗒️ 贴上第一张便签'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className={`group relative rounded-3xl border p-5 text-left shadow-xs transition duration-150 hover:shadow-md ${noteColorClass(n.color)}`}
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{n.pinned ? '📌 已置顶' : formatDateCN(dateStr(new Date(n.updatedAt)))}</span>
                    <button
                      type="button"
                      onClick={() => void togglePinNote(n.id)}
                      aria-label={n.pinned ? '取消置顶' : '置顶便签'}
                      className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-black/5 hover:text-orange-600 dark:text-slate-300"
                    >
                      {n.pinned ? '取消置顶' : '📌 置顶'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(n)}
                    className="block w-full text-left"
                  >
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
                      {n.text}
                    </p>
                    <p className="mt-3 text-xs text-slate-400 tabular-nums">
                      {formatDateCN(dateStr(new Date(n.updatedAt)))} {formatTime(n.updatedAt)} · 点击编辑
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>

        <NoteEditor note={editing} onClose={() => setEditing(null)} />
      </div>
    </div>
  )
}

function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const ctx = useData()
  if (!ctx) return null
  const { saveNote, deleteNote, notify } = ctx
  const [text, setText] = useState('')
  const [color, setColor] = useState('amber')
  const [pinned, setPinned] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const key = note?.id ?? 'closed'
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setConfirmDelete(false)
    if (note) {
      setText(note.text)
      setColor(note.color)
      setPinned(Boolean(note.pinned))
    }
  }

  return (
    <Modal open={note !== null} onClose={onClose} closeOnBackdrop={false}>
      <p className="text-center text-[18px] font-bold text-slate-800">编辑便签</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={5}
        autoFocus
        className="input mt-4 w-full resize-none leading-relaxed"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              aria-label={`颜色 ${c.name}`}
              className="grid h-11 w-11 place-items-center rounded-xl"
            >
              <span
                className={`h-7 w-7 rounded-full border-2 ${c.card} ${
                  color === c.id ? 'ring-2 ring-orange-400' : ''
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          className={`min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-medium transition ${
            pinned
              ? 'bg-orange-500 text-white'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          📌 {pinned ? '已置顶' : '置顶便签'}
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-4 py-3 text-[14px] text-red-500 dark:bg-slate-800"
          >
            删除
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              if (note && (await deleteNote(note.id))) {
                notify('便签已删除')
                onClose()
              }
            }}
            className="min-h-[44px] shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-[14px] font-semibold text-white"
          >
            确认删除
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-4 py-3 text-[14px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          取消
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!note || !text.trim() || saving) return
            setSaving(true)
            try {
              if (await saveNote({ id: note.id, text: text.trim(), color, pinned })) {
                notify('便签已更新')
                onClose()
              }
            } finally {
              setSaving(false)
            }
          }}
          disabled={!text.trim() || saving}
          className="btn-primary min-h-[44px] flex-1 disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </Modal>
  )
}
