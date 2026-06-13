import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  const [navOpen, setNavOpen] = useState(true)
  return (
    <div className={'layout' + (navOpen ? '' : ' nav-collapsed')}>
      <Sidebar onCollapse={() => setNavOpen(false)} />
      {!navOpen && (
        <button className="nav-reopen" onClick={() => setNavOpen(true)} title="사이드바 열기">
          »
        </button>
      )}
      <main className="stage">
        <Outlet />
      </main>
    </div>
  )
}
