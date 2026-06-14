import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function BackButton() {
  const navigate = useNavigate()
  const canGoBack = window.history.state && window.history.state.idx > 0

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Backspace') {
        const idx = window.history.state?.idx
        if (idx && idx > 0) { e.preventDefault(); navigate(-1) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (!canGoBack) return <div className="back-btn-placeholder" />
  return (
    <button className="back-btn" onClick={() => navigate(-1)}>
      ← 뒤로
    </button>
  )
}
