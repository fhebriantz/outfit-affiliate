import { useEffect, useRef, useState } from 'react'

// Halaman koleksi affiliate (mis. collshp.com) dibungkus dalam iframe — tetap di web ini.
// URL bisa diedit & disimpan di localStorage (tidak perlu DB).
const STORAGE_KEY = 'koleksi_url'
const DEFAULT_URL = 'https://collshp.com/ourdailyoutfit'

export default function CollectionPage() {
  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_URL)
  const [draft, setDraft] = useState(url)
  const [loaded, setLoaded] = useState(false)
  // Anggap "gagal tampil" kalau setelah beberapa detik iframe belum memicu onLoad
  // (mis. diblokir / lambat) — tampilkan tombol buka di tab baru.
  const [slow, setSlow] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    setLoaded(false)
    setSlow(false)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSlow(true), 6000)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [url])

  function saveUrl() {
    const v = draft.trim()
    if (!v) return
    const fixed = /^https?:\/\//i.test(v) ? v : `https://${v}`
    localStorage.setItem(STORAGE_KEY, fixed)
    setUrl(fixed)
    setDraft(fixed)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Koleksi</h1>
        <a href={url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
          Buka di tab baru ↗
        </a>
      </div>
      <p className="text-sm text-gray-500">
        Halaman koleksi affiliate-mu ditampilkan langsung di sini. Kalau tampil kosong/diblokir Shopee,
        pakai tombol <strong>Buka di tab baru</strong>.
      </p>

      <div className="flex gap-1">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveUrl}
          onKeyDown={(e) => e.key === 'Enter' && saveUrl()}
          placeholder="https://collshp.com/namamu"
        />
        <button onClick={saveUrl} className="btn-secondary shrink-0">
          Muat
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-sm text-gray-400">
            {slow ? 'Lambat / mungkin diblokir — coba "Buka di tab baru".' : 'Memuat koleksi…'}
          </div>
        )}
        <iframe
          key={url}
          src={url}
          title="Koleksi affiliate"
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
          className="h-[78vh] w-full"
        />
      </div>
    </div>
  )
}
