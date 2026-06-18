import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { humanizeCanvas } from '../lib/humanize'

const GAP_ON = 14
const MAX_ZOOM = 4

type Ratio = { key: string; label: string; w: number; h: number }
const RATIOS: Ratio[] = [
  { key: 'auto', label: 'Asli', w: 0, h: 0 }, // dihitung dari gambar
  { key: '3:4', label: '3:4', w: 900, h: 1200 },
  { key: '1:1', label: '1:1', w: 1080, h: 1080 },
  { key: '9:16', label: '9:16', w: 900, h: 1600 },
  { key: '4:6', label: '4:6', w: 800, h: 1200 },
]

type Cell = { x: number; y: number; w: number; h: number }
type Layout = { key: string; label: string; cells: Cell[] }
const LAYOUTS: Layout[] = [
  { key: 'full', label: '1 gambar', cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  { key: 'rows2', label: '2 baris', cells: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }] },
  { key: 'cols2', label: '2 kolom', cells: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  {
    key: 'rows3',
    label: '3 baris',
    cells: [{ x: 0, y: 0, w: 1, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 1, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 1, h: 1 / 3 }],
  },
  {
    key: 'cols3',
    label: '3 kolom',
    cells: [{ x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }],
  },
  {
    key: 'top1bottom2',
    label: '1 atas, 2 bawah',
    cells: [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.6, w: 0.5, h: 0.4 }],
  },
  {
    key: 'top2bottom1',
    label: '2 atas, 1 bawah',
    cells: [{ x: 0, y: 0, w: 0.5, h: 0.4 }, { x: 0.5, y: 0, w: 0.5, h: 0.4 }, { x: 0, y: 0.4, w: 1, h: 0.6 }],
  },
  {
    key: 'grid4',
    label: '4 kotak',
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
]

interface Slot {
  img: HTMLImageElement | null
  scale: number
  offsetX: number
  offsetY: number
}
const emptySlot = (): Slot => ({ img: null, scale: 1, offsetX: 0, offsetY: 0 })

interface Label {
  id: string
  text: string
  x: number
  y: number
  size: number
  color: 'white' | 'black'
}
const DEFAULT_LABEL_TEXT = '•-----A '

interface Slide {
  id: string
  ratioKey: string
  layoutKey: string
  showGap: boolean
  slots: Slot[]
  labels: Label[]
}
interface PoolImage {
  id: string
  img: HTMLImageElement
  src: string
}

const layoutOf = (key: string) => LAYOUTS.find((l) => l.key === key) ?? LAYOUTS[0]
const makeSlide = (id: string, layoutKey: string, ratioKey: string): Slide => ({
  id,
  ratioKey,
  layoutKey,
  showGap: false,
  slots: layoutOf(layoutKey).cells.map(() => emptySlot()),
  labels: [],
})

// Dimensi output slide. "auto" -> ikut rasio gambar pertama (sisi terpanjang ~1200).
function slideDims(slide: Slide): { w: number; h: number } {
  if (slide.ratioKey === 'auto') {
    const img = slide.slots.find((s) => s.img)?.img
    if (img) {
      const scale = 1200 / Math.max(img.naturalWidth, img.naturalHeight)
      return { w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) }
    }
    return { w: 900, h: 1200 }
  }
  const r = RATIOS.find((x) => x.key === slide.ratioKey)
  return r && r.w ? { w: r.w, h: r.h } : { w: 900, h: 1200 }
}

function cellPx(c: Cell, W: number, H: number, gap: number): Cell {
  return { x: c.x * W + gap / 2, y: c.y * H + gap / 2, w: c.w * W - gap, h: c.h * H - gap }
}

type DrawOpts = {
  showSel: boolean
  activeCell: number
  activeLabel: string | null
  rectsOut?: Record<string, { x: number; y: number; w: number; h: number }>
  hideLabelId?: string | null
}

