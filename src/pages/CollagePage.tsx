import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'

const GAP = 10 // jarak antar sel (px di canvas)

type Ratio = { key: string; label: string; w: number; h: number }
const RATIOS: Ratio[] = [
  { key: '3:4', label: '3:4', w: 900, h: 1200 },
  { key: '1:1', label: '1:1', w: 1080, h: 1080 },
  { key: '9:16', label: '9:16', w: 900, h: 1600 },
  { key: '4:6', label: '4:6', w: 800, h: 1200 },
]

type Cell = { x: number; y: number; w: number; h: number } // fraksi 0..1
type Layout = { key: string; label: string; cells: Cell[] }

const LAYOUTS: Layout[] = [
  { key: 'full', label: '1 gambar', cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  {
    key: 'rows2',
    label: '2 baris',
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    key: 'cols2',
    label: '2 kolom',
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    key: 'rows3',
    label: '3 baris',
    cells: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
  {
    key: 'cols3',
    label: '3 kolom',
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    key: 'top1bottom2',
    label: '1 atas, 2 bawah',
    cells: [
      { x: 0, y: 0, w: 1, h: 0.6 },
      { x: 0, y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
    ],
  },
  {
    key: 'top2bottom1',
    label: '2 atas, 1 bawah',
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.4 },
      { x: 0.5, y: 0, w: 0.5, h: 0.4 },
      { x: 0, y: 0.4, w: 1, h: 0.6 },
    ],
  },
  {
    key: 'grid4',
    label: '4 kotak',
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    key: 'rows4',
    label: '4 baris',
    cells: [
      { x: 0, y: 0, w: 1, h: 0.25 },
      { x: 0, y: 0.25, w: 1, h: 0.25 },
      { x: 0, y: 0.5, w: 1, h: 0.25 },
      { x: 0, y: 0.75, w: 1, h: 0.25 },
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

export default function CollagePage() {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ratioKey, setRatioKey] = useState('3:4')
  const [layoutKey, setLayoutKey] = useState('rows3')
  const [slots, setSlots] = useState<Slot[]>([emptySlot(), emptySlot(), emptySlot()])
  const [selected, setSelected] = useState(0)
  const drag = useRef<{ active: boolean; x: number; y: number } | null>(null)

  const ratio = RATIOS.find((r) => r.key === ratioKey) ?? RATIOS[0]
  const layout = LAYOUTS.find((l) => l.key === layoutKey) ?? LAYOUTS[0]
  const OUT_W = ratio.w
  const OUT_H = ratio.h

  // Samakan jumlah slot dengan jumlah sel di layout.
  useEffect(() => {
    setSlots((prev) => {
      const n = layout.cells.length
      if (prev.length === n) return prev
      const next = prev.slice(0, n)
      while (next.length < n) next.push(emptySlot())
      return next
    })
    setSelected((s) => Math.min(Math.max(s, 0), layout.cells.length - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])

  function cellPx(c: Cell): Cell {
    return {
      x: c.x * OUT_W + GAP / 2,
      y: c.y * OUT_H + GAP / 2,
      w: c.w * OUT_W - GAP,
      h: c.h * OUT_H - GAP,
    }
  }

  function draw(showSel = true) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    layout.cells.forEach((c, i) => {
      const px = cellPx(c)
      const slot = slots[i]
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
        const dx = px.x + (px.w - dw) / 2 + slot.offsetX
        const dy = px.y + (px.h - dh) / 2 + slot.offsetY
        ctx.drawImage(slot.img, dx, dy, dw, dh)
      } else {
        ctx.fillStyle = '#9ca3af'
        ctx.font = '40px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), px.x + px.w / 2, px.y + px.h / 2)
      }
      ctx.restore()
      if (showSel && i === selected) {
        ctx.strokeStyle = '#ee4d2d'
        ctx.lineWidth = 6
        ctx.strokeRect(px.x + 3, px.y + 3, px.w - 6, px.h - 6)
      }
    })
  }

  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, layoutKey, ratioKey, selected])

  function canvasPoint(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * OUT_W,
      y: ((e.clientY - rect.top) / rect.height) * OUT_H,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    const pt = canvasPoint(e)
    const idx = layout.cells.findIndex((c) => {
      const px = cellPx(c)
      return pt.x >= px.x && pt.x <= px.x + px.w && pt.y >= px.y && pt.y <= px.y + px.h
    })
    if (idx >= 0) setSelected(idx)
    drag.current = { active: idx >= 0 && !!slots[idx]?.img, x: pt.x, y: pt.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current?.active) return
    const pt = canvasPoint(e)
    const dx = pt.x - drag.current.x
    const dy = pt.y - drag.current.y
    drag.current.x = pt.x
    drag.current.y = pt.y
    setSlots((prev) =>
      prev.map((s, i) =>
        i === selected ? { ...s, offsetX: s.offsetX + dx, offsetY: s.offsetY + dy } : s,
      ),
    )
  }

  function onPointerUp() {
    if (drag.current) drag.current.active = false
  }

  function onFile(file: File | undefined) {
    if (!file || selected < 0) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () =>
      setSlots((prev) =>
        prev.map((s, i) => (i === selected ? { img, scale: 1, offsetX: 0, offsetY: 0 } : s)),
      )
    img.onerror = () => toast('Gagal memuat gambar', 'err')
    img.src = url
  }

  function setScale(v: number) {
    setSlots((prev) => prev.map((s, i) => (i === selected ? { ...s, scale: v } : s)))
  }
  function resetSlot() {
    setSlots((prev) =>
      prev.map((s, i) => (i === selected ? { ...s, scale: 1, offsetX: 0, offsetY: 0 } : s)),
    )
  }

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!slots.some((s) => s.img)) {
      toast('Belum ada gambar', 'err')
      return
    }
    draw(false)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          draw(true)
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `collage-${ratio.key.replace(':', 'x')}.jpg`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        draw(true)
        toast('Collage diunduh')
      },
      'image/jpeg',
      0.92,
    )
  }

  const chip = (active: boolean) =>
    'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
    (active
      ? 'bg-brand-600 text-white'
      : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Collage</h1>
      <p className="text-sm text-gray-500">
        Gabung beberapa gambar jadi 1. Pilih rasio &amp; layout, tap sel → masukkan gambar → geser
        (drag) &amp; atur zoom, lalu unduh.
      </p>

      <div>
        <label className="label">Rasio</label>
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <button key={r.key} onClick={() => setRatioKey(r.key)} className={chip(ratioKey === r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Layout</label>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((l) => (
            <button key={l.key} onClick={() => setLayoutKey(l.key)} className={chip(layoutKey === l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={OUT_W}
        height={OUT_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="mx-auto block max-h-[60vh] max-w-full touch-none rounded-xl bg-white shadow ring-1 ring-gray-200"
        style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

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
            {slots[selected]?.img ? 'Ganti gambar' : 'Masukkan gambar'}
          </button>
          <button onClick={resetSlot} className="btn-ghost" disabled={!slots[selected]?.img}>
            Reset posisi
          </button>
        </div>
        <div>
          <label className="label">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={slots[selected]?.scale ?? 1}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={!slots[selected]?.img}
            className="w-full accent-brand-600"
          />
        </div>
      </div>

      <button onClick={download} className="btn-primary w-full">
        Unduh JPG
      </button>
    </div>
  )
}
