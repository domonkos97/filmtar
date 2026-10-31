import { useState } from 'react'
import { SearchIcon, BookmarkIcon, GridIcon, FolderIcon, PlusIcon, SparkIcon, MenuIcon } from './Icons'

const same = (a, b) => a && b && a.kind === b.kind && a.id === b.id
const ICON = { width: 20, height: 20, strokeWidth: 1.7 }
const SHOWN = 8

// A folded filter list (genres, decades, directors); the active item always stays visible.
function Facet({ title, noun, kind, items, filter, pick }) {
  const [all, setAll] = useState(false)
  if (!items.length) return null
  const shown = all ? items : items.filter((it, i) => i < SHOWN || same(filter, { kind, id: it.id }))
  return (
    <>
      <div className="side__label"><span>{title}</span></div>
      <ul className="slist">
        {shown.map((it) => (
          <li key={it.id}>
            <button className="sitem sitem--text" aria-current={same(filter, { kind, id: it.id }) ? 'true' : undefined} onClick={() => pick({ kind, id: it.id })}>
              <span className="name">{it.name}</span>
              <span className="count">{it.count}</span>
            </button>
          </li>
        ))}
      </ul>
      {items.length > SHOWN && (
        <button className="side__more" onClick={() => setAll(!all)}>{all ? 'Kevesebb' : `Mind a ${items.length} ${noun}`}</button>
      )}
    </>
  )
}

export default function Sidebar({ view, onView, filter, onFilter, watchlist, collections, facets, onCreateCollection, onAssistant, open, onToggle }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const current = view === 'discover' ? 'discover' : filter?.kind === 'watchlist' ? 'list' : 'films'
  const pick = (f) => { onView('films'); onFilter(same(filter, f) ? null : f) }

  const NAV = [
    ['discover', 'Felfedezés', <SearchIcon key="i" {...ICON} />, () => onView('discover')],
    ['films', 'Filmek', <GridIcon key="i" {...ICON} />, () => { onView('films'); onFilter(null) }],
    ['list', 'Saját lista', <BookmarkIcon key="i" {...ICON} />, () => { onView('films'); onFilter({ kind: 'watchlist' }) }],
  ]

  async function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setAdding(false)
    await onCreateCollection(n)
    setName('')
    setAdding(false)
  }

  return (
    <aside className="side">
      <div className="side__top">
        {open && <a href="#" className="brand" onClick={(e) => { e.preventDefault(); onView('discover'); onFilter(null) }}>filmtár</a>}
        <button className="side__toggle" aria-label={open ? 'Oldalsáv összecsukása' : 'Oldalsáv megnyitása'} title={`${open ? 'Összecsukás' : 'Megnyitás'} (⌘B)`} onClick={onToggle}>
          <MenuIcon width={20} height={20} />
        </button>
      </div>

      <nav className="nav">
        {NAV.map(([id, label, icon, go]) => (
          <button key={id} className="sitem" title={label} aria-current={current === id ? 'page' : undefined} onClick={go}>
            <span className="sitem__icon">{current === id ? <span className="nav__dot" /> : icon}</span>
            <span className="name">{label}</span>
          </button>
        ))}
        <button className="sitem" title="Asszisztens (⌘K)" onClick={onAssistant}>
          <span className="sitem__icon"><SparkIcon {...ICON} /></span>
          <span className="name">Asszisztens</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
      </nav>

      <hr className="side__rule" />

      <div className="side__label">
        <span>Gyűjtemények</span>
        <button aria-label="Új gyűjtemény" title="Új gyűjtemény" onClick={() => setAdding(true)}><PlusIcon width={16} height={16} /></button>
      </div>
      <ul className="slist">
        <li>
          <button className="sitem" aria-current={filter?.kind === 'watchlist' ? 'true' : undefined} onClick={() => pick({ kind: 'watchlist' })}>
            <span className="sitem__icon"><BookmarkIcon {...ICON} /></span>
            <span className="name">Watchlist</span>
            <span className="count">{watchlist.length}</span>
          </button>
        </li>
        {collections.map((c) => (
          <li key={c.id}>
            <button className="sitem" aria-current={same(filter, { kind: 'collection', id: c.id }) ? 'true' : undefined} onClick={() => pick({ kind: 'collection', id: c.id })}>
              <span className="sitem__icon"><FolderIcon {...ICON} /></span>
              <span className="name">{c.name}</span>
              <span className="count">{c.ids.length}</span>
            </button>
          </li>
        ))}
        {adding && (
          <li>
            <form className="sitem sitem--new" onSubmit={submit}>
              <span className="sitem__icon"><FolderIcon {...ICON} /></span>
              <input
                autoFocus value={name} maxLength={40} placeholder="Gyűjtemény neve"
                onChange={(e) => setName(e.target.value)}
                onBlur={submit}
                onKeyDown={(e) => e.key === 'Escape' && (setName(''), setAdding(false))}
              />
            </form>
          </li>
        )}
      </ul>

      <Facet title="Műfajok" noun="műfaj" kind="genre" items={facets.genres} filter={filter} pick={pick} />
      <Facet title="Évtizedek" noun="évtized" kind="decade" items={facets.decades} filter={filter} pick={pick} />
      <Facet title="Rendezők" noun="rendező" kind="director" items={facets.directors} filter={filter} pick={pick} />
    </aside>
  )
}
