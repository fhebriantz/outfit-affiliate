import type { Item } from './types'
import { canonicalShopeeUrl } from './shopee'

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Ubah tanggal (Date atau string "YYYY-MM-DD") jadi "9 Juni 2026".
 * String "YYYY-MM-DD" diparse manual supaya tidak bergeser karena timezone.
 */
export function formatTanggalIndo(input: Date | string): string {
  let y: number, m: number, d: number
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return input
    y = Number(match[1])
    m = Number(match[2]) - 1
    d = Number(match[3])
  } else {
    y = input.getFullYear()
    m = input.getMonth()
    d = input.getDate()
  }
  const namaBulan = BULAN_ID[m] ?? ''
  return `${d} ${namaBulan} ${y}`
}

/** Pad nomor folder jadi 3 digit: 1 -> "001", 12 -> "012". */
export function padFolderLabel(n: number): string {
  return String(n).padStart(3, '0')
}

/** Tanggal hari ini dalam format "YYYY-MM-DD" (zona waktu lokal). */
export function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Pecah teks multi-link jadi array link bersih.
 * Pemisah: baris baru, spasi, tab, atau koma (sesuai aplikasi affiliate Shopee).
 */
export function parseBulkLinks(text: string): string[] {
  if (!text) return []
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Gabungkan link sumber jadi teks per-baris untuk di-paste ke aplikasi affiliate.
 * - Link Shopee dibersihkan jadi bentuk seragam (tanpa query): /product/{shop}/{item}.
 * - opts.onlyPending (default true): hanya item yang BELUM punya link affiliate,
 *   supaya produk yang di-reuse (sudah ada link affiliate) tidak ikut di-paste lagi.
 */
export function buildSourceBulk(items: Item[], opts: { onlyPending?: boolean } = {}): string {
  const onlyPending = opts.onlyPending ?? true
  return items
    .slice()
    .sort((a, b) => a.urutan - b.urutan)
    .filter((it) => (onlyPending ? !(it.affiliate_link ?? '').trim() : true))
    .map((it) => canonicalShopeeUrl(it.source_link) ?? (it.source_link ?? '').trim())
    .filter((s) => s.length > 0)
    .join('\n')
}

/** Blok info cara order yang dipasang sebelum hashtag. */
export const ORDER_INFO = `Cara order
1. Klik link di bio profil aku
2. Cari nomor produk sesuai yang aku tulis di atas
3. Klik produknya aja nanti kalian akan di arahin ke halaman checkout`

/**
 * Susun caption TikTok sesuai template:
 *   {title}                 <- baris pembuka (opsional, dari field Title)
 *   Detail outfit :
 *   -blouse : no 1
 *   -rok : no 2
 *   ...
 *   Cara order
 *   1. ... 2. ... 3. ...
 *   #hashtag ...
 */
export function buildCaption(
  items: Item[],
  hashtags: string,
  title = '',
  intro = 'Detail outfit :',
): string {
  const baris = items
    .slice()
    .sort((a, b) => a.urutan - b.urutan)
    .map((it) => {
      const kat = (it.kategori ?? 'item').trim() || 'item'
      return `-${kat} : no ${it.my_number}`
    })
  // Tiap section dipisah 1 baris kosong (join '\n\n'); di dalam section tetap '\n'.
  const sections: string[] = []
  if (title && title.trim()) sections.push(title.trim())
  sections.push([intro, ...baris].join('\n'))
  sections.push(ORDER_INFO)
  if (hashtags && hashtags.trim()) sections.push(hashtags.trim())
  return sections.join('\n\n')
}

/** Saran nomor berikutnya berdasarkan nomor global tertinggi yang sudah dipakai. */
export function nextNumber(maxUsed: number | null | undefined): number {
  const base = typeof maxUsed === 'number' && Number.isFinite(maxUsed) ? maxUsed : 0
  return base + 1
}

export interface SyncCheck {
  key: string
  label: string
  ok: boolean
  detail?: string
}

/** Hitung daftar pemeriksaan sinkron untuk satu postingan. */
export function computeSyncChecks(
  posting: { ref_url: string | null },
  items: Item[],
): SyncCheck[] {
  const total = items.length
  const adaSumber = items.filter((i) => (i.source_link ?? '').trim()).length
  const adaAff = items.filter((i) => (i.affiliate_link ?? '').trim()).length

  const numbers = items.map((i) => i.my_number)
  const dupNumbers = numbers.length !== new Set(numbers).size
  const sorted = items.slice().sort((a, b) => a.urutan - b.urutan).map((i) => i.my_number)
  let berurutan = true
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      berurutan = false
      break
    }
  }

  return [
    {
      key: 'ada_item',
      label: 'Ada minimal 1 item produk',
      ok: total > 0,
      detail: `${total} item`,
    },
    {
      key: 'sumber_lengkap',
      label: 'Semua item punya link sumber',
      ok: total > 0 && adaSumber === total,
      detail: `${adaSumber}/${total}`,
    },
    {
      key: 'affiliate_lengkap',
      label: 'Semua item punya link affiliate',
      ok: total > 0 && adaAff === total,
      detail: `${adaAff}/${total}`,
    },
    {
      key: 'jumlah_cocok',
      label: 'Jumlah link affiliate = jumlah item',
      ok: total > 0 && adaAff === total,
      detail: `${adaAff} link / ${total} item`,
    },
    {
      key: 'nomor_unik',
      label: 'Nomor tidak ada yang duplikat',
      ok: !dupNumbers,
    },
    {
      key: 'nomor_urut',
      label: 'Nomor berurutan tanpa lompat',
      ok: berurutan,
      detail: sorted.length ? `${sorted[0]}–${sorted[sorted.length - 1]}` : undefined,
    },
    {
      key: 'ref_url',
      label: 'Link referensi TikTok terisi',
      ok: Boolean((posting.ref_url ?? '').trim()),
    },
  ]
}

