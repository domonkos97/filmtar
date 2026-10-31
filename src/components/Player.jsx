import { useEffect, useRef, useState } from 'react'
import { getSubtitles, saveProgress, streamUrl, subtitleUrl } from '../api/client'
import { Back10, CcIcon, ChevronLeft, Fwd10, FullscreenIcon, PauseIcon, PlayIcon, VolumeIcon } from './Icons'

const clock = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(x).padStart(2, '0')}`
}

// Full-screen player for a local film, with our own controls. Esc or "Vissza" closes it.
// Remembers how far you got (saved every few seconds) and picks up from there (`startAt`, seconds).
// Keys: space/k play, ←/→ ±10 s, ↑/↓ volume, m mute, f fullscreen, c subtitles.
export default function Player({ movie, startAt = 0, onClose }) {
  const [error, setError] = useState(false)
  const [idle, setIdle] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('vol') ?? 1))
  const [muted, setMuted] = useState(false)
  const [subs, setSubs] = useState([])
  const [sub, setSub] = useState(() => localStorage.getItem('sub') ?? '') // '' = off
  const [menu, setMenu] = useState(false)
  const [full, setFull] = useState(false)
  const [hover, setHover] = useState(null) // { x, t } over the progress bar
  const timer = useRef(null)
  const video = useRef(null)
  const box = useRef(null)

  const save = () => {
    const v = video.current
    if (v && v.duration > 0 && v.currentTime > 5) saveProgress(movie.id, v.currentTime, v.duration)
  }
  const finish = () => { save(); onClose() }

  const toggle = () => { const v = video.current; if (!v) return; if (v.paused) v.play(); else v.pause() }
  const seek = (t) => { const v = video.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, t)) }
  const skip = (d) => video.current && seek(video.current.currentTime + d)
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())
  const pickSub = (lang) => { setSub(lang); setMenu(false); try { localStorage.setItem('sub', lang) } catch { /* private mode */ } }

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'Escape') { if (menu) setMenu(false); else if (!document.fullscreenElement) finish(); return }
      if (k === ' ' || k === 'k') toggle()
      else if (k === 'ArrowLeft') skip(-10)
      else if (k === 'ArrowRight') skip(10)
      else if (k === 'ArrowUp') changeVolume(Math.min(1, volume + 0.1))
      else if (k === 'ArrowDown') changeVolume(Math.max(0, volume - 0.1))
      else if (k === 'm') setMuted((x) => !x)
      else if (k === 'f') toggleFull()
      else if (k === 'c' && subs.length) pickSub(sub ? '' : subs[0].lang)
      else return
      e.preventDefault()
      wake()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    const every = setInterval(() => video.current && !video.current.paused && save(), 10000)
    window.addEventListener('pagehide', save)
    return () => { clearInterval(every); window.removeEventListener('pagehide', save) }
  }, [movie.id])

  useEffect(() => {
    const onFull = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFull)
    return () => document.removeEventListener('fullscreenchange', onFull)
  }, [])

  useEffect(() => {
    let live = true
    getSubtitles(movie.id).then((list) => live && setSubs(list))
    return () => { live = false }
  }, [movie.id])

  // show the chosen subtitle track only
  useEffect(() => {
    const v = video.current
    if (!v) return
    for (const t of v.textTracks) t.mode = t.language === sub ? 'showing' : 'disabled'
  }, [sub, subs])

  // controls fade out while the mouse is still and the film is playing
  const wake = () => {
    setIdle(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setIdle(true), 2800)
  }
  useEffect(() => { wake(); return () => clearTimeout(timer.current) }, [])

  const changeVolume = (x) => {
    setVolume(x); setMuted(false)
    try { localStorage.setItem('vol', String(x)) } catch { /* private mode */ }
  }
  useEffect(() => { const v = video.current; if (v) { v.volume = volume; v.muted = muted } }, [volume, muted])

  const resume = () => {
    const v = video.current
    setDuration(v.duration)
    if (startAt > 0 && v.duration - startAt > 30) v.currentTime = startAt
  }

  const onProgress = () => {
    const v = video.current
    const b = v.buffered
    for (let i = 0; i < b.length; i++) if (b.start(i) <= v.currentTime && v.currentTime <= b.end(i)) setBuffered(b.end(i))
  }

  const frac = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }

  const showControls = !idle || !playing || menu

  return (
    <div className="player" ref={box} data-idle={!showControls} onMouseMove={wake} onMouseLeave={() => playing && setIdle(true)}>
      <video
        ref={video}
        src={streamUrl(movie.id)}
        crossOrigin="anonymous"
        autoPlay
        playsInline
        onClick={toggle}
        onDoubleClick={toggleFull}
        onLoadedMetadata={resume}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); save() }}
        onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); onProgress() }}
        onProgress={onProgress}
        onError={() => setError(true)}
      >
        {subs.map((s) => <track key={s.lang} kind="subtitles" src={subtitleUrl(movie.id, s.lang)} srcLang={s.lang} label={s.label} />)}
      </video>

      <div className="player__bar">
        <button onClick={finish}><ChevronLeft width={20} height={20} /> Vissza</button>
        <span>{movie.title}{movie.year ? ` (${movie.year})` : ''}</span>
      </div>

      {!playing && !error && duration > 0 && (
        <button className="player__big" onClick={toggle} aria-label="Lejátszás"><PlayIcon width={34} height={34} /></button>
      )}

      <div className="player__controls">
        <div
          className="pbar"
          onClick={(e) => seek(frac(e) * duration)}
          onMouseMove={(e) => setHover({ x: frac(e), t: frac(e) * duration })}
          onMouseLeave={() => setHover(null)}
        >
          <div className="pbar__track">
            <i className="pbar__buf" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <i className="pbar__done" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
          </div>
          <b className="pbar__knob" style={{ left: `${duration ? (time / duration) * 100 : 0}%` }} />
          {hover && <em className="pbar__tip" style={{ left: `${hover.x * 100}%` }}>{clock(hover.t)}</em>}
        </div>

        <div className="pctl">
          <button onClick={toggle} aria-label={playing ? 'Szünet' : 'Lejátszás'} title="Lejátszás / szünet (szóköz)">
            {playing ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
          </button>
          <button onClick={() => skip(-10)} aria-label="10 mp vissza" title="10 mp vissza (←)"><Back10 width={22} height={22} /></button>
          <button onClick={() => skip(10)} aria-label="10 mp előre" title="10 mp előre (→)"><Fwd10 width={22} height={22} /></button>
          <div className="pctl__vol">
            <button onClick={() => setMuted((x) => !x)} aria-label="Némítás" title="Némítás (m)"><VolumeIcon muted={muted || volume === 0} width={22} height={22} /></button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Hangerő" />
          </div>
          <span className="pctl__time">{clock(time)} <u>/</u> {clock(duration)}</span>
          <span className="pctl__spacer" />
          <div className="pctl__cc">
            {menu && (
              <div className="pmenu" role="menu">
                <p>FELIRAT</p>
                <button role="menuitemradio" aria-checked={!sub} onClick={() => pickSub('')}>Ki</button>
                {subs.map((s) => <button key={s.lang} role="menuitemradio" aria-checked={sub === s.lang} onClick={() => pickSub(s.lang)}>{s.label}</button>)}
              </div>
            )}
            <button
              onClick={() => subs.length && setMenu((x) => !x)}
              disabled={!subs.length}
              data-on={Boolean(sub)}
              aria-label="Felirat"
              title={subs.length ? 'Felirat (c)' : 'Ehhez a filmhez nincs felirat'}
            >
              <CcIcon width={22} height={22} />
            </button>
          </div>
          <button onClick={toggleFull} aria-label="Teljes képernyő" title="Teljes képernyő (f)"><FullscreenIcon exit={full} width={22} height={22} /></button>
        </div>
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
