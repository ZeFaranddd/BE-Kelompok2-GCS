# Backend GCS Kelompok 2

API mission tetap tersedia di `/missions`. Telemetry diterima lewat Redis
Pub/Sub `plane_state`, diparsing ke state kendaraan di memori, lalu dikirim
ke browser lewat Socket.IO di server/port yang sama. Tidak menulis telemetry
ke SQLite ataupun key/value Redis. Belum ada pengiriman command ke kendaraan.

## Menjalankan

Gunakan Node.js 24 (di mesin ini tersedia lewat `fnm use 24`). Binary
`better-sqlite3` yang sudah terpasang dibuat untuk Node 24, sehingga tidak
bisa dimuat oleh Node 18. Jika mengganti versi Node, pasang ulang dependensi
native sesuai versi Node yang dipakai.

```bash
npm install
cp .env.example .env
npm start
```

Jalankan dari folder backend. Pastikan `REDIS_URL` dan `TELEMETRY_CHANNEL`
sama dengan service Python. `CORS_ORIGIN` diisi origin frontend; default `*`
jika tidak disetel. Bila Redis belum tersedia, subscriber mencoba reconnect
otomatis dan API mission tetap berjalan.

## Event Socket.IO

| Event | Payload | Kapan dikirim |
| --- | --- | --- |
| `telemetry:snapshot` | Array state kendaraan, bisa kosong | Saat browser tersambung |
| `telemetry:update` | Satu state kendaraan lengkap | Maksimal 10 Hz per kendaraan, juga saat status stale berubah |
| `telemetry:status` | `{ redisConnected: boolean }` | Saat browser tersambung dan status Redis berubah |

Contoh frontend (pasang `socket.io-client` pada proyek frontend):

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
socket.on('telemetry:snapshot', (vehicles) => console.log(vehicles));
socket.on('telemetry:update', (vehicle) => console.log(vehicle));
socket.on('telemetry:status', (status) => console.log(status));
// Pada cleanup komponen React: socket.disconnect();
```

State memisahkan kendaraan berdasarkan `src_system` menjadi `vehicleId`.
`updatedAt` adalah waktu penerimaan backend (Unix milliseconds), bukan waktu
pengukuran flight controller. Tiap grup memiliki `updatedAt`, `srcComponent`,
dan `stale` sendiri. `connected` memerlukan heartbeat autopilot yang belum
kedaluwarsa; `redisConnected` hanya menunjukkan koneksi backend ke Redis.
Data terakhir tetap tersedia ketika stale, sehingga UI harus memeriksa flag.
State kosong kembali jika backend restart; Pub/Sub tidak menyediakan replay.

| Pesan MAVLink | Grup state | Satuan output |
| --- | --- | --- |
| `HEARTBEAT` | `heartbeat` | `armed`, mode numerik, tipe kendaraan, status autopilot |
| `GLOBAL_POSITION_INT` | `position` | latitude/longitude derajat; altitudeMsl dan relativeAltitude meter |
| `ATTITUDE` | `attitude` | roll/pitch derajat, heading 0–360 derajat |
| `SYS_STATUS` | `battery` | voltage volt, current ampere, remaining persen |
| `GPS_RAW_INT` | `gps` | fixType, satellites, hdop/vdop |
| `VFR_HUD` | `speed` | airspeed/groundspeed/climb m/s, throttle persen |
| `STATUSTEXT` | `statusText` | text, severity numerik |

Nilai sentinel baterai/GPS menjadi `null`. Mode tetap numerik karena penamaan
mode bergantung pada autopilot dan tipe kendaraan. Pesan tak didukung,
JSON rusak, dan pesan dengan field wajib tidak valid diabaikan.
STATUSTEXT menampilkan chunk terakhir; perakitan pesan panjang belum tersedia.

## Pengujian

```bash
npm test
```

Tes parser tidak membutuhkan Redis atau perangkat fisik.
