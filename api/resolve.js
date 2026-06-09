// Serverless function (Vercel): resolve short link Shopee -> URL panjang.
// Browser tidak bisa melakukan ini sendiri karena CORS, jadi dikerjakan di server.
// Logika & daftar domain ada di ./_resolve-core.js (dipakai bersama dev lokal).
import { resolveShopeeUrl } from './_resolve-core.js'

export default async function handler(req, res) {
  const { status, body } = await resolveShopeeUrl(req.query?.url)
  return res.status(status).json(body)
}
