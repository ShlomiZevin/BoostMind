import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/room-designer/',
  build: {
    outDir: '../public/room-designer',
    emptyOutDir: true,
  },
})
