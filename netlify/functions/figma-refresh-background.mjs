/**
 * Background Figma refresh — captures EVERY frame via the Figma REST API and stores
 * the bytes in Netlify Blobs: a presentation-size PNG (scale 2) and a tiny thumbnail
 * (scale 0.2). Stored per figmaRev so URLs are immutable & cacheable. Runs up to 15
 * min (background fn), resumable (skips frames already stored for this build).
 *
 *   POST (x-edit-password) → 202; builds in the background.
 * Progress/completion via the `figma-status` blob (read by figma-refresh GET).
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

const SCALES = [['2', 'pub'], ['0.2', 'thumb']]
const CHUNK = 6

export default async (req) => {
  const expected = process.env.EDIT_PASSWORD || ''
  const pw = req.headers.get('x-edit-password') || ''
  if (!expected || pw !== expected) return new Response('unauthorized', { status: 401 })

  const main = getStore('ux-report')
  const imgStore = getStore('figma-img')
  const data = await main.get('slides', { type: 'json' })
  if (!data) return new Response('no data', { status: 404 })
  const token = process.env.FIGMA_TOKEN
  if (!token) return new Response('no token', { status: 403 })

  const byFile = {}
  for (const s of Object.values(data.slides || {})) {
    const p = parseFigmaUrl(s.figmaUrl)
    if (p) (byFile[p.fileKey] ||= []).push(p.nodeId)
  }
  const frames = Object.values(byFile).reduce((a, x) => a + x.length, 0)
  const total = frames * SCALES.length

  const prev = await main.get('figma-status', { type: 'json' })
  const fr = (prev?.state === 'running' && prev?.fr) ? prev.fr : ((data.figmaRev || 0) + 1)

  let done = 0
  const bump = async (state = 'running') => main.setJSON('figma-status', { state, fr, done: Math.min(done, total), total, at: new Date().toISOString() })
  await bump()

  const keyOf = (prefix, fileKey, nodeId) => `${prefix}__${fileKey}__${nodeId}__fr${fr}`.replace(/:/g, '-')

  for (const [fileKey, ids] of Object.entries(byFile)) {
    for (const [scale, prefix] of SCALES) {
      // resume: skip frames already stored for this fr
      const todo = []
      for (const id of ids) {
        const md = await imgStore.getMetadata(keyOf(prefix, fileKey, id)).catch(() => null)
        if (md) done++; else todo.push(id)
      }
      await bump()
      for (let i = 0; i < todo.length; i += CHUNK) {
        const chunk = todo.slice(i, i + CHUNK)
        try {
          const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(chunk.join(','))}&format=png&scale=${scale}`
          const r = await fetch(api, { headers: { 'X-Figma-Token': token } })
          if (r.ok) {
            const j = await r.json()
            await Promise.all(chunk.map(async (id) => {
              const u = j.images?.[id]
              if (!u) return
              try {
                const ir = await fetch(u)
                if (ir.ok) await imgStore.set(keyOf(prefix, fileKey, id), await ir.arrayBuffer())
              } catch { /* skip */ }
            }))
          }
        } catch { /* skip; resume later */ }
        done += chunk.length
        await bump()
      }
    }
  }

  // commit: publish the new figmaRev and drop the previous build's blobs
  const latest = await main.get('slides', { type: 'json' }) || data
  latest.figmaRev = fr
  await main.setJSON('slides', latest)
  await bump('done')

  try {
    for (const prefix of ['pub', 'thumb']) {
      const { blobs } = await imgStore.list({ prefix: `${prefix}__` })
      for (const b of blobs) {
        if (!b.key.endsWith(`__fr${fr}`)) await imgStore.delete(b.key)
      }
    }
  } catch { /* cleanup best-effort */ }

  return new Response('ok', { status: 200 })
}
