import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import NavOverlay from './NavOverlay.jsx'

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false) // collapsed by default
  const [menuOpen, setMenuOpen] = useState(false)
  const [chromeHidden, setChromeHidden] = useState(false)
  const closeTimer = useRef(null)
  const hideTimer = useRef(null)

  const openMenu = () => { clearTimeout(closeTimer.current); setMenuOpen(true) }
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setMenuOpen(false), 160) }
  const openSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(true) }
  const collapseSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(false) }

  // auto-hide the top chrome (toolbar + open button) after 2s of no movement,
  // only while the sidebar is collapsed; reveal on mouse move.
  const poke = () => {
    if (chromeHidden) setChromeHidden(false)
    clearTimeout(hideTimer.current)
    if (!navOpen) hideTimer.current = setTimeout(() => setChromeHidden(true), 2000)
  }
  useEffect(() => {
    clearTimeout(hideTimer.current)
    if (navOpen) { setChromeHidden(false) }
    else { hideTimer.current = setTimeout(() => setChromeHidden(true), 2000) }
    return () => clearTimeout(hideTimer.current)
  }, [navOpen])

  return (
    <div
      className={'layout' + (navOpen ? '' : ' nav-collapsed') + (chromeHidden && !navOpen ? ' chrome-hidden' : '')}
      onMouseMove={poke}
    >
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
