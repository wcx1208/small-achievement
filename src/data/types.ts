/** 全局数据模型：所有集合统一存放在 AppData 中，由 storage 模块整体读写 */

export type Repeat = 'daily' | 'once'

export type TaskCategory = 'health' | 'study' | 'work' | 'life' | 'mind'

export interface Task {
  id: string
  title: string
  repeat: Repeat
  category?: TaskCategory
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

/** 日记：一段按日期组织的自由文字，支持天气与心情印记 */
export interface DiaryEntry {
  id: string
  /** YYYY-MM-DD，可补记历史 */
  date: string
  text: string
  weather?: string
  mood?: string
  createdAt: number
  updatedAt: number
}

/** 便签：随手记的小卡片，支持置顶 */
export interface Note {
  id: string
  text: string
  /** 便签配色 id，见 NOTE_COLORS */
  color: string
  pinned?: boolean
  createdAt: number
  updatedAt: number
}

/** 番茄专注记录 */
export interface FocusSession {
  id: string
  taskId?: string
  taskTitle?: string
  /** 本地日期 YYYY-MM-DD */
  date: string
  /** 专注分钟数 */
  minutes: number
  completedAt: number
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
  focusSessions?: FocusSession[]
  /** 每日饮水杯数记录：key 为 YYYY-MM-DD，value 为杯数 (0~12) */
  waterLogs?: Record<string, number>
  settings: AppSettings
}
