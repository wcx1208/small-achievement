import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useData } from '../store/DataContext'
import { BADGES, BADGE_MAP, badgeStats } from '../data/badges'
import { DEFAULT_WALLPAPER_ID, WALLPAPERS, findPreset } from '../data/presets'
import { quoteOfTheDay } from '../data/quotes'
import type { AppData, ThemeMode } from '../data/types'
import { formatDateCN, formatTime, dateStr, todayStr, weekdayCN } from '../lib/date'
import { focusSummary, getGrowthLevel, getStreak, getTodayStatus } from '../lib/stats'
import { CropModal } from '../components/CropModal'
import { Modal } from '../components/Modal'
import { normalizeBackup } from '../storage'

const REMINDER_ID = 1001
const MAX_IMAGE_FILE_BYTES = 15 * 1024 * 1024

/** 每天固定时刻提醒打卡（覆盖旧的定时任务） */
async function scheduleReminder(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  await cancelReminder()
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: '小成就 🍊',
        body: '今天的小事都完成了吗？去记一笔，给自己一点正反馈。',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  })
}

async function cancelReminder() {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
}

/** 安卓 12+ 需要单独允许精确闹钟；即使未允许也继续安排，系统可能延迟投递 */
async function requestExactAlarmPermission() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const status = await LocalNotifications.checkExactNotificationSetting()
    if (status.exact_alarm === 'granted') return true
    const changed = await LocalNotifications.changeExactNotificationSetting()
    return changed.exact_alarm === 'granted'
  } catch {
    return false
  }
}

/** 我的页：徽章墙（带未解锁空状态引导与进度条）+ 精致成就日签（含复制/分享降级）+ 壁纸 + 三态主题 + 归档任务 + 数据管理 */
export function MePage({ onGoToday, resolvedDark }: { onGoToday?: () => void; resolvedDark?: boolean }) {
  const ctx = useData()
  if (!ctx) return null
  return <MePageInner onGoToday={onGoToday} resolvedDark={resolvedDark} />
}

