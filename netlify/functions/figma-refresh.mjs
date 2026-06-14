/**
 * Batched Figma refresh — builds a {nodeId → CDN url} map per file/scale/figmaRev.
 * NO image downloads (just the Figma /v1/images call), so each chunk is fast and
 * stays within the function time limit. The viewer (figma-image) redirects to these
 * URLs.
 *
 *   POST { action:'begin' }                                   → returns next figmaRev (fr)
 *   POST { action:'render', fr, fileKey, nodeIds, scale }     → merge rendered URLs into the map
 *   POST { action:'commit', fr }                              → publish figmaRev so viewers switch
 */
import { getStore } from '@netlify/blobs'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  const expected = process.env.EDIT_PASSWORD || ''
  const pw = req.headers.get('x-edit-password') || ''
  if (!expected || pw !== expected) return json({ error: 'unauthorized' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'bad body' }, 400) }
  const main = getStore('ux-report')

  if (body.action === 'begin') {
    const fr = ((await main.get('figma-status', { type: 'json' }))?.fr || 0) + 1
    return json({ ok: true, fr })
  }

  if (body.action === 'commit') {
    const fr = body.fr
    const data = await main.get('slides', { type: 'json' })
    if (data) { data.figmaRev = fr; await main.setJSON('slides', data) }
    await main.setJSON('figma-status', { fr, at: new Date().toISOString() })
    return json({ ok: true, fr })
  }

  // render a chunk → build URL map (no downloads)
  const { fr, fileKey, nodeIds, scale } = body
  if (!fr || !fileKey || !Array.isArray(nodeIds) || nodeIds.length === 0) return json({ error: 'bad chunk' }, 400)
  const token = process.env.FIGMA_TOKEN
  if (!token) return json({ error: 'no FIGMA_TOKEN' }, 403)

  const sc = scale || 2
  const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeIds.join(','))}&format=png&scale=${sc}`
  const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
  if (!r.ok) return json({ error: 'figma ' + r.status }, 502)
  const j = await r.json()

  const mapStore = getStore('figma-map')
  const key = `m__${fileKey}__s${sc}__fr${fr}`
  const map = (await mapStore.get(key, { type: 'json' })) || {}
  let ok = 0
  for (const [nid, u] of Object.entries(j.images || {})) { if (u) { map[nid] = u; ok++ } }
  await mapStore.setJSON(key, map)
  return json({ ok: true, rendered: ok, requested: nodeIds.length })
}
