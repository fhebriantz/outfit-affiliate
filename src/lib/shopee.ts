import type { Item } from './types'

/**
 * Ambil kunci produk Shopee "{shop_id}/{product_id}" dari sebuah link.
 * - Abaikan http/https & "www." (host tidak dipakai untuk pencocokan).
 * - Abaikan query string setelah "?" (parameter affiliate/tracking berbeda-beda).
 * - Mendukung 2 format link Shopee:
 *     1) .../product/{shop_id}/{product_id}
 *     2) .../Nama-Produk-i.{shop_id}.{product_id}
 * Kembalikan null kalau bukan link produk yang bisa dikenali
 * (mis. short link s.shopee.co.id/xxxx).
 */
export function parseShopeeKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  let url = raw.trim()
  if (!url) return null
  // Buang fragment & query.
  url = url.split('#')[0]
  const q = url.indexOf('?')
  const path = q >= 0 ? url.slice(0, q) : url

  let m = path.match(/\/product\/(\d+)\/(\d+)/i)
  if (m) return `${m[1]}/${m[2]}`

  m = path.match(/-i\.(\d+)\.(\d+)/i)
  if (m) return `${m[1]}/${m[2]}`

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
