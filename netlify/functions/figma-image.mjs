/**
 * Figma frame image with a draft → published flow, stored in Netlify Blobs.
 *
 *   GET ?url=...            → published copy   (viewer/presentation; fast, no Figma)
 *   GET ?url=...&draft=1    → draft||published (editor preview)
 *   GET ?url=...&refresh=1  → render fresh from Figma into the DRAFT (편집 「적용」/최신화)
 *
 * «적용» renders into the draft (not yet visible to viewers). «저장» (the slides
 * function) promotes drafts → published. So viewers always serve the published
 * copy from storage — instant and independent of Figma at view time.
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

async function renderFromFigma(parsed, token, scale = 2) {
  const api =
    `https://api.figma.com/v1/images/${parsed.fileKey}` +
    `?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=${scale}`
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
  const refresh = params.get('refresh') === '1'
  const preferDraft = params.get('draft') === '1'
  const parsed = figmaUrl && parseFigmaUrl(figmaUrl)
  if (!parsed) return new Response('invalid figma url', { status: 400 })

  const k = `${parsed.fileKey}__${parsed.nodeId}`.replace(/:/g, '-')
  const PUB = `pub__${k}`
  const DRAFT = `draft__${k}`
  const THUMB = `thumb__${k}`
  const store = getStore('figma-img')
  const token = process.env.FIGMA_TOKEN

  const getBlob = async (key) => store.get(key, { type: 'arrayBuffer' })

  // tiny thumbnail for the nav (render once at small scale, cached)
  if (params.get('thumb') === '1') {
    const cached = await getBlob(THUMB)
    if (cached) return png(Buffer.from(cached), 'public, max-age=3600')
    if (token) {
      try {
        const ab = await renderFromFigma(parsed, token, 0.3)
        if (ab) { await store.set(THUMB, ab); return png(Buffer.from(ab), 'public, max-age=3600') }
      } catch { /* ignore */ }
    }
    // fall back to full published copy if thumb render failed
    const pub = await getBlob(PUB)
    if (pub) return png(Buffer.from(pub), 'public, max-age=600')
    return new Response('thumb unavailable', { status: 502 })
  }

  // 「적용」/최신화: render fresh from Figma into the draft
  if (refresh) {
    if (token) {
      try {
        const ab = await renderFromFigma(parsed, token)
        if (ab) { await store.set(DRAFT, ab); return png(Buffer.from(ab), 'no-store') }
      } catch { /* fall through */ }
    }
    const d = (await getBlob(DRAFT)) || (await getBlob(PUB))
    if (d) return png(Buffer.from(d), 'no-store')
    return new Response('render failed', { status: 502 })
  }

  // editor preview: draft if present, else published
  if (preferDraft) {
    const d = (await getBlob(DRAFT)) || (await getBlob(PUB))
    if (d) return png(Buffer.from(d), 'public, max-age=30')
    if (token) {
      try {
        const ab = await renderFromFigma(parsed, token)
        if (ab) { await store.set(DRAFT, ab); return png(Buffer.from(ab), 'no-store') }
      } catch { /* ignore */ }
    }
    return new Response('unavailable', { status: 502 })
  }

  // viewer/presentation: published copy
  const pub = await getBlob(PUB)
  if (pub) return png(Buffer.from(pub), 'public, max-age=3600')
  // self-heal first view: render → published
  if (token) {
    try {
      const ab = await renderFromFigma(parsed, token)
      if (ab) { await store.set(PUB, ab); return png(Buffer.from(ab), 'public, max-age=3600') }
    } catch { /* ignore */ }
  }
  const d = await getBlob(DRAFT)
  if (d) return png(Buffer.from(d), 'public, max-age=60')
  return new Response('unavailable', { status: 502 })
}
