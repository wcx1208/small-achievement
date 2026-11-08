import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** 触感反馈：网页端自动降级为 no-op，APK 内真实震动 */
export async function hapticTap() {
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* 无触感能力时静默 */
  }
}

export async function hapticSuccess() {
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    /* 同上 */
  }
}
