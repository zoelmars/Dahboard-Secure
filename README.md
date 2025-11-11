# DashboardSecure

**DashboardSecure** adalah sebuah platform pemantauan infrastruktur dan keamanan *real-time* terpusat berbasis **WebSocket**. Aplikasi ini dirancang untuk memonitor metrik kinerja (CPU, Memori, Disk) dan aktivitas log keamanan dari sekumpulan *Virtual Machine* Linux (seperti Load Balancer, Web Server, dan Database Server) dalam satu antarmuka (Dashboard) yang estetik dan interaktif.

## Fitur Utama

- **Real-Time Monitoring:** Data tidak di-*polling* secara manual, melainkan dipancarkan secara kontinu (setiap 3 detik) menggunakan WebSocket.
- **Security Event Overview:** Mengumpulkan log dan statistik blokir dari `fail2ban`, `modsecurity` (WAF), `suricata` (IDS), dan `ufw` dari semua server yang terhubung.
- **Remote IP Unban:** Dapat melepaskan blokiran (Unban) alamat IP dari `fail2ban` secara langsung (sekali klik) melalui Dashboard.
- **Live Log Viewer:** Multi-tab *live log viewer* untuk melihat log `syslog`, `auth.log`, dan log lainnya sesuai konfigurasi tanpa harus melakukan *SSH manual* satu per satu ke server.
- **Estetika Modern:** Frontend dibangun menggunakan **React** + **Vite** dan dirancang dengan estetika *dark mode* (glassmorphism) yang memukau menggunakan komponen **shadcn/ui** berbasis **Tailwind CSS**.

---

## Prasyarat

Sebelum menginstal, pastikan komputer/laptop utama Anda (Host) memiliki:
- **Python 3.10+** (dengan `pip` terinstall)
- **Node.js 18+** (dengan `npm` terinstall)
- Koneksi SSH yang dapat mengakses ke seluruh server Linux tujuan (Target VM).

Sedangkan untuk *Target Server Linux*, dipersyaratkan memiliki:
- Distribusi Debian/Ubuntu (atau varian Linux lainnya yang kompatibel).
- Akses kredensial (SSH Password / Keys) untuk memonitor file log spesifik, dengan izin sudo (jika diperlukan untuk unban).

---

## Struktur Direktori

Aplikasi ini dibagi menjadi 2 layer utama: Backend (Python) dan Frontend (Node.js).

```text
dashboard/
├── server.py              # File utama backend Python (Flask-SocketIO)
├── set_timezone.py        # Skrip otomatis untuk mereset zona waktu server
├── requirements.txt       # Daftar pustaka / depedensi backend Python
├── docs/                  # Folder dokumentasi mendalam aplikasi
│   ├── architecture.md    # Gambaran topologi jaringan dan data flow
│   ├── backend.md         # Cara kerja backend, threading, dan SSH pooling
│   └── frontend.md        # Penjelasan stack React, Vite, UI, dan State
└── frontend/              # Direktori spesifik Frontend React SPA
    ├── package.json
    ├── tailwind.config.js
    └── src/               # React components, lib socket, utilitas
```

> **Catatan:** Untuk pendalaman lebih lanjut seputar kode, silakan baca dokumentasi terpisah di folder `docs/`.

---

## Cara Instalasi & Menjalankan Aplikasi

Aplikasi ini membutuhkan dua terminal yang berjalan bersamaan.

### 1. Menjalankan Backend (Python)

Buka terminal (PowerShell / CMD), lalu arahkan ke *root* direktori `dashboard/`:
```bash
# 1. Masuk ke direktori
cd c:\Users\user\Documents\arkamuas\dashboard

# 2. Instal pustaka / dependencies
pip install -r requirements.txt

# 3. Jalankan server (Akan diminta input password SSH)
python server.py
```
Backend akan menyala dan *listen* di `http://localhost:5000`.

### 2. Menjalankan Frontend (React)

Buka terminal **baru** (tab baru), lalu masuk ke dalam folder `frontend/`:
```bash
# 1. Masuk ke direktori frontend
cd c:\Users\user\Documents\arkamuas\dashboard\frontend

# 2. Instal pustaka / Node modules
npm install

# 3. Jalankan development server
npm run dev
```

Jika berhasil, Vite akan memberikan alamat lokal (biasanya **http://localhost:5173**). Buka alamat tersebut di web browser Anda untuk mengakses **DashboardSecure**!

---

## Menyinkronkan Waktu (Timezone Fix)

Jika waktu / *timestamp* pada log server yang tampil di dashboard masih menggunakan waktu UTC, sinkronkan ke *local time* (contoh: WIB) menggunakan skrip bawaan:

```bash
cd c:\Users\user\Documents\arkamuas\dashboard
python set_timezone.py
```
Script tersebut akan meminta sandi SSH Anda sekali, lalu masuk ke seluruh target server dan merestart modul keamanan / *logging service* (`rsyslog`, `fail2ban`) secara otomatis.

---

*Hak Cipta © 2026 DashboardSecure. All rights reserved.*
