import { useEffect, useRef, useState } from 'react'
import { FolderIcon, CheckIcon } from './Icons'

const WIDTH = 260

// Dropdown to put a film into (or take it out of) the user's own collections.
export default function CollectionMenu({ collections, movieId, onToggle }) {
  const [pos, setPos] = useState(null) // null = closed
  const ref = useRef(null)
  const trigger = useRef(null)
  const open = pos !== null

  function toggle(e) {
    e.stopPropagation()
    if (open) return setPos(null)
    // fixed position, so the menu is never clipped by the scrolling list
    const r = trigger.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8))
    setPos(window.innerHeight - r.bottom < 280 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 })
  }

  useEffect(() => {
    if (!open) return
    const close = () => setPos(null)
    const outside = (e) => { if (!ref.current?.contains(e.target)) close() }
    const esc = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', close, true) // a scrolling list would leave the menu behind
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="menuwrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button ref={trigger} className="btn-edit" aria-expanded={open} onClick={toggle}>
        <FolderIcon width={17} height={17} /> Gyűjteménybe
      </button>
      {open && (
        <div className="menu" role="menu" style={pos}>
          {collections.length === 0 && <p className="menu__empty">Még nincs gyűjteményed. A bal oldali „+” gombbal hozhatsz létre egyet.</p>}
          {collections.map((c) => {
            const on = c.ids.includes(movieId)
            return (
              <button key={c.id} role="menuitemcheckbox" aria-checked={on} onClick={() => onToggle(c.id, movieId, !on)}>
                <span className="menu__check">{on && <CheckIcon />}</span>
                {c.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
