import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base 用相对路径，方便部署在任意子路径（或本地静态服务器）下打开
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 3000 },
  preview: { host: true, port: 3000 },
})
