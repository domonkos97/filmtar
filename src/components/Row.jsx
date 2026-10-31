import { useState } from 'react'
import { assetUrl } from '../api/client'
import { splitTitle } from '../utils'

function Poster({ movie }) {
  const [failed, setFailed] = useState(false)
  const src = assetUrl(movie.poster ?? movie.thumb ?? movie.still)
  return (
    <span className="row__thumb" style={{ '--tone': movie.tone ?? 220 }}>
      {src && !failed && <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </span>
  )
}

export default function Row({ movie, active, onSelect }) {
  const [main, sub] = splitTitle(movie.title)
  const meta = [movie.year, movie.runtime && `${movie.runtime} perc`].filter(Boolean).join(' · ')

  return (
    <button className="row" data-active={active} onClick={onSelect}>
      <Poster movie={movie} />
      <span className="row__text">
        {movie.genreNames?.[0] && <span className="row__genre">{movie.genreNames[0]}</span>}
        <span className="row__main">{main}</span>
        {sub && <span className="row__sub">{sub}</span>}
        {movie.director && <span className="row__dir">{movie.director}</span>}
        <span className="row__meta">{meta}</span>
      </span>
    </button>
  )
}
