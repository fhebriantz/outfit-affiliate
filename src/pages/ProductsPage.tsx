import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { listAllItems, listPostings, updateItem } from '../lib/db'
import { parseShopeeKey } from '../lib/shopee'
import { formatItemCode, formatTanggalIndo, parseItemCode } from '../lib/format'
import type { Item } from '../lib/types'
import CopyButton from '../components/CopyButton'

interface Product {
  key: string
  rep: Item
  items: Item[]
  count: number
  lastLabel: string
  lastTanggal: string
}

// Input kode katalog (mis. "A 100") yang bisa diedit; simpan saat blur.
function ProductNumber({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(formatItemCode(value))
  useEffect(() => setV(formatItemCode(value)), [value])
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = parseItemCode(v)
        if (n != null && n !== value) onSave(n)
        else setV(formatItemCode(value))
      }}
      title="Ubah kode katalog (mis. A 100)"
      className="h-9 w-16 shrink-0 rounded-lg bg-brand-50 text-center text-sm font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-300"
    />
  )
}

// Input link dengan tombol buka (↗) bila berisi URL.
function LinkInput({
  value,
  placeholder,
  onSave,
}: {
  value: string
  placeholder: string
  onSave: (v: string) => void
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <div className="flex gap-1">
      <input
        className="input"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v)}
      />
      {v.trim().startsWith('http') && (
        <a
          href={v.trim()}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary shrink-0 px-3"
          title="Buka link"
        >
          ↗
        </a>
      )}
    </div>
  )
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
        // Item yang punya link sumber ATAU affiliate (sudah jadi "produk").
        const relevant = items.filter(
          (i) => (i.source_link ?? '').trim() || (i.affiliate_link ?? '').trim(),
        )
        const groups = new Map<string, Item[]>()
        for (const it of relevant) {
          const key =
            parseShopeeKey(it.source_link) ||
            (it.source_link ?? '').trim() ||
            (it.affiliate_link ?? '').trim() ||
            it.id
          const arr = groups.get(key) ?? []
          arr.push(it)
          groups.set(key, arr)
        }
        const list: Product[] = [...groups.entries()].map(([key, its]) => {
          const sorted = its.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
          const rep = sorted[0]
          let lastId = its[0].posting_id
          for (const it of its) {
            if ((tanggalById[it.posting_id] ?? '') > (tanggalById[lastId] ?? '')) lastId = it.posting_id
          }
          return {
            key,
            rep,
            items: its,
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
    // Kode lengkap (mis. "A 100") -> cocok PERSIS.
    const asCode = parseItemCode(q)
    if (asCode != null) return products.filter((p) => p.rep.my_number === asCode)
    // Lainnya -> cari di kode, kategori, link, & label.
    return products.filter((p) =>
      [formatItemCode(p.rep.my_number), p.rep.kategori, p.rep.source_link, p.rep.affiliate_link, p.lastLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [products, query])

  // Update field (nomor/link) untuk SEMUA item produk ini agar konsisten di semua postingan.
  async function updateGroup(prod: Product, patch: Partial<Item>) {
    try {
      await Promise.all(prod.items.map((it) => updateItem(it.id, patch)))
      setProducts((prev) =>
        prev.map((p) =>
          p.key === prod.key
            ? {
                ...p,
                rep: { ...p.rep, ...patch },
                items: p.items.map((it) => ({ ...it, ...patch })),
              }
            : p,
        ),
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'err')
    }
  }

  function saveNumber(prod: Product, n: number) {
    updateGroup(prod, { my_number: n }).then(() =>
      toast(`Kode diubah ke ${formatItemCode(n)} (${prod.count} item)`),
    )
  }
  function saveLink(prod: Product, field: 'source_link' | 'affiliate_link', value: string) {
    const v = value.trim() || null
    if (v === ((prod.rep[field] as string | null) ?? null)) return
    updateGroup(prod, { [field]: v }).then(() => toast('Link disimpan'))
  }
  function saveKategori(prod: Product, value: string) {
    const v = value.trim() || null
    if (v === (prod.rep.kategori ?? null)) return
    updateGroup(prod, { kategori: v }).then(() => toast(`Kategori diubah (${prod.count} item)`))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Produk</h1>
        <span className="text-sm text-gray-400">{products.length} produk</span>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Semua produk (digabung per produk). Bisa edit nomor, link sumber, &amp; link affiliate di sini
        — mis. saat produk habis dan linknya perlu diganti.
      </p>

      <input
        className="input mb-4"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari kode (mis. A 100) atau kategori/link…"
      />

      {loading ? (
        <p className="py-12 text-center text-gray-400">Memuat…</p>
      ) : products.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p className="text-sm">Belum ada produk.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p className="text-sm">Tidak ada hasil untuk pencarian ini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => {
            const hasAff = (p.rep.affiliate_link ?? '').trim().length > 0
            return (
              <div key={p.key} className="card space-y-2 p-3">
                <div className="flex items-center gap-3">
                  <ProductNumber value={p.rep.my_number} onSave={(n) => saveNumber(p, n)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        dipakai {p.count}×
                      </span>
                      {!hasAff && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Belum affiliate
                        </span>
                      )}
                    </div>
                    {p.lastLabel && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">Terakhir: {p.lastLabel}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">Kategori</label>
                  <LinkInput
                    value={p.rep.kategori ?? ''}
                    placeholder="blouse / rok / sepatu"
                    onSave={(v) => saveKategori(p, v)}
                  />
                </div>

                <div>
                  <label className="label">Link sumber (Shopee)</label>
                  <LinkInput
                    value={p.rep.source_link ?? ''}
                    placeholder="https://shopee.co.id/product/..."
                    onSave={(v) => saveLink(p, 'source_link', v)}
                  />
                </div>

                <div>
                  <label className="label">Link affiliate</label>
                  <div className="flex gap-1">
                    <div className="min-w-0 flex-1">
                      <LinkInput
                        value={p.rep.affiliate_link ?? ''}
                        placeholder="https://s.shopee.co.id/..."
                        onSave={(v) => saveLink(p, 'affiliate_link', v)}
                      />
                    </div>
                    <CopyButton
                      text={p.rep.affiliate_link ?? ''}
                      label="Copy"
                      className="btn-secondary shrink-0 text-xs"
                      disabled={!hasAff}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
