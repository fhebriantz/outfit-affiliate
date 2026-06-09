# Outfit Affiliate Manager

Web app untuk mengelola pekerjaan **AI influencer affiliate outfit**. Tiap **postingan per tanggal** menyimpan: nomor produk, link sumber Shopee, link affiliate hasil, screenshot referensi, dan caption TikTok — lengkap dengan **deteksi produk duplikat**, **penanda tahap pengerjaan**, dan **panel cek sinkron** supaya nomor ↔ link ↔ caption tidak ketuker.

Dibuat dengan **React + Vite + TypeScript + Tailwind**, data tersimpan di **Supabase** (gratis) sehingga bisa diakses dari **HP & PC dengan data yang sama**. Hosting **gratis** (Vercel/Netlify/Cloudflare Pages).

> Generate gambar tetap dilakukan di RunningHub (di luar app). App ini fokus mengelola link, nomor, caption, screenshot referensi, dan arsip per tanggal.

---

## Daftar Isi
- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Setup (langkah demi langkah)](#setup-langkah-demi-langkah)
  - [1. Buat project Supabase](#1-buat-project-supabase)
  - [2. Jalankan schema database](#2-jalankan-schema-database)
  - [3. Konfigurasi Auth](#3-konfigurasi-auth)
  - [4. Ambil kredensial API](#4-ambil-kredensial-api)
  - [5. Jalankan di lokal](#5-jalankan-di-lokal)
- [Variabel environment](#variabel-environment)
- [Deploy gratis](#deploy-gratis)
- [Cara penggunaan](#cara-penggunaan)
- [Konsep penting](#konsep-penting)
- [Backup & keamanan](#backup--keamanan)
- [Troubleshooting](#troubleshooting)
- [Struktur kode](#struktur-kode)

---

## Fitur

**Postingan & item**
- Daftar postingan per tanggal, label otomatis "9 Juni 2026".
- Item produk: **nomor global** (lanjut otomatis dari nomor terakhir, bisa diedit), kategori, kode referensi (mis. `b 583`), link sumber, link affiliate. Bisa diurutkan & dihapus.
- **Tempel banyak link sumber sekaligus → item otomatis dibuat** (nomor lanjut + deteksi duplikat jalan).
- **Duplikat postingan** (salin struktur kategori & nomor) untuk hari berikutnya.

**Deteksi duplikat**
- Mengenali produk yang sama dari link Shopee berdasarkan `{shop_id}/{product_id}` (abaikan `www`, query `?...`, dan format link: `/product/...`, `/{username}/...` mobile, `-i.{shop}.{item}`). Kalau produk sudah pernah dipakai → tawarkan **pakai ulang nomor & link affiliate lama**.
- **Short link** (`s.shopee.co.id/xxx`) otomatis diperluas dulu via serverless function `/api/resolve` (jalan di Vercel) supaya tetap bisa dideteksi duplikatnya. Di dev lokal fungsi ini tidak aktif, jadi short link dibiarkan apa adanya (alur tetap jalan).

**Link & caption**
- **Copy semua link sumber** dalam bentuk bersih (`https://shopee.co.id/product/{shop}/{item}`, tanpa query), dipisah per baris → tinggal paste ke aplikasi affiliate Shopee. Default hanya menampilkan item yang belum punya affiliate.
- **Tempel hasil link affiliate** sekaligus (pisah baris/spasi/koma) dengan **preview pemetaan** link → item sebelum diterapkan.
- **Generate caption** TikTok otomatis:
  ```
  Outfit yang aku pake
  -blouse : no 1
  -rok : no 2
  -sepatu : no 3
  #recomendationoutfithijab #hijaboutfit #hijabootd
  ```
- Tombol **buka link** (↗) sumber/affiliate di tiap item untuk verifikasi cepat.

**Gambar & arsip**
- **Upload screenshot referensi** (banyak sekaligus), otomatis dikompres. Thumbnail tampil di dashboard (bertumpuk di HP biar hemat ruang).
- **Link Google Drive** (hasil generate) & **link video TikTok referensi** disimpan per postingan, sekali klik kebuka.

**Pemantauan progres**
- **Tahap & filter**: Belum screenshot · Belum generate · Belum affiliate · Lengkap.
- **Cek sinkron**: semua item punya link sumber & affiliate, jumlah cocok, nomor urut tanpa lompat/duplikat, link & tanggal referensi terisi.
- Dashboard: **pencarian** (nomor, kategori, kode ref, nama referensi, link, tanggal), **collapse** daftar yang belum lengkap, **quick action** ubah status.

**Lain-lain**
- Login Supabase + **Row Level Security** (data privat per user).
- **Export/backup ke JSON**.
- **PWA**: bisa "Add to Home Screen" di HP.

---

## Teknologi
| Bagian | Teknologi |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS |
| Routing | React Router |
| Backend/DB | Supabase (Postgres + Auth + Storage) |
| Hosting | Vercel / Netlify / Cloudflare Pages (statis, gratis) |

---

## Setup (langkah demi langkah)

### 1. Buat project Supabase
1. Daftar di [supabase.com](https://supabase.com) (gratis).
2. **New project** → pilih region terdekat (mis. **Southeast Asia / Singapore**) → tunggu provisioning selesai (~2 menit).

### 2. Jalankan schema database
1. Di project Supabase, buka **SQL Editor → New query**.
2. Copy seluruh isi [`supabase/schema.sql`](supabase/schema.sql), paste, lalu klik **Run**.
3. Ini otomatis membuat tabel `postings`, `items`, `images`, `settings`, semua **Row Level Security policy**, dan **bucket Storage `screenshots`** beserta policy-nya. Aman dijalankan ulang (idempotent).

### 3. Konfigurasi Auth
- Buka **Authentication → Sign In / Providers → Email**.
- Untuk kemudahan, **matikan "Confirm email"** supaya bisa langsung login tanpa cek email.
- (Nanti, setelah akunmu dibuat) **matikan "Allow new users to sign up"** agar orang lain tidak bisa daftar.

### 4. Ambil kredensial API
Buka **Project Settings → API**, catat:
- **Project URL** → untuk `VITE_SUPABASE_URL`
- **anon / publishable key** → untuk `VITE_SUPABASE_ANON_KEY`

> Catatan: membuka Project URL langsung di browser akan menampilkan `{"error":"requested path is invalid"}` — itu **normal**, karena URL itu endpoint API, bukan halaman web.

### 5. Jalankan di lokal
```bash
# 1. Install dependency
npm install

# 2. Salin contoh env, lalu isi kredensial Supabase
cp .env.example .env
#    edit .env → isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY

# 3. Jalankan dev server
npm run dev
```
Buka **http://localhost:5173** → **Daftar** akun (email + password, sekali saja) → **Masuk**.

Perintah lain:
- `npm run build` — build produksi ke folder `dist/`.
- `npm run preview` — preview hasil build.

---

## Variabel environment
Isi di file `.env` (lokal) atau di dashboard hosting (produksi):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Project URL dari Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | anon/publishable key dari Supabase |
| `VITE_ALLOW_SIGNUP` | ➖ | `false` untuk menyembunyikan menu Daftar. Kosong/`true` = pendaftaran aktif (pakai saat buat akun pertama) |

File `.env` sudah masuk `.gitignore` — kredensial tidak akan ikut ter-commit.

---

## Deploy gratis

### Opsi A — Vercel (paling mudah)
1. Push repo ke GitHub.
2. Di [vercel.com](https://vercel.com): **Add New → Project** → import repo.
3. Framework auto-terdeteksi **Vite** (build `npm run build`, output `dist`).
4. **Environment Variables** → tambahkan `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ `VITE_ALLOW_SIGNUP=false` bila ingin matikan pendaftaran).
5. **Deploy** → dapat URL `https://namamu.vercel.app` → buka di HP → login → **Add to Home Screen**.

File [`vercel.json`](vercel.json) sudah menangani routing SPA (deep link tidak 404).

### Opsi B — Netlify / Cloudflare Pages
- Build command `npm run build`, publish directory `dist`.
- Tambahkan env yang sama.
- File [`public/_redirects`](public/_redirects) menangani routing SPA.

---

## Cara penggunaan

### Alur kerja harian (ringkas)
1. **+ Postingan baru** — tanggal & label terisi otomatis. Isi nama + link referensi TikTok (mis. Kirana), tanggal postingan referensi (untuk dicek manual), dan link folder **Drive** hasil generate.
2. **Upload screenshot** referensi (boleh banyak; tiap varian warna).
3. **Tambah item** — paling cepat: **tempel semua link sumber sekaligus** lalu **Buat item**. Nomor lanjut otomatis; produk yang sudah pernah dipakai langsung **reuse nomor & affiliate**.
4. **Copy semua link sumber** (sudah bersih) → paste ke aplikasi affiliate Shopee → dapat link affiliate.
5. **Tempel hasil link affiliate** → cek **preview pemetaan** → **Terapkan ke item**.
6. **Copy caption** → paste saat upload ke TikTok.
7. Lihat **Cek sinkron** — pastikan semua ✓.
8. Ubah **status** → "Sudah posting" (bisa langsung dari kartu dashboard).

### Penjelasan layar Editor Postingan
- **Detail postingan** — tanggal, label, referensi (nama/URL/tanggal), link Drive, status, catatan. Semua **auto-save** saat kamu klik keluar dari kolom (tidak ada tombol simpan).
- **Gambar screenshot** — tombol upload (multi-file), tap thumbnail untuk lihat besar, hapus per gambar.
- **Item produk** — kotak *tempel link sumber sekaligus* + tombol *+ Tambah 1 item*. Tiap item: No, kategori, kode ref, link sumber, link affiliate, tombol naik/turun/hapus, tombol buka link (↗). Chip kuning muncul bila produk sama dengan item lain.
- **1. Link sumber** — daftar link bersih siap copy; checkbox "tampilkan semua".
- **2. Tempel hasil affiliate** — textarea + **preview pemetaan** link → item + tombol Terapkan.
- **3. Caption TikTok** — preview live + tombol copy + edit hashtag.
- **Cek sinkron** — checklist ✓/⚠.

### Dashboard
- **Pencarian** (nomor/kategori/kode ref/nama referensi/link/tanggal).
- **Filter tahap**: Semua · Belum screenshot · Belum generate · Belum affiliate · Lengkap (dengan jumlah).
- Tiap kartu: thumbnail preview, badge sinkron, pill **"N belum"** (tap → collapse daftar yang belum lengkap), dropdown **status**, tombol Duplikat/Hapus.

### Pengaturan
- **Hashtag default** caption & **preset kategori**.
- **Export ke JSON** untuk backup.

---

## Konsep penting

- **Auto-save** — semua field tersimpan otomatis saat kehilangan fokus (blur) / saat memilih dropdown. Klik area lain dulu sebelum menutup tab agar isian terakhir tersimpan.
- **Nomor global** — nomor item berlanjut lintas postingan (postingan A pakai 1–3, B lanjut 4–6, dst). Bisa diedit manual untuk menyesuaikan urutan di aplikasi Shopee.
- **Reuse produk** — deteksi duplikat berdasarkan `{shop_id}/{product_id}`. Produk yang sama memakai **nomor & link affiliate yang sama** (tidak perlu generate ulang) dan otomatis tidak ikut di "copy link sumber".
- **Dua sisi link affiliate** — kotak "Tempel hasil affiliate" hanya **alat input cepat**; data aslinya tersimpan di kolom **"Link affiliate-ku"** tiap item.

---

## Backup & keamanan
- **Backup**: Pengaturan → **Export ke JSON** (lakukan berkala; free tier Supabase **auto-pause** bila ~1 minggu tidak ada aktivitas).
- **Keamanan**: anon/publishable key memang dipakai di browser — itu normal. Data tetap aman karena **Row Level Security**: tiap user hanya bisa baca/tulis datanya sendiri.
- **Matikan pendaftaran** setelah akunmu dibuat: set `VITE_ALLOW_SIGNUP=false` **dan** matikan "Allow new users to sign up" di Supabase (Auth → Email).

---

## Troubleshooting
| Masalah | Solusi |
|---|---|
| Halaman "Supabase belum dikonfigurasi" | `.env` belum diisi / salah. Cek `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`, lalu restart `npm run dev`. |
| Gagal login / "Email not confirmed" | Matikan **Confirm email** di Supabase (Auth → Email), atau cek email konfirmasi. |
| Error saat simpan/upload | Pastikan `supabase/schema.sql` sudah dijalankan (tabel + bucket + RLS). Jalankan ulang bila ragu. |
| Buka Project URL → `requested path is invalid` | Normal. Itu endpoint API, bukan halaman. Buka app di localhost/URL deploy. |
| Deep link 404 setelah deploy | Pastikan `vercel.json` / `public/_redirects` ikut ter-deploy. |

---

## Struktur kode
```
supabase/schema.sql      DDL + RLS + bucket Storage (paste ke Supabase SQL Editor)
src/lib/format.ts        Fungsi murni: tanggal, parse link, caption, cek sinkron, tahap
src/lib/shopee.ts        Parse {shop}/{item}, link bersih, cari duplikat
src/lib/db.ts            Query Supabase (postings, items, settings)
src/lib/images.ts        Upload/kompres/hapus gambar ke Storage
src/lib/supabase.ts      Inisialisasi client
src/context/             AuthContext (login) + ToastContext (notifikasi)
src/pages/               LoginPage, DashboardPage, PostingEditorPage (inti), SettingsPage
src/components/          Layout, ProtectedRoute, ItemRow, CopyButton, SyncBadge,
                         StageBadges, ImageGallery
```
