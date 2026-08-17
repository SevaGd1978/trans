import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://<user>.github.io/trans/
const base = process.env.GITHUB_PAGES === 'true' ? '/trans/' : '/'

export default defineConfig({
  plugins: [react()],
  base,
  preview: {
    host: true,
    allowedHosts: true,
  },
  server: {
    host: true,
    allowedHosts: true,
  },
})
