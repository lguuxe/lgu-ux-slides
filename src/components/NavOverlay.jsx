import { NavLink } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { groupNumbers } from '../lib/nav.js'
import NavTree from './NavTree.jsx'

export default function NavOverlay({ onNavigate }) {
  const { data } = useData()
  const numbers = groupNumbers(data.nav)
  return (
    <div className="nav-overlay">
      <NavTree nodes={data.nav} numbers={numbers} slides={data.slides} onNavigate={onNavigate} />
    </div>
  )
}

export function NavDemos({ onNavigate }) {
  const { data } = useData()
  const demos = data.demos || []
  if (!demos.length) return null
  return (
    <div className="nav-panel-foot">
      <div className="no-label">라이브 시연</div>
      {demos.map((d) => (
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
  )
}