export function isPostingSynced(checks: SyncCheck[]): boolean {
  return checks.every((c) => c.ok)
}

export interface PostingStage {
  hasScreenshot: boolean
  hasGenerate: boolean
  hasAffiliate: boolean
  needsScreenshot: boolean
  needsGenerate: boolean
  needsAffiliate: boolean
  done: boolean
}

/**
 * Tahap penyiapan satu postingan:
 * - screenshot referensi sudah diupload? (imageCount > 0)
 * - hasil generate sudah ada? (link Drive terisi)
 * - link affiliate sudah dibuat? (semua item punya affiliate_link)
 * "done" = ketiganya sudah lengkap.
 */
export function computePostingStage(
  posting: { drive_url: string | null },
  imageCount: number,
  items: { affiliate_link: string | null }[] = [],
): PostingStage {
  const hasScreenshot = imageCount > 0
  const hasGenerate = Boolean((posting.drive_url ?? '').trim())
  const hasItems = items.length > 0
  const withAff = items.filter((i) => (i.affiliate_link ?? '').trim()).length
  const hasAffiliate = hasItems && withAff === items.length
  return {
    hasScreenshot,
    hasGenerate,
    hasAffiliate,
    needsScreenshot: !hasScreenshot,
    needsGenerate: hasScreenshot && !hasGenerate,
    needsAffiliate: hasItems && withAff < items.length,
    done: hasScreenshot && hasGenerate && hasAffiliate,
  }
}

/**
 * Daftar hal yang belum lengkap untuk satu postingan (untuk collapse di dashboard):
 * tahap konten (screenshot/generate) + pemeriksaan sinkron yang masih gagal.
 */
export function incompleteReasons(stage: PostingStage, checks: SyncCheck[]): string[] {
  const reasons: string[] = []
  if (stage.needsScreenshot) reasons.push('Belum upload screenshot referensi')
  if (stage.needsGenerate) reasons.push('Belum ada hasil generate (link Drive kosong)')
  for (const c of checks) if (!c.ok) reasons.push(c.label)
  return reasons
}

export type StageFilter = 'all' | 'needs_screenshot' | 'needs_generate' | 'needs_affiliate' | 'done'

export function matchStageFilter(stage: PostingStage, filter: StageFilter): boolean {
  switch (filter) {
    case 'needs_screenshot':
      return stage.needsScreenshot
    case 'needs_generate':
      return stage.needsGenerate
    case 'needs_affiliate':
      return stage.needsAffiliate
    case 'done':
      return stage.done
    default:
      return true
  }
}
