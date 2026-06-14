/**
 * Slides store backed by Netlify Blobs.
 *
 *   GET  /.netlify/functions/slides   → published slides JSON (404 if never published)
 *   POST /.netlify/functions/slides   → save slides JSON (requires x-edit-password)
 *
 * The edit password is the env var EDIT_PASSWORD (set in Netlify site settings).
 * Without it, writes are refused so the public can't edit your deck.
 */
import { getStore } from '@netlify/blobs'

const STORE = 'ux-report'
const KEY = 'slides'

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

// On save, promote each Figma slide's draft capture → published copy.
async function promoteFigmaDrafts(slides) {
  const imgStore = getStore('figma-img')
  for (const slide of Object.values(slides || {})) {
    if (!slide.figmaUrl) continue
    const parsed = parseFigmaUrl(slide.figmaUrl)
    if (!parsed) continue
    const k = `${parsed.fileKey}__${parsed.nodeId}`.replace(/:/g, '-')
    const draft = await imgStore.get(`draft__${k}`, { type: 'arrayBuffer' })
    if (draft) await imgStore.set(`pub__${k}`, draft)
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export default async (req) => {
  const store = getStore(STORE)

  if (req.method === 'GET') {
    const data = await store.get(KEY, { type: 'json' })
    if (!data) return json({ error: 'not-published' }, 404)
    return json(data)
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const expected = process.env.EDIT_PASSWORD || ''
    if (!expected) return json({ error: 'EDIT_PASSWORD가 설정되지 않았습니다.' }, 403)

    const given = req.headers.get('x-edit-password') || ''
    if (given !== expected) return json({ error: '편집 비밀번호가 올바르지 않습니다.' }, 401)

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: '잘못된 JSON 본문' }, 400)
    }
    if (!body || typeof body !== 'object' || !body.slides) {
      return json({ error: 'slides 필드가 없는 데이터' }, 400)
    }

    // optimistic concurrency: reject if someone else saved since the client loaded
    const current = await store.get(KEY, { type: 'json' })
    const currentRev = current?._rev || 0
    const force = req.headers.get('x-force') === '1'
    const baseRev = req.headers.get('x-base-rev') || ''
    if (!force && current && String(currentRev) !== String(baseRev)) {
      return json({ error: 'conflict', currentRev }, 409)
    }

    const newRev = currentRev + 1
    body._rev = newRev
    await store.setJSON(KEY, body)
    await promoteFigmaDrafts(body.slides)
    return json({ ok: true, rev: newRev, savedAt: new Date().toISOString() })
  }

  return json({ error: 'Method not allowed' }, 405)
}