function drawSlide(ctx: CanvasRenderingContext2D, slide: Slide, dims: { w: number; h: number }, opts: DrawOpts) {
  const W = dims.w
  const H = dims.h
  const gap = slide.showGap ? GAP_ON : 0
  const layout = layoutOf(slide.layoutKey)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  layout.cells.forEach((c, i) => {
    const px = cellPx(c, W, H, gap)
    const slot = slide.slots[i]
    ctx.save()
    ctx.beginPath()
    ctx.rect(px.x, px.y, px.w, px.h)
    ctx.clip()
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(px.x, px.y, px.w, px.h)
    if (slot?.img) {
      const base = Math.max(px.w / slot.img.naturalWidth, px.h / slot.img.naturalHeight)
      const s = base * slot.scale
      const dw = slot.img.naturalWidth * s
      const dh = slot.img.naturalHeight * s
      ctx.drawImage(slot.img, px.x + (px.w - dw) / 2 + slot.offsetX, px.y + (px.h - dh) / 2 + slot.offsetY, dw, dh)
    } else {
      ctx.fillStyle = '#9ca3af'
      ctx.font = '40px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), px.x + px.w / 2, px.y + px.h / 2)
    }
    ctx.restore()
    if (opts.showSel && opts.activeLabel === null && i === opts.activeCell) {
      ctx.strokeStyle = '#ee4d2d'
      ctx.lineWidth = 6
      ctx.strokeRect(px.x + 3, px.y + 3, px.w - 6, px.h - 6)
    }
  })

  if (opts.rectsOut) for (const k of Object.keys(opts.rectsOut)) delete opts.rectsOut[k]
  for (const l of slide.labels) {
    const px = l.x * W
    const py = l.y * H
    ctx.font = `bold ${l.size}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const lines = l.text.split('\n')
    const lineH = l.size * 1.2
    let maxW = 0
    lines.forEach((ln) => (maxW = Math.max(maxW, ctx.measureText(ln).width)))
    const rect = {
      x: px - 8,
      y: py - l.size / 2 - 6,
      w: Math.max(maxW, 24) + 16,
      h: lineH * lines.length + 12,
    }
    // Selalu catat kotak hit-test (walau label disembunyikan karena jadi overlay).
    if (opts.rectsOut) opts.rectsOut[l.id] = rect
    // Garis fokus saat label dipilih (digambar walau teks disembunyikan).
    if (opts.showSel && l.id === opts.activeLabel) {
      ctx.save()
      ctx.strokeStyle = '#ee4d2d'
      ctx.lineWidth = 3
      ctx.setLineDash([8, 6])
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
      ctx.restore()
    }
    if (l.id === opts.hideLabelId) continue // jangan gambar teksnya (dirender sebagai overlay)
    ctx.lineWidth = Math.max(3, l.size * 0.14)
    ctx.lineJoin = 'round'
    ctx.strokeStyle = l.color === 'white' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'
    ctx.fillStyle = l.color === 'white' ? '#ffffff' : '#111111'
    lines.forEach((ln, li) => {
      const ly = py + li * lineH
      ctx.strokeText(ln, px, ly)
      ctx.fillText(ln, px, ly)
    })
  }
}

export default function CollagePage() {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const labelRects = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inlineRef = useRef<HTMLTextAreaElement>(null)
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const moveDrag = useRef<{ x: number; y: number } | null>(null)
  const idRef = useRef(1)
  const [editing, setEditing] = useState(false)
  const [dispW, setDispW] = useState(0)
  const drag = useRef<{
    mode: 'cell' | 'label'
    id?: string
    x: number
    y: number
    sx: number
    sy: number
    moved: boolean
    wasActive?: boolean
    cellEmpty?: boolean
  } | null>(null)
  const nid = () => String(idRef.current++)

  const [slides, setSlides] = useState<Slide[]>([makeSlide('s0', 'cols3', '3:4')])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(0)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [pool, setPool] = useState<PoolImage[]>([])
  const [humanizer, setHumanizer] = useState(false)

  const slide = slides[current]
  const dims = slideDims(slide)
  const OUT_W = dims.w
  const OUT_H = dims.h
  const layout = layoutOf(slide.layoutKey)
  const activeLabelObj = slide.labels.find((l) => l.id === activeLabel) ?? null

  function patchSlide(updater: (s: Slide) => Slide) {
    setSlides((prev) => prev.map((s, i) => (i === current ? updater(s) : s)))
  }

  function draw(showSel = true) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawSlide(ctx, slide, dims, {
      showSel,
      activeCell: selected,
      activeLabel,
      rectsOut: labelRects.current,
      // Label aktif digambar sebagai overlay teks; sembunyikan dari canvas.
      hideLabelId: dispW > 0 ? activeLabel : null,
    })
  }

  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, current, selected, activeLabel, dispW])

  // Ukuran tampilan canvas (untuk posisikan editor teks inline).
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setDispW(el.clientWidth))
    ro.observe(el)
    setDispW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Fokus ke editor inline + taruh kursor di akhir teks (biar langsung lanjut ketik).
  function focusInlineEnd() {
    const el = inlineRef.current
    if (!el) return
    el.focus()
    const len = el.value.length
    try {
      el.setSelectionRange(len, len)
    } catch {
      /* abaikan */
    }
  }
  useEffect(() => {
    if (editing) setTimeout(focusInlineEnd, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, activeLabel])

  // ---------- Slide ----------
  function addSlide() {
    const s = makeSlide(nid(), 'full', 'auto')
    setSlides((prev) => [...prev, s])
    setCurrent(slides.length)
    setSelected(0)
    setActiveLabel(null)
  }
  function duplicateSlide() {
    const copy: Slide = {
      id: nid(),
      ratioKey: slide.ratioKey,
      layoutKey: slide.layoutKey,
      showGap: slide.showGap,
      slots: slide.slots.map((s) => ({ ...s })),
      labels: slide.labels.map((l) => ({ ...l, id: nid() })),
    }
    setSlides((prev) => [...prev.slice(0, current + 1), copy, ...prev.slice(current + 1)])
    setCurrent(current + 1)
    setActiveLabel(null)
  }
  function deleteSlide() {
    if (slides.length === 1) {
      toast('Minimal 1 slide', 'err')
      return
    }
    setSlides((prev) => prev.filter((_, i) => i !== current))
    setCurrent((c) => Math.max(0, c - 1))
    setSelected(0)
    setActiveLabel(null)
  }
  function switchSlide(i: number) {
    setCurrent(i)
    setSelected(0)
    setActiveLabel(null)
    setEditing(false)
  }
  function setLayoutKey(key: string) {
    patchSlide((s) => {
      const n = layoutOf(key).cells.length
      const slots = s.slots.slice(0, n)
      while (slots.length < n) slots.push(emptySlot())
      return { ...s, layoutKey: key, slots }
    })
    setSelected((sel) => Math.min(sel, layoutOf(key).cells.length - 1))
    setActiveLabel(null)
  }
  function setShowGap(v: boolean) {
    patchSlide((s) => ({ ...s, showGap: v }))
  }
  function setRatio(key: string) {
    patchSlide((s) => ({ ...s, ratioKey: key }))
  }

  // ---------- Gambar ----------
  function assignImage(img: HTMLImageElement) {
    if (selected < 0) return
    patchSlide((s) => ({
      ...s,
      slots: s.slots.map((sl, i) => (i === selected ? { img, scale: 1, offsetX: 0, offsetY: 0 } : sl)),
    }))
  }
  function onFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPool((prev) => [...prev, { id: nid(), img, src: url }])
      assignImage(img)
    }
    img.onerror = () => toast('Gagal memuat gambar', 'err')
    img.src = url
  }
  function setScale(v: number) {
    patchSlide((s) => ({ ...s, slots: s.slots.map((sl, i) => (i === selected ? { ...sl, scale: v } : sl)) }))
  }
  function resetSlot() {
    patchSlide((s) => ({
      ...s,
      slots: s.slots.map((sl, i) => (i === selected ? { ...sl, scale: 1, offsetX: 0, offsetY: 0 } : sl)),
    }))
  }

  // ---------- Teks ----------
  function addLabel() {
    const id = nid()
    patchSlide((s) => ({
      ...s,
      labels: [
        ...s.labels,
        { id, text: DEFAULT_LABEL_TEXT, x: 0.12, y: 0.5, size: 36, color: 'white' },
      ],
    }))
    setActiveLabel(id)
    setEditing(true)
    // Scroll ke gambar supaya teks baru langsung terlihat (tombol tambah ada di bawah).
    setTimeout(() => canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }
  function updateLabel(patch: Partial<Label>) {
    if (!activeLabel) return
    patchSlide((s) => ({ ...s, labels: s.labels.map((l) => (l.id === activeLabel ? { ...l, ...patch } : l)) }))
  }
  function deleteLabel() {
    if (!activeLabel) return
    patchSlide((s) => ({ ...s, labels: s.labels.filter((l) => l.id !== activeLabel) }))
    setActiveLabel(null)
    setEditing(false)
  }
  function duplicateLabel() {
    if (!activeLabelObj) return
    const id = nid()
    const src = activeLabelObj
    patchSlide((s) => ({ ...s, labels: [...s.labels, { ...src, id, y: Math.min(0.95, src.y + 0.06) }] }))
    setActiveLabel(id)
    setEditing(false)
  }
  // Geser label via handle panah (pojok kiri atas).
  function moveHandleDown(e: React.PointerEvent) {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    moveDrag.current = { x: e.clientX, y: e.clientY }
  }
  function moveHandleMove(e: React.PointerEvent) {
    if (!moveDrag.current || !activeLabel || dispW <= 0) return
    const dispH = (dispW * OUT_H) / OUT_W
    const dx = e.clientX - moveDrag.current.x
    const dy = e.clientY - moveDrag.current.y
    moveDrag.current = { x: e.clientX, y: e.clientY }
    patchSlide((s) => ({
      ...s,
      labels: s.labels.map((l) =>
        l.id === activeLabel ? { ...l, x: l.x + dx / dispW, y: l.y + dy / dispH } : l,
      ),
    }))
  }
  function moveHandleUp() {
    moveDrag.current = null
  }

  // Ukur kotak label (koordinat canvas) untuk posisikan tombol aksi.
  function measureLabelRect(l: Label) {
    if (!measureCtx.current) measureCtx.current = document.createElement('canvas').getContext('2d')
    const ctx = measureCtx.current!
    ctx.font = `bold ${l.size}px sans-serif`
    const lines = l.text.split('\n')
    const lineH = l.size * 1.2
    let maxW = 0
    lines.forEach((ln) => (maxW = Math.max(maxW, ctx.measureText(ln).width)))
    return { x: l.x * OUT_W - 8, y: l.y * OUT_H - l.size / 2 - 6, w: Math.max(maxW, 24) + 16, h: lineH * lines.length + 12 }
  }

  // ---------- Pointer ----------
  function canvasPoint(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * OUT_W,
      y: ((e.clientY - rect.top) / rect.height) * OUT_H,
    }
  }
  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    // Dua jari -> pinch zoom gambar sel terpilih.
    if (pointers.current.size >= 2) {
      if (slide.slots[selected]?.img) {
        const pts = [...pointers.current.values()]
        pinch.current = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          scale: slide.slots[selected].scale,
        }
      }
      drag.current = null
      return
    }
    const pt = canvasPoint(e)
    for (let i = slide.labels.length - 1; i >= 0; i--) {
      const lab = slide.labels[i]
      const r = labelRects.current[lab.id]
      if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        const wasActive = activeLabel === lab.id
        setActiveLabel(lab.id)
        if (!wasActive) setEditing(false) // tap pertama: pilih dulu
        drag.current = { mode: 'label', id: lab.id, x: pt.x, y: pt.y, sx: pt.x, sy: pt.y, moved: false, wasActive }
        return
      }
    }
    setActiveLabel(null)
    setEditing(false)
    const idx = layout.cells.findIndex((c) => {
      const px = cellPx(c, OUT_W, OUT_H, slide.showGap ? GAP_ON : 0)
      return pt.x >= px.x && pt.x <= px.x + px.w && pt.y >= px.y && pt.y <= px.y + px.h
    })
    if (idx >= 0) setSelected(idx)
    const cellEmpty = idx >= 0 && !slide.slots[idx]?.img
    drag.current = { mode: 'cell', x: pt.x, y: pt.y, sx: pt.x, sy: pt.y, moved: false, cellEmpty }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const ns = Math.min(MAX_ZOOM, Math.max(1, (pinch.current.scale * dist) / pinch.current.dist))
      setScale(ns)
      return
    }
    if (!drag.current) return
    const pt = canvasPoint(e)
    const dx = pt.x - drag.current.x
    const dy = pt.y - drag.current.y
    drag.current.x = pt.x
    drag.current.y = pt.y
    if (Math.abs(pt.x - drag.current.sx) + Math.abs(pt.y - drag.current.sy) > 6) drag.current.moved = true
    if (drag.current.mode === 'label') {
      const id = drag.current.id
      patchSlide((s) => ({
        ...s,
        labels: s.labels.map((l) => (l.id === id ? { ...l, x: l.x + dx / OUT_W, y: l.y + dy / OUT_H } : l)),
      }))
    } else if (slide.slots[selected]?.img) {
      patchSlide((s) => ({
        ...s,
        slots: s.slots.map((sl, i) =>
          i === selected ? { ...sl, offsetX: sl.offsetX + dx, offsetY: sl.offsetY + dy } : sl,
        ),
      }))
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const d = drag.current
    drag.current = null
    // Tap (tanpa geser) pada teks yang sudah terpilih -> mulai edit + buka keyboard (dalam gesture).
    if (d && d.mode === 'label' && !d.moved && d.wasActive) {
      setEditing(true)
      focusInlineEnd()
    }
    // Tap pada sel KOSONG -> langsung buka pilih gambar.
    if (d && d.mode === 'cell' && !d.moved && d.cellEmpty) {
      fileRef.current?.click()
    }
  }

  // ---------- Unduh ----------
  function exportCanvas(s: Slide, name: string): Promise<void> {
    const d = slideDims(s)
    const tmp = document.createElement('canvas')
    tmp.width = d.w
    tmp.height = d.h
    const ctx = tmp.getContext('2d')!
    drawSlide(ctx, s, d, { showSel: false, activeCell: -1, activeLabel: null })
    if (humanizer) humanizeCanvas(ctx, d.w, d.h) // grain + color jitter + scrub metadata (via re-encode)
    return new Promise((resolve) => {
      tmp.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = name
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
          }
          resolve()
        },
        'image/jpeg',
        0.92,
      )
    })
  }
  async function downloadCurrent() {
    await exportCanvas(slide, `slide-${current + 1}.jpg`)
    toast('Slide diunduh')
  }
  async function downloadAll() {
    for (let i = 0; i < slides.length; i++) {
      await exportCanvas(slides[i], `slide-${i + 1}.jpg`)
      await new Promise((r) => setTimeout(r, 350)) // jeda agar browser tidak blokir multi-unduh
    }
    toast(`${slides.length} slide diunduh`)
  }

  const chip = (active: boolean) =>
    'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
    (active ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Collage / Slide</h1>
      <p className="text-sm text-gray-500">
        Buat beberapa slide untuk 1 carousel. Tiap slide bisa collage atau 1 gambar + teks. Gambar yang
        sudah dipakai bisa dipakai ulang di slide lain. Lalu unduh semua.
      </p>

      {/* Slide tabs */}
      <div>
        <label className="label">Slide</label>
        <div className="flex flex-wrap items-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => switchSlide(i)}
              className={
                'h-8 w-8 rounded-md text-sm font-bold ' +
                (i === current ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600')
              }
            >
              {i + 1}
            </button>
          ))}
          <button onClick={addSlide} className="btn-ghost text-sm">+ Slide</button>
          <button onClick={duplicateSlide} className="btn-ghost text-sm">Duplikat</button>
          <button onClick={deleteSlide} className="btn-ghost text-sm text-red-600">Hapus slide</button>
        </div>
      </div>

      <div>
        <label className="label">Rasio slide {current + 1}</label>
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <button key={r.key} onClick={() => setRatio(r.key)} className={chip(slide.ratioKey === r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Layout slide {current + 1}</label>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((l) => (
            <button key={l.key} onClick={() => setLayoutKey(l.key)} className={chip(slide.layoutKey === l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={slide.showGap} onChange={(e) => setShowGap(e.target.checked)} />
        Garis pemisah (jarak putih antar gambar)
      </label>

      <div className="relative mx-auto w-fit max-w-full">
        <canvas
          ref={canvasRef}
          width={OUT_W}
          height={OUT_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block max-h-[55vh] max-w-full touch-none rounded-xl bg-white shadow ring-1 ring-gray-200"
          style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
        />
        {activeLabelObj &&
          dispW > 0 &&
          (() => {
            const dispH = (dispW * OUT_H) / OUT_W
            const fontPx = (activeLabelObj.size * dispW) / OUT_W
            const leftPx = activeLabelObj.x * dispW
            const topPx = activeLabelObj.y * dispH - fontPx * 0.6
            const lines = activeLabelObj.text.split('\n').length || 1
            const scale = dispW / OUT_W
            const r = measureLabelRect(activeLabelObj)
            const rx = r.x * scale
            const ry = r.y * scale
            const rw = r.w * scale
            const rh = r.h * scale
            return (
              <>
                <textarea
                  ref={inlineRef}
                  value={activeLabelObj.text}
                  onChange={(e) => updateLabel({ text: e.target.value })}
                  onFocus={() => setEditing(true)}
                  onBlur={() => setEditing(false)}
                  spellCheck={false}
                  style={{
                    position: 'absolute',
                    left: leftPx,
                    top: topPx,
                    width: Math.max(40, dispW - leftPx),
                    height: lines * fontPx * 1.2 + 6,
                    font: `bold ${fontPx}px sans-serif`,
                    lineHeight: 1.2,
                    color: activeLabelObj.color === 'white' ? '#ffffff' : '#111111',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    padding: 0,
                    margin: 0,
                    whiteSpace: 'pre',
                    overflow: 'hidden',
                    pointerEvents: editing ? 'auto' : 'none',
                    caretColor: activeLabelObj.color === 'white' ? '#ffffff' : '#111111',
                    textShadow:
                      activeLabelObj.color === 'white'
                        ? '0 0 3px rgba(0,0,0,.7), 0 0 2px rgba(0,0,0,.7)'
                        : '0 0 3px rgba(255,255,255,.85)',
                  }}
                />
                {/* Handle geser (atas-tengah, lebih jauh dari border) */}
                <button
                  onPointerDown={moveHandleDown}
                  onPointerMove={moveHandleMove}
                  onPointerUp={moveHandleUp}
                  onPointerCancel={moveHandleUp}
                  className="absolute z-10 grid h-6 w-6 cursor-move touch-none place-items-center rounded-full bg-white text-gray-700 shadow ring-1 ring-gray-200"
                  style={{ left: rx + rw / 2 - 12, top: Math.max(0, ry - 24 - 20) }}
                  title="Geser teks"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 9 2 12 5 15" />
                    <polyline points="9 5 12 2 15 5" />
                    <polyline points="15 19 12 22 9 19" />
                    <polyline points="19 9 22 12 19 15" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <line x1="12" y1="2" x2="12" y2="22" />
                  </svg>
                </button>
                {/* Hapus (pojok kanan ATAS, di luar border) */}
                <button
                  onClick={deleteLabel}
                  className="absolute z-10 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold text-red-600 shadow ring-1 ring-gray-200"
                  style={{ left: Math.min(dispW - 24, rx + rw + 6), top: Math.max(0, ry - 30) }}
                  title="Hapus teks"
                >
                  ✕
                </button>
                {/* Duplikat (pojok kanan BAWAH, di luar border) */}
                <button
                  onClick={duplicateLabel}
                  className="absolute z-10 grid h-6 w-6 place-items-center rounded-full bg-white text-sec-700 shadow ring-1 ring-gray-200"
                  style={{ left: Math.min(dispW - 24, rx + rw + 6), top: ry + rh + 6 }}
                  title="Duplikat teks"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </>
            )
          })()}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {/* Kontrol sel + pool gambar */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Sel:</span>
          {layout.cells.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={
                'h-7 w-7 rounded-md text-xs font-bold ' +
                (selected === i ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600')
              }
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-secondary" disabled={selected < 0}>
            Upload gambar
          </button>
          <button onClick={resetSlot} className="btn-ghost" disabled={!slide.slots[selected]?.img}>
            Reset posisi
          </button>
        </div>
        {pool.length > 0 && (
          <div>
            <label className="label">Pakai gambar yang sudah ada (tap)</label>
            <div className="flex flex-wrap gap-2">
              {pool.map((p) => (
                <img
                  key={p.id}
                  src={p.src}
                  alt=""
                  onClick={() => assignImage(p.img)}
                  className="h-12 w-12 cursor-pointer rounded-md object-cover ring-1 ring-gray-200 hover:ring-brand-400"
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="label">
            Zoom {((slide.slots[selected]?.scale ?? 1)).toFixed(1)}× (cubit 2 jari di gambar juga bisa)
          </label>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={slide.slots[selected]?.scale ?? 1}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={!slide.slots[selected]?.img}
            className="w-full accent-brand-600"
          />
        </div>
      </div>

      {/* Teks */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Teks ({slide.labels.length})</h2>
          <button onClick={addLabel} className="btn-secondary">+ Tambah teks</button>
        </div>
        <p className="text-xs text-gray-400">
          Default <code>•-----A </code> untuk penunjuk nomor, atau ganti untuk judul cover. Tap teks di
          gambar untuk pilih lalu geser.
        </p>
        {activeLabelObj ? (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              className="input min-h-[60px]"
              value={activeLabelObj.text}
              onChange={(e) => updateLabel({ text: e.target.value })}
              placeholder={'•-----A 120  atau  ootd kampus\n>>>>'}
            />
            <div>
              <label className="label">Ukuran font: {Math.round(activeLabelObj.size)} px</label>
              <input
                type="range"
                min={Math.round(OUT_W * 0.025)}
                max={Math.round(OUT_W * 0.18)}
                value={activeLabelObj.size}
                onChange={(e) => updateLabel({ size: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="label !mb-0">Warna:</span>
              <button onClick={() => updateLabel({ color: 'white' })} className={chip(activeLabelObj.color === 'white')}>
                Putih
              </button>
              <button onClick={() => updateLabel({ color: 'black' })} className={chip(activeLabelObj.color === 'black')}>
                Hitam
              </button>
              <button onClick={deleteLabel} className="btn-ghost ml-auto text-red-600">Hapus</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Belum ada teks dipilih. Tambah atau tap teks di gambar.</p>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={humanizer}
          onChange={(e) => setHumanizer(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-semibold">Humanizer</span> — saat unduh, tambahkan grain + color jitter
          halus & buang metadata untuk mengurangi fingerprint AI.{' '}
          <span className="text-gray-400">Tiap unduh hasilnya sedikit berbeda.</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button onClick={downloadCurrent} className="btn-secondary flex-1">
          Unduh slide ini
        </button>
        <button onClick={downloadAll} className="btn-primary flex-1">
          Unduh semua ({slides.length})
        </button>
      </div>
    </div>
  )
}
