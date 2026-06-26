import { useEffect, useState } from 'react'

// Link workflow "Ganti Outfit" di RunningHub.
const RUNNINGHUB_URL =
  'https://www.runninghub.ai/ai-detail/2043912413900181506?outputId=2068232595724005377'

// Galeri gambar dasar (public/base) untuk diganti outfit-nya di RunningHub.
// - Section collapse (default tertutup) -> gambar baru di-load saat dibuka, jadi halaman ringan.
// - Klik thumbnail -> popup/lightbox.
// - Unduh memakai link langsung ke file asli -> kualitas 1:1, TANPA kompres.
export default function BaseImagesPanel() {
  const [files, setFiles] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    fetch('/base/manifest.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setFiles(Array.isArray(list) ? list : []))
      .catch(() => setFiles([]))
  }, [])

  // Tutup popup dengan tombol Escape.
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  const urlOf = (name: string) => `/base/${encodeURIComponent(name)}`

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left text-lg font-bold text-gray-900"
        >
          <span className="text-gray-400">{open ? '▾' : '▸'}</span>
          Gambar dasar (ganti outfit)
          {files.length > 0 && <span className="text-sm font-normal text-gray-400">({files.length})</span>}
        </button>
        <a href={RUNNINGHUB_URL} target="_blank" rel="noreferrer" className="btn-primary text-xs">
          Buka RunningHub ↗
        </a>
      </div>

      {open && (
        <>
          <p className="text-xs text-gray-500">
            Klik gambar untuk perbesar. Unduh = kualitas asli tanpa kompres, lalu upload ke RunningHub.
          </p>
          {files.length === 0 ? (
            <p className="text-sm text-gray-400">
              Belum ada gambar di <code>public/base</code>.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((name) => (
                <div key={name} className="space-y-1">
                  <button
                    onClick={() => setPreview(name)}
                    className="relative block w-full overflow-hidden rounded-lg ring-1 ring-gray-200"
                    title={name}
                  >
                    <img
                      src={urlOf(name)}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 truncate bg-black/10 px-1.5 py-1 text-center text-[10px] text-white">
                      {name}
                    </div>
                  </button>
                  <a
                    href={urlOf(name)}
                    download={name}
                    className="btn-secondary block w-full text-center text-xs"
                  >
                    Unduh
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Popup / lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative inline-block max-w-full overflow-hidden rounded-lg shadow-2xl"
          >
            <img
              src={urlOf(preview)}
              alt={preview}
              className="block max-h-[80vh] max-w-full object-contain"
            />
            <div className="absolute inset-x-0 bottom-0 truncate bg-black/10 px-3 py-2 text-center text-sm text-white">
              {preview}
            </div>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center gap-2"
          >
            <a href={urlOf(preview)} download={preview} className="btn-primary text-sm">
              Unduh kualitas asli
            </a>
            <button onClick={() => setPreview(null)} className="btn-secondary text-sm">
              Tutup
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
