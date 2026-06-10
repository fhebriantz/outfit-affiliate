import { useEffect, useState } from 'react'
import type { Item } from '../lib/types'

interface Props {
  item: Item
  presets: string[]
  index: number
  dup?: { number: number; label: string; consistent: boolean } | null
  onSave: (patch: Partial<Item>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}

/**
 * Satu item produk. Field disimpan saat blur (kehilangan fokus) supaya
 * tidak menulis ke DB di tiap ketikan.
 */
export default function ItemRow({
  item,
  presets,
  dup,
  onSave,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: Props) {
  const [draft, setDraft] = useState({
    my_number: item.my_number,
    kategori: item.kategori ?? '',
    ref_code: item.ref_code ?? '',
    source_link: item.source_link ?? '',
    affiliate_link: item.affiliate_link ?? '',
  })

  // Sinkronkan draft kalau data dari parent berubah (mis. setelah paste massal).
  useEffect(() => {
    setDraft({
      my_number: item.my_number,
      kategori: item.kategori ?? '',
      ref_code: item.ref_code ?? '',
      source_link: item.source_link ?? '',
      affiliate_link: item.affiliate_link ?? '',
    })
  }, [item.my_number, item.kategori, item.ref_code, item.source_link, item.affiliate_link])

  function saveNumber() {
    const n = Number(draft.my_number)
    if (Number.isFinite(n) && n !== item.my_number) onSave({ my_number: n })
  }
  function saveField(field: keyof typeof draft, value: string) {
    const current = (item[field] as string | null) ?? ''
    if (value !== current) onSave({ [field]: value || null })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="label !mb-0">No</span>
          <input
            type="number"
            inputMode="numeric"
            className="input w-20 text-center font-semibold"
            value={draft.my_number}
            onChange={(e) => setDraft((d) => ({ ...d, my_number: Number(e.target.value) }))}
            onBlur={saveNumber}
          />
          <select
            className="input w-auto min-w-[120px]"
            value={presets.includes(draft.kategori) ? draft.kategori : '__custom'}
            onChange={(e) => {
              const v = e.target.value
              if (v !== '__custom') {
                setDraft((d) => ({ ...d, kategori: v }))
                saveField('kategori', v)
              }
            }}
          >
            {presets.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
            <option value="__custom">(lainnya…)</option>
          </select>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="btn-ghost px-2"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            title="Naik"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn-ghost px-2"
            disabled={isLast}
            onClick={() => onMove(1)}
            title="Turun"
          >
            ↓
          </button>
          <button type="button" className="btn-ghost px-2 text-red-600" onClick={onDelete} title="Hapus">
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Kategori</label>
          <input
            className="input"
            value={draft.kategori}
            placeholder="blouse / rok / sepatu"
            onChange={(e) => setDraft((d) => ({ ...d, kategori: e.target.value }))}
            onBlur={(e) => saveField('kategori', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Link sumber (Shopee referensi)</label>
          <div className="flex gap-1">
            <input
              className="input"
              value={draft.source_link}
              placeholder="https://shopee.co.id/product/..."
              onChange={(e) => setDraft((d) => ({ ...d, source_link: e.target.value }))}
              onBlur={(e) => saveField('source_link', e.target.value)}
            />
            {draft.source_link.trim().startsWith('http') && (
              <a
                href={draft.source_link.trim()}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary shrink-0 px-3"
                title="Buka link sumber"
              >
                ↗
              </a>
            )}
          </div>
          {dup && (
            <p
              className={
                'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
                (dup.consistent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')
              }
            >
              {dup.consistent
                ? `♻ Produk sama dengan no ${dup.number} — sudah dipakai ulang`
                : `⚠ Produk sama dengan no ${dup.number} (${dup.label}) — sebaiknya pakai ulang`}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Link affiliate-ku</label>
          <div className="flex gap-1">
            <input
              className="input"
              value={draft.affiliate_link}
              placeholder="https://s.shopee.co.id/..."
              onChange={(e) => setDraft((d) => ({ ...d, affiliate_link: e.target.value }))}
              onBlur={(e) => saveField('affiliate_link', e.target.value)}
            />
            {draft.affiliate_link.trim().startsWith('http') && (
              <a
                href={draft.affiliate_link.trim()}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary shrink-0 px-3"
                title="Buka link affiliate"
              >
                ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
