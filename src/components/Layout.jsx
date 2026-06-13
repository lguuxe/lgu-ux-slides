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
          <button className="nav-reopen" onClick={openSidebar} title="사이드바 열기" aria-label="사이드바 열기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 5C19 4.44772 19.4477 4 20 4C20.5523 4 21 4.44772 21 5V19C21 19.5523 20.5523 20 20 20C19.4477 20 19 19.5523 19 19V5Z" fill="currentColor"/>
              <path d="M3 12C3 11.4477 3.44772 11 4 11H13.5859L10.793 8.20703C10.4025 7.81651 10.4024 7.18349 10.793 6.79297C11.1835 6.40253 11.8165 6.40248 12.207 6.79297L16.707 11.293C16.8945 11.4805 16.9999 11.7349 17 12C17 12.2651 16.8945 12.5195 16.707 12.707L12.207 17.207C11.8165 17.5975 11.1835 17.5976 10.793 17.207C10.4025 16.8165 10.4024 16.1835 10.793 15.793L13.5859 13L4 13C3.44772 13 3 12.5523 3 12Z" fill="currentColor"/>
            </svg>
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