function MePageInner({ onGoToday, resolvedDark = false }: { onGoToday?: () => void; resolvedDark?: boolean }) {
  const ctx = useData()
  if (!ctx) return null
  const {
    data,
    setWallpaper,
    setCustomIcon,
    setArchived,
    deleteTask,
    resetData,
    updateSettings,
    importData,
    addTask,
    notify,
  } = ctx
  const isNative = Capacitor.isNativePlatform()
  const theme = data.settings.theme ?? 'auto'
  const reminder = data.settings.reminder ?? { enabled: false, time: '21:00' }
  const [confirmAction, setConfirmAction] = useState<'seed' | 'empty' | 'icon' | null>(null)
  const [confirmTaskDeleteId, setConfirmTaskDeleteId] = useState<string | null>(null)
  const [shareFallbackText, setShareFallbackText] = useState<string | null>(null)

  useEffect(() => {
    if (!isNative && reminder.enabled) {
      void updateSettings({ reminder: { ...reminder, enabled: false } })
    }
  }, [isNative, reminder, updateSettings])

  const toggleReminder = async (enabled: boolean) => {
    if (enabled && !isNative) {
      notify('网页版不支持后台定时提醒，请在安卓 APK 内开启')
      return
    }
    if (enabled) {
      try {
        const perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') {
          const req = await LocalNotifications.requestPermissions()
          if (req.display !== 'granted') {
            notify('请在系统设置里允许小成就发送通知')
            return
          }
        }
        const exact = await requestExactAlarmPermission()
        await scheduleReminder(reminder.time)
        if (!exact) {
          notify('提醒已开启（未授权精确闹钟时可能延迟几分钟）')
        } else {
          notify(`已开启每日 ${reminder.time} 打卡提醒`)
        }
      } catch {
        notify('定时提醒设置失败，请检查系统通知权限')
        return
      }
    } else {
      try {
        await cancelReminder()
      } catch {
        /* ignore */
      }
    }
    const saved = await updateSettings({ reminder: { ...reminder, enabled } })
    if (!saved && enabled) {
      try { await cancelReminder() } catch { /* ignore */ }
    }
  }

  const changeReminderTime = async (time: string) => {
    if (reminder.enabled && isNative) {
      try {
        await scheduleReminder(time)
      } catch {
        notify('提醒时间修改失败，请检查系统通知权限')
        return
      }
    }
    const saved = await updateSettings({ reminder: { ...reminder, time } })
    if (!saved && reminder.enabled && isNative) {
      try { await scheduleReminder(reminder.time) } catch { /* ignore */ }
    }
  }

  /** 导出备份：网页直接下载文件；APK 写入缓存后拉起系统分享 */
  const exportBackup = async () => {
    const payload = JSON.stringify({ app: 'xiaochengjiu', schema: 1, exportedAt: new Date().toISOString(), data }, null, 2)
    const fname = `xiaochengjiu-backup-${todayStr()}.json`
    if (isNative) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const res = await Filesystem.writeFile({ path: fname, data: payload, directory: Directory.Cache, encoding: Encoding.UTF8 })
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: fname, text: '小成就数据备份', url: res.uri, dialogTitle: '保存备份文件' })
      } catch (error) {
        if (!/cancel/i.test((error as Error).message ?? '')) notify('导出没有完成，请再试一次')
      }
      return
    }
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    a.href = url
    a.download = fname
    a.click()
    notify('已导出 JSON 备份文件')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  /** 导出打卡记录 CSV（带 BOM，Excel 打开不乱码） */
  const exportCsv = async () => {
    const byId = new Map(data.tasks.map((t) => [t.id, t]))
    const rows: string[][] = [['日期', '任务', '类型', '完成时间']]
    const sorted = [...data.checkIns].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.completedAt - b.completedAt,
    )
    for (const c of sorted) {
      const t = byId.get(c.taskId)
      rows.push([c.date, t?.title ?? '（已删除任务）', t?.repeat === 'daily' ? '每日' : '单次', formatTime(c.completedAt)])
    }
    const csv =
      '\ufeff' +
      rows.map((r) =>
        r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','),
      ).join('\r\n')
    const fname = `xiaochengjiu-checkins-${todayStr()}.csv`
    if (isNative) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const res = await Filesystem.writeFile({ path: fname, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 })
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: fname, text: '小成就打卡记录', url: res.uri, dialogTitle: '保存 CSV 文件' })
      } catch (error) {
        if (!/cancel/i.test((error as Error).message ?? '')) notify('导出没有完成，请再试一次')
      }
      return
    }
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.href = url
    a.download = fname
    a.click()
    notify('已导出打卡记录 CSV')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  /** 导入备份 */
  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let next: AppData
    try {
      const parsed = JSON.parse(await file.text())
      next = normalizeBackup(parsed?.data ?? parsed)
    } catch (error) {
      notify(`导入失败：${(error as Error).message || '备份文件格式不正确'}`)
      return
    }
    if (!(await importData(next))) return

    if (next.settings.reminder.enabled && isNative) {
      try {
        await scheduleReminder(next.settings.reminder.time)
      } catch {
        await updateSettings({ reminder: { ...next.settings.reminder, enabled: false } })
      }
    } else {
      try { await cancelReminder() } catch { /* ignore */ }
      if (!isNative && next.settings.reminder.enabled) {
        await updateSettings({ reminder: { ...next.settings.reminder, enabled: false } })
      }
    }
    notify(`导入成功：恢复 ${next.tasks.length} 个任务与 ${next.checkIns.length} 条打卡 ✓`)
  }

  const unlocked = new Set(data.badges.map((b) => b.id).filter((id) => BADGE_MAP[id]))
  const currentStats = badgeStats(data)
  const archived = data.tasks.filter((t) => t.archived)
  const finishedOnce = data.tasks
    .filter((t) => !t.archived && t.repeat === 'once' && data.checkIns.some((c) => c.taskId === t.id))
    .map((task) => ({
      task,
      lastDone: Math.max(0, ...data.checkIns.filter((c) => c.taskId === task.id).map((c) => c.completedAt)),
    }))
  const wp = data.settings.wallpaper

  const [crop, setCrop] = useState<{ src: string; kind: 'wallpaper' | 'icon' } | null>(null)
  const [opacityDraft, setOpacityDraft] = useState(Math.round((wp.opacity ?? 1) * 100))
  // 卡片通透度草稿：拖动时即时改 CSS 变量（不阻塞渲染），松手才落库
  const [cardAlphaDraft, setCardAlphaDraft] = useState(Math.round((data.settings.cardAlpha ?? 1) * 100))
  const [posterOpen, setPosterOpen] = useState(false)

  const today = todayStr()
  const growth = getGrowthLevel(data, today)
  const streak = getStreak(data.checkIns, today)
  const todayStatus = getTodayStatus(data.tasks, data.checkIns, today)
  const focus = focusSummary(data.focusSessions ?? [], today)
  const todayWater = (data.waterLogs ?? {})[today] ?? 0

  useEffect(() => {
    setOpacityDraft(Math.round((wp.opacity ?? 1) * 100))
  }, [wp.opacity])

  const persistCardAlpha = () => {
    const next = Math.min(100, Math.max(30, cardAlphaDraft)) / 100
    if (next !== (data.settings.cardAlpha ?? 1)) void updateSettings({ cardAlpha: next })
  }

  const persistOpacity = () => {
    if (wp.type !== 'image') return
    const next = Math.min(100, Math.max(30, opacityDraft)) / 100
    if (next !== (wp.opacity ?? 1)) void setWallpaper({ ...wp, opacity: next })
  }

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.size > MAX_IMAGE_FILE_BYTES) {
        reject(new Error('图片超过 15MB，请先压缩后再选'))
        return
      }
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('图片读取失败'))
      r.readAsDataURL(file)
    })

  const onPick = async (e: ChangeEvent<HTMLInputElement>, kind: 'wallpaper' | 'icon') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setCrop({ src: await readFile(file), kind })
    } catch (error) {
      notify((error as Error).message || '图片读取失败，换一张试试？')
    }
  }

  const onCropOk = async (dataUrl: string) => {
    const kind = crop?.kind
    if (kind === 'wallpaper') {
      if (await setWallpaper({ type: 'image', value: dataUrl })) {
        setCrop(null)
        notify('自定义壁纸已应用')
      }
    } else if (kind === 'icon') {
      if (await setCustomIcon(dataUrl)) {
        setCrop(null)
        notify('自定义图标已更新')
      }
    }
  }

  const exportIcon = () => {
    const icon = data.settings.customIcon
    if (!icon) return
    const a = document.createElement('a')
    a.href = icon
    a.download = 'xiaochengjiu-icon-512.png'
    a.click()
  }

  const handleCopyOrSharePoster = async () => {
    const summary = `【🍊 小成就日签 · ${formatDateCN(today)} 星期${weekdayCN(today)}】\n${growth.icon} Lv.${growth.level} ${growth.title} · 成就能量 ${growth.totalXP} ⚡\n🔥 连续打卡 ${streak} 天 · ✅ 今日达成 ${todayStatus.completed}/${todayStatus.total}\n🍅 专注 ${focus.todayMinutes} 分钟 · 💧 饮水 ${todayWater}/8 杯\n“${quoteOfTheDay(today)}”\n—— 致认真生活的自己 · 小成就`

    // 1. 优先尝试 Web / 原生剪贴板写入
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary)
        setShareFallbackText(null)
        notify('✨ 已复制今日成就日签文案，快去分享给朋友吧')
        setPosterOpen(false)
        return
      }
    } catch {
      /* 继续尝试 execCommand 与降级文本框 */
    }

    // 2. 尝试 textarea execCommand('copy') 兼容旧版 WebView
    try {
      const ta = document.createElement('textarea')
      ta.value = summary
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(ta)
      if (copied) {
        setShareFallbackText(null)
        notify('✨ 已复制今日成就日签文案，快去分享吧')
        setPosterOpen(false)
        return
      }
    } catch {
      /* 进入可见文本降级 */
    }

    // 3. 降级方案：展开可一键全选的日签文本框 + 温柔提示用户长按复制或截屏保存
    setShareFallbackText(summary)
    notify('当前环境限制自动复制，已为你展开日签文字，可长按复制或直接截屏分享 ✨')
  }

  return (
    <div className="stagger-list space-y-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-slate-800">我的空间</h1>
          <p className="mt-0.5 text-xs text-slate-500">攒下的荣誉徽章，和属于你的个性化小天地</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShareFallbackText(null)
            setPosterOpen(true)
          }}
          className="min-h-[44px] shrink-0 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition duration-150 active:scale-95"
        >
          ✨ 今日成就日签
        </button>
      </header>

      {/* 个人成长等级名片卡 */}
      <section className="card relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 p-5 text-white">
        <div className="flex items-center gap-4">
          {data.settings.customIcon ? (
            <img src={data.settings.customIcon} alt="头像" className="h-14 w-14 rounded-2xl border-2 border-white/60 object-cover shadow-md" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-3xl backdrop-blur-xs">
              {growth.icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white/25 px-2 py-0.5 text-xs font-bold backdrop-blur-xs">
                Lv.{growth.level}
              </span>
              <h2 className="truncate text-[18px] font-bold">{growth.title}</h2>
            </div>
            <p className="mt-1 text-xs text-white/95 tabular-nums">
              当前成就能量 {growth.totalXP} ⚡ · 距离下一级还需 {Math.max(0, growth.nextTarget - growth.totalXP)} ⚡
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/15">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${growth.progressPct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/20 pt-3.5 text-center text-xs tabular-nums">
          <div>
            <p className="text-[14px] font-bold">{streak} 天</p>
            <p className="mt-0.5 text-xs text-white/85">当前连胜</p>
          </div>
          <div>
            <p className="text-[14px] font-bold">{data.checkIns.length} 次</p>
            <p className="mt-0.5 text-xs text-white/85">累计打卡</p>
          </div>
          <div>
            <p className="text-[14px] font-bold">{focus.totalMinutes}m</p>
            <p className="mt-0.5 text-xs text-white/85">番茄专注</p>
          </div>
          <div>
            <p className="text-[14px] font-bold">{unlocked.size}/{BADGES.length}</p>
            <p className="mt-0.5 text-xs text-white/85">荣誉徽章</p>
          </div>
        </div>
      </section>

      {/* 今日成就日签海报弹窗（精致渐变背景 + 日期 + 能量 + 签名 + 复制/分享降级提示） */}
      <Modal open={posterOpen} onClose={() => setPosterOpen(false)}>
        <div className="relative overflow-hidden rounded-3xl border border-white/35 bg-gradient-to-br from-orange-500 via-amber-500 to-rose-400 p-5 text-white shadow-xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-rose-300/20 blur-2xl"
          />
          {/* 顶部日期印章与成长能量徽标 */}
          <div className="relative flex items-start justify-between border-b border-white/25 pb-3.5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-white/90">🍊 小成就 · 每日成长日签</p>
              <h3 className="mt-1 text-[18px] font-bold tracking-tight tabular-nums">
                {formatDateCN(today)} · 星期{weekdayCN(today)}
              </h3>
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/20 px-3 py-1.5 text-right shadow-2xs backdrop-blur-xs tabular-nums">
              <p className="text-xs font-bold">
                {growth.icon} Lv.{growth.level} {growth.title}
              </p>
              <p className="text-[11px] text-white/90">⚡ 能量 {growth.totalXP}</p>
            </div>
          </div>

          {/* 四宫格核心成就指标 */}
          <div className="relative my-4 grid grid-cols-2 gap-2.5 text-center tabular-nums">
            <div className="rounded-2xl border border-white/20 bg-white/18 p-3 shadow-2xs backdrop-blur-xs">
              <p className="text-[18px] font-extrabold text-white">🔥 {streak} 天</p>
              <p className="mt-0.5 text-xs text-white/85">连续打卡连胜</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/18 p-3 shadow-2xs backdrop-blur-xs">
              <p className="text-[18px] font-extrabold text-white">
                ✅ {todayStatus.completed}/{todayStatus.total}
              </p>
              <p className="mt-0.5 text-xs text-white/85">今日习惯达成</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/18 p-3 shadow-2xs backdrop-blur-xs">
              <p className="text-[18px] font-extrabold text-white">🍅 {focus.todayMinutes} 分钟</p>
              <p className="mt-0.5 text-xs text-white/85">今日专注时长</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/18 p-3 shadow-2xs backdrop-blur-xs">
              <p className="text-[18px] font-extrabold text-white">💧 {todayWater}/8 杯</p>
              <p className="mt-0.5 text-xs text-white/85">今日元气饮水</p>
            </div>
          </div>

          {/* 每日寄语与落款签名 */}
          <blockquote className="relative rounded-2xl border border-white/15 bg-black/15 p-3.5 font-serif text-[14px] leading-relaxed text-white/95">
            “{quoteOfTheDay(today)}”
          </blockquote>

          <div className="relative mt-3.5 flex items-center justify-between text-xs text-white/90">
            <span>✨ 每一件小事都算数</span>
            <span className="font-serif italic tracking-wide">—— 致认真生活的自己</span>
          </div>
        </div>

        {/* 复制/分享失败时的降级可选中文本框 */}
        {shareFallbackText && (
          <div className="anim-fade-in mt-3 rounded-2xl bg-orange-50/90 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <p className="mb-1.5 font-semibold text-orange-600 dark:text-orange-400">
              💡 无法自动写入剪贴板，请长按下方文字复制，或直接截屏上方日签卡保存：
            </p>
            <textarea
              readOnly
              rows={4}
              value={shareFallbackText}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-orange-200 bg-white p-2 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setPosterOpen(false)}
            className="min-h-[44px] rounded-2xl bg-slate-100 px-5 py-2.5 text-[14px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={() => void handleCopyOrSharePoster()}
            className="btn-primary min-h-[44px] flex-1"
          >
            📋 复制日签文案分享
          </button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* 左栏：徽章墙 + 归档任务 */}
        <div className="stagger-list space-y-4 lg:col-span-7">
          <section className="card">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[17px] font-bold text-slate-800 tabular-nums">
                🏅 成就徽章墙 · 已解锁 {unlocked.size}/{BADGES.length}
              </h2>
              <span className="text-xs text-slate-500">每一步坚持都有回响</span>
            </div>

            {/* 0 枚徽章时的温柔空状态引导（含 emoji + 温柔文案 + 主行动按钮） */}
            {unlocked.size === 0 && (
              <div className="mb-4 rounded-2xl bg-orange-50/70 px-4 py-5 text-center dark:bg-slate-800/70">
                <p className="text-3xl">🌱</p>
                <p className="mt-1.5 text-[14px] font-semibold text-slate-800">
                  第一枚徽章正在等你点亮
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  完成第一次打卡、记一笔心情或开启一次番茄专注，都能解锁属于你的荣誉勋章
                </p>
                {onGoToday && (
                  <button
                    type="button"
                    onClick={onGoToday}
                    className="btn-primary mt-3 text-xs"
                  >
                    🎯 去今日页打个卡
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BADGES.map((b) => {
                const on = unlocked.has(b.id)
                const prog = b.progress(currentStats)
                const pct = Math.min(100, Math.round((prog.current / prog.target) * 100))
                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl p-3.5 text-center transition duration-150 ${
                      on
                        ? 'bg-gradient-to-b from-orange-50 to-amber-50/90 shadow-xs dark:from-slate-800 dark:to-slate-800/70'
                        : 'bg-slate-50/85 opacity-80 dark:bg-slate-800/45'
                    }`}
                  >
                    <div className={`text-3xl ${on ? '' : 'grayscale opacity-60'}`}>
                      {on ? b.emoji : '🔒'}
                    </div>
                    <p className="mt-1.5 text-[14px] font-semibold text-slate-800">{b.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{b.desc}</p>
                    {!on ? (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-orange-400 transition-all duration-200"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                          进度 {prog.current}/{prog.target}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-orange-500">✓ 已点亮</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* 归档任务 */}
          <section className="card">
            <h2 className="mb-2 text-[17px] font-bold text-slate-800 tabular-nums">
              📦 归档任务 · {archived.length}
            </h2>
            {archived.length === 0 ? (
              <p className="py-1 text-xs leading-relaxed text-slate-500">
                暂时没有归档任务。在今日页点任意任务右侧的「⋯」即可归档，保留历史打卡记录。
              </p>
            ) : (
              <ul className="space-y-2">
                {archived.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-2 dark:bg-slate-800/70">
                    <span className="flex-1 truncate text-[14px] text-slate-700">{t.title}</span>
                    <button
                      type="button"
                      className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold text-orange-500 transition hover:bg-orange-50 dark:hover:bg-slate-700"
                      onClick={() => void setArchived(t.id, false)}
                    >
                      恢复
                    </button>
                    {confirmTaskDeleteId !== t.id ? (
                      <button
                        type="button"
                        className="min-h-[44px] rounded-xl px-3 py-2 text-xs text-red-500 transition hover:bg-red-50 dark:hover:bg-slate-700"
                        onClick={() => setConfirmTaskDeleteId(t.id)}
                      >
                        删除
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="min-h-[44px] rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
                        onClick={async () => {
                          if (await deleteTask(t.id)) {
                            setConfirmTaskDeleteId(null)
                            notify('已删除归档任务')
                          }
                        }}
                      >
                        确认删除
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 已完成的一次性任务 */}
          {finishedOnce.length > 0 && (
            <section className="card">
              <h2 className="mb-2 text-[17px] font-bold text-slate-800 tabular-nums">
                ✅ 已完成的一次性任务 · {finishedOnce.length}
              </h2>
              <ul className="space-y-2">
                {finishedOnce.map(({ task, lastDone }) => (
                  <li key={task.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-2 dark:bg-slate-800/70">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-slate-700 dark:text-slate-200">{task.title}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {lastDone ? formatDateCN(dateStr(new Date(lastDone))) : '已完成'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="min-h-[44px] shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-orange-500 transition hover:bg-orange-50 dark:hover:bg-slate-700"
                      onClick={async () => {
                        if (await addTask(task.title, 'once', task.category)) {
                          notify(`已将「${task.title}」重新加入今日待办`)
                        }
                      }}
                    >
                      再来一次
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* 右栏：外观壁纸、提醒与数据管理 */}
        <div className="stagger-list space-y-4 lg:col-span-5">
          {/* 壁纸自定义 */}
          <section className="card">
            <h2 className="mb-1 text-[17px] font-bold text-slate-800">🎨 主题壁纸</h2>
            <p className="mb-3 text-xs text-slate-500">选一个舒服的渐变色，或上传自己的照片</p>
            <div className="grid grid-cols-4 gap-2.5">
              {WALLPAPERS.map((w) => {
                const active = wp.type === 'preset' && wp.value === w.id
                const isDefault = w.id === DEFAULT_WALLPAPER_ID
                // 关键：预览必须与应用后的实际效果一致（深色模式取 darkCss），否则会"选了跟看到的不一样"
                const previewCss = resolvedDark ? (w.darkCss ?? w.css) : w.css
                // 图片壁纸：色块直接显示照片缩略图，一眼能认出是哪张
                const isPhoto = w.kind === 'photo'
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => void setWallpaper({ type: 'preset', value: w.id })}
                    className="flex min-h-[64px] flex-col items-center justify-center rounded-2xl py-1"
                    aria-label={`壁纸 ${w.name}${isDefault ? '（默认）' : ''}`}
                    aria-pressed={active}
                  >
                    <span
                      className={`block h-11 w-11 rounded-full border-2 shadow-xs transition duration-150 ${
                        active ? 'scale-105 border-orange-500 ring-2 ring-orange-200' : 'border-white dark:border-slate-600'
                      }`}
                      style={
                        isPhoto
                          ? { backgroundImage: `url('${w.thumb}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                          : { background: previewCss }
                      }
                    />
                    <span className={`mt-1 text-xs ${active ? 'font-semibold text-orange-500' : 'text-slate-600'}`}>
                      {w.name}
                      {isDefault && <span className="ml-0.5 text-[10px] text-orange-400">·默认</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 py-2.5 text-xs font-semibold text-orange-500 transition hover:bg-orange-50/50 active:scale-[0.99] dark:border-slate-700">
              🖼 上传自定义照片壁纸（可裁切）
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e, 'wallpaper')} />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                当前：{wp.type === 'preset' ? (findPreset(wp.value)?.name ?? '晨光') : '自定义图片'}
                {resolvedDark && <span className="ml-1 text-[11px] text-slate-400">（深色模式·夜间版本）</span>}
              </p>
              {!(wp.type === 'preset' && wp.value === DEFAULT_WALLPAPER_ID) && (
                <button
                  type="button"
                  onClick={() => void setWallpaper({ type: 'preset', value: DEFAULT_WALLPAPER_ID })}
                  className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-600 transition active:scale-95 dark:bg-slate-800 dark:text-orange-400"
                >
                  恢复默认
                </button>
              )}
            </div>
            {wp.type === 'image' && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                  <span>照片浓度</span>
                  <span>{opacityDraft}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={5}
                  value={opacityDraft}
                  onChange={(e) => setOpacityDraft(Number(e.target.value))}
                  onPointerUp={persistOpacity}
                  onKeyUp={persistOpacity}
                  onBlur={persistOpacity}
                  className="mt-1 h-6 w-full accent-orange-500"
                  aria-label="照片浓度"
                />
              </div>
            )}
          </section>

          {/* 外观：深浅色 / 跟随系统 三态毛玻璃主题 */}
          <section className="card">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold text-slate-800">🌓 外观与三态主题</h2>
              <span className="glass-pill rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                当前生效：{resolvedDark ? '🌙 深色毛玻璃' : '☀️ 浅色毛玻璃'}
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              支持跟随系统日夜自动切换，渐变毛玻璃与壁纸光感同步适配
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'auto', icon: '🌓', label: '跟随系统', desc: '随系统日夜切换' },
                  { id: 'light', icon: '☀️', label: '浅色模式', desc: '暖白通透毛玻璃' },
                  { id: 'dark', icon: '🌙', label: '深色模式', desc: '暗夜流光护眼' },
                ] as const
              ).map((item) => {
                const active = theme === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void updateSettings({ theme: item.id as ThemeMode })}
                    aria-pressed={active}
                    className={`flex min-h-[68px] flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-center transition duration-150 active:scale-[0.98] ${
                      active
                        ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm'
                        : 'glass-subcard text-slate-700 hover:border-orange-300 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    <span className="mt-1 text-xs font-bold">{item.label}</span>
                    <span
                      className={`mt-0.5 text-[10px] ${
                        active ? 'text-white/90' : 'text-slate-400'
                      }`}
                    >
                      {item.desc}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 卡片通透度：调低即可让壁纸透过卡片 */}
            <div className="mt-4 border-t border-white/50 pt-3 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-200">🪟 卡片通透度</span>
                <span className="tabular-nums">{cardAlphaDraft}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={cardAlphaDraft}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setCardAlphaDraft(v)
                  // 拖动即时生效：直接改 CSS 变量，无需等落库
                  document.documentElement.style.setProperty('--card-alpha', String(v / 100))
                }}
                onPointerUp={persistCardAlpha}
                onKeyUp={persistCardAlpha}
                onBlur={persistCardAlpha}
                className="mt-1 h-6 w-full accent-orange-500"
                aria-label="卡片通透度"
              />
              <p className="text-[11px] text-slate-500">
                调低后卡片变通透，能看见壁纸从卡片下面透出来；30% 时最透，100% 为完全不透明
              </p>
            </div>
          </section>

          {/* 打卡提醒 */}
          <section className="card">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-bold text-slate-800">🔔 每日提醒</h2>
                <p className="mt-0.5 text-xs text-slate-500">到点轻轻叫你一声来打卡</p>
              </div>
              <button
                type="button"
                onClick={() => void toggleReminder(!reminder.enabled)}
                aria-label="开关提醒"
                className="flex min-h-[44px] min-w-[52px] items-center justify-end"
              >
                <span
                  className={`relative block h-7 w-12 rounded-full transition-colors duration-150 ${
                    reminder.enabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-150 ${
                      reminder.enabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>
            {reminder.enabled && (
              <label className="mt-3 flex items-center gap-2 text-[14px] text-slate-600">
                ⏰ 时间
                <input
                  type="time"
                  value={reminder.time}
                  onChange={(e) => e.target.value && void changeReminderTime(e.target.value)}
                  className="input flex-1 py-2"
                />
              </label>
            )}
          </section>

          {/* App 图标 */}
          <section className="card">
            <h2 className="mb-1 text-[17px] font-bold text-slate-800">🍊 App 图标定制</h2>
            <p className="mb-3 text-xs text-slate-500">裁切专属方形图标并导出 512px PNG</p>
            <div className="flex items-center gap-4">
              {data.settings.customIcon ? (
                <img src={data.settings.customIcon} alt="自定义图标" className="h-14 w-14 rounded-2xl object-cover shadow-md" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-orange-300 to-orange-500 text-2xl font-bold text-white shadow-md">
                  成
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2">
                <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 py-2 text-xs font-semibold text-orange-500 transition active:scale-[0.99] dark:border-slate-700">
                  🖼 选择图片并裁切
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e, 'icon')} />
                </label>
                {data.settings.customIcon && (
                  <div className="flex gap-2">
                    {!isNative && (
                      <button
                        type="button"
                        onClick={exportIcon}
                        className="min-h-[44px] flex-1 rounded-2xl bg-orange-100 py-2 text-xs font-semibold text-orange-600 dark:bg-slate-800 dark:text-orange-400"
                      >
                        ⬇️ 导出 PNG
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void setCustomIcon(null)}
                      className="min-h-[44px] flex-1 rounded-2xl bg-slate-100 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      恢复默认
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 数据管理 */}
          <section className="card">
            <h2 className="mb-3 text-[17px] font-bold text-slate-800">💾 数据自主与备份</h2>
            <div className="space-y-2.5">
              <button type="button" className="sheet-btn" onClick={() => void exportBackup()}>
                ⬇️ 导出完整备份（JSON）
              </button>
              <button type="button" className="sheet-btn" onClick={() => void exportCsv()}>
                📊 导出打卡明细（CSV 表格）
              </button>
              <label className="sheet-btn flex cursor-pointer items-center justify-center text-center">
                📥 从 JSON 备份文件恢复
                <input type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
              </label>

              {confirmAction !== 'seed' ? (
                <button
                  type="button"
                  className="sheet-btn"
                  onClick={() => setConfirmAction('seed')}
                >
                  🔄 恢复示例数据（覆盖当前记录）
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="sheet-btn flex-1 bg-orange-500! font-semibold text-white!"
                    onClick={async () => {
                      if (await resetData('seed')) {
                        setConfirmAction(null)
                        notify('已恢复丰富的示例数据 🌱')
                      }
                    }}
                  >
                    确认恢复示例数据
                  </button>
                  <button
                    type="button"
                    className="sheet-btn w-24!"
                    onClick={() => setConfirmAction(null)}
                  >
                    取消
                  </button>
                </div>
              )}

              {confirmAction !== 'empty' ? (
                <button
                  type="button"
                  className="sheet-btn text-red-500"
                  onClick={() => setConfirmAction('empty')}
                >
                  🧹 清空全部记录（保留壁纸外观）
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="sheet-btn flex-1 bg-red-500! font-semibold text-white!"
                    onClick={async () => {
                      if (await resetData('empty')) {
                        setConfirmAction(null)
                        notify('已清空全部记录')
                      }
                    }}
                  >
                    确认清空（不可恢复）
                  </button>
                  <button
                    type="button"
                    className="sheet-btn w-24!"
                    onClick={() => setConfirmAction(null)}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              所有数据 100% 保存在本机浏览器或手机存储，绝不上传云端。
            </p>
          </section>
        </div>
      </div>

      <p className="pb-2 text-center text-xs text-slate-400">小成就 v1.7 · 温柔地陪你攒成就感 🍊</p>

      {/* 无损裁切弹窗：壁纸按屏幕比例，图标按 1:1 */}
      <CropModal
        open={!!crop}
        src={crop?.src ?? null}
        aspect={crop?.kind === 'icon' ? 1 : window.innerWidth / window.innerHeight}
        title={crop?.kind === 'icon' ? '裁切 App 图标' : '裁切壁纸'}
        outMime={crop?.kind === 'icon' ? 'image/png' : 'image/jpeg'}
        quality={0.82}
        maxOut={crop?.kind === 'icon' ? undefined : 1920}
        outSize={crop?.kind === 'icon' ? 512 : undefined}
        onConfirm={onCropOk}
        onCancel={() => setCrop(null)}
      />
    </div>
  )
}
