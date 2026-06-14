import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { useData } from './data/DataContext.jsx'
import { imageSrcFor } from './lib/images.js'
import Layout from './components/Layout.jsx'
import SlideView from './components/SlideView.jsx'
import DemoView from './components/DemoView.jsx'
import Editor from './pages/Editor.jsx'

// Warm the HTTP cache for EVERY slide image on first load (deck order first), so
// every transition is instant. Uses fetch (not <img>) to fill the disk cache
// without holding decoded bitmaps in memory. Returns { loaded, total }.
function useImagePreload(data, orderedIds) {
  const [prog, setProg] = useState({ loaded: 0, total: 0 })
  useEffect(() => {
    if (!data?.slides) return
    const ids = [...orderedIds, ...Object.keys(data.slides).filter((id) => !orderedIds.includes(id))]
    const srcs = [...new Set(ids.map((id) => data.slides[id]).filter(Boolean).map((s) => imageSrcFor(s)).filter(Boolean))]
    if (!srcs.length) return
    let loaded = 0
    let cancelled = false
    setProg({ loaded: 0, total: srcs.length })
    const CONC = 6
    let i = 0
    const next = () => {
      if (cancelled || i >= srcs.length) return
      const src = srcs[i++]
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000) // never let one hang the loader
      fetch(src, { signal: ctrl.signal }).then((r) => r.blob()).catch(() => {}).finally(() => {
        clearTimeout(timer)
        if (cancelled) return
        loaded++
        setProg({ loaded, total: srcs.length })
        next()
      })
    }
    for (let c = 0; c < Math.min(CONC, srcs.length); c++) next()
    return () => { cancelled = true }
  }, [data, orderedIds])
  return prog
}

function FirstSlideRedirect() {
  const { orderedSlideIds } = useData()
  if (!orderedSlideIds.length) return null
  return <Navigate to={`/slide/${orderedSlideIds[0]}`} replace />
}

function SlideRoute() {
  const { id } = useParams()
  return <SlideView slideId={id} />
}

function DemoRoute() {
  const { id } = useParams()
  return <DemoView demoId={id} />
}

export default function App() {
  const { data, error, orderedSlideIds } = useData()
  const prog = useImagePreload(data, orderedSlideIds)
  const location = useLocation()
  const [skipped, setSkipped] = useState(false)

  if (error) {
    return <div className="centered">slides.json을 불러오지 못했습니다: {String(error)}</div>
  }
  if (!data) {
    return <div className="centered">불러오는 중…</div>
  }

  const isEditor = location.pathname.startsWith('/admin')
  const preloading = prog.total > 0 && prog.loaded < prog.total
  const showLoader = preloading && !skipped && !isEditor
  const pct = prog.total ? Math.round((prog.loaded / prog.total) * 100) : 0

  return (
    <>
      <Routes>
        <Route path="/admin" element={<Editor />} />
        <Route element={<Layout />}>
          <Route path="/" element={<FirstSlideRedirect />} />
          <Route path="/slide/:id" element={<SlideRoute />} />
          <Route path="/demo/:id" element={<DemoRoute />} />
          <Route path="*" element={<div className="centered">없는 페이지입니다.</div>} />
        </Route>
      </Routes>
      {showLoader && (
        <div className="loading-screen">
          <div className="loading-title">{data.meta?.title || 'Presentation'}</div>
          <div className="loading-sub">슬라이드 준비 중</div>
          <div className="loading-bar"><div className="loading-bar-fill" style={{ width: pct + '%' }} /></div>
          <div className="loading-count">{prog.loaded} / {prog.total}</div>
          <button className="loading-skip" onClick={() => setSkipped(true)}>바로 시작 →</button>
        </div>
      )}
    </>
  )
}
