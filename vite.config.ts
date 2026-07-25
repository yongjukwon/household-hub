/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Household Hub',
        short_name: 'Household',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // woff2 included so the Pretendard subset is available offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        // Never satisfy an /assets/* request with the index.html fallback.
        navigateFallbackDenylist: [/^\/assets\//],
        cleanupOutdatedCaches: true,
        // Deliberately NO catch-all runtimeCaching. Hashed build assets (lazy
        // route chunks, fonts) are precached and immutable, and navigations
        // fall back to the precached index.html — so the app-shell is fully
        // offline via the precache. A StaleWhileRevalidate over every
        // same-origin request (the previous setup) would cache Vercel's
        // SPA-rewrite HTML under a now-missing chunk URL after a deploy,
        // yielding "text/html is not a valid JavaScript MIME type". Offline
        // data reads are served by the React Query IndexedDB persister;
        // realtime uses WebSockets, which service workers can't intercept.
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@household-hub/domain': path.resolve(
        __dirname,
        './packages/domain/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
})
