import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', 
      devOptions: {
        enabled: true
      },
      manifest: {
        id: '/',
        start_url: '/',
        name: 'Vue Capacitor App',
        short_name: 'VueCap',
        description: 'A robust and beautiful Vue Capacitor PWA application.',
        theme_color: '#42b883',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        lang: 'id',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshots/mobile.svg',
            sizes: '360x640',
            type: 'image/svg+xml',
            form_factor: 'narrow',
            label: 'Mobile Home Screen'
          },
          {
            src: '/screenshots/desktop.svg',
            sizes: '1280x720',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'Desktop Dashboard'
          }
        ],
        shortcuts: [
          {
            name: 'Home',
            url: '/',
            icons: [
              {
                src: '/icons/icon-96.webp',
                sizes: '96x96',
                type: 'image/webp'
              }
            ]
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
