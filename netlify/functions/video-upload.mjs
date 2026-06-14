/**
 * Chunked video upload to Netlify Blobs (works around the ~6MB request limit).
 *
 *   POST ?id=<id>&part=<n>                         body = chunk bytes
 *   POST ?id=<id>&action=finalize&parts=<n>&type=  assemble parts → one blob, drop parts
 *
 * Requires the edit password. The assembled video is served by the `video` function.
 */
import { getStore } from '@netlify/blobs'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  const expected = process.env.EDIT_PASSWORD || ''
  const pw = req.headers.get('x-edit-password') || ''
  if (!expected || pw !== expected) return json({ error: 'unauthorized' }, 401)

  const p = new URL(req.url).searchParams
  const id = p.get('id')
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return json({ error: 'bad id' }, 400)
  const store = getStore('videos')

  if (p.get('action') === 'finalize') {
    const parts = Number(p.get('parts') || 0)
    const type = p.get('type') || 'video/mp4'
    const bufs = []
    for (let i = 0; i < parts; i++) {
      const ab = await store.get(`${id}/part/${i}`, { type: 'arrayBuffer' })
      if (ab) bufs.push(Buffer.from(ab))
    }
    const full = Buffer.concat(bufs)
    await store.set(`${id}/file`, full, { metadata: { type, size: full.length } })
    for (let i = 0; i < parts; i++) await store.delete(`${id}/part/${i}`)
    return json({ ok: true, size: full.length })
  }

  const part = Number(p.get('part'))
  if (Number.isNaN(part)) return json({ error: 'no part' }, 400)
  const ab = await req.arrayBuffer()
  await store.set(`${id}/part/${part}`, Buffer.from(ab))
  return json({ ok: true })
}
