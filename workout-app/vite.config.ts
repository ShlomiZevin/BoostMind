import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base + outDir renamed from /workout-app/ to /matzav-app/ once the brand
// (מצב) landed. The legacy path is preserved via a 301 in firebase.json
// so any shared /workout-app/ link — and any home-screen install that
// happened before the rename — still lands on the current app.
export default defineConfig({
  plugins: [react()],
  base: '/matzav-app/',
  build: {
    outDir: '../public/matzav-app',
    emptyOutDir: true,
  },
})
