import { useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import NavOverlay from './NavOverlay.jsx'

export default function Layout() {
  const [navOpen, setNavOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeTimer = useRef(null)

  const openMenu = () => { clearTimeout(closeTimer.current); setMenuOpen(true) }
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setMenuOpen(false), 160) }
  const openSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(true) }
  const collapseSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(false) }

  return (
    <div className={'layout' + (navOpen ? '' : ' nav-collapsed')}>
      <Sidebar onCollapse={collapseSidebar} />
      {!navOpen && (
        <div className="nav-pop" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
          <button className="nav-reopen" onClick={openSidebar} title="사이드바 열기">
            »
          </button>
          {menuOpen && <NavOverlay onNavigate={() => setMenuOpen(false)} />}
        </div>
      )}
      <main className="stage">
        <Outlet />
      </main>
    </div>
  )
}
