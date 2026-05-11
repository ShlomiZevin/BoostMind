import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/young-schema/',
  build: {
    outDir: '../public/young-schema',
    emptyOutDir: true,
  },
})
