export const MIN_FOCUS_MINUTES = 1
export const MAX_FOCUS_MINUTES = 180
export const DEFAULT_FOCUS_MINUTES = 25
export const STALE_FOCUS_MS = 6 * 3600_000
export const MAX_FUTURE_FOCUS_MS = (MAX_FOCUS_MINUTES + 1) * 60_000

export interface PersistedFocus {
  status: 'running' | 'paused'
  minutes: number
  /** running 时的挂钟目标结束时间 */
  targetEndTime: number | null
  /** paused 时的剩余秒数 */
  remainingAtPause: number | null
  taskId: string | null
  taskTitle: string | null
  alsoCheckIn: boolean
}

export type SanitizedFocusResult =
  | { kind: 'running'; session: PersistedFocus; secondsLeft: number }
  | { kind: 'paused'; session: PersistedFocus; secondsLeft: number }
  | { kind: 'settle-recovered'; session: PersistedFocus }
  | { kind: 'settle-stale'; session: PersistedFocus }
  | { kind: 'invalid' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** 将专注分钟数限制在 1..180 的整数，遇到 NaN / 非有限 / <=0 安全回退 */
export function clampFocusMinutes(raw: unknown, fallback = DEFAULT_FOCUS_MINUTES): number {
  const safeFallback =
    typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0
      ? Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(fallback)))
      : DEFAULT_FOCUS_MINUTES
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return safeFallback
  }
  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(raw)))
}

/** 启动恢复时对持久化的专注状态做完整清洗与超龄判定 */
export function sanitizePersistedFocus(raw: unknown, now = Date.now()): SanitizedFocusResult {
  if (!isRecord(raw)) return { kind: 'invalid' }
  if (raw.status !== 'running' && raw.status !== 'paused') return { kind: 'invalid' }
  if (!isFinitePositive(raw.minutes)) return { kind: 'invalid' }

  const minutes = clampFocusMinutes(raw.minutes)
  const taskId = typeof raw.taskId === 'string' && raw.taskId.trim() ? raw.taskId.trim().slice(0, 100) : null
  const taskTitle = typeof raw.taskTitle === 'string' && raw.taskTitle.trim() ? raw.taskTitle.trim().slice(0, 60) : null
  const alsoCheckIn = raw.alsoCheckIn === true

  if (raw.status === 'running') {
    if (!isFinitePositive(raw.targetEndTime)) return { kind: 'invalid' }
    if (raw.targetEndTime - now > MAX_FUTURE_FOCUS_MS) return { kind: 'invalid' }

    const session: PersistedFocus = {
      status: 'running',
      minutes,
      targetEndTime: raw.targetEndTime,
      remainingAtPause: null,
      taskId,
      taskTitle,
      alsoCheckIn,
    }

    if (raw.targetEndTime > now + 1000) {
      return {
        kind: 'running',
        session,
        secondsLeft: Math.ceil((raw.targetEndTime - now) / 1000),
      }
    }
    if (raw.targetEndTime < now - STALE_FOCUS_MS) {
      return { kind: 'settle-stale', session }
    }
    return { kind: 'settle-recovered', session }
  }

  // paused 状态校验 remainingAtPause 为有限正数，且不超出合理上限
  if (!isFinitePositive(raw.remainingAtPause)) return { kind: 'invalid' }
  if (raw.remainingAtPause > MAX_FOCUS_MINUTES * 60) return { kind: 'invalid' }

  const remainingAtPause = Math.min(minutes * 60, Math.max(1, Math.ceil(raw.remainingAtPause)))
  const session: PersistedFocus = {
    status: 'paused',
    minutes,
    targetEndTime: null,
    remainingAtPause,
    taskId,
    taskTitle,
    alsoCheckIn,
  }
  return {
    kind: 'paused',
    session,
    secondsLeft: remainingAtPause,
  }
}
