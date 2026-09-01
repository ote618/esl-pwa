import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'English con Fútbol',
        short_name: 'English',
        description: 'Inglés para niños — Guatemala',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1B4332',
        theme_color: '#1B4332',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,mp4,json}'],
        // Only Group 1 audio is precached. G2-G6 (315 clips, ~3.5 MB) load on
        // demand — a child on a Guatemalan mobile connection should not pay for
        // five groups they have not reached yet. Gating releases one group at a
        // time, so the rest is dead weight at install.
        globIgnores: ['audio/group[2-6]/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ]
})
