/**
 * Live Figma frame renderer.
 *
 *   GET /.netlify/functions/figma-image?url=<encoded figma frame url>
 *
 * Renders the referenced frame via the Figma Images API (using the server-side
 * FIGMA_TOKEN) and returns the PNG. The result is cached in Netlify Blobs so that
 * if Figma is slow/unreachable we can still serve the last good copy — which keeps
 * the deck resilient during a live presentation.
 *
 * The image always reflects the current Figma state when reachable, so editing a
 * frame in Figma shows up on the next (uncached) load — no rebuild needed.
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

const png = (body, maxAge) =>
  new Response(body, {
    headers: { 'content-type': 'image/png', 'cache-control': `public, max-age=${maxAge}` },
  })

export default async (req) => {
  const figmaUrl = new URL(req.url).searchParams.get('url')
  const parsed = figmaUrl && parseFigmaUrl(figmaUrl)
  if (!parsed) return new Response('invalid figma url', { status: 400 })

  const cacheKey = `${parsed.fileKey}__${parsed.nodeId}`.replace(/:/g, '-')
  const store = getStore('figma-img')
  const token = process.env.FIGMA_TOKEN

  // 1) try a fresh render from Figma
  if (token) {
    try {
      const api =
        `https://api.figma.com/v1/images/${parsed.fileKey}` +
        `?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=2`
      const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
      if (r.ok) {
        const j = await r.json()
        const imgUrl = j.images?.[parsed.nodeId]
        if (imgUrl) {
          const ir = await fetch(imgUrl)
          if (ir.ok) {
            const ab = await ir.arrayBuffer()
            await store.set(cacheKey, ab) // durable fallback copy
            return png(Buffer.from(ab), 300)
          }
        }
      }
    } catch {
      // fall through to cache
    }
  }

  // 2) fallback: last cached copy
  const cached = await store.get(cacheKey, { type: 'arrayBuffer' })
  if (cached) return png(Buffer.from(cached), 60)

  return new Response('figma image unavailable', { status: 502 })
}
