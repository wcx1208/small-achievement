import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, ReactNode, TouchEvent } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  closeOnBackdrop?: boolean
  children: ReactNode
}

let openModalCount = 0
let savedBodyOverflow = ''

/** 底部弹层（移动端带拖拽把手、防背景滚动穿透、软键盘自适应）+ 居中弹窗（桌面端）的通用 Modal */
export function Modal({ open, onClose, closeOnBackdrop = true, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)

  useEffect(() => {
    if (!open) {
      setDragOffset(0)
      return
    }
    if (openModalCount === 0) {
      savedBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openModalCount++

    const onBack = () => {
      // 可能同时叠加多个弹窗（徽章 + 心情），只让 DOM 最上层响应返回键。
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
      if (dialogs[dialogs.length - 1] === panelRef.current) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('xcj:back', onBack)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.style.overflow = savedBodyOverflow
      }
      window.removeEventListener('xcj:back', onBack)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return
    const delta = (e.touches[0]?.clientY ?? touchStartY.current) - touchStartY.current
    if (delta > 0) setDragOffset(Math.min(160, delta))
  }

  const handleTouchEnd = () => {
    if (dragOffset > 64) {
      setDragOffset(0)
      onClose()
    } else {
      setDragOffset(0)
    }
    touchStartY.current = null
  }

  const handleFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 180)
    }
  }

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="anim-fade-in absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        onFocusCapture={handleFocusCapture}
        style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        className="anim-slide-up modal-panel relative max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] transition-transform duration-150 sm:rounded-3xl sm:p-6 sm:pb-6"
      >
        {/* 顶部拖拽把手条（移动端单手下滑可收起弹窗） */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="-mt-2 mb-3 flex cursor-grab justify-center py-2 sm:hidden"
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        {children}
      </div>
    </div>
  )
}
