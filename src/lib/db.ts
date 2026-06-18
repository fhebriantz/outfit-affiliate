import { supabase } from './supabase'
import { DEFAULT_HASHTAGS, DEFAULT_KATEGORI, type Item, type Posting, type Settings } from './types'

// ---------- Postings ----------
export async function listPostings(): Promise<Posting[]> {
  const { data, error } = await supabase
    .from('postings')
    .select('*')
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Posting[]
}

export async function getPosting(id: string): Promise<Posting> {
  const { data, error } = await supabase.from('postings').select('*').eq('id', id).single()
  if (error) throw error
  return data as Posting
}

export async function createPosting(userId: string, fields: Partial<Posting>): Promise<Posting> {
  const { data, error } = await supabase
    .from('postings')
    .insert({ user_id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data as Posting
}

export async function updatePosting(id: string, fields: Partial<Posting>): Promise<void> {
  const { error } = await supabase.from('postings').update(fields).eq('id', id)
  if (error) throw error
}

export async function deletePosting(id: string): Promise<void> {
  const { error } = await supabase.from('postings').delete().eq('id', id)
  if (error) throw error
}

/** Soft delete: pindahkan postingan ke arsip (item & nomor tetap utuh). */
export async function archivePosting(id: string, when: string): Promise<void> {
  const { error } = await supabase.from('postings').update({ archived_at: when }).eq('id', id)
  if (error) throw error
}

/** Kembalikan postingan dari arsip. */
export async function restorePosting(id: string): Promise<void> {
  const { error } = await supabase.from('postings').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

// ---------- Items ----------
export async function listItems(postingId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('posting_id', postingId)
    .order('urutan', { ascending: true })
  if (error) throw error
  return data as Item[]
}

export async function listAllItems(): Promise<Item[]> {
  const { data, error } = await supabase.from('items').select('*')
  if (error) throw error
  return data as Item[]
}

/** Nomor global tertinggi yang sudah dipakai user (untuk saran nomor berikutnya). */
export async function getMaxNumber(): Promise<number> {
  const { data, error } = await supabase
    .from('items')
    .select('my_number')
    .order('my_number', { ascending: false })
    .limit(1)
  if (error) throw error
  return data && data.length ? (data[0].my_number as number) : 0
}

export async function createItem(userId: string, fields: Partial<Item>): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({ user_id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data as Item
}

export async function updateItem(id: string, fields: Partial<Item>): Promise<void> {
  const { error } = await supabase.from('items').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

/**
 * Restore data dari hasil export JSON ke akun user saat ini.
 * Membuat postingan & item BARU (id baru) — tidak menimpa data yang ada.
 * Gambar (file) tidak ikut karena tersimpan di Storage, bukan di JSON.
 */
export async function importBackup(
  userId: string,
  postings: Partial<Posting>[],
  items: Partial<Item>[],
): Promise<{ postings: number; items: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const idMap: Record<string, string> = {} // old posting id -> new id
  let postingCount = 0
  for (const p of postings) {
    const created = await createPosting(userId, {
      tanggal: p.tanggal || today,
      label: p.label ?? null,
      ref_nama: p.ref_nama ?? null,
      ref_url: p.ref_url ?? null,
      ref_tanggal: p.ref_tanggal ?? null,
      caption_hashtags: p.caption_hashtags ?? null,
      catatan: p.catatan ?? null,
      drive_url: p.drive_url ?? null,
      status: p.status ?? 'draft',
      archived_at: p.archived_at ?? null,
    })
    if (p.id) idMap[p.id] = created.id
    postingCount++
  }

  const itemRows = items
    .filter((it) => it.posting_id && idMap[it.posting_id])
    .map((it) => ({
      user_id: userId,
      posting_id: idMap[it.posting_id as string],
      urutan: it.urutan ?? 1,
      my_number: it.my_number ?? 1,
      kategori: it.kategori ?? null,
      ref_code: it.ref_code ?? null,
      source_link: it.source_link ?? null,
      affiliate_link: it.affiliate_link ?? null,
    }))
  // Insert per-batch agar tidak terlalu besar sekali kirim.
  let itemCount = 0
  for (let i = 0; i < itemRows.length; i += 200) {
    const chunk = itemRows.slice(i, i + 200)
    const { error } = await supabase.from('items').insert(chunk)
    if (error) throw error
    itemCount += chunk.length
  }
  return { postings: postingCount, items: itemCount }
}

// ---------- Settings ----------
export async function getSettings(userId: string): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return data as Settings
  // Belum ada baris settings -> buat default.
  const def: Settings = {
    user_id: userId,
    default_hashtags: DEFAULT_HASHTAGS,
    kategori_presets: DEFAULT_KATEGORI,
    last_number: 0,
    last_folder: 0,
  }
  const { error: insErr } = await supabase.from('settings').insert(def)
  if (insErr) throw insErr
  return def
}

export async function saveSettings(userId: string, fields: Partial<Settings>): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, ...fields })
  if (error) throw error
}

/**
 * Pesan `count` nomor baru memakai counter monotonic di settings.last_number.
 * Counter hanya pernah NAIK — menghapus item (termasuk item bernomor tertinggi)
 * tidak akan membuat nomor terpakai ulang. Mengembalikan nomor PERTAMA yang dipesan.
 * Aman untuk data lama: base diambil dari max(counter, nomor item tertinggi).
 */
export async function reserveNumbers(userId: string, count: number): Promise<number> {
  const settings = await getSettings(userId)
  const maxItem = await getMaxNumber()
  const base = Math.max(settings.last_number ?? 0, maxItem)
  const start = base + 1
  await saveSettings(userId, { last_number: base + count })
  return start
}

/** Nomor label-folder tertinggi yang sudah dipakai (dari label numerik, mis. "003" -> 3). */
export async function getMaxFolderNumber(): Promise<number> {
  const { data, error } = await supabase.from('postings').select('label')
  if (error) throw error
  let max = 0
  for (const r of data as { label: string | null }[]) {
    const n = parseInt(String(r.label ?? '').trim(), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

/**
 * Pesan 1 nomor label folder berikutnya memakai counter monotonic settings.last_folder.
 * Base diambil dari max(counter, label numerik tertinggi) agar aman untuk data lama.
 */
export async function reserveFolderNumber(userId: string): Promise<number> {
  const settings = await getSettings(userId)
  const maxLabel = await getMaxFolderNumber()
  const base = Math.max(settings.last_folder ?? 0, maxLabel)
  const next = base + 1
  await saveSettings(userId, { last_folder: next })
  return next
}
