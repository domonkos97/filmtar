import { useEffect, useMemo, useRef, useState } from 'react'
import { assetUrl, recommend } from '../api/client'
import { BookmarkIcon, PlayIcon, SparkIcon } from './Icons'

// shown in turn in the empty box
const PLACEHOLDERS = [
  'Valami nyomasztó, mint a Hereditary, de kevésbé horror.',
  'A barátnőmmel néznénk, ne legyen túl nehéz, maximum két óra.',
  'Paris, Texas hangulat, de ma nincs hozzá türelmem.',
  'Valami, ami rövid, de nem hagy nyugodni.',
]

// quick constraints, appended to the request so you can see what was asked
const icon = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const CHIPS = [
  ['90 perc alatt', 'Legfeljebb 90 perces legyen.', icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)],
  ['Ketten néznénk', 'Ketten nézzük, közös élménynek.', icon(<><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 14.2c3 0 5.5 2.3 5.5 5.3" /></>)],
  ['Lepj meg', null, icon(<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />)],
]
const SURPRISE = 'Lepj meg valamivel, amit magamtól valószínűleg nem választanék.'
const ANOTHER = 'Mutass három másik filmet ugyanerre a kérésre.'

// kept while you are on other pages, so coming back to Discover finds the same picks
let memory = null
let auto = { key: null, promise: null } // the day's first request, made once and shared

const dayKey = () => new Date().toLocaleDateString('sv')
const cache = {
  read(key) { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ } },
}

function Idea({ movie, reason, saved, onOpen, onPlay, onSave }) {
  const src = assetUrl(movie.thumb ?? movie.still ?? movie.poster)
  return (
    <article className="idea">
      <button className="idea__img" style={{ '--tone': movie.tone ?? 220 }} aria-label={`${movie.title} részletei`} onClick={() => onOpen(movie.id)}>
        {src && <img src={src} alt="" loading="lazy" />}
      </button>
      <h3><button onClick={() => onOpen(movie.id)}>{movie.title}</button></h3>
      <p className="idea__meta">{[movie.year, movie.director, movie.runtime && `${movie.runtime} perc`].filter(Boolean).join(' · ')}</p>
      <p className="idea__why">{reason}</p>
      <div className="idea__bar">
        <button className="idea__play" onClick={() => onPlay(movie)}><PlayIcon width={16} height={16} /> Lejátszás</button>
        <button
          className="idea__save" aria-pressed={saved}
          aria-label={saved ? 'Eltávolítás a watchlistről' : 'Hozzáadás a watchlisthez'}
          title={saved ? 'A watchlisten van' : 'Hozzáadás a watchlisthez'}
          onClick={() => onSave(movie.id, !saved)}
        >
          <BookmarkIcon width={20} height={20} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  )
}

