import { useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'

/* ---- inline icons (16px grid, inherit currentColor) ---- */
const sv = { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }

function ChevronIcon({ className }) {
  return (
    <svg {...sv} className={className} aria-hidden="true">
      <path d="M4 6.5l4 4 4-4" />
    </svg>
  )
}
function AppendixIcon() {
  // bookmark — supplementary / saved material
  return (
    <svg {...sv} aria-hidden="true">
      <path d="M4 2.5h8v11l-4-2.5-4 2.5z" />
    </svg>
  )
}
function DemoIcon() {
  // browser window with a play glyph — live demo
  return (
    <svg {...sv} aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 5.5h12" />
      <path d="M6.5 7.5l2.5 1.5-2.5 1.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}
function EditIcon() {
  // pencil
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
  const [collapsed, setCollapsed] = useState({})

  const toggle = (id) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }))

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-head-text">
          <Link to="/" className="sidebar-title">{data.meta?.title || 'Presentation'}</Link>
          {data.meta?.subtitle && <div className="sidebar-sub">{data.meta.subtitle}</div>}
        </div>
        {onCollapse && (
          <button className="sidebar-collapse" onClick={onCollapse} title="사이드바 접기">
            «
          </button>
        )}
      </div>

      <nav className="nav">
        {(data.nav || []).map((section) => {
          const isCollapsed = collapsed[section.id]
          const isAppendix = section.kind === 'appendix'
          return (
            <div key={section.id} className={'nav-section' + (isAppendix ? ' appendix' : '')}>
              <button className="nav-section-title" onClick={() => toggle(section.id)}>
                {isAppendix && <span className="ns-icon"><AppendixIcon /></span>}
                <span className="ns-text">{section.title}</span>
                <ChevronIcon className={'ns-chevron' + (isCollapsed ? ' closed' : '')} />
              </button>
              {!isCollapsed && (
                <ul className="nav-list">
                  {(section.children || []).map((child) => {
                    const slide = data.slides?.[child.id]
                    return (
                      <li key={child.id}>
                        <NavLink
                          to={`/slide/${child.id}`}
                          className={({ isActive }) =>
                            'nav-item' + (isActive ? ' active' : '')
                          }
                        >
                          {slide?.title || child.id}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}

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
                    <NavLink
                      to={`/demo/${demo.id}`}
                      className={'nav-item' + (active ? ' active' : '')}
                    >
                      {demo.title}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className="sidebar-foot">
        <Link to="/admin" className="admin-link">
          <EditIcon />
          편집 모드
        </Link>
      </div>
    </aside>
  )
}
