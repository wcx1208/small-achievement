import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DataProvider, useData } from './store/DataContext'
import { BottomNav } from './components/BottomNav'
import type { TabId } from './components/BottomNav'
import { TodayPage } from './pages/TodayPage'
import { JournalPage } from './pages/JournalPage'
import { StatsPage } from './pages/StatsPage'
import { MePage } from './pages/MePage'
import { DiaryPage } from './features/diary/DiaryPage'
import { NotesPage } from './features/notes/NotesPage'
import { QuoteToast } from './features/rewards/QuoteToast'
import { BadgeModal } from './features/rewards/BadgeModal'
import { pickQuote } from './data/quotes'
import { WALLPAPERS, findPreset } from './data/presets'
import type { ThemeMode, Wallpaper } from './data/types'

/**
 * 壁纸映射为背景样式：预设渐变（自适应浅色 css / 深色 darkCss）与自定义图片。
 * 同一套壁纸在四个页面的渐变方向略有差异，让毛玻璃卡片在不同页面折射出层次感。
 */
const PAGE_ANGLE: Record<TabId, number> = { today: 0, journal: 20, stats: 40, me: -35 }

const THEME_CYCLE: ThemeMode[] = ['auto', 'light', 'dark']
const THEME_META: Record<ThemeMode, { icon: string; short: string; label: string }> = {
  auto: { icon: '🌓', short: '自动', label: '跟随系统' },
  light: { icon: '☀️', short: '浅色', label: '浅色模式' },
  dark: { icon: '🌙', short: '深色', label: '深色模式' },
}

function wallpaperStyle(wp: Wallpaper, tab: TabId, isDark: boolean): CSSProperties {
  const preset = wp.type === 'preset' ? (findPreset(wp.value) ?? WALLPAPERS[0]) : WALLPAPERS[0]
  const baseCss = isDark ? preset.darkCss : preset.css
  const angled = baseCss.replace(/(-?\d+)deg/, (_, d) => `${Number(d) + PAGE_ANGLE[tab]}deg`)
  return { backgroundImage: angled }
}

