interface QuoteToastProps {
  text: string | null
  onDismiss: () => void
}

/** 打卡/记录后浮现的随机鼓励语，点击或超时自动消失 */
export function QuoteToast({ text, onDismiss }: QuoteToastProps) {
  if (!text) return null
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4" onClick={onDismiss}>
      <div className="anim-slide-up toast-panel mx-auto flex max-w-md cursor-pointer items-start gap-3 rounded-3xl border border-orange-100 bg-white/95 p-4 shadow-xl backdrop-blur">
        <span className="text-xl">💬</span>
        <p className="text-sm leading-relaxed text-slate-600">{text}</p>
      </div>
    </div>
  )
}
