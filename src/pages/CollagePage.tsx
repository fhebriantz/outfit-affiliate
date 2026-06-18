import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'

const GAP_ON = 14 // lebar jarak antar sel saat gap diaktifkan (px di canvas)

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

// Layer teks (penunjuk nomor / judul cover). Posisi x,y dalam fraksi 0..1.
interface Label {
  id: string
  text: string
  x: number
  y: number
  size: number // px relatif canvas
  color: 'white' | 'black'
}
const DEFAULT_LABEL_TEXT = '•-----A '

export default function CollagePage() {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ratioKey, setRatioKey] = useState('3:4')
  const [layoutKey, setLayoutKey] = useState('cols3')
  const [showGap, setShowGap] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([emptySlot(), emptySlot(), emptySlot()])
  const [selected, setSelected] = useState(0)
  const [labels, setLabels] = useState<Label[]>([])
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const labelRects = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({})
  const idRef = useRef(0)
  const drag = useRef<{ mode: 'cell' | 'label'; id?: string; x: number; y: number } | null>(null)

  const ratio = RATIOS.find((r) => r.key === ratioKey) ?? RATIOS[0]
  const layout = LAYOUTS.find((l) => l.key === layoutKey) ?? LAYOUTS[0]
  const OUT_W = ratio.w
  const OUT_H = ratio.h
  const GAP = showGap ? GAP_ON : 0

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
      if (showSel && i === selected && activeLabel === null) {
        ctx.strokeStyle = '#ee4d2d'
        ctx.lineWidth = 6
        ctx.strokeRect(px.x + 3, px.y + 3, px.w - 6, px.h - 6)
      }
    })

    // Layer teks (di atas semua gambar)
    labelRects.current = {}
    for (const l of labels) {
      const px = l.x * OUT_W
      const py = l.y * OUT_H
      ctx.font = `bold ${l.size}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const lines = l.text.split('\n')
      const lineH = l.size * 1.2
      let maxW = 0
      lines.forEach((ln) => (maxW = Math.max(maxW, ctx.measureText(ln).width)))
      // outline biar kebaca di gambar apa pun
      ctx.lineWidth = Math.max(3, l.size * 0.14)
      ctx.lineJoin = 'round'
      ctx.strokeStyle = l.color === 'white' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'
      ctx.fillStyle = l.color === 'white' ? '#ffffff' : '#111111'
      lines.forEach((ln, li) => {
        const ly = py + li * lineH
        ctx.strokeText(ln, px, ly)
        ctx.fillText(ln, px, ly)
      })
      const totalH = lineH * lines.length
      labelRects.current[l.id] = {
        x: px - 8,
        y: py - l.size / 2 - 6,
        w: Math.max(maxW, 24) + 16,
        h: totalH + 12,
      }
      if (showSel && l.id === activeLabel) {
        const r = labelRects.current[l.id]
        ctx.strokeStyle = '#ee4d2d'
        ctx.lineWidth = 3
        ctx.setLineDash([8, 6])
        ctx.strokeRect(r.x, r.y, r.w, r.h)
        ctx.setLineDash([])
      }
    }
  }

  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, layoutKey, ratioKey, selected, showGap, labels, activeLabel])

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
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    // Cek layer teks dulu (paling atas).
    for (let i = labels.length - 1; i >= 0; i--) {
      const r = labelRects.current[labels[i].id]
      if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        setActiveLabel(labels[i].id)
        drag.current = { mode: 'label', id: labels[i].id, x: pt.x, y: pt.y }
        return
      }
    }
    // Kalau bukan teks -> sel gambar.
    setActiveLabel(null)
    const idx = layout.cells.findIndex((c) => {
      const px = cellPx(c)
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
      setLabels((prev) =>
        prev.map((l) => (l.id === id ? { ...l, x: l.x + dx / OUT_W, y: l.y + dy / OUT_H } : l)),
      )
    } else if (slots[selected]?.img) {
      setSlots((prev) =>
        prev.map((s, i) =>
          i === selected ? { ...s, offsetX: s.offsetX + dx, offsetY: s.offsetY + dy } : s,
        ),
      )
    }
  }

  function onPointerUp() {
    drag.current = null
  }

  // ---------- Layer teks ----------
  const activeLabelObj = labels.find((l) => l.id === activeLabel) ?? null
  function addLabel() {
    const id = String(++idRef.current)
    setLabels((prev) => [
      ...prev,
      { id, text: DEFAULT_LABEL_TEXT, x: 0.12, y: 0.5, size: Math.round(OUT_W * 0.05), color: 'white' },
    ])
    setActiveLabel(id)
  }
  function updateLabel(patch: Partial<Label>) {
    if (!activeLabel) return
    setLabels((prev) => prev.map((l) => (l.id === activeLabel ? { ...l, ...patch } : l)))
  }
  function deleteLabel() {
    if (!activeLabel) return
    setLabels((prev) => prev.filter((l) => l.id !== activeLabel))
    setActiveLabel(null)
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
    if (!slots.some((s) => s.img) && labels.length === 0) {
      toast('Belum ada gambar/teks', 'err')
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

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showGap} onChange={(e) => setShowGap(e.target.checked)} />
        Garis pemisah (jarak putih antar gambar)
      </label>

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
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = '' // reset biar file yang SAMA bisa dipilih lagi di sel lain
        }}
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

      {/* Layer teks */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Teks ({labels.length})</h2>
          <button onClick={addLabel} className="btn-secondary">
            + Tambah teks
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Default <code>•-----A </code> untuk penunjuk nomor (tinggal ketik nomornya), atau hapus &
          ganti untuk judul cover. Tap teks di gambar untuk pilih, lalu geser.
        </p>
        {activeLabelObj ? (
          <div className="space-y-3">
            <textarea
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
              <button
                onClick={() => updateLabel({ color: 'white' })}
                className={chip(activeLabelObj.color === 'white')}
              >
                Putih
              </button>
              <button
                onClick={() => updateLabel({ color: 'black' })}
                className={chip(activeLabelObj.color === 'black')}
              >
                Hitam
              </button>
              <button onClick={deleteLabel} className="btn-ghost ml-auto text-red-600">
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Belum ada teks dipilih. Tambah atau tap teks di gambar.</p>
        )}
      </div>

      <button onClick={download} className="btn-primary w-full">
        Unduh JPG
      </button>
    </div>
  )
}
