import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base + outDir renamed again when the brand became Wholos. Every previous
// path is preserved via 301s in firebase.json, so old shared links — and any
// home-screen install made before a rename — still land on the current app.

export default defineConfig({
  plugins: [react()],
  base: '/wholos-app/',
  build: {
    outDir: '../public/wholos-app',
    emptyOutDir: true,
  },
})
