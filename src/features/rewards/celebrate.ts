import confetti from 'canvas-confetti'

/** 彩带庆祝工具：打卡点小球形爆开，徽章解锁用双侧礼炮 */

const COLORS = ['#FF8A3D', '#FFC53D', '#FFE8CC', '#FF6B6B', '#7ED8A0']

/** 在点击位置放一朵小彩带 */
export function burstAt(x: number, y: number) {
  confetti({
    particleCount: 40,
    spread: 65,
    startVelocity: 26,
    scalar: 0.9,
    ticks: 160,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: COLORS,
    disableForReducedMotion: true,
  })
}

/** 徽章解锁：左右礼炮 + 中间补一发 */
export function bigCelebration() {
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 200 }
  confetti({ ...base, particleCount: 90, spread: 70, angle: 60, origin: { x: 0.15, y: 0.7 } })
  confetti({ ...base, particleCount: 90, spread: 70, angle: 120, origin: { x: 0.85, y: 0.7 } })
  setTimeout(
    () => confetti({ ...base, particleCount: 60, spread: 100, origin: { y: 0.6 } }),
    250,
  )
}
