/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Where the app is served from. `/` locally; the GitHub Pages workflow sets `/dailyos/`
 * (a project site lives under the repository name).
 */
const base = process.env.BASE_PATH ?? '/';

/**
 * Static hosts like GitHub Pages serve 404.html for unknown paths. Making it a copy of the app
 * lets deep links such as /dailyos/habits load before the service worker is installed.
 */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'dailyos-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      copyFileSync(`${outDir}/index.html`, `${outDir}/404.html`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // New versions install in the background and take over on the next launch. Data lives in
      // IndexedDB, which updates never touch.
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'DailyOS',
        short_name: 'DailyOS',
        description: 'Habits, plans, learning and reviews. Stored only on your device.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ee',
        theme_color: '#fdfcf9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app shell so it opens with no connection at all.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
    spaFallback(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: false,
  },
});
