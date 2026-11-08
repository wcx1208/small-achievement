import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Modal } from './Modal'
import { clampOffset, computeCropRect, coverScale } from '../lib/crop'

interface CropModalProps {
  open: boolean
  /** 图片源（dataURL / objectURL 均可） */
  src: string | null
  /** 裁切框宽高比（宽/高）：壁纸传屏幕比例，图标传 1 */
  aspect: number
  title: string
  /** 输出编码：壁纸用 JPEG，图标用 PNG */
  outMime: 'image/jpeg' | 'image/png'
  quality?: number
  /** 输出最长边上限（原图分辨率裁切，仅超限时等比缩小） */
  maxOut?: number
  /** 强制输出尺寸（正方形，如图标固定 512×512），设置后忽略 maxOut */
  outSize?: number
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

interface Meta {
  img: HTMLImageElement
  natW: number
  natH: number
}

function frameSize(aspect: number): { w: number; h: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let w = Math.min(320, vw - 88)
  let h = w / aspect
  const maxH = vh * 0.52
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }
  return { w: Math.round(w), h: Math.round(h) }
}

/** 无损裁切弹窗：拖动定位 + 缩放，按原图像素分辨率输出所选区域 */
export function CropModal({ open, src, aspect, title, outMime, quality = 0.9, maxOut, outSize, onConfirm, onCancel }: CropModalProps) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const frame = frameSize(aspect)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  // 每次打开重新加载图片并复位视图
  useEffect(() => {
    if (!open || !src) {
      setMeta(null)
      setError(null)
      return
    }
    setMeta(null)
    setError(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        setError('图片尺寸异常，请换一张试试')
        return
      }
      setMeta({ img, natW: img.naturalWidth, natH: img.naturalHeight })
    }
    img.onerror = () => setError('这张图片无法打开，请换一张 JPG / PNG 图片')
    img.src = src
  }, [open, src])

  const base = meta ? coverScale(meta.natW, meta.natH, frame.w, frame.h) : 1

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!meta) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!meta || !drag.current) return
    const next = clampOffset(meta.natW, meta.natH, frame.w, frame.h, zoom, drag.current.ox + (e.clientX - drag.current.px), drag.current.oy + (e.clientY - drag.current.py))
    setOffset(next)
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const changeZoom = (z: number) => {
    if (!meta) return
    setZoom(z)
    setOffset((o) => clampOffset(meta.natW, meta.natH, frame.w, frame.h, z, o.x, o.y))
  }

  const confirm = () => {
    if (!meta) return
    const rect = computeCropRect(meta.natW, meta.natH, frame.w, frame.h, zoom, offset.x, offset.y)
    let outW = Math.round(rect.sw)
    let outH = Math.round(rect.sh)
    if (outSize) {
      // 固定输出尺寸（图标场景）：不足时等比放大，保证交付规格一致
      outW = outSize
      outH = outSize
    } else if (maxOut && Math.max(outW, outH) > maxOut) {
      const k = maxOut / Math.max(outW, outH)
      outW = Math.max(1, Math.round(outW * k))
      outH = Math.max(1, Math.round(outH * k))
    }
    const canvas = document.createElement('canvas')
    const targetLength = outMime === 'image/png' ? 760_000 : 1_150_000

    // 先按正常质量编码；仍超 localStorage 安全线时缩小尺寸并重试，避免保存阶段才失败。
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, outW)
      canvas.height = Math.max(1, outH)
      const context = canvas.getContext('2d')
      if (!context) {
        setError('当前设备无法处理这张图片，请换一张')
        return
      }
      context.drawImage(meta.img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height)
      const q = attempt === 0 ? quality : Math.max(0.45, quality - attempt * 0.12)
      const url = canvas.toDataURL(outMime, q)
      if (url.length <= targetLength || Math.min(outW, outH) <= 320) {
        onConfirm(url)
        return
      }
      const scale = Math.min(0.9, Math.max(0.55, Math.sqrt(targetLength / url.length) * 0.94))
      outW = Math.max(1, Math.round(outW * scale))
      outH = Math.max(1, Math.round(outH * scale))
    }
    setError('图片处理后仍然太大，请换一张尺寸更小的图片')
  }

  return (
    <Modal open={open} onClose={onCancel} closeOnBackdrop={false}>
      <p className="text-center font-bold text-slate-800">{title}</p>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mx-auto mt-4 touch-none overflow-hidden rounded-2xl bg-slate-900/90"
        style={{ width: frame.w, height: frame.h, cursor: error ? 'default' : meta ? 'grab' : 'wait' }}
      >
        {meta && (
          <img
            src={src!}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width: meta.natW * base * zoom,
              height: meta.natH * base * zoom,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/80 px-4 text-center text-xs leading-relaxed text-white">
            {error}
          </div>
        )}
        {/* 三分线辅助 */}
        <div className="pointer-events-none absolute inset-0 border-2 border-white/70" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-slate-400">缩小</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => changeZoom(Number(e.target.value))}
          className="flex-1 accent-orange-500"
          aria-label="缩放"
        />
        <span className="text-xs text-slate-400">放大</span>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">拖动调整位置，按原图分辨率裁切输出</p>
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="shrink-0 rounded-2xl bg-slate-100 px-5 py-3 text-[15px] text-slate-500">
          取消
        </button>
        <button onClick={confirm} disabled={!meta || !!error} className="btn-primary flex-1 disabled:opacity-40">
          ✓ 就用这样
        </button>
      </div>
    </Modal>
  )
}
