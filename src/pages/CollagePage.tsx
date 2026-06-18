import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'

const GAP_ON = 14

type Ratio = { key: string; label: string; w: number; h: number }
const RATIOS: Ratio[] = [
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
const makeSlide = (id: string, layoutKey: string): Slide => ({
  id,
  layoutKey,
  showGap: false,
  slots: layoutOf(layoutKey).cells.map(() => emptySlot()),
  labels: [],
})

function cellPx(c: Cell, W: number, H: number, gap: number): Cell {
  return { x: c.x * W + gap / 2, y: c.y * H + gap / 2, w: c.w * W - gap, h: c.h * H - gap }
}

type DrawOpts = {
  showSel: boolean
  activeCell: number
  activeLabel: string | null
  rectsOut?: Record<string, { x: number; y: number; w: number; h: number }>
}

function drawSlide(ctx: CanvasRenderingContext2D, slide: Slide, ratio: Ratio, opts: DrawOpts) {
  const W = ratio.w
  const H = ratio.h
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
    ctx.lineWidth = Math.max(3, l.size * 0.14)
    ctx.lineJoin = 'round'
    ctx.strokeStyle = l.color === 'white' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'
    ctx.fillStyle = l.color === 'white' ? '#ffffff' : '#111111'
    lines.forEach((ln, li) => {
      const ly = py + li * lineH
      ctx.strokeText(ln, px, ly)
      ctx.fillText(ln, px, ly)
    })
    if (opts.rectsOut) {
      opts.rectsOut[l.id] = {
        x: px - 8,
        y: py - l.size / 2 - 6,
        w: Math.max(maxW, 24) + 16,
        h: lineH * lines.length + 12,
      }
    }
    if (opts.showSel && l.id === opts.activeLabel) {
      const px0 = px - 8
      const py0 = py - l.size / 2 - 6
      ctx.strokeStyle = '#ee4d2d'
      ctx.lineWidth = 3
      ctx.setLineDash([8, 6])
      ctx.strokeRect(px0, py0, Math.max(maxW, 24) + 16, lineH * lines.length + 12)
      ctx.setLineDash([])
    }
  }
}

export default function CollagePage() {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const labelRects = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)
  const idRef = useRef(1)
  const drag = useRef<{ mode: 'cell' | 'label'; id?: string; x: number; y: number } | null>(null)
  const nid = () => String(idRef.current++)

  const [ratioKey, setRatioKey] = useState('3:4')
  const [slides, setSlides] = useState<Slide[]>([makeSlide('s0', 'cols3')])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(0)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [pool, setPool] = useState<PoolImage[]>([])

  const ratio = RATIOS.find((r) => r.key === ratioKey) ?? RATIOS[0]
  const OUT_W = ratio.w
  const OUT_H = ratio.h
  const slide = slides[current]
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
    drawSlide(ctx, slide, ratio, { showSel, activeCell: selected, activeLabel, rectsOut: labelRects.current })
  }

  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, current, ratioKey, selected, activeLabel])

  // ---------- Slide ----------
  function addSlide() {
    const s = makeSlide(nid(), 'full')
    setSlides((prev) => [...prev, s])
    setCurrent(slides.length)
    setSelected(0)
    setActiveLabel(null)
  }
  function duplicateSlide() {
    const copy: Slide = {
      id: nid(),
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
        { id, text: DEFAULT_LABEL_TEXT, x: 0.12, y: 0.5, size: Math.round(OUT_W * 0.05), color: 'white' },
      ],
    }))
    setActiveLabel(id)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }
  function updateLabel(patch: Partial<Label>) {
    if (!activeLabel) return
    patchSlide((s) => ({ ...s, labels: s.labels.map((l) => (l.id === activeLabel ? { ...l, ...patch } : l)) }))
  }
  function deleteLabel() {
    if (!activeLabel) return
    patchSlide((s) => ({ ...s, labels: s.labels.filter((l) => l.id !== activeLabel) }))
    setActiveLabel(null)
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
    const pt = canvasPoint(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    for (let i = slide.labels.length - 1; i >= 0; i--) {
      const lab = slide.labels[i]
      const r = labelRects.current[lab.id]
      if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        // Double-tap pada teks yang sama -> buka keyboard (fokus field). Tap tunggal = pilih + geser.
        const isDouble = lastTap.current?.id === lab.id && e.timeStamp - lastTap.current.t < 350
        lastTap.current = { id: lab.id, t: e.timeStamp }
        setActiveLabel(lab.id)
        if (isDouble) {
          drag.current = null
          setTimeout(() => textareaRef.current?.focus(), 0)
        } else {
          drag.current = { mode: 'label', id: lab.id, x: pt.x, y: pt.y }
        }
        return
      }
    }
    lastTap.current = null
    setActiveLabel(null)
    const idx = layout.cells.findIndex((c) => {
      const px = cellPx(c, OUT_W, OUT_H, slide.showGap ? GAP_ON : 0)
      return pt.x >= px.x && pt.x <= px.x + px.w && pt.y >= px.y && pt.y <= px.y + px.h
    })
    if (idx >= 0) setSelected(idx)
    drag.current = { mode: 'cell', x: pt.x, y: pt.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const pt = canvasPoint(e)
    const dx = pt.x - drag.current.x
    const dy = pt.y - drag.current.y
    drag.current.x = pt.x
    drag.current.y = pt.y
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
  function onPointerUp() {
    drag.current = null
  }

  // ---------- Unduh ----------
  function exportCanvas(s: Slide, name: string): Promise<void> {
    const tmp = document.createElement('canvas')
    tmp.width = OUT_W
    tmp.height = OUT_H
    const ctx = tmp.getContext('2d')!
    drawSlide(ctx, s, ratio, { showSel: false, activeCell: -1, activeLabel: null })
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

      <div>
        <label className="label">Rasio (berlaku semua slide)</label>
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <button key={r.key} onClick={() => setRatioKey(r.key)} className={chip(ratioKey === r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

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

      <canvas
        ref={canvasRef}
        width={OUT_W}
        height={OUT_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="mx-auto block max-h-[55vh] max-w-full touch-none rounded-xl bg-white shadow ring-1 ring-gray-200"
        style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
      />

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
          <label className="label">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
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
              <label className="label">Ukuran</label>
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
