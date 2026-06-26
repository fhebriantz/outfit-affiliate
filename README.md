# Outfit Affiliate Manager

Web app untuk mengelola pekerjaan **AI influencer affiliate outfit** end-to-end: kelola postingan & produk, kode katalog otomatis, deteksi produk duplikat, generate caption TikTok, upload screenshot, sampai bikin **carousel (collage)** dengan layer teks + **humanizer** (anti-fingerprint AI) lalu **bagikan** ke aplikasi.

Dibuat dengan **React + Vite + TypeScript + Tailwind**, data di **Supabase** (gratis) → bisa diakses dari **HP & PC dengan data sama**. Hosting **gratis** (Vercel). Bisa di-**install ke HP** (PWA).

> Generate gambar AI tetap di RunningHub (di luar app). App ini mengurus link, nomor/kode, caption, screenshot, arsip, dan pembuatan gambar carousel.

---

## Daftar Isi
- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Setup (langkah demi langkah)](#setup-langkah-demi-langkah)
- [Variabel environment](#variabel-environment)
- [Deploy gratis](#deploy-gratis)
- [Cara penggunaan](#cara-penggunaan)
- [Halaman Collage / Slide](#halaman-collage--slide)
- [Konsep penting](#konsep-penting)
- [Backup & keamanan](#backup--keamanan)
- [Keep-alive Supabase](#keep-alive-supabase)
- [Troubleshooting](#troubleshooting)
- [Struktur kode](#struktur-kode)

---

## Fitur

**Postingan & item**
- Daftar postingan, **label folder auto-increment 3 digit** (`001`, `002`, …) — editable, pakai counter sendiri (`settings.last_folder`).
- Item produk: **kode katalog** `A 100`–`A 999` lalu `B 100`–`B 999`, dst (di belakang layar tetap nomor integer; counter atomik anti-kembar). Kode bisa diedit manual.
- **Tempel banyak link sumber sekaligus → item otomatis dibuat** (kode lanjut + deteksi duplikat + autofill kategori dari produk yang sudah ada).
- **Duplikat postingan** (salin struktur kategori; kode lanjut otomatis).
- **Title** caption default `( SPILL OUTFIT DI CAPTION 👇 )` (editable) → jadi baris pembuka caption.

**Deteksi duplikat & short link**
- Kenali produk sama dari link Shopee berdasarkan `{shop_id}/{product_id}` — abaikan `www`, query `?...`, dan beragam format (`/product/...`, `/{username}/...` mobile, `-i.{shop}.{item}`).
- Produk yang sudah pernah dipakai → tawarkan **pakai ulang kode + link affiliate + kategori**.
- **Short link** (`s.shopee.co.id`, `shp.ee`, `shope.ee`, dll) otomatis diperluas via serverless `/api/resolve` — domain apa pun diterima **selama berakhir di Shopee** (validasi hasil + proteksi SSRF). Jalan di lokal (Vite middleware) maupun Vercel.

**Link & caption**
- **Copy link sumber** dalam bentuk bersih (`https://shopee.co.id/product/{shop}/{item}`, tanpa query), dipisah baris → paste ke aplikasi affiliate Shopee. Default hanya yang belum punya affiliate.
- **Tempel hasil link affiliate** sekaligus dengan **preview pemetaan** link → item.
- **Generate caption** otomatis (tiap bagian dipisah 1 baris kosong):
  ```
  ( SPILL OUTFIT DI CAPTION 👇 )

  Detail outfit :
  -blouse : no A 100
  -rok : no A 101
  -sepatu : no A 102

  Cara order
  1. Klik link di bio profil aku
  2. Cari nomor produk sesuai yang aku tulis di atas
  3. Klik produknya aja nanti kalian akan di arahin ke halaman checkout

  #recomendationoutfithijab #hijaboutfit #hijabootd
  ```
- Tombol **buka link** (↗) sumber/affiliate per item.

**Halaman Produk** (katalog global)
- Semua produk yang pernah dipakai (termasuk yang belum ada affiliate). **Edit kode, kategori, link sumber & link affiliate** di sini → perubahan **menyebar ke semua postingan** yang memakai produk itu. Edit di dalam postingan juga ikut menyebar bila link-nya sama. Pencarian by kode/kategori/link.

**Collage / Slide** (lihat bagian khusus di bawah)
- Bikin carousel multi-slide, layer teks editable, pinch zoom, rasio per-slide, **humanizer**, **bagikan**.

**Gambar & arsip**
- **Upload screenshot** (banyak sekaligus) + **paste langsung (Ctrl+V)**, otomatis dikompres. Thumbnail tampil di dashboard (bertumpuk di HP).
- **Link Google Drive** (hasil generate) + tombol "Buka Drive" (salin nama folder ke clipboard). **Link video TikTok referensi** sekali klik kebuka.

**Pemantauan & navigasi**
- **Tahap & filter**: Belum screenshot · Belum generate · Belum affiliate · Lengkap. Di HP filter jadi dropdown.
- **Cek sinkron**, pencarian, **collapse** daftar yang belum lengkap, quick action ubah status.
- Navigasi: nav atas (desktop) / **burger menu** (HP), berikon.

**Lain-lain**
- Login Supabase + **Row Level Security** (data privat per user).
- **Arsip** (soft delete) → Pulihkan / Hapus permanen.
- **Export & Import JSON** (backup 2 arah).
- **PWA** (Add to Home Screen).

---

## Teknologi
| Bagian | Teknologi |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS, React Router |
| Backend/DB | Supabase (Postgres + Auth + Storage + RPC) |
| Lain | piexifjs (EXIF), Web Share API, Canvas API |
| Hosting | Vercel (serverless `/api/resolve`) / Netlify / Cloudflare Pages |

---

## Setup (langkah demi langkah)

### 1. Buat project Supabase
Daftar di [supabase.com](https://supabase.com) → **New project** (region terdekat, mis. Singapore).

### 2. Jalankan schema database
**SQL Editor → New query** → paste seluruh [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Membuat tabel `postings`, `items`, `images`, `settings`, semua RLS, bucket Storage `screenshots`, dan fungsi atomik `reserve_item_numbers`. Aman dijalankan ulang (idempotent) — jalankan ulang kapan pun schema berubah.

### 3. Konfigurasi Auth
**Authentication → Sign In / Providers → Email**:
- Matikan **Confirm email** (biar bisa langsung login).
- (Setelah akunmu jadi) matikan **Allow new users to sign up**.

### 4. Ambil kredensial API
**Project Settings → API** → catat **Project URL** & **anon/publishable key**.

> Membuka Project URL langsung di browser → `{"error":"requested path is invalid"}` itu **normal** (itu endpoint API, bukan halaman).

### 5. Jalankan di lokal
```bash
npm install
cp .env.example .env     # isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev              # http://localhost:5173
```
Daftar akun (sekali) → Masuk. Build produksi: `npm run build`.

---

## Variabel environment
| Variabel | Wajib | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Project URL Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | anon/publishable key |
| `VITE_ALLOW_SIGNUP` | ➖ | `false` = sembunyikan menu Daftar. Kosong/`true` = aktif (untuk buat akun pertama) |

`.env` sudah di-`.gitignore`.

---

## Deploy gratis

### Vercel (rekomendasi — mendukung serverless `/api/resolve`)
1. Push repo ke GitHub → di [vercel.com](https://vercel.com) **Add New → Project** → import repo.
2. Framework auto **Vite** (build `npm run build`, output `dist`).
3. **Environment Variables** → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ `VITE_ALLOW_SIGNUP=false` opsional).
4. **Deploy** → buka URL di HP → login → Add to Home Screen.

[`vercel.json`](vercel.json) menangani routing SPA + mengecualikan `/api`. Netlify/Cloudflare Pages juga bisa (build `npm run build`, dir `dist`) tapi fungsi resolve short link adalah serverless khas Vercel.

---

## Cara penggunaan

### Alur harian
1. **+ Postingan baru** — label `001` otomatis. Isi nama + link referensi TikTok + link Drive.
2. **Tambah item** — paling cepat: **tempel semua link sumber** → **Buat item** (kode lanjut, duplikat & kategori auto). Short link otomatis diperluas.
3. **Upload screenshot** referensi (atau Ctrl+V).
4. **Copy link sumber** (bersih) → paste ke aplikasi affiliate Shopee → dapat link affiliate.
5. **Tempel hasil affiliate** → cek preview → **Terapkan**.
6. **Copy caption** → paste ke TikTok.
7. Cek panel **Sinkron** → set status "Sudah posting".

### Dashboard
Pencarian, filter tahap (dropdown di HP), thumbnail, badge sinkron, pill "N belum" (collapse detail), dropdown status, Duplikat, Arsip. Tombol **Arsip (N)** muncul kalau ada yang diarsip.

### Halaman Produk
Edit kode/kategori/link affiliate per produk → menyebar ke semua postingan terkait. Untuk merapikan katalog & ganti link produk yang habis.

### Pengaturan
Hashtag default, preset kategori, **counter nomor item** & **counter label folder** (bisa di-set untuk jaga-jaga), **Export/Import JSON**.

---

## Halaman Collage / Slide
Untuk membuat gambar carousel siap-posting.

- **Multi-slide**: tab slide, + Slide, Duplikat, Hapus. Tiap slide punya rasio, layout, gambar, teks sendiri.
- **Rasio per-slide**: `Asli` (ikut rasio gambar), `3:4`, `1:1`, `9:16`, `4:6`. Slide baru default `Asli`.
- **Layout**: 1 gambar, 2 baris/kolom, 3 baris/kolom, 1+2, 2+1, 4 kotak. Toggle garis pemisah.
- **Gambar**: tap sel kosong → langsung pilih gambar; **pool** gambar dipakai-ulang lintas slide; geser (drag) & **zoom (slider / pinch 2 jari)**.
- **Layer teks**: tambah teks (default `•-----A ` untuk penunjuk nomor, atau judul cover). **Edit langsung di gambar** (tap pilih → tap lagi = ketik), handle **geser/hapus/duplikat** di sudut, ukuran & warna (outline auto).
- **Humanizer** (saat unduh/bagikan), dua switch terpisah:
  - **Grain + color jitter** — noise & geser warna halus (meniru `batch_humanizer`), tiap unduh sedikit beda.
  - **Metadata iPhone 13** — re-encode (buang metadata sumber) + suntik EXIF iPhone 13 lengkap (Make/Model/ISO/exposure/lensa/dimensi).
- **Unduh** (slide ini / semua, nama file timestamp) atau **Bagikan** (Web Share: kirim gambar ke TikTok/IG/WA + salin caption dari postingan terpilih).

> Catatan jujur: humanizer mengurangi fingerprint level-piksel & metadata, tapi bukan jaminan 100% dan banyak platform menghapus EXIF saat upload. TikTok umumnya tidak mengisi caption dari share sheet — makanya caption disalin ke clipboard untuk di-paste.

---

## Konsep penting
- **Auto-save** — field tersimpan saat blur / pilih dropdown.
- **Kode katalog** — tampilan/`input` pakai kode `A 100`; internal tetap integer (`my_number`). Counter **monotonic & atomik** (RPC `reserve_item_numbers`) → tidak pernah kembar walau item dihapus/diarsip.
- **Reuse produk** — identitas = `{shop}/{item}` link sumber. Produk sama pakai kode + affiliate + kategori yang sama, dan tidak ikut di "copy link sumber".
- **Edit menyebar** — ubah kode/link/kategori produk (di Produk atau di postingan) berlaku ke semua item dengan produk sama. `urutan` per-postingan tidak ikut.

---

## Backup & keamanan
- **Export/Import JSON** (Pengaturan) — backup & restore postingan + item (gambar tidak ikut; tersimpan di Storage). Lakukan berkala sebagai jaring pengaman. (Soal auto-pause lihat bagian berikut.)
- **RLS** — tiap user hanya bisa baca/tulis datanya sendiri; anon key di browser itu normal.
- **Matikan pendaftaran** setelah akun jadi: `VITE_ALLOW_SIGNUP=false` + matikan signup di Supabase.

---

## Keep-alive Supabase
Supabase free tier **auto-pause** bila project **~7 hari tidak ada aktivitas** (data tidak hilang, tapi perlu di-restore manual & lambat saat dibuka lagi).

**Otomatis (sudah terpasang):** **Vercel Cron** memanggil endpoint **`/api/keepalive`** setiap hari (06:00 UTC). Endpoint ini melakukan satu query kecil ke Supabase → dihitung sebagai aktivitas → timer pause ter-reset. Pakai env yang sudah ada (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), tanpa setting tambahan.

Cek di **Vercel → Settings → Cron Jobs** (muncul `/api/keepalive`, bisa di-**Run** untuk tes). Respons sehat:
```json
{ "ok": true, "db": 200, "at": "2026-..." }
```
> Vercel Hobby (gratis) menjalankan cron **1×/hari** — cukup untuk window 7 hari. Membuka app secara berkala juga sudah dihitung aktivitas.

### Cadangan: cron-job.org (opsional)
Kalau ingin redundansi atau Vercel cron tidak jalan:
1. Daftar gratis di **https://cron-job.org** → **Create cronjob**.
2. **URL/title:** `https://<url-vercel-mu>/api/keepalive`
3. **Request method:** `GET` — **tanpa payload/body & tanpa header khusus** (endpoint mengurus query Supabase sendiri di server; key tidak pernah diekspos).
4. **Schedule:** sekali sehari (mis. setiap hari jam 06:00). Simpan.

Itu saja — tidak ada body JSON yang perlu dikirim. (Endpoint juga menerima method apa pun, tapi GET paling simpel.)

---

## Troubleshooting
| Masalah | Solusi |
|---|---|
| "Supabase belum dikonfigurasi" | `.env` belum/terisi salah; cek lalu restart `npm run dev`. |
| Gagal login / "Email not confirmed" | Matikan **Confirm email** di Supabase, atau cek email. |
| Error simpan/upload, atau fitur baru error | Jalankan ulang `supabase/schema.sql` (kolom/fungsi/bucket terbaru). |
| Tombol Bagikan tidak muncul/efek | Web Share butuh **HTTPS + HP** (Android Chrome/iOS 15+); di desktop pakai Unduh. |
| Short link tidak ke-resolve di lokal | Pastikan `npm run dev` (middleware aktif); di produksi via Vercel `/api/resolve`. |
| Dimensi foto 0×0 di rincian HP | Aktifkan **Metadata iPhone 13** (menulis tag dimensi EXIF). |
| Supabase "project paused" / lambat setelah lama nganggur | Restore di dashboard Supabase. Pastikan cron **/api/keepalive** jalan (lihat [Keep-alive](#keep-alive-supabase)). |

---

## Struktur kode
```
supabase/schema.sql      DDL + RLS + bucket Storage + fungsi reserve_item_numbers
api/resolve.js           Serverless Vercel: resolve short link Shopee
api/_resolve-core.js     Logika resolve (dipakai juga middleware dev di vite.config.ts)
api/keepalive.js         Keep-alive (dipanggil Vercel Cron harian — vercel.json) agar Supabase tidak auto-pause
src/lib/format.ts        Fungsi murni: tanggal, parse link, caption, cek sinkron, tahap, kode katalog
src/lib/shopee.ts        Parse {shop}/{item}, link bersih, cari duplikat, expand short link
src/lib/humanize.ts      Grain + color jitter + EXIF iPhone 13 (piexifjs)
src/lib/db.ts            Query Supabase + counter atomik + import backup
src/lib/images.ts        Upload/kompres/hapus gambar ke Storage
src/lib/supabase.ts      Inisialisasi client
src/context/             AuthContext + ToastContext
src/pages/               LoginPage, DashboardPage, PostingEditorPage, ProductsPage,
                         CollagePage, SettingsPage
src/components/          Layout, ProtectedRoute, ItemRow, CopyButton, SyncBadge,
                         StageBadges, ImageGallery
```
