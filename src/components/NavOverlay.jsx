import { NavLink } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { groupNumbers } from '../lib/nav.js'
import NavTree from './NavTree.jsx'

// Frosted-glass quick-nav shown when hovering the open button while collapsed.
export default function NavOverlay({ onNavigate }) {
  const { data } = useData()
  const numbers = groupNumbers(data.nav)
  return (
    <div className="nav-overlay">
      <NavTree nodes={data.nav} numbers={numbers} slides={data.slides} onNavigate={onNavigate} />
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
