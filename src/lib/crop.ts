/** 裁切几何计算（纯函数，便于单独验证） */

/** 图片在裁切框内「恰好铺满」的基础缩放（cover 逻辑） */
export function coverScale(natW: number, natH: number, frameW: number, frameH: number): number {
  return Math.max(frameW / natW, frameH / natH)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** 拖动偏移量限幅：保证图片任何缩放下都铺满裁切框，不露边 */
export function clampOffset(
  natW: number,
  natH: number,
  frameW: number,
  frameH: number,
  zoom: number,
  ox: number,
  oy: number,
): { x: number; y: number } {
  const s = coverScale(natW, natH, frameW, frameH) * zoom
  const mx = Math.max(0, (natW * s - frameW) / 2)
  const my = Math.max(0, (natH * s - frameH) / 2)
  return { x: clamp(ox, -mx, mx), y: clamp(oy, -my, my) }
}

/** 由当前视图状态换算出「裁切框对应原图的像素区域」——输出即无损裁切结果 */
export function computeCropRect(
  natW: number,
  natH: number,
  frameW: number,
  frameH: number,
  zoom: number,
  ox: number,
  oy: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const { x, y } = clampOffset(natW, natH, frameW, frameH, zoom, ox, oy)
  const s = coverScale(natW, natH, frameW, frameH) * zoom
  const sw = frameW / s
  const sh = frameH / s
  // 图像中心在框内坐标为 (frameW/2 + x, frameH/2 + y)，换回原图坐标求左上角
  const sx = natW / 2 + x / s - sw / 2
  const sy = natH / 2 + y / s - sh / 2
  return { sx, sy, sw, sh }
}
