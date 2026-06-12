import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['stockfish']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // ── CORS proxy for Gemini ──────────────────────────────────────────────
    // Browser fetches /api/gemini/... → Vite rewrites to Google's API in dev.
    // Production uses netlify/vercel functions (see /netlify/functions/gemini.js)
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, '/v1beta/models'),
      },
    },
  },
})
