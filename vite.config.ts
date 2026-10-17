import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'

// https://vite.dev/config/
export default defineConfig({
  base: isGitHubPages ? '/EpisteMap/' : '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/katex/') ||
              id.includes('/rehype-katex/') ||
              id.includes('/remark-math/')
            ) {
              return 'katex'
            }
            if (id.includes('/@xyflow/') || id.includes('/@dagrejs/')) {
              return 'reactflow'
            }
            if (
              id.includes('/react-markdown/') ||
              id.includes('/micromark') ||
              id.includes('/mdast-') ||
              id.includes('/hast-') ||
              id.includes('/unified/') ||
              id.includes('/remark-') ||
              id.includes('/rehype-')
            ) {
              return 'markdown'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
