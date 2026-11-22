# 「小成就 🍊（xiaochengjiu）」v1.10.1 全面错误修复与美学升级执行提示词

---

## 0. 角色设定、项目背景与总体目标

你是「小成就（xiaochengjiu）」项目的**首席产品设计师 + 资深前端与移动端架构师**。

* **当前代码基线**：`xiaochengjiu` v1.10.1（commit `a9d2015c`）
* **技术栈**：React 18 + TypeScript + Vite 6 + Tailwind CSS v4 + ECharts 5 + PWA (`public/sw.js`) + Capacitor 6 Android（含原生桌面小组件 `WidgetProvider.java`）
* **已有亮点**：本地离线存储（`IndexedDB` / `localStorage` 迁移与白名单校验）、全局 `FocusContext` 番茄专注防漂移状态机、三态主题（浅色/深色/跟随系统）、自定义壁纸与裁切、卡片通透度滑杆、触感反馈与 `prefers-reduced-motion` 动效降级。

### 本轮迭代双核心目标
1. **代码缺陷清零（P0 优先）**：逐一修复全量代码审查中已定位的 **7 处真实 Bug**（包含裁切方向数学反向、两处 React Hooks 规则违规、专注提前结算闭包陈旧、SVG 渐变 ID 全局冲突、深色模式白底白字故障、动效延迟笔误与 SW 断网兜底异常），并补齐自动化单元测试。
2. **肉眼可见的美学跃升（P1–P2）**：将产品从「好用的毛玻璃工具原型」升级为「**温暖治愈、克制留白、真实材质、愉悦微反馈**」的精致个人手账 App（对标 Things 3 的清爽呼吸感 + Finch 的温柔陪伴感 + iOS 原生毛玻璃的光影层次）。

> **自由度说明**：你不限于特定实现方式，可以安装轻量依赖（如 `lucide-react`）、重塑 CSS 设计令牌、重构与拆分组件、优化布局与微动效；但必须严格遵守文末的《工程硬性约束与验收清单》。

---

## 第一阶段：P0 代码缺陷全量修复（必须先于美化完成）

请按顺序检查并修复以下 7 处明确缺陷：

### 1. 修复自定义壁纸/图标裁切方向反向 Bug（数学逻辑错误）
* **文件**：`src/lib/crop.ts` 第 42–45 行（联动 `src/components/CropModal.tsx` 第 157 行）
* **根因**：`CropModal.tsx` 使用 `transform: translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`。当用户向右拖动图片（`offset.x > 0`）时，裁切框实际展示的是原图**左侧**区域；但 `computeCropRect` 误写成 `+ x / s` 和 `+ y / s`，导致裁切结果与预览方向完全相反。
* **修正代码**：
  ```ts
  // src/lib/crop.ts
  // 图像相对裁切框平移 (+x, +y) 时，裁切框中心落在原图 (natW/2 - x/s, natH/2 - y/s)
  const sx = natW / 2 - x / s - sw / 2
  const sy = natH / 2 - y / s - sh / 2
  return { sx, sy, sw, sh }
  ```
* **必须补充测试**：新增 `src/lib/crop.test.ts`，覆盖：
  * 居中零偏移（`x = 0, y = 0`）
  * 向右/向下拖拽（`x > 0, y > 0` 时 `sx`/`sy` 应减小）
  * 向左/向上拖拽（`x < 0, y < 0` 时 `sx`/`sy` 应增大）
  * 不同缩放比例与不同宽高比裁切框。

### 2. 修复 `FocusModal.tsx` React Hooks 规则违规与冗余代码
* **文件**：`src/features/focus/FocusModal.tsx` 第 1–56 行
* **根因**：第 34 行先执行了 `if (!dataCtx) return null`，第 55 行才调用 `useState(false)`，违反 React Hooks 调用顺序规则；且第 1 行 `useEffect`、第 21 行 `modalTaskTitle`、第 35 行 `notify` 均为未使用变量。
* **修正要求**：
  * 将 `const [confirmExit, setConfirmExit] = useState(false)` 移至所有 `early return` 之前。
  * 清理未使用的 `useEffect`、`modalTaskTitle`、`notify`。

