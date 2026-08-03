import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/humblo/',
  build: {
    outDir: '../public/humblo',
    emptyOutDir: true,
  },
})
