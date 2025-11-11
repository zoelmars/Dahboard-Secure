# Dokumentasi Backend (Python / Flask)

Backend DashboardSecure dibangun menggunakan **Python 3**, dengan kerangka kerja **Flask**, **Flask-SocketIO**, dan **Eventlet** untuk konkurensi (pemrosesan asinkronus).

## Struktur File Utama
- **`server.py`**: Merupakan *core engine* / jantung dari backend ini. Berisi seluruh logika untuk koneksi SSH, ekstraksi data metrik, dan pemancaran (emit) WebSocket.
- **`requirements.txt`**: Daftar dependensi Python yang dibutuhkan (`flask`, `flask-socketio`, `paramiko`, `eventlet`, dll).
- **`set_timezone.py`**: Skrip utilitas (*helper*) untuk melakukan sinkronisasi zona waktu di seluruh target server secara otomatis.

---

## Teknologi yang Digunakan

| Komponen | Library Python | Fungsi |
| :--- | :--- | :--- |
| **Web Server / WSGI** | `Flask` | Menyediakan server web lokal untuk menyajikan file statis (bila diperlukan). |
| **WebSocket Engine** | `Flask-SocketIO` | Menjaga koneksi real-time persisten dua-arah antara klien dan backend. |
| **Konkurensi / Asinkron** | `eventlet` | Melakukan patching (*monkey-patch*) pustaka standar Python agar permintaan SSH ke banyak server bisa dilakukan tanpa saling memblokir (Non-blocking I/O). |
| **SSH Client** | `paramiko` | Membuat dan menjaga *tunnel* SSH persisten untuk membaca file log dan memantau status CPU, Memori, Disk secara *remote*. |

---

## Fitur Utama Backend

### 1. SSH Connection Manager (Pooling)
Backend mengelola koneksi SSH yang terbuka terus-menerus (*persistent*). Konsep ini ada di kelas `SSHManager`. Koneksi persisten ini menghilangkan biaya *overhead* / kelambatan (karena harus login berulang kali) setiap kali mengambil data 3 detik sekali.

### 2. Multi-Threading Data Collection
Pemantauan dilakukan secara serentak (paralel) untuk semua server. Jika satu server merespon lambat, server lain tidak akan ikut terhambat, karena setiap pengambilan metrik berjalan di "Thread" (*green-thread* milik `eventlet`) yang terpisah.

### 3. Ekstraksi Metrik Berbasis Shell
Daripada menginstal agen (seperti *Telegraf* atau *Prometheus*) di tiap VM, Backend langsung mengeksekusi perintah Shell dasar:
- `cat /proc/stat` untuk CPU.
- `cat /proc/meminfo` untuk RAM.
- `df -BM` untuk Disk.
- `systemctl is-active` untuk layanan/services.

### 4. Ekstraksi Log Keamanan
Backend menggunakan perintah Linux seperti `tail` dan `grep` untuk mengekstrak data spesifik dari:
- `/var/log/fail2ban.log` (Fail2ban Bans).
- `/var/log/apache2/modsec_audit.log` (WAF Blocks / ModSecurity).
- `/var/log/suricata/fast.log` (Suricata IDS).
- `/var/log/ufw.log` (Firewall Blocks).

### 5. Fitur Unban IP (Aksi Jarak Jauh)
Backend menerima event `unban_ip` dari Frontend, kemudian mengeksekusi `fail2ban-client set sshd unbanip <IP>` di server yang ditentukan.
