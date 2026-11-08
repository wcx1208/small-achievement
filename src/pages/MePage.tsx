import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useData } from '../store/DataContext'
import { BADGES, BADGE_MAP } from '../data/badges'
import { WALLPAPERS, findPreset } from '../data/presets'
import type { AppData, ThemeMode } from '../data/types'
import { formatDateCN, formatTime, dateStr, todayStr } from '../lib/date'
import { CropModal } from '../components/CropModal'
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

/** 我的页：徽章墙 + 壁纸（无损裁切）+ App 图标 + 归档任务 + 数据管理 */
export function MePage() {
  const ctx = useData()
  if (!ctx) return null
  return <MePageInner />
}

function MePageInner() {
  const ctx = useData()
  if (!ctx) return null
  const { data, setWallpaper, setCustomIcon, setArchived, deleteTask, resetData, updateSettings, importData, addTask } = ctx
  // APK 内图标已内置，导出按钮仅网页版有意义
  const isNative = Capacitor.isNativePlatform()
  const theme = data.settings.theme ?? 'auto'
  const reminder = data.settings.reminder ?? { enabled: false, time: '21:00' }

  // 网页版没有可靠后台定时器，历史设置若为开启则主动纠正，避免开关与实际能力不一致。
  useEffect(() => {
    if (!isNative && reminder.enabled) {
      void updateSettings({ reminder: { ...reminder, enabled: false } })
    }
  }, [isNative, reminder, updateSettings])

  const toggleReminder = async (enabled: boolean) => {
    if (enabled && !isNative) {
      alert('网页版的定时提醒不可靠，请在 APK 内开启；网页端仍可使用所有记录功能。')
      return
    }
    if (enabled) {
      try {
        const perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') {
          const req = await LocalNotifications.requestPermissions()
          if (req.display !== 'granted') {
            alert('没有拿到通知权限，请在系统设置里允许小成就发送通知。')
            return
          }
        }
        const exact = await requestExactAlarmPermission()
        await scheduleReminder(reminder.time)
        if (!exact) {
          alert('提醒已设置，但系统未允许“精确闹钟”，到点可能延迟几分钟。可在系统设置中允许后重新开启。')
        }
      } catch {
        alert('定时提醒设置失败，请检查系统的通知权限。')
        return
      }
    } else {
      try {
        await cancelReminder()
      } catch {
        /* 取消失败也允许关闭开关 */
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
        alert('提醒时间修改失败，请检查系统通知权限。')
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
        if (!/cancel/i.test((error as Error).message ?? '')) alert('导出没有完成，再试一次？')
      }
      return
    }
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    a.href = url
    a.download = fname
    a.click()
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
        if (!/cancel/i.test((error as Error).message ?? '')) alert('导出没有完成，再试一次？')
      }
      return
    }
    const a = document.createElement('a')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.href = url
    a.download = fname
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  /** 导入备份：先完整清洗并展示数量，写盘成功后才提示成功 */
  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let next: AppData
    try {
      const parsed = JSON.parse(await file.text())
      next = normalizeBackup(parsed?.data ?? parsed)
    } catch (error) {
      alert(`导入失败：${(error as Error).message || '这不是有效的小成就备份文件。'}`)
      return
    }
    const counts = `${next.tasks.length} 个任务、${next.checkIns.length} 条打卡、${next.diaries.length} 篇日记、${next.notes.length} 张便签`
    if (!window.confirm(`导入「${file.name}」？\n\n将恢复 ${counts}，并覆盖当前全部记录。`)) return
    if (!(await importData(next))) return

    // 提醒属于本机能力：原生端重新排程，网页端标记为关闭，避免“开关看似开启但不会触发”。
    if (next.settings.reminder.enabled && isNative) {
      try {
        await scheduleReminder(next.settings.reminder.time)
      } catch {
        await updateSettings({ reminder: { ...next.settings.reminder, enabled: false } })
        alert('数据已导入，但通知提醒未能设置，已自动关闭提醒开关。')
      }
    } else {
      try { await cancelReminder() } catch { /* 网页端可能不支持 */ }
      if (!isNative && next.settings.reminder.enabled) {
        await updateSettings({ reminder: { ...next.settings.reminder, enabled: false } })
      }
    }
    alert('导入成功 ✓')
  }
  const unlocked = new Set(data.badges.map((b) => b.id).filter((id) => BADGE_MAP[id]))
  const archived = data.tasks.filter((t) => t.archived)
  const finishedOnce = data.tasks
    .filter((t) => !t.archived && t.repeat === 'once' && data.checkIns.some((c) => c.taskId === t.id))
    .map((task) => ({
      task,
      lastDone: Math.max(0, ...data.checkIns.filter((c) => c.taskId === task.id).map((c) => c.completedAt)),
    }))
  const wp = data.settings.wallpaper

  // 裁切会话：记录当前待裁切的图与用途（壁纸 / 图标）
  const [crop, setCrop] = useState<{ src: string; kind: 'wallpaper' | 'icon' } | null>(null)
  const [opacityDraft, setOpacityDraft] = useState(Math.round((wp.opacity ?? 1) * 100))

  useEffect(() => {
    setOpacityDraft(Math.round((wp.opacity ?? 1) * 100))
  }, [wp.opacity])

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
      alert((error as Error).message || '图片读取失败，换一张试试？')
    }
  }

  const onCropOk = async (dataUrl: string) => {
    const kind = crop?.kind
    if (kind === 'wallpaper') {
      if (await setWallpaper({ type: 'image', value: dataUrl })) setCrop(null)
    } else if (kind === 'icon') {
      if (await setCustomIcon(dataUrl)) setCrop(null)
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-800">我的</h1>
        <p className="mt-0.5 text-xs text-slate-400">攒下的徽章，和属于你的小天地</p>
      </header>

      {/* 徽章墙 */}
      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">
          徽章墙 · 已解锁 {unlocked.size}/{BADGES.length}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {BADGES.map((b) => {
            const on = unlocked.has(b.id)
            return (
              <div
                key={b.id}
                className={`rounded-2xl p-3 text-center transition ${
                  on
                    ? 'bg-gradient-to-b from-orange-50 to-amber-50 shadow-sm dark:from-slate-800 dark:to-slate-800/60'
                    : 'bg-slate-50 opacity-55 dark:bg-slate-800/50'
                }`}
              >
                <div className={`text-3xl ${on ? '' : 'grayscale'}`}>{on ? b.emoji : '🔒'}</div>
                <p className="mt-1 text-xs font-semibold text-slate-700">{b.name}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{b.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* 壁纸自定义 */}
      <section className="card">
        <h2 className="mb-1 text-sm font-bold text-slate-700">壁纸</h2>
        <p className="mb-3 text-[11px] text-slate-400">选一个舒服的底色，或上传自己的图片</p>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {WALLPAPERS.map((w) => {
            const active = wp.type === 'preset' && wp.value === w.id
            return (
              <button key={w.id} onClick={() => setWallpaper({ type: 'preset', value: w.id })} className="flex flex-col items-center">
                <span
                  className={`block h-12 w-12 rounded-full border-2 shadow ${
                    active ? 'border-orange-500 ring-2 ring-orange-200' : 'border-white'
                  }`}
                  style={{ background: w.css }}
                />
                <span className="mt-1 text-[10px] text-slate-400">{w.name}</span>
              </button>
            )
          })}
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 py-3 text-sm text-orange-500 transition active:scale-[0.99]">
          🖼 上传自定义壁纸（可裁切）
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e, 'wallpaper')} />
        </label>
        <p className="mt-2 text-[11px] text-slate-400">
          当前：{wp.type === 'preset' ? (findPreset(wp.value)?.name ?? '晨光') : '自定义图片'}
          {wp.type === 'image' && ' · 上传后可拖动裁切，按原图分辨率输出'}
        </p>
        {wp.type === 'image' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
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
              className="mt-1 w-full accent-orange-500"
              aria-label="照片浓度"
            />
            <p className="mt-1 text-[11px] text-slate-400">调低浓度可让照片融入主题色，文字更清晰</p>
          </div>
        )}
      </section>

      {/* App 图标（导出给 APK / PWA 使用） */}
      <section className="card">
        <h2 className="mb-1 text-sm font-bold text-slate-700">App 图标</h2>
        <p className="mb-3 text-[11px] text-slate-400">仅网页版/PWA 导出使用；APK 图标在打包时固定，不能在应用内实时替换</p>
        <div className="flex items-center gap-4">
          {data.settings.customIcon ? (
            <img src={data.settings.customIcon} alt="自定义图标" className="h-16 w-16 rounded-2xl object-cover shadow-md" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-b from-orange-300 to-orange-500 text-3xl font-bold text-white shadow-md">
              成
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 py-2 text-xs text-orange-500 transition active:scale-[0.99]">
              🖼 选择图片并裁切
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e, 'icon')} />
            </label>
            {data.settings.customIcon && !isNative && (
              <div className="flex gap-2">
                <button onClick={exportIcon} className="flex-1 rounded-2xl bg-orange-100 py-2 text-xs font-medium text-orange-600 transition active:scale-[0.98]">
                  ⬇️ 导出 512px PNG
                </button>
                <button
                  onClick={() => window.confirm('恢复默认图标？') && setCustomIcon(null)}
                  className="flex-1 rounded-2xl bg-slate-100 py-2 text-xs text-slate-500 transition active:scale-[0.98]"
                >
                  恢复默认
                </button>
              </div>
            )}
            {data.settings.customIcon && isNative && (
              <button
                onClick={() => window.confirm('恢复默认图标？') && setCustomIcon(null)}
                className="w-full rounded-2xl bg-slate-100 py-2 text-xs text-slate-500 transition active:scale-[0.98]"
              >
                恢复默认
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          说明：自定义图标只影响网页版导出的 PNG 或 PWA 安装图标；已安装 APK 的桌面图标由安装包决定。
        </p>
      </section>

      {/* 归档任务 */}
      <section className="card">
        <h2 className="mb-2 text-sm font-bold text-slate-700">归档任务 · {archived.length}</h2>
        {archived.length === 0 ? (
          <p className="py-1 text-xs text-slate-400">暂无归档。在今日页点任务的「⋯」可以归档</p>
        ) : (
          <ul className="space-y-2">
            {archived.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                <span className="flex-1 truncate text-sm text-slate-500">{t.title}</span>
                <button className="text-xs font-medium text-orange-500" onClick={() => void setArchived(t.id, false)}>
                  恢复
                </button>
                <button
                  className="text-xs text-red-400"
                  onClick={async () => {
                    if (window.confirm(`删除「${t.title}」？打卡历史会保留在统计里。`)) {
                      await deleteTask(t.id)
                    }
                  }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 一次性任务完成后默认离开今日列表，这里保留历史入口，避免“人间蒸发” */}
      {finishedOnce.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-bold text-slate-700">已完成的一次性任务 · {finishedOnce.length}</h2>
          <ul className="space-y-2">
            {finishedOnce.map(({ task, lastDone }) => (
              <li key={task.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-600 dark:text-slate-300">{task.title}</p>
                  <p className="text-[10px] text-slate-400">{lastDone ? formatDateCN(dateStr(new Date(lastDone))) : '已完成'}</p>
                </div>
                <button
                  className="shrink-0 text-xs font-medium text-orange-500"
                  onClick={async () => {
                    if (await addTask(task.title, 'once')) alert('已重新加入今日待办')
                  }}
                >
                  再来一次
                </button>
                <button
                  className="shrink-0 text-xs text-red-400"
                  onClick={async () => {
                    if (window.confirm(`删除「${task.title}」？打卡历史会保留在统计里。`)) {
                      await deleteTask(task.id)
                    }
                  }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 外观：深浅色主题 */}
      <section className="card">
        <h2 className="mb-1 text-sm font-bold text-slate-700">外观</h2>
        <p className="mb-3 text-[11px] text-slate-400">夜间打卡更护眼</p>
        <div className="flex gap-2">
          {(
            [
              ['auto', '跟随系统'],
              ['light', '浅色'],
              ['dark', '深色'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => updateSettings({ theme: id as ThemeMode })}
              className={`flex-1 rounded-2xl py-2.5 text-xs font-medium transition active:scale-[0.98] ${
                theme === id ? 'bg-orange-500 text-white shadow-sm' : 'bg-orange-100/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 打卡提醒 */}
      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-700">每日提醒</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">到点轻轻叫你一声来打卡</p>
          </div>
          <button
            onClick={() => toggleReminder(!reminder.enabled)}
            aria-label="开关提醒"
            className={`relative h-7 w-12 rounded-full transition-colors ${reminder.enabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                reminder.enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        {reminder.enabled && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            ⏰ 时间
            <input
              type="time"
              value={reminder.time}
              onChange={(e) => e.target.value && changeReminderTime(e.target.value)}
              className="input flex-1 py-2"
            />
          </label>
        )}
        <p className="mt-2 text-[11px] text-slate-400">网页版不支持可靠的定时提醒；APK 内会请求通知和精确闹钟权限。</p>
      </section>

      {/* 数据管理 */}
      <section className="card">
        <h2 className="mb-2 text-sm font-bold text-slate-700">数据</h2>
        <div className="space-y-2">
          <button className="sheet-btn" onClick={exportBackup}>
            ⬇️ 导出备份（JSON）
          </button>
          <button className="sheet-btn" onClick={exportCsv}>
            📊 导出打卡记录（CSV）
          </button>
          <label className="sheet-btn block cursor-pointer text-center">
            📥 导入备份
            <input type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
          </label>
          <button
            className="sheet-btn"
            onClick={async () => {
              if (!window.confirm('恢复示例数据会覆盖现有全部记录（外观设置保留），确定？')) return
              if (await resetData('seed')) alert('已恢复示例记录')
            }}
          >
            🔄 恢复示例数据
          </button>
          <button
            className="sheet-btn text-red-500"
            onClick={async () => {
              if (window.confirm('清空全部记录？外观设置会保留，此操作不可恢复！')) {
                if (await resetData('empty')) alert('已清空记录')
              }
            }}
          >
            🧹 清空全部记录（保留外观设置）
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          所有数据只保存在本机（APK 内置存储 / 浏览器 localStorage），不会上传任何服务器；换手机前先导出备份。
        </p>
      </section>

      <p className="pb-2 text-center text-[11px] text-slate-400">小成就 v1.4 · 温柔地陪你攒成就感 🍊</p>

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
