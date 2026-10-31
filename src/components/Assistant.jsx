import { useEffect, useRef, useState } from 'react'
import { askAssistant, assetUrl } from '../api/client'

const SUGGESTIONS = [
  ['Rövid, de izgalmas', 'Rövid, de izgalmas filmet szeretnék'],
  ['Mint a The Thing', 'Mondj hasonló filmeket, mint a The Thing'],
  ['Legrövidebb film', 'Mi a legrövidebb film?'],
  ['Mit nézzek ma este?', 'Mit nézzek ma este a könyvtáramból?'],
]

// **bold** inside a line
const inline = (text) => text.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : t))

// Tiny markdown: paragraphs, "- " / "1. " lists, **bold**
function Rich({ text }) {
  const blocks = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/)
    if (item) {
      const ordered = /^\d/.test(line)
      const last = blocks.at(-1)
      if (last?.list && last.ordered === ordered) last.items.push(item[1])
      else blocks.push({ list: true, ordered, items: [item[1]] })
    } else blocks.push({ p: line })
  }
  return blocks.map((b, i) => {
    if (!b.list) return <p key={i}>{inline(b.p)}</p>
    const L = b.ordered ? 'ol' : 'ul'
    return <L key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</L>
  })
}

// Library films named in a reply, shown as small poster cards under it
function mentioned(text, movies) {
  const t = text.toLowerCase()
  return movies.filter((m) => m.poster && m.title.length > 2 && t.includes(m.title.toLowerCase())).slice(0, 6)
}

function Film({ movie }) {
  return (
    <figure className="afilm">
      <img src={assetUrl(movie.poster)} alt="" loading="lazy" />
      <figcaption>{movie.title}{movie.year ? <span>{movie.year}</span> : null}</figcaption>
    </figure>
  )
}

// Chat modal. Always mounted (so the conversation survives closing), rendered only when open.
export default function Assistant({ open, onClose, movies = [] }) {
  const [messages, setMessages] = useState([]) // { role, text, error? }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  const field = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages, busy, open])
  useEffect(() => { if (open) field.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function send(text) {
    text = text.trim()
    if (!text || busy) return
    const next = [...messages.filter((m) => !m.error), { role: 'user', text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const { reply } = await askAssistant(next)
      setMessages([...next, { role: 'assistant', text: reply }])
    } catch {
      setMessages([...next, { role: 'assistant', text: 'Most nem érem el az asszisztenst. Fut a backend, és be van állítva a GEMINI_API_KEY?', error: true }])
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal modal--ai" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="assistant" role="dialog" aria-modal="true" aria-label="Filmasszisztens">
        <header className="assistant__head">
          <div className="assistant__title">
            <strong>Asszisztens<i className="assistant__dot" /></strong>
            <span>{movies.length} film a könyvtáradból</span>
          </div>
          {messages.length > 0 && <button className="assistant__reset" onClick={() => setMessages([])}>Új beszélgetés</button>}
          <button className="assistant__x" aria-label="Bezárás" onClick={onClose}><kbd>esc</kbd></button>
        </header>

        <div className="assistant__log" aria-live="polite">
          {messages.length === 0 ? (
            <div className="assistant__hello">
              <h2>Mit nézzünk<i className="assistant__dot" /></h2>
              <p>Kérj ajánlatot a könyvtárad alapján, vagy kérdezz bármit a filmekről.</p>
              <div className="assistant__chips">
                {SUGGESTIONS.map(([label, text]) => <button key={label} onClick={() => send(text)}>{label}</button>)}
              </div>
            </div>
          ) : messages.map((m, i) => (
            <div key={i} className={`amsg amsg--${m.role}`} data-error={m.error}>
              <div className="amsg__col">
                <div className="amsg__bubble">{m.role === 'assistant' ? <Rich text={m.text} /> : m.text}</div>
                {m.role === 'assistant' && !m.error && (() => {
                  const films = mentioned(m.text, movies)
                  return films.length > 0 && <div className="afilms">{films.map((f) => <Film key={f.id} movie={f} />)}</div>
                })()}
              </div>
            </div>
          ))}
          {busy && (
            <div className="amsg amsg--assistant">
              <div className="amsg__bubble"><span className="dots"><i /><i /><i /></span></div>
            </div>
          )}
          <div ref={end} />
        </div>

        <form className="assistant__form" onSubmit={(e) => { e.preventDefault(); send(input) }}>
          <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Kérdezz valamit a filmekről…" aria-label="Üzenet" maxLength={2000} />
          <button disabled={busy || !input.trim()} aria-label="Küldés">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </form>
      </section>
    </div>
  )
}
