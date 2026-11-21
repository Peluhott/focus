import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same origin for the browser: /api goes to the AdonisJS server, so the
    // session cookie stays first-party and no CORS is involved.
    proxy: {
      // FOCUS_API_URL points a second dev copy at another API (e.g. for UI tests).
      '/api': process.env.FOCUS_API_URL ?? 'http://localhost:3333',
    },
  },
})
