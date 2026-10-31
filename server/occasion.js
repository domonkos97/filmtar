import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gemini } from './gemini.js'

// "What is today?" — asked once per calendar day and cached on disk. Gemini looks at the date
// (Hungarian holidays and observances first, then international ones, the days around it
// like the day after Halloween, then the season or the weekday) and says what kind of films fit.
const FILE = path.join(process.env.DATA_DIR || path.join(import.meta.dirname, 'data'), 'occasions.json')
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MOODS = ['light', 'deep', 'tense']

let cache = null
const load = async () => cache ??= await readFile(FILE, 'utf8').then(JSON.parse, () => ({}))
const save = async () => { await mkdir(path.dirname(FILE), { recursive: true }); await writeFile(FILE, JSON.stringify(cache, null, 2)) }

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
export const validDate = (d) => typeof d === 'string' && DATE_RE.test(d) && !Number.isNaN(Date.parse(d))

const PROMPT = `You tell a personal film-library app what is special about a given calendar day, so it can suggest films that fit.
Think about, in this order of preference:
1. Hungarian public holidays and well-known Hungarian observances (e.g. Mindenszentek on 1 November, Halottak napja on 2 November, Magyar Tudomány Napja on 3 November, Mikulás, March 15, August 20, October 23...).
2. Well-known international days and events that connect to films (Halloween, Valentine's Day, Christmas, Earth Day, Star Wars Day...). Also the days right around a big one: the day after Halloween still has the spooky mood.
3. Otherwise the season or the weekday mood (a Friday night, a rainy Sunday in autumn...).
Be accurate: only name a holiday or observance you are sure falls on that date. If unsure, fall back to the season or weekday instead of inventing something.
Write "headline" and "name" in Hungarian. "headline" is ONE or TWO sentences addressed to the user, starting with what today is ("Ma ... van"), and ending with what kind of films you therefore suggest and why, e.g. "Ma ... van, ezért ... filmeket ajánlok." Keep it warm and short (max ~220 characters).
"theme" is a short English description of the films that fit (topics, tone, genres), used to pick films.
"mood" is how heavy the evening should be: light, deep or tense.`

async function ask(date) {
  const d = new Date(`${date}T12:00:00Z`)
  const weekday = d.toLocaleDateString('hu-HU', { weekday: 'long', timeZone: 'UTC' })
  const long = d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const data = await gemini({
    systemInstruction: { parts: [{ text: PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: `Date: ${date} (${long}, ${weekday}). Country: Hungary.` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, headline: { type: 'STRING' }, theme: { type: 'STRING' },
          mood: { type: 'STRING', enum: MOODS },
        },
        required: ['name', 'headline', 'theme', 'mood'],
      },
    },
  })
  let o
  try { o = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') } catch { o = {} }
  const occ = { name: clip(o.name, 60), headline: clip(o.headline, 320), theme: clip(o.theme, 300), mood: MOODS.includes(o.mood) ? o.mood : 'light' }
  if (!occ.name || !occ.headline || !occ.theme) throw new Error('Gemini returned no usable occasion')
  return occ
}

const inflight = new Map()

// -> { name, headline, theme, mood }, or null when there is no key or Gemini fails (the caller falls back)
export async function getOccasion(date) {
  if (!validDate(date) || !process.env.GEMINI_API_KEY?.trim()) return null
  const c = await load()
  if (c[date]) return c[date]
  if (!inflight.has(date)) {
    inflight.set(date, ask(date)
      .then(async (occ) => { c[date] = occ; await save(); return occ })
      .catch((err) => { console.warn(`[occasion] ${date}: ${err.message}`); return null })
      .finally(() => inflight.delete(date)))
  }
  return inflight.get(date)
}
