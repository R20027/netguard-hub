# ☁️ Panduan Penyimpanan Cloud Gratis & Deploy GitHub (NetGuard Hub)

Panduan ini menjelaskan cara memanfaatkan **Penyimpanan Cloud Gratis**, **Deployment ke GitHub / Cloud Hosting**, dan **Koneksi MikroTik Bebas IP**.

---

## 1. 📡 Menghubungkan MikroTik dengan IP Bebas (Bukan Hanya 192.168.88.1)

NetGuard Hub **sama sekali tidak membatasi** IP MikroTik. Anda bebas menggunakan IP apa pun:

### Cara Menghubungkan Router MikroTik:
1. Buka tab **📡 MikroTik Hub** &rarr; sub-tab **⚙️ Pengaturan**.
2. Di samping label IP Address terdapat tombol:
   * **`🔍 Auto-Deteksi Gateway Komputer`**: Klik tombol ini untuk mendeteksi secara otomatis alamat IP router yang sedang terhubung ke komputer/laptop Anda (misalnya `192.168.101.1` atau `10.10.1.1`).
3. Anda juga dapat memilih tombol cepat:
   * **`⚡ 10.10.1.1 (Kantor / Boss)`** &rarr; Jika terhubung ke jaringan kantor/perusahaan.
   * **`⚡ 192.168.1.1`** &rarr; Standar gateway router IndiHome/FirstMedia/modem.
   * **`⚡ 192.168.88.1`** &rarr; IP default bawaan pabrik RouterBOARD MikroTik.
   * **Domain / IP Publik / VPN** &rarr; Anda juga bisa mengetik domain Cloud MikroTik (contoh: `xxxx.sn.mynetname.net`) atau IP VPN WireGuard untuk me-remote router dari luar kota.
4. Masukkan **Username** (contoh: `admin`) dan **Password** MikroTik Anda.
5. Klik **`💾 Simpan Pengaturan`** &rarr; sistem langsung menguji koneksi secara real-time.

---

## 2. ☁️ Penyimpanan Online Gratis (Cloud Database)

Untuk memastikan data tiket gangguan, akun pelanggan PPPoE, dan tagihan Anda aman serta tersimpan di cloud secara gratis:

### A. Fitur Backup & Restore Mandiri (Bawaan NetGuard Hub)
1. Buka tab **📡 MikroTik Hub** &rarr; sub-tab **⚙️ Pengaturan** &rarr; lihat kolom kanan **☁️ Penyimpanan Online & Cadangan Cloud**.
2. **Download Cadangan (.json):** Sekali klik untuk mengunduh seluruh data (pelanggan, tiket, billing, device, pengaturan) dalam bentuk file JSON terenkripsi tanggal.
3. **Download File SQLite (.db):** Mengunduh file fisik `netguard.db` untuk cadangan offline/cloud.
4. **Pulihkan Data (Restore):** Pilih file cadangan `.json` untuk mengembalikan seluruh data jika Anda berpindah laptop atau server baru.

### B. Opsi Layanan Database Cloud Gratis 100% (Free Forever)

| Layanan Cloud | Jenis Database | Kuota Gratis | Kelebihan |
| :--- | :--- | :--- | :--- |
| **Turso (LibSQL)** | Cloud SQLite | **9 GB Storage**, 500 DB Gratis | Basisnya SQLite persis seperti NetGuard Hub, kencang, replikasi global otomatis. |
| **Supabase** | Cloud PostgreSQL | **500 MB Storage**, 50.000 user | Web dashboard lengkap, REST API otomatis, backup point-in-time. |
| **GitHub Private Repo** | Git Cloud Backup | **Tak Terbatas** (Free) | Otomatis backup snapshot `netguard.db` setiap hari via GitHub Actions. |

---

## 3. 🚀 Cara Deploy ke GitHub & Cloud Hosting Gratis

Repositori Git lokal Anda sudah terhubung ke GitHub:  
`https://github.com/R20027/netguard_hub`

### A. Deploy Frontend ke GitHub Pages (Gratis)
Workflow otomatis telah disiapkan di file [`.github/workflows/deploy-pages.yml`](file:///.github/workflows/deploy-pages.yml).

1. Push perubahan kode ke GitHub:
   ```bash
   git add .
   git commit -m "feat: universal mikrotik ip, cloud backup & github deployment"
   git push origin main
   ```
2. Buka repositori Anda di browser: `https://github.com/R20027/netguard_hub`.
3. Masuk ke **Settings** &rarr; **Pages** &rarr; pada bagian **Build and deployment Source**, pilih **GitHub Actions**.
4. Dalam 1-2 menit, dashboard web NetGuard Hub Anda akan tayang online di alamat:
   ```
   https://r20027.github.io/netguard_hub/
   ```

### B. Deploy Server Full-Stack ke Render.com (Gratis)
Dengan file [`Dockerfile`](file:///Dockerfile) dan [`render.yaml`](file:///render.yaml) yang sudah dibuat:
1. Buka [render.com](https://render.com) dan login dengan akun GitHub Anda.
2. Klik **New +** &rarr; **Blueprint** (atau **Web Service**).
3. Sambungkan repositori `R20027/netguard_hub`.
4. Render akan otomatis mendeteksi `Dockerfile` dan menjalankan server di cloud dengan URL HTTPS gratis (contoh: `https://netguard-hub.onrender.com`).
5. Karena menggunakan HTTPS, **GPS Akurat di HP/Laptop otomatis langsung aktif tanpa ada peringatan "Tidak Aman"**.

---

## 4. 🔑 Catatan Login & Pembaruan Server

Jika saat login muncul pesan *"Endpoint API tidak ditemukan"*:
* Itu terjadi karena jendela command prompt server (`go.exe`) sebelumnya masih menjalankan kode lama sebelum endpoint login dibuat.
* **Solusinya sangat mudah:**
  1. Tutup jendela hitam **NetGuard Hub Server**.
  2. Buka kembali file **`start-all.bat`**.
  3. Skrip `start-all.bat` kini otomatis membersihkan proses lama di port 8080 dan mengompilasi kode terbaru.
  4. Buka browser dan login dengan:
     * **Username:** `admin`
     * **Password:** `admin123`
