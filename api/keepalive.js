// Keep-alive: dipanggil Vercel Cron tiap hari untuk "menyentuh" database
// supaya project Supabase free tier tidak auto-pause (pause setelah ~7 hari nganggur).
// Melakukan query kecil ke tabel (hitung sebagai aktivitas DB).
export default async function handler(_req, res) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    res.status(200).json({ ok: false, error: 'env Supabase tidak ada' })
    return
  }
  try {
    const r = await fetch(`${url}/rest/v1/settings?select=user_id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    res.status(200).json({ ok: true, db: r.status, at: new Date().toISOString() })
  } catch (e) {
    res.status(200).json({ ok: false, error: e instanceof Error ? e.message : 'gagal' })
  }
}