### 3. 修复 `WeeklyOverview.tsx` React Hooks 规则违规
* **文件**：`src/components/WeeklyOverview.tsx` 第 23–62 行
* **根因**：第 27 行 `if (!ctx) return null` 之后，第 31、40、49 行才调用 `useMemo`、`useMemo`、`useEffect`。
* **修正代码参考**：
  ```tsx
  const ctx = useData()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [rangeMode, setRangeMode] = useState<RangeMode>('7d')

  const data = ctx?.data
  const today = ctx?.today ?? ''
  const activeDate = ctx?.selectedDate || today

  const dayDates = useMemo(() => {
    if (!today) return []
    if (rangeMode === 'week') {
      const wk = weekToDateDays(today)
      return wk.length >= 4 ? wk : lastNDays(7, today)
    }
    if (rangeMode === '14d') return lastNDays(14, today)
    return lastNDays(7, today)
  }, [rangeMode, today])

  const overview = useMemo(
    () => (data && today ? getWeeklyOverview(data, today, dayDates) : null),
    [data, today, dayDates],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !activeDate) return
    const activeBtn = el.querySelector<HTMLElement>(`[data-date="${activeDate}"]`)
    if (activeBtn) {
      const targetLeft =
        activeBtn.offsetLeft - el.clientWidth / 2 + activeBtn.clientWidth / 2
      el.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    } else {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    }
  }, [rangeMode, activeDate])

  if (!ctx || !overview) return null
  ```

### 4. 修复 `FocusContext.tsx` 提前结算闭包陈旧与启动恢复竞态
* **文件**：`src/store/FocusContext.tsx` 第 216–218 行、第 379–383 行；联动 `src/features/focus/FocusModal.tsx` 第 227 行
* **根因**：
  1. `FocusModal.tsx` 执行 `completeEarly().then((ok) => ok && closeModal())` 时，`closeModal` 闭包中的 `done` 仍为旧值 `null`，导致 `if (done) setDone(null)` 被跳过；下次打开专注弹窗仍停留在「圆满达成」态。
  2. 关闭弹窗未同步重置 `settledRef.current = false`。
  3. 启动恢复 `useEffect` 未校验 `ctx.ready`，可能在存储初始化完成前触发补结算。
* **修正要求**：
  ```tsx
  // 1) 启动恢复守卫
  useEffect(() => {
    if (!ctx || !ctx.ready || hydratedRef.current) return
    hydratedRef.current = true
    // ...
  ```
  ```tsx
  // 2) 无条件重置 done 与 settledRef，彻底消除陈旧闭包依赖
  const closeModal = useCallback(() => {
    setModalOpen(false)
    setDone(null)
    settledRef.current = false
  }, [])
  ```

