# Outfit Affiliate Manager

Web app untuk mengelola pekerjaan AI influencer affiliate outfit: tiap **postingan per tanggal** menyimpan nomor produk, link sumber Shopee, link affiliate hasil, dan caption TikTok — plus panel **cek sinkron** supaya nomor ↔ link ↔ caption tidak ketuker.

Dibuat dengan **React + Vite + TypeScript + Tailwind**, data disimpan di **Supabase** (gratis), bisa diakses dari **HP & PC** dengan data yang sama. Hosting **gratis** (Vercel/Netlify/Cloudflare Pages).

---

## Fitur

- **Daftar postingan per tanggal** dengan badge status sinkron (hijau = lengkap, kuning = belum).
- **Item produk** per postingan: nomor (otomatis lanjut dari nomor terakhir, **bisa diedit manual**), kategori, kode referensi (mis. `b 583`), link sumber, link affiliate. Bisa diurutkan & dihapus.
- **Copy semua link sumber** (dipisah baris) → tinggal paste ke aplikasi affiliate Shopee.
- **Tempel hasil link affiliate** sekaligus (dipisah baris baru / spasi / koma) → otomatis dipasang berurutan ke item.
- **Generate caption** otomatis sesuai format:
  ```
  Outfit yang aku pake
  -blouse : no 1
  -rok : no 2
  -sepatu : no 3
  #recomendationoutfithijab #hijaboutfit #hijabootd
  ```
- **Upload gambar screenshot** (banyak sekaligus, mis. tiap varian warna) ke Supabase Storage — otomatis dikompres biar hemat & cepat dari HP. Tap untuk lihat besar.
- **Link Google Drive** (tempat hasil generate) & **link video TikTok referensi** disimpan per postingan, sekali klik langsung kebuka.
- **Cek sinkron**: pastikan semua item punya link sumber & affiliate, jumlah cocok, nomor urut tanpa lompat/duplikat, link & tanggal referensi terisi.
- **Duplikat postingan** (menyalin struktur kategori & nomor) untuk hari berikutnya.
- **PWA**: bisa "Add to Home Screen" di HP.

> Catatan: generate gambar tetap di RunningHub (di luar app). App ini fokus mengelola link, nomor, caption, dan arsip teks per tanggal.

---

## Setup Supabase (sekali saja, gratis)

