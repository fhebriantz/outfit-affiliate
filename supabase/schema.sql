-- =============================================================
-- Outfit Affiliate Manager - Skema Database Supabase
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New query,
-- paste semua isi file ini, lalu klik "Run".
-- Aman dijalankan ulang (pakai IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================

-- ---------- Tabel: postings ----------
create table if not exists public.postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tanggal date not null,
  label text,
  ref_nama text,
  ref_url text,
  ref_tanggal text,
  caption_hashtags text,
  catatan text,
  drive_url text,
  status text not null default 'draft',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Tambah kolom untuk instalasi lama (aman dijalankan ulang).
alter table public.postings add column if not exists drive_url text;
alter table public.postings add column if not exists archived_at timestamptz;

-- ---------- Tabel: items ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.postings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  urutan int not null default 1,
  my_number int not null default 1,
  kategori text,
  ref_code text,
  source_link text,
  affiliate_link text,
  created_at timestamptz not null default now()
);

create index if not exists items_posting_id_idx on public.items (posting_id);
create index if not exists items_user_number_idx on public.items (user_id, my_number);
create index if not exists postings_user_tanggal_idx on public.postings (user_id, tanggal desc);

-- ---------- Tabel: images (screenshot referensi per postingan) ----------
create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.postings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null,            -- path file di Storage bucket "screenshots"
  caption text,                  -- catatan opsional (mis. "varian merah")
  created_at timestamptz not null default now()
);
create index if not exists images_posting_id_idx on public.images (posting_id);

-- ---------- Tabel: settings (1 baris per user) ----------
create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_hashtags text not null default '#recomendationoutfithijab #hijaboutfit #hijabootd',
  kategori_presets text[] not null default '{blouse,rok,sepatu,outer,celana,dress,kerudung,tas}',
  last_number int not null default 0,  -- counter nomor item (monotonic)
  last_folder int not null default 0   -- counter label folder postingan (monotonic)
);
-- Tambah kolom counter untuk instalasi lama (aman dijalankan ulang).
alter table public.settings add column if not exists last_number int not null default 0;
alter table public.settings add column if not exists last_folder int not null default 0;

-- =============================================================
-- Row Level Security (RLS): tiap user hanya bisa lihat datanya sendiri
-- =============================================================
alter table public.postings enable row level security;
alter table public.items    enable row level security;
alter table public.images   enable row level security;
alter table public.settings enable row level security;

-- postings
drop policy if exists "postings_select_own" on public.postings;
drop policy if exists "postings_insert_own" on public.postings;
drop policy if exists "postings_update_own" on public.postings;
drop policy if exists "postings_delete_own" on public.postings;
create policy "postings_select_own" on public.postings for select using (auth.uid() = user_id);
create policy "postings_insert_own" on public.postings for insert with check (auth.uid() = user_id);
create policy "postings_update_own" on public.postings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "postings_delete_own" on public.postings for delete using (auth.uid() = user_id);

-- items
drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
create policy "items_select_own" on public.items for select using (auth.uid() = user_id);
create policy "items_insert_own" on public.items for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete using (auth.uid() = user_id);

-- images
drop policy if exists "images_select_own" on public.images;
drop policy if exists "images_insert_own" on public.images;
drop policy if exists "images_update_own" on public.images;
drop policy if exists "images_delete_own" on public.images;
create policy "images_select_own" on public.images for select using (auth.uid() = user_id);
create policy "images_insert_own" on public.images for insert with check (auth.uid() = user_id);
create policy "images_update_own" on public.images for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "images_delete_own" on public.images for delete using (auth.uid() = user_id);

-- settings
drop policy if exists "settings_select_own" on public.settings;
drop policy if exists "settings_insert_own" on public.settings;
drop policy if exists "settings_update_own" on public.settings;
create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================
-- Storage: bucket "screenshots" untuk upload gambar screenshot
-- Path file: <user_id>/<posting_id>/<uuid>.<ext>
-- Bucket public (gampang ditampilkan di HP), tapi upload/hapus
-- hanya boleh oleh pemilik folder (segmen pertama path = user_id).
-- =============================================================
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do update set public = true;

drop policy if exists "screenshots_insert_own" on storage.objects;
drop policy if exists "screenshots_update_own" on storage.objects;
drop policy if exists "screenshots_delete_own" on storage.objects;

create policy "screenshots_insert_own" on storage.objects for insert
  with check (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "screenshots_update_own" on storage.objects for update
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "screenshots_delete_own" on storage.objects for delete
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);
