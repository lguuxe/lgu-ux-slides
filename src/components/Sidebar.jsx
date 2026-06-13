import { NavLink, Link, useLocation } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { isGroup, groupNumbers } from '../lib/nav.js'
import NavTree from './NavTree.jsx'

const sv = { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
function DemoIcon() {
  return (
    <svg {...sv} aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 5.5h12" />
      <path d="M6.5 7.5l2.5 1.5-2.5 1.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg {...sv} aria-hidden="true">
      <path d="M11 2.6l2.4 2.4" />
      <path d="M10 3.6L3.5 10.1 3 13l2.9-.5L12.4 6z" />
    </svg>
  )
}

export default function Sidebar({ onCollapse }) {
  const { data } = useData()
  const location = useLocation()
  const numbers = groupNumbers(data.nav)

  const isAppendix = (n) => isGroup(n) && n.kind === 'appendix'
  const mainNodes = (data.nav || []).filter((n) => !isAppendix(n))
  const appendixNodes = (data.nav || []).filter(isAppendix)

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-head-text">
          <Link to="/" className="sidebar-title">{data.meta?.title || 'Presentation'}</Link>
          {data.meta?.subtitle && <div className="sidebar-sub">{data.meta.subtitle}</div>}
        </div>
        {onCollapse && (
          <button className="sidebar-collapse" onClick={onCollapse} title="사이드바 접기">«</button>
        )}
      </div>

      {/* scrollable middle: main tree */}
      <nav className="nav nav-scroll">
        <NavTree nodes={mainNodes} numbers={numbers} slides={data.slides} thumbnails />
      </nav>

      {/* fixed bottom: appendix + live demos */}
      <div className="nav-fixed">
        {appendixNodes.length > 0 && (
          <NavTree nodes={appendixNodes} numbers={numbers} slides={data.slides} thumbnails />
        )}

        {(data.demos || []).length > 0 && (
          <div className="nav-section gnb">
            <div className="nav-section-label">
              <span className="ns-icon"><DemoIcon /></span>
              라이브 시연
            </div>
            <ul className="nav-list">
              {data.demos.map((demo) => {
                const active = location.pathname === `/demo/${demo.id}`
                return (
                  <li key={demo.id}>
                    <NavLink to={`/demo/${demo.id}`} className={'nav-item' + (active ? ' active' : '')}>
                      {demo.title}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="sidebar-foot">
        <Link to="/admin" className="admin-link">
          <EditIcon />
          편집 모드
        </Link>
      </div>
    </aside>
  )
}
