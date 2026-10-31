import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { askAssistant, hasAssistant, recommend } from './assistant.js'
import { setChoice } from './choices.js'
import { createCollection, getLists, setInCollection, setWatchlist } from './lists.js'
import { buildLibrary } from './home.js'
import { getFile, getLibrary } from './library.js'
import { getProgress, setProgress } from './progress.js'
import { listSubtitles, readSubtitle } from './subtitles.js'
import { serveStatic } from './static.js'
import { streamFile } from './stream.js'
import { getImages, hasKey } from './tmdb.js'

const PORT = Number(process.env.PORT) || 4000
const MOVIES_DIR = path.resolve((process.env.MOVIES_DIR || path.join(os.homedir(), 'Movies')).replace(/^~/, os.homedir()))

// subtitles/<film id>/<lang>.vtt, by default a sibling of the movies folder
const SUBTITLES_DIR = path.resolve((process.env.SUBTITLES_DIR || path.join(MOVIES_DIR, '..', 'subtitles')).replace(/^~/, os.homedir()))

const PATH_RE = /^\/[A-Za-z0-9_-]+\.(jpg|png)$/ // a TMDB file path, nothing else
const KINDS = ['poster', 'still', 'logo']
const ID_RE = /^[A-Za-z0-9_-]{1,200}$/

const send = (res, code, body) => {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const readJson = (req) => new Promise((resolve, reject) => {
  let body = ''
  req.on('data', (c) => { body += c; if (body.length > 1e5) reject(new Error('body too large')) })
  req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch (e) { reject(e) } })
})

async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://x')

  if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true })
  if (req.method === 'GET' && pathname === '/api/library') return send(res, 200, buildLibrary(await getLibrary(MOVIES_DIR), getLists(), getProgress()))

  if (req.method === 'POST' && pathname === '/api/assistant') {
    if (!hasAssistant()) return send(res, 503, { error: 'GEMINI_API_KEY is not set' })
    const { messages } = await readJson(req)
    try {
      return send(res, 200, { reply: await askAssistant(messages, await getLibrary(MOVIES_DIR)) })
    } catch (err) {
      if (err.status === 400) return send(res, 400, { error: err.message })
      console.warn(`[assistant] ${err.message}`)
      return send(res, 502, { error: 'assistant unavailable' })
    }
  }

  if (req.method === 'POST' && pathname === '/api/recommend') {
    if (!hasAssistant()) return send(res, 503, { error: 'GEMINI_API_KEY is not set' })
    const body = await readJson(req)
    try {
      return send(res, 200, { picks: await recommend(body, await getLibrary(MOVIES_DIR), getProgress()) })
    } catch (err) {
      if (err.status === 400) return send(res, 400, { error: err.message })
      console.warn(`[recommend] ${err.message}`)
      return send(res, 502, { error: 'assistant unavailable' })
    }
  }

  const sub = pathname.match(/^\/api\/movies\/([^/]+)\/subtitles(?:\/([A-Za-z-]+))?$/)
  if (sub && req.method === 'GET') {
    const id = decodeURIComponent(sub[1])
    if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid id' })
    if (!sub[2]) return send(res, 200, await listSubtitles(SUBTITLES_DIR, id))
    const vtt = await readSubtitle(SUBTITLES_DIR, id, sub[2])
    if (vtt == null) return send(res, 404, { error: 'no such subtitle' })
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.end(vtt)
  }

  const m = pathname.match(/^\/api\/movies\/([^/]+)\/(images|choice|stream)$/)
  if (m) {
    const id = decodeURIComponent(m[1])

    if (m[2] === 'stream' && (req.method === 'GET' || req.method === 'HEAD')) {
      const file = await getFile(id, MOVIES_DIR)
      if (!file) return send(res, 404, { error: 'unknown film' })
      return streamFile(req, res, file)
    }

    if (m[2] === 'images' && req.method === 'GET') {
      const tmdb = id.match(/^tmdb-(\d+)$/)
      if (!tmdb) return send(res, 200, { posters: [], backdrops: [], logos: [] })
      if (!hasKey()) return send(res, 503, { error: 'TMDB_API_KEY is not set' })
      return send(res, 200, await getImages(tmdb[1]))
    }

    if (m[2] === 'choice' && req.method === 'PUT') {
      if (!/^tmdb-\d+$/.test(id)) return send(res, 400, { error: 'only films matched on TMDB can have image choices' })
      const patch = await readJson(req)
      for (const [k, v] of Object.entries(patch)) {
        if (!KINDS.includes(k) || (v !== null && !PATH_RE.test(v))) return send(res, 400, { error: `invalid ${k}` })
      }
      return send(res, 200, await setChoice(id, patch))
    }
  }

  let r
  if ((r = pathname.match(/^\/api\/movies\/([^/]+)\/progress$/)) && req.method === 'PUT') {
    const id = decodeURIComponent(r[1])
    if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid id' })
    const { position, duration } = await readJson(req)
    const saved = await setProgress(id, position, duration)
    return saved ? send(res, 200, saved) : send(res, 400, { error: 'invalid progress' })
  }

  if ((r = pathname.match(/^\/api\/watchlist\/([^/]+)$/)) && req.method === 'PUT') {
    const id = decodeURIComponent(r[1])
    if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid id' })
    const { on } = await readJson(req)
    return send(res, 200, await setWatchlist(id, Boolean(on)))
  }

  if (pathname === '/api/collections' && req.method === 'POST') {
    const { name } = await readJson(req)
    const created = await createCollection(name)
    return created ? send(res, 201, created) : send(res, 400, { error: 'invalid name' })
  }

  if ((r = pathname.match(/^\/api\/collections\/([^/]+)\/movies\/([^/]+)$/)) && req.method === 'PUT') {
    const [cid, id] = [decodeURIComponent(r[1]), decodeURIComponent(r[2])]
    if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid id' })
    const { on } = await readJson(req)
    const updated = await setInCollection(cid, id, Boolean(on))
    return updated ? send(res, 200, updated) : send(res, 404, { error: 'no such collection' })
  }

  if (!pathname.startsWith('/api/') && (await serveStatic(req, res, pathname))) return
  send(res, 404, { error: 'not found' })
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
  try {
    await handle(req, res)
  } catch (err) {
    console.error(err)
    send(res, 500, { error: 'internal error' })
  }
}).listen(PORT, async () => {
  console.log(`API:     http://localhost:${PORT}/api/library`)
  console.log(`Library: ${MOVIES_DIR}`)
  if (!hasKey()) console.warn('TMDB_API_KEY is not set: titles come from file names only, no posters.')
  const movies = await getLibrary(MOVIES_DIR)
  console.log(`Found ${movies.length} movie file(s).`)
})
