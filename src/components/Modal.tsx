import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  closeOnBackdrop?: boolean
  children: ReactNode
}

/** 底部弹层（移动端）+ 居中弹窗（桌面端）的通用 Modal；安卓返回键通过 xcj:back 事件关闭 */
export function Modal({ open, onClose, closeOnBackdrop = true, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onBack = () => {
      // 可能同时叠加多个弹窗（徽章 + 心情），只让 DOM 最上层响应返回键。
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
      if (dialogs[dialogs.length - 1] === panelRef.current) onClose()
    }
    window.addEventListener('xcj:back', onBack)
    return () => window.removeEventListener('xcj:back', onBack)
  }, [open, onClose])

  if (!open) return null
  return (
    <div ref={panelRef} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div
        className="anim-fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div className="anim-slide-up modal-panel relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-6">
        {children}
      </div>
    </div>
  )
}
