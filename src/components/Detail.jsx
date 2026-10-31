import { useState } from 'react'
import { assetUrl } from '../api/client'
import { PlayIcon, BookmarkIcon, ImageIcon } from './Icons'
import { splitTitle } from '../utils'
import CollectionMenu from './CollectionMenu'
import ImagePicker from './ImagePicker'

export default function Detail({ movie, onChanged, inWatchlist, collections, actions }) {
  const [picking, setPicking] = useState(false)
  const [failed, setFailed] = useState(null)

  const img = assetUrl(movie.still ?? movie.thumb ?? movie.poster)
  const [title, sub] = splitTitle(movie.title)
  const meta = [movie.year, movie.director, movie.runtime && `${movie.runtime} perc`, movie.rating && `★ ${movie.rating}`].filter(Boolean)

  return (
    <section className="detail">
      <div className="detail__img" style={{ '--tone': movie.tone ?? 220 }}>
        {img && failed !== img && <img key={img} src={img} alt="" onError={() => setFailed(img)} />}
        {movie.id.startsWith('tmdb-') && (
          <button className="img-edit" aria-label="Képek módosítása" title="Képek módosítása" onClick={() => setPicking(true)}>
            <ImageIcon width={16} height={16} />
          </button>
        )}
      </div>
      <div className="detail__body">
        <div className="detail__row">
          <h2>{title}{sub && <small>{sub}</small>}</h2>
          <button className="btn-play" onClick={() => actions.play(movie)}><PlayIcon width={16} height={16} /> Lejátszás</button>
          <button
            className="btn-save"
            aria-pressed={inWatchlist}
            aria-label={inWatchlist ? 'Eltávolítás a watchlistről' : 'Hozzáadás a watchlisthez'}
            title={inWatchlist ? 'A watchlisten van – kattints az eltávolításhoz' : 'Hozzáadás a watchlisthez'}
            onClick={() => actions.toggleWatchlist(movie.id, !inWatchlist)}
          >
            <BookmarkIcon fill={inWatchlist ? 'currentColor' : 'none'} />
          </button>
        </div>
        <p className="detail__meta">{meta.map((m) => <span key={m}>{m}</span>)}</p>
        {movie.overview && <p className="detail__overview">{movie.overview}</p>}

        <div className="detail__tools">
          <CollectionMenu collections={collections} movieId={movie.id} onToggle={actions.toggleInCollection} />
        </div>
      </div>
      {picking && <ImagePicker movie={movie} onClose={() => setPicking(false)} onChanged={onChanged} />}
    </section>
  )
}
