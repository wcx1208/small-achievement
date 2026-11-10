import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { DEFAULT_TAGS, MOOD_OPTIONS } from '../../data/presets'
import { todayStr } from '../../lib/date'
import { useData } from '../../store/DataContext'
import type { MoodInput } from '../../store/DataContext'

interface MoodModalProps {
  open: boolean
  /** checkin：完成打卡后的轻量引导；diary：主动写日记（带日期与标签） */
  mode: 'checkin' | 'diary'
  taskTitle?: string
  initialIdx?: number | null
  onClose: () => void
  onSubmit?: (input: Omit<MoodInput, 'relatedTaskId'>) => Promise<boolean | void> | boolean | void
  /** 打卡模式下点「跳过」的回调（区别于右上角关闭） */
  onSkip?: () => void
}

/** 心情记录弹窗：5 档 emoji + 一句话感受；日记模式额外支持日期补记与标签 */
export function MoodModal({ open, mode, taskTitle, initialIdx = null, onClose, onSubmit, onSkip }: MoodModalProps) {
  const ctx = useData()
  if (!ctx) return null
  const { data, selectedDate } = ctx
  const [idx, setIdx] = useState<number | null>(initialIdx)
  const [text, setText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [date, setDate] = useState(selectedDate || todayStr())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setIdx(initialIdx ?? null)
      setText('')
      setTags([])
      setCustom('')
      setDate(selectedDate || todayStr())
      setSaving(false)
    }
  }, [open, initialIdx, selectedDate])

  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  const addCustom = () => {
    const t = custom.trim()
    if (t && !tags.includes(t)) setTags((ts) => [...ts, t])
    setCustom('')
  }

  const allTags = [...DEFAULT_TAGS, ...data.settings.customTags.filter((t) => !DEFAULT_TAGS.includes(t))]

  const save = async () => {
    if (idx === null || saving) return
    const opt = MOOD_OPTIONS[idx]
    setSaving(true)
    try {
      await onSubmit?.({ date, emoji: opt.emoji, score: opt.score, tags, text: text.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={false}>
      <div className="text-center">
        <h3 className="text-[18px] font-bold text-slate-800">
          {mode === 'checkin' ? '完成啦！🎉' : '记录此刻心情 ✏️'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {mode === 'checkin'
            ? `「${taskTitle}」已打卡，顺手记一下此刻的心情吧（可跳过）`
            : '此刻或过去某一天的感受，都值得被温柔记下'}
        </p>
      </div>

      {/* 心情 5 档（热区 ≥48×48px） */}
      <div className="mt-4 flex items-center justify-between px-1">
        {MOOD_OPTIONS.map((m, i) => (
          <button
            key={m.emoji}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={m.label}
            className={`grid h-12 w-12 place-items-center rounded-full text-3xl transition-all duration-150 ${
              idx === i
                ? 'scale-110 bg-orange-100 ring-2 ring-orange-400 dark:bg-slate-800'
                : 'opacity-75 hover:opacity-100'
            }`}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 text-center text-xs font-medium text-orange-500">
        {idx !== null ? MOOD_OPTIONS[idx].label : ''}
      </p>

      {mode === 'diary' && (
        <>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            📅 日期
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value || todayStr())}
              className="input flex-1 py-2 text-[14px]"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  tags.includes(t)
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-100/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="自定义心情标签…"
              maxLength={10}
              className="input flex-1 py-2 text-[14px]"
            />
            <button
              type="button"
              onClick={addCustom}
              className="min-h-[44px] shrink-0 rounded-2xl bg-orange-100 px-4 text-xs font-semibold text-orange-600 dark:bg-slate-800 dark:text-orange-400"
            >
              添加标签
            </button>
          </div>
        </>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="写一句话给自己吧（可不填）"
        maxLength={120}
        rows={2}
        className="input mt-3 w-full resize-none"
      />

      <div className="mt-4 flex gap-2">
        {mode === 'checkin' ? (
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            跳过
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            取消
          </button>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={idx === null || saving}
          className="btn-primary min-h-[44px] flex-1 disabled:opacity-40"
        >
          {saving ? '保存中…' : `保存${idx !== null && text.trim() ? ' ✨' : ''}`}
        </button>
      </div>
    </Modal>
  )
}
