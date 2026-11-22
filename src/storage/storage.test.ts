import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearPreImportSnapshot,
  createSeedData,
  defaultSettings,
  getPreImportSnapshotMeta,
  getStorageUsage,
  loadData,
  loadPreImportSnapshot,
  normalizeBackup,
  normalizeData,
  PRE_IMPORT_SNAPSHOT_KEY,
  saveData,
  savePreImportSnapshot,
  STORAGE_KEY,
} from './index'

function installMockLocalStorage(opts?: { failKeyOnFirstLarge?: string; maxSetLength?: number }) {
  const store = new Map<string, string>()
  const mockStorage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      if (opts?.maxSetLength !== undefined && value.length > opts.maxSetLength) {
        throw new Error('QuotaExceededError')
      }
      if (opts?.failKeyOnFirstLarge && key === opts.failKeyOnFirstLarge && value.includes('data:image/')) {
        throw new Error('QuotaExceededError')
      }
      store.set(key, String(value))
    },
  }
  ;(globalThis as { localStorage: Storage }).localStorage = mockStorage as unknown as Storage
  return store
}

test('normalizeData preserves settings whitelist and upgrades v1.0 legacy payload losslessly', () => {
  const legacy = {
    version: 0,
    tasks: [
      { id: 't1', title: '早起喝水', repeat: 'daily', createdAt: 1700000000000, archived: false },
    ],
    checkIns: [
      { id: 'c1', taskId: 't1', date: '2026-11-01', completedAt: 1700000001000 },
    ],
    moodLogs: [
      { id: 'm1', date: '2026-11-01', emoji: '😊', score: 5, tags: ['开心'], text: '不错', createdAt: 1700000002000 },
    ],
    badges: [{ id: 'first-checkin', unlockedAt: 1700000003000 }],
    settings: {
      wallpaper: { type: 'preset', value: 'sunrise' },
      customTags: ['运动', '运动', '学习'],
      theme: 'dark',
      reminder: { enabled: true, time: '20:30' },
      cardAlpha: 0.75,
      customIcon: 'data:image/png;base64,AAA',
      unexpectedField: 'should-be-dropped',
    },
  }

  const normalized = normalizeData(legacy)
  assert.equal(normalized.version, 1)
  assert.equal(normalized.tasks.length, 1)
  assert.equal(normalized.checkIns.length, 1)
  assert.equal(normalized.diaries.length, 0)
  assert.equal(normalized.notes.length, 0)
  assert.deepEqual(normalized.focusSessions, [])
  assert.deepEqual(normalized.waterLogs, {})
  assert.deepEqual(normalized.settings.customTags, ['运动', '学习'])
  assert.equal(normalized.settings.theme, 'dark')
  assert.equal(normalized.settings.cardAlpha, 0.75)
  assert.equal(normalized.settings.reminder.time, '20:30')
  assert.equal(normalized.settings.customIcon, 'data:image/png;base64,AAA')
  assert.equal('unexpectedField' in (normalized.settings as unknown as Record<string, unknown>), false)
})

test('normalizeData handles malformed input safely without crashing', () => {
  const malformed = {
    tasks: [null, { title: '   ' }, { id: 'ok', title: '合法任务', repeat: 'invalid', createdAt: -1 }],
    checkIns: [{ taskId: 'ok', date: '2026-99-99' }, { taskId: 'ok', date: '2026-11-01', completedAt: Number.NaN }],
    moodLogs: [{ id: 'm1', date: '2026-11-01', score: 'not-a-number' }, { id: 'm2', date: '2026-11-01', score: 99, tags: ['标签'] }],
    settings: { wallpaper: { type: 'image', value: 'http://evil.example/a.png' }, cardAlpha: Number.NaN, theme: 'neon' },
  }

  const result = normalizeData(malformed)
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0].repeat, 'once')
  assert.equal(result.checkIns.length, 1)
  assert.equal(result.moodLogs.length, 1)
  assert.equal(result.moodLogs[0].score, 5)
  assert.deepEqual(result.settings.wallpaper, { type: 'preset', value: 'sunrise' })
  assert.equal(result.settings.cardAlpha, 1)
  assert.equal(result.settings.theme, 'auto')
})

