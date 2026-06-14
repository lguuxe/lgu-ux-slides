/**
 * Serve a STORED Figma capture (bytes) from Netlify Blobs — fast, on our own CDN,
 * and immutable per figmaRev so the browser caches it forever (instant transitions
 * once preloaded).
 *
 *   GET ?url=<figma url>&v=<rev>-<figmaRev>[&thumb=1]  → stored PNG (pub full / tiny thumb)
 *   GET ?url=...&refresh=1                              → render this one frame fresh (editor preview)
 *
 * Blobs (store 'figma-img'):  pub__<fileKey>__<nodeId>__fr<fr>  /  thumb__<fileKey>__<nodeId>__fr<fr>
 * The refresh job pre-renders & stores these. Missing → live render + store (self-heal).
 */
import { getStore } from '@netlify/blobs'

const FULL_SCALE = '2'
const THUMB_SCALE = '0.2'

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

async function renderAndDownload(fileKey, nodeId, scale, token) {
  const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`
  const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
  if (!r.ok) return null
  const j = await r.json()
  const u = j.images?.[nodeId]
  if (!u) return null
  const ir = await fetch(u)
  if (!ir.ok) return null
  return await ir.arrayBuffer()
}

const png = (body, cc) => new Response(body, { headers: { 'content-type': 'image/png', 'cache-control': cc } })
const IMMUTABLE = 'public, max-age=31536000, immutable'

export default async (req) => {
  const p = new URL(req.url).searchParams
  const figmaUrl = p.get('url')
  const parsed = figmaUrl && parseFigmaUrl(figmaUrl)
  if (!parsed) return new Response('invalid figma url', { status: 400 })

  const thumb = p.get('thumb') === '1'
  const refresh = p.get('refresh') === '1'
  const token = process.env.FIGMA_TOKEN
  const store = getStore('figma-img')
  const main = getStore('ux-report')

  const v = p.get('v') || ''
  const fr = refresh
    ? String((await main.get('figma-status', { type: 'json' }))?.fr || 0)
    : (v.includes('-') ? v.split('-').pop() : (p.get('fr') || '0'))

  const prefix = thumb ? 'thumb' : 'pub'
  const scale = thumb ? THUMB_SCALE : FULL_SCALE
  const key = `${prefix}__${parsed.fileKey}__${parsed.nodeId}__fr${fr}`.replace(/:/g, '-')

  if (refresh) {
    // editor preview: re-render this one frame (full) into the current fr
    if (token) {
      const ab = await renderAndDownload(parsed.fileKey, parsed.nodeId, FULL_SCALE, token)
      if (ab) { await store.set(`pub__${parsed.fileKey}__${parsed.nodeId}__fr${fr}`.replace(/:/g, '-'), ab); return png(Buffer.from(ab), 'no-store') }
    }
    return new Response('render failed', { status: 502 })
  }

  // serve stored bytes
  const cached = await store.get(key, { type: 'arrayBuffer' })
  if (cached) return png(Buffer.from(cached), IMMUTABLE)

  // self-heal: render + store
  if (token) {
    const ab = await renderAndDownload(parsed.fileKey, parsed.nodeId, scale, token)
    if (ab) { await store.set(key, ab); return png(Buffer.from(ab), IMMUTABLE) }
  }
  return new Response('unavailable', { status: 502 })
}
