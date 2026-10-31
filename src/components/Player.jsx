import { useEffect, useRef, useState } from 'react'
import { saveProgress, streamUrl } from '../api/client'
import { ChevronLeft } from './Icons'

// Full-screen player for a local film. Esc or "Vissza" closes it. Remembers how far you got
// (saved every few seconds) and picks up from there next time (`startAt`, seconds).
export default function Player({ movie, startAt = 0, onClose }) {
  const [error, setError] = useState(false)
  const [idle, setIdle] = useState(false)
  const timer = useRef(null)
  const video = useRef(null)

  const save = () => {
    const v = video.current
    if (v && v.duration > 0 && v.currentTime > 5) saveProgress(movie.id, v.currentTime, v.duration)
  }
  const finish = () => { save(); onClose() }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.fullscreenElement && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    const every = setInterval(() => video.current && !video.current.paused && save(), 10000)
    window.addEventListener('pagehide', save)
    return () => { clearInterval(every); window.removeEventListener('pagehide', save) }
  }, [movie.id])

  // the top bar fades out while the mouse is still
  const wake = () => {
    setIdle(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setIdle(true), 2500)
  }
  useEffect(() => { wake(); return () => clearTimeout(timer.current) }, [])

  const resume = () => {
    const v = video.current
    if (startAt > 0 && v.duration - startAt > 30) v.currentTime = startAt
  }

  return (
    <div className="player" data-idle={idle} onMouseMove={wake}>
      <video ref={video} src={streamUrl(movie.id)} controls autoPlay playsInline autoFocus onLoadedMetadata={resume} onPause={save} onError={() => setError(true)} />
      <div className="player__bar">
        <button onClick={finish}><ChevronLeft width={20} height={20} /> Vissza</button>
        <span>{movie.title}{movie.year ? ` (${movie.year})` : ''}</span>
      </div>
      {error && (
        <div className="player__error">
          <p>Ezt a fájlt nem tudja lejátszani a böngésző{movie.ext ? ` (.${movie.ext})` : ''}.</p>
          <p>A böngészők főleg az MP4 (H.264 videó, AAC hang) és a WebM fájlokat játsszák le. Más formátumhoz (pl. MKV, AVI) a fájlt át kell alakítani.</p>
          <button onClick={onClose}>Vissza</button>
        </div>
      )}
    </div>
  )
}
