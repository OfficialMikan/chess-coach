import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const base = isGitHubPages ? '/chess-coach/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  optimizeDeps: {
    exclude: ['stockfish'],
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api/gemini': {
        target:       'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure:       true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, '/v1beta/models'),
      },
    },
  },
})
