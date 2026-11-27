import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Mendukung deploy di root server, subfolder, maupun GitHub Pages (https://<user>.github.io/<repo>/)
  server: {
    host: '0.0.0.0', // Memungkinkan akses dari semua perangkat dalam 1 jaringan LAN / Wi-Fi lokal
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Izinkan akses via domain guardhub.com maupun IP LAN
  },
})
