import { NavLink } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'

// Frosted-glass quick-nav shown when hovering the open button while the sidebar
// is collapsed.
export default function NavOverlay({ onNavigate }) {
  const { data } = useData()
  return (
    <div className="nav-overlay">
      {(data.nav || []).map((section) => (
        <div className="no-section" key={section.id}>
          <div className="no-label">{section.title}</div>
          {(section.children || []).map((c) => (
            <NavLink
              key={c.id}
              to={`/slide/${c.id}`}
              onClick={onNavigate}
              className={({ isActive }) => 'no-item' + (isActive ? ' active' : '')}
            >
              {data.slides?.[c.id]?.title || c.id}
            </NavLink>
          ))}
        </div>
      ))}
      {(data.demos || []).length > 0 && (
        <div className="no-section">
          <div className="no-label">라이브 시연</div>
          {data.demos.map((d) => (
            <NavLink
              key={d.id}
              to={`/demo/${d.id}`}
              onClick={onNavigate}
              className={({ isActive }) => 'no-item' + (isActive ? ' active' : '')}
            >
              {d.title}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
