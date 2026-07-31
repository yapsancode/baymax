// Right now     → finish building the UI on localhost
//               → don't worry about extension setup yet

// Later         → switch to crxjs when you're ready
//               → to properly test as a real extension

import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/background.js', dest: '.' },
      ],
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        main: 'index.html',
        dashboard: 'dashboard.html',
        styleguide: 'styleguide.html',
      },
      output: {
        // Stable, unhashed entry names so manifest.json / dashboard.html can
        // point at fixed paths instead of per-build hashes.
        entryFileNames: 'assets/[name].js',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
