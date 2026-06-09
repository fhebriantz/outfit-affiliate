import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { deleteImage, imagePublicUrl, listImages, uploadScreenshot } from '../lib/images'
import type { PostingImage } from '../lib/types'

interface Props {
  postingId: string
  userId: string
  onCountChange?: (count: number) => void
}

/** Galeri screenshot referensi: upload banyak, lihat besar, hapus. */
export default function ImageGallery({ postingId, userId, onCountChange }: Props) {
  const { toast } = useToast()
  const [images, setImages] = useState<PostingImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listImages(postingId)
      .then(setImages)
      .catch((e) => toast(e instanceof Error ? e.message : 'Gagal memuat gambar', 'err'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postingId])

  useEffect(() => {
    onCountChange?.(images.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const arr = Array.from(files)
    let ok = 0
    for (const f of arr) {
      try {
        const img = await uploadScreenshot(userId, postingId, f)
        setImages((prev) => [...prev, img])
        ok++
      } catch (e) {
        toast(e instanceof Error ? e.message : `Gagal upload ${f.name}`, 'err')
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (ok > 0) toast(`${ok} gambar terupload`)
  }

  async function handleDelete(img: PostingImage) {
    if (!confirm('Hapus gambar ini?')) return
    const prev = images
    setImages((p) => p.filter((i) => i.id !== img.id))
    try {
      await deleteImage(img)
    } catch (e) {
      setImages(prev)
      toast(e instanceof Error ? e.message : 'Gagal menghapus', 'err')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Upload screenshot referensi (boleh banyak sekaligus, mis. tiap varian warna). Gambar
          otomatis dikompres.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn-secondary"
      >
        {uploading ? 'Mengupload…' : '+ Upload gambar'}
      </button>

      {loading ? (
        <p className="py-4 text-center text-sm text-gray-400">Memuat gambar…</p>
      ) : images.length === 0 ? (
        <p className="py-2 text-sm text-gray-400">Belum ada gambar.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => {
            const url = imagePublicUrl(img.path)
            return (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full cursor-zoom-in object-cover"
                  onClick={() => setPreview(url)}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(img)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
                  title="Hapus"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
