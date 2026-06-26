// Hasilkan public/base/manifest.json berisi daftar gambar dasar (base) untuk
// ganti outfit di RunningHub. Dijalankan otomatis sebelum build & dev.
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseDir = join(root, 'public', 'base')
const exts = new Set(['.png', '.jpg', '.jpeg', '.webp'])

if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })

const files = readdirSync(baseDir)
  .filter((f) => exts.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))

writeFileSync(join(baseDir, 'manifest.json'), JSON.stringify(files, null, 2) + '\n')
console.log(`[base-manifest] ${files.length} gambar dasar`)
