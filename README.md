# 小成就 🍊

> 记录任务完成与情绪感受，给自己看得见的正反馈的个人成长陪伴应用。

一个缓解拖延、积累成就感、看见情绪变化的单人应用：每完成一件小事、每记录一次心情，都会给你"看得见的正反馈"，让记录这件事本身带来能量。

## 功能亮点 (v1.5)

- 🌱 **成长等级与成就能量**：完成打卡、番茄专注、写日记、记心情或喝水均可累积能量（⚡），从 `Lv.1 初萌新芽` 进阶至 `Lv.6 岁月收藏家`
- ✅ **习惯与待办打卡**：支持 5 大分类（🌿健康 / 📚学习 / ⚡效率 / 🏠生活 / 🧘身心）、内置「✨ 灵感习惯库」、近 7 日日历条回看与**一键补打卡**
- 💧 **元气饮水站 & 🌤 心情速记**：手机首屏双列互动微组件，8 颗水滴点按即记饮水量（ml），5 档心情表情一键直达情绪记录
- 🍅 **番茄专注计时器**：支持绑定具体习惯或自由专注（5 / 15 / 25 / 45 分钟），专注完成可一键联动完成打卡
- 📖 **手账中心 & 时光回响**：底部独立「手账」分栏，聚合「岁月日记（含天气与心情印记）」、「灵感便签（支持置顶与标签过滤）」与「情绪流」，顶部内置「🕰️ 时光回响」随机重温往日记录
- ✨ **今日成就日签 & 12 枚徽章墙**：一键生成专属「今日成就日签」卡片（支持复制与系统分享），12 枚成长徽章实时展示解锁进度条
- 🖼 **个性化与数据自主**：8 套渐变壁纸 + 自定义照片壁纸、深浅色外观切换、自定义 App 图标，支持 JSON 完整备份导入/导出与 CSV 导出

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS v4 + ECharts + canvas-confetti；移动优先的响应式设计，PWA（可添加到主屏、离线可用）；通过 [Capacitor](https://capacitorjs.com) 打包为 Android APK。

数据层说明：所有数据存于浏览器 localStorage / APK 内置存储，经由独立的 storage 模块（异步接口 + 逐字段清洗 + 损坏保护）统一读写，便于日后替换为云端同步。

## 本地运行

```bash
npm install
npm run dev      # 开发（--host 已开，手机可通过局域网地址访问）
npm run build    # 构建静态产物到 dist/
npm run preview  # 预览构建产物
```

## 打包 Android APK

需要 JDK 17、Android SDK、Gradle 8.x：

```bash
npm run build
npx cap sync android
cd android && ./gradlew :app:assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

> 注意：AGP 不接受含中文/空格的路径，构建时请把工程放在纯 ASCII 路径下。

## 目录结构

```
src/
├─ storage/       # 全局唯一读写入口（异步接口 + 数据清洗 + 损坏保护）
├─ data/          # 类型定义、徽章规则、鼓励文案、壁纸预设
├─ lib/           # 日期、统计、裁切几何、触感反馈
├─ store/         # 全局数据上下文（动作 + 派生 + 小组件数据桥）
├─ components/    # 通用组件（Modal/CropModal/BottomNav/ProgressRing/ErrorBoundary）
├─ features/      # 任务 / 心情 / 日记 / 便签 / 激励 / 统计 / 设置
├─ pages/         # 今日 / 统计 / 我的
└─ plugins/       # 本地 Capacitor 插件（小组件刷新）
public/           # PWA 清单、Service Worker、应用图标
android/          # Capacitor 安卓工程（含桌面小组件）
docs/             # 功能设计文档
```

## 数据与隐私

所有记录只保存在本机（浏览器 localStorage / 应用内置存储），不上传任何服务器。换设备前请使用「我的 → 数据 → 导出备份」。

---
个人项目，仅供自用学习交流。