/** 启动加载骨架屏（替代空白或单调文字，贴合今日页毛玻璃卡片结构） */
function AppSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="小成就正在加载"
      className="min-h-dvh bg-gradient-to-b from-orange-50 to-amber-100/70 px-4 pt-5 pb-28 dark:from-slate-950 dark:to-slate-900"
    >
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3.5 w-28 animate-pulse rounded-full bg-orange-200/60 dark:bg-slate-800" />
            <div className="h-6 w-36 animate-pulse rounded-full bg-orange-200/80 dark:bg-slate-800" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-2xl bg-white/80 dark:bg-slate-800" />
        </div>
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-orange-100 dark:bg-slate-800" />
            <div className="flex-1 space-y-2.5">
              <div className="h-6 w-28 animate-pulse rounded-full bg-orange-200/70 dark:bg-slate-800" />
              <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        </div>
        <div className="card space-y-3">
          <div className="h-5 w-32 animate-pulse rounded-full bg-orange-100 dark:bg-slate-800" />
          <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100/90 dark:bg-slate-800" />
          <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100/90 dark:bg-slate-800" />
          <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100/90 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const ctx = useData()
  const [tab, setTab] = useState<TabId>('today')
  /** 全屏覆盖层页面：日记 / 便签 */
  const [overlay, setOverlay] = useState<'diary' | 'notes' | null>(null)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [focusRunning, setFocusRunning] = useState(false)
  const [quote, setQuote] = useState<{ text: string; key: number } | null>(null)
  const [resolvedDark, setResolvedDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  )
  const timer = useRef<number | undefined>(undefined)
  const lastQuote = useRef<string | undefined>(undefined)

  const themeSetting: ThemeMode = ctx?.data.settings.theme ?? 'auto'

  // 深浅色 / 跟随系统三态主题引擎：同步 HTML class、dataset 与 PWA 状态栏颜色
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = themeSetting === 'dark' || (themeSetting === 'auto' && mq.matches)
      setResolvedDark(dark)
      const root = document.documentElement
      root.classList.toggle('dark', dark)
      root.dataset.theme = dark ? 'dark' : 'light'
      root.dataset.themeMode = themeSetting
      const metaTheme = document.querySelector('meta[name="theme-color"]')
      if (metaTheme) {
        metaTheme.setAttribute('content', dark ? '#0B1120' : '#FFF3E4')
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [themeSetting])

  useEffect(() => {
    const onRootBack = (event: Event) => {
      if (tab === 'today') return
      event.preventDefault()
      setTab('today')
    }
    window.addEventListener('xcj:root-back', onRootBack)
    return () => window.removeEventListener('xcj:root-back', onRootBack)
  }, [tab])

  // 卡片通透度：写进 CSS 变量，所有 .card 的背景透明度实时跟随（1 = 不透明）
  const cardAlphaSetting = ctx?.data.settings.cardAlpha ?? 1
  useEffect(() => {
    document.documentElement.style.setProperty('--card-alpha', String(cardAlphaSetting))
    // 能量大卡用温和曲线：最低也有 0.72，保证上面白字仍然清晰
    document.documentElement.style.setProperty('--hero-alpha', String(0.6 + 0.4 * cardAlphaSetting))
  }, [cardAlphaSetting])

  if (!ctx || !ctx.ready) {
    return <AppSkeleton />
  }

  const { data, badgeQueue, ackBadge, notice, updateSettings, notify } = ctx

  const cycleTheme = async () => {
    const idx = THEME_CYCLE.indexOf(themeSetting)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    const ok = await updateSettings({ theme: next })
    if (ok) {
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const nextMeta = THEME_META[next]
      const suffix = next === 'auto' ? `（当前系统为${sysDark ? '深色' : '浅色'}）` : ''
      notify(`${nextMeta.icon} 已切换外观：${nextMeta.label}${suffix}`)
    }
  }

  const showQuote = (kind: 'task' | 'mood') => {
    const text = pickQuote(kind, lastQuote.current)
    lastQuote.current = text
    setQuote({ text, key: Date.now() })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setQuote(null), 4500)
  }

  const wp = data.settings.wallpaper
  const bgStyle = wallpaperStyle(wp, tab, resolvedDark)
  const currentThemeMeta = THEME_META[themeSetting]

  return (
    <div className="relative min-h-dvh">
      {/* 底层：自适应浅色/深色渐变壁纸 + 柔和弥散光晕（衬托前景渐变毛玻璃） */}
      <div className="fixed inset-0 -z-10 transition-colors duration-300" style={bgStyle} />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/12" />
        <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-amber-200/35 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl dark:bg-indigo-500/12" />
      </div>

      {wp.type === 'image' && (
        <>
          <div
            className="fixed inset-0 -z-10 bg-cover bg-center transition-opacity duration-300"
            style={{ backgroundImage: `url(${wp.value})`, opacity: wp.opacity ?? 1 }}
          />
          {(wp.opacity ?? 1) >= 0.7 && <div className="wallpaper-veil fixed inset-0 -z-10" />}
        </>
      )}

      {/* 桌面端三区顶部毛玻璃导航栏 */}
      <header className="nav-panel sticky top-0 z-30 hidden border-b lg:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-8 px-6 py-3">
          <button
            type="button"
            onClick={() => {
              setOverlay(null)
              setTab('today')
            }}
            className="min-h-[44px] shrink-0 text-lg font-bold tracking-tight text-slate-800 whitespace-nowrap"
          >
            🍊 小成就
          </button>

          <nav className="flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                setOverlay(null)
                setTab('today')
              }}
              className={`min-h-[44px] shrink-0 whitespace-nowrap transition-colors hover:text-orange-500 ${
                tab === 'today' && !overlay ? 'font-bold text-orange-500 underline underline-offset-8' : ''
              }`}
            >
              今日打卡
            </button>
            <button
              type="button"
              onClick={() => {
                setOverlay(null)
                setTab('stats')
              }}
              className={`min-h-[44px] shrink-0 whitespace-nowrap transition-colors hover:text-orange-500 ${
                tab === 'stats' && !overlay ? 'font-bold text-orange-500 underline underline-offset-8' : ''
              }`}
            >
              成长统计
            </button>
            <button
              type="button"
              onClick={() => setOverlay('diary')}
              className={`min-h-[44px] shrink-0 whitespace-nowrap transition-colors hover:text-orange-500 ${
                overlay === 'diary' ? 'font-bold text-orange-500 underline underline-offset-8' : ''
              }`}
            >
              岁月日记
            </button>
            <button
              type="button"
              onClick={() => setOverlay('notes')}
              className={`min-h-[44px] shrink-0 whitespace-nowrap transition-colors hover:text-orange-500 ${
                overlay === 'notes' ? 'font-bold text-orange-500 underline underline-offset-8' : ''
              }`}
            >
              灵感便签
            </button>
            <button
              type="button"
              onClick={() => {
                setOverlay(null)
                setTab('me')
              }}
              className={`min-h-[44px] shrink-0 whitespace-nowrap transition-colors hover:text-orange-500 ${
                tab === 'me' && !overlay ? 'font-bold text-orange-500 underline underline-offset-8' : ''
              }`}
            >
              我的空间
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => void cycleTheme()}
              aria-label={`切换主题（当前：${currentThemeMeta.label}）`}
              title={`当前：${currentThemeMeta.label}（点击切换 浅色/深色/跟随系统）`}
              className="glass-pill inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-orange-300 active:scale-95"
            >
              <span>{currentThemeMeta.icon}</span>
              <span>{currentThemeMeta.label}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOverlay(null)
                setTab('today')
                setFocusTrigger((n) => n + 1)
              }}
              className="btn-primary relative min-h-[44px] shrink-0 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap"
            >
              🍅 {focusRunning ? '专注进行中' : '开启专注'}
              {focusRunning && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-200" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-5 lg:max-w-5xl lg:px-6 lg:pb-16 lg:pt-6">
        {ctx.storageWarning && (
          <section
            role="alert"
            className="mb-4 rounded-3xl border border-red-200 bg-red-50/95 p-5 text-red-700 shadow-xs dark:border-red-900 dark:bg-red-950/80 dark:text-red-200"
          >
            <p className="text-[15px] font-semibold">数据保护提醒</p>
            <p className="mt-1 text-xs leading-relaxed">{ctx.storageWarning}</p>
            <div className="mt-3 flex gap-2">
              {ctx.corruptRaw && (
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white"
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
                type="button"
                className="min-h-[44px] rounded-xl bg-white/80 px-3.5 py-2 text-xs font-medium text-red-600 dark:bg-slate-800 dark:text-red-200"
                onClick={ctx.dismissStorageWarning}
              >
                知道了
              </button>
            </div>
          </section>
        )}

        {/* TodayPage 保持挂载以维持后台专注计时器不中断，切换 Tab 时触发 150ms 淡入动效 */}
        <div
          key={tab === 'today' ? 'tab-today' : undefined}
          className={tab === 'today' ? 'anim-tab-fade block' : 'hidden'}
        >
          <TodayPage
            showQuote={showQuote}
            onOpenDiary={() => setOverlay('diary')}
            onOpenNotes={() => setOverlay('notes')}
            onGoJournal={() => {
              setOverlay(null)
              setTab('journal')
            }}
            focusTrigger={focusTrigger}
            onFocusRunningChange={setFocusRunning}
            onCycleTheme={() => void cycleTheme()}
            themeMode={themeSetting}
          />
        </div>

        {tab === 'journal' && (
          <div key="tab-journal" className="anim-tab-fade">
            <JournalPage showQuote={showQuote} />
          </div>
        )}
        {tab === 'stats' && (
          <div key="tab-stats" className="anim-tab-fade">
            <StatsPage />
          </div>
        )}
        {tab === 'me' && (
          <div key="tab-me" className="anim-tab-fade">
            <MePage onGoToday={() => setTab('today')} resolvedDark={resolvedDark} />
          </div>
        )}
      </main>

      <BottomNav tab={tab} onChange={setTab} />
      {overlay === 'diary' && (
        <DiaryPage onClose={() => setOverlay(null)} bg={wallpaperStyle(wp, 'today', resolvedDark)} showQuote={showQuote} />
      )}
      {overlay === 'notes' && (
        <NotesPage onClose={() => setOverlay(null)} bg={wallpaperStyle(wp, 'today', resolvedDark)} />
      )}

      {/* 轻量级操作反馈通知（毛玻璃悬浮胶囊） */}
      {notice && (
        <div
          role="status"
          className="anim-fade-in pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
        >
          <div className="rounded-2xl border border-white/20 bg-slate-900/88 px-4 py-2.5 text-xs font-medium text-white shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-800/92">
            {notice}
          </div>
        </div>
      )}

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
