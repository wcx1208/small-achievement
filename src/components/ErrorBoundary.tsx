import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { getCorruptSnapshot, getRawSnapshot } from '../storage'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** 根级错误边界：即使遇到未预料的渲染异常，也先让用户把原始数据导出来再重置 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('小成就渲染异常', error, info)
  }

  private download = () => {
    const raw = getRawSnapshot() ?? getCorruptSnapshot()
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xiaochengjiu-emergency-${Date.now()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  render() {
    if (!this.state.error) return this.props.children
    const hasBackup = !!(getRawSnapshot() ?? getCorruptSnapshot())
    return (
      <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-orange-50 to-amber-100 px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
          <p className="text-4xl">🍊</p>
          <h1 className="mt-3 text-lg font-bold text-slate-800">页面遇到了问题</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            数据可能仍在本地。请先下载原始备份，再尝试重新加载，避免直接清除应用数据。
          </p>
          <button
            onClick={this.download}
            disabled={!hasBackup}
            className="mt-5 w-full rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            下载原始数据备份
          </button>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 w-full rounded-2xl bg-slate-100 py-3 text-sm font-medium text-slate-600"
          >
            重新加载
          </button>
          <p className="mt-4 break-words text-[10px] text-slate-400">{this.state.error.message}</p>
        </div>
      </div>
    )
  }
}
