/**
 * Edit-mode auth + single-editor lock, stored in Netlify Blobs.
 *
 *   POST { action:'acquire', password, token }  → validate password & take the lock
 *   POST { action:'heartbeat', token }          → keep the lock alive
 *   POST { action:'release', token }            → release the lock
 *
 * The lock auto-expires after LOCK_TTL of no heartbeat (handles crashes/closed tabs).
 */
import { getStore } from '@netlify/blobs'

const LOCK_TTL = 120000 // 2 minutes
const KEY = 'edit-lock'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body
  try { body = await req.json() } catch { return json({ error: 'bad body' }, 400) }
  const { action, password, token } = body || {}
  const store = getStore('ux-report')
  const now = Date.now()

  // Exclusive single-editor lock: only one person may be in edit mode at a time.
  if (action === 'acquire') {
    const expected = process.env.EDIT_PASSWORD || ''
    if (!expected) return json({ ok: false, reason: 'no-password-config' }, 403)
    if (password !== expected) return json({ ok: false, reason: 'bad-password' }, 401)
    if (!token) return json({ ok: false, reason: 'no-token' }, 400)

    const lock = await store.get(KEY, { type: 'json' })
    if (lock && lock.token !== token && now - lock.ts < LOCK_TTL) {
      return json({ ok: false, reason: 'locked', since: lock.ts })
    }
    await store.setJSON(KEY, { token, ts: now })
    return json({ ok: true })
  }

  if (action === 'heartbeat') {
    if (!token) return json({ ok: false, reason: 'no-token' }, 400)
    const lock = await store.get(KEY, { type: 'json' })
    if (lock && lock.token === token) {
      await store.setJSON(KEY, { token, ts: now })
      return json({ ok: true })
    }
    // lock missing or stale → reclaim; otherwise someone else holds it
    if (!lock || now - lock.ts >= LOCK_TTL) {
      await store.setJSON(KEY, { token, ts: now })
      return json({ ok: true })
    }
    return json({ ok: false, reason: 'lost' })
  }

  if (action === 'release') {
    const lock = await store.get(KEY, { type: 'json' })
    if (lock && lock.token === token) await store.delete(KEY)
    return json({ ok: true })
  }

  return json({ error: 'unknown action' }, 400)
}
