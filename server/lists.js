// The user's own lists, kept in server/data/lists.json (your data, not a cache):
// the watchlist plus any collections they create. Movies are referenced by id.
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FILE = path.join(process.env.DATA_DIR || path.join(import.meta.dirname, 'data'), 'lists.json')

let data = { watchlist: [], collections: [] }
try { data = { ...data, ...JSON.parse(readFileSync(FILE, 'utf8')) } } catch { /* none yet */ }

async function save() {
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(data, null, 2))
}

const toggle = (ids, id, on) => (on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id))

export const getLists = () => data

export async function setWatchlist(id, on) {
  data.watchlist = toggle(data.watchlist, id, on)
  await save()
  return { watchlist: data.watchlist }
}

export async function createCollection(name) {
  const clean = typeof name === 'string' ? name.trim() : ''
  if (!clean || clean.length > 40) return null
  const collection = { id: `c${Date.now().toString(36)}`, name: clean, ids: [] }
  data.collections.push(collection)
  await save()
  return collection
}

export async function setInCollection(collectionId, id, on) {
  const c = data.collections.find((x) => x.id === collectionId)
  if (!c) return null
  c.ids = toggle(c.ids, id, on)
  await save()
  return c
}
