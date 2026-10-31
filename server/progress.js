// How far the user got in each film, kept in server/data/progress.json (your data, not a cache).
// Powers "Folytasd" and "Még nem láttad" on the Discover page.
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FILE = path.join(process.env.DATA_DIR || path.join(import.meta.dirname, 'data'), 'progress.json')

let data = {} // id -> { position, duration, at }   (seconds, ms since epoch)
try { data = JSON.parse(readFileSync(FILE, 'utf8')) } catch { /* none yet */ }

async function save() {
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(data, null, 2))
}

export const getProgress = () => data

export async function setProgress(id, position, duration) {
  const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0
  if (!ok(position) || !ok(duration) || duration < 1) return null
  data[id] = { position: Math.round(position), duration: Math.round(duration), at: Date.now() }
  await save()
  return data[id]
}
