// Serves a video file with HTTP Range support, so the browser can seek.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

const TYPES = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.wmv': 'video/x-ms-wmv',
}

const fail = (res, code, error) => {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error }))
}

export async function streamFile(req, res, file) {
  let info
  try { info = await stat(file) } catch { return fail(res, 404, 'file not found') }

  const size = info.size
  res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('Accept-Ranges', 'bytes')
  if (size === 0) { res.setHeader('Content-Length', 0); return res.end() }

  let start = 0
  let end = size - 1
  const range = req.headers.range
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!m || (m[1] === '' && m[2] === '')) {
      res.setHeader('Content-Range', `bytes */${size}`)
      return fail(res, 416, 'bad range')
    }
    if (m[1] === '') start = Math.max(0, size - Number(m[2])) // "last N bytes"
    else {
      start = Number(m[1])
      if (m[2] !== '') end = Math.min(end, Number(m[2]))
    }
    if (start > end) {
      res.setHeader('Content-Range', `bytes */${size}`)
      return fail(res, 416, 'range not satisfiable')
    }
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  }

  res.setHeader('Content-Length', end - start + 1)
  if (req.method === 'HEAD') return res.end()

  const stream = createReadStream(file, { start, end })
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy()) // player closed or seeked away
  stream.pipe(res)
}
