import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  createItem,
  createPosting,
  deleteItem as dbDeleteItem,
  getPosting,
  getSettings,
  listAllItems,
  listItems,
  listPostings,
  reserveFolderNumber,
  reserveNumbers,
  updateItem,
  updatePosting,
} from '../lib/db'
import type { Item, Posting, PostingStatus } from '../lib/types'
import { DEFAULT_HASHTAGS, DEFAULT_KATEGORI, DEFAULT_TITLE } from '../lib/types'
import {
  buildCaption,
  buildSourceBulk,
  computePostingStage,
  computeSyncChecks,
  formatTanggalIndo,
  isPostingSynced,
  itemCode,
  nextItemCode,
  padFolderLabel,
  parseBulkLinks,
  todayISO,
} from '../lib/format'
import {
  canonicalShopeeUrl,
  expandSourceLink,
  findExistingByKey,
  parseShopeeKey,
  resolveAffiliateLinks,
} from '../lib/shopee'
import CopyButton from '../components/CopyButton'
import SyncBadge from '../components/SyncBadge'
import ItemRow from '../components/ItemRow'
import ImageGallery from '../components/ImageGallery'
import BaseImagesPanel from '../components/BaseImagesPanel'
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
  const [applyingAff, setApplyingAff] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [sourcePaste, setSourcePaste] = useState('')
  const [addingBulk, setAddingBulk] = useState(false)
  const [affiliateMode, setAffiliateMode] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [postingLabels, setPostingLabels] = useState<Record<string, string>>({})
  const [showAllSource, setShowAllSource] = useState(false)
  const [dup, setDup] = useState<{ itemId: string; existing: Item } | null>(null)
  const [creatingPosting, setCreatingPosting] = useState(false)
  const [postingNav, setPostingNav] = useState<{ prev: Posting | null; next: Posting | null }>({
    prev: null,
    next: null,
  })

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
      const navPosts = posts.some((x) => x.id === p.id && x.archived_at)
        ? posts
        : posts.filter((x) => !x.archived_at)
      const currentIndex = navPosts.findIndex((x) => x.id === p.id)
      setPostingNav({
        prev: currentIndex > 0 ? navPosts[currentIndex - 1] : null,
        next: currentIndex >= 0 && currentIndex < navPosts.length - 1 ? navPosts[currentIndex + 1] : null,
      })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat postingan', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCreatingPosting(false)
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
  // Kumpulan item dari postingan LAIN + item postingan ini (fresh state),
  // dipakai untuk deteksi produk duplikat berdasarkan link Shopee.
  const dedupPool = useMemo(() => {
    const others = posting ? allItems.filter((i) => i.posting_id !== posting.id) : allItems
    return [...others, ...items]
  }, [allItems, items, posting])

  // Hint per item: apakah produknya sama dengan item lain yang sudah ada?
  const dupHints = useMemo(() => {
    const map: Record<string, { code: string; label: string; consistent: boolean }> = {}
    for (const it of items) {
      const key = parseShopeeKey(it.source_link)
      if (!key) continue
      const match = findExistingByKey(dedupPool, key, it.id)
      if (!match) continue
      map[it.id] = {
        code: itemCode(match),
        label: postingLabels[match.posting_id] ?? 'postingan lain',
        consistent: (match.ref_code ?? '').trim() === (it.ref_code ?? '').trim(),
      }
    }
    return map
  }, [items, dedupPool, postingLabels])
  const caption = useMemo(
    () => buildCaption(items, effectiveHashtags, posting?.catatan ?? ''),
    [items, effectiveHashtags, posting?.catatan],
  )
  const checks = useMemo(
    () => (posting ? computeSyncChecks(posting, items) : []),
    [posting, items],
  )
  const synced = isPostingSynced(checks)

  // ---------- Postingan ----------
  async function createNewPosting() {
    if (!user) return
    setCreatingPosting(true)
    try {
      const p = await createPosting(user.id, {
        tanggal: todayISO(),
        label: padFolderLabel(await reserveFolderNumber(user.id)),
        catatan: DEFAULT_TITLE,
        status: 'draft',
      })
      toast('Postingan baru dibuat')
      navigate(`/posting/${p.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal membuat postingan', 'err')
      setCreatingPosting(false)
    }
  }

  async function savePosting(patch: Partial<Posting>) {
    if (!posting) return
    setPosting({ ...posting, ...patch })
    try {
      await updatePosting(posting.id, patch)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'err')
    }
  }

  // ---------- Item ----------
  async function addItem() {
    if (!posting || !user) return
    setAddingItem(true)
    try {
      const myNumber = await reserveNumbers(user.id, 1)
      const maxUrutan = items.reduce((m, it) => Math.max(m, it.urutan), 0)
      const created = await createItem(user.id, {
        posting_id: posting.id,
        urutan: maxUrutan + 1,
        my_number: myNumber,
        ref_code: nextItemCode(posting.label, items),
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
      // expanded dipakai untuk kunci produk; rawLinks[i] = link asli yang dipaste.
      const expanded = await Promise.all(rawLinks.map((l) => expandSourceLink(l)))
      let urutan = items.reduce((m, it) => Math.max(m, it.urutan), 0) + 1
      const pool = [...dedupPool]
      const created: Item[] = []
      let reusedCount = 0
      for (let i = 0; i < expanded.length; i++) {
        const exp = expanded[i]
        const raw = rawLinks[i]
        const key = parseShopeeKey(exp)
        // Mode affiliate: link yang dipaste = link affiliate-ku; sumber diturunkan dari produk.
        // Mode biasa: link yang dipaste = link sumber.
        const source = affiliateMode ? canonicalShopeeUrl(exp) ?? '' : exp
        let myNumber: number
        let affiliate: string | null = affiliateMode ? raw : null
        let kategori = ''
        let code: string
        const ex = key ? findExistingByKey(pool, key, '') : null
        if (ex) {
          myNumber = ex.my_number
          // Di mode affiliate, pakai link affiliate yang dipaste; kalau tidak, warisi dari produk lama.
          if (!affiliateMode) affiliate = (ex.affiliate_link ?? '').trim() ? ex.affiliate_link : null
          kategori = ex.kategori ?? '' // autofill kategori dari produk yang sudah ada
          code = itemCode(ex) // reuse -> kode ikut produk aslinya (mis. 031c)
          reusedCount++
        } else {
          // Produk baru -> pesan 1 nomor dari counter (tidak terpengaruh penghapusan).
          myNumber = await reserveNumbers(user.id, 1)
          // Kode native berikutnya: {label}{huruf}, lanjut dari item native yang sudah ada + yang baru dibuat.
          code = nextItemCode(posting.label, [...items, ...created])
        }
        const item = await createItem(user.id, {
          posting_id: posting.id,
          urutan,
          my_number: myNumber,
          ref_code: code,
          kategori,
          source_link: source,
          affiliate_link: affiliate,
        })
        urutan++
        created.push(item)
        pool.push(item)
      }
      setItems((prev) => [...prev, ...created])
      setSourcePaste('')
      const modeMsg = affiliateMode ? ' (link affiliate terisi)' : ''
      toast(`${created.length} item dibuat${reusedCount ? `, ${reusedCount} reuse` : ''}${modeMsg}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal membuat item', 'err')
    } finally {
      setAddingBulk(false)
    }
  }

  async function saveItem(itemId: string, patch: Partial<Item>) {
    const before = items.find((i) => i.id === itemId)
    const oldKey = parseShopeeKey(before?.source_link)

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

    // Sebarkan perubahan field produk ke item lain (postingan lain) yang produknya
    // sama (link sumber sama). urutan TIDAK ikut (itu khusus per-postingan).
    const propPatch: Partial<Item> = {}
    for (const f of ['kategori', 'source_link', 'affiliate_link', 'my_number', 'ref_code'] as const) {
      if (f in patch) (propPatch as Record<string, unknown>)[f] = patch[f]
    }
    if (oldKey && Object.keys(propPatch).length > 0) {
      const siblings = dedupPool.filter(
        (i) => i.id !== itemId && parseShopeeKey(i.source_link) === oldKey,
      )
      if (siblings.length > 0) {
        const ids = new Set(siblings.map((s) => s.id))
        try {
          await Promise.all(siblings.map((s) => updateItem(s.id, propPatch)))
          setItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, ...propPatch } : it)))
          setAllItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, ...propPatch } : it)))
          toast(`Ikut diterapkan ke ${siblings.length} item produk yang sama`)
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Gagal menyebarkan ke produk sama', 'err')
        }
      }
      return // item sudah punya identitas produk -> tidak perlu dialog reuse
    }

    // Item baru dapat link sumber (sebelumnya belum ada): tawarkan pakai ulang produk yang ada.
    if ('source_link' in patch) {
      const key = parseShopeeKey(patch.source_link as string | null)
      if (key) {
        const existing = findExistingByKey(dedupPool, key, itemId)
        if (existing) {
          const current = items.find((i) => i.id === itemId)
          // Autofill kategori dari produk yang sudah ada kalau item ini masih kosong.
          if (!(current?.kategori ?? '').trim() && (existing.kategori ?? '').trim()) {
            setItems((prev) =>
              prev.map((it) => (it.id === itemId ? { ...it, kategori: existing.kategori } : it)),
            )
            updateItem(itemId, { kategori: existing.kategori }).catch(() => {})
          }
          const codeDiffers = (existing.ref_code ?? '').trim() !== (current?.ref_code ?? '').trim()
          const existingAff = (existing.affiliate_link ?? '').trim()
          const affDiffers = Boolean(existingAff) && existingAff !== (current?.affiliate_link ?? '')
          if (codeDiffers || affDiffers) setDup({ itemId, existing })
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
    if ((dup.existing.ref_code ?? '').trim()) patch.ref_code = dup.existing.ref_code
    if ((dup.existing.affiliate_link ?? '').trim()) patch.affiliate_link = dup.existing.affiliate_link
    if ((dup.existing.kategori ?? '').trim()) patch.kategori = dup.existing.kategori
    saveItem(dup.itemId, patch)
    toast(`Pakai ulang ${itemCode(dup.existing)}`)
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
    setApplyingAff(true)
    try {
      // Cocokkan berdasarkan PRODUK (kunci Shopee), bukan urutan.
      const { byKey } = await resolveAffiliateLinks(links)
      const assign = new Map<string, string>() // itemId -> link affiliate
      const usedLinks = new Set<string>()
      let matched = 0
      for (const it of targets) {
        const key = parseShopeeKey(it.source_link)
        if (key && byKey.has(key)) {
          const link = byKey.get(key)!
          assign.set(it.id, link)
          usedLinks.add(link)
          matched++
        }
      }
      // Fallback: sisa link (yang produknya tak ketemu) dipasang berurutan ke sisa item.
      const leftoverLinks = links.map((l) => l.trim()).filter((l) => l && !usedLinks.has(l))
      const leftoverTargets = targets.filter((it) => !assign.has(it.id))
      const m = Math.min(leftoverLinks.length, leftoverTargets.length)
      for (let i = 0; i < m; i++) assign.set(leftoverTargets[i].id, leftoverLinks[i])

      if (assign.size === 0) {
        toast('Tidak ada link yang cocok ke item di postingan ini', 'err')
        return
      }
      await Promise.all([...assign].map(([id, link]) => updateItem(id, { affiliate_link: link })))
      setItems((prev) =>
        prev.map((it) => (assign.has(it.id) ? { ...it, affiliate_link: assign.get(it.id)! } : it)),
      )
      setAffiliatePaste('')
      const fallback = assign.size - matched
      const parts = [`${assign.size} link terpasang`]
      if (matched) parts.push(`${matched} cocok produk`)
      if (fallback) parts.push(`${fallback} urut`)
      const leftover = links.length - assign.size
      const msg = parts.join(' · ') + (leftover > 0 ? ` · ${leftover} link tak terpakai` : '')
      toast(msg, leftover > 0 ? 'err' : 'ok')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menerapkan link', 'err')
    } finally {
      setApplyingAff(false)
    }
  }

  if (loading) return <p className="py-12 text-center text-gray-400">Memuat…</p>
  if (!posting) return <p className="py-12 text-center text-gray-400">Postingan tidak ditemukan.</p>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/')} className="btn-ghost">
            ← Kembali
          </button>
          <button
            onClick={() => postingNav.prev && navigate(`/posting/${postingNav.prev.id}`)}
            disabled={!postingNav.prev}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            title={postingNav.prev ? postingNav.prev.label || formatTanggalIndo(postingNav.prev.tanggal) : ''}
          >
            ← Prev post
          </button>
          <button
            onClick={() => postingNav.next && navigate(`/posting/${postingNav.next.id}`)}
            disabled={!postingNav.next}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            title={postingNav.next ? postingNav.next.label || formatTanggalIndo(postingNav.next.tanggal) : ''}
          >
            Next post →
          </button>
          <button onClick={createNewPosting} disabled={creatingPosting} className="btn-primary">
            {creatingPosting ? 'Membuat…' : '+ Postingan baru'}
          </button>
        </div>
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
            <label className="label">Label folder</label>
            <input
              className="input"
              value={posting.label ?? ''}
              onChange={(e) => setPosting({ ...posting, label: e.target.value })}
              onBlur={(e) => savePosting({ label: e.target.value })}
              placeholder="001"
            />
            <p className="mt-1 text-xs text-gray-400">Auto-increment (001, 002, …), bisa diedit.</p>
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
            <label className="label">Title (baris pembuka caption)</label>
            <textarea
              className="input min-h-[70px]"
              value={posting.catatan ?? ''}
              onChange={(e) => setPosting({ ...posting, catatan: e.target.value })}
              onBlur={(e) => savePosting({ catatan: e.target.value || null })}
              placeholder="mis. Pashmina Oval Instan udah ada magnet super rekat… By @dimiwear.id"
            />
            <p className="mt-1 text-xs text-gray-400">
              Otomatis jadi baris paling atas caption, di atas “Outfit yang aku pake”.
            </p>
          </div>
        </div>
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
      </section>

      {/* Item produk */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Item produk ({items.length})</h2>
          <button onClick={addItem} disabled={addingItem} className="btn-secondary">
            {addingItem ? 'Menambah…' : '+ Tambah 1 item'}
          </button>
        </div>

        {/* Bulk: tempel banyak link sekaligus */}
        <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3">
          <label className="label">
            {affiliateMode
              ? 'Tempel link affiliate pribadi sekaligus (1 link per baris)'
              : 'Tempel link sumber sekaligus (1 link per baris)'}
          </label>
          <textarea
            className="input min-h-[80px] font-mono text-xs"
            value={sourcePaste}
            onChange={(e) => setSourcePaste(e.target.value)}
            placeholder={'https://shopee.co.id/product/260200399/44553924496\nhttps://shopee.co.id/product/28406065/44658304201'}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={affiliateMode}
              onChange={(e) => setAffiliateMode(e.target.checked)}
            />
            Dari Link Affiliate Pribadi (link affiliate langsung terisi dari yang dipaste)
          </label>
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

      {/* Gambar dasar untuk ganti outfit (RunningHub) */}
      <BaseImagesPanel />

      {/* Gambar screenshot referensi */}
      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Gambar screenshot</h2>
        <ImageGallery postingId={posting.id} userId={posting.user_id} onCountChange={setImageCount} />
      </section>

      {/* Link Google Drive (hasil generate) */}
      <section className="card space-y-2">
        <h2 className="text-lg font-bold text-gray-900">Link Google Drive (hasil generate)</h2>
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
        <p className="text-xs text-gray-400">
          Tombol “Buka Drive” menyalin nama folder ({posting.label || formatTanggalIndo(posting.tanggal)})
          ke clipboard — tinggal bikin folder, paste namanya, lalu salin link folder ke sini.
        </p>
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
          Paste link affiliate dari Shopee (boleh dipisah baris baru / spasi / koma, <strong>urutan
          bebas</strong>). Dicocokkan otomatis ke <strong>produk yang sama</strong> di postingan ini
          ({pasteTargets.length} item{showAllSource ? '' : ' yang belum punya affiliate'}). Link yang
          gagal dikenali dipasang berurutan sebagai cadangan.
        </p>
        <textarea
          className="input min-h-[90px] font-mono text-sm"
          value={affiliatePaste}
          onChange={(e) => setAffiliatePaste(e.target.value)}
          placeholder={'https://s.shopee.co.id/aaa\nhttps://s.shopee.co.id/bbb'}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {parseBulkLinks(affiliatePaste).length} link terdeteksi · {pasteTargets.length} item tujuan
          </span>
          <button onClick={applyAffiliate} disabled={applyingAff} className="btn-secondary disabled:opacity-50">
            {applyingAff ? 'Mencocokkan…' : 'Terapkan ke item'}
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
              dengan <span className="font-semibold">kode {itemCode(dup.existing)}</span>
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
                Pakai ulang {itemCode(dup.existing)}
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