1. Buat akun di [supabase.com](https://supabase.com) → **New project** (pilih region terdekat, mis. Singapore). Tunggu provisioning selesai.
2. Buka **SQL Editor** → **New query** → copy-paste seluruh isi [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Ini membuat tabel `postings`, `items`, `images`, `settings` + Row Level Security, **dan** bucket Storage `screenshots` (untuk upload gambar) lengkap dengan policy-nya. Tidak perlu bikin bucket manual.
3. (Opsional, biar tidak perlu konfirmasi email) Buka **Authentication → Providers → Email** → matikan **Confirm email**. Lalu **Save**.
4. Buka **Project Settings → API**, catat:
   - **Project URL** → untuk `VITE_SUPABASE_URL`
   - **anon public key** → untuk `VITE_SUPABASE_ANON_KEY`

---

## Jalankan di lokal

```bash
# 1. Install dependency
npm install

# 2. Buat file .env dari contoh, lalu isi kredensial Supabase
cp .env.example .env
#    edit .env -> isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY

# 3. Jalankan
npm run dev
```

Buka `http://localhost:5173`, **Daftar** dengan email + password (sekali), lalu **Masuk**.

Build produksi: `npm run build` (hasil di folder `dist/`).

---

## Deploy gratis (biar bisa diakses dari mana saja / HP)

### Opsi A — Vercel (paling mudah)
1. Push project ini ke GitHub.
2. Di [vercel.com](https://vercel.com): **Add New → Project** → import repo.
3. Framework otomatis terdeteksi **Vite**. Build command `npm run build`, output `dist` (default).
4. **Environment Variables** → tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (nilai sama dengan `.env`).
5. **Deploy**. Dapat URL `https://namamu.vercel.app` → buka di HP, login, **Add to Home Screen**.

File [`vercel.json`](vercel.json) sudah menangani routing SPA (deep link tidak 404).

### Opsi B — Netlify / Cloudflare Pages
- Build command: `npm run build`, Publish directory: `dist`.
- Tambahkan env `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`.
- File [`public/_redirects`](public/_redirects) sudah menangani routing SPA untuk Netlify/Cloudflare.

> Keamanan: anon key Supabase memang dipakai di sisi browser — itu normal. Data tetap aman karena **Row Level Security**: tiap user hanya bisa membaca/menulis datanya sendiri.

### Matikan pendaftaran setelah akunmu dibuat
Supaya orang lain tidak bisa register di project Supabase-mu:
1. **Di app:** set env `VITE_ALLOW_SIGNUP=false` (menyembunyikan menu Daftar). Kalau dikosongkan/`true`, pendaftaran masih bisa — pakai ini saat membuat akun pertama.
2. **Di Supabase (penegakan sebenarnya):** **Authentication → Sign In / Providers → Email** → matikan **Allow new users to sign up**. Ini yang benar-benar memblokir pendaftaran dari sisi server.

### Backup data
Menu **Pengaturan → Export ke JSON** mengunduh semua postingan, item, & daftar gambar. Lakukan sesekali sebagai cadangan (free tier Supabase bisa **auto-pause** kalau ~1 minggu tidak ada aktivitas).

---

## Alur kerja harian (cara pakai)

1. **+ Postingan baru** (tanggal otomatis hari ini, label "9 Juni 2026"). Isi nama & link referensi (mis. video Kirana) + tanggal referensi untuk dicek manual. Tempel juga **link folder Drive** tempat hasil generate.
2. **Upload gambar screenshot** referensi (boleh banyak sekaligus untuk tiap varian warna) — dipakai sebagai bahan generate di RunningHub.
3. **+ Tambah item** untuk tiap produk (blouse, rok, sepatu…). Nomor otomatis lanjut; sesuaikan kalau perlu. Isi kode ref (`b 583`) dan **link sumber** Shopee. Kalau produknya **sama dengan yang sudah pernah dipakai** (deteksi otomatis dari `{shop}/{item}` di link), app menawarkan **pakai ulang nomor & link affiliate lama**.
4. **Copy semua link sumber** (sudah dibersihkan dari query, default hanya yang belum punya affiliate) → paste ke aplikasi affiliate Shopee → dapat link affiliate.
5. Balik ke app, **Tempel hasil link affiliate** → **Terapkan ke item**. Link dipasang ke item yang ada di bulk copy (yang belum punya affiliate), urut sesuai daftar.
6. **Copy caption** → paste saat upload ke TikTok.
7. Lihat panel **Cek sinkron** — pastikan semua ✓ sebelum posting.
8. Set **status** jadi "Sudah posting" kalau sudah tayang.

Di dashboard ada **pencarian** (by nomor, kategori, kode ref, nama referensi, link, tanggal) dan **filter tahap** (belum screenshot / belum generate / lengkap).

---

## Struktur kode

```
supabase/schema.sql      DDL + RLS + bucket Storage (paste ke Supabase SQL Editor)
src/lib/format.ts        Fungsi murni: formatTanggalIndo, parseBulkLinks, buildCaption, computeSyncChecks
src/lib/db.ts            Query Supabase (postings, items, settings)
src/lib/images.ts        Upload/kompres/hapus gambar ke Storage
src/lib/supabase.ts      Inisialisasi client
src/context/             AuthContext (login) + ToastContext (notifikasi)
src/pages/               LoginPage, DashboardPage, PostingEditorPage (inti), SettingsPage
src/components/          Layout, ProtectedRoute, ItemRow, CopyButton, SyncBadge, ImageGallery
```
