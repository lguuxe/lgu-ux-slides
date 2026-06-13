/**
 * Figma frame image, cached in Netlify Blobs.
 *
 *   GET /.netlify/functions/figma-image?url=<encoded figma frame url>
 *   GET /.netlify/functions/figma-image?url=...&refresh=1   ← re-render from Figma
 *
 * Default (viewer) path: serve the stored copy from Blobs — fast, persistent, and
 * independent of Figma at view time (good for a live presentation). The image is
 * fetched from Figma only the first time a frame is seen, or when `refresh=1` is
 * requested (the editor uses that when opening a slide / pressing «적용»). So a
 * Figma edit shows up after it's re-captured from the editor, not on every load.
 */
import { getStore } from '@netlify/blobs'

function parseFigmaUrl(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/(?:file|design|proto)\/([A-Za-z0-9]+)/)
    const fileKey = m && m[1]
    let nodeId = u.searchParams.get('node-id')
    if (nodeId) nodeId = decodeURIComponent(nodeId).replace(/-/g, ':')
    if (!fileKey || !nodeId) return null
    return { fileKey, nodeId }
  } catch {
    return null
  }
}

const png = (body, cacheControl) =>
  new Response(body, { headers: { 'content-type': 'image/png', 'cache-control': cacheControl } })

async function renderFromFigma(parsed, token) {
  const api =
    `https://api.figma.com/v1/images/${parsed.fileKey}` +
    `?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=2`
  const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
  if (!r.ok) return null
  const j = await r.json()
  const imgUrl = j.images?.[parsed.nodeId]
  if (!imgUrl) return null
  const ir = await fetch(imgUrl)
  if (!ir.ok) return null
  return await ir.arrayBuffer()
}

export default async (req) => {
  const params = new URL(req.url).searchParams
  const figmaUrl = params.get('url')
  const forceRefresh = params.get('refresh') === '1'
  const parsed = figmaUrl && parseFigmaUrl(figmaUrl)
  if (!parsed) return new Response('invalid figma url', { status: 400 })

  const cacheKey = `${parsed.fileKey}__${parsed.nodeId}`.replace(/:/g, '-')
  const store = getStore('figma-img')
  const token = process.env.FIGMA_TOKEN

  // 1) viewer path: serve the stored copy as-is
  if (!forceRefresh) {
    const cached = await store.get(cacheKey, { type: 'arrayBuffer' })
    if (cached) return png(Buffer.from(cached), 'public, max-age=300')
  }

  // 2) (re)capture from Figma and persist
  if (token) {
    try {
      const ab = await renderFromFigma(parsed, token)
      if (ab) {
        await store.set(cacheKey, ab)
        return png(Buffer.from(ab), forceRefresh ? 'no-store' : 'public, max-age=300')
      }
    } catch {
      // fall through to any stored copy
    }
  }

  // 3) last resort: stored copy even when a refresh was requested but Figma failed
  const cached = await store.get(cacheKey, { type: 'arrayBuffer' })
  if (cached) return png(Buffer.from(cached), 'public, max-age=60')

  return new Response('figma image unavailable', { status: 502 })
}