### 5. 修复 `ProgressRing.tsx` SVG 渐变 ID 全局冲突
* **文件**：`src/components/ProgressRing.tsx`
* **根因**：`<linearGradient id="ringGrad">` 全局硬编码。由于 `TodayPage` 保持挂载，打开 `FocusModal` 时页面中会同时存在两个 `id="ringGrad"`，在部分浏览器和 Android WebView 中隐藏/卸载其中一个会导致另一个进度环描边失效。
* **修正要求**：引入 React 18 `useId()` 生成唯一 `gradId`，并替换为 `stroke={`url(#${gradId})`}` 与 `<linearGradient id={gradId} ...>`。

### 6. 修复深色模式白底白字故障与高危全局类覆写
* **文件**：`src/components/CropModal.tsx`（第 185 行）、`src/components/ErrorBoundary.tsx`（第 41–42、57 行）、`src/index.css`（第 334–340 行）
* **根因**：`src/index.css` 全局覆写了 `.dark .text-slate-800` / `.text-slate-700` / `.text-slate-500` 为浅色，导致任何遗漏 `dark:bg-*` 的浅色组件（如 `CropModal` 取消按钮、`ErrorBoundary` 卡片与按钮）在深色模式下变成「白底浅灰字」。
* **修正要求**：
  1. `CropModal.tsx` 取消按钮补齐 `type="button"` 与 `dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`。
  2. `ErrorBoundary.tsx` 外层补齐 `dark:from-slate-950 dark:to-slate-900`，卡片补齐 `dark:bg-slate-900 dark:border-slate-800`，按钮补齐 `dark:bg-slate-800 dark:text-slate-200`。
  3. 排查全项目使用 `text-slate-*` 的组件，逐步替换为设计变量（`text-[var(--text-primary)]` / `text-[var(--text-secondary)]` / `text-[var(--text-muted)]`）或显式 `dark:text-*`，然后**移除** `src/index.css` 底部危险的 `.dark .text-slate-*` 全局强制覆写。

### 7. 修复动效错峰笔误与 Service Worker 断网回退异常
* **`src/index.css` 第 312–315 行**：第 4、5 项均为 `120ms`，修正为：
  ```css
  .stagger-list > *:nth-child(4) { animation-delay: 120ms; }
  .stagger-list > *:nth-child(5) { animation-delay: 160ms; }
  .stagger-list > *:nth-child(6) { animation-delay: 200ms; }
  .stagger-list > *:nth-child(n+7) { animation-delay: 240ms; }
  ```
* **`public/sw.js` 第 49–59 行**：断网且无本地缓存时 `.catch(() => cached)` 会返回 `undefined` 导致 `TypeError`，修正为：
  ```js
  .catch(() => cached ?? Response.error())
  ```

---

## 第二阶段：全站视觉美学重塑（核心升级）

### 设计语言总纲：「暖阳玻璃手账（Warm Glass Journal）」
* **情绪基调**：温柔、轻盈、克制、有成就感。杜绝廉价高饱和撞色、生硬灰边框、大面积拥挤信息堆砌。
* **光影哲学**：
  * **浅色模式**：暖象牙纸底（`#FFFDF9` → `#FFF6EB`）+ 顶部 `1px` 柔白内高光（`inset 0 1px 0 rgba(255, 255, 255, 0.85)`）+ 极淡暖橙弥散投影（`0 8px 28px -8px rgba(234, 88, 12, 0.08)`）。
  * **深色模式**：深邃暮夜蓝灰（`#0B1120` → `#111827`）+ 极细暖琥珀玻璃描边（`rgba(251, 146, 60, 0.16)`）+ 顶部微亮高光（`inset 0 1px 0 rgba(255, 255, 255, 0.06)`），绝不采用纯黑死黑或简单反色。
* **材质一致性**：所有玻璃表面遵循统一通透度变量曲线，壁纸透出柔和自然、文字始终保持 WCAG AA 以上对比度。

---

### 1. 图标体系全面升级（引入 `lucide-react`，视觉质变核心）
* **现状问题**：全项目仅 `ProgressRing` 有 1 个 SVG，其余导航、按钮、主题切换、统计卡片全部使用系统原生 Emoji，跨 Android/iOS/Windows 风格严重割裂。
* **改造方案**：安装 `lucide-react`（按需 Tree-shaking），严格划分**结构性图标**与**情绪内容**：
  * **结构性 UI 图标（全部改用 `lucide-react`）**：统一 `strokeWidth={1.85}`，默认 `18px–20px`，激活态配合暖橙色（`text-orange-500`）与极淡橙色胶囊底（`bg-orange-500/12`）。
  * **情绪与陪伴内容（保留 Emoji）**：5 档心情表情、12 枚成就徽章、庆祝文案与每日鼓励语，保留亲和力与手账温度。
* **推荐图标映射表**：

| 使用位置 | 旧 Emoji | 新 `lucide-react` 图标 | 样式要点 |
| :--- | :--- | :--- | :--- |
| 底部/顶部导航：今日 | `☀️` | `Sun` | 激活态加淡橙背景光晕 |
| 底部/顶部导航：手账 | `📖` | `BookOpen` | — |
| 底部/顶部导航：统计 | `📊` | `BarChart3` | — |
| 底部/顶部导航：我的 | `⭐` | `Sparkles` 或 `User` | — |
| 主题切换：跟随/浅色/深色 | `🌓 / ☀️ / 🌙` | `Contrast` / `Sun` / `Moon` | 切换时增加轻微旋转缩放过渡 |
| 专注番茄入口/状态 | `🍅` | `Timer` / `Flame` | 运行中配脉冲小红/橙点 |
| 日记 / 便签 / 心情子 Tab | `📖 / 🗒️ / 💭` | `Feather` / `StickyNote` / `Smile` | — |
| 饮水站 | `💧` | `Droplets` + 自定义精致水滴 SVG | 满杯带柔和渐变高光 |
| 编辑 / 删除 / 置顶 / 搜索 / 关闭 | `✏️ / 🗑️ / 📌 / 🔍 / ✕` | `Pencil` / `Trash2` / `Pin` / `Search` / `X` | 统一 `size={16}` |
| 设置页各分组标题 | 各类 Emoji | `Palette` / `Image` / `Bell` / `Database` / `Award` | 左侧配 28px 柔色圆角图标底 |

---

### 2. 毛玻璃通透度（`--card-alpha`）全界面统一联动
* **文件**：`src/index.css`
* **现状问题**：`--card-alpha` 仅作用于主卡片与子卡片，而 `--surface-water-glass`（饮水站）、`--surface-pill-glass`（顶栏等级徽标/主题按钮）、`--surface-nav-glass`（顶栏与底栏）均写死了固定不透明度；用户调低卡片通透度后，页面出现「一半通透、一半厚重」的视觉断层。
* **改造方案**：
  * `--surface-water-glass`：联动 `--hero-alpha`，保持水光蓝渐变与清晰度。
  * `--surface-pill-glass` 与 `--surface-nav-glass`：使用保底透明曲线，例如浅色模式 `rgba(255, 255, 255, calc(0.55 + 0.35 * var(--card-alpha)))`，深色模式 `rgba(15, 23, 42, calc(0.58 + 0.32 * var(--card-alpha)))`。
  * 为 `.glass-card` 补充微妙的顶部 1px 内高光与 `backdrop-filter: blur(18px) saturate(140%)`，提升真实磨砂质感。

---

### 3. 离线优先的精致字体与数字排版美学
* **文件**：`index.html`、`src/index.css`
* **现状问题**：`index.html` 外链 Google Fonts，在国内网络下经常阻塞或闪字，且 `sw.js` 不缓存跨域字体。
* **改造方案**：
  1. **彻底移除** `index.html` 中的 `fonts.googleapis.com` 与 `fonts.gstatic.com` 外链。
  2. 中文使用系统高颜值无衬线字体栈：
     ```css
     --font-sans: "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif;
     ```
  3. **数字仪式感**：对所有核心指标（连胜天数、完成率百分比、进度环数字、番茄倒计时、热力图与统计四宫格数字、日期印章）统一应用 `font-variant-numeric: tabular-nums`（Tailwind `tabular-nums`）+ `tracking-tight` + 半粗/粗体，避免倒计时跳动并增强杂志排版美感。

---

### 4. 今日页（`TodayPage.tsx`）视觉节奏、微动效与饮水站精简
* **主看板（Hero Card）**：
  * 给 `ProgressRing` 外圈增加极柔和的暖橙辉光（`drop-shadow`）；当今日完成率达到 `100%` 时，进度环边缘呈现温暖的庆祝微光与徽章提示。
  * 顶部问候语与日期排版更舒展，减少视觉元素相互挤压。
* **打卡清单（`TaskList.tsx`）**：
  * 勾选框增加弹性点击缩放（`active:scale-90`）与柔和的对勾绘制动画。
  * 已完成任务条目采用温和的透明度降级（`opacity-65`）+ 细删除线，与待办任务形成清晰层次，视觉清爽不杂乱。
  * 分类标签采用更柔和的低饱和胶囊（浅橙、雾蓝、鼠尾草绿、淡紫），深色模式下自动切换为半透明暗色胶囊。
* **元气饮水站视觉瘦身**：
  * 优化移动端纵向高度占用：将标题、当前进度（`3 / 8 杯`）、精致液态渐变进度条与 `+1 杯` 主操作按钮紧凑排布，下方 8 颗水滴收成单行高颜值圆点/小水滴指示器（点击任意水滴即可增减），避免 4×2 网格拉长首页滚动距离。

---

### 5. 新增移动端全局「专注进行中」灵动悬浮条
* **文件**：`src/App.tsx` 或新建 `src/features/focus/FocusFloatingBar.tsx`
* **痛点**：目前移动端切到「手账 / 统计 / 我的」Tab 后，用户无法感知正在后台运行的番茄钟倒计时。
* **方案**：
  * 当 `focus && (focus.status === 'running' || focus.status === 'paused') && !modalOpen` 时，在 `BottomNav` 上方（`bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]`）悬浮一条精致的毛玻璃胶囊条：
    * 左侧：呼吸动画脉冲圆点（运行中暖橙脉冲，暂停时柔和琥珀静态）+ `Timer` 图标 + 任务名称（超长截断）。
    * 右侧：`tabular-nums` 实时剩余时间（如 `24:18`）+ 快捷暂停/继续小按钮或「返回专注」箭头。
    * 整条点击直接调用 `openModal()` 回到 `FocusModal`。

---

### 6. 统一「手账 / 日记 / 便签」信息架构，消除双套重复实现
* **文件**：`src/App.tsx`、`src/pages/JournalPage.tsx`、`src/pages/TodayPage.tsx`、`src/features/diary/DiaryPage.tsx`、`src/features/notes/NotesPage.tsx`
* **现状问题**：移动端底部导航走 `JournalPage`（内含日记/便签/心情三子 Tab 与内联编辑器），桌面端顶栏和今日页快捷入口却弹出全屏覆盖层 `DiaryPage` 和 `NotesPage`，存在两套 UI 与编辑器，体验割裂且维护成本翻倍。
* **改造方案**：
  1. **桌面端与移动端一级导航完全统一**：均为 **今日 / 手账 / 统计 / 我的**（4 个一级入口）。
  2. **快捷入口直达**：在 `TodayPage` 点击「岁月日记」或「灵感便签」快捷入口时，直接切换至 `JournalPage` 并自动激活对应的 `subTab`（`'diary'` 或 `'notes'`），或直接唤起统一的编辑弹窗。
  3. **抽离共享组件**：抽离统一的 `DiaryEditorModal` 与 `NoteEditorModal`，移除冗余重复的覆盖层页面代码，并全面统一手账排版美学：
     * **岁月日记**：采用纸质手账卡片风格——左侧/顶部精致日期印章（大号日期 + 月份星期）+ 天气/心情柔和胶囊 + 舒展行高（`leading-relaxed`）。
     * **灵感便签**：重构便签色板为柔和高级的**莫兰迪手账色系**（浅杏暖黄、雾霭蓝、鼠尾草绿、淡樱粉、丁香紫），并在深色模式下自动切换为低饱和微发光暗色卡片，彻底告别刺眼高饱和色块。

---

### 7. 统计页（`StatsPage.tsx`）与数据可视化精致化
* **90 天热力图（`src/features/stats/Heatmap.tsx`）**：
  * 将写死的 `cellSize: [13, 13]` 改为响应式 `cellSize: ['auto', 14]`，合理配置 `calendar: { left: 28, right: 12, top: 24, bottom: 8 }`，彻底解决桌面宽屏右侧大面积留白问题。
  * 在热力图卡片底部补充精致的 5 档「少 □ □ □ □ □ 多」色阶图例。
  * 自定义美观的毛玻璃风格 `tooltip`（浅/深色自适应）。
* **心情趋势图（`src/features/stats/MoodTrend.tsx`）**：
  * 为折线下方增加细腻的暖橙→透明渐变面积填充，平滑曲线（`smooth: 0.4`）。
  * 数据不足 2 天时展示温柔的空状态插画/引导文案，而非冷冰冰的空白画布。
* **统计页性能优化**：`StatsPage.tsx` 中所有遍历计算（`getStreak`、`getLongestStreak`、`weeklyActivity`、`categoryBreakdown`、`tagFrequency`、`adherence`）统一用 `useMemo` 缓存，依赖 `[data.checkIns, data.tasks, data.moodLogs, today]`。

---

## 第三阶段：性能、代码架构、无障碍与 Android 原生打磨

### 1. 页面与重型组件代码分割（`React.lazy` + `Suspense`）
* **文件**：`src/App.tsx`
* 将非首屏页面与重型组件（`StatsPage`、`JournalPage`、`MePage`、`CropModal`）改为 `React.lazy(() => import(...))`，配合精致的毛玻璃骨架屏 `Suspense` Fallback，显著降低首屏 JS 解析体积与 Capacitor WebView 冷启动白屏时间。

### 2. 拆分超长单文件组件（提升可维护性）
* **`src/pages/MePage.tsx`（1,031 行）**：按卡片模块拆分为 `src/features/me/` 下的清晰子组件：
  * `GrowthLevelCard.tsx`（成长等级 + 分享海报生成）
  * `BadgeWallSection.tsx`（12 枚徽章墙）
  * `TaskManageSection.tsx`（习惯管理）
  * `AppearanceSection.tsx`（三态主题 + 壁纸选择器 + 卡片通透度滑杆 + 应用图标定制）
  * `ReminderSection.tsx`（每日提醒设置）
  * `DataBackupSection.tsx`（JSON/CSV 导入导出与数据统计）
* **`src/features/tasks/TaskList.tsx`（697 行）**：拆分出 `QuickAddCard.tsx`（快速添加 + 习惯模板库）与 `TaskEditModal.tsx`（任务编辑弹窗）。

### 3. 无障碍（A11y）与静态资源体积优化
* **`src/components/BottomNav.tsx`**：当前激活的导航按钮补充 `aria-current={active ? 'page' : undefined}`。
* **`src/components/Modal.tsx`**：弹窗打开时记录触发元素并将焦点自动移入弹窗容器（`tabIndex={-1}`），关闭时将焦点归还给触发元素，完善桌面端键盘体验。
* **内置壁纸压缩检查**：检查 `public/wallpapers/neonpaws.webp`（213 KB）与 `starwish.webp`（128 KB），如环境允许可二次压缩至 80 KB 以内（保持清晰度与 WebP 格式），降低 APK 与 PWA 缓存体积。

### 4. Android 原生桌面小组件升级
* **`android/app/src/main/java/com/xiaochengjiu/app/WidgetProvider.java`**：
  * 计算缓存日期 `date` 与当日 `today` 的自然日差值（使用 `SimpleDateFormat` 或 `LocalDate` 解析 `yyyy-MM-dd`）：
    * 差值为 `0`（今天已同步）：正常显示今日完成进度与连胜。
    * 差值为 `1`（昨日有打卡、今日尚未打开）：进度提示「打开看看今天 ✨」，连胜提示「续上 X 天连胜 🔥」。
    * 差值 `>= 2`（已断签多日）：不再显示过期旧连胜，改为提示「今日重新出发 🌱」。
* **Android 12+ 深色模式与预览布局适配**：
  * 新增 `android/app/src/main/res/drawable-night/widget_bg.xml`，提供深蓝灰渐变背景 + 暖橙强调色，避免夜间桌面刺眼。
  * 在 `android/app/src/main/res/xml/widget_info.xml` 补充 `android:previewLayout="@layout/widget_xiaochengjiu"`，让系统小组件选择器展示真实卡片预览。

---

## 第四阶段：工程硬性约束与验收闭环（不可违反）

### 硬性红线
1. **数据结构 100% 向前兼容**：`src/storage/index.ts` 的 `normalizeData` 与 `normalizeSettings` 为严格白名单机制。若新增任何设置字段，必须同步加入白名单与默认值，确保老版本备份 JSON 与现有本地数据 100% 无损读取。
2. **零功能删减**：保留全部既有能力（每日打卡、历史补打卡、习惯模板、番茄专注与防漂移补结算、饮水站、日记、便签、心情流、时光回响、90 天热力图、心情趋势、12 枚徽章、分享海报、壁纸裁切、通透度滑杆、三态主题、每日提醒、JSON/CSV 导入导出）。
3. **纯离线运行**：禁止引入任何依赖外网 CDN 的运行时字体、图标或脚本；不得破坏 `public/sw.js` 离线缓存与 Capacitor Android 构建结构。
4. **动效克制与无障碍**：所有新增动画保持 ≤ 300ms 轻盈手感，且严格遵循 `prefers-reduced-motion: reduce` 降级规则。

### 强制验证命令（全部通过方可交付）
请依次执行并确保零报错、零警告：
```bash
npm run lint    # TypeScript 类型全量检查零报错
npm run build   # Vite 生产构建成功，观察分包 chunk 是否生效
npm test        # 全部单元测试通过（含新增的 crop.test.ts）
```

### 交付验收报告格式
完成所有改动并通过上述命令验证后，请按以下结构输出最终总结：
1. **P0 Bug 修复核对表**：逐条列出 7 个问题的修复文件、关键改动与验证结果。
2. **美学升级亮点清单**：说明图标系统、通透度联动、浅/深色光影、手账卡片、移动端专注悬浮条、热力图等视觉提升要点。
3. **架构与性能变化**：列出拆分的模块目录结构、`React.lazy` 分包前后的首屏 bundle 体积对比。
4. **Android 原生改动说明**：列出小组件跨日逻辑与深色适配文件清单。
5. **自动化验证输出**：粘贴 `npm run lint`、`npm run build`、`npm test` 的实际通过结果。