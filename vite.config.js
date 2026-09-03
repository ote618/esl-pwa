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
        // Precache is an explicit allowlist, not a wildcard. A child on a
        // Guatemalan mobile connection pays for every byte listed here at install.
        //   - Group 1 audio only. G2-G6 (315 clips, ~3.5 MB) load on demand;
        //     gating releases one group at a time, so the rest is dead weight.
        //   - Images (webp) are never precached — 249 files, 6.1 MB.
        //   - Only the two icons the manifest actually references. The other
        //     eleven sizes ship for anything that asks for them, but nothing
        //     currently does, and precaching them cost ~495 KB for nothing.
        globPatterns: [
          '**/*.{js,css,html,json}',
          'favicon.svg',
          'favicon.ico',
          'apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-maskable-512.png',
          'audio/group1/*.mp3'
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ]
})
