import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    // open: true  ← removed: was opening a new browser tab on every HMR restart
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

