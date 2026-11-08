/** 心情档位、默认标签、壁纸预设等静态配置 */

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

export const DEFAULT_TAGS = ['开心', '平静', '满足', '期待', '疲惫', '焦虑', '难过', '生气']

export interface WallpaperPreset {
  id: string
  name: string
  css: string
}

export const WALLPAPERS: WallpaperPreset[] = [
  { id: 'sunrise', name: '晨光', css: 'linear-gradient(165deg, #FFF3E4 0%, #FFDFC0 48%, #FFC08A 100%)' },
  { id: 'peach', name: '蜜桃', css: 'linear-gradient(165deg, #FFEDEF 0%, #FFD9C6 55%, #FFC3A4 100%)' },
  { id: 'cream', name: '奶油', css: 'linear-gradient(165deg, #FFF9EC 0%, #FFEECF 60%, #FBE3B8 100%)' },
  { id: 'mint', name: '薄荷', css: 'linear-gradient(165deg, #EDF9F3 0%, #CFEEE1 55%, #AEDDCB 100%)' },
  { id: 'dusk', name: '暮色', css: 'linear-gradient(165deg, #F4E9FF 0%, #EBD7F9 50%, #F8D6C6 100%)' },
  { id: 'night', name: '星夜', css: 'linear-gradient(165deg, #33436E 0%, #3D4A7E 55%, #4C4076 100%)' },
]

export function findPreset(id: string): WallpaperPreset | undefined {
  return WALLPAPERS.find((w) => w.id === id)
}

/** 便签配色（柔和的糖果色系） */
export const NOTE_COLORS = [
  { id: 'amber', card: 'bg-amber-100 border-amber-200 dark:bg-amber-950/45 dark:border-amber-800' },
  { id: 'rose', card: 'bg-rose-100 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900' },
  { id: 'sky', card: 'bg-sky-100 border-sky-200 dark:bg-sky-950/45 dark:border-sky-900' },
  { id: 'lime', card: 'bg-lime-100 border-lime-200 dark:bg-lime-950/40 dark:border-lime-900' },
  { id: 'violet', card: 'bg-violet-100 border-violet-200 dark:bg-violet-950/45 dark:border-violet-900' },
]

export function noteColorClass(id: string): string {
  return NOTE_COLORS.find((c) => c.id === id)?.card ?? NOTE_COLORS[0].card
}
