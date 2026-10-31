import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// Subtitles live next to the films: <SUBTITLES_DIR>/<film id>/<lang>.vtt (or .srt, converted on the fly).
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/
const NAMES = { en: 'English', hu: 'Magyar', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português', ru: 'Русский', pl: 'Polski', cs: 'Čeština', sk: 'Slovenčina', ro: 'Română' }

const dirFor = (root, id) => path.join(root, id)

export async function listSubtitles(root, id) {
  let files
  try { files = await readdir(dirFor(root, id)) } catch { return [] }
  const langs = new Set()
  for (const f of files) {
    const m = f.match(/^(.+)\.(vtt|srt)$/i)
    if (m && LANG_RE.test(m[1])) langs.add(m[1])
  }
  return [...langs].sort((a, b) => (b === 'hu') - (a === 'hu') || (b === 'en') - (a === 'en') || a.localeCompare(b))
    .map((lang) => ({ lang, label: NAMES[lang.slice(0, 2)] ?? lang }))
}

// SRT -> WebVTT: header, "," -> "." in the timestamps, drop the cue numbers' trouble by keeping them (valid VTT ids)
const srtToVtt = (srt) => 'WEBVTT\n\n' + srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

export async function readSubtitle(root, id, lang) {
  if (!LANG_RE.test(lang)) return null
  for (const ext of ['vtt', 'srt']) {
    try {
      const raw = await readFile(path.join(dirFor(root, id), `${lang}.${ext}`), 'utf8')
      return ext === 'srt' ? srtToVtt(raw) : raw
    } catch { /* try the next one */ }
  }
  return null
}
