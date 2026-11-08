/** 简易唯一 id：时间戳 + 随机段 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
