import { useId } from 'react'
import type { ReactNode } from 'react'

interface ProgressRingProps {
  /** 0 ~ 1 */
  progress: number
  size?: number
  stroke?: number
  children?: ReactNode
}

/** 今日完成度进度环：SVG 双圆 + stroke-dashoffset 过渡动画（≤300ms） */
export function ProgressRing({ progress, size = 96, stroke = 10, children }: ProgressRingProps) {
  // 渐变 ID 全局唯一化：TodayPage 与 FocusModal 可能同时挂载两个进度环，
  // 共用硬编码 id 会让其中一个描边失效（Opus/Neon 报告 P0 #5）
  const gradId = useId()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-orange-100 dark:stroke-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFC53D" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
