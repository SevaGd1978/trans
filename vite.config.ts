import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base works on Vercel, Netlify, Cloudflare Tunnel and CDN mirrors.
// GitHub Pages project site still needs /trans/ when GITHUB_PAGES=true.
const base = process.env.GITHUB_PAGES === 'true' ? '/trans/' : './'

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
