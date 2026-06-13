import { useNavigate } from 'react-router-dom'

// Resolve a hotspot target into a navigation action
export function useHotspotAction() {
  const navigate = useNavigate()
  return (target) => {
    if (!target) return
    switch (target.type) {
      case 'slide':
        navigate(`/slide/${target.ref}`)
        break
      case 'demo':
        navigate(`/demo/${target.ref}`)
        break
      case 'url':
        window.open(target.ref, '_blank', 'noopener')
        break
      default:
        break
    }
  }
}

export default function Hotspot({ hotspot }) {
  const act = useHotspotAction()
  const style = {
    left: `${hotspot.x}%`,
    top: `${hotspot.y}%`,
    width: `${hotspot.w}%`,
    height: `${hotspot.h}%`,
  }
  return (
    <button
      className="hotspot"
      style={style}
      title={hotspot.label}
      onClick={() => act(hotspot.target)}
    >
      <span className="hotspot-label">{hotspot.label}</span>
    </button>
  )
}
