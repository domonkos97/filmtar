import { useEffect, useRef, useState } from 'react'
import { CheckIcon } from './Icons'

const WIDTH = 220

// "Rendezés: Cím A–Z ▾" dropdown. Replaces a row of tabs that overflowed on narrow windows.
export default function SortMenu({ options, value, onChange }) {
  const [pos, setPos] = useState(null) // null = closed
  const ref = useRef(null)
  const trigger = useRef(null)
  const open = pos !== null
  const current = options.find(([id]) => id === value)

  function toggle() {
    if (open) return setPos(null)
    const r = trigger.current.getBoundingClientRect() // fixed, so the scrolling list never clips it
    const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8))
    setPos({ left, top: r.bottom + 6 })
  }

  useEffect(() => {
    if (!open) return
    const close = () => setPos(null)
    const outside = (e) => { if (!ref.current?.contains(e.target)) close() }
    const esc = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="menuwrap sort" ref={ref}>
      <button ref={trigger} className="sort__btn" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <span className="sort__label">Rendezés</span>
        <span className="sort__value">{current?.[1]}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="menu sort__menu" role="menu" style={{ ...pos, width: WIDTH, minWidth: 0 }}>
          {options.map(([id, label]) => (
            <button key={id} role="menuitemradio" aria-checked={id === value} onClick={() => { onChange(id); setPos(null) }}>
              <span className="sort__check">{id === value && <CheckIcon />}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
