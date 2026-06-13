import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'

const DataContext = createContext(null)
const STORAGE_KEY = 'ux-report-data-v2'

export function DataProvider({ children }) {
  const [data, setDataState] = useState(null)
  const [source, setSource] = useState('loading') // 'loading' | 'local' | 'file'
  const [error, setError] = useState(null)

  // Load: prefer a locally-edited copy, fall back to the published slides.json
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (!cancelled) {
            setDataState(parsed)
            setSource('local')
          }
          return
        }
      } catch (e) {
        // corrupted local copy — ignore and fall through to the file
        console.warn('Local data unreadable, loading slides.json', e)
      }
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'slides.json')
        const json = await res.json()
        if (!cancelled) {
          setDataState(json)
          setSource('file')
        }
      } catch (e) {
        if (!cancelled) setError(e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Persist every edit to localStorage so the editor survives reloads
  const setData = useCallback((updater) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (e) {
        console.warn('Failed to persist data', e)
      }
      setSource('local')
      return next
    })
  }, [])

  // Discard local edits and reload the published file
  const resetToFile = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY)
    const res = await fetch(import.meta.env.BASE_URL + 'slides.json?ts=' + Date.now())
    const json = await res.json()
    setDataState(json)
    setSource('file')
  }, [])

  // Replace the whole dataset (used by JSON import)
  const importData = useCallback((json) => {
    setData(json)
  }, [setData])

  // Ordered list of slide ids as they appear in the nav tree (for prev/next)
  const orderedSlideIds = useMemo(() => {
    if (!data) return []
    const ids = []
    for (const section of data.nav || []) {
      // appendix sections are reachable from the sidebar but excluded from the
      // main deck's prev/next flow and the "n / total" counter
      if (section.kind === 'appendix') continue
      for (const child of section.children || []) {
        if (child.type === 'slide') ids.push(child.id)
      }
    }
    return ids
  }, [data])

  const value = {
    data,
    setData,
    source,
    error,
    resetToFile,
    importData,
    orderedSlideIds,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
