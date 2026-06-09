// Logika inti resolve short link -> URL Shopee panjang. Dipakai oleh:
// - api/resolve.js (serverless Vercel, produksi)
// - vite.config.ts middleware (dev lokal `npm run dev`)
// File diawali "_" -> Vercel tidak menjadikannya endpoint.
//
// Pendekatan: domain INPUT tidak dibatasi (biar short link domain apa pun yang
// mengarah ke Shopee tetap kebaca), tapi hasilnya hanya diterima kalau URL AKHIR
// mendarat di Shopee. Kalau bukan Shopee, link asli dikembalikan apa adanya
// (tidak membocorkan URL hasil yang mungkin internal/non-Shopee).

function isShopeeHost(host) {
  const h = host.toLowerCase()
  return (
    h === 'shopee.co.id' ||
    h.endsWith('.shopee.co.id') ||
    h === 'shopee.com' ||
    h.endsWith('.shopee.com')
  )
}

// Blokir host privat/internal (mitigasi SSRF) saat menerima input.
function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (h === '::1') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    if (a === 0 || a === 127 || a === 10) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
  }
  return false
}

/**
 * @returns {Promise<{status:number, body:object}>}
 */
export async function resolveShopeeUrl(target) {
  if (!target || typeof target !== 'string') {
    return { status: 400, body: { error: 'parameter url wajib' } }
  }
  let u
  try {
    u = new URL(target)
  } catch {
    return { status: 400, body: { error: 'url tidak valid' } }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { status: 400, body: { error: 'protokol tidak diizinkan' } }
  }
  if (isPrivateHost(u.hostname)) {
    return { status: 400, body: { error: 'host tidak diizinkan' } }
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
    let finalHost = ''
    try {
      finalHost = new URL(r.url).hostname
    } catch {
      /* abaikan */
    }
    // Hanya kembalikan URL hasil kalau berakhir di Shopee. Selain itu kembalikan
    // link asli (jangan bocorkan URL akhir yang bukan Shopee).
    if (finalHost && isShopeeHost(finalHost)) {
      return { status: 200, body: { url: r.url } }
    }
    return { status: 200, body: { url: target } }
  } catch {
    return { status: 502, body: { error: 'gagal resolve link' } }
  } finally {
    clearTimeout(timeout)
  }
}
