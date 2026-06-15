import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { allSlideRefs } from '../lib/nav.js'
import { setImageVersion } from '../lib/images.js'

// combined cache-bust key: changes on a content save (_rev) or a Figma refresh (figmaRev)
const imgVer = (d) => `${d?._rev || 0}-${d?.figmaRev || 0}`

const DataContext = createContext(null)
const STORAGE_KEY = 'ux-report-data-v2'   // local unsaved draft (editor only)
const SLIDES_FN = '/.netlify/functions/slides' // Netlify Blobs-backed published copy

async function fetchServer() {
  try {
    // hard timeout so a slow/absent function never blocks the initial render
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(SLIDES_FN, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null // e.g. vite dev returns index.html
    const json = await res.json()
    return json && json.slides ? json : null
  } catch {
    return null
  }
}

async function fetchFile() {
  const res = await fetch(import.meta.env.BASE_URL + 'slides.json')
  return res.json()
}

export function DataProvider({ children }) {
  const [data, setDataState] = useState(null)
  const [source, setSource] = useState('loading') // 'loading' | 'local' | 'server' | 'file'
  const [error, setError] = useState(null)
  const dataRef = useRef(null)
  dataRef.current = data
  const revRef = useRef(null) // server revision the current data is based on

  // Load the PUBLISHED copy only (server → static file). The local draft is never
  // applied here, so the presentation always shows what everyone else sees — a
  // leftover editor draft can't "stick" on a viewer's browser. The editor opts in
  // to its draft explicitly via loadDraft().
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (window.__EMBEDDED_DATA__) {
        if (cancelled) return
        const embedded = window.__EMBEDDED_DATA__
        revRef.current = null
        setImageVersion(imgVer(embedded))
        setDataState(embedded); setSource('file')
        return
      }
      const server = await fetchServer()
      try {
        if (cancelled) return
        if (server) {
          revRef.current = server._rev || 0
          setImageVersion(imgVer(server))
          setDataState(server); setSource('server')
        } else {
          const file = await fetchFile()
          if (cancelled) return
          revRef.current = null
          setImageVersion(imgVer(file))
          setDataState(file); setSource('file')
        }
      } catch (e) {
        if (!cancelled) setError(e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Editor edits → in-memory + local draft (persist so a reload doesn't lose work)
  const setData = useCallback((updater) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (e) {
        console.warn('Failed to persist draft', e)
      }
      setSource('local')
      return next
    })
  }, [])

  // Publish the current data to the server (Blobs) for everyone. Needs the edit
  // password. Single-editor usage → last write wins (no save-time conflict check).
  // Retries transient network failures so a flaky connection doesn't lose a save.
  const publish = useCallback(async (password) => {
    const payload = dataRef.current
    if (!payload || !payload.slides) throw new Error('저장할 데이터가 없습니다.')
    const headers = { 'content-type': 'application/json', 'x-edit-password': password }
    const bodyStr = JSON.stringify(payload)

    // Retry only on network-level failures, never on a real HTTP response.
    let res = null, lastErr = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(SLIDES_FN, { method: 'POST', headers, body: bodyStr })
        break
      } catch (e) {
        lastErr = e
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
    if (!res) throw new Error('네트워크 오류로 저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.' + (lastErr ? ` (${lastErr.message})` : ''))

    if (!res.ok) {
      let msg = 'HTTP ' + res.status
      try { msg = (await res.json()).error || msg } catch {}
      throw new Error(msg)
    }
    const j = await res.json()

    // A successful POST means Blobs accepted the write (the function awaits setJSON,
    // which throws on failure). We do a best-effort read only to pick up the latest
    // figmaRev — we do NOT compare revisions here, because Blobs can briefly return
    // the previous value right after a write (read-after-write lag); treating that as
    // a failure would falsely report a good save as failed.
    const check = await fetchServer().catch(() => null)
    const figmaRev = check?.figmaRev ?? payload.figmaRev ?? 0

    revRef.current = j.rev
    // Keep the in-memory revision in sync so the NEXT save's base-rev matches the
    // server (otherwise every subsequent save would look like a conflict).
    setDataState((prev) => (prev ? { ...prev, _rev: j.rev, figmaRev } : prev))
    setImageVersion(`${j.rev}-${figmaRev}`) // bust image caches
    localStorage.removeItem(STORAGE_KEY)
    setSource('server')
    return j
  }, [])

  // Discard local draft, reload the published (server, else file) copy
  const resetToPublished = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY)
    const server = await fetchServer()
    if (server) { revRef.current = server._rev || 0; setImageVersion(imgVer(server)); setDataState(server); setSource('server'); return }
    const file = await fetchFile()
    revRef.current = null
    setImageVersion(imgVer(file))
    setDataState(file); setSource('file')
  }, [])

  const importData = useCallback((json) => setData(json), [setData])

  // editor-only: a draft (unsaved edits) saved in this browser
  const hasDraft = useCallback(() => {
    try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
  }, [])
  // Is the stored draft based on the revision currently published? A draft built on
  // an OLDER revision (server moved ahead in another tab/device) is stale — resuming
  // and saving it would clobber the newer published copy, so we drop it instead.
  // Returns 'none' | 'current' | 'stale'.
  const draftStatus = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return 'none'
      const parsed = JSON.parse(stored)
      if (!parsed || !parsed.slides) return 'none'
      const serverRev = revRef.current
      // No server copy yet (fresh deck) → any draft is fine to resume.
      if (serverRev == null) return 'current'
      return (parsed._rev ?? 0) >= serverRev ? 'current' : 'stale'
    } catch { return 'none' }
  }, [])
  const loadDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed = stored && JSON.parse(stored)
      if (parsed && parsed.slides) { setDataState(parsed); setSource('local'); return true }
    } catch { /* ignore */ }
    return false
  }, [])
  const discardDraft = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const orderedSlideIds = useMemo(() => (data ? allSlideRefs(data.nav) : []), [data])

  const value = {
    data, setData, source, error,
    publish, resetToPublished, importData, orderedSlideIds,
    hasDraft, draftStatus, loadDraft, discardDraft,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
