import test from 'node:test'
import assert from 'node:assert/strict'
import { clampFocusMinutes, sanitizePersistedFocus, STALE_FOCUS_MS } from './focusSanitize'

test('clampFocusMinutes handles NaN, non-positive, decimals, and >180 safely', () => {
  assert.equal(clampFocusMinutes(25), 25)
  assert.equal(clampFocusMinutes(Number.NaN), 25)
  assert.equal(clampFocusMinutes(Number.POSITIVE_INFINITY), 25)
  assert.equal(clampFocusMinutes(Number.NEGATIVE_INFINITY), 25)
  assert.equal(clampFocusMinutes('25'), 25)
  assert.equal(clampFocusMinutes(null, 15), 15)
  assert.equal(clampFocusMinutes(0), 25)
  assert.equal(clampFocusMinutes(-12), 25)
  assert.equal(clampFocusMinutes(0.2), 1)
  assert.equal(clampFocusMinutes(25.4), 25)
  assert.equal(clampFocusMinutes(25.6), 26)
  assert.equal(clampFocusMinutes(180), 180)
  assert.equal(clampFocusMinutes(240), 180)
  assert.equal(clampFocusMinutes(9999), 180)
})

test('sanitizePersistedFocus validates running, paused, recovered, stale, and corrupted payloads', () => {
  const now = 1_700_000_000_000

  // 正常 running
  const running = sanitizePersistedFocus(
    {
      status: 'running',
      minutes: 25,
      targetEndTime: now + 120_000,
      remainingAtPause: null,
      taskId: 't1',
      taskTitle: '阅读',
      alsoCheckIn: true,
    },
    now,
  )
  assert.equal(running.kind, 'running')
  if (running.kind === 'running') {
    assert.equal(running.secondsLeft, 120)
    assert.equal(running.session.minutes, 25)
    assert.equal(running.session.taskId, 't1')
    assert.equal(running.session.alsoCheckIn, true)
  }

  // 正常 paused（minutes 超 180 会 clamp，remainingAtPause 限制在 minutes*60 内）
  const paused = sanitizePersistedFocus(
    {
      status: 'paused',
      minutes: 200,
      targetEndTime: null,
      remainingAtPause: 900,
      taskId: null,
      taskTitle: null,
      alsoCheckIn: false,
    },
    now,
  )
  assert.equal(paused.kind, 'paused')
  if (paused.kind === 'paused') {
    assert.equal(paused.session.minutes, 180)
    assert.equal(paused.secondsLeft, 900)
  }

  // 过点 10 分钟（<= 6h）：自动补结算
  const recovered = sanitizePersistedFocus(
    {
      status: 'running',
      minutes: 25,
      targetEndTime: now - 10 * 60_000,
      remainingAtPause: null,
      taskId: 't1',
      taskTitle: '喝水',
      alsoCheckIn: true,
    },
    now,
  )
  assert.equal(recovered.kind, 'settle-recovered')

  // 超龄 > 6 小时：settle-stale
  const stale = sanitizePersistedFocus(
    {
      status: 'running',
      minutes: 25,
      targetEndTime: now - STALE_FOCUS_MS - 1000,
      remainingAtPause: null,
      taskId: null,
      taskTitle: null,
      alsoCheckIn: false,
    },
    now,
  )
  assert.equal(stale.kind, 'settle-stale')

  // 未来超过 181 分钟：invalid
  const tooFar = sanitizePersistedFocus(
    {
      status: 'running',
      minutes: 25,
      targetEndTime: now + 190 * 60_000,
      remainingAtPause: null,
    },
    now,
  )
  assert.equal(tooFar.kind, 'invalid')

  // NaN / 损坏字段：invalid
  assert.equal(sanitizePersistedFocus(null, now).kind, 'invalid')
  assert.equal(sanitizePersistedFocus({ status: 'unknown', minutes: 25 }, now).kind, 'invalid')
  assert.equal(
    sanitizePersistedFocus({ status: 'running', minutes: Number.NaN, targetEndTime: now + 60_000 }, now).kind,
    'invalid',
  )
  assert.equal(
    sanitizePersistedFocus({ status: 'running', minutes: 25, targetEndTime: Number.NaN }, now).kind,
    'invalid',
  )
  assert.equal(
    sanitizePersistedFocus({ status: 'paused', minutes: 25, remainingAtPause: 0 }, now).kind,
    'invalid',
  )
  assert.equal(
    sanitizePersistedFocus({ status: 'paused', minutes: 25, remainingAtPause: Number.NaN }, now).kind,
    'invalid',
  )
})
