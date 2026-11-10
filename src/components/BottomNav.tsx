export type TabId = 'today' | 'journal' | 'stats' | 'me'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'today', icon: '☀️', label: '今日' },
  { id: 'journal', icon: '📖', label: '手账' },
  { id: 'stats', icon: '📊', label: '统计' },
  { id: 'me', icon: '⭐', label: '我的' },
]

interface BottomNavProps {
  tab: TabId
  onChange: (t: TabId) => void
}

/** 底部四 Tab 导航（移动端拇指热区直达 今日 / 手账 / 统计 / 我的） */
export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="主导航"
      className="nav-panel fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 items-stretch pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-all ${
                active ? 'text-orange-500' : 'text-slate-400'
              }`}
            >
              <span className={`text-xl transition-transform ${active ? 'scale-110' : 'scale-100 opacity-75'}`}>
                {t.icon}
              </span>
              <span className={active ? 'font-bold' : 'font-medium'}>{t.label}</span>
              {active && (
                <span className="absolute bottom-1 h-1 w-4 rounded-full bg-orange-500" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
