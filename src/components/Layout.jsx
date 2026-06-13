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

  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen
  const HIDE_DELAY = 1000

  // show the chrome and (re)arm a 1s auto-hide (unless the nav menu is open)
  const showChrome = () => {
    setChromeHidden(false)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => { if (!menuOpenRef.current) setChromeHidden(true) }, HIDE_DELAY)
  }

  const openMenu = () => { clearTimeout(closeTimer.current); clearTimeout(hideTimer.current); setChromeHidden(false); setMenuOpen(true) }
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => { setMenuOpen(false); showChrome() }, 160)
  }
  const openSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(true) }
  const collapseSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(false) }

  // collapsed presentation mode: chrome appears when the cursor hits the very top
  // edge (≤12px) — over slides via mousemove, over the demo iframe via the trigger
  // strip — and stays while moving within the toolbar area (≤72px).
  const onMouseMove = (e) => {
    if (navOpen) return
    if (e.clientY <= 12) showChrome()
    else if (e.clientY <= 72 && !chromeHidden) showChrome()
  }
  useEffect(() => {
    clearTimeout(hideTimer.current)
    if (navOpen) setChromeHidden(false)
    else hideTimer.current = setTimeout(() => { if (!menuOpenRef.current) setChromeHidden(true) }, HIDE_DELAY)
    return () => clearTimeout(hideTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navOpen])

  return (
    <div
      className={'layout' + (navOpen ? '' : ' nav-collapsed') + (chromeHidden && !navOpen ? ' chrome-hidden' : '')}
      onMouseMove={onMouseMove}
    >
      <Sidebar onCollapse={collapseSidebar} />
      {!navOpen && <div className="chrome-trigger" onMouseEnter={showChrome} />}
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
