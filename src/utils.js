// "The Lord of the Rings: The Fellowship of the Ring" -> ["The Lord of the Rings", "The Fellowship of the Ring"]
export function splitTitle(title) {
  const i = title.indexOf(': ')
  return i > 0 ? [title.slice(0, i), title.slice(i + 2)] : [title, '']
}

// "Lana Wachowski, Lilly Wachowski" -> ["Lana Wachowski", "Lilly Wachowski"]
export const directorsOf = (movie) => (movie.director ?? '').split(', ').filter(Boolean)

export const decadeOf = (movie) => (movie.year ? Math.floor(movie.year / 10) * 10 : null)

// Watch progress ({ position, duration } in seconds) -> { frac, left (minutes), done }, or null
export function progressInfo(p) {
  if (!p?.duration) return null
  const frac = p.position / p.duration
  return { frac, left: Math.max(1, Math.round((p.duration - p.position) / 60)), done: frac >= 0.9 }
}
