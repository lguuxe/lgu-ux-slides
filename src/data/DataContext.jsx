import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { deckSlideRefs } from '../lib/nav.js'

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

  // Load order: local draft (editor's unsaved work) → server (Blobs) → static file
  useEffect(() => {
    let cancelled = false
    async function load() {
      let draft = null
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) draft = JSON.parse(stored)
      } catch (e) {
        console.warn('Local draft unreadable', e)
      }

      const server = await fetchServer()

      try {
        if (cancelled) return
        if (draft) {
          setDataState(draft); setSource('local')
        } else if (server) {
          setDataState(server); setSource('server')
        } else {
          const file = await fetchFile()
          if (cancelled) return
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
  const publish = useCallback(async (password) => {
    const res = await fetch(SLIDES_FN, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-edit-password': password },
      body: JSON.stringify(dataRef.current),
    })
    if (!res.ok) {
      let msg = 'HTTP ' + res.status
      try { msg = (await res.json()).error || msg } catch {}
      throw new Error(msg)
    }
    // draft is now identical to server → drop it and rely on server going forward
    localStorage.removeItem(STORAGE_KEY)
    setSource('server')
    return res.json()
  }, [])

  // Discard local draft, reload the published (server, else file) copy
  const resetToPublished = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY)
    const server = await fetchServer()
    if (server) { setDataState(server); setSource('server'); return }
    const file = await fetchFile()
    setDataState(file); setSource('file')
  }, [])

  const importData = useCallback((json) => setData(json), [setData])

  // Ordered slide ids for prev/next (recursive; appendix groups excluded)
  const orderedSlideIds = useMemo(() => (data ? deckSlideRefs(data.nav) : []), [data])

  const value = {
    data, setData, source, error,
    publish, resetToPublished, importData, orderedSlideIds,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
