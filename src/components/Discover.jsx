import { useMemo, useState } from 'react'
import { assetUrl } from '../api/client'
import { directorsOf, decadeOf, progressInfo } from '../utils'
import Ask from './Ask'
import Detail from './Detail'
import { occasionOf, occasionScore } from '../occasion'

// TMDB genre ids
const G = { comedy: 35, animation: 16, family: 10751, romance: 10749, music: 10402, drama: 18, history: 36, doc: 99, war: 10752, horror: 27, thriller: 53, crime: 80, mystery: 9648 }
const has = (m, ...ids) => ids.some((id) => m.genres?.includes(id))

// "Vagy válassz hangulatot": each mood is a filter over the library.
const MOODS = [
  ['light', 'Könnyed', (m) => has(m, G.comedy, G.animation, G.family, G.romance, G.music) && !has(m, G.horror, G.thriller)],
  ['deep', 'Elmélyülős', (m) => (has(m, G.drama, G.history, G.doc, G.war) || m.runtime >= 130) && !has(m, G.horror)],
  ['tense', 'Feszült', (m) => has(m, G.thriller, G.horror, G.crime, G.mystery)],
]

// small seeded random, so a draw stays put while you browse
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const shuffled = (list, rand) => list.map((x) => [rand(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1])

// a short pitch from the synopsis: the first sentence or two, at most ~170 characters
function pitch(text) {
  if (!text) return ''
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]
  let out = ''
  for (const s of sentences) { if ((out + s).length > 170 && out) break; out += s }
  return out.length > 190 ? `${out.slice(0, 187).trimEnd()}…` : out.trim()
}

// two films that go together, and one sentence on why
function bestPair(pool, rand) {
  const list = shuffled(pool, rand).slice(0, 60)
  let best = null
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i], list[j]]
      const dir = directorsOf(a).find((d) => directorsOf(b).includes(d))
      const shared = (a.genres ?? []).filter((g) => b.genres?.includes(g))
      const score = (dir ? 6 : 0) + shared.length * 2 + (decadeOf(a) === decadeOf(b) ? 1 : 0) + rand() * 1.5
      if (!best || score > best.score) best = { a, b, dir, shared, score }
    }
  }
  if (!best) return null
  const { a, b, dir, shared } = best
  let why = 'Két film, ugyanaz az este.'
  if (dir) why = `Mindkettőt ${dir} rendezte: két film, ugyanaz a kéz.`
  else if (shared.length) {
    const name = a.genreNames?.[a.genres.indexOf(shared[0])]?.toLowerCase()
    const gap = Math.abs((a.year ?? 0) - (b.year ?? 0))
    why = name ? (gap ? `Két ${name}, ${gap} év különbséggel.` : `Két ${name} ugyanabból az évből.`) : why
  }
  return { films: [a, b], why }
}

function Resume({ movie, info, onPlay }) {
  const src = assetUrl(movie.thumb ?? movie.still ?? movie.poster)
  return (
    <button className="dres" onClick={() => onPlay(movie)}>
      <span className="dres__img" style={{ '--tone': movie.tone ?? 220 }}>{src && <img src={src} alt="" loading="lazy" />}</span>
      <span className="dres__text">
        <strong>{movie.title}</strong>
        <span className="dres__bar"><i style={{ width: `${Math.round(info.frac * 100)}%` }} /></span>
        <span className="dres__left">Még {info.left} perc</span>
      </span>
    </button>
  )
}

const still = (m) => assetUrl(m.still ?? m.thumb ?? m.poster)

