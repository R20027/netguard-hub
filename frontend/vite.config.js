import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Memungkinkan akses dari semua perangkat dalam 1 jaringan LAN / Wi-Fi lokal
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Izinkan akses via domain guardhub.com maupun IP LAN
  },
})
