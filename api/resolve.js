// Serverless function (Vercel): resolve short link Shopee -> URL panjang.
// Browser tidak bisa melakukan ini sendiri karena CORS, jadi dikerjakan di server.
// Hanya domain Shopee yang diizinkan (mencegah disalahgunakan sebagai proxy umum).
export default async function handler(req, res) {
  const target = req.query?.url
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'parameter url wajib' })
  }

  let host
  try {
    host = new URL(target).hostname.toLowerCase()
  } catch {
    return res.status(400).json({ error: 'url tidak valid' })
  }

  const allowed =
    host === 'shopee.co.id' ||
    host.endsWith('.shopee.co.id') ||
    host === 'shp.ee' ||
    host.endsWith('.shp.ee')
  if (!allowed) {
    return res.status(400).json({ error: 'domain tidak diizinkan' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const r = await fetch(target, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    })
    // r.url = URL akhir setelah seluruh redirect diikuti.
    return res.status(200).json({ url: r.url || target })
  } catch {
    return res.status(502).json({ error: 'gagal resolve link' })
  } finally {
    clearTimeout(timeout)
  }
}
