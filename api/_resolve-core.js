// Logika inti resolve short link Shopee, dipakai oleh:
// - api/resolve.js (serverless Vercel, produksi)
// - vite.config.ts middleware (dev lokal `npm run dev`)
// File diawali "_" -> Vercel tidak menjadikannya endpoint.

const ALLOWED = ['shopee.co.id', 'shp.ee', 'shope.ee']

function isAllowedHost(host) {
  const h = host.toLowerCase()
  return ALLOWED.some((d) => h === d || h.endsWith('.' + d))
}

/**
 * @returns {Promise<{status:number, body:object}>}
 */
export async function resolveShopeeUrl(target) {
  if (!target || typeof target !== 'string') {
    return { status: 400, body: { error: 'parameter url wajib' } }
  }
  let host
  try {
    host = new URL(target).hostname
  } catch {
    return { status: 400, body: { error: 'url tidak valid' } }
  }
  if (!isAllowedHost(host)) {
    return { status: 400, body: { error: 'domain tidak diizinkan' } }
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
    return { status: 200, body: { url: r.url || target } }
  } catch {
    return { status: 502, body: { error: 'gagal resolve link' } }
  } finally {
    clearTimeout(timeout)
  }
}
