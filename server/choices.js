// Per-film image choices, kept in server/data/choices.json (your data, not a cache).
// { "tmdb-603": { poster: "/abc.jpg", still: "/def.jpg", logo: "/ghi.png" } }  (TMDB file paths)
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FILE = path.join(process.env.DATA_DIR || path.join(import.meta.dirname, 'data'), 'choices.json')
const KINDS = ['poster', 'still', 'logo']

let data = {}
try { data = JSON.parse(readFileSync(FILE, 'utf8')) } catch { /* none yet */ }

export const getChoice = (id) => data[id]

// patch: { poster?: path | null, still?: path | null, logo?: path | null }; null resets to default.
export async function setChoice(id, patch) {
  const cur = { ...data[id] }
  for (const k of KINDS) {
    if (!(k in patch)) continue
    if (patch[k] == null) delete cur[k]
    else cur[k] = patch[k]
  }
  if (Object.keys(cur).length) data[id] = cur
  else delete data[id]
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(data, null, 2))
  return data[id] ?? {}
}
