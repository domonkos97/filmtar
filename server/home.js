// Builds the /api/library payload: every film plus the user's own lists.
// Collections are made by the user (empty at first); only the watchlist is built in.
export const publicMovie = ({ file, ...m }) => m // `file` is server-side only

export function buildLibrary(movies, lists, progress = {}) {
  const present = new Set(movies.map((m) => m.id))
  const keep = (ids) => ids.filter((id) => present.has(id)) // forget films that left the folder
  return {
    movies: movies.map(publicMovie),
    watchlist: keep(lists.watchlist),
    progress: Object.fromEntries(Object.entries(progress).filter(([id]) => present.has(id))),
    collections: lists.collections.map((c) => ({ ...c, ids: keep(c.ids) })),
  }
}
