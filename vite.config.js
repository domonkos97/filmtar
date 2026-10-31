import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api is forwarded to the backend (npm run server) in dev and preview.
const proxy = { '/api': 'http://localhost:4000' }

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
