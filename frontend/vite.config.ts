import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
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
const developmentBackendOrigin = process.env.SDR_VITE_BACKEND_URL?.trim()
  || 'http://localhost:5210'
const developmentBackendUrl = new URL(developmentBackendOrigin)

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
if (
  developmentBackendUrl.protocol !== 'http:'
  || !['127.0.0.1', '::1', 'localhost'].includes(developmentBackendUrl.hostname)
  || developmentBackendUrl.pathname !== '/'
  || developmentBackendUrl.search
  || developmentBackendUrl.hash
) throw new Error('SDR_VITE_BACKEND_URL must be a loopback HTTP origin')

const buildRevision = requestedRevision ?? checkoutRevision
const deploymentRevisionManifest: Plugin = {
  name: 'deployment-revision-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'deployment.json',
      source: `${JSON.stringify({ revision: buildRevision })}\n`,
    })
  },
}

export default defineConfig({
  define: {
    __SDR_BUILD_REVISION__: JSON.stringify(buildRevision),
  },
  plugins: [deploymentRevisionManifest, react(), tailwindcss()],
  server: {
    proxy: {
      '/api': developmentBackendUrl.origin,
      '/uploads': developmentBackendUrl.origin,
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
