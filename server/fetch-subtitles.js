// Downloads English subtitles from opensubtitles.com for films that have none yet,
// in the library's A-Z order, until the day's download quota runs out. Run it again
// tomorrow and it carries on where it stopped (films that already have a subtitle are skipped).
//
//   node --env-file=.env server/fetch-subtitles.js [--limit 20] [--lang en] [--dry]
//
// Needs OPENSUBTITLES_API_KEY, OPENSUBTITLES_USER, OPENSUBTITLES_PASSWORD (opensubtitles.com account).
// Files land in <SUBTITLES_DIR>/<film id>/<lang>.srt, where the app's player picks them up.
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const API = 'https://api.opensubtitles.com/api/v1'
const UA = 'filmtar v1.0'

const args = process.argv.slice(2)
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
const LIMIT = Number(opt('limit', 20))
const LANG = opt('lang', 'en')
const DRY = args.includes('--dry')

const PORT = Number(process.env.PORT) || 4000
const MOVIES_DIR = path.resolve((process.env.MOVIES_DIR || path.join(os.homedir(), 'Movies')).replace(/^~/, os.homedir()))
const SUBTITLES_DIR = path.resolve((process.env.SUBTITLES_DIR || path.join(MOVIES_DIR, '..', 'subtitles')).replace(/^~/, os.homedir()))

const { OPENSUBTITLES_API_KEY: KEY, OPENSUBTITLES_USER: USER, OPENSUBTITLES_PASSWORD: PASS } = process.env
if (!KEY || !USER || !PASS) {
  console.error('Missing OPENSUBTITLES_API_KEY / OPENSUBTITLES_USER / OPENSUBTITLES_PASSWORD in the environment.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(route, { method = 'GET', body, token } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + route, {
      method,
      headers: {
        'Api-Key': KEY, 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    })
    if (res.status === 429 && attempt < 4) { await sleep(1500 * (attempt + 1)); continue } // gentle rate limit: 1-2 requests per second
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 200) } }
    return { status: res.status, data }
  }
}

const has = async (id) => {
  try { return (await readdir(path.join(SUBTITLES_DIR, id))).some((f) => new RegExp(`^${LANG}\\.(vtt|srt)$`, 'i').test(f)) } catch { return false }
}

// the best match: not machine translated or AI made, not for the hearing impaired, most downloaded
const best = (items) => items
  .filter((s) => s.attributes?.files?.length)
  .map((s) => ({ s, a: s.attributes }))
  .sort((x, y) =>
    (x.a.machine_translated || x.a.ai_translated) - (y.a.machine_translated || y.a.ai_translated) ||
    Boolean(x.a.hearing_impaired) - Boolean(y.a.hearing_impaired) ||
    (y.a.download_count ?? 0) - (x.a.download_count ?? 0))[0]?.a

const library = await fetch(`http://localhost:${PORT}/api/library`).then((r) => r.json())
const movies = library.movies.filter((m) => /^tmdb-\d+$/.test(m.id)) // already sorted A-Z by title

const login = await call('/login', { method: 'POST', body: { username: USER, password: PASS } })
if (login.status !== 200 || !login.data.token) {
  console.error(`Login failed (${login.status}): ${login.data.message ?? JSON.stringify(login.data)}`)
  process.exit(1)
}
const token = login.data.token
console.log(`Logged in. Library: ${movies.length} films, A-Z. Language: ${LANG}. Up to ${LIMIT} downloads.${DRY ? ' (dry run)' : ''}`)

let done = 0, skipped = 0, missing = 0
for (const m of movies) {
  if (done >= LIMIT) break
  if (await has(m.id)) { skipped++; continue }

  const tmdb = m.id.slice(5)
  const found = await call(`/subtitles?tmdb_id=${tmdb}&languages=${LANG}&order_by=download_count&order_direction=desc`, { token })
  if (found.status !== 200) { console.warn(`  search failed for ${m.title}: ${found.status} ${found.data.message ?? ''}`); await sleep(1000); continue }
  const pick = best(found.data.data ?? [])
  if (!pick) { console.log(`  - ${m.title}: no ${LANG} subtitle on opensubtitles`); missing++; await sleep(600); continue }
  if (DRY) { console.log(`  would download for ${m.title}: ${pick.release ?? pick.files[0].file_name}`); done++; continue }

  const dl = await call('/download', { method: 'POST', token, body: { file_id: pick.files[0].file_id } })
  if (dl.status === 406 || dl.data.remaining === 0 && !dl.data.link) { console.log(`Daily quota used up. Stopping: ${dl.data.message ?? ''}`); break }
  if (dl.status !== 200 || !dl.data.link) { console.warn(`  download failed for ${m.title}: ${dl.status} ${dl.data.message ?? ''}`); await sleep(1000); continue }

  const text = await fetch(dl.data.link, { signal: AbortSignal.timeout(30000) }).then((r) => (r.ok ? r.text() : null))
  if (!text || text.length < 200) { console.warn(`  empty file for ${m.title}`); continue }
  await mkdir(path.join(SUBTITLES_DIR, m.id), { recursive: true })
  await writeFile(path.join(SUBTITLES_DIR, m.id, `${LANG}.srt`), text)
  done++
  console.log(`  + ${m.title}${m.year ? ` (${m.year})` : ''} -> ${m.id}/${LANG}.srt   (left today: ${dl.data.remaining ?? '?'})`)
  if (dl.data.remaining === 0) { console.log('Daily quota used up. Stopping.'); break }
  await sleep(1000)
}

console.log(`Done: ${done} downloaded, ${skipped} already had one, ${missing} not found on opensubtitles.`)
