import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      // Values match the Slice 1 deploy package's manifest.webmanifest. That file is
      // NOT committed to public/ — vite-plugin-pwa emits dist/manifest.webmanifest
      // from this block, so a static copy in public/ would be a second manifest
      // racing the generated one for the same path. One source of truth, and it is here.
      manifest: {
        name: 'English con Fútbol',
        short_name: 'English con Fútbol',
        description: 'Aprende inglés jugando al fútbol.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1B4332',
        theme_color: '#1B4332',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // TWO OPPOSITE POLICIES, deliberately.
        //
        //   SHELL — precached, and the worker takes over the moment a new one
        //   installs (skipWaiting + clientsClaim), so a Friday release lands on
        //   the next open without anyone bumping a version string. main.jsx
        //   calls registration.update() on launch and on visibilitychange;
        //   left alone, browsers re-check sw.js roughly daily.
        //
        //   MEDIA — cache-first, effectively forever. Filenames are frozen
        //   entry IDs, so a file never changes under its own name.
        //
        // Precache is the SHELL ONLY. No .mp3 and no .webp: 385 clips and 249
        // images are several MB before a child sees anything. They arrive on
        // first use and are then cached for good.
        //
        // gating.current rides inside the hashed JS bundle, so it is shell, not
        // media — the CacheFirst route below matches mp3/webp only and cannot
        // catch it. If gating were ever moved to its own .json, it must NOT be
        // given a cache-first route or the class freezes on Group 1 forever
        // with nothing appearing broken.
        globPatterns: [
          '**/*.{js,css,html}',
          'manifest.webmanifest',
          'favicon.svg',
          'favicon.ico',
          'apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-maskable-512.png'
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\.(?:mp3|webp)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ecf-media',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true
            }
          }
        ]
      }
    })
  ]
})
