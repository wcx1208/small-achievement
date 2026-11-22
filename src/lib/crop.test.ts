import test from 'node:test'
import assert from 'node:assert/strict'
import { clampOffset, computeCropRect, coverScale } from './crop'

/** 裁切几何测试（Opus/Neon 报告 #1：方向反向 bug 的回归防线）
 * 基准：原图 800x400（横图）、裁切框 400x300（4:3）
 * cover 缩放 s = max(400/800, 300/400) = 0.75 → 显示 600x300，横向有裁切余量
 */

test('coverScale 取 cover 缩放', () => {
  // 800x400 横图在 400x300（4:3）框内：cover 取高度比 0.75
  assert.equal(coverScale(800, 400, 400, 300), 0.75)
  // 400x800 竖图在 400x300 框内：cover 取宽度比 1
  assert.equal(coverScale(400, 800, 400, 300), 1)
})

test('clampOffset 拖出边界被钳制、居中零偏移不变', () => {
  // zoom 1：800x400 显示为 600x300，纵向恰好铺满 → y 钳 0；横向余量 ±100
  assert.deepEqual(clampOffset(800, 400, 400, 300, 1, 50, 0), { x: 50, y: 0 })
  // zoom 2：显示 800x600，横向余量 ±400、纵向 ±150
  assert.deepEqual(clampOffset(800, 400, 400, 300, 2, 100, -40), { x: 100, y: -40 })
  // 超界回弹
  const s3 = clampOffset(800, 400, 400, 300, 2, 9999, -9999)
  // 显示宽 = 800 * (0.75*2) = 1200 → 横向余量 ±(1200-400)/2 = 400
  assert.equal(Math.abs(s3.x), 400)
  // 显示高 = 400 * 1.5 = 600 → 纵向余量 ±(600-300)/2 = 150
  assert.equal(Math.abs(s3.y), 150)
})

test('computeCropRect：居中零偏移取正中区域', () => {
  const r = computeCropRect(800, 400, 400, 300, 1, 0, 0)
  assert.equal(r.sw, 400 / 0.75) // 533.33（原图像素）
  assert.equal(r.sh, 300 / 0.75) // 400
  assert.equal(r.sx, (800 - r.sw) / 2)
  assert.equal(r.sy, 0)
})

test('computeCropRect：拖右（x>0）裁切区向左移动（sx 减小）', () => {
  const base = computeCropRect(800, 400, 400, 300, 2, 0, 0)
  const dragged = computeCropRect(800, 400, 400, 300, 2, 30, 0)
  assert.ok(dragged.sx < base.sx, '拖右后 sx 应减小（窗口右移看左边）')
  assert.equal(dragged.sw, base.sw)
  // 拖下（y>0）裁切区向上移动（sy 减小）——图像被拉下，露出上方内容
  const down = computeCropRect(800, 400, 400, 300, 2, 0, 20)
  assert.ok(down.sy < base.sy, '拖下后 sy 应减小')
})

test('computeCropRect：放大后可视区域变小（sw/sh 随 zoom 缩小）', () => {
  const near = computeCropRect(800, 400, 400, 300, 2, 0, 0)
  const far = computeCropRect(800, 400, 400, 300, 4, 0, 0)
  assert.ok(far.sw < near.sw)
  assert.ok(far.sh < near.sh)
})
