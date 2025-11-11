# Dokumentasi Frontend (React / Vite)

Frontend DashboardSecure dibangun dengan arsitektur **Single Page Application (SPA)** menggunakan **React**, di-_build_ oleh **Vite**, dan memanfaatkan pustaka antarmuka **shadcn/ui** dengan gaya desain *Dark Mode* modern (glassmorphism).

## Struktur Direktori Frontend

Direktori `frontend/` memiliki struktur utama sebagai berikut:
```text
frontend/
├── public/                # File statis publik
├── src/
│   ├── components/        # Komponen React UI spesifik Dashboard
│   │   ├── ui/            # Komponen dasar dari shadcn/ui (Card, Badge, Tabs, dll)
│   │   ├── LBStats.tsx    # Komponen visualisasi Load Balancer
│   │   ├── LogViewer.tsx  # Komponen live log multi-tab 
│   │   ├── SecurityPanel.tsx # Komponen ringkasan keamanan dan list event
│   │   └── ServerCard.tsx # Komponen kotak metrik server (CPU, RAM, Disk)
│   ├── lib/
│   │   ├── socket.ts      # Instansiasi koneksi Socket.IO (socket.io-client)
│   │   └── utils.ts       # Utilitas dasar (termasuk class names mergence/tailwind-merge)
│   ├── types/
│   │   └── server.ts      # Definisi TypeScript Interfaces (ServerInfo, SecurityEvent, dll)
│   ├── App.tsx            # Komponen Induk (Layout utama dan State Manager WebSocket)
│   ├── index.css          # Variabel desain shadcn/ui dan kustomisasi CSS Tailwind
│   └── main.tsx           # Titik masuk utama (Entry point) React
├── tailwind.config.js     # Konfigurasi Tailwind CSS
├── vite.config.ts         # Konfigurasi bundler Vite
└── package.json           # Definisi dependensi Node.js (React, Radix UI, dll)
```

---

## Teknologi yang Digunakan

| Komponen | Pustaka (Library) | Fungsi |
| :--- | :--- | :--- |
| **Framework UI** | `React` 18 | Membangun komponen UI deklaratif. |
| **Bundler** | `Vite` | Menyediakan proses _compile_ dan HMR (*Hot Module Replacement*) yang sangat cepat di mode _dev_. |
| **Komunikasi Real-time** | `socket.io-client` | Berkomunikasi dua-arah dengan Backend Flask. |
| **Styling Engine** | `Tailwind CSS` | Menulis gaya menggunakan *utility classes* CSS. |
| **UI Components Base** | `shadcn/ui` / `Radix UI` | Menggunakan pustaka *headless UI* yang dapat diakses (A11y) dan dapat dimodifikasi penuh desainnya. |
| **Ikon UI** | `lucide-react` | Menyediakan set ikon SVG vektor bersih yang seragam (Server, Activity, Shield, dll). |

---

## Mekanisme Kerja Utama (State Management)

1. **Manajemen WebSocket di `App.tsx`:**
   Semua pendengar (listener) `socket.on` dikelola di dalam *hook* `useEffect` di `App.tsx`. Saat `App.tsx` menerima pembaruan (*update*), *state* dari React (`useState`) akan diperbarui.
   
2. **Reaktivitas UI:**
   Ketika *state* berubah (contoh: persentase CPU Web1 berubah dari 40% ke 45%), React secara cerdas membandingkan *Virtual DOM* dan me-render ulang hanya pada bagian indikator lingkaran (gauge) di `ServerCard.tsx` yang bersangkutan.

3. **LogViewer (Auto-scroll & Tabs):**
   `LogViewer.tsx` menggunakan referensi `useRef` untuk mengontrol posisi *scroll*. Ketika *state* `logLines` berubah, React akan memaksa DOM untuk menggulir kembali ke posisi paling atas jika fitur "Auto-scroll" dihidupkan (karena array di-_reverse_ sehingga log terbaru di atas).

4. **SecurityPanel (Fitur Unban):**
   Menerima fungsi pemicu yang memanfaatkan objek global `socket` (dari `lib/socket.ts`) untuk mengirim *event* balik (`socket.emit('unban_ip')`) ke server tanpa harus me-reload halaman.
