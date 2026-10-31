// Turns a file name like "Tokyo.Story.1953.1080p.BluRay.x264.mkv" into { title, year }.
const JUNK = /\b(2160p|1080p|720p|480p|4k|uhd|bluray|blu-ray|brrip|bdrip|webrip|web-dl|webdl|hdrip|dvdrip|hdtv|x264|x265|h264|h265|hevc|remux|extended|unrated|imax)\b/i
const YEAR = /(?<!\d)(?:19|20)\d{2}(?!\d)/g

export function parseName(name) {
  const s = name
    .replace(/\.[^./\\]+$/, '') // extension
    .replace(/[._]+/g, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Last year that is not at the very start ("2001 A Space Odyssey 1968", "1917 2019").
  const years = [...s.matchAll(YEAR)].filter((m) => m.index > 0)
  const last = years.at(-1)

  let title = s
  let year = null
  if (last) {
    title = s.slice(0, last.index)
    year = Number(last[0])
  } else {
    const junk = s.search(JUNK)
    if (junk > 0) title = s.slice(0, junk)
  }
  title = title.replace(/[\s-]+$/, '').trim()
  return { title: title || s, year }
}
