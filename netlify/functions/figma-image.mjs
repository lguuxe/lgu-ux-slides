/**
 * Figma frame image via REDIRECT to Figma's rendered CDN URL (no byte proxying).
 *
 *   GET ?url=<figma frame url>&v=<rev>-<figmaRev>[&thumb=1]  → 302 to the rendered PNG
 *   GET ?url=...&refresh=1                                    → render this one frame fresh
 *
 * The refresh (최신화) function pre-builds a {nodeId → cdnUrl} map per file/scale/figmaRev,
 * so the viewer just looks it up and redirects — fast, and Figma is never re-rendered on
 * the view path. Missing entries fall back to a single live render.
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

async function renderOne(fileKey, nodeId, scale, token) {
  const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`
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

  const thumb = p.get('thumb') === '1'
  const refresh = p.get('refresh') === '1'
  const scale = thumb ? '0.5' : '2'
  const token = process.env.FIGMA_TOKEN
  const main = getStore('ux-report')
  const mapStore = getStore('figma-map')

  // figmaRev: from &v ("rev-fr"); for refresh use the current status fr
  const v = p.get('v') || ''
  const fr = refresh
    ? String((await main.get('figma-status', { type: 'json' }))?.fr || 0)
    : (v.includes('-') ? v.split('-').pop() : (p.get('fr') || '0'))
  const mapKey = `m__${parsed.fileKey}__s${scale}__fr${fr}`

  const mergeIntoMap = async (u) => {
    try {
      const m = (await mapStore.get(mapKey, { type: 'json' })) || {}
      m[parsed.nodeId] = u
      await mapStore.setJSON(mapKey, m)
    } catch { /* ignore */ }
  }

  // editor live preview: render this one frame fresh
  if (refresh) {
    if (token) {
      const u = await renderOne(parsed.fileKey, parsed.nodeId, scale, token)
      if (u) { await mergeIntoMap(u); return redirect(u, 'no-store') }
    }
    return new Response('render failed', { status: 502 })
  }

  // viewer: redirect to the pre-built map URL; fall back to a single render
  let u = null
  try { const map = await mapStore.get(mapKey, { type: 'json' }); u = map && map[parsed.nodeId] } catch { /* ignore */ }
  if (!u && token) {
    u = await renderOne(parsed.fileKey, parsed.nodeId, scale, token)
    if (u) await mergeIntoMap(u)
  }
  if (u) return redirect(u, 'public, max-age=3600')
  return new Response('unavailable', { status: 502 })
}
