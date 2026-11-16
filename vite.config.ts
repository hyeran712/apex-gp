import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Stamps the commit into index.html so a deployment can be identified. */
function buildStamp(): Plugin {
  const id = process.env.GITHUB_SHA ?? 'local'
  return {
    name: 'build-stamp',
    transformIndexHtml: html => html.replace('</head>', `  <meta name="build" content="${id}" />\n  </head>`),
  }
}

// Relative base: the build works from any sub-path, including the GitHub
// Pages project URL https://<user>.github.io/apex-gp/.
export default defineConfig({
  base: './',
  plugins: [react(), buildStamp()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
})
