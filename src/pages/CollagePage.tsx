import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'

// Output 3:4 (potret) — cocok untuk cover TikTok.
const OUT_W = 900
const OUT_H = 1200
const GAP = 10 // jarak antar sel (px di canvas)

type Cell = { x: number; y: number; w: number; h: number } // fraksi 0..1
type Layout = { key: string; label: string; cells: Cell[] }

const LAYOUTS: Layout[] = [
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
]

interface Slot {
  img: HTMLImageElement | null
  scale: number
  offsetX: number
  offsetY: number
}

const emptySlot = (): Slot => ({ img: null, scale: 1, offsetX: 0, offsetY: 0 })

// Sel dalam piksel canvas (dengan gap).
function cellPx(c: Cell): Cell {
  return {
    x: c.x * OUT_W + GAP / 2,
    y: c.y * OUT_H + GAP / 2,
    w: c.w * OUT_W - GAP,
    h: c.h * OUT_H - GAP,
  }
}

export default function CollagePage() {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [layoutKey, setLayoutKey] = useState('rows3')
  const [slots, setSlots] = useState<Slot[]>([emptySlot(), emptySlot(), emptySlot()])
  const [selected, setSelected] = useState(0)
  const drag = useRef<{ active: boolean; x: number; y: number } | null>(null)

  const layout = LAYOUTS.find((l) => l.key === layoutKey) ?? LAYOUTS[0]

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
      // garis sel terpilih
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
  }, [slots, layoutKey, selected])

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
    // sel mana yang diklik
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

  function pickImage() {
    fileRef.current?.click()
  }

  function onFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setSlots((prev) =>
        prev.map((s, i) => (i === selected ? { img, scale: 1, offsetX: 0, offsetY: 0 } : s)),
      )
    }
    img.onerror = () => toast('Gagal memuat gambar', 'err')
    img.src = url
  }

  function setScale(v: number) {
    setSlots((prev) => prev.map((s, i) => (i === selected ? { ...s, scale: v } : s)))
  }

  function resetSlot() {
    setSlots((prev) => prev.map((s, i) => (i === selected ? { ...s, scale: 1, offsetX: 0, offsetY: 0 } : s)))
  }

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!slots.some((s) => s.img)) {
      toast('Belum ada gambar', 'err')
      return
    }
    draw(false) // render tanpa garis seleksi
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          draw(true)
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'collage.jpg'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        draw(true) // pulihkan tampilan
        toast('Collage diunduh')
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Collage 3:4</h1>
      <p className="text-sm text-gray-500">
        Gabung 3 gambar jadi 1 (rasio 3:4 untuk cover TikTok). Pilih sel → masukkan gambar → geser
        (drag) & atur zoom. Lalu unduh.
      </p>

      {/* Pilihan layout */}
      <div className="flex flex-wrap gap-2">
        {LAYOUTS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLayoutKey(l.key)}
            className={
              'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
              (layoutKey === l.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')
            }
          >
            {l.label}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={OUT_W}
        height={OUT_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="mx-auto block w-full max-w-[320px] touch-none rounded-xl bg-white shadow ring-1 ring-gray-200"
        style={{ aspectRatio: '3 / 4' }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/* Kontrol sel terpilih */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Sel {selected >= 0 ? selected + 1 : '-'}</span>
          {[0, 1, 2].map((i) => (
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
          <button onClick={pickImage} className="btn-secondary" disabled={selected < 0}>
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
