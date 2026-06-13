import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import NavOverlay from './NavOverlay.jsx'

export default function Layout() {
  const location = useLocation()
  const isDemo = location.pathname.startsWith('/demo')

  const [navOpen, setNavOpen] = useState(false) // collapsed by default
  const [menuOpen, setMenuOpen] = useState(false)
  const [chromeHidden, setChromeHidden] = useState(false)
  const closeTimer = useRef(null)
  const hideTimer = useRef(null)
  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen

  // show the top chrome and auto-hide after `delay` (unless the nav menu is open)
  const showChrome = (delay = 2000) => {
    setChromeHidden(false)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => { if (!menuOpenRef.current) setChromeHidden(true) }, delay)
  }

  const openMenu = () => { clearTimeout(closeTimer.current); clearTimeout(hideTimer.current); setChromeHidden(false); setMenuOpen(true) }
  const scheduleClose = () => { closeTimer.current = setTimeout(() => { setMenuOpen(false); showChrome() }, 160) }
  const openSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(true) }
  const collapseSidebar = () => { clearTimeout(closeTimer.current); setMenuOpen(false); setNavOpen(false) }

  // Reveal the toolbar by tapping/clicking empty slide space (works on mobile too).
  // Ignore taps on hotspots, the toolbar, the nav button/menu.
  const onStageClick = (e) => {
    if (navOpen || isDemo) return
    if (e.target.closest('.hotspot, .toolbar, .nav-pop, .nav-overlay, button, a')) return
    showChrome(2000)
  }
  // keep it visible while the cursor is over the revealed toolbar (desktop)
  const onMouseMove = (e) => {
    if (navOpen || isDemo) return
    if (!chromeHidden && e.clientY <= 72) showChrome(2000)
  }

  useEffect(() => {
    clearTimeout(hideTimer.current)
    if (navOpen || isDemo) { setChromeHidden(false); return } // open or demo → always visible
    setChromeHidden(false)
    hideTimer.current = setTimeout(() => { if (!menuOpenRef.current) setChromeHidden(true) }, 2000)
    return () => clearTimeout(hideTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navOpen, isDemo])

  return (
    <div
      className={'layout' + (navOpen ? '' : ' nav-collapsed') + (chromeHidden && !navOpen ? ' chrome-hidden' : '') + (isDemo ? ' is-demo' : '')}
      onMouseMove={onMouseMove}
      onClick={onStageClick}
    >
      <Sidebar onCollapse={collapseSidebar} />
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
