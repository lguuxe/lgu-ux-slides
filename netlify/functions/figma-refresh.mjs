/**
 * Figma refresh status reader.
 *   GET → current build status { state, fr, done, total } (written by figma-refresh-background)
 * The actual work runs in figma-refresh-background.
 */
import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'use figma-refresh-background' }), { status: 405, headers: { 'content-type': 'application/json' } })
  const s = await getStore('ux-report').get('figma-status', { type: 'json' })
  return new Response(JSON.stringify(s || { state: 'idle' }), {
    status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
