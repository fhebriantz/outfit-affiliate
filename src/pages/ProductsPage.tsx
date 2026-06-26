import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { listAllItems, listPostings, updateItem } from '../lib/db'
import { parseShopeeKey, resolveAffiliateLinks } from '../lib/shopee'
import { formatItemCode, formatTanggalIndo, parseBulkLinks, parseItemCode } from '../lib/format'
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
  const [limit, setLimit] = useState(50)
  const [affFilter, setAffFilter] = useState<'all' | 'with' | 'without'>('all')
  const [showMaster, setShowMaster] = useState(false)
  const [masterPaste, setMasterPaste] = useState('')
  const [masterBusy, setMasterBusy] = useState(false)
  useEffect(() => setLimit(50), [query, affFilter])

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

  const hasAffOf = (p: Product) => (p.rep.affiliate_link ?? '').trim().length > 0
  const counts = useMemo(() => {
    const withAff = products.filter(hasAffOf).length
    return { all: products.length, with: withAff, without: products.length - withAff }
  }, [products])

  const visible = useMemo(() => {
    let list = products
    if (affFilter === 'with') list = list.filter(hasAffOf)
    else if (affFilter === 'without') list = list.filter((p) => !hasAffOf(p))
    const q = query.trim().toLowerCase()
    if (!q) return list
    // Kode lengkap (mis. "A 100") -> cocok PERSIS.
    const asCode = parseItemCode(q)
    if (asCode != null) return list.filter((p) => p.rep.my_number === asCode)
    // Lainnya -> cari di kode, kategori, link, & label.
    return list.filter((p) =>
      [formatItemCode(p.rep.my_number), p.rep.kategori, p.rep.source_link, p.rep.affiliate_link, p.lastLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [products, query, affFilter])

  // Import Affiliate Master: paste semua link affiliate -> cocokkan ke produk (lintas postingan)
  // berdasarkan kunci Shopee, lalu isi affiliate_link ke SEMUA item produk yang cocok.
  async function applyMaster() {
    const links = parseBulkLinks(masterPaste)
    if (links.length === 0) {
      toast('Tidak ada link terdeteksi', 'err')
      return
    }
    setMasterBusy(true)
    try {
      const { byKey, unresolved } = await resolveAffiliateLinks(links)
      const updates: { prod: Product; link: string }[] = []
      for (const p of products) {
        if (byKey.has(p.key)) {
          const link = byKey.get(p.key)!
          if ((p.rep.affiliate_link ?? '') !== link) updates.push({ prod: p, link })
        }
      }
      if (updates.length === 0) {
        toast(
          byKey.size === 0
            ? 'Tidak ada link yang bisa dikenali sebagai produk Shopee'
            : 'Semua produk yang cocok sudah pakai link ini',
        )
        return
      }
      await Promise.all(
        updates.flatMap(({ prod, link }) => prod.items.map((it) => updateItem(it.id, { affiliate_link: link }))),
      )
      const linkByKey = new Map(updates.map((u) => [u.prod.key, u.link]))
      setProducts((prev) =>
        prev.map((p) =>
          linkByKey.has(p.key)
            ? {
                ...p,
                rep: { ...p.rep, affiliate_link: linkByKey.get(p.key)! },
                items: p.items.map((it) => ({ ...it, affiliate_link: linkByKey.get(p.key)! })),
              }
            : p,
        ),
      )
      setMasterPaste('')
      const itemCount = updates.reduce((s, u) => s + u.prod.items.length, 0)
      const tail = unresolved.length ? ` · ${unresolved.length} link tak cocok produk` : ''
      toast(`${updates.length} produk terisi (${itemCount} item)${tail}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal import affiliate', 'err')
    } finally {
      setMasterBusy(false)
    }
  }

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

      {/* Import Affiliate Master */}
      <div className="card mb-4 space-y-2 p-3">
        <button
          onClick={() => setShowMaster((s) => !s)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900">Import Affiliate (master)</span>
          <span className="text-gray-400">{showMaster ? '▲' : '▼'}</span>
        </button>
        {showMaster && (
          <>
            <p className="text-xs text-gray-500">
              Paste <strong>semua link affiliate</strong> sekaligus (urutan bebas). Dicocokkan otomatis
              ke produk yang sama di <strong>seluruh katalog</strong> berdasarkan produk Shopee-nya, lalu
              link affiliate diisi ke semua nomor yang memakai produk itu.
            </p>
            <textarea
              className="input min-h-[90px] font-mono text-sm"
              value={masterPaste}
              onChange={(e) => setMasterPaste(e.target.value)}
              placeholder={'https://s.shopee.co.id/...\nhttps://s.shopee.co.id/...'}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {parseBulkLinks(masterPaste).length} link terdeteksi
              </span>
              <button
                onClick={applyMaster}
                disabled={masterBusy}
                className="btn-primary disabled:opacity-50"
              >
                {masterBusy ? 'Mencocokkan…' : 'Cocokkan & isi'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filter status affiliate */}
      <div className="mb-3 flex gap-2">
        {([
          ['all', `Semua (${counts.all})`],
          ['without', `Belum affiliate (${counts.without})`],
          ['with', `Sudah affiliate (${counts.with})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAffFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              affFilter === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
          {visible.slice(0, limit).map((p) => {
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
          {visible.length > limit && (
            <button onClick={() => setLimit((n) => n + 50)} className="btn-secondary w-full">
              Muat lebih banyak ({visible.length - limit} lagi)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
