import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveShopeeUrl } from './api/_resolve-core.js'

// Saat `npm run dev`, sediakan endpoint /api/resolve (di produksi ditangani Vercel).
function devResolveApi(): PluginOption {
  return {
    name: 'dev-resolve-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/resolve')) return next()
        const url = new URL(req.url, 'http://localhost').searchParams.get('url')
        const { status, body } = await resolveShopeeUrl(url ?? undefined)
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devResolveApi()],
})
