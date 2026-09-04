import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

/* A stamp a phone can read at the bottom of the grid, so "which build is
 * this?" is answered by looking, not by guessing from behaviour. */
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'nogit' } })()
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-')
const BUILD = `slice1-${stamp}-${sha}`

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
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
        //   MEDIA — NOT handled by the worker at all. See runtimeCaching below.
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
        // MEDIA IS DELIBERATELY NOT CACHED BY THE SERVICE WORKER.
        //
        // This used to be a CacheFirst route matching /\.(?:mp3|webp)$/. It was
        // removed because it does not do what its comment claimed, and on the
        // one device class this app targets it makes audio worse:
        //
        //   1. A media element fetches with a Range header. The server answers
        //      206. cacheableResponse here listed [0, 200], which excludes 206,
        //      so the first request for any clip was never cached. The
        //      "cached forever" claim was not true in practice.
        //   2. Status 0 is an opaque response. Admitting it means an error can
        //      be cached as if it were the clip, and served for a year.
        //   3. Safari on iOS is unreliable when a media element's response is
        //      served through a service worker at all — audio that plays in
        //      every desktop browser can fail silently on an iPhone, with
        //      play() resolving and the element erroring afterwards, so there
        //      is no rejection to catch.
        //
        // Caching media is the HTTP cache's job. Give the clips a long
        // Cache-Control at the edge (vercel.json) instead — filenames carry a
        // frozen entry ID and never change under their own name, so they are
        // safe to treat as immutable.
        //
        // If a runtime route is ever added back here, it must exclude audio:
        // check request.destination and skip 'audio' and 'video'.
        runtimeCaching: []
      }
    })
  ]
})
