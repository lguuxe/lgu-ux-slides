import { useEffect } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useData } from './data/DataContext.jsx'
import { imageSrcFor } from './lib/images.js'
import Layout from './components/Layout.jsx'
import SlideView from './components/SlideView.jsx'
import DemoView from './components/DemoView.jsx'
import Editor from './pages/Editor.jsx'

// Preload every slide image into the browser cache so navigation is instant.
function useImagePreload(data) {
  useEffect(() => {
    if (!data?.slides) return
    const imgs = []
    for (const slide of Object.values(data.slides)) {
      const src = imageSrcFor(slide)
      if (!src) continue
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      imgs.push(img)
    }
    return () => { imgs.length = 0 }
  }, [data])
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
  const { data, error } = useData()
  useImagePreload(data)

  if (error) {
    return <div className="centered">slides.json을 불러오지 못했습니다: {String(error)}</div>
  }
  if (!data) {
    return <div className="centered">불러오는 중…</div>
  }

  return (
    <Routes>
      <Route path="/admin" element={<Editor />} />
      <Route element={<Layout />}>
        <Route path="/" element={<FirstSlideRedirect />} />
        <Route path="/slide/:id" element={<SlideRoute />} />
        <Route path="/demo/:id" element={<DemoRoute />} />
        <Route path="*" element={<div className="centered">없는 페이지입니다.</div>} />
      </Route>
    </Routes>
  )
}
