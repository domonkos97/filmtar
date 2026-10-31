import { useEffect, useState } from 'react'
import { assetUrl, getImages, setChoice } from '../api/client'

// kind = which field of the film it sets; list = which TMDB group it browses
const KINDS = [
  ['poster', 'Poszter', 'posters', 'A lista bélyegképe'],
  ['still', 'Háttérkép', 'backdrops', 'A részletek nagy képe'],
  ['logo', 'Logó', 'logos', 'A cím a kártyákon'],
]

export default function ImagePicker({ movie, onClose, onChanged }) {
  const [kind, setKind] = useState('still')
  const [images, setImages] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    getImages(movie.id, ctrl.signal).then(setImages).catch((e) => { if (e.name !== 'AbortError') setError(e) })
    return () => ctrl.abort()
  }, [movie.id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [, , group, hint] = KINDS.find(([k]) => k === kind)
  const list = images?.[group] ?? []
  const current = movie[kind]

  async function choose(path) {
    setBusy(true)
    try {
      await setChoice(movie.id, { [kind]: path })
      await onChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="picker" role="dialog" aria-label="Képek módosítása" onClick={(e) => e.stopPropagation()}>
        <header className="picker__head">
          <div>
            <h2>{movie.title}</h2>
            <p>{hint}</p>
          </div>
          <button className="picker__close" aria-label="Bezárás" onClick={onClose}>✕</button>
        </header>

        <nav className="picker__tabs">
          {KINDS.map(([k, label, g]) => (
            <button key={k} aria-current={kind === k ? 'true' : undefined} onClick={() => setKind(k)}>
              {label}{images && <span> {images[g].length}</span>}
            </button>
          ))}
          <button className="linkbtn picker__reset" disabled={busy} onClick={() => choose(null)}>Alapértelmezett</button>
        </nav>

        <div className="picker__body" data-busy={busy}>
          {error && <p className="picker__msg">Nem sikerült: {error.message}</p>}
          {!images && !error && <p className="picker__msg">Képek betöltése…</p>}
          {images && list.length === 0 && <p className="picker__msg">Ehhez nincs elérhető kép a TMDB-n.</p>}
          <div className={`picker__grid picker__grid--${kind}`}>
            {list.map((img) => (
              <button key={img.path} className="pick" data-active={Boolean(current?.endsWith(img.path))} disabled={busy} onClick={() => choose(img.path)}>
                <span className="pick__img"><img src={assetUrl(img.thumb)} alt="" loading="lazy" /></span>
                <span className="pick__meta">{img.lang ?? 'nincs szöveg'} · {img.width}×{img.height}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
