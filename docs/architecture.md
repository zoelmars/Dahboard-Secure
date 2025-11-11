# Arsitektur DashboardSecure

Dokumen ini menjelaskan gambaran arsitektur tingkat tinggi dari **DashboardSecure**, sebuah aplikasi pemantauan infrastruktur server terpusat secara *real-time*.

## Gambaran Umum (High-Level Overview)

DashboardSecure menggunakan pendekatan arsitektur *Client-Server* modern berbasis **WebSocket** untuk menyajikan data secara *real-time* tanpa membebani jaringan dengan teknik *polling* tradisional.

Arsitektur ini terdiri dari dua komponen utama:
1. **Backend (Python / Flask-SocketIO):** Bertindak sebagai kolektor metrik (melalui koneksi SSH) dan *broadcaster* data WebSocket.
2. **Frontend (React / Vite):** Bertindak sebagai antarmuka pengguna interaktif (UI) yang menerima pembaruan dari Backend dan menampilkannya kepada pengguna.

---

## Topologi Jaringan & Komunikasi

```mermaid
graph TD
    Client[Web Browser / User] <-->|WebSocket| Backend[Flask-SocketIO Server\n(Port 5000)]
    Backend -->|SSH (Port 22)| LB[Load Balancer\n192.168.46.5]
    Backend -->|SSH (Port 22)| W1[Web Server 1\n192.168.46.2]
    Backend -->|SSH (Port 22)| W2[Web Server 2\n192.168.46.3]
    Backend -->|SSH (Port 22)| DB[Database Server\n192.168.46.4]
```

### Penjelasan Topologi
- **Web Browser (Frontend)** melakukan koneksi *WebSocket* (WSS/WS) satu kali ke Backend.
- **Backend (Python)** membuat *pool koneksi* SSH menggunakan `paramiko` ke seluruh target server.
- Backend membaca statistik (CPU, Memori, Disk) dan log keamanan (`fail2ban`, `modsecurity`, `ufw`, `suricata`) dari setiap server secara *concurrent* (paralel) menggunakan `eventlet`.
- Setiap ada data baru, Backend menyiarkannya (*broadcast*) kembali ke Frontend melalui koneksi WebSocket.

---

## Aliran Data (Data Flow)

1. **Inisialisasi Koneksi:** Saat aplikasi Backend dijalankan, skrip melakukan koneksi SSH ke seluruh target server (`Load Balancer`, `Web1`, `Web2`, `DB`).
2. **Siklus Pengumpulan (Event Loop):** 
   - Setiap 3 detik: Backend mengumpulkan metrik performa (*load*, CPU, Memori, Disk, status *service*).
   - Setiap 9 detik: Backend memecah beban dengan mengumpulkan log keamanan (*fail2ban*, *WAF*, dll).
3. **Penyaluran (Emitting):** Data yang terkumpul di-emit menggunakan *channel* seperti `server_update`, `security_update`, `security_events`, dan `lb_update`.
4. **Render UI:** Frontend menangkap event WebSocket ini lalu memperbarui *state* di React, dan me-render ulang komponen yang relevan (seperti grafik performa atau tabel log).
5. **Koneksi Dua Arah (Bi-directional):** Selain Backend yang mendorong data, Frontend juga bisa meminta tindakan spesifik (seperti fitur *Unban IP* atau *Request Logs* secara khusus) dan Backend akan mengeksekusinya di target server.
