import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  archivePosting,
  createItem,
  createPosting,
  deletePosting,
  listAllItems,
  listItems,
  listPostings,
  reserveFolderNumber,
  reserveNumbers,
  restorePosting,
  updatePosting,
} from '../lib/db'
import { imagePublicUrl, listAllImages } from '../lib/images'
import { DEFAULT_TITLE } from '../lib/types'
import type { Item, Posting, PostingImage, PostingStatus } from '../lib/types'
import {
  computePostingStage,
  computeSyncChecks,
  formatItemCode,
  formatTanggalIndo,
  incompleteReasons,
  isPostingSynced,
  matchStageFilter,
  padFolderLabel,
  todayISO,
  type StageFilter,
} from '../lib/format'
import SyncBadge from '../components/SyncBadge'
import StageBadges from '../components/StageBadges'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  generated: 'Sudah generate',
  posted: 'Sudah posting',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [postings, setPostings] = useState<Posting[]>([])
  const [itemsByPosting, setItemsByPosting] = useState<Record<string, Item[]>>({})
  const [imagesByPosting, setImagesByPosting] = useState<Record<string, PostingImage[]>>({})
  const [filter, setFilter] = useState<StageFilter>('all')
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(idStr: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(idStr) ? next.delete(idStr) : next.add(idStr)
      return next
    })
  }
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [ps, allItems, allImages] = await Promise.all([
        listPostings(),
        listAllItems(),
        listAllImages(),
      ])
      const grouped: Record<string, Item[]> = {}
      for (const it of allItems) {
        ;(grouped[it.posting_id] ??= []).push(it)
      }
      const imgGrouped: Record<string, PostingImage[]> = {}
      for (const im of allImages) {
        ;(imgGrouped[im.posting_id] ??= []).push(im)
      }
      setPostings(ps)
      setItemsByPosting(grouped)
      setImagesByPosting(imgGrouped)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat data', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!user) return
    setCreating(true)
    try {
      const p = await createPosting(user.id, {
        tanggal: todayISO(),
        label: padFolderLabel(await reserveFolderNumber(user.id)),
        catatan: DEFAULT_TITLE,
        status: 'draft',
      })
      navigate(`/posting/${p.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal membuat postingan', 'err')
      setCreating(false)
    }
  }

  async function handleDuplicate(p: Posting) {
    if (!user) return
    try {
      const items = await listItems(p.id)
      const dup = await createPosting(user.id, {
        tanggal: todayISO(),
        label: padFolderLabel(await reserveFolderNumber(user.id)),
        ref_nama: p.ref_nama,
        caption_hashtags: p.caption_hashtags,
        catatan: p.catatan ?? DEFAULT_TITLE,
        status: 'draft',
      })
      // Salin struktur kategori saja (tanpa link), nomor LANJUT otomatis dari counter.
      const ordered = items.slice().sort((a, b) => a.urutan - b.urutan)
      const start = await reserveNumbers(user.id, ordered.length)
      for (let i = 0; i < ordered.length; i++) {
        await createItem(user.id, {
          posting_id: dup.id,
          urutan: ordered[i].urutan,
          my_number: start + i,
          kategori: ordered[i].kategori,
        })
      }
      toast('Postingan diduplikat')
      navigate(`/posting/${dup.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menduplikat', 'err')
    }
  }

  async function handleStatusChange(p: Posting, status: PostingStatus) {
    setPostings((prev) => prev.map((x) => (x.id === p.id ? { ...x, status } : x)))
    try {
      await updatePosting(p.id, { status })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal ubah status', 'err')
      load()
    }
  }

  async function handleArchive(p: Posting) {
    if (!confirm(`Pindahkan "${p.label ?? p.tanggal}" ke arsip? Bisa dipulihkan lagi nanti.`)) return
    try {
      await archivePosting(p.id, new Date().toISOString())
      toast('Dipindahkan ke arsip')
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengarsip', 'err')
    }
  }

  async function handleRestore(p: Posting) {
    try {
      await restorePosting(p.id)
      toast('Postingan dipulihkan')
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memulihkan', 'err')
    }
  }

  async function handleDeletePermanent(p: Posting) {
    if (
      !confirm(
        `Hapus PERMANEN "${p.label ?? p.tanggal}"? Semua item & gambar ikut terhapus dan TIDAK bisa dikembalikan.`,
      )
    )
      return
    try {
      await deletePosting(p.id)
      toast('Dihapus permanen')
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus', 'err')
    }
  }

  const activePostings = useMemo(() => postings.filter((p) => !p.archived_at), [postings])
  const archivedPostings = useMemo(() => postings.filter((p) => !!p.archived_at), [postings])

  const cards = useMemo(
    () =>
      activePostings.map((p) => {
        const items = itemsByPosting[p.id] ?? []
        const images = imagesByPosting[p.id] ?? []
        const imageCount = images.length
        const checks = computeSyncChecks(p, items)
        const stage = computePostingStage(p, imageCount, items)
        const reasons = incompleteReasons(stage, checks)
        return { p, items, images, imageCount, stage, reasons, synced: isPostingSynced(checks) }
      }),
    [activePostings, itemsByPosting, imagesByPosting],
  )

  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards.filter((c) => {
      if (!matchStageFilter(c.stage, filter)) return false
      if (!q) return true
      const haystack = [
        c.p.label,
        c.p.tanggal,
        formatTanggalIndo(c.p.tanggal),
        c.p.ref_nama,
        ...c.items.flatMap((it) => [
          it.kategori,
          it.ref_code,
          it.source_link,
          it.affiliate_link,
          formatItemCode(it.my_number),
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [cards, filter, query])

  const counts = useMemo(
    () => ({
      all: cards.length,
      needs_screenshot: cards.filter((c) => c.stage.needsScreenshot).length,
      needs_generate: cards.filter((c) => c.stage.needsGenerate).length,
      needs_affiliate: cards.filter((c) => c.stage.needsAffiliate).length,
      done: cards.filter((c) => c.stage.done).length,
    }),
    [cards],
  )

  const FILTERS: { key: StageFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'needs_screenshot', label: 'Belum screenshot' },
    { key: 'needs_generate', label: 'Belum generate' },
    { key: 'needs_affiliate', label: 'Belum affiliate' },
    { key: 'done', label: 'Lengkap' },
  ]

  if (showArchived) {
    return (
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Arsip</h1>
          <button onClick={() => setShowArchived(false)} className="btn-secondary">
            ← Kembali ke postingan
          </button>
        </div>
        {archivedPostings.length === 0 ? (
          <div className="card text-center text-gray-500">
            <p className="text-sm">Arsip kosong.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {archivedPostings.map((p) => (
              <div key={p.id} className="card flex items-center justify-between gap-3 p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">
                    {p.label || formatTanggalIndo(p.tanggal)}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {(itemsByPosting[p.id] ?? []).length} item
                    {p.ref_nama ? ` · ref: ${p.ref_nama}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button onClick={() => handleRestore(p)} className="btn-ghost text-xs text-sec-700">
                    Pulihkan
                  </button>
                  <button
                    onClick={() => handleDeletePermanent(p)}
                    className="btn-ghost text-xs text-red-600"
                  >
                    Hapus permanen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Postingan</h1>
        <div className="flex items-center gap-2">
          {archivedPostings.length > 0 && (
            <button onClick={() => setShowArchived(true)} className="btn-secondary">
              Arsip ({archivedPostings.length})
            </button>
          )}
          <button onClick={handleCreate} disabled={creating} className="btn-primary">
            {creating ? 'Membuat…' : '+ Postingan baru'}
          </button>
        </div>
      </div>

      {/* Pencarian */}
      <div className="mb-3">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari: nomor, kategori, kode ref (b 583), nama referensi, link, tanggal…"
        />
      </div>

      {/* Filter tahap: dropdown di HP, chip di layar lebar */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value as StageFilter)}
        className="input mb-4 sm:hidden"
      >
        {FILTERS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label} ({counts[f.key]})
          </option>
        ))}
      </select>
      <div className="mb-4 hidden flex-wrap gap-2 sm:flex">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
              (filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')
            }
          >
            {f.label}
            <span className={'ml-1.5 ' + (filter === f.key ? 'text-brand-100' : 'text-gray-400')}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-400">Memuat…</p>
      ) : cards.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p className="font-medium">Belum ada postingan.</p>
          <p className="mt-1 text-sm">Klik “+ Postingan baru” untuk mulai.</p>
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p className="text-sm">Tidak ada postingan untuk filter ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCards.map(({ p, items, images, imageCount, stage, reasons, synced }) => {
            const isExpanded = expanded.has(p.id)
            return (
              <div
                key={p.id}
                className={
                  'card p-3 sm:p-4 ' +
                  (isExpanded ? '' : 'max-sm:max-h-[120px] max-sm:overflow-hidden')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => navigate(`/posting/${p.id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">
                        {p.label || formatTanggalIndo(p.tanggal)}
                      </span>
                      <SyncBadge synced={synced} />
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">
                      {items.length} item · {STATUS_LABEL[p.status] ?? p.status}
                      {p.ref_nama ? ` · ref: ${p.ref_nama}` : ''}
                    </p>
                    {images.length > 0 && (
                      <div className="mt-2 flex sm:gap-1.5">
                        {images.slice(0, 4).map((img, idx) => (
                          <div
                            key={img.id}
                            className="relative -ml-2.5 h-9 w-9 overflow-hidden rounded-md bg-gray-100 ring-2 ring-white first:ml-0 sm:ml-0 sm:h-14 sm:w-14 sm:ring-0"
                          >
                            <img
                              src={imagePublicUrl(img.path)}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            {idx === 3 && images.length > 4 && (
                              <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white">
                                +{images.length - 4}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Badge tahap: hanya tampil di layar lebar (desktop) */}
                    <div className="mt-2 hidden sm:block">
                      <StageBadges stage={stage} imageCount={imageCount} />
                    </div>
                  </button>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {reasons.length > 0 ? (
                      <button
                        onClick={() => toggleExpand(p.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                        title="Lihat yang belum lengkap"
                      >
                        {isExpanded ? '▾' : '▸'} {reasons.length} belum
                      </button>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        ✓ Lengkap
                      </span>
                    )}
                    <select
                      value={p.status}
                      onChange={(e) => handleStatusChange(p, e.target.value as PostingStatus)}
                      className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-600 outline-none focus:border-brand-400"
                      title="Ubah status"
                    >
                      <option value="draft">Draft</option>
                      <option value="generated">Generate</option>
                      <option value="posted">Posted</option>
                    </select>
                    <button
                      onClick={() => handleDuplicate(p)}
                      className="rounded px-2 py-0.5 text-xs text-gray-600 transition hover:bg-gray-100"
                    >
                      Duplikat
                    </button>
                    <button
                      onClick={() => handleArchive(p)}
                      className="rounded px-2 py-0.5 text-xs text-amber-600 transition hover:bg-amber-50"
                    >
                      Arsip
                    </button>
                  </div>
                </div>

                {/* Collapse: daftar yang belum lengkap */}
                {isExpanded && reasons.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                    {reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-amber-500">⚠</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
