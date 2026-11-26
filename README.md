# 🛡️ NetGuard Hub

**NetGuard Hub** adalah sistem automasi & monitoring jaringan berbasis **Web Server** untuk ISP / RT-RW Net & Network Operations Center (NOC) — dapat diakses langsung dari browser Laptop maupun HP dalam 1 jaringan Wi-Fi/LAN **tanpa memerlukan aplikasi APK tambahan**.

## ✨ Fitur Utama
*(Penjelasan detail dan panduan setiap fitur dapat dibaca di [PANDUAN_FITUR.md](file:///c:/Users/USER/Documents/GUARD%20HUB/PANDUAN_FITUR.md))*

1. **Wadah Koneksi & Manajemen MikroTik RouterOS**: Konfigurasi IP/Port/API-SSL, CPU & Memory Live Monitor, Live PPPoE Active & Secrets, Kick/Isolir akurat berbasis `.id` RouterOS, 1-Click Impor/Ekspor Pelanggan, dan Router Terminal (mendukung argumen berpetik).
2. **Sentinel Auto-Detector & Ticketing**: Deteksi otomatis Router Offline, Interface Link Down (P0/P1), CPU >= 90%, Memory >= 90%, dan Log Kritis setiap 20 detik, serta auto-resolve ketika pulih.
3. **Peta Topologi & Titik Gangguan GIS (Akurat & Anti-Gelap)**: Mendukung **CARTO Voyager, OSM Detail Jalan (z19), Satelit Esri World Imagery (z19), Positron, dan Dark NOC** (zoom halus hingga level 21 tanpa layar gelap 403). Dilengkapi pencarian area, kalibrasi GPS / klik-pindah titik langsung di peta, manajemen Node (Switch/ODP/Server), Ping massal, dan garis topologi.
4. **Manajemen Pelanggan PPPoE & GPS Rumah**: Tambah, Edit, Sync, Test Login real-time ke MikroTik, Kick, Isolir, Restore, serta mini-map pemilih koordinat rumah.
5. **Billing & Auto-Isolir Scheduler**: Audit tagihan jatuh tempo setiap 5 menit (thread-safe), isolir otomatis ke MikroTik Secret & Firewall Address-List `ISOLIR`, dan buka isolir otomatis beserta resolve tiket saat tagihan dilunasi.
6. **Bantuan Interaktif `(!)` di Setiap Tombol**: Tanda seru bulat di samping tombol & kontrol akan membuka penjelasan fungsi, dampak tindakan, dan tips penggunaan.
7. **Proteksi Keamanan LAN-Only**: Middleware server otomatis memblokir seluruh permintaan dari IP Internet Publik dengan status `403 Forbidden`.

---

## 🚀 Menjalankan Server Web

### Opsi 1: Launcher 1-Klik (`start-all.bat`)
1. Pastikan frontend sudah ter-build (`cd frontend && npm run build`) — hasil build otomatis dilayani langsung oleh server Go di port `8080`.
2. Jalankan `start-all.bat`.

### Akses dari Perangkat Lain (Laptop / HP di 1 Wi-Fi / LAN)
- **Dari Komputer Server:** `http://localhost:8080`
- **Dari HP / Laptop lain 1 jaringan:** `http://<IP-Lokal-Server>:8080` (contoh: `http://192.168.101.12:8080`) atau `http://guardhub.com:8080` setelah mengklik **Pasang DNS guardhub.com ke MikroTik** di tab MikroTik Hub.
