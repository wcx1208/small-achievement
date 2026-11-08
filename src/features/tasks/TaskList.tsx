import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Repeat, Task } from '../../data/types'
import { formatTime } from '../../lib/date'
import { getTodayStatus } from '../../lib/stats'
import { Modal } from '../../components/Modal'
import { useData } from '../../store/DataContext'
import { burstAt } from '../rewards/celebrate'
import { hapticTap } from '../../lib/haptics'

/** 快速添加：一句话 + 单次/每日 切换 */
export function QuickAdd() {
  const ctx = useData()
  const [title, setTitle] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('once')
  const [adding, setAdding] = useState(false)
  if (!ctx) return null
  const { addTask } = ctx

  const submit = async () => {
    const t = title.trim()
    if (!t || adding) return
    setAdding(true)
    try {
      const ok = await addTask(t, repeat)
      if (ok) setTitle('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="card">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="想完成点什么？一句话就行"
          maxLength={30}
          className="input flex-1"
        />
        <button onClick={() => void submit()} disabled={!title.trim() || adding} className="btn-primary shrink-0 px-4 disabled:opacity-40">
          {adding ? '添加中' : '添加'}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-400">类型</span>
        {(
          [
            ['once', '单次'],
            ['daily', '每日重复'],
          ] as const
        ).map(([r, label]) => (
          <button
            key={r}
            onClick={() => setRepeat(r)}
            className={`rounded-full px-3 py-1 transition-colors ${
              repeat === r
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-orange-100/70 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface TaskListProps {
  /** 打卡成功后通知父级（用于弹出心情记录） */
  onChecked: (task: Task) => void
}

/** 今日任务列表：待完成 / 已完成 分区 */
export function TaskList({ onChecked }: TaskListProps) {
  const ctx = useData()
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [undoTask, setUndoTask] = useState<Task | null>(null)
  const busyIds = useRef(new Set<string>())
  const undoTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  if (!ctx) return null
  const { data, today, toggleCheckIn, renameTask, deleteTask, setArchived } = ctx

  const status = getTodayStatus(data.tasks, data.checkIns, today)
  const menuTask = data.tasks.find((t) => t.id === menuId) ?? null

  const showUndo = (task: Task) => {
    window.clearTimeout(undoTimer.current)
    setUndoTask(task)
    undoTimer.current = window.setTimeout(() => setUndoTask(null), 5000)
  }

  const handleCheck = async (task: Task, e: MouseEvent<HTMLButtonElement>) => {
    if (busyIds.current.has(task.id)) return
    busyIds.current.add(task.id)
    setPendingIds(new Set(busyIds.current))
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX || rect.left + rect.width / 2
    const y = e.clientY || rect.top + rect.height / 2
    try {
      const result = await toggleCheckIn(task.id)
      if (result === 'added') {
        setUndoTask(null)
        burstAt(x, y)
        hapticTap()
        onChecked(task)
      } else if (result === 'removed') {
        showUndo(task)
      }
    } finally {
      busyIds.current.delete(task.id)
      setPendingIds(new Set(busyIds.current))
    }
  }

  const undo = async () => {
    const task = undoTask
    if (!task) return
    setUndoTask(null)
    window.clearTimeout(undoTimer.current)
    const result = await toggleCheckIn(task.id)
    if (result === 'added') hapticTap()
  }

  const closeMenu = () => {
    setMenuId(null)
    setEditing(false)
  }

  return (
    <>
      {/* 待完成 */}
      <section className="card">
        <h2 className="mb-1 text-sm font-bold text-slate-700">待完成 · {status.pending.length}</h2>
        {status.pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            {status.total === 0 ? '添加一件今天想做的小事吧 🌱' : '都完成啦，今天真棒 🎉'}
          </p>
        ) : (
          <ul className="divide-y divide-orange-50">
            {status.pending.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-2.5">
                <button
                  onClick={(e) => void handleCheck(t, e)}
                  disabled={pendingIds.has(t.id)}
                  aria-label={`完成「${t.title}」`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-orange-300 transition-transform hover:bg-orange-50 active:scale-90 disabled:opacity-40"
                >
                  {pendingIds.has(t.id) && <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-300 border-t-transparent" />}
                </button>
                <span className="flex-1 text-[15px]">{t.title}</span>
                {t.repeat === 'daily' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                    每日
                  </span>
                )}
                <button
                  onClick={() => setMenuId(t.id)}
                  aria-label={`「${t.title}」更多操作`}
                  className="grid h-11 w-11 place-items-center rounded-full text-lg text-slate-300 active:bg-orange-50 dark:text-slate-600"
                >
                  ⋯
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 已完成（仅展示今天的完成记录） */}
      {status.doneToday.length > 0 && (
        <section className="card">
          <h2 className="mb-1 text-sm font-bold text-slate-700">已完成 · {status.doneToday.length}</h2>
          <ul className="divide-y divide-orange-50">
            {status.doneToday.map(({ task, checkIn }) => (
              <li key={checkIn.id} className="flex items-center gap-2 py-2.5">
                <button
                  onClick={(e) => void handleCheck(task, e)}
                  disabled={pendingIds.has(task.id)}
                  aria-label={`撤销「${task.title}」的完成`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500 transition-transform active:scale-90 disabled:opacity-40"
                >
                  <span className="anim-pop text-xs text-white">✓</span>
                </button>
                <span className="flex-1 text-[15px] text-slate-400 line-through">{task.title}</span>
                <span className="text-[11px] text-slate-400">{formatTime(checkIn.completedAt)}</span>
                <button
                  onClick={() => setMenuId(task.id)}
                  aria-label={`「${task.title}」更多操作`}
                  className="grid h-11 w-11 place-items-center rounded-full text-lg text-slate-300 active:bg-orange-50 dark:text-slate-600"
                >
                  ⋯
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 撤销提示：误点后 5 秒内可恢复，不弹出打断式确认框 */}
      {undoTask && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 px-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-white shadow-xl">
            <span className="min-w-0 flex-1 truncate">已撤销「{undoTask.title}」</span>
            <button onClick={() => void undo()} className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-orange-200">
              撤销
            </button>
          </div>
        </div>
      )}

      {/* 任务操作弹层：重命名 / 归档 / 删除 */}
      <Modal open={!!menuTask} onClose={closeMenu} closeOnBackdrop={!editing}>
        {menuTask && !editing && (
          <>
            <p className="mb-4 text-center font-semibold">{menuTask.title}</p>
            <div className="space-y-2">
              <button
                className="sheet-btn"
                onClick={() => {
                  setDraftTitle(menuTask.title)
                  setEditing(true)
                }}
              >
                ✏️ 重命名
              </button>
              <button
                className="sheet-btn"
                onClick={async () => {
                  if (await setArchived(menuTask.id, true)) closeMenu()
                }}
              >
                📦 归档（不再出现在今日列表）
              </button>
              <button
                className="sheet-btn text-red-500"
                onClick={async () => {
                  if (window.confirm(`确定删除「${menuTask.title}」吗？打卡历史会保留在统计里。`)) {
                    if (await deleteTask(menuTask.id)) closeMenu()
                  }
                }}
              >
                🗑 删除任务
              </button>
              <button className="sheet-btn text-slate-400" onClick={closeMenu}>
                取消
              </button>
            </div>
          </>
        )}
        {menuTask && editing && (
          <>
            <p className="mb-3 text-center font-semibold">重命名任务</p>
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && draftTitle.trim() && draftTitle.trim() !== menuTask.title) {
                  if (await renameTask(menuTask.id, draftTitle.trim())) closeMenu()
                }
              }}
              maxLength={30}
              className="input w-full"
            />
            <div className="mt-4 flex gap-2">
              <button className="shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-500 dark:bg-slate-800" onClick={() => setEditing(false)}>
                返回
              </button>
              <button
                className="btn-primary flex-1 disabled:opacity-40"
                disabled={!draftTitle.trim() || draftTitle.trim() === menuTask.title}
                onClick={async () => {
                  if (await renameTask(menuTask.id, draftTitle.trim())) closeMenu()
                }}
              >
                保存
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
