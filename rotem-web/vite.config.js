import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/rotem/',
  build: {
    outDir: '../public/rotem',
    emptyOutDir: true,
  },
})