test('normalizeData purges orphan checkIns and dangling task foreign keys while keeping archived task checkIns', () => {
  const payload = {
    tasks: [
      { id: 'active-1', title: '进行中任务', repeat: 'daily', createdAt: 1000, archived: false },
      { id: 'archived-1', title: '已归档任务', repeat: 'daily', createdAt: 1000, archived: true },
    ],
    checkIns: [
      { id: 'c1', taskId: 'active-1', date: '2026-11-01', completedAt: 1000 },
      { id: 'c2', taskId: 'archived-1', date: '2026-11-01', completedAt: 1000 },
      { id: 'c3', taskId: 'deleted-task', date: '2026-11-01', completedAt: 1000 },
    ],
    moodLogs: [
      { id: 'm1', date: '2026-11-01', score: 4, tags: [], text: '心情记录', createdAt: 1000, relatedTaskId: 'deleted-task' },
      { id: 'm2', date: '2026-11-01', score: 5, tags: [], text: '归档关联', createdAt: 1000, relatedTaskId: 'archived-1' },
    ],
    focusSessions: [
      { id: 'f1', taskId: 'deleted-task', taskTitle: '旧任务', date: '2026-11-01', minutes: 25, completedAt: 1000 },
      { id: 'f2', taskId: 'archived-1', taskTitle: '已归档任务', date: '2026-11-01', minutes: 15, completedAt: 1000 },
    ],
  }

  const normalized = normalizeData(payload)
  assert.deepEqual(
    normalized.checkIns.map((c) => c.taskId),
    ['active-1', 'archived-1'],
  )
  assert.equal(normalized.moodLogs[0].relatedTaskId, undefined)
  assert.equal(normalized.moodLogs[0].text, '心情记录')
  assert.equal(normalized.moodLogs[1].relatedTaskId, 'archived-1')
  assert.equal(normalized.focusSessions?.[0].taskId, undefined)
  assert.equal(normalized.focusSessions?.[0].taskTitle, '旧任务')
  assert.equal(normalized.focusSessions?.[0].minutes, 25)
  assert.equal(normalized.focusSessions?.[1].taskId, 'archived-1')
})

test('normalizeBackup unwraps envelope and strictly rejects invalid dates and timestamps', () => {
  const validWrapped = {
    app: 'xiaochengjiu',
    schema: 1,
    data: {
      tasks: [{ id: 't1', title: '散步', repeat: 'daily', createdAt: 1000, archived: false }],
      checkIns: [{ id: 'c1', taskId: 't1', date: '2026-11-05', completedAt: 2000 }],
      settings: defaultSettings(),
    },
  }
  const parsed = normalizeBackup(validWrapped)
  assert.equal(parsed.tasks.length, 1)
  assert.equal(parsed.checkIns.length, 1)

  assert.throws(
    () =>
      normalizeBackup({
        tasks: [{ id: 't1', title: '散步', repeat: 'daily', createdAt: 1000 }],
        checkIns: [{ id: 'c1', taskId: 't1', date: '2026-02-30', completedAt: 2000 }],
      }),
    /日期格式/,
  )

  assert.throws(
    () =>
      normalizeBackup({
        tasks: [{ id: 't1', title: '散步', repeat: 'daily', createdAt: 1000 }],
        checkIns: [],
        waterLogs: { 'not-a-date': 3 },
      }),
    /日期格式/,
  )

  assert.throws(
    () =>
      normalizeBackup({
        tasks: [{ id: 't1', title: '散步', repeat: 'daily', createdAt: -100 }],
        checkIns: [],
      }),
    /时间戳/,
  )

  assert.throws(
    () =>
      normalizeBackup({
        tasks: [{ id: 't1', title: '散步', repeat: 'daily', createdAt: 1000 }],
        checkIns: [{ id: 'c1', taskId: 't1', date: '2026-11-05', completedAt: Number.NaN }],
      }),
    /时间戳/,
  )
})