// The Discover headline: ask in your own words, get three ideas with a reason each, refine them.
// The first three come unasked, from today's occasion (cached for the day).
export default function Ask({ movies, occ, lists, actions, onOpen, fallback }) {
  const [text, setText] = useState(memory?.text ?? '') // starts empty; the first three ideas come from today's occasion
  const [picks, setPicks] = useState(memory?.picks ?? []) // [{ movie, reason }]
  const [busy, setBusy] = useState(!memory)
  const [error, setError] = useState(null) // null | message
  const [hint, setHint] = useState(0)
  const asked = useRef(memory?.asked ?? occ.ask) // the request the current picks answer
  const shown = useRef(memory?.shown ?? []) // ids already shown for it, so "other three" never repeats

  useEffect(() => {
    if (text) return
    const every = setInterval(() => setHint((n) => (n + 1) % PLACEHOLDERS.length), 4500)
    return () => clearInterval(every)
  }, [text])

  const byId = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies])
  const toPicks = (raw) => raw.filter((p) => byId.has(p.id)).map((p) => ({ movie: byId.get(p.id), reason: p.reason }))

  useEffect(() => { if (picks.length) memory = { text, picks, asked: asked.current, shown: shown.current } })

  async function run(query, refine) {
    const previous = refine ? picks.map((p) => p.movie.id) : []
    if (!refine) shown.current = []
    asked.current = query
    setBusy(true)
    setError(null)
    try {
      const { picks: raw } = await recommend({ query, refine, previous, exclude: shown.current, context: `${occ.name}: ${occ.sub}` })
      const next = toPicks(raw)
      if (!next.length) throw new Error('no picks')
      shown.current = [...shown.current, ...next.map((p) => p.movie.id)].slice(-12)
      setPicks(next)
    } catch (err) {
      setError(/^404/.test(err.message)
        ? 'A backend még a régi verziót futtatja. Állítsd le, és indítsd újra: npm run server.'
        : 'Most nem sikerült ajánlást kérni. Fut a backend, és be van állítva a GEMINI_API_KEY? Próbáld újra egy perc múlva.')
    } finally {
      setBusy(false)
    }
  }

  // today's first three: from the day's cache, otherwise ask once (shared if you leave and come back meanwhile)
  useEffect(() => {
    if (memory) return
    const key = dayKey()
    const done = (raw) => {
      const next = toPicks(raw)
      if (!next.length) throw new Error('no picks')
      shown.current = next.map((p) => p.movie.id)
      setPicks(next)
      setBusy(false)
    }
    const cached = cache.read(`ideas:${key}`)
    if (Array.isArray(cached) && toPicks(cached).length) return done(cached)
    if (auto.key !== key) {
      const promise = recommend({ query: occ.ask, context: `${occ.name}: ${occ.sub}` })
        .then(({ picks: raw }) => { cache.write(`ideas:${key}`, raw); return raw })
        .catch((err) => { auto = { key: null, promise: null }; throw err })
      auto = { key, promise }
    }
    auto.promise.then(done).catch(() => { setPicks(fallback); setBusy(false) }) // no AI right now: show what fits today
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => { e.preventDefault(); if (!busy) run(text.trim()) }
  const chip = (add) => {
    if (busy) return
    const t = add ? (text.includes(add) ? text : `${text.trim()} ${add}`.trim()) : SURPRISE
    setText(t)
    run(t)
  }

  const refine = [
    [occ.mood === 'tense' ? 'Kevésbé ijesztőt' : 'Könnyedebbet', occ.mood === 'tense' ? 'Kevésbé ijesztő, kevésbé véres filmeket kérek.' : 'Könnyedebb, kevésbé nehéz hangulatú filmeket kérek.'],
    ['Rövidebbet', 'Rövidebb filmeket kérek, mint az előzőek.'],
    ['Merészebbet', 'Merészebbet és szokatlanabbat kérek, kevésbé kézenfekvőt.'],
  ]

  return (
    <>
      <form className="askbox" data-busy={busy} onSubmit={submit}>
        <span className="askbox__icon"><SparkIcon width={22} height={22} /></span>
        <div className="askbox__field">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder={PLACEHOLDERS[hint]} aria-label="Mihez van kedved?" />
          <span>{movies.length} film a könyvtáradból · <kbd>Enter</kbd> a küldéshez</span>
        </div>
        <button className="askbox__go" disabled={busy} aria-label="Ajánlj filmeket">
          {busy
            ? <span className="askbox__spin" />
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
        </button>
      </form>
      <div className="askchips">
        {CHIPS.map(([label, add, ico]) => <button key={label} disabled={busy} onClick={() => chip(add)}>{ico}{label}</button>)}
      </div>

      <section className="disc__sec disc__sec--rule">
        <div className="disc__row">
          <h2 className="disc__h disc__h--big">Három ötlet az estédhez</h2>
          <button className="another" disabled={busy || !picks.length} onClick={() => run(asked.current, ANOTHER)}>
            Másik hármat
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>
          </button>
        </div>

        {error && <p className="ask__error">{error}</p>}

        <div className="ideas" data-busy={busy}>
          {busy && !picks.length
            ? [0, 1, 2].map((i) => <div key={i} className="idea idea--skeleton"><div className="idea__img" /><h3 /><p /></div>)
            : picks.map((p) => (
              <Idea
                key={p.movie.id} {...p}
                saved={lists.watchlist.includes(p.movie.id)}
                onOpen={onOpen} onPlay={actions.play} onSave={actions.toggleWatchlist}
              />
            ))}
        </div>

        {picks.length > 0 && (
          <div className="refine" aria-label="Finomítás">
            {refine.map(([label, ask]) => <button key={label} disabled={busy} onClick={() => run(asked.current, ask)}>{label}</button>)}
          </div>
        )}
      </section>
    </>
  )
}
