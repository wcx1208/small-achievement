import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// PWA：仅网页环境注册 Service Worker（Capacitor 原生壳内资源本就内置在 APK 中，
// 注册 SW 反而会让应用内升级被旧缓存卡住，因此原生平台跳过）
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* 注册失败不影响使用，只是没有离线缓存 */
    })
  })
}

// 安卓返回键：弹窗开着→只关最上层弹窗；日记/便签页开着→返回主页；
// 其他 Tab→先回今日页；已在今日页→退出应用。
if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (document.querySelector('[role="dialog"]')) {
      window.dispatchEvent(new Event('xcj:back'))
      return
    }
    if (document.querySelector('[data-native-overlay]')) {
      window.dispatchEvent(new Event('xcj:overlay-back'))
      return
    }
    const rootBack = new Event('xcj:root-back', { cancelable: true })
    window.dispatchEvent(rootBack)
    if (!rootBack.defaultPrevented) void CapApp.exitApp()
  })
}
