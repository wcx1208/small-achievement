/* 小成就 Service Worker：离线缓存（手写轻量版，无第三方依赖）
 * 策略：页面导航 network-first（保证更新及时），静态资源 stale-while-revalidate */
const RAW_VERSION = 'v1.12.0'
const VERSION = RAW_VERSION.startsWith('__') ? 'dev' : RAW_VERSION
const CACHE = `xcj-${VERSION}`
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png',
]

function scopedIndexUrl() {
  return new URL('./index.html', self.registration.scope).href
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  // 页面导航：优先网络，仅 ok 时同步 clone 并通过同步注册的 waitUntil 托管缓存写入
  if (req.mode === 'navigate') {
    const indexUrl = scopedIndexUrl()
    let finishNavCache = () => {}
    const navCacheDone = new Promise((resolve) => {
      finishNavCache = resolve
    })
    e.waitUntil(navCacheDone)
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches
              .open(CACHE)
              .then((c) => c.put(indexUrl, copy))
              .catch(() => {})
              .finally(finishNavCache)
          } else {
            finishNavCache()
          }
          return res
        })
        .catch(() => {
          finishNavCache()
          return caches.match(indexUrl).then((matched) => matched || Response.error())
        }),
    )
    return
  }

  // 静态资源：先用缓存响应，后台异步更新，同步 clone 并由同步注册的 waitUntil 托管写入
  let finishAssetCache = () => {}
  const assetCacheDone = new Promise((resolve) => {
    finishAssetCache = resolve
  })
  e.waitUntil(assetCacheDone)
  e.respondWith(
    caches
      .match(req)
      .then((cached) => {
        const fetched = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches
                .open(CACHE)
                .then((c) => c.put(req, copy))
                .catch(() => {})
                .finally(finishAssetCache)
            } else {
              finishAssetCache()
            }
            return res
          })
          .catch(() => {
            finishAssetCache()
            return cached || Response.error()
          })
        return cached || fetched
      })
      .catch(() => {
        finishAssetCache()
        return Response.error()
      }),
  )
})
