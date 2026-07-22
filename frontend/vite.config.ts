import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
    assetsInlineLimit: (filePath) => filePath.endsWith('.mp3') ? false : undefined,
  },
})
