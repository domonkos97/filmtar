// Picks a title style (font, case, tracking) for films that have no official TMDB logo.
// Gemini chooses from a curated font list; the browser renders the real title text,
// so the spelling is always right. Without a Gemini key a genre heuristic is used.
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const FONTS = {
  bebas: 'Bebas Neue: tall condensed capitals, action / thriller / blockbuster',
  playfair: 'Playfair Display: elegant high-contrast serif, drama / romance / literary',
  cinzel: 'Cinzel: Roman inscriptional capitals, epic / historical / war',
  cormorant: 'Cormorant Garamond: delicate thin serif, art-house / horror when widely spaced',
  'special-elite': 'Special Elite: typewriter, noir / crime / mystery / documentary',
  fredoka: 'Fredoka: soft rounded sans, animation / family / light comedy',
  'space-grotesk': 'Space Grotesk: techy geometric sans, sci-fi / modern',
  inter: 'Inter Black: neutral heavy sans, contemporary / anything else',
}

const FILE = path.join(import.meta.dirname, '.cache', 'styles.json')
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const TRACKING = ['tight', 'normal', 'wide']

let cache = {}
try { cache = JSON.parse(readFileSync(FILE, 'utf8')) } catch { /* first run */ }
const save = async () => { await mkdir(path.dirname(FILE), { recursive: true }); await writeFile(FILE, JSON.stringify(cache, null, 2)) }

// TMDB genre ids
function heuristic(g = []) {
  const has = (...ids) => ids.some((id) => g.includes(id))
  if (has(27)) return { font: 'cormorant', uppercase: true, tracking: 'wide' }
  if (has(16, 10751)) return { font: 'fredoka', uppercase: false, tracking: 'normal' }
  if (has(878)) return { font: 'space-grotesk', uppercase: true, tracking: 'wide' }
  if (has(28, 53)) return { font: 'bebas', uppercase: true, tracking: 'normal' }
  if (has(80, 9648)) return { font: 'special-elite', uppercase: false, tracking: 'normal' }
  if (has(36, 10752, 37)) return { font: 'cinzel', uppercase: true, tracking: 'wide' }
  if (has(18, 10749)) return { font: 'playfair', uppercase: false, tracking: 'normal' }
  return { font: 'inter', uppercase: false, tracking: 'tight' }
}

async function askGemini({ title, year, genreNames, overview }) {
  const prompt = `You design movie title treatments for a personal film archive.
Pick the typography that best matches the mood, era and genre of this film (ideally echoing its own title art).

Film: ${title}${year ? ` (${year})` : ''}
Genres: ${genreNames?.join(', ') || 'unknown'}
${overview ? `Synopsis: ${overview}\n` : ''}
Available fonts:
${Object.entries(FONTS).map(([k, d]) => `- ${k}: ${d}`).join('\n')}

Answer with JSON: font (one of the keys), uppercase (boolean), tracking (tight | normal | wide).`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY.trim() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            font: { type: 'STRING', enum: Object.keys(FONTS) },
            uppercase: { type: 'BOOLEAN' },
            tracking: { type: 'STRING', enum: TRACKING },
          },
          required: ['font', 'uppercase', 'tracking'],
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const s = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
  if (!(s.font in FONTS) || !TRACKING.includes(s.tracking)) throw new Error('Gemini returned an invalid style')
  return { font: s.font, uppercase: Boolean(s.uppercase), tracking: s.tracking }
}

// Gemini free tier is rate limited, so refinements run one at a time in the background.
const queue = []
const pending = new Set()
const failedAt = new Map()
let running = false
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function drain() {
  running = true
  while (queue.length) {
    const { key, info } = queue.shift()
    try {
      cache[key] = await askGemini(info)
      await save()
    } catch (err) {
      failedAt.set(key, Date.now())
      console.warn(`[gemini] ${info.title}: ${err.message}`)
    }
    pending.delete(key)
    await sleep(4000)
  }
  running = false
}

// Synchronous: returns the cached Gemini style, or a heuristic one right away while
// Gemini refines it in the background (picked up on the next request).
export function getTitleStyle(info) {
  const key = `${info.title.toLowerCase()}|${info.year ?? ''}`
  if (cache[key]) return cache[key]
  if (process.env.GEMINI_API_KEY && !pending.has(key) && Date.now() - (failedAt.get(key) ?? 0) > 10 * 60 * 1000) {
    pending.add(key)
    queue.push({ key, info })
    if (!running) drain()
  }
  return heuristic(info.genres)
}
