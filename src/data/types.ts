/** 全局数据模型：所有集合统一存放在 AppData 中，由 storage 模块整体读写 */

export type Repeat = 'daily' | 'once'

export interface Task {
  id: string
  title: string
  repeat: Repeat
  createdAt: number
  archived: boolean
}

export interface CheckIn {
  id: string
  taskId: string
  /** 本地日期，格式 YYYY-MM-DD */
  date: string
  completedAt: number
}

export interface MoodLog {
  id: string
  date: string
  /** emoji 字符，如 😊 */
  emoji: string
  /** 1~5 分，对应 😣☹️😐🙂😊 */
  score: number
  tags: string[]
  text: string
  createdAt: number
  relatedTaskId?: string
}

export interface Badge {
  id: string
  unlockedAt: number
}

/** 日记：一段按日期组织的自由文字 */
export interface DiaryEntry {
  id: string
  /** YYYY-MM-DD，可补记历史 */
  date: string
  text: string
  createdAt: number
  updatedAt: number
}

/** 便签：随手记的小卡片 */
export interface Note {
  id: string
  text: string
  /** 便签配色 id，见 NOTE_COLORS */
  color: string
  createdAt: number
  updatedAt: number
}

/** 壁纸：preset 为预设渐变 id，image 为 dataURL */
export interface Wallpaper {
  type: 'preset' | 'image'
  value: string
  /** 图片壁纸的不透明度 0.3~1，缺省 1（完全实色）；纯 CSS 实现，不重编码图片 */
  opacity?: number
}

/** 外观主题：auto 跟随系统 */
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface AppSettings {
  wallpaper: Wallpaper
  /** 用户自定义的心情标签（在默认标签之外累积） */
  customTags: string[]
  /** 自定义 App 图标（dataURL，裁切后的方形图），用于导出 APK / PWA 安装图标 */
  customIcon?: string
  /** 外观主题 */
  theme: ThemeMode
  /** 每日打卡提醒 */
  reminder: { enabled: boolean; time: string }
}

export interface AppData {
  version: number
  tasks: Task[]
  checkIns: CheckIn[]
  moodLogs: MoodLog[]
  badges: Badge[]
  diaries: DiaryEntry[]
  notes: Note[]
  settings: AppSettings
}
