// One Gemini call, shared by the assistant, the recommender and the daily-occasion lookup.
// A "lite" model: answers in ~1-2 s, where the big flash model was taking a minute or more
// (and often 503ing). Override with GEMINI_ASSISTANT_MODEL.
const MODEL = () => process.env.GEMINI_ASSISTANT_MODEL || 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 30000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The free tier answers 503/429 under load, so retry a couple of times.
export async function gemini(body) {
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
