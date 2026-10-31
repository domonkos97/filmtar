// Movie assistant: a chat with Gemini that knows the user's library.
// The library is sent as compact context on every request, so it can recommend what is
// on the disk ("short but thrilling"), name similar films ("like The Thing") or look
// things up ("what is the shortest film?").
// A "lite" model: answers in ~1-2 s, where the big flash model was taking a minute or more
// (and often 503ing). Override with GEMINI_ASSISTANT_MODEL.
const MODEL = () => process.env.GEMINI_ASSISTANT_MODEL || 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 30000
const MAX_TURNS = 20
const MAX_CHARS = 2000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One Gemini call. The free tier answers 503/429 under load, so retry a couple of times.
async function gemini(body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY.trim() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.ok) return res.json()
    if (attempt < 2 && (res.status === 503 || res.status === 429)) { await sleep(1200 * (attempt + 1)); continue }
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}

const today = () => new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

export const hasAssistant = () => Boolean(process.env.GEMINI_API_KEY?.trim())

const line = (m) => [
  `${m.title}${m.year ? ` (${m.year})` : ''}`,
  m.runtime && `${m.runtime} perc`,
  m.rating && `★${m.rating}`,
  m.director,
  m.genreNames?.join('/'),
].filter(Boolean).join(' | ')

const systemPrompt = (movies) => `You are the film assistant of a personal movie library app. Today is ${today()}; take the date into account when it matters (holidays, season, weekend). Reply in the language the user writes in (usually Hungarian), concisely and with personality: short paragraphs or a short list, no filler.

The user's library (${movies.length} films) is listed below as: title (year) | runtime | rating | director | genres.
- When the user wants a pick or a recommendation, prefer films FROM THE LIBRARY and say so. Respect constraints such as runtime ("short" = under ~95 minutes unless told otherwise) and mood.
- When asked for "similar to X" you may also suggest well-known films that are NOT in the library; mark those clearly (e.g. "nincs a könyvtárban").
- For questions about the library (shortest, longest, best rated, by director...) answer from the list below and compare the numbers carefully.
- For general film questions (e.g. the shortest film ever made) answer from your own knowledge, and say when you are unsure instead of guessing.
- Never invent films, runtimes or facts.

LIBRARY:
${movies.map(line).join('\n')}`

export async function askAssistant(messages, movies) {
  const turns = (Array.isArray(messages) ? messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text.slice(0, MAX_CHARS) }] }))
  if (!turns.length || turns.at(-1).role !== 'user') throw Object.assign(new Error('need a user message'), { status: 400 })

  const data = await gemini({ systemInstruction: { parts: [{ text: systemPrompt(movies) }] }, contents: turns })
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
  if (!text) throw new Error('Gemini returned no text')
  return text
}

// ---- Discover: "what should I watch?" -> three picks from the library, each with a reason ----

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

const seenLabel = (p) => (!p?.duration ? 'unseen' : p.position / p.duration >= 0.9 ? 'seen' : 'started')

const recLine = (m, progress) => [
  `[${m.id}]`,
  `${m.title}${m.year ? ` (${m.year})` : ''}`,
  m.runtime && `${m.runtime} min`,
  m.rating && `★${m.rating}`,
  m.director,
  m.genreNames?.join('/'),
  seenLabel(progress[m.id]),
  m.overview && clip(m.overview, 120),
].filter(Boolean).join(' | ')

const recPrompt = (movies, progress) => `You pick films to watch tonight from the user's personal library. Today is ${today()}.

Choose exactly 3 DIFFERENT films from the list below and refer to them by the id in square brackets, exactly as written.
For each pick write "reason": ONE Hungarian sentence (max ~140 characters) saying concretely why it fits THIS request: mood, pace, runtime, who is watching. No spoilers, don't repeat the title, no filler like "remek film".
Rules:
- The user's request always wins. Hard limits (maximum runtime, who watches, "not horror") must be respected.
- Today's context (date, holiday, season, weekday) is only given when the user asked for nothing specific. Then let it steer the picks and say so in the reason where natural. If a request is given, ignore the date completely unless the request itself mentions it.
- Every genre, mood or tone named in the request is a hard requirement: "funny" means comedies, "light" means no horror or heavy drama, "scary" means horror/thrillers.
- Prefer films marked "unseen" or "started" unless the user asks for something they know.
- When a refinement is given (lighter, shorter, bolder...) change the previous three accordingly and keep what still fits.
- Do not repeat films the user was already shown ("already shown"), unless fewer than 3 suitable films remain.
- Vary the three picks a little (era, tone, director) unless the request asks for a very specific style.

LIBRARY (id | title | runtime | rating | director | genres | seen | synopsis):
${movies.map((m) => recLine(m, progress)).join('\n')}`

export async function recommend(input, movies, progress) {
  const known = new Map(movies.map((m) => [m.id, m]))
  const ids = (v) => (Array.isArray(v) ? v.filter((id) => known.has(id)).slice(-12) : [])
  const previous = ids(input.previous)
  const shown = ids(input.exclude)
  const query = clip(input.query, 400)
  const refine = clip(input.refine, 200)
  // the date only matters when the user asked for nothing: otherwise "Halloween" hijacks "something funny"
  const context = query ? '' : clip(input.context, 300)
  if (!query && !refine && !context) throw Object.assign(new Error('need a request'), { status: 400 })

  const title = (id) => known.get(id).title
  const text = [
    `Request: ${query || '(none, surprise me)'}`,
    context && `Today's context: ${context}`,
    refine && `Refinement of the previous picks: ${refine}`,
    previous.length && `Previous three: ${previous.map(title).join('; ')}`,
    shown.length && `Already shown: ${shown.map(title).join('; ')}`,
  ].filter(Boolean).join('\n')

  const data = await gemini({
    systemInstruction: { parts: [{ text: recPrompt(movies, progress) }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          picks: {
            type: 'ARRAY',
            minItems: 3,
            maxItems: 3,
            items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, reason: { type: 'STRING' } }, required: ['id', 'reason'] },
          },
        },
        required: ['picks'],
      },
    },
  })
  let parsed
  try { parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') } catch { parsed = {} }
  const seen = new Set()
  const picks = (parsed.picks ?? [])
    .filter((p) => known.has(p?.id) && !seen.has(p.id) && seen.add(p.id)) // only real library films, once each
    .map((p) => ({ id: p.id, reason: clip(p.reason, 220) }))
  if (!picks.length) throw new Error('Gemini returned no usable picks')
  return picks
}
