import { useState } from 'react'
import { assetUrl } from '../api/client'

// The film's official title logo if there is one, otherwise the title set in the
// style picked by the backend (font / case / letter-spacing).
export default function TitleArt({ movie, className = '' }) {
  const [failed, setFailed] = useState(false)
  const logo = assetUrl(movie.logo)

  if (logo && !failed) {
    return <img className={`titleart titleart--logo ${className}`} src={logo} alt={movie.title} onError={() => setFailed(true)} />
  }
  const s = movie.titleStyle ?? {}
  return (
    <span
      className={`titleart ${className}`}
      data-font={s.font ?? 'inter'}
      data-case={s.uppercase ? 'upper' : 'normal'}
      data-tracking={s.tracking ?? 'normal'}
    >
      {movie.title}
    </span>
  )
}
