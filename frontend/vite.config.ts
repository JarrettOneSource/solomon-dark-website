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
