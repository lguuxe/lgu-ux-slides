import { useNavigate } from 'react-router-dom'

export default function BackButton() {
  const navigate = useNavigate()
  // history.idx > 0 means there is somewhere to go back to within the app
  const canGoBack = window.history.state && window.history.state.idx > 0
  if (!canGoBack) return <div className="back-btn-placeholder" />
  return (
    <button className="back-btn" onClick={() => navigate(-1)}>
      ← 뒤로
    </button>
  )
}
