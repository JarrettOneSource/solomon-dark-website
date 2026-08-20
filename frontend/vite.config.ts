import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const checkoutRevision = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  { cwd: repositoryRoot, encoding: 'utf8' },
).trim().toLowerCase()
const requestedRevision = process.env.SDR_BUILD_REVISION?.trim().toLowerCase()
const fullGitRevision = /^[0-9a-f]{40}$/

if (!fullGitRevision.test(checkoutRevision)) {
  throw new Error('The frontend checkout did not resolve to a full Git commit ID')
}
if (requestedRevision !== undefined && !fullGitRevision.test(requestedRevision)) {
  throw new Error('SDR_BUILD_REVISION must be a full Git commit ID')
}
if (requestedRevision !== undefined && requestedRevision !== checkoutRevision) {
  throw new Error(
    `SDR_BUILD_REVISION ${requestedRevision} does not match checkout ${checkoutRevision}`,
  )
}

const buildRevision = requestedRevision ?? checkoutRevision

export default defineConfig({
  define: {
    __SDR_BUILD_REVISION__: JSON.stringify(buildRevision),
  },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:5210',
      '/uploads': 'http://localhost:5210',
    },
    // A WSL dev server watching the repo through /mnt/c gets no inotify
    // events from Windows, so HMR silently serves stale modules. Poll there;
    // Windows-side dev keeps native watching.
    watch: process.env.WSL_DISTRO_NAME ? { usePolling: true, interval: 800 } : undefined,
  },
  build: {
    // The backend serves the SPA from wwwroot; `dotnet publish` picks it up.
    outDir: '../backend/wwwroot',
    emptyOutDir: true,
    // Production's CSP only permits same-origin media. Keep even tiny sound
    // effects as files instead of Vite's default data: URL inlining.
    assetsInlineLimit: (filePath) => /\.(?:mp3|wav)$/i.test(filePath) ? false : undefined,
  },
})
