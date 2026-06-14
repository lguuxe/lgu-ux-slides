import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { deckSlideRefs } from '../lib/nav.js'
import { setImageVersion } from '../lib/images.js'

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
      const server = await fetchServer()
      try {
        if (cancelled) return
        if (server) {
          revRef.current = server._rev || 0
          setImageVersion(server._rev || 0)
          setDataState(server); setSource('server')
        } else {
          const file = await fetchFile()
          if (cancelled) return
          revRef.current = null
          setImageVersion(file._rev || '')
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

  // Publish the current draft to the server (Blobs) for everyone. Needs the edit password.
  // Optimistic concurrency: sends the loaded revision; 409 if someone saved first
  // (unless opts.force overwrites).
  const publish = useCallback(async (password, opts = {}) => {
    const headers = {
      'content-type': 'application/json',
      'x-edit-password': password,
      'x-base-rev': String(revRef.current ?? ''),
    }
    if (opts.force) headers['x-force'] = '1'
    const res = await fetch(SLIDES_FN, { method: 'POST', headers, body: JSON.stringify(dataRef.current) })
    if (res.status === 409) {
      const err = new Error('conflict')
      err.conflict = true
      try { err.currentRev = (await res.json()).currentRev } catch {}
      throw err
    }
    if (!res.ok) {
      let msg = 'HTTP ' + res.status
      try { msg = (await res.json()).error || msg } catch {}
      throw new Error(msg)
    }
    const j = await res.json()
    revRef.current = j.rev // adopt the new revision so subsequent saves are based on it
    setImageVersion(j.rev) // bust image caches to the freshly published captures
    localStorage.removeItem(STORAGE_KEY)
    setSource('server')
    return j
  }, [])

  // Discard local draft, reload the published (server, else file) copy
  const resetToPublished = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY)
    const server = await fetchServer()
    if (server) { revRef.current = server._rev || 0; setImageVersion(server._rev || 0); setDataState(server); setSource('server'); return }
    const file = await fetchFile()
    revRef.current = null
    setImageVersion(file._rev || '')
    setDataState(file); setSource('file')
  }, [])

  const importData = useCallback((json) => setData(json), [setData])

  // editor-only: a draft (unsaved edits) saved in this browser
  const hasDraft = useCallback(() => {
    try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
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

  // Ordered slide ids for prev/next (recursive; appendix groups excluded)
  const orderedSlideIds = useMemo(() => (data ? deckSlideRefs(data.nav) : []), [data])

  const value = {
    data, setData, source, error,
    publish, resetToPublished, importData, orderedSlideIds,
    hasDraft, loadDraft, discardDraft,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
