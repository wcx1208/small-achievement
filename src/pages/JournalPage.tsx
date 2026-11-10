import { useState } from 'react'
import { useData } from '../store/DataContext'
import { DIARY_PROMPTS, DIARY_WEATHERS, MOOD_OPTIONS, NOTE_COLORS, noteColorClass } from '../data/presets'
import type { DiaryEntry, Note } from '../data/types'
import { dateStr, formatDateCN, formatTime, weekdayCN } from '../lib/date'
import { Modal } from '../components/Modal'
import { MoodModal } from '../features/mood/MoodModal'
import { MoodSection } from '../features/mood/MoodSection'

type SubTab = 'diary' | 'notes' | 'mood'

/** 手机端专属「手账」主栏页：集成了时光回响胶囊（含无历史空状态）、岁月日记、灵感便签墙与情绪流 */
export function JournalPage({ showQuote }: { showQuote: (kind: 'task' | 'mood') => void }) {
  const ctx = useData()
  const [subTab, setSubTab] = useState<SubTab>('diary')
  const [editingDiary, setEditingDiary] = useState<DiaryEntry | 'new' | null>(null)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [moodOpen, setMoodOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteColor, setNoteColor] = useState('amber')
  const [search, setSearch] = useState('')
  const [capsuleIdx, setCapsuleIdx] = useState(0)
  const [confirmDiaryId, setConfirmDiaryId] = useState<string | null>(null)

  if (!ctx) return null
  const { data, today, saveDiary, deleteDiary, saveNote, togglePinNote, deleteNote, addMoodLog, notify } = ctx

  // 组装时光回响池（日记 + 便签 + 心情）
  const memories: { kind: string; date: string; text: string; badge: string }[] = [
    ...data.diaries.map((d) => ({
      kind: '日记',
      date: formatDateCN(d.date),
      text: d.text,
      badge: `${d.weather ?? '📖'} ${d.mood ?? ''}`.trim(),
    })),
    ...data.moodLogs
      .filter((m) => m.text.trim())
      .map((m) => ({
        kind: '心情',
        date: formatDateCN(m.date),
        text: m.text,
        badge: `${m.emoji} ${m.tags.join('·')}`,
      })),
    ...data.notes.map((n) => ({
      kind: '便签',
      date: formatDateCN(dateStr(new Date(n.updatedAt))),
      text: n.text,
      badge: '🗒️ 随手记',
    })),
  ]
  const currentMemory = memories.length > 0 ? memories[capsuleIdx % memories.length] : null

  const sortedDiaries = [...data.diaries].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  )
  const sortedNotes = [...data.notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })

  const q = search.trim().toLowerCase()
  const filteredDiaries = q
    ? sortedDiaries.filter((d) => d.text.toLowerCase().includes(q) || d.date.includes(q))
    : sortedDiaries
  const filteredNotes = q
    ? sortedNotes.filter((n) => n.text.toLowerCase().includes(q))
    : sortedNotes

  const totalWords = data.diaries.reduce((s, d) => s + d.text.length, 0)

  const handleQuickAddNote = async () => {
    const t = noteDraft.trim()
    if (!t) return
    if (await saveNote({ text: t, color: noteColor })) {
      setNoteDraft('')
      notify('已贴上新便签 🗒️')
    }
  }

  const focusNoteInput = () => {
    const el = document.getElementById('journal-note-input') as HTMLInputElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  return (
    <div className="stagger-list space-y-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-slate-800">时光手账</h1>
          <p className="mt-0.5 text-xs text-slate-500">把平凡日子里的闪光碎片，温柔收藏</p>
        </div>
        <p className="text-xs text-slate-500 tabular-nums">
          {data.diaries.length} 篇日记 · {data.notes.length} 张便签
        </p>
      </header>

      {/* 🕰️ 时光回响胶囊：有历史时随机漫游，无历史时展示温柔空状态 */}
      {currentMemory ? (
        <section className="relative overflow-hidden rounded-3xl border border-white/35 bg-gradient-to-br from-amber-500 via-orange-400 to-rose-400 p-5 text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/95">
            <span className="font-semibold">🕰️ 时光回响 · {currentMemory.kind}</span>
            <div className="flex items-center gap-2">
              <span>{currentMemory.date} · {currentMemory.badge}</span>
              {memories.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCapsuleIdx((i) => i + 1)}
                  className="min-h-[36px] rounded-xl border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs transition duration-150 active:scale-95"
                >
                  🎲 换一段回忆
                </button>
              )}
            </div>
          </div>
          <p className="mt-2.5 line-clamp-3 text-[15px] leading-relaxed font-medium text-white">
            “{currentMemory.text}”
          </p>
        </section>
      ) : (
        <section className="glass-hero text-center">
          <p className="text-3xl">🕰️</p>
          <h2 className="mt-1.5 text-[17px] font-bold text-slate-800">时光回响还在等你写下第一笔</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
            当你记下日记、便签或心情后，这里会随机浮现过去的温柔片段，陪你回头看看走过的路 🌱
          </p>
          <button
            type="button"
            onClick={() => setEditingDiary('new')}
            className="btn-primary mt-3 text-xs"
          >
            ✍️ 写下第一段时光记忆
          </button>
        </section>
      )}

      {/* 三合一毛玻璃分段切换栏：岁月日记 / 灵感便签 / 情绪记录（热区 ≥44px） */}
      <div className="glass-pill flex items-center gap-1.5 rounded-2xl p-1.5">
        {(
          [
            ['diary', `📖 岁月日记 (${data.diaries.length})`],
            ['notes', `🗒️ 灵感便签 (${data.notes.length})`],
            ['mood', `💭 情绪流 (${data.moodLogs.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`min-h-[44px] flex-1 rounded-xl py-2 text-xs font-semibold whitespace-nowrap transition duration-150 ${
              subTab === id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 搜索与快捷新建工具条 */}
      {subTab !== 'mood' && (
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={subTab === 'diary' ? '🔍 搜索日记内容或日期…' : '🔍 搜索便签关键字…'}
            aria-label={subTab === 'diary' ? '搜索日记' : '搜索便签'}
            className="input flex-1 bg-white/90! text-[14px] dark:bg-slate-900/85!"
          />
          {subTab === 'diary' && (
            <button
              type="button"
              onClick={() => setEditingDiary('new')}
              className="btn-primary min-h-[44px] shrink-0 px-4 text-xs whitespace-nowrap"
            >
              ✍️ 写日记
            </button>
          )}
        </div>
      )}

      {/* 子视图 1：岁月日记 */}
      {subTab === 'diary' && (
        <div className="stagger-list space-y-4">
          {/* 写作灵感快捷条 */}
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-slate-800">✨ 今日写作灵感引导</h2>
              <span className="text-xs text-slate-500 tabular-nums">已累计写下 {totalWords} 字</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DIARY_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setEditingDiary({
                      id: '',
                      date: today,
                      text: p.template,
                      weather: '☀️ 晴朗',
                      mood: '😊 开心',
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    })
                  }
                  className="min-h-[48px] rounded-2xl bg-orange-50/90 px-3.5 py-2.5 text-left text-xs font-medium text-orange-600 transition duration-150 hover:bg-orange-100 active:scale-[0.98] dark:bg-slate-800 dark:text-orange-400"
                >
                  <p className="truncate text-[14px] font-semibold">{p.label}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">点按套用温和引导模板</p>
                </button>
              ))}
            </div>
          </section>

          {filteredDiaries.length === 0 ? (
            <div className="card py-8 text-center">
              <p className="text-3xl">🌙</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-700">
                {q ? '没有找到匹配的日记' : '还没有日记，一两句生活碎片也很珍贵'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {q ? '换个关键词试试，或清空搜索查看全部记录' : '不用追求长篇大论，写给未来的自己看就好'}
              </p>
              <button
                type="button"
                onClick={() => (q ? setSearch('') : setEditingDiary('new'))}
                className="btn-primary mt-4 text-xs"
              >
                {q ? '清空搜索条件' : '✍️ 写下第一篇日记'}
              </button>
            </div>
          ) : (
            <ul className="stagger-list space-y-4">
              {filteredDiaries.map((d) => (
                <li key={d.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 tabular-nums">
                      <span className="font-bold text-orange-500">
                        {formatDateCN(d.date)} 星期{weekdayCN(d.date)}
                      </span>
                      {d.weather && <span> · {d.weather}</span>}
                      {d.mood && <span> · {d.mood}</span>}
                      <span className="text-slate-400"> · {d.text.length} 字</span>
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditingDiary(d)}
                        className="min-h-[44px] min-w-[44px] rounded-xl px-3 py-2 font-medium text-slate-600 transition hover:bg-orange-50 hover:text-orange-500 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        编辑
                      </button>
                      {confirmDiaryId !== d.id ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDiaryId(d.id)}
                          className="min-h-[44px] min-w-[44px] rounded-xl px-3 py-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-slate-800"
                        >
                          删除
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (await deleteDiary(d.id)) {
                              setConfirmDiaryId(null)
                              notify('日记已删除')
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 子视图 2：灵感便签墙 */}
      {subTab === 'notes' && (
        <div className="stagger-list space-y-4">
          <section className="card">
            <h2 className="mb-2.5 text-[17px] font-bold text-slate-800">🗒️ 随手贴一张便签</h2>
            <div className="flex gap-2">
              <input
                id="journal-note-input"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleQuickAddNote()}
                placeholder="随手记下书单、灵感或备忘…"
                maxLength={500}
                className="input flex-1 bg-white! text-[14px] dark:bg-slate-800!"
              />
              <button
                type="button"
                onClick={() => void handleQuickAddNote()}
                disabled={!noteDraft.trim()}
                className="btn-primary min-h-[44px] shrink-0 px-4 text-xs disabled:opacity-40"
              >
                贴上墙
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="mr-1 text-xs text-slate-500">纸张色</span>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNoteColor(c.id)}
                    aria-label={`选择${c.name}色`}
                    className="grid h-11 w-11 place-items-center rounded-xl transition hover:bg-orange-50/60 dark:hover:bg-slate-800"
                  >
                    <span
                      className={`h-6 w-6 rounded-full border ${c.card} ${
                        noteColor === c.id ? 'scale-110 ring-2 ring-orange-400' : 'opacity-75'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">支持置顶与点击编辑</span>
            </div>
          </section>

          {filteredNotes.length === 0 ? (
            <div className="card py-8 text-center">
              <p className="text-3xl">🗂️</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-700">
                {q ? '没有找到匹配的便签' : '便签墙上还空着呢'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {q ? '换个关键词试试吧' : '想到什么书单、电影或闪光点子，随时贴一张在墙上'}
              </p>
              <button
                type="button"
                onClick={() => (q ? setSearch('') : focusNoteInput())}
                className="btn-primary mt-4 text-xs"
              >
                {q ? '清空搜索条件' : '🗒️ 贴上第一张便签'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              {filteredNotes.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-3xl border p-5 text-left shadow-xs transition duration-150 ${noteColorClass(n.color)}`}
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{n.pinned ? '📌 已置顶' : formatDateCN(dateStr(new Date(n.updatedAt)))}</span>
                    <button
                      type="button"
                      onClick={() => void togglePinNote(n.id)}
                      className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-black/5 hover:text-orange-600 dark:text-slate-300"
                    >
                      {n.pinned ? '取消置顶' : '📌 置顶'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingNote(n)}
                    className="block w-full text-left"
                  >
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
                      {n.text}
                    </p>
                    <p className="mt-3 text-xs text-slate-400 tabular-nums">
                      {formatTime(n.updatedAt)} · 点按编辑
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 子视图 3：情绪时间线 */}
      {subTab === 'mood' && <MoodSection onWrite={() => setMoodOpen(true)} />}

      {/* 日记编辑弹窗 */}
      <InlineDiaryModal
        entry={editingDiary}
        today={today}
        onClose={() => setEditingDiary(null)}
        onSave={async (input) => {
          const ok = await saveDiary(input)
          if (!ok) return false
          setEditingDiary(null)
          showQuote('mood')
          return true
        }}
      />

      {/* 便签编辑弹窗 */}
      <InlineNoteModal
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSave={saveNote}
        onDelete={deleteNote}
        notify={notify}
      />

      {/* 心情记录弹窗 */}
      <MoodModal
        open={moodOpen}
        mode="diary"
        onClose={() => setMoodOpen(false)}
        onSubmit={async (input) => {
          const ok = await addMoodLog(input)
          if (!ok) return false
          setMoodOpen(false)
          showQuote('mood')
          return true
        }}
      />
    </div>
  )
}

function InlineDiaryModal({
  entry,
  today,
  onClose,
  onSave,
}: {
  entry: DiaryEntry | 'new' | null
  today: string
  onClose: () => void
  onSave: (input: { id?: string; date: string; text: string; weather?: string; mood?: string }) => Promise<boolean>
}) {
  const [date, setDate] = useState(today)
  const [text, setText] = useState('')
  const [weather, setWeather] = useState('☀️ 晴朗')
  const [mood, setMood] = useState('😊 开心')
  const [saving, setSaving] = useState(false)

  const key = entry === 'new' ? 'new' : entry ? `${entry.id}-${entry.text.slice(0, 12)}` : 'closed'
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

  return (
    <Modal open={entry !== null} onClose={onClose} closeOnBackdrop={false}>
      <p className="text-center text-[18px] font-bold text-slate-800">
        {entry === 'new' || !entry?.id ? '写日记 ✍️' : '编辑日记'}
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
                weather === w.label ? 'bg-orange-500 text-white' : 'bg-orange-50 text-slate-600 dark:bg-slate-800'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">心情</span>
          {MOOD_OPTIONS.map((m) => {
            const stamp = `${m.emoji} ${m.label}`
            return (
              <button
                key={m.emoji}
                type="button"
                onClick={() => setMood(stamp)}
                className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs transition ${
                  mood === stamp ? 'bg-orange-500 text-white' : 'bg-orange-50 text-slate-600 dark:bg-slate-800'
                }`}
              >
                {stamp}
              </button>
            )
          })}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="写下今天的生活片段或心情…"
        maxLength={2000}
        rows={5}
        className="input mt-3 w-full resize-none leading-relaxed"
      />
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
          disabled={!canSave}
          onClick={async () => {
            if (!entry || !canSave) return
            setSaving(true)
            try {
              await onSave({
                id: entry === 'new' || !entry.id ? undefined : entry.id,
                date,
                text: text.trim(),
                weather,
                mood,
              })
            } finally {
              setSaving(false)
            }
          }}
          className="btn-primary min-h-[44px] flex-1 disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存日记'}
        </button>
      </div>
    </Modal>
  )
}

function InlineNoteModal({
  note,
  onClose,
  onSave,
  onDelete,
  notify,
}: {
  note: Note | null
  onClose: () => void
  onSave: (input: { id?: string; text: string; color?: string; pinned?: boolean }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  notify: (msg: string) => void
}) {
  const [text, setText] = useState('')
  const [color, setColor] = useState('amber')
  const [pinned, setPinned] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const key = note?.id ?? 'closed'
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setConfirmDel(false)
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
        className="input mt-3 w-full resize-none leading-relaxed"
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              aria-label={`选择${c.name}`}
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
          className={`min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-medium ${
            pinned ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          📌 {pinned ? '已置顶' : '置顶'}
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        {!confirmDel ? (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="min-h-[44px] rounded-2xl bg-slate-100 px-4 py-2.5 text-[14px] text-red-500 dark:bg-slate-800"
          >
            删除
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              if (note && (await onDelete(note.id))) {
                notify('便签已删除')
                onClose()
              }
            }}
            className="min-h-[44px] rounded-2xl bg-red-500 px-4 py-2.5 text-[14px] font-semibold text-white"
          >
            确认删除
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-2xl bg-slate-100 px-4 py-2.5 text-[14px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          取消
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={async () => {
            if (note && (await onSave({ id: note.id, text: text.trim(), color, pinned }))) {
              notify('便签已保存')
              onClose()
            }
          }}
          className="btn-primary min-h-[44px] flex-1"
        >
          保存
        </button>
      </div>
    </Modal>
  )
}
