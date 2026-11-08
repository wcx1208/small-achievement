# 小成就 🍊

> 记录任务完成与情绪感受，给自己看得见的正反馈的个人成长陪伴应用。

一个缓解拖延、积累成就感、看见情绪变化的单人应用：每完成一件小事、每记录一次心情，都会给你"看得见的正反馈"，让记录这件事本身带来能量。

## 功能

- ✅ **任务打卡**：一句话添加，每日重复 / 单次两种类型，一键完成并记录时间，支持归档、重命名、删除
- 💭 **情绪记录**：完成打卡后轻量引导（5 档 emoji + 一句话感受，可跳过）；心情日记支持标签与补记历史日期
- 📖 **日记 & 便签**：全屏日记时间线（可补记）、彩色便签墙，都放在最顺手的位置
- 🔥 **正反馈系统**：连胜天数、10 枚徽章（解锁彩带 + 触感反馈）、今日进度环、90 天打卡热力图、30 天心情趋势、坚持率（本周/本月）、高光时刻回顾
- 🖼 **个性化**：6 套渐变壁纸 + 自定义照片壁纸（无损裁切、照片浓度调节）、深色模式（跟随系统/浅色/深色）、自定义 App 图标
- 🔔 **每日提醒**：固定时刻提醒打卡（APK 内到点必达，重启后自动重排）
- 💾 **数据自主**：全部数据只存本机，支持 JSON 备份导出/导入、打卡记录 CSV 导出
- 🏠 **桌面小组件**（APK）：连胜天数 + 今日完成度速览，点按直达应用

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