export default function Discover({ movies, progress, lists, actions, onChanged }) {
  const { occ, date } = useMemo(() => ({ occ: occasionOf(), date: new Date().toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' }) }), [])
  const [mood, setMood] = useState(occ.mood)
  const [roll, setRoll] = useState(0) // bumped by every mood click: a fresh draw
  const [base] = useState(() => Math.floor(Math.random() * 1e9))
  const [openId, setOpenId] = useState(null)

  const info = useMemo(() => Object.fromEntries(movies.map((m) => [m.id, progressInfo(progress[m.id])])), [movies, progress])
  const unseen = movies.filter((m) => !progress[m.id])
  const resume = movies
    .filter((m) => info[m.id] && !info[m.id].done && info[m.id].frac > 0.02)
    .sort((a, b) => progress[b.id].at - progress[a.id].at)
    .slice(0, 4)

  // shown if the AI is unavailable: what fits today best, with a line from the synopsis
  const fallback = useMemo(() => {
    const rated = (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
    const pool = unseen.length >= 3 ? unseen : movies
    return pool.map((m) => [occasionScore(m, occ), m]).sort((a, b) => b[0] - a[0] || rated(a[1], b[1])).slice(0, 3)
      .map(([, m]) => ({ movie: m, reason: pitch(m.overview) || `${occ.name} estéjére.` }))
  }, [movies, progress, occ]) // eslint-disable-line react-hooks/exhaustive-deps

  const { pair, again } = useMemo(() => {
    const filter = MOODS.find(([id]) => id === mood)[2]
    const rand = rng(base + roll * 7919)
    const pool = movies.filter(filter)
    const fresh = pool.filter((m) => !progress[m.id])
    const seen = pool.filter((m) => info[m.id]?.done)
    const pair = bestPair(fresh.length >= 2 ? fresh : pool, rand)
    const taken = new Set(pair?.films.map((m) => m.id))
    const rewatch = shuffled(seen.filter((m) => !taken.has(m.id)), rand)[0]
    if (rewatch) return { pair, again: { movie: rewatch, title: 'Újranézném', sub: 'Ismerős filmek, új szemmel.' } }
    const other = shuffled(fresh.filter((m) => !taken.has(m.id)), rand)[0]
    return { pair, again: other && { movie: other, title: 'Még nem láttad', sub: 'Amihez még nem nyúltál.' } }
  }, [movies, progress, info, mood, roll, base])

  const open = movies.find((m) => m.id === openId)

  return (
    <div className="discover">
      <header className="disc__head">
        <div>
          <h1 className="disc__title">Mit nézzünk ma este?</h1>
          <p className="disc__sub">Mondd el, mihez van kedved. A saját filmjeidből válogatok.</p>
        </div>
        <p className="disc__date">{date} · {occ.name}</p>
      </header>

      <Ask movies={movies} occ={occ} lists={lists} actions={actions} onOpen={setOpenId} fallback={fallback} />

      {resume.length > 0 && (
        <section className="disc__sec disc__sec--rule">
          <h2 className="disc__h disc__h--big">Folytasd</h2>
          <div className="dres__row">{resume.map((m) => <Resume key={m.id} movie={m} info={info[m.id]} onPlay={actions.play} />)}</div>
        </section>
      )}

      <section className="disc__sec disc__sec--rule">
        <div className="disc__row disc__row--tabs">
          <h2 className="disc__h disc__h--big">Vagy válassz hangulatot</h2>
          <nav className="dmood__tabs" aria-label="Hangulat">
            {MOODS.map(([id, label]) => (
              <button key={id} aria-current={mood === id ? 'true' : undefined} onClick={() => { setMood(id); setRoll((n) => n + 1) }}>{label}</button>
            ))}
          </nav>
        </div>

        <div className="banners">
          {pair && (
            <div className="banner banner--pair">
              {pair.films.map((m) => (
                <button key={m.id} className="banner__half" style={{ '--tone': m.tone ?? 220 }} aria-label={m.title} onClick={() => setOpenId(m.id)}>
                  {still(m) && <img src={still(m)} alt="" loading="lazy" />}
                </button>
              ))}
              <div className="banner__text">
                <h3>Kettős vetítés</h3>
                <p>{pair.why}</p>
                <small>{pair.films.map((m) => m.title).join('  +  ')}</small>
              </div>
            </div>
          )}
          {again && (
            <button className="banner" style={{ '--tone': again.movie.tone ?? 220 }} onClick={() => setOpenId(again.movie.id)}>
              {still(again.movie) && <img className="banner__bg" src={still(again.movie)} alt="" loading="lazy" />}
              <span className="banner__text">
                <h3>{again.title}</h3>
                <p>{again.sub}</p>
                <small>{again.movie.title}</small>
              </span>
            </button>
          )}
          {!pair && !again && <p className="empty">Ehhez a hangulathoz most nincs film a könyvtárban.</p>}
        </div>
      </section>

      {open && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setOpenId(null)}>
          <div className="dmodal" role="dialog" aria-modal="true" aria-label={open.title}>
            <button className="dmodal__x" aria-label="Bezárás" onClick={() => setOpenId(null)}>✕</button>
            <Detail key={open.id} movie={open} onChanged={onChanged} inWatchlist={lists.watchlist.includes(open.id)} collections={lists.collections} actions={actions} />
          </div>
        </div>
      )}
    </div>
  )
}
