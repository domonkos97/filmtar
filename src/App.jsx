import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Films from './components/Films'
import Discover from './components/Discover'
import Player from './components/Player'
import Assistant from './components/Assistant'
import { createCollection, setInCollection, setWatchlist } from './api/client'
import { useLibrary } from './hooks'
import { decadeOf, directorsOf } from './utils'

// filter: null | { kind: 'watchlist' } | { kind: 'collection' | 'genre' | 'decade' | 'director', id }
export default function App() {
  const { status, data, retry, refresh } = useLibrary()
  const [view, setView] = useState('discover')
  const [filter, setFilter] = useState(null)
  const [playing, setPlaying] = useState(null)
  const [asking, setAsking] = useState(false)
  const [sideOpen, setSideOpen] = useState(() => {
    try { return localStorage.getItem('side') !== 'closed' } catch { return true }
  })
  const toggleSide = () => setSideOpen((o) => {
    try { localStorage.setItem('side', o ? 'closed' : 'open') } catch { /* private mode */ }
    return !o
  })

  // Cmd/Ctrl+K toggles the assistant
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 'k') { e.preventDefault(); setAsking((a) => !a) }
      if (k === 'b') { e.preventDefault(); toggleSide() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line

  // filter lists for the sidebar, most common first
  const facets = useMemo(() => {
    const count = (pick) => {
      const counts = new Map()
      for (const m of data?.movies ?? []) for (const k of pick(m)) counts.set(k, (counts.get(k) ?? 0) + 1)
      return [...counts]
    }
    const byCount = ([an, ac], [bn, bc]) => bc - ac || String(an).localeCompare(String(bn))
    return {
      genres: count((m) => m.genreNames ?? []).sort(byCount).map(([id, n]) => ({ id, name: id, count: n })),
      decades: count((m) => (decadeOf(m) ? [decadeOf(m)] : [])).sort(([a], [b]) => b - a).map(([id, n]) => ({ id, name: `${id}-es évek`, count: n })),
      directors: count(directorsOf).sort(byCount).map(([id, n]) => ({ id, name: id, count: n })),
    }
  }, [data])

  if (status === 'loading') return <div className="status" aria-busy="true">Betöltés…</div>
  if (status === 'error') {
    return (
      <div className="status">
        <p>Nem sikerült betölteni a filmeket.</p>
        <button className="status__retry" onClick={retry}>Újra</button>
      </div>
    )
  }

  const save = (fn) => async (...args) => {
    try { await fn(...args); await refresh() } catch { window.alert('Nem sikerült menteni. Fut a backend?') }
  }
  const actions = {
    toggleWatchlist: save(setWatchlist),
    toggleInCollection: save(setInCollection),
    play: setPlaying,
  }
  const onCreateCollection = save(createCollection)

  const lists = { watchlist: data.watchlist, collections: data.collections }
  const collection = filter?.kind === 'collection' ? data.collections.find((c) => c.id === filter.id) : null
  let movies = data.movies
  let label = null
  let emptyText
  if (filter?.kind === 'watchlist') {
    movies = movies.filter((m) => data.watchlist.includes(m.id))
    label = 'Watchlist'
    emptyText = 'A watchlist még üres. A film oldalán a könyvjelző gombbal adhatsz hozzá.'
  } else if (collection) {
    movies = movies.filter((m) => collection.ids.includes(m.id))
    label = collection.name
    emptyText = 'Ez a gyűjtemény még üres. A film oldalán a „Gyűjteménybe” gombbal adhatsz hozzá.'
  } else if (filter?.kind === 'genre') {
    movies = movies.filter((m) => m.genreNames?.includes(filter.id))
    label = filter.id
  } else if (filter?.kind === 'decade') {
    movies = movies.filter((m) => decadeOf(m) === filter.id)
    label = `${filter.id}-es évek`
  } else if (filter?.kind === 'director') {
    movies = movies.filter((m) => directorsOf(m).includes(filter.id))
    label = filter.id
  }

  return (
    <div className="app" data-side={sideOpen ? 'open' : 'closed'}>
      <Sidebar
        view={view} onView={setView} filter={filter} onFilter={setFilter}
        watchlist={data.watchlist} collections={data.collections} facets={facets}
        onCreateCollection={onCreateCollection} onAssistant={() => setAsking(true)} open={sideOpen} onToggle={toggleSide}
      />
      {view === 'films'
        ? <Films key={filter ? `${filter.kind}:${filter.id ?? ''}` : 'all'} movies={movies} onChanged={refresh} label={label} emptyText={emptyText} lists={lists} actions={actions} />
        : <Discover movies={data.movies} progress={data.progress ?? {}} lists={lists} actions={actions} onChanged={refresh} />}
      {playing && (
        <Player
          movie={playing}
          startAt={(() => { const p = data.progress?.[playing.id]; return p && p.position / p.duration < 0.9 ? p.position : 0 })()}
          onClose={() => { setPlaying(null); refresh().catch(() => {}) }}
        />
      )}
      {!playing && <Assistant movies={data.movies} open={asking} onClose={() => setAsking(false)} />}
    </div>
  )
}
