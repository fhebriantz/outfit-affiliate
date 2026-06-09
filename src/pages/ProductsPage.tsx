import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { listAllItems, listPostings } from '../lib/db'
import { canonicalShopeeUrl, parseShopeeKey } from '../lib/shopee'
import { formatTanggalIndo } from '../lib/format'
import type { Item } from '../lib/types'
import CopyButton from '../components/CopyButton'

interface Product {
  key: string
  rep: Item
  count: number
  lastLabel: string
  lastTanggal: string
}

export default function ProductsPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [items, postings] = await Promise.all([listAllItems(), listPostings()])
        const tanggalById: Record<string, string> = {}
        const labelById: Record<string, string> = {}
        for (const p of postings) {
          tanggalById[p.id] = p.tanggal
          labelById[p.id] = p.label || formatTanggalIndo(p.tanggal)
        }
        // Hanya item yang sudah punya link affiliate.
        const withAff = items.filter((i) => (i.affiliate_link ?? '').trim())
        // Kelompokkan per produk (key shop/item; fallback ke link kalau tak bisa diparse).
        const groups = new Map<string, Item[]>()
        for (const it of withAff) {
          const key =
            parseShopeeKey(it.source_link) || (it.source_link ?? '').trim() || it.affiliate_link || it.id
          const arr = groups.get(key) ?? []
          arr.push(it)
          groups.set(key, arr)
        }
        const list: Product[] = [...groups.entries()].map(([key, its]) => {
          const sorted = its.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
          const rep = sorted[0]
          // Postingan terakhir memakai produk ini.
          let lastId = its[0].posting_id
          for (const it of its) {
            if ((tanggalById[it.posting_id] ?? '') > (tanggalById[lastId] ?? '')) lastId = it.posting_id
          }
          return {
            key,
            rep,
            count: its.length,
            lastLabel: labelById[lastId] ?? '',
            lastTanggal: tanggalById[lastId] ?? '',
          }
        })
        list.sort((a, b) => a.rep.my_number - b.rep.my_number)
        setProducts(list)
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Gagal memuat produk', 'err')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      [p.rep.kategori, p.rep.source_link, p.rep.affiliate_link, p.rep.ref_code, String(p.rep.my_number), p.lastLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [products, query])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Produk</h1>
        <span className="text-sm text-gray-400">{products.length} produk</span>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Semua produk yang sudah punya link affiliate (digabung per produk). Untuk cari nomor &amp;
        link affiliate yang sudah ada.
      </p>

      <input
        className="input mb-4"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari: nomor, kategori, kode ref, link…"
      />

      {loading ? (
        <p className="py-12 text-center text-gray-400">Memuat…</p>
      ) : products.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p className="text-sm">Belum ada produk dengan link affiliate.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p className="text-sm">Tidak ada hasil untuk pencarian ini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => {
            const sourceClean = canonicalShopeeUrl(p.rep.source_link) ?? (p.rep.source_link ?? '')
            const aff = p.rep.affiliate_link ?? ''
            return (
              <div key={p.key} className="card flex items-start gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                  {p.rep.my_number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{p.rep.kategori || 'item'}</span>
                    {p.rep.ref_code && (
                      <span className="text-xs text-gray-400">{p.rep.ref_code}</span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      dipakai {p.count}×
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {p.lastLabel ? `Terakhir: ${p.lastLabel}` : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {sourceClean && (
                      <a
                        href={sourceClean}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-sec-700 hover:underline"
                      >
                        Link sumber ↗
                      </a>
                    )}
                    {aff && (
                      <a
                        href={aff}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-sec-700 hover:underline"
                      >
                        Link affiliate ↗
                      </a>
                    )}
                  </div>
                </div>
                <CopyButton text={aff} label="Copy aff" className="btn-secondary shrink-0 text-xs" disabled={!aff} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
