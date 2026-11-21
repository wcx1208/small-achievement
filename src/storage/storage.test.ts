import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * 存储层测试（Opus 报告 #27）：
 * Node 环境没有 localStorage，先注入最小 stub，再动态导入被测模块。
 * 以后每新增一个 settings 字段，都在这里补一条「往返不丢失」断言——
 * normalizeSettings 白名单漏加会直接让测试变红。
 */
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, String(v))
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

const { loadData, saveData, clearStorage, getCorruptSnapshot, normalizeBackup, emptyData, defaultSettings } = await import(
  './index.ts'
)

const OLD_DATA_KEY = 'xiaochengjiu/data/v1'

test('新增设置字段往返不丢失（cardAlpha / theme / reminder / customIcon）', async () => {
  await clearStorage()
  const d = {
    ...emptyData(),
    settings: {
      ...defaultSettings(),
      cardAlpha: 0.6,
      theme: 'dark' as const,
      reminder: { enabled: true, time: '08:30' },
      customIcon: 'data:image/png;base64,iVBORw0KGgo=',
    },
  }
  await saveData(d)
  const loaded = (await loadData()).data
  assert.equal(loaded.settings.cardAlpha, 0.6)
  assert.equal(loaded.settings.theme, 'dark')
  assert.deepEqual(loaded.settings.reminder, { enabled: true, time: '08:30' })
  assert.equal(loaded.settings.customIcon, 'data:image/png;base64,iVBORw0KGgo=')
})

test('v1.0 老数据无损升级：缺字段自动补齐，记录完整保留', async () => {
  await clearStorage()
  const raw = JSON.stringify({
    version: 1,
    tasks: [{ id: 't1', title: '旧任务', repeat: 'daily', createdAt: 1000, archived: false }],
    checkIns: [{ id: 'c1', taskId: 't1', date: '2026-01-01', completedAt: 1000 }],
    moodLogs: [],
    badges: [],
    diaries: [],
    notes: [],
    settings: { wallpaper: { type: 'preset', value: 'mint' }, customTags: [], theme: 'light', reminder: { enabled: false, time: '21:00' } },
  })
  localStorage.setItem(OLD_DATA_KEY, raw)
  const loaded = (await loadData()).data
  assert.equal(loaded.tasks.length, 1)
  assert.equal(loaded.tasks[0].title, '旧任务')
  assert.equal(loaded.checkIns.length, 1)
  assert.equal(loaded.settings.theme, 'light')
  assert.equal(loaded.settings.wallpaper.value, 'mint')
  // 老数据没有的新字段：补齐默认值
  assert.equal(loaded.settings.cardAlpha, 1)
  assert.deepEqual(loaded.focusSessions, [])
  assert.deepEqual(loaded.waterLogs, {})
})

test('畸形数据进入损坏保护：切换安全空白模式且原文保留可下载', async () => {
  await clearStorage()
  localStorage.setItem(OLD_DATA_KEY, '{corrupted!!')
  const result = await loadData()
  assert.equal(result.data.tasks.length, 0)
  // warning 挂在 LoadResult 上（数据层与提示层分离）
  assert.ok(result.warning)
  assert.ok(getCorruptSnapshot()?.includes('corrupted'))
})

test('normalizeBackup 兼容 {app,schema,data} 外壳', async () => {
  const inner = {
    ...emptyData(),
    tasks: [{ id: 't1', title: '备份任务', repeat: 'daily', createdAt: 1, archived: false }],
    checkIns: [{ id: 'c1', taskId: 't1', date: '2026-01-01', completedAt: 1 }],
    moodLogs: [],
    badges: [],
    diaries: [],
    notes: [],
  }
  const norm = normalizeBackup({ app: 'xiaochengjiu', schema: 1, data: inner })
  assert.equal(norm.tasks.length, 1)
})

test('normalizeBackup 拒绝缺任务/打卡的备份', () => {
  assert.throws(() => normalizeBackup({ foo: 1 }), /缺少任务或打卡数据/)
})

test('未知 repeat 值被安全降级为单次，不崩溃', async () => {
  await clearStorage()
  const raw = JSON.stringify({
    version: 1,
    tasks: [{ id: 't1', title: 'x', repeat: 'weekly-unknown', createdAt: 1, archived: false }],
    checkIns: [],
    moodLogs: [],
    badges: [],
    diaries: [],
    notes: [],
  })
  localStorage.setItem(OLD_DATA_KEY, raw)
  const loaded = (await loadData()).data
  assert.equal(loaded.tasks.length, 1)
  assert.notEqual(loaded.tasks[0].repeat, 'weekly-unknown')
})

test('cardAlpha 越界值被钳制回 0.3~1', async () => {
  await clearStorage()
  const base = { ...emptyData(), settings: { ...defaultSettings(), cardAlpha: 5 } }
  await saveData(base)
  const loaded = (await loadData()).data
  assert.equal(loaded.settings.cardAlpha, 1)
})
