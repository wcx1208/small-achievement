import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DataProvider, useData } from './store/DataContext'
import { BottomNav } from './components/BottomNav'
import type { TabId } from './components/BottomNav'
import { TodayPage } from './pages/TodayPage'
import { StatsPage } from './pages/StatsPage'
import { MePage } from './pages/MePage'
import { DiaryPage } from './features/diary/DiaryPage'
import { NotesPage } from './features/notes/NotesPage'
import { QuoteToast } from './features/rewards/QuoteToast'
import { BadgeModal } from './features/rewards/BadgeModal'
import { pickQuote } from './data/quotes'
import { WALLPAPERS, findPreset } from './data/presets'
import type { Wallpaper } from './data/types'

/**
 * 壁纸映射为背景样式：预设渐变 / 自定义图片（图片上再叠一层浅白保证卡片可读）。
 * 借鉴六级单词 App 的「每页渐变角度不同」：同一套壁纸在三个页面的渐变方向略有差异，
 * 让每个页面都有自己的光感（图片壁纸不做偏移，避免人物/构图被旋转破坏）。
 */
const PAGE_ANGLE: Record<TabId, number> = { today: 0, stats: 40, me: -35 }

function wallpaperStyle(wp: Wallpaper, tab: TabId): CSSProperties {
  if (wp.type === 'image') {
    // 图片模式：底层回落到默认主题渐变承托（照片浓度调低时透出暖色底）
    const css = WALLPAPERS[0].css
    const angled = css.replace(/(-?\d+)deg/, (_, d) => `${Number(d) + PAGE_ANGLE[tab]}deg`)
    return { backgroundImage: angled }
  }
  const css = findPreset(wp.value)?.css ?? WALLPAPERS[0].css
  const angled = css.replace(/(-?\d+)deg/, (_, d) => `${Number(d) + PAGE_ANGLE[tab]}deg`)
  return { backgroundImage: angled }
}

function Shell() {
  const ctx = useData()
  const [tab, setTab] = useState<TabId>('today')
  /** 全屏覆盖层页面：日记 / 便签（盖住三 Tab 内容，带自己的返回按钮） */
  const [overlay, setOverlay] = useState<'diary' | 'notes' | null>(null)
  const [quote, setQuote] = useState<{ text: string; key: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const lastQuote = useRef<string | undefined>(undefined)

  // 深浅色主题：三档设置 + 跟随系统（挂 <html class="dark">，全站重映射层在 index.css）
  // 注意：所有 Hook 必须在提前 return 之前调用，否则加载态→就绪态会触发 React #310
  const themeSetting = ctx?.data.settings.theme ?? 'auto'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = themeSetting === 'dark' || (themeSetting === 'auto' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [themeSetting])

  // 安卓返回键：不在今日页时先回到今日；今日页不拦截，由 main.tsx 决定退出 App。
  useEffect(() => {
    const onRootBack = (event: Event) => {
      if (tab === 'today') return
      event.preventDefault()
      setTab('today')
    }
    window.addEventListener('xcj:root-back', onRootBack)
    return () => window.removeEventListener('xcj:root-back', onRootBack)
  }, [tab])

  if (!ctx || !ctx.ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-orange-50 to-amber-100">
        <div className="anim-fade-in text-center">
          <div className="text-5xl">🍊</div>
          <p className="mt-3 text-sm text-slate-400">小成就加载中…</p>
        </div>
      </div>
    )
  }

  const { data, badgeQueue, ackBadge } = ctx

  const showQuote = (kind: 'task' | 'mood') => {
    const text = pickQuote(kind, lastQuote.current)
    lastQuote.current = text
    setQuote({ text, key: Date.now() })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setQuote(null), 4500)
  }

  const wp = data.settings.wallpaper

  return (
    <div className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10" style={wallpaperStyle(wp, tab)} />
      {wp.type === 'image' && (
        <>
          {/* 照片层：可调浓度，低浓度时透出底层暖色渐变 */}
          <div
            className="fixed inset-0 -z-10 bg-cover bg-center transition-opacity duration-300"
            style={{ backgroundImage: `url(${wp.value})`, opacity: wp.opacity ?? 1 }}
          />
          {/* 柔化层：高浓度时压一下照片，保证卡片可读 */}
          {(wp.opacity ?? 1) >= 0.7 && <div className="wallpaper-veil fixed inset-0 -z-10" />}
        </>
      )}

      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        {ctx.storageWarning && (
          <section
            role="alert"
            className="mb-4 rounded-3xl border border-red-200 bg-red-50/95 p-4 text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/80 dark:text-red-200"
          >
            <p className="text-sm font-semibold">数据保护提醒</p>
            <p className="mt-1 text-xs leading-relaxed">{ctx.storageWarning}</p>
            <div className="mt-3 flex gap-2">
              {ctx.corruptRaw && (
                <button
                  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([ctx.corruptRaw!], { type: 'application/json' }))
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `xiaochengjiu-raw-${Date.now()}.json`
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(url), 5000)
                  }}
                >
                  下载原始数据
                </button>
              )}
              <button
                className="rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-red-600 dark:bg-slate-800 dark:text-red-200"
                onClick={ctx.dismissStorageWarning}
              >
                知道了
              </button>
            </div>
          </section>
        )}
        {tab === 'today' && (
          <TodayPage showQuote={showQuote} onOpenDiary={() => setOverlay('diary')} onOpenNotes={() => setOverlay('notes')} />
        )}
        {tab === 'stats' && <StatsPage />}
        {tab === 'me' && <MePage />}
      </main>

      <BottomNav tab={tab} onChange={setTab} />
      {overlay === 'diary' && (
        <DiaryPage onClose={() => setOverlay(null)} bg={wallpaperStyle(wp, 'today')} showQuote={showQuote} />
      )}
      {overlay === 'notes' && <NotesPage onClose={() => setOverlay(null)} bg={wallpaperStyle(wp, 'today')} />}
      <QuoteToast text={quote?.text ?? null} onDismiss={() => setQuote(null)} />
      {badgeQueue.length > 0 && <BadgeModal def={badgeQueue[0]} onClose={ackBadge} />}
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
