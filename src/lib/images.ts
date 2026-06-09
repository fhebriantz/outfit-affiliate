import { supabase } from './supabase'
import type { PostingImage } from './types'

const BUCKET = 'screenshots'
const MAX_DIM = 1280 // sisi terpanjang maksimum (px) setelah dikompres
const JPEG_QUALITY = 0.82

/**
 * Kompres & perkecil gambar di sisi browser sebelum upload, supaya hemat
 * storage dan cepat saat dari HP. Kalau gagal, pakai file asli.
 */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    return blob ?? file
  } catch {
    return file
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function imagePublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function listImages(postingId: string): Promise<PostingImage[]> {
  const { data, error } = await supabase
    .from('images')
    .select('*')
    .eq('posting_id', postingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as PostingImage[]
}

/** Semua baris gambar (untuk export/backup). */
export async function listAllImages(): Promise<PostingImage[]> {
  const { data, error } = await supabase.from('images').select('*')
  if (error) throw error
  return data as PostingImage[]
}

/** Jumlah gambar per posting_id (untuk badge & filter di dashboard). */
export async function listAllImageCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('images').select('posting_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data as { posting_id: string }[]) {
    counts[row.posting_id] = (counts[row.posting_id] ?? 0) + 1
  }
  return counts
}

export async function uploadScreenshot(
  userId: string,
  postingId: string,
  file: File,
): Promise<PostingImage> {
  const blob = await compressImage(file)
  const path = `${userId}/${postingId}/${uuid()}.jpg`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('images')
    .insert({ posting_id: postingId, user_id: userId, path })
    .select()
    .single()
  if (error) throw error
  return data as PostingImage
}

export async function deleteImage(image: PostingImage): Promise<void> {
  // Hapus file di storage dulu, lalu baris di tabel.
  await supabase.storage.from(BUCKET).remove([image.path])
  const { error } = await supabase.from('images').delete().eq('id', image.id)
  if (error) throw error
}
