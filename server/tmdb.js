import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const API = 'https://api.themoviedb.org/3'
export const IMG = 'https://image.tmdb.org/t/p'
const CACHE_FILE = path.join(import.meta.dirname, '.cache', 'tmdb.json')
const MISS_TTL = 24 * 60 * 60 * 1000

const key = () => process.env.TMDB_API_KEY?.trim()
const language = () => process.env.TMDB_LANGUAGE || 'en-US'
export const hasKey = () => Boolean(key())

async function tmdb(route, params = {}) {
  const k = key()
  const isToken = k.length > 40 // v4 "read access token" (JWT) vs v3 api key
  const url = new URL(API + route)
  for (const [n, v] of Object.entries({ language: language(), ...params })) {
    if (v != null) url.searchParams.set(n, v)
  }
  if (!isToken) url.searchParams.set('api_key', k)
  const res = await fetch(url, { headers: isToken ? { Authorization: `Bearer ${k}` } : {} })
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${route}`)
  return res.json()
}

let cache = null
async function loadCache() {
  if (cache) return cache
  try { cache = JSON.parse(await readFile(CACHE_FILE, 'utf8')) } catch { cache = {} }
  return cache
}
async function saveCache() {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
}

async function lookup(title, year) {
  let search = await tmdb('/search/movie', { query: title, year })
  // wrong year in the file name? retry without it
  if (!search.results?.length && year) search = await tmdb('/search/movie', { query: title })
  const hit = search.results?.[0]
  if (!hit) return null
  return fetchById(hit.id, year)
}

async function fetchById(id, year) {
  const d = await tmdb(`/movie/${id}`, { append_to_response: 'credits,images', include_image_language: `${language().slice(0, 2)},en,null` })
  const lang = language().slice(0, 2)
  // textless backdrops (no language) so the title logo can be laid over them cleanly
  const backdrop = (d.images?.backdrops ?? [])
    .filter((b) => b.iso_639_1 == null)
    .sort((a, b) => b.vote_average - a.vote_average)[0]?.file_path ?? d.backdrop_path
  const logo = (d.images?.logos ?? [])
    .filter((l) => !l.file_path.endsWith('.svg'))
    .sort((a, b) => (b.iso_639_1 === lang) - (a.iso_639_1 === lang) || (b.iso_639_1 === 'en') - (a.iso_639_1 === 'en') || b.vote_average - a.vote_average)[0]
  return {
    tmdbId: d.id,
    title: d.title,
    year: d.release_date ? Number(d.release_date.slice(0, 4)) : year,
    overview: d.overview || null,
    runtime: d.runtime || null,
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    genres: (d.genres ?? []).map((g) => g.id),
    genreNames: (d.genres ?? []).map((g) => g.name),
    director: (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name).join(', ') || null,
    poster: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
    still: backdrop ? `${IMG}/w1280${backdrop}` : null,
    thumb: backdrop ? `${IMG}/w780${backdrop}` : null,
    logo: logo ? `${IMG}/w500${logo.file_path}` : null,
  }
}

// Returns metadata for { title, year } or null. Cached on disk (server/.cache/tmdb.json).
export async function getMeta(title, year) {
  if (!hasKey()) return null
  const c = await loadCache()
  const k = `v8|${language()}|${title.toLowerCase()}|${year ?? ''}`
  const hit = c[k]
  if (hit && !(hit.miss && Date.now() - hit.at > MISS_TTL)) return hit.miss ? null : hit.meta

  try {
    const meta = await lookup(title, year)
    c[k] = meta ? { meta } : { miss: true, at: Date.now() }
    await saveCache()
    return meta
  } catch (err) {
    console.warn(`[tmdb] ${title} (${year ?? '?'}): ${err.message}`)
    return null // not cached, retried on next request
  }
}

// Every image TMDB has for a film (all languages), for the picker in the UI.
export async function getImages(tmdbId) {
  const d = await tmdb(`/movie/${tmdbId}/images`, { language: null })
  const map = (list, size) => (list ?? [])
    .filter((i) => !i.file_path.endsWith('.svg'))
    .map((i) => ({ path: i.file_path, thumb: `${IMG}/${size}${i.file_path}`, lang: i.iso_639_1, width: i.width, height: i.height, votes: i.vote_average }))
    .sort((a, b) => b.votes - a.votes)
  return { posters: map(d.posters, 'w342'), backdrops: map(d.backdrops, 'w500'), logos: map(d.logos, 'w300') }
}

// Same metadata when the TMDB id is already known (folders named "tmdb-<id>").
export async function getMetaById(id) {
  if (!hasKey()) return null
  const c = await loadCache()
  const k = `v8|${language()}|id|${id}`
  const hit = c[k]
  if (hit && !(hit.miss && Date.now() - hit.at > MISS_TTL)) return hit.miss ? null : hit.meta
  try {
    const meta = await fetchById(id, null)
    c[k] = { meta }
    await saveCache()
    return meta
  } catch (err) {
    console.warn(`[tmdb] id ${id}: ${err.message}`)
    if (/ 404 /.test(err.message)) { c[k] = { miss: true, at: Date.now() }; await saveCache() }
    return null
  }
}
