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
          <button className="sidebar-collapse" onClick={onCollapse} title="사이드바 접기" aria-label="사이드바 접기">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 19C5 19.5523 4.55229 20 4 20C3.44772 20 3 19.5523 3 19L3 5C3 4.44772 3.44772 4 4 4C4.55229 4 5 4.44772 5 5L5 19Z" fill="currentColor"/>
              <path d="M21 12C21 12.5523 20.5523 13 20 13L10.4141 13L13.207 15.793C13.5975 16.1835 13.5976 16.8165 13.207 17.207C12.8165 17.5975 12.1835 17.5975 11.793 17.207L7.29297 12.707C7.10549 12.5195 7.00005 12.2651 7 12C7.00001 11.7349 7.10553 11.4805 7.29297 11.293L11.793 6.79297C12.1835 6.40245 12.8165 6.40245 13.207 6.79297C13.5975 7.1835 13.5976 7.81651 13.207 8.20703L10.4141 11H20C20.5523 11 21 11.4477 21 12Z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>

      {/* scrollable: main tree + appendix flow together */}
      <nav className="nav nav-scroll">
        <NavTree nodes={mainNodes} numbers={numbers} slides={data.slides} thumbnails />

        {appendixNodes.length > 0 && (
          <NavTree nodes={appendixNodes} numbers={numbers} slides={data.slides} thumbnails />
        )}
      </nav>

      {/* fixed bottom: live demos */}
      {(data.demos || []).length > 0 && (
        <div className="nav-fixed">
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
        </div>
      )}

      <div className="sidebar-foot">
        <Link to="/admin" className="admin-link">
          <EditIcon />
          편집 모드
        </Link>
      </div>
    </aside>
  )
}
