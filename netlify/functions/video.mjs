/**
 * Serve an uploaded video from Netlify Blobs, with HTTP Range support (seeking).
 *   GET ?id=<id>
 */
import { getStore } from '@netlify/blobs'

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response('no id', { status: 400 })

  const store = getStore('videos')
  const res = await store.getWithMetadata(`${id}/file`, { type: 'arrayBuffer' })
  if (!res || !res.data) return new Response('not found', { status: 404 })

  const buf = Buffer.from(res.data)
  const type = res.metadata?.type || 'video/mp4'
  const total = buf.length
  const range = req.headers.get('range')

  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/)
    if (m) {
      const start = Number(m[1])
      const end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1
      const chunk = buf.subarray(start, end + 1)
      return new Response(chunk, {
        status: 206,
        headers: {
          'content-type': type,
          'content-range': `bytes ${start}-${end}/${total}`,
          'accept-ranges': 'bytes',
          'content-length': String(chunk.length),
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    }
  }

  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': type,
      'accept-ranges': 'bytes',
      'content-length': String(total),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
