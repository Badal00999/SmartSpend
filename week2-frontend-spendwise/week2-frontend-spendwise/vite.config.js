import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// The Week 3 back-end (spendwise-api) runs on port 4000 by default. In
// development the dev server proxies /api/* to it so the browser never has to
// deal with CORS or hard-coded hosts. Override with VITE_API_URL if the API
// lives elsewhere (e.g. a deployed URL).
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on 0.0.0.0 so the app is reachable from other devices on the LAN
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    // Vitest configuration – simulates a browser DOM so components can be tested
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
