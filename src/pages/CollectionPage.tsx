import { useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { listAllItems, updateItem } from '../lib/db'
import { parseShopeeKey, resolveAffiliateLinks } from '../lib/shopee'
import { parseBulkLinks } from '../lib/format'
import type { Item } from '../lib/types'

// Halaman koleksi affiliate (collshp) dibungkus iframe — tetap di web ini.
// Di atasnya ada Import Affiliate Master: salin link dari koleksi, paste, lalu
// dicocokkan otomatis ke seluruh katalog berdasarkan produk Shopee-nya.
const COLLECTION_URL = 'https://collshp.com/ourdailyoutfit'

function productKey(it: Item): string {
  return (
    parseShopeeKey(it.source_link) ||
    (it.source_link ?? '').trim() ||
    (it.affiliate_link ?? '').trim() ||
    it.id
  )
}

export default function CollectionPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        setItems(await listAllItems())
      } catch {
        /* abaikan; import butuh data item, tapi iframe tetap tampil */
      }
    })()
  }, [])

  async function applyMaster() {
    const links = parseBulkLinks(paste)
    if (links.length === 0) {
      toast('Tidak ada link terdeteksi', 'err')
      return
    }
    setBusy(true)
    try {
      const { byKey, unresolved } = await resolveAffiliateLinks(links)
      const groups = new Map<string, Item[]>()
      for (const it of items) {
        if (!(it.source_link ?? '').trim() && !(it.affiliate_link ?? '').trim()) continue
        const k = productKey(it)
        const arr = groups.get(k) ?? []
        arr.push(it)
        groups.set(k, arr)
      }
      const toUpdate: { id: string; link: string }[] = []
      let prodCount = 0
      for (const [k, its] of groups) {
        if (!byKey.has(k)) continue
        const link = byKey.get(k)!
        const changed = its.filter((it) => (it.affiliate_link ?? '') !== link)
        if (changed.length) {
          prodCount++
          changed.forEach((it) => toUpdate.push({ id: it.id, link }))
        }
      }
      if (toUpdate.length === 0) {
        toast(
          byKey.size === 0
            ? 'Tidak ada link yang dikenali sebagai produk Shopee'
            : 'Semua produk yang cocok sudah pakai link ini',
        )
        return
      }
      await Promise.all(toUpdate.map((u) => updateItem(u.id, { affiliate_link: u.link })))
      const linkById = new Map(toUpdate.map((u) => [u.id, u.link]))
      setItems((prev) =>
        prev.map((it) => (linkById.has(it.id) ? { ...it, affiliate_link: linkById.get(it.id)! } : it)),
      )
      setPaste('')
      const tail = unresolved.length ? ` · ${unresolved.length} link tak cocok produk` : ''
      toast(`${prodCount} produk terisi (${toUpdate.length} item)${tail}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal import affiliate', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-2 p-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Import Affiliate (master)</h2>
          <span className="text-xs text-gray-400">{parseBulkLinks(paste).length} link</span>
        </div>
        <textarea
          className="input min-h-[80px] font-mono text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Salin link affiliate dari koleksi di bawah, paste di sini…"
        />
        <button
          onClick={applyMaster}
          disabled={busy}
          className="btn-primary w-full disabled:opacity-50"
        >
          {busy ? 'Mencocokkan…' : 'Cocokkan & isi ke katalog'}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-sm text-gray-400">
            Memuat koleksi…
          </div>
        )}
        <iframe
          src={COLLECTION_URL}
          title="Koleksi affiliate"
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
          className="h-[78vh] w-full"
        />
      </div>
    </div>
  )
}
