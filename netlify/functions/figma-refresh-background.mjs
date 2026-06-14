/**
 * Background Figma refresh — builds the {nodeId → CDN url} map for ALL frames.
 * Runs up to 15 min (background function), so it can handle a heavy 78-frame deck
 * that would blow the normal function time limit. No image downloads (just the
 * Figma /v1/images calls). Resumable: re-running continues an in-progress build,
 * skipping frames already mapped.
 *
 *   POST (x-edit-password)  → 202 immediately, then builds in the background.
 * Progress + completion are reported via the `figma-status` blob (read by figma-refresh GET).
 */
import { getStore } from '@netlify/blobs'

function parseFigmaUrl(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/(?:file|design|proto)\/([A-Za-z0-9]+)/)
    let nodeId = u.searchParams.get('node-id')
    if (nodeId) nodeId = decodeURIComponent(nodeId).replace(/-/g, ':')
    return m && nodeId ? { fileKey: m[1], nodeId } : null
  } catch {
    return null
  }
}

export default async (req) => {
  const expected = process.env.EDIT_PASSWORD || ''
  const pw = req.headers.get('x-edit-password') || ''
  if (!expected || pw !== expected) return new Response('unauthorized', { status: 401 })

  const main = getStore('ux-report')
  const mapStore = getStore('figma-map')
  const data = await main.get('slides', { type: 'json' })
  if (!data) return new Response('no data', { status: 404 })
  const token = process.env.FIGMA_TOKEN
  if (!token) return new Response('no token', { status: 403 })

  const byFile = {}
  for (const s of Object.values(data.slides || {})) {
    const p = parseFigmaUrl(s.figmaUrl)
    if (p) (byFile[p.fileKey] ||= []).push(p.nodeId)
  }
  const total = Object.values(byFile).reduce((a, x) => a + x.length, 0)

  const prev = await main.get('figma-status', { type: 'json' })
  const fr = (prev?.state === 'running' && prev?.fr) ? prev.fr : ((data.figmaRev || 0) + 1)

  let done = 0
  await main.setJSON('figma-status', { state: 'running', fr, done, total, at: new Date().toISOString() })

  const CHUNK = 6
  for (const [fileKey, ids] of Object.entries(byFile)) {
    const key = `m__${fileKey}__fr${fr}`
    const map = (await mapStore.get(key, { type: 'json' })) || {}
    const todo = ids.filter((n) => !map[n])
    done += ids.length - todo.length
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK)
      try {
        const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(chunk.join(','))}&format=png&scale=2`
        const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
        if (r.ok) {
          const j = await r.json()
          for (const [n, u] of Object.entries(j.images || {})) if (u) map[n] = u
        }
      } catch { /* skip; resume later */ }
      await mapStore.setJSON(key, map) // persist incrementally
      done += chunk.length
      await main.setJSON('figma-status', { state: 'running', fr, done: Math.min(done, total), total, at: new Date().toISOString() })
    }
  }

  const latest = await main.get('slides', { type: 'json' }) || data
  latest.figmaRev = fr
  await main.setJSON('slides', latest)
  await main.setJSON('figma-status', { state: 'done', fr, done: total, total, at: new Date().toISOString() })
  return new Response('ok', { status: 200 })
}
