import { useState } from 'react'
import { assetUrl } from '../api/client'

// Portrait card for the grid view: the film poster, with the title below it.
export default function Poster({ movie, active, onSelect }) {
  const [failed, setFailed] = useState(false)
  const src = assetUrl(movie.poster ?? movie.thumb ?? movie.still)
  const meta = [movie.year, movie.director].filter(Boolean).join(' · ')

  return (
    <a href="#" className="poster" data-active={active} onClick={(e) => { e.preventDefault(); onSelect?.() }}>
      <div className="poster__img" style={{ '--tone': movie.tone ?? 220 }}>
        {src && !failed && <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
      </div>
      <h3 className="poster__title">{movie.title}</h3>
      {meta && <p className="poster__meta">{meta}</p>}
    </a>
  )
}
