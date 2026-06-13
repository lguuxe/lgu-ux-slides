import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useData } from './data/DataContext.jsx'
import Layout from './components/Layout.jsx'
import SlideView from './components/SlideView.jsx'
import DemoView from './components/DemoView.jsx'
import Editor from './pages/Editor.jsx'

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
