import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

// Serves the built frontend (dist/) so one process is the whole app in production.
const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/font', '.webp': 'image/webp',
}

const isFile = (p) => stat(p).then((s) => s.isFile(), () => false)

// returns false when there is no build, so the caller can fall back to a 404
export async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  let rel
  try { rel = decodeURIComponent(pathname) } catch { return false }
  let file = path.join(DIST, rel)
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return false // no ../ escapes
  if (!(await isFile(file))) file = path.join(DIST, 'index.html') // SPA fallback
  if (!(await isFile(file))) return false
  const ext = path.extname(file)
  res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream')
  // hashed assets never change; index.html must always be fresh
  res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.statusCode = 200
  if (req.method === 'HEAD') return res.end(), true
  createReadStream(file).pipe(res)
  return true
}
