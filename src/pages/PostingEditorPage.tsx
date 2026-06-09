import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  createItem,
  deleteItem as dbDeleteItem,
  getMaxNumber,
  getPosting,
  getSettings,
  listAllItems,
  listItems,
  listPostings,
  updateItem,
  updatePosting,
} from '../lib/db'
import type { Item, Posting, PostingStatus } from '../lib/types'
import { DEFAULT_HASHTAGS, DEFAULT_KATEGORI } from '../lib/types'
import {
  buildCaption,
  buildSourceBulk,
  computePostingStage,
  computeSyncChecks,
  formatTanggalIndo,
  isPostingSynced,
  parseBulkLinks,
} from '../lib/format'
import { expandSourceLink, findExistingByKey, parseShopeeKey } from '../lib/shopee'
import CopyButton from '../components/CopyButton'
import SyncBadge from '../components/SyncBadge'
import ItemRow from '../components/ItemRow'
import ImageGallery from '../components/ImageGallery'
import StageBadges from '../components/StageBadges'

export default function PostingEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [posting, setPosting] = useState<Posting | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [presets, setPresets] = useState<string[]>(DEFAULT_KATEGORI)
  const [defaultHashtags, setDefaultHashtags] = useState(DEFAULT_HASHTAGS)
  const [loading, setLoading] = useState(true)
  const [affiliatePaste, setAffiliatePaste] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [sourcePaste, setSourcePaste] = useState('')
  const [addingBulk, setAddingBulk] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [postingLabels, setPostingLabels] = useState<Record<string, string>>({})
  const [showAllSource, setShowAllSource] = useState(false)
  const [dup, setDup] = useState<{ itemId: string; existing: Item } | null>(null)

  async function load() {
    if (!id || !user) return
    setLoading(true)
    try {
      const [p, its, settings, all, posts] = await Promise.all([
        getPosting(id),
        listItems(id),
        getSettings(user.id),
        listAllItems(),
        listPostings(),
      ])
      setPosting(p)
      setItems(its)
      setPresets(settings.kategori_presets)
      setDefaultHashtags(settings.default_hashtags)
      setAllItems(all)
      setPostingLabels(
        Object.fromEntries(posts.map((x) => [x.id, x.label || formatTanggalIndo(x.tanggal)])),
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat postingan', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.urutan - b.urutan),
    [items],
  )
  const effectiveHashtags = posting?.caption_hashtags ?? defaultHashtags
  const sourceBulk = useMemo(
    () => buildSourceBulk(items, { onlyPending: !showAllSource }),
    [items, showAllSource],
  )
  // Item tujuan paste affiliate = item yang sama dengan yang ditampilkan di bulk copy,
  // supaya link affiliate hasil Shopee terpasang ke produk yang benar.
  const pasteTargets = useMemo(
    () =>
      items
        .slice()
        .sort((a, b) => a.urutan - b.urutan)
        .filter((it) => (showAllSource ? true : !(it.affiliate_link ?? '').trim())),
    [items, showAllSource],
  )
  // Preview pemetaan: link ke-i akan dipasang ke item tujuan ke-i.
  const affiliateMapping = useMemo(() => {
    const links = parseBulkLinks(affiliatePaste)
    const n = Math.max(links.length, pasteTargets.length)
    return Array.from({ length: n }, (_, i) => ({
      link: links[i] ?? null,
      item: pasteTargets[i] ?? null,
    }))
  }, [affiliatePaste, pasteTargets])

  // Kumpulan item dari postingan LAIN + item postingan ini (fresh state),
  // dipakai untuk deteksi produk duplikat berdasarkan link Shopee.
  const dedupPool = useMemo(() => {
    const others = posting ? allItems.filter((i) => i.posting_id !== posting.id) : allItems
    return [...others, ...items]
  }, [allItems, items, posting])

  // Hint per item: apakah produknya sama dengan item lain yang sudah ada?
  const dupHints = useMemo(() => {
    const map: Record<string, { number: number; label: string; consistent: boolean }> = {}
    for (const it of items) {
      const key = parseShopeeKey(it.source_link)
      if (!key) continue
      const match = findExistingByKey(dedupPool, key, it.id)
      if (!match) continue
      map[it.id] = {
        number: match.my_number,
        label: postingLabels[match.posting_id] ?? 'postingan lain',
        consistent: match.my_number === it.my_number,
      }
    }
    return map
  }, [items, dedupPool, postingLabels])
  const caption = useMemo(
    () => buildCaption(items, effectiveHashtags),
    [items, effectiveHashtags],
  )
  const checks = useMemo(
    () => (posting ? computeSyncChecks(posting, items) : []),
    [posting, items],
  )
  const synced = isPostingSynced(checks)

  // ---------- Postingan ----------
  async function savePosting(patch: Partial<Posting>) {
    if (!posting) return
    setPosting({ ...posting, ...patch })
    try {
      await updatePosting(posting.id, patch)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'err')
    }
  }

  function changeTanggal(tanggal: string) {
    // Auto-isi label dari tanggal (label tetap bisa diedit manual sesudahnya).
    savePosting({ tanggal, label: formatTanggalIndo(tanggal) })
  }

  // ---------- Item ----------
  async function addItem() {
    if (!posting || !user) return
    setAddingItem(true)
    try {
      const maxNum = await getMaxNumber()
      const maxUrutan = items.reduce((m, it) => Math.max(m, it.urutan), 0)
      const created = await createItem(user.id, {
        posting_id: posting.id,
        urutan: maxUrutan + 1,
        my_number: maxNum + 1,
        kategori: presets[0] ?? '',
      })
      setItems((prev) => [...prev, created])
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menambah item', 'err')
    } finally {
      setAddingItem(false)
    }
  }

  // Buat banyak item sekaligus dari daftar link sumber (1 link per baris).
  // Nomor lanjut otomatis; produk yang sudah pernah dipakai langsung reuse nomor & affiliate.
  async function addItemsFromSources() {
    if (!posting || !user) return
    const rawLinks = parseBulkLinks(sourcePaste)
    if (rawLinks.length === 0) {
      toast('Tidak ada link terdeteksi', 'err')
      return
    }
    setAddingBulk(true)
    try {
      // Perluas short link Shopee dulu (paralel) supaya deteksi duplikat akurat.
      const links = await Promise.all(rawLinks.map((l) => expandSourceLink(l)))
      let nextNum = (await getMaxNumber()) + 1
      let urutan = items.reduce((m, it) => Math.max(m, it.urutan), 0) + 1
      const pool = [...dedupPool]
      const created: Item[] = []
      let reusedCount = 0
      for (const link of links) {
        let myNumber = nextNum
        let affiliate: string | null = null
        const key = parseShopeeKey(link)
        if (key) {
          const ex = findExistingByKey(pool, key, '')
          if (ex) {
            myNumber = ex.my_number
            affiliate = (ex.affiliate_link ?? '').trim() ? ex.affiliate_link : null
            reusedCount++
          }
        }
        if (myNumber === nextNum) nextNum++ // hanya naik kalau produk baru
        const item = await createItem(user.id, {
          posting_id: posting.id,
          urutan,
          my_number: myNumber,
          kategori: '',
          source_link: link,
          affiliate_link: affiliate,
        })
        urutan++
        created.push(item)
        pool.push(item)
      }
      setItems((prev) => [...prev, ...created])
      setSourcePaste('')
      toast(`${created.length} item dibuat${reusedCount ? `, ${reusedCount} reuse` : ''}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal membuat item', 'err')
    } finally {
      setAddingBulk(false)
    }
  }

  async function saveItem(itemId: string, patch: Partial<Item>) {
    // Kalau link sumber yang dimasukkan short link, perluas dulu jadi URL panjang.
    if ('source_link' in patch) {
      const orig = (patch.source_link as string | null) ?? ''
      if (orig && !parseShopeeKey(orig)) {
        const expanded = await expandSourceLink(orig)
        if (expanded && expanded !== orig) {
          patch = { ...patch, source_link: expanded }
          toast('Short link diperluas')
        }
      }
    }
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))
    try {
      await updateItem(itemId, patch)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan item', 'err')
    }
    // Deteksi produk duplikat saat link sumber diubah.
    if ('source_link' in patch) {
      const key = parseShopeeKey(patch.source_link as string | null)
      if (key) {
        const existing = findExistingByKey(dedupPool, key, itemId)
        if (existing) {
          const current = items.find((i) => i.id === itemId)
          const numberDiffers = existing.my_number !== current?.my_number
          const existingAff = (existing.affiliate_link ?? '').trim()
          const affDiffers = Boolean(existingAff) && existingAff !== (current?.affiliate_link ?? '')
          if (numberDiffers || affDiffers) setDup({ itemId, existing })
        }
      }
    }
  }

  // Buka Google Drive di tab baru + salin nama folder (label) ke clipboard.
  async function openDrive() {
    const folderName = posting?.label || (posting ? formatTanggalIndo(posting.tanggal) : '')
    try {
      if (navigator.clipboard && window.isSecureContext && folderName) {
        await navigator.clipboard.writeText(folderName)
        toast(`Nama folder "${folderName}" disalin — tinggal bikin folder & paste`)
      }
    } catch {
      /* abaikan: tetap buka Drive walau gagal menyalin */
    }
    window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener')
  }

  // Pakai ulang nomor & link affiliate dari produk yang sudah ada.
  function reuseExisting() {
    if (!dup) return
    const patch: Partial<Item> = { my_number: dup.existing.my_number }
    if ((dup.existing.affiliate_link ?? '').trim()) patch.affiliate_link = dup.existing.affiliate_link
    saveItem(dup.itemId, patch)
    toast(`Pakai ulang nomor ${dup.existing.my_number}`)
    setDup(null)
  }

  async function removeItem(itemId: string) {
    if (!confirm('Hapus item ini?')) return
    const prev = items
    setItems((p) => p.filter((it) => it.id !== itemId))
    try {
      await dbDeleteItem(itemId)
    } catch (e) {
      setItems(prev)
      toast(e instanceof Error ? e.message : 'Gagal menghapus item', 'err')
    }
  }

  async function moveItem(itemId: string, dir: -1 | 1) {
    const ordered = sortedItems
    const idx = ordered.findIndex((it) => it.id === itemId)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return
    const a = ordered[idx]
    const b = ordered[swapIdx]
    // Tukar nilai urutan.
    setItems((prev) =>
      prev.map((it) =>
        it.id === a.id ? { ...it, urutan: b.urutan } : it.id === b.id ? { ...it, urutan: a.urutan } : it,
      ),
    )
    try {
      await Promise.all([updateItem(a.id, { urutan: b.urutan }), updateItem(b.id, { urutan: a.urutan })])
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengurutkan', 'err')
      load()
    }
  }

  // ---------- Paste link affiliate massal ----------
  async function applyAffiliate() {
    const links = parseBulkLinks(affiliatePaste)
    if (links.length === 0) {
      toast('Tidak ada link terdeteksi', 'err')
      return
    }
    const targets = pasteTargets
    if (targets.length === 0) {
      toast('Tidak ada item yang menunggu link affiliate', 'err')
      return
    }
    const n = Math.min(links.length, targets.length)
    try {
      await Promise.all(
        targets.slice(0, n).map((it, i) => updateItem(it.id, { affiliate_link: links[i] })),
      )
      setItems((prev) =>
        prev.map((it) => {
          const i = targets.findIndex((t) => t.id === it.id)
          return i >= 0 && i < n ? { ...it, affiliate_link: links[i] } : it
        }),
      )
      setAffiliatePaste('')
      if (links.length !== targets.length) {
        toast(`Terpasang ${n} link. Jumlah link (${links.length}) ≠ item tujuan (${targets.length})!`, 'err')
      } else {
        toast(`${n} link affiliate terpasang`)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menerapkan link', 'err')
    }
  }

  if (loading) return <p className="py-12 text-center text-gray-400">Memuat…</p>
  if (!posting) return <p className="py-12 text-center text-gray-400">Postingan tidak ditemukan.</p>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => navigate('/')} className="btn-ghost">
          ← Kembali
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <StageBadges stage={computePostingStage(posting, imageCount, items)} imageCount={imageCount} />
          <SyncBadge synced={synced} size="md" />
        </div>
      </div>

      {/* Detail postingan */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-gray-900">
          {posting.label || formatTanggalIndo(posting.tanggal)}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Tanggal posting</label>
            <input
              type="date"
              className="input"
              value={posting.tanggal}
              onChange={(e) => changeTanggal(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Label folder</label>
            <input
              className="input"
              value={posting.label ?? ''}
              onChange={(e) => setPosting({ ...posting, label: e.target.value })}
              onBlur={(e) => savePosting({ label: e.target.value })}
              placeholder="9 Juni 2026"
            />
          </div>
          <div>
            <label className="label">Nama referensi</label>
            <input
              className="input"
              value={posting.ref_nama ?? ''}
              onChange={(e) => setPosting({ ...posting, ref_nama: e.target.value })}
              onBlur={(e) => savePosting({ ref_nama: e.target.value || null })}
              placeholder="Kirana"
            />
          </div>
          <div>
            <label className="label">Tanggal postingan referensi</label>
            <input
              className="input"
              value={posting.ref_tanggal ?? ''}
              onChange={(e) => setPosting({ ...posting, ref_tanggal: e.target.value })}
              onBlur={(e) => savePosting({ ref_tanggal: e.target.value || null })}
              placeholder="9 Juni (untuk dicek manual)"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Link video referensi (TikTok)</label>
            <input
              className="input"
              value={posting.ref_url ?? ''}
              onChange={(e) => setPosting({ ...posting, ref_url: e.target.value })}
              onBlur={(e) => savePosting({ ref_url: e.target.value || null })}
              placeholder="https://www.tiktok.com/@kirana/video/..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Link Google Drive (hasil generate)</label>
            <div className="flex gap-1">
              <input
                className="input"
                value={posting.drive_url ?? ''}
                onChange={(e) => setPosting({ ...posting, drive_url: e.target.value })}
                onBlur={(e) => savePosting({ drive_url: e.target.value || null })}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <button
                type="button"
                onClick={openDrive}
                className="btn-secondary shrink-0 whitespace-nowrap"
                title="Buka Google Drive & salin nama folder"
              >
                Buka Drive
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Tombol “Buka Drive” menyalin nama folder ({posting.label || formatTanggalIndo(posting.tanggal)})
              ke clipboard — tinggal bikin folder, paste namanya, lalu salin link folder ke sini.
            </p>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={posting.status}
              onChange={(e) => savePosting({ status: e.target.value as PostingStatus })}
            >
              <option value="draft">Draft</option>
              <option value="generated">Sudah generate</option>
              <option value="posted">Sudah posting</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Catatan</label>
            <input
              className="input"
              value={posting.catatan ?? ''}
              onChange={(e) => setPosting({ ...posting, catatan: e.target.value })}
              onBlur={(e) => savePosting({ catatan: e.target.value || null })}
              placeholder="Catatan bebas…"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {posting.ref_url && (
            <a
              href={posting.ref_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-sec-700 hover:underline"
            >
              Buka video referensi ↗
            </a>
          )}
          {posting.drive_url && (
            <a
              href={posting.drive_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-sec-700 hover:underline"
            >
              Buka folder Drive ↗
            </a>
          )}
        </div>
      </section>

      {/* Gambar screenshot referensi */}
      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Gambar screenshot</h2>
        <ImageGallery postingId={posting.id} userId={posting.user_id} onCountChange={setImageCount} />
      </section>

      {/* Item produk */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Item produk ({items.length})</h2>
          <button onClick={addItem} disabled={addingItem} className="btn-secondary">
            {addingItem ? 'Menambah…' : '+ Tambah 1 item'}
          </button>
        </div>

        {/* Bulk: tempel banyak link sumber sekaligus */}
        <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3">
          <label className="label">Tempel link sumber sekaligus (1 link per baris)</label>
          <textarea
            className="input min-h-[80px] font-mono text-xs"
            value={sourcePaste}
            onChange={(e) => setSourcePaste(e.target.value)}
            placeholder={'https://shopee.co.id/product/260200399/44553924496\nhttps://shopee.co.id/product/28406065/44658304201'}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {parseBulkLinks(sourcePaste).length} link · nomor, duplikat & short link otomatis
            </span>
            <button
              onClick={addItemsFromSources}
              disabled={addingBulk || !sourcePaste.trim()}
              className="btn-primary"
            >
              {addingBulk ? 'Membuat…' : 'Buat item'}
            </button>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Belum ada item. Tempel link sumber di atas lalu “Buat item”, atau “+ Tambah 1 item”.
            Nomor otomatis lanjut & bisa diedit manual.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedItems.map((it, i) => (
              <ItemRow
                key={it.id}
                item={it}
                index={i}
                presets={presets}
                dup={dupHints[it.id] ?? null}
                isFirst={i === 0}
                isLast={i === sortedItems.length - 1}
                onSave={(patch) => saveItem(it.id, patch)}
                onDelete={() => removeItem(it.id)}
                onMove={(dir) => moveItem(it.id, dir)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bulk link sumber */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">1. Link sumber (untuk Shopee)</h2>
          <CopyButton text={sourceBulk} label="Copy semua" disabled={!sourceBulk} />
        </div>
        <p className="text-xs text-gray-500">
          Link sudah dibersihkan (tanpa <code>?...</code>) & dipisah per baris. Default hanya yang
          <strong> belum punya link affiliate</strong> (produk yang dipakai ulang tidak perlu di-paste lagi).
        </p>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={showAllSource}
            onChange={(e) => setShowAllSource(e.target.checked)}
          />
          Tampilkan semua link sumber (termasuk yang sudah punya affiliate)
        </label>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {sourceBulk || '(tidak ada link untuk di-generate)'}
        </pre>
      </section>

      {/* Paste hasil affiliate */}
      <section className="card space-y-2">
        <h2 className="text-lg font-bold text-gray-900">2. Tempel hasil link affiliate</h2>
        <p className="text-xs text-gray-500">
          Paste link affiliate dari Shopee (boleh dipisah baris baru / spasi / koma). Dipasang
          berurutan ke <strong>item yang ada di bulk copy di atas</strong> ({pasteTargets.length} item
          {showAllSource ? '' : ' yang belum punya affiliate'}).
        </p>
        <textarea
          className="input min-h-[90px] font-mono text-sm"
          value={affiliatePaste}
          onChange={(e) => setAffiliatePaste(e.target.value)}
          placeholder={'https://s.shopee.co.id/aaa\nhttps://s.shopee.co.id/bbb'}
        />
        {/* Preview pemetaan link -> item */}
        {parseBulkLinks(affiliatePaste).length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <p className="mb-1 text-xs font-semibold text-gray-500">Preview pemasangan:</p>
            <ul className="space-y-1">
              {affiliateMapping.map((m, i) => {
                const ok = m.link && m.item
                return (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className={ok ? 'text-green-600' : 'text-amber-500'}>{ok ? '→' : '⚠'}</span>
                    <span className="w-24 shrink-0 text-gray-600">
                      {m.item ? `no ${m.item.my_number} (${m.item.kategori || 'item'})` : '(tak ada item)'}
                    </span>
                    <span className="flex-1 truncate text-gray-400">{m.link ?? '(kurang link)'}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {parseBulkLinks(affiliatePaste).length} link terdeteksi · {pasteTargets.length} item tujuan
          </span>
          <button onClick={applyAffiliate} className="btn-secondary">
            Terapkan ke item
          </button>
        </div>
      </section>

      {/* Caption */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">3. Caption TikTok</h2>
          <CopyButton text={caption} label="Copy caption" />
        </div>
        <div>
          <label className="label">Hashtag</label>
          <textarea
            className="input min-h-[60px]"
            value={effectiveHashtags}
            onChange={(e) => setPosting({ ...posting, caption_hashtags: e.target.value })}
            onBlur={(e) => savePosting({ caption_hashtags: e.target.value })}
          />
        </div>
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
          {caption}
        </pre>
      </section>

      {/* Cek sinkron */}
      <section className="card space-y-2">
        <h2 className="text-lg font-bold text-gray-900">Cek sinkron</h2>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              <span className={c.ok ? 'text-green-600' : 'text-amber-500'}>{c.ok ? '✓' : '⚠'}</span>
              <span className="flex-1 text-gray-700">{c.label}</span>
              {c.detail && <span className="text-xs text-gray-400">{c.detail}</span>}
            </li>
          ))}
        </ul>
      </section>

      {/* Dialog produk duplikat */}
      {dup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Produk ini sudah pernah dipakai</h3>
            <p className="mt-2 text-sm text-gray-600">
              Link produk yang sama sudah ada di{' '}
              <span className="font-semibold">{postingLabels[dup.existing.posting_id] ?? 'postingan lain'}</span>{' '}
              dengan <span className="font-semibold">nomor {dup.existing.my_number}</span>
              {dup.existing.kategori ? ` (${dup.existing.kategori})` : ''}.
            </p>
            {(dup.existing.affiliate_link ?? '').trim() && (
              <p className="mt-2 break-all rounded-lg bg-gray-50 p-2 text-xs text-gray-500">
                Link affiliate lama: {dup.existing.affiliate_link}
              </p>
            )}
            <p className="mt-3 text-sm text-gray-600">
              Pakai ulang nomor &amp; link affiliate yang lama, atau buat baru?
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={reuseExisting} className="btn-primary flex-1">
                Pakai ulang no {dup.existing.my_number}
              </button>
              <button onClick={() => setDup(null)} className="btn-secondary flex-1">
                Tetap buat baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
