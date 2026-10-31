import { useEffect, useRef, useState } from 'react'
import Detail from './Detail'
import Poster from './Poster'
import Row from './Row'
import SortMenu from './SortMenu'
import { SearchIcon, GridIcon, ListIcon } from './Icons'

// What the list is sorted by (the library itself is in title order)
const FAR = 1e9
const SORTS = [
  ['title', 'Cím A–Z', null],
  ['newest', 'Legújabb', (a, b) => (b.year ?? 0) - (a.year ?? 0)],
  ['oldest', 'Legrégebbi', (a, b) => (a.year ?? FAR) - (b.year ?? FAR)],
  ['added', 'Most hozzáadott', (a, b) => (b.added ?? 0) - (a.added ?? 0)],
  ['rating', 'Értékelés', (a, b) => (b.rating ?? 0) - (a.rating ?? 0)],
  ['longest', 'Leghosszabb', (a, b) => (b.runtime ?? 0) - (a.runtime ?? 0)],
  ['shortest', 'Legrövidebb', (a, b) => (a.runtime ?? FAR) - (b.runtime ?? FAR)],
]
const STEP = 10 // films loaded at a time as you scroll
const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Films({ movies, onChanged, label, emptyText, lists, actions }) {
  const [sort, setSort] = useState('title')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('list')
  const [shown, setShown] = useState(STEP)
  const [selectedId, setSelectedId] = useState(null)
  const scroller = useRef(null)
  const sentinel = useRef(null)

  const q = norm(query.trim())
  const filtered = movies
    .filter((m) => !q || norm(m.title).includes(q) || norm(m.director).includes(q))
    .sort(SORTS.find(([id]) => id === sort)[2] ?? undefined)

  const items = filtered.slice(0, shown)
  const hasMore = shown < filtered.length
  const selected = filtered.find((m) => m.id === selectedId) ?? items[0]

  // any filter/sort/view change starts again from the top with the first batch
  const change = (set) => (v) => { set(v); setShown(STEP); scroller.current?.scrollTo({ top: 0 }) }

  // load the next batch when the end of the list comes into view (re-armed after every batch,
  // so a short list keeps filling until the screen is full)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setShown((n) => n + STEP) }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown, hasMore, view, filtered.length])

  return (
    <div className="main">
      <header className="head">
        <div className="head__top">
          <h1>Filmek.<span className="head__count">{label ? `${label} · ` : ''}{filtered.length}</span></h1>
          <div className="head__tools">
            <label className="search">
              <SearchIcon width={26} height={26} strokeWidth={1.6} />
              <input value={query} onChange={(e) => change(setQuery)(e.target.value)} placeholder="Keresés a filmek között…" />
            </label>
            <SortMenu options={SORTS} value={sort} onChange={change(setSort)} />
            <div className="toggle">
              <button aria-label="Rács" aria-pressed={view === 'grid'} onClick={() => change(setView)('grid')}><GridIcon /></button>
              <button aria-label="Lista" aria-pressed={view === 'list'} onClick={() => change(setView)('list')}><ListIcon /></button>
            </div>
          </div>
        </div>
      </header>

      <div className="scroller" ref={scroller}>
        {items.length === 0 ? (
          <div className="empty">{q ? 'Nincs találat.' : emptyText ?? 'Nincs találat.'}</div>
        ) : view === 'list' ? (
          <ol className="list">
            {items.map((m) => (
              <li key={m.id}>
                <Row movie={m} active={m.id === selected?.id} onSelect={() => setSelectedId(m.id)} />
              </li>
            ))}
          </ol>
        ) : (
          <div className="cards">
            {items.map((m) => <Poster key={m.id} movie={m} active={m.id === selected?.id} onSelect={() => setSelectedId(m.id)} />)}
          </div>
        )}
        {hasMore && <div className="sentinel" ref={sentinel} />}
      </div>

      {selected && <Detail key={selected.id} movie={selected} onChanged={onChanged} inWatchlist={lists.watchlist.includes(selected.id)} collections={lists.collections} actions={actions} />}

      <footer className="foot">
        <span>{items.length} / {filtered.length} film</span>
      </footer>
    </div>
  )
}
