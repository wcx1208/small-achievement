import { Capacitor, registerPlugin } from '@capacitor/core'

/** 本地自定义插件：让 WebView 通知原生层立刻刷新桌面小组件 */
interface WidgetSyncPlugin {
  refresh(): Promise<void>
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync')

export async function refreshWidgetNow() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await WidgetSync.refresh()
  } catch {
    /* 刷新失败不影响主流程（还有 30 分钟周期兜底） */
  }
}
