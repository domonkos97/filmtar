import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseName } from './parse.js'
import { getMeta, getMetaById, IMG } from './tmdb.js'
import { getChoice } from './choices.js'
import { getTitleStyle } from './titlestyle.js'

// TMDB genre ids -> Hungarian labels (so genres read the same whatever TMDB_LANGUAGE is)
const GENRES_HU = {
  28: 'Akció', 12: 'Kaland', 16: 'Animáció', 35: 'Vígjáték', 80: 'Krimi', 99: 'Dokumentum', 18: 'Dráma',
  10751: 'Családi', 14: 'Fantasy', 36: 'Történelmi', 27: 'Horror', 10402: 'Zenés', 9648: 'Rejtély',
  10749: 'Romantikus', 878: 'Sci-fi', 10770: 'TV-film', 53: 'Thriller', 10752: 'Háborús', 37: 'Western',
}

const VIDEO = new Set(['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.wmv'])

async function scan(dir, root = dir, out = []) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await scan(full, root, out)
    else if (VIDEO.has(path.extname(e.name).toLowerCase()) && !/\bsample\b/i.test(e.name)) {
      out.push({ file: full, dir: dir === root ? null : path.basename(dir) })
    }
  }
  return out
}

function guess({ file, dir }) {
  const fromFile = parseName(path.basename(file))
  if (fromFile.year || !dir) return fromFile
  const fromDir = parseName(dir) // "Movie (1999)/movie.mkv"
  return fromDir.year ? fromDir : fromFile
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const tone = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

async function pool(items, size, fn) {
  const results = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const n = i++; results[n] = await fn(items[n]) }
  }))
  return results
}

// id -> file path of the last scan; the stream route only serves files found here
let fileIndex = new Map()

export async function getFile(id, dir) {
  if (!fileIndex.has(id)) await getLibrary(dir)
  return fileIndex.get(id) ?? null
}

async function load(dir) {
  const files = await scan(dir)
  const movies = await pool(files, 5, async (f) => {
    const g = guess(f)
    const added = await stat(f.file).then((st) => Math.round(st.mtimeMs), () => 0) // when the file landed in the folder
    const tmdbDir = f.dir?.match(/^tmdb-(\d+)$/) // "tmdb-120/movie.mp4": the folder name is the TMDB id
    const meta = tmdbDir ? await getMetaById(tmdbDir[1]) : await getMeta(g.title, g.year)
    const title = meta?.title ?? (tmdbDir ? f.dir : g.title)
    const year = meta?.year ?? g.year
    const id = meta ? `tmdb-${meta.tmdbId}` : slug(`${title}-${year ?? ''}`)
    const c = meta ? getChoice(id) : undefined // user-picked images win over TMDB's defaults
    const logo = c?.logo ? `${IMG}/w500${c.logo}` : meta?.logo ?? null
    const titleStyle = logo ? null : getTitleStyle({ title, year, genres: meta?.genres, genreNames: meta?.genreNames, overview: meta?.overview })
    return {
      id, title, year, tone: tone(id), logo, titleStyle,
      ext: path.extname(f.file).slice(1).toLowerCase(),
      poster: c?.poster ? `${IMG}/w500${c.poster}` : meta?.poster ?? null,
      still: c?.still ? `${IMG}/w1280${c.still}` : meta?.still ?? null,
      thumb: c?.still ? `${IMG}/w780${c.still}` : meta?.thumb ?? null,
      overview: meta?.overview ?? null,
      runtime: meta?.runtime ?? null,
      rating: meta?.rating ?? null,
      added,
      director: meta?.director ?? null,
      genres: meta?.genres ?? [],
      genreNames: (meta?.genres ?? []).map((id, i) => GENRES_HU[id] ?? meta.genreNames?.[i]).filter(Boolean),
      file: f.file, // server-side only, for future streaming
    }
  })
  const index = new Map()
  for (const m of movies) if (!index.has(m.id)) index.set(m.id, m.file)
  fileIndex = index
  return movies.sort((a, b) => a.title.localeCompare(b.title))
}

let inflight = null
export function getLibrary(dir) {
  inflight ??= load(dir).finally(() => { inflight = null })
  return inflight
}
