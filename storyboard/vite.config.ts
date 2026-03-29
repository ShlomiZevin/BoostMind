import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/storyboard/',
  build: {
    outDir: '../public/storyboard',
    emptyOutDir: true,
  },
})
