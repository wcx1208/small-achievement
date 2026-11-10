import type { Repeat, TaskCategory } from './types'

/** 心情档位、默认标签、任务分类、习惯灵感库、壁纸预设等静态配置 */

export interface MoodOption {
  emoji: string
  label: string
  score: number
}

/** 心情 5 档，score 用于趋势折线（分数越高越积极） */
export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '😊', label: '开心', score: 5 },
  { emoji: '🙂', label: '不错', score: 4 },
  { emoji: '😐', label: '一般', score: 3 },
  { emoji: '☹️', label: '低落', score: 2 },
  { emoji: '😣', label: '糟糕', score: 1 },
]

export const DEFAULT_TAGS = ['开心', '平静', '满足', '期待', '充实', '治愈', '疲惫', '焦虑', '难过', '生气']

export interface CategoryMeta {
  id: TaskCategory
  label: string
  icon: string
}

export const TASK_CATEGORIES: CategoryMeta[] = [
  { id: 'health', label: '健康', icon: '🌿' },
  { id: 'study', label: '学习', icon: '📚' },
  { id: 'work', label: '效率', icon: '⚡' },
  { id: 'life', label: '生活', icon: '🏠' },
  { id: 'mind', label: '身心', icon: '🧘' },
]

export function getCategoryMeta(id?: TaskCategory): CategoryMeta {
  return TASK_CATEGORIES.find((c) => c.id === id) ?? TASK_CATEGORIES[3]
}

export interface HabitTemplate {
  title: string
  repeat: Repeat
  category: TaskCategory
  desc: string
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { title: '晨起喝一杯温水', repeat: 'daily', category: 'health', desc: '唤醒身体代谢' },
  { title: '阅读 10 页书', repeat: 'daily', category: 'study', desc: '每天积累一点新知' },
  { title: '户外散步 20 分钟', repeat: 'daily', category: 'health', desc: '吹吹风放松眼睛' },
  { title: '静心冥想 5 分钟', repeat: 'daily', category: 'mind', desc: '把注意力带回呼吸' },
  { title: '23:00 前放下手机', repeat: 'daily', category: 'health', desc: '给睡眠留出缓冲期' },
  { title: '随手整理书桌', repeat: 'once', category: 'life', desc: '清爽环境带来好心情' },
  { title: '专注攻克一件要事', repeat: 'daily', category: 'work', desc: '开启一个番茄钟' },
  { title: '肩颈拉伸舒展', repeat: 'daily', category: 'health', desc: '缓解久坐酸痛' },
]

export const DIARY_WEATHERS = [
  { id: 'sunny', label: '☀️ 晴朗' },
  { id: 'cloudy', label: '⛅ 多云' },
  { id: 'breeze', label: '🍃 微风' },
  { id: 'rainy', label: '🌧 听雨' },
  { id: 'night', label: '🌙 星夜' },
]

export const DIARY_PROMPTS = [
  {
    label: '✨ 今日三件小确幸',
    template: '今天值得记下来的三件小确幸：\n1. \n2. \n3. \n\n此刻对自己说一句：',
  },
  {
    label: '🌱 夸夸今天的自己',
    template: '今天虽然普通，但我做到了：\n\n最让我有成就感的一个瞬间：\n',
  },
  {
    label: '🍃 晚间思绪清理',
    template: '今天脑海里盘旋的事：\n\n可以放下不去纠结的事：\n\n明天最期待的一件小事：',
  },
]

export interface WallpaperPreset {
  id: string
  name: string
  css: string
  darkCss: string
}

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'sunrise',
    name: '晨光',
    css: 'linear-gradient(165deg, #FFF3E4 0%, #FFDFC0 48%, #FFC08A 100%)',
    darkCss: 'linear-gradient(165deg, #0B1120 0%, #1E1B2E 48%, #2D1B1E 100%)',
  },
  {
    id: 'peach',
    name: '蜜桃',
    css: 'linear-gradient(165deg, #FFEDEF 0%, #FFD9C6 55%, #FFC3A4 100%)',
    darkCss: 'linear-gradient(165deg, #0F1021 0%, #231729 55%, #311924 100%)',
  },
  {
    id: 'cream',
    name: '奶油',
    css: 'linear-gradient(165deg, #FFF9EC 0%, #FFEECF 60%, #FBE3B8 100%)',
    darkCss: 'linear-gradient(165deg, #0C121E 0%, #1B2234 60%, #262328 100%)',
  },
  {
    id: 'mint',
    name: '薄荷',
    css: 'linear-gradient(165deg, #EDF9F3 0%, #CFEEE1 55%, #AEDDCB 100%)',
    darkCss: 'linear-gradient(165deg, #07151A 0%, #0E262B 55%, #12302B 100%)',
  },
  {
    id: 'bamboo',
    name: '竹影',
    css: 'linear-gradient(165deg, #F2F8EE 0%, #DCEFD3 52%, #BCE0B4 100%)',
    darkCss: 'linear-gradient(165deg, #091614 0%, #132820 52%, #183124 100%)',
  },
  {
    id: 'ocean',
    name: '海盐',
    css: 'linear-gradient(165deg, #EDF6FF 0%, #D2E8FF 52%, #B1D4FA 100%)',
    darkCss: 'linear-gradient(165deg, #071120 0%, #0E2138 52%, #152C4A 100%)',
  },
  {
    id: 'dusk',
    name: '暮色',
    css: 'linear-gradient(165deg, #F4E9FF 0%, #EBD7F9 50%, #F8D6C6 100%)',
    darkCss: 'linear-gradient(165deg, #100E24 0%, #211938 50%, #2E1D32 100%)',
  },
  {
    id: 'night',
    name: '星夜',
    css: 'linear-gradient(165deg, #273456 0%, #313E68 55%, #3F3664 100%)',
    darkCss: 'linear-gradient(165deg, #060913 0%, #11182D 55%, #1E1B38 100%)',
  },
]

/** 应用默认壁纸（选择器里标记为「默认」，供一键恢复） */
export const DEFAULT_WALLPAPER_ID = 'sunrise'

export function findPreset(id: string): WallpaperPreset | undefined {
  return WALLPAPERS.find((w) => w.id === id)
}

/** 便签配色（柔和的糖果色系） */
export const NOTE_COLORS = [
  { id: 'amber', name: '暖杏', card: 'bg-amber-50/95 border-amber-200/80 dark:bg-amber-950/45 dark:border-amber-800/70' },
  { id: 'rose', name: '樱粉', card: 'bg-rose-50/95 border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-900/70' },
  { id: 'sky', name: '晴空', card: 'bg-sky-50/95 border-sky-200/80 dark:bg-sky-950/45 dark:border-sky-900/70' },
  { id: 'lime', name: '新芽', card: 'bg-lime-50/95 border-lime-200/80 dark:bg-lime-950/40 dark:border-lime-900/70' },
  { id: 'violet', name: '薰衣草', card: 'bg-violet-50/95 border-violet-200/80 dark:bg-violet-950/45 dark:border-violet-900/70' },
]

export function noteColorClass(id: string): string {
  return NOTE_COLORS.find((c) => c.id === id)?.card ?? NOTE_COLORS[0].card
}
