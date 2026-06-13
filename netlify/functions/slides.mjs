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

    await store.setJSON(KEY, body)
    return json({ ok: true, savedAt: new Date().toISOString() })
  }

  return json({ error: 'Method not allowed' }, 405)
}
