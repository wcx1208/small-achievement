import { useEffect } from 'react'
import { Modal } from '../../components/Modal'
import type { BadgeDef } from '../../data/badges'
import { bigCelebration } from './celebrate'
import { hapticSuccess } from '../../lib/haptics'

interface BadgeModalProps {
  def: BadgeDef
  onClose: () => void
}

/** 徽章解锁庆祝弹窗：入场动画 + 全屏彩带 + 触感反馈 */
export function BadgeModal({ def, onClose }: BadgeModalProps) {
  useEffect(() => {
    bigCelebration()
    hapticSuccess()
  }, [def])

  return (
    <Modal open onClose={onClose} closeOnBackdrop={false}>
      <div className="anim-badge-pop text-center">
        <div className="text-6xl">{def.emoji}</div>
        <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-orange-400">徽章解锁</p>
        <h3 className="mt-1 text-xl font-bold text-slate-800">{def.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{def.desc}</p>
        <button onClick={onClose} className="btn-primary mt-6 w-full">
          太棒啦，收下！
        </button>
      </div>
    </Modal>
  )
}
