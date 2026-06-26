import { useEffect, useState } from 'react'

// Link workflow "Ganti Outfit" di RunningHub.
const RUNNINGHUB_URL =
  'https://www.runninghub.ai/ai-detail/2043912413900181506?outputId=2068232595724005377'

// Galeri gambar dasar (public/base) untuk diganti outfit-nya di RunningHub.
// Unduh memakai link langsung ke file asli -> kualitas 1:1, TANPA kompres.
export default function BaseImagesPanel() {
  const [files, setFiles] = useState<string[]>([])

  useEffect(() => {
    fetch('/base/manifest.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setFiles(Array.isArray(list) ? list : []))
      .catch(() => setFiles([]))
  }, [])

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Gambar dasar (ganti outfit)</h2>
        <a href={RUNNINGHUB_URL} target="_blank" rel="noreferrer" className="btn-primary text-xs">
          Buka RunningHub ↗
        </a>
      </div>
      <p className="text-xs text-gray-500">
        Unduh gambar dasar (kualitas asli, tanpa kompres) lalu upload ke RunningHub untuk ganti outfit.
      </p>
      {files.length === 0 ? (
        <p className="text-sm text-gray-400">
          Belum ada gambar di <code>public/base</code>.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((name) => {
            const url = `/base/${encodeURIComponent(name)}`
            return (
              <div key={name} className="space-y-1">
                <a href={url} target="_blank" rel="noreferrer" className="block" title={name}>
                  <img
                    src={url}
                    alt={name}
                    loading="lazy"
                    className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-gray-200"
                  />
                </a>
                <a
                  href={url}
                  download={name}
                  className="btn-secondary block w-full text-center text-xs"
                >
                  Unduh
                </a>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
