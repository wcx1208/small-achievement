export type TabId = 'today' | 'stats' | 'me'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'today', icon: '☀️', label: '今日' },
  { id: 'stats', icon: '📊', label: '统计' },
  { id: 'me', icon: '⭐', label: '我的' },
]

interface BottomNavProps {
  tab: TabId
  onChange: (t: TabId) => void
}

/** 底部三 Tab 导航，适配 iOS 安全区 */
export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav className="nav-panel fixed inset-x-0 bottom-0 z-40 border-t border-orange-100/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-stretch pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-all ${
                active ? 'text-orange-500' : 'text-slate-400'
              }`}
            >
              <span className={`text-xl transition-transform ${active ? 'scale-110' : 'scale-100 opacity-70'}`}>
                {t.icon}
              </span>
              <span className={active ? 'font-semibold' : ''}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
