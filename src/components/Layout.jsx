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

  const showChrome = () => { clearTimeout(hideTimer.current); setChromeHidden(false) }
  const scheduleHide = (delay) => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => { if (!menuOpenRef.current) setChromeHidden(true) }, delay)
  }

  const openMenu = () => { clearTimeout(closeTimer.current); showChrome(); setMenuOpen(true) }
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => { setMenuOpen(false); scheduleHide(500) }, 160)
  }
  const openSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(true) }
  const collapseSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(false) }

  // collapsed presentation mode: top chrome appears only when the cursor goes to
  // the top edge of the screen, and hides shortly after it leaves.
  const onMouseMove = (e) => {
    if (navOpen) return
    if (e.clientY <= 72) showChrome()
    else if (!menuOpenRef.current && !chromeHidden) scheduleHide(500)
  }
  useEffect(() => {
    clearTimeout(hideTimer.current)
    if (navOpen) setChromeHidden(false)
    else scheduleHide(1000) // show briefly on entering, then hide
    return () => clearTimeout(hideTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navOpen])

  return (
    <div
      className={'layout' + (navOpen ? '' : ' nav-collapsed') + (chromeHidden && !navOpen ? ' chrome-hidden' : '')}
      onMouseMove={onMouseMove}
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
