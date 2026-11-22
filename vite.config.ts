import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin, ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/** 构建后将 dist/sw.js 中的 __SW_VERSION__ 替换为当前版本号，确保发版自动刷新 SW 缓存 */
function swVersionPlugin(version: string): Plugin {
  let resolvedConfig: ResolvedConfig | null = null
  return {
    name: 'xcj-sw-version',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    closeBundle() {
      if (!resolvedConfig) return
      const swPath = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const content = fs.readFileSync(swPath, 'utf8')
      const next = content.replace(/__SW_VERSION__/g, `v${version}`)
      if (next !== content) {
        fs.writeFileSync(swPath, next, 'utf8')
      }
    },
  }
}

// base 用相对路径，方便部署在任意子路径（或本地静态服务器）下打开
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss(), swVersionPlugin(pkg.version)],
  server: { host: true, port: 3000 },
  preview: { host: true, port: 3000 },
})
