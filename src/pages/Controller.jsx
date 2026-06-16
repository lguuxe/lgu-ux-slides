import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { imageSrcFor, imageFallback, slideKind } from '../lib/images.js'
import { ancestorGroups, groupNumbers, isGroup, slideRef } from '../lib/nav.js'
import { sendNav } from '../lib/broadcast.js'
import Hotspot from '../components/Hotspot.jsx'

function Timer() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (!running) return
    const start = Date.now() - elapsed
    ref.current = setInterval(() => setElapsed(Date.now() - start), 200)
    return () => clearInterval(ref.current)
  }, [running])

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const pad = (n) => String(n).padStart(2, '0')
    return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
  }

  return (
    <div className="ctrl-timer">
      <span className="ctrl-timer-display">{fmt(elapsed)}</span>
      <button onClick={() => setRunning((r) => !r)}>{running ? '⏸' : '▶'}</button>
      <button onClick={() => { setRunning(false); setElapsed(0) }}>↺</button>
    </div>
  )
}

function SlidePreview({ slide, slideId, label, dimmed }) {
  if (!slide) return <div className={'ctrl-preview' + (dimmed ? ' dimmed' : '')}><div className="ctrl-preview-empty">{label}</div></div>
  const kind = slideKind(slide)
  return (
    <div className={'ctrl-preview' + (dimmed ? ' dimmed' : '')}>
      <div className="ctrl-preview-label">{label}</div>
      {kind === 'figma' || kind === 'video' ? (
        <div className="ctrl-preview-img">
          <img src={imageSrcFor(slide)} alt={slide.title} draggable={false} onError={imageFallback(slide)} />
        </div>
      ) : (
        <div className="ctrl-preview-alt">{kind === 'iframe' ? '🌐 iframe' : kind === 'html' ? '📄 HTML' : kind}</div>
      )}
      <div className="ctrl-preview-title">{slide.title}</div>
    </div>
  )
}

function NavItem({ node, depth, numbers, slides, currentId, onGo }) {
  if (isGroup(node)) {
    const [open, setOpen] = useState(true)
    return (
      <div className="ctrl-nav-group">
        <div className="ctrl-nav-grouphead" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setOpen((o) => !o)}>
          <span className="ctrl-nav-arrow" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
          {numbers[node.id] && <span className="ctrl-nav-num">{numbers[node.id]}</span>}
          {node.title}
        </div>
        {open && (node.children || []).map((c) => (
          <NavItem key={c.id} node={c} depth={depth + 1} numbers={numbers} slides={slides} currentId={currentId} onGo={onGo} />
        ))}
      </div>
    )
  }
  const ref = slideRef(node)
  const s = slides?.[ref]
  const src = s ? imageSrcFor(s, { thumb: true }) : null
  return (
    <div
      className={'ctrl-nav-slide' + (ref === currentId ? ' active' : '')}
      style={{ paddingLeft: 12 + depth * 14 }}
      onClick={() => onGo(ref)}
    >
      {src && <img className="ctrl-nav-thumb" src={src} alt="" draggable={false} />}
      <span className="ctrl-nav-slide-title">{s?.title || ref}</span>
    </div>
  )
}

export default function Controller() {
  const { data, orderedSlideIds } = useData()
  const navigate = useNavigate()
  const location = useLocation()
  const [presentWin, setPresentWin] = useState(null)

  const slideMatch = location.pathname.match(/^\/control\/(.+)/)
  const currentId = slideMatch ? slideMatch[1] : orderedSlideIds[0]
  const idx = orderedSlideIds.indexOf(currentId)
  const prevId = idx > 0 ? orderedSlideIds[idx - 1] : null
  const nextId = idx < orderedSlideIds.length - 1 ? orderedSlideIds[idx + 1] : null

  const current = data?.slides?.[currentId]
  const next = nextId ? data?.slides?.[nextId] : null

  const goTo = useCallback((id) => {
    navigate(`/control/${id}`)
    sendNav(`/present/${id}`)
  }, [navigate])

  const openPresent = () => {
    const w = window.open(`/present/${currentId}`, 'lgu-present', 'popup')
    setPresentWin(w)
    sendNav(`/present/${currentId}`)
  }

  useEffect(() => {
    if (presentWin && !presentWin.closed) {
      sendNav(`/present/${currentId}`)
    }
  }, [currentId, presentWin])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight' || e.key === ' ') { if (nextId) goTo(nextId); e.preventDefault() }
      if (e.key === 'ArrowLeft') { if (prevId) goTo(prevId); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, nextId, prevId])

  useEffect(() => {
    if (!slideMatch && orderedSlideIds.length) {
      navigate(`/control/${orderedSlideIds[0]}`, { replace: true })
    }
  }, [])

  if (!data) return <div className="centered">불러오는 중…</div>

  const numbers = groupNumbers(data.nav)
  const breadcrumbs = ancestorGroups(data.nav, currentId)

  return (
    <div className="controller">
      <div className="ctrl-sidebar">
        <div className="ctrl-sidebar-head">
          <button className="ctrl-open-present" onClick={openPresent}>
            발표 창 열기 ↗
          </button>
          <Timer />
        </div>
        <div className="ctrl-nav-scroll">
          {(data.nav || []).map((n) => (
            <NavItem key={n.id} node={n} depth={0} numbers={numbers} slides={data.slides} currentId={currentId} onGo={goTo} />
          ))}
          {(data.demos || []).length > 0 && (
            <div className="ctrl-nav-demos">
              <div className="ctrl-nav-grouphead">라이브 시연</div>
              {data.demos.map((d) => (
                <div key={d.id} className="ctrl-nav-slide" onClick={() => window.open(d.url, '_blank')}>
                  {d.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="ctrl-main">
        <div className="ctrl-top">
          <div className="ctrl-breadcrumbs">
            {breadcrumbs.map((g) => (
              <span key={g.id} className="ctrl-crumb">
                {numbers[g.id] && <span className="ctrl-crumb-num">{numbers[g.id]}</span>}
                {g.title} ›{' '}
              </span>
            ))}
            <span className="ctrl-crumb-current">{current?.title || currentId}</span>
          </div>
          <div className="ctrl-pos">{idx + 1} / {orderedSlideIds.length}</div>
        </div>
        <div className="ctrl-previews">
          <SlidePreview slide={current} slideId={currentId} label="현재 슬라이드" />
          <SlidePreview slide={next} slideId={nextId} label="다음 슬라이드" dimmed />
        </div>
        <div className="ctrl-controls">
          <button disabled={!prevId} onClick={() => prevId && goTo(prevId)}>← 이전</button>
          <button disabled={!nextId} onClick={() => nextId && goTo(nextId)}>다음 →</button>
        </div>
      </div>
    </div>
  )
}
