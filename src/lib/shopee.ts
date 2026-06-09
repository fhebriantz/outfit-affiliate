import type { Item } from './types'

/**
 * Ambil kunci produk Shopee "{shop_id}/{product_id}" dari sebuah link.
 * - Abaikan http/https & "www." (host tidak dipakai untuk pencocokan).
 * - Abaikan query string setelah "?" (parameter affiliate/tracking berbeda-beda).
 * - Mendukung format link Shopee:
 *     1) .../product/{shop_id}/{product_id}
 *     2) .../{username}/{shop_id}/{product_id}      (format mobile)
 *     3) .../Nama-Produk-i.{shop_id}.{product_id}
 *   Intinya: ambil 2 segmen angka berurutan terakhir pada path.
 * Kembalikan null kalau bukan link produk yang bisa dikenali
 * (mis. short link s.shopee.co.id/xxxx yang harus diresolusi dulu).
 */
export function parseShopeeKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  let url = raw.trim()
  if (!url) return null
  // Buang fragment & query.
  url = url.split('#')[0]
  const q = url.indexOf('?')
  const path = q >= 0 ? url.slice(0, q) : url

  // Format "-i.{shop}.{product}" (angka dipisah titik, bukan slash).
  const mDot = path.match(/-i\.(\d+)\.(\d+)/i)
  if (mDot) return `${mDot[1]}/${mDot[2]}`

  // Format umum: 2 segmen angka berurutan terakhir di path
  // (mencakup /product/{shop}/{item} dan /{username}/{shop}/{item}).
  const segs = path.split('/').filter(Boolean)
  for (let i = segs.length - 1; i >= 1; i--) {
    if (/^\d{4,}$/.test(segs[i]) && /^\d{4,}$/.test(segs[i - 1])) {
      return `${segs[i - 1]}/${segs[i]}`
    }
  }

  return null
}

/**
 * Bentuk link Shopee yang bersih & seragam:
 *   https://shopee.co.id/product/{shop_id}/{product_id}
 * Kalau link tidak bisa diparse, kembalikan null.
 */
export function canonicalShopeeUrl(raw: string | null | undefined): string | null {
  const key = parseShopeeKey(raw)
  if (!key) return null
  return `https://shopee.co.id/product/${key}`
}

/**
 * Perluas short link Shopee (mis. s.shopee.co.id/xxx) jadi URL panjang via
 * serverless function /api/resolve. Dipanggil hanya untuk link Shopee yang
 * belum bisa diparse. Kalau gagal / tidak ada API (mis. dev lokal), kembalikan
 * link asli apa adanya — jadi tidak pernah memblokir alur.
 */
export async function expandSourceLink(raw: string | null | undefined): Promise<string> {
  const url = (raw ?? '').trim()
  if (!url) return ''
  if (parseShopeeKey(url)) return url // sudah bisa diparse, tak perlu resolve
  if (!/shopee\.co\.id/i.test(url) && !/shp\.ee/i.test(url)) return url
  try {
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(url)}`)
    if (!res.ok) return url
    const data = (await res.json()) as { url?: string }
    return typeof data.url === 'string' && data.url ? data.url : url
  } catch {
    return url
  }
}

/**
 * Cari item lain (di seluruh postingan) yang produknya sama dengan `key`.
 * Prioritaskan yang sudah punya link affiliate, lalu yang paling lama dibuat
 * (jadi nomor & link affiliate yang dipakai ulang konsisten dari yang pertama).
 */
export function findExistingByKey(pool: Item[], key: string, excludeId: string): Item | null {
  const matches = pool.filter((i) => i.id !== excludeId && parseShopeeKey(i.source_link) === key)
  if (matches.length === 0) return null
  const withAff = matches.filter((i) => (i.affiliate_link ?? '').trim())
  const candidates = withAff.length ? withAff : matches
  return candidates.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
}
