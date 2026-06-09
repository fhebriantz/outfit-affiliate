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
  }
  const { error: insErr } = await supabase.from('settings').insert(def)
  if (insErr) throw insErr
  return def
}

export async function saveSettings(userId: string, fields: Partial<Settings>): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ user_id: userId, ...fields })
  if (error) throw error
}
