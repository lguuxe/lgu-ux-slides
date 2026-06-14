/**
 * Batched Figma refresh — avoids the 78-frames-at-once rate-limit storm.
 *
 *   POST { action:'render', fileKey, nodeIds:[...], scale }  ← render a small chunk
 *         in ONE Figma /v1/images call, download, store into pub__ (scale≥1) or thumb__ (scale<1)
 *   POST { action:'commit' }  ← bump figmaRev so viewers cache-bust to the new captures
 *
 * The client drives the chunking sequentially (with progress), so each invocation
 * stays small and within the function time limit.
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

  // commit: bump figmaRev (server-managed) so viewer image URLs change
  if (body.action === 'commit') {
    const status = await main.get('figma-status', { type: 'json' })
    const fr = ((status?.fr) || 0) + 1
    const data = await main.get('slides', { type: 'json' })
    if (data) { data.figmaRev = fr; await main.setJSON('slides', data) }
    await main.setJSON('figma-status', { fr, at: new Date().toISOString() })
    return json({ ok: true, fr })
  }

  // render a chunk
  const { fileKey, nodeIds, scale } = body
  if (!fileKey || !Array.isArray(nodeIds) || nodeIds.length === 0) return json({ error: 'bad chunk' }, 400)
  const token = process.env.FIGMA_TOKEN
  if (!token) return json({ error: 'no FIGMA_TOKEN' }, 403)

  const api = `https://api.figma.com/v1/images/${fileKey}` +
    `?ids=${encodeURIComponent(nodeIds.join(','))}&format=png&scale=${scale || 2}`
  const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
  if (!r.ok) return json({ error: 'figma ' + r.status }, 502)
  const j = await r.json()

  const imgStore = getStore('figma-img')
  const prefix = (Number(scale) < 1) ? 'thumb' : 'pub'
  const entries = Object.entries(j.images || {}).filter(([, u]) => u)
  let ok = 0
  await Promise.all(entries.map(async ([nodeId, u]) => {
    try {
      const ir = await fetch(u)
      if (!ir.ok) return
      const ab = await ir.arrayBuffer()
      const k = `${prefix}__${fileKey}__${nodeId}`.replace(/:/g, '-')
      await imgStore.set(k, ab)
      ok++
    } catch { /* skip this frame */ }
  }))
  return json({ ok: true, rendered: ok, requested: nodeIds.length })
}
