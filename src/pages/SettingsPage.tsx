import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getSettings, listAllItems, listPostings, saveSettings } from '../lib/db'
import { listAllImages } from '../lib/images'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [hashtags, setHashtags] = useState('')
  const [kategori, setKategori] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user) return
    getSettings(user.id)
      .then((s) => {
        setHashtags(s.default_hashtags)
        setKategori(s.kategori_presets.join(', '))
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Gagal memuat pengaturan', 'err'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const presets = kategori
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await saveSettings(user.id, {
        default_hashtags: hashtags.trim(),
        kategori_presets: presets,
      })
      toast('Pengaturan disimpan')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function exportData() {
    setExporting(true)
    try {
      const [postings, items, images] = await Promise.all([
        listPostings(),
        listAllItems(),
        listAllImages(),
      ])
      const payload = { exported_at: new Date().toISOString(), version: 1, postings, items, images }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `affiliate-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast(`Backup ${postings.length} postingan diunduh`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal export', 'err')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="py-12 text-center text-gray-400">Memuat…</p>

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Pengaturan</h1>

      <div className="card space-y-4">
        <div>
          <label className="label">Hashtag default caption</label>
          <textarea
            className="input min-h-[80px]"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#recomendationoutfithijab #hijaboutfit #hijabootd"
          />
          <p className="mt-1 text-xs text-gray-400">
            Dipakai sebagai default saat membuat postingan baru. Bisa diubah per postingan.
          </p>
        </div>

        <div>
          <label className="label">Preset kategori (pisahkan dengan koma)</label>
          <input
            className="input"
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            placeholder="blouse, rok, sepatu, outer, dress"
          />
          <p className="mt-1 text-xs text-gray-400">
            Muncul sebagai pilihan cepat kategori item.
          </p>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-bold text-gray-900">Backup data</h2>
          <p className="mt-1 text-sm text-gray-500">
            Unduh semua postingan, item, &amp; daftar gambar jadi satu file JSON. Simpan sebagai
            cadangan (Supabase free tier bisa auto-pause kalau lama nganggur).
          </p>
        </div>
        <button onClick={exportData} disabled={exporting} className="btn-secondary">
          {exporting ? 'Menyiapkan…' : 'Export ke JSON'}
        </button>
      </div>
    </div>
  )
}
