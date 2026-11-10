import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Repeat, Task, TaskCategory } from '../../data/types'
import { HABIT_TEMPLATES, TASK_CATEGORIES, getCategoryMeta } from '../../data/presets'
import { formatDateCN, formatTime } from '../../lib/date'
import { getTaskStreak, getTaskTotalCount, getTodayStatus } from '../../lib/stats'
import { Modal } from '../../components/Modal'
import { useData } from '../../store/DataContext'
import { burstAt } from '../rewards/celebrate'
import { hapticTap } from '../../lib/haptics'

/** 快速添加：默认紧凑精炼，支持展开分类与灵感习惯库一键选用 */
export function QuickAdd() {
  const ctx = useData()
  const [title, setTitle] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('daily')
  const [category, setCategory] = useState<TaskCategory>('health')
  const [showTemplates, setShowTemplates] = useState(false)
  const [adding, setAdding] = useState(false)
  if (!ctx) return null
  const { addTask, data, notify } = ctx

  const existingTitles = new Set(data.tasks.filter((t) => !t.archived).map((t) => t.title))

  const submit = async () => {
    const t = title.trim()
    if (!t || adding) return
    setAdding(true)
    try {
      const ok = await addTask(t, repeat, category)
      if (ok) {
        setTitle('')
        notify(`已添加「${t}」🌱`)
      }
    } finally {
      setAdding(false)
    }
  }

  const pickTemplate = async (tpl: (typeof HABIT_TEMPLATES)[number]) => {
    if (existingTitles.has(tpl.title) || adding) return
    setAdding(true)
    try {
      const ok = await addTask(tpl.title, tpl.repeat, tpl.category)
      if (ok) {
        hapticTap()
        notify(`已从习惯库添加「${tpl.title}」✨`)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold text-slate-800">➕ 添加新习惯或待办</h2>
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="min-h-[44px] rounded-2xl bg-amber-50 px-3.5 py-2 text-xs font-semibold text-orange-600 transition duration-150 hover:bg-amber-100/80 active:scale-95 dark:bg-slate-800 dark:text-orange-400"
        >
          {showTemplates ? '收起习惯库 ▲' : '✨ 灵感习惯库'}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          id="quick-add-task-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="输入一件想做的小事，回车即添加…"
          aria-label="新任务名称"
          maxLength={36}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!title.trim() || adding}
          className="btn-primary min-h-[44px] shrink-0 px-5 whitespace-nowrap disabled:opacity-40"
        >
          {adding ? '添加中' : '添加'}
        </button>
      </div>

      {/* 周期选择 */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">打卡频率与分类</span>
        <div className="flex items-center gap-1 rounded-2xl bg-orange-50/90 p-1 dark:bg-slate-800">
          {(
            [
              ['daily', '每日习惯'],
              ['once', '单次待办'],
            ] as const
          ).map(([r, label]) => (
            <button
              key={r}
              type="button"
              onClick={() => setRepeat(r)}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                repeat === r
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 分类按钮组：5 等分网格确保移动端不裁切，高度 ≥44px */}
      <div className="mt-2.5 grid grid-cols-5 gap-1.5">
        {TASK_CATEGORIES.map((c) => {
          const active = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`min-h-[44px] rounded-xl px-1 py-2 text-center text-xs font-medium whitespace-nowrap transition duration-150 ${
                active
                  ? 'bg-slate-800 text-white dark:bg-orange-500 dark:text-white'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/80 dark:text-slate-300'
              }`}
            >
              {c.icon} {c.label}
            </button>
          )
        })}
      </div>

      {/* 灵感习惯库抽屉 */}
      {showTemplates && (
        <div className="anim-fade-in mt-4 border-t border-orange-100/70 pt-3.5 dark:border-slate-700/70">
          <p className="mb-2.5 text-xs text-slate-500">挑一件无压力的微习惯，点按即可加入清单：</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HABIT_TEMPLATES.map((tpl) => {
              const added = existingTitles.has(tpl.title)
              const meta = getCategoryMeta(tpl.category)
              return (
                <button
                  key={tpl.title}
                  type="button"
                  disabled={added || adding}
                  onClick={() => void pickTemplate(tpl)}
                  className={`flex min-h-[52px] items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition duration-150 ${
                    added
                      ? 'border-slate-100 bg-slate-50/70 opacity-60 dark:border-slate-800 dark:bg-slate-800/40'
                      : 'border-orange-100/80 bg-orange-50/40 hover:border-orange-300 hover:bg-orange-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800/70'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                      {meta.icon} {tpl.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {tpl.repeat === 'daily' ? '每日' : '单次'} · {tpl.desc}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-orange-500">
                    {added ? '已在列表' : '+ 添加'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

interface TaskListProps {
  /** 打卡成功后通知父级（今日打卡弹心情引导，补打卡弹温柔鼓励） */
  onChecked: (task: Task, isRetroactive?: boolean) => void
  /** 点击某任务的专注按钮 */
  onStartFocus: (task: Task) => void
}

/**
 * 任务列表（借鉴 Finch 实体卡片质感 + timespent 清爽分区）：
 * - 每条待办是一张独立的圆角微卡片，左侧分类图标，中部清晰标题与连胜，右侧 +10⚡ 能量提示与 44×44px 勾选方块
 * - 支持按分类筛选、历史日期补打卡（带彩带与回弹动效）与番茄专注直达
 */
export function TaskList({ onChecked, onStartFocus }: TaskListProps) {
  const ctx = useData()
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftCategory, setDraftCategory] = useState<TaskCategory>('life')
  const [draftRepeat, setDraftRepeat] = useState<Repeat>('daily')
  const [filterCat, setFilterCat] = useState<TaskCategory | 'all'>('all')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [justCheckedId, setJustCheckedId] = useState<string | null>(null)
  const [undoTask, setUndoTask] = useState<Task | null>(null)
  const busyIds = useRef(new Set<string>())
  const undoTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  if (!ctx) return null
  const { data, today, selectedDate, setSelectedDate, toggleCheckIn, updateTask, deleteTask, setArchived, resetData, notify } = ctx

  const activeDate = selectedDate || today
  const isViewingPast = activeDate !== today
  const status = getTodayStatus(data.tasks, data.checkIns, activeDate)
  const menuTask = data.tasks.find((t) => t.id === menuId) ?? null

  const filteredPending =
    filterCat === 'all'
      ? status.pending
      : status.pending.filter((t) => (t.category ?? 'life') === filterCat)

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
      const result = await toggleCheckIn(task.id, activeDate)
      if (result === 'added') {
        setUndoTask(null)
        setJustCheckedId(task.id)
        window.setTimeout(() => setJustCheckedId((curr) => (curr === task.id ? null : curr)), 450)
        burstAt(x, y)
        hapticTap()
        if (!isViewingPast) {
          onChecked(task, false)
        } else {
          notify(`🎉 已补卡 ${formatDateCN(activeDate)}「${task.title}」，每一份认真都算数 ✨`)
          onChecked(task, true)
        }
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
    const result = await toggleCheckIn(task.id, activeDate)
    if (result === 'added') hapticTap()
  }

  const closeMenu = () => {
    setMenuId(null)
    setEditing(false)
    setConfirmDelete(false)
  }

  const focusQuickAddInput = () => {
    const el = document.getElementById('quick-add-task-input') as HTMLInputElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  return (
    <>
      {/* 历史补卡模式提醒条 */}
      {isViewingPast && (
        <div className="anim-fade-in mb-4 flex items-center justify-between gap-2 rounded-3xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-xs text-amber-900 shadow-2xs dark:border-amber-800/70 dark:bg-amber-950/70 dark:text-amber-100">
          <span>📅 正在查看 {formatDateCN(activeDate)}，点右侧「✓」即可补打卡</span>
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="min-h-[44px] shrink-0 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition active:scale-95"
          >
            回到今天
          </button>
        </div>
      )}

      {/* 核心打卡清单（统一 p-5 卡片，内含独立呼吸感任务卡） */}
      <section className="card">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-slate-800 tabular-nums">
              {isViewingPast ? `${formatDateCN(activeDate)}打卡清单` : '🎯 今日待完成'}
            </h2>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              · 剩余 {filteredPending.length} 项（已完成 {status.completed}/{status.total}）
            </span>
          </div>

          {/* 分类筛选按钮栏 */}
          {status.total > 0 && (
            <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1">
              <button
                type="button"
                onClick={() => setFilterCat('all')}
                className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition duration-150 ${
                  filterCat === 'all'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-500 hover:bg-orange-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                全部
              </button>
              {TASK_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilterCat(c.id)}
                  className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition duration-150 ${
                    filterCat === c.id
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-500 hover:bg-orange-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredPending.length === 0 ? (
          <div className="rounded-2xl bg-orange-50/55 px-4 py-6 text-center dark:bg-slate-800/55">
            <p className="text-3xl">{status.total === 0 ? '🌱' : '🎉'}</p>
            <p className="mt-2 text-[15px] font-semibold text-slate-700">
              {status.total === 0
                ? '今天还没有安排小事，从最轻松的一件开始吧'
                : filterCat !== 'all'
                  ? '这个分类下的小事都完成啦，真棒'
                  : '今天的小事全部搞定啦，为你鼓掌'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {status.total === 0
                ? '哪怕只是喝一杯温水、散步 10 分钟，也值得被记下'
                : '享受属于你的轻松时刻，或者再添一件小事'}
            </p>
            <div className="mt-3.5 flex flex-wrap justify-center gap-2">
              {status.total === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={focusQuickAddInput}
                    className="btn-primary text-xs"
                  >
                    ➕ 添加第一件小事
                  </button>
                  {data.tasks.length === 0 && (
                    <button
                      type="button"
                      onClick={() => void resetData('seed')}
                      className="min-h-[44px] rounded-2xl bg-orange-100 px-4 py-2.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-200/70 dark:bg-slate-800 dark:text-orange-400"
                    >
                      ✨ 载入示例习惯
                    </button>
                  )}
                </>
              ) : filterCat !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setFilterCat('all')}
                  className="min-h-[44px] rounded-2xl bg-orange-100 px-4 py-2.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-200/70 dark:bg-slate-800 dark:text-orange-400"
                >
                  查看全部分类
                </button>
              ) : (
                <button
                  type="button"
                  onClick={focusQuickAddInput}
                  className="min-h-[44px] rounded-2xl bg-orange-100 px-4 py-2.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-200/70 dark:bg-slate-800 dark:text-orange-400"
                >
                  ➕ 再加一件小事
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filteredPending.map((t) => {
              const meta = getCategoryMeta(t.category)
              const tStreak = getTaskStreak(t.id, data.checkIns, today)
              const tTotal = getTaskTotalCount(t.id, data.checkIns)
              return (
                <li
                  key={t.id}
                  className="glass-subcard flex items-center gap-2 rounded-2xl px-3 py-2.5 hover:border-orange-300"
                >
                  {/* 左侧任务标题（带分类图标） + 元信息，留足宽度确保移动端完整展示不截断 */}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-800">
                      <span aria-hidden="true" className="mr-1.5">{meta.icon}</span>
                      <span>{t.title}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                      <span>{meta.label} · {t.repeat === 'daily' ? '每日' : '单次'}</span>
                      {tStreak > 0 ? (
                        <span className="font-semibold text-orange-500">· 🔥 {tStreak}天</span>
                      ) : tTotal > 0 ? (
                        <span>· 累计 {tTotal} 次</span>
                      ) : null}
                      <span className="font-semibold text-amber-600 dark:text-amber-400">· +10⚡</span>
                    </p>
                  </div>

                  {/* 右侧操作组：紧凑间距 gap-1，全部保持 44×44px 热区 */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onStartFocus(t)}
                      aria-label={`专注「${t.title}」`}
                      title="开启番茄专注"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50/85 text-base text-orange-600 transition duration-150 hover:bg-orange-100 active:scale-95 dark:bg-slate-700/75 dark:text-orange-300"
                    >
                      🍅
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(t.id)
                        setEditing(false)
                        setConfirmDelete(false)
                      }}
                      aria-label={`「${t.title}」更多操作`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base text-slate-400 transition duration-150 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      ⋯
                    </button>

                    <button
                      type="button"
                      onClick={(e) => void handleCheck(t, e)}
                      disabled={pendingIds.has(t.id)}
                      aria-label={isViewingPast ? `补打卡「${t.title}」` : `完成「${t.title}」`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-orange-300/90 bg-orange-50/95 text-base font-bold text-orange-500 shadow-2xs transition duration-150 hover:border-orange-500 hover:bg-orange-500 hover:text-white active:scale-90 disabled:opacity-40 dark:border-orange-500/45 dark:bg-slate-700 dark:text-orange-400 dark:hover:bg-orange-500 dark:hover:text-white"
                    >
                      {pendingIds.has(t.id) ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                      ) : (
                        <span>✓</span>
                      )}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* 已完成清单（清爽收纳在卡片底部） */}
        {status.doneToday.length > 0 && (
          <div className="mt-4 border-t border-orange-100/70 pt-3.5 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold text-slate-500 tabular-nums">
              ✅ {isViewingPast ? `${formatDateCN(activeDate)}已完成` : '今日已完成'} · {status.doneToday.length}
            </p>
            <ul className="space-y-2">
              {status.doneToday.map(({ task, checkIn }) => {
                const meta = getCategoryMeta(task.category)
                const tStreak = getTaskStreak(task.id, data.checkIns, today)
                const isJustChecked = justCheckedId === task.id
                return (
                  <li
                    key={checkIn.id}
                    className="flex items-center gap-2.5 rounded-2xl bg-orange-50/45 px-2.5 py-2 dark:bg-slate-800/50"
                  >
                    <button
                      type="button"
                      onClick={(e) => void handleCheck(task, e)}
                      disabled={pendingIds.has(task.id)}
                      aria-label={`撤销「${task.title}」的完成`}
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-500 text-white shadow-2xs transition-transform duration-150 active:scale-90 disabled:opacity-40 ${
                        isJustChecked ? 'anim-pop' : ''
                      }`}
                    >
                      <span className="anim-pop text-sm font-bold">✓</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-slate-500 line-through">{task.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-400 tabular-nums">
                        <span>{meta.icon} {meta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTime(checkIn.completedAt)} 完成</span>
                        {tStreak > 1 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-orange-500">连胜 {tStreak} 天</span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(task.id)
                        setEditing(false)
                        setConfirmDelete(false)
                      }}
                      aria-label={`「${task.title}」更多操作`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base text-slate-400 transition duration-150 hover:bg-orange-50 active:bg-orange-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      ⋯
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 撤销提示：误点后 5 秒内可恢复，不弹出打断式确认框 */}
      {undoTask && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 px-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-[14px] text-white shadow-xl">
            <span className="min-w-0 flex-1 truncate">已撤销「{undoTask.title}」</span>
            <button
              type="button"
              onClick={() => void undo()}
              className="min-h-[44px] shrink-0 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-semibold text-orange-200"
            >
              恢复打卡
            </button>
          </div>
        </div>
      )}

      {/* 任务操作弹层：编辑 / 专注 / 归档 / 删除 */}
      <Modal open={!!menuTask} onClose={closeMenu} closeOnBackdrop={!editing}>
        {menuTask && !editing && (
          <>
            <p className="mb-1 text-center text-[18px] font-bold text-slate-800">{menuTask.title}</p>
            <p className="mb-4 text-center text-xs text-slate-500 tabular-nums">
              {getCategoryMeta(menuTask.category).icon} {getCategoryMeta(menuTask.category).label} ·{' '}
              {menuTask.repeat === 'daily' ? '每日习惯' : '单次待办'} · 累计打卡{' '}
              {getTaskTotalCount(menuTask.id, data.checkIns)} 次
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                className="sheet-btn"
                onClick={() => {
                  const target = menuTask
                  closeMenu()
                  onStartFocus(target)
                }}
              >
                🍅 开启番茄专注
              </button>
              <button
                type="button"
                className="sheet-btn"
                onClick={() => {
                  setDraftTitle(menuTask.title)
                  setDraftCategory(menuTask.category ?? 'life')
                  setDraftRepeat(menuTask.repeat)
                  setEditing(true)
                }}
              >
                ✏️ 编辑名称与分类
              </button>
              <button
                type="button"
                className="sheet-btn"
                onClick={async () => {
                  if (await setArchived(menuTask.id, true)) {
                    notify(`已归档「${menuTask.title}」`)
                    closeMenu()
                  }
                }}
              >
                📦 归档（移出今日列表，保留历史）
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="sheet-btn text-red-500"
                  onClick={() => setConfirmDelete(true)}
                >
                  🗑 删除任务
                </button>
              ) : (
                <button
                  type="button"
                  className="sheet-btn bg-red-500! font-semibold text-white!"
                  onClick={async () => {
                    const name = menuTask.title
                    if (await deleteTask(menuTask.id)) {
                      notify(`已删除「${name}」`)
                      closeMenu()
                    }
                  }}
                >
                  确认删除「{menuTask.title}」（打卡统计保留）
                </button>
              )}
              <button type="button" className="sheet-btn text-slate-500" onClick={closeMenu}>
                取消
              </button>
            </div>
          </>
        )}
        {menuTask && editing && (
          <>
            <p className="mb-3 text-center text-[18px] font-bold text-slate-800">编辑任务</p>
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={36}
              className="input w-full"
            />
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-slate-500">周期</span>
              {(
                [
                  ['daily', '每日习惯'],
                  ['once', '单次待办'],
                ] as const
              ).map(([r, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDraftRepeat(r)}
                  className={`min-h-[44px] rounded-xl px-3.5 py-2 font-medium transition ${
                    draftRepeat === r
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TASK_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDraftCategory(c.id)}
                  className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium transition ${
                    draftCategory === c.id
                      ? 'bg-slate-800 text-white dark:bg-orange-500'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-[44px] shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => setEditing(false)}
              >
                返回
              </button>
              <button
                type="button"
                className="btn-primary min-h-[44px] flex-1 disabled:opacity-40"
                disabled={!draftTitle.trim()}
                onClick={async () => {
                  if (
                    await updateTask(menuTask.id, {
                      title: draftTitle.trim(),
                      category: draftCategory,
                      repeat: draftRepeat,
                    })
                  ) {
                    notify('已保存任务修改')
                    closeMenu()
                  }
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
