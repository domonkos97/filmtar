const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

// Image fields may be absolute URLs or paths relative to the API origin.
export function assetUrl(path) {
  if (!path) return null
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path
  const origin = API_URL.startsWith('http') ? new URL(API_URL).origin : ''
  return origin + (path.startsWith('/') ? path : `/${path}`)
}

async function get(path, signal) {
  const res = await fetch(`${API_URL}${path}`, { signal })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// Expected shape:
// { watchlist: [movie id], collections: [{ id, name, ids: [movie id] }],
//   progress: { [movie id]: { position, duration, at } }  (seconds)
//   movies: [{ id, title, year, director, runtime, overview, rating, added, genreNames, still, thumb, poster, logo, tone }],
//  }
export const getLibrary = (signal) => get('/library', signal)

// All TMDB images for a film: { posters, backdrops, logos: [{ path, thumb, lang, width, height }] }
export const getImages = (id, signal) => get(`/movies/${encodeURIComponent(id)}/images`, signal)

// body: { poster?, still?, logo? } with a TMDB file path, or null to reset to the default
export async function setChoice(id, body) {
  const res = await fetch(`${API_URL}/movies/${encodeURIComponent(id)}/choice`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function send(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const setWatchlist = (movieId, on) => send('PUT', `/watchlist/${encodeURIComponent(movieId)}`, { on })
export const createCollection = (name) => send('POST', '/collections', { name })
export const setInCollection = (collectionId, movieId, on) =>
  send('PUT', `/collections/${encodeURIComponent(collectionId)}/movies/${encodeURIComponent(movieId)}`, { on })

// URL of the film's video file (the backend serves it with Range support)
export const streamUrl = (id) => `${API_URL}/movies/${encodeURIComponent(id)}/stream`

// messages: [{ role: 'user' | 'assistant', text }] -> { reply }
export const askAssistant = (messages) => send('POST', '/assistant', { messages })

// Remember how far the user got (seconds). Fire and forget; keepalive lets it survive a closing tab.
export const saveProgress = (id, position, duration) =>
  fetch(`${API_URL}/movies/${encodeURIComponent(id)}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position, duration }),
    keepalive: true,
  }).catch(() => {})

// body: { query, refine?, previous?: [id], exclude?: [id], context? } -> { picks: [{ id, reason }] }
export const recommend = (body) => send('POST', '/recommend', body)