test('pre-import snapshot save/load/clear and automatic media stripping + storage usage calculation', async () => {
  installMockLocalStorage()
  const seed = createSeedData()
  await saveData(seed)

  // 常规快照保存与恢复
  const res1 = savePreImportSnapshot(seed)
  assert.equal(res1.ok, true)
  assert.equal(res1.strippedMedia, false)
  const meta1 = getPreImportSnapshotMeta()
  assert.ok(meta1)
  assert.equal(meta1.tasksCount, seed.tasks.length)
  assert.equal(meta1.checkInsCount, seed.checkIns.length)
  const loaded1 = loadPreImportSnapshot()
  assert.ok(loaded1)
  assert.equal(loaded1.tasks.length, seed.tasks.length)

  // 含大壁纸 (>800KB UTF-16, 即 >400k chars) 与 customIcon 时自动剥离媒体并标记 strippedMedia
  const largeWallpaper = `data:image/png;base64,${'A'.repeat(450_000)}`
  const largeIcon = `data:image/png;base64,${'B'.repeat(20_000)}`
  const mediaHeavy = {
    ...seed,
    settings: {
      ...seed.settings,
      wallpaper: { type: 'image' as const, value: largeWallpaper, opacity: 0.8 },
      customIcon: largeIcon,
    },
  }
  await saveData(mediaHeavy)
  const res2 = savePreImportSnapshot(mediaHeavy)
  assert.equal(res2.ok, true)
  assert.equal(res2.strippedMedia, true)
  assert.equal(res2.meta?.strippedMedia, true)
  const loaded2 = loadPreImportSnapshot()
  assert.ok(loaded2)
  assert.deepEqual(loaded2.settings.wallpaper, { type: 'preset', value: 'sunrise' })
  assert.equal(loaded2.settings.customIcon, undefined)

  // 存储空间用量统计拆解
  const usage = getStorageUsage()
  assert.ok(usage.usedBytes > 0)
  assert.equal(usage.quotaBytes, 5 * 1024 * 1024)
  assert.ok(usage.wallpaperBytes >= largeWallpaper.length * 2)
  assert.ok(usage.iconBytes >= largeIcon.length * 2)
  assert.ok(usage.snapshotBytes > 0)
  assert.ok(usage.recordsBytes > 0)
  assert.equal(
    usage.wallpaperBytes + usage.iconBytes + usage.recordsBytes + usage.snapshotBytes,
    usage.usedBytes,
  )

  // Quota 异常降级场景：小壁纸但在写快照时抛 QuotaExceededError，降级剥离后仍写入成功
  const store = installMockLocalStorage({ failKeyOnFirstLarge: PRE_IMPORT_SNAPSHOT_KEY })
  const smallMedia = {
    ...seed,
    settings: {
      ...seed.settings,
      wallpaper: { type: 'image' as const, value: 'data:image/png;base64,SMALL', opacity: 1 },
    },
  }
  const res3 = savePreImportSnapshot(smallMedia)
  assert.equal(res3.ok, true)
  assert.equal(res3.strippedMedia, true)
  assert.ok(store.has(PRE_IMPORT_SNAPSHOT_KEY))

  clearPreImportSnapshot()
  assert.equal(getPreImportSnapshotMeta(), null)
  assert.equal(loadPreImportSnapshot(), null)

  // 确认 loadData 从 mock localStorage 可读
  await saveData(seed)
  const loadedFromMain = await loadData()
  assert.equal(loadedFromMain.data.tasks.length, seed.tasks.length)
  assert.ok(store.has(STORAGE_KEY))
})
