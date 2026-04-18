import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/workout-app/',
  build: {
    outDir: '../public/workout-app',
    emptyOutDir: true,
  },
})
