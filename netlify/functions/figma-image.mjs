/**
 * Figma frame image via REDIRECT to Figma's rendered CDN URL (no byte proxying).
 *
 *   GET ?url=<figma frame url>&v=<rev>-<figmaRev>[&thumb=1]  → 302 to the rendered PNG
 *   GET ?url=...&refresh=1                                    → render this one frame fresh
 *
 * The refresh job pre-builds a {nodeId → cdnUrl} map per file/figmaRev. The viewer
 * just looks it up and redirects. Thumbnails reuse the SAME full-res URL (browser
 * downscales) so there's nothing extra to render. Missing entries fall back to a
 * single live render.
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

async function renderOne(fileKey, nodeId, token) {
  const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`
  const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
  if (!r.ok) return null
  const j = await r.json()
  return j.images?.[nodeId] || null
}

const redirect = (loc, cacheControl) =>
  new Response(null, { status: 302, headers: { location: loc, 'cache-control': cacheControl } })

export default async (req) => {
  const p = new URL(req.url).searchParams
  const figmaUrl = p.get('url')
  const parsed = figmaUrl && parseFigmaUrl(figmaUrl)
  if (!parsed) return new Response('invalid figma url', { status: 400 })

  const refresh = p.get('refresh') === '1'
  const token = process.env.FIGMA_TOKEN
  const main = getStore('ux-report')
  const mapStore = getStore('figma-map')

  const v = p.get('v') || ''
  const fr = refresh
    ? String((await main.get('figma-status', { type: 'json' }))?.fr || 0)
    : (v.includes('-') ? v.split('-').pop() : (p.get('fr') || '0'))
  const mapKey = `m__${parsed.fileKey}__fr${fr}`

  const mergeIntoMap = async (u) => {
    try {
      const m = (await mapStore.get(mapKey, { type: 'json' })) || {}
      m[parsed.nodeId] = u
      await mapStore.setJSON(mapKey, m)
    } catch { /* ignore */ }
  }

  if (refresh) {
    if (token) {
      const u = await renderOne(parsed.fileKey, parsed.nodeId, token)
      if (u) { await mergeIntoMap(u); return redirect(u, 'no-store') }
    }
    return new Response('render failed', { status: 502 })
  }

  let u = null
  try { const map = await mapStore.get(mapKey, { type: 'json' }); u = map && map[parsed.nodeId] } catch { /* ignore */ }
  if (!u && token) {
    u = await renderOne(parsed.fileKey, parsed.nodeId, token)
    if (u) await mergeIntoMap(u)
  }
  if (u) return redirect(u, 'public, max-age=3600')
  return new Response('unavailable', { status: 502 })
}
