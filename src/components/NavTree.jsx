import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { isGroup, slideRef } from '../lib/nav.js'
import { imageSrcFor, imageFallback } from '../lib/images.js'

function Chevron({ open }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      className={'nt-chevron' + (open ? '' : ' closed')} aria-hidden="true">
      <path d="M4 6.5l4 4 4-4" />
    </svg>
  )
}

function GroupNode({ node, depth, numbers, slides, onNavigate, thumbnails }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={'nt-group' + (node.kind === 'appendix' ? ' appendix' : '')}>
      <button className="nt-group-head" style={{ paddingLeft: 10 + depth * 14 }} onClick={() => setOpen((o) => !o)}>
        <Chevron open={open} />
        {numbers[node.id] && <span className="nt-num">{numbers[node.id]}</span>}
        <span className="nt-group-title">{node.title}</span>
      </button>
      {open && (node.children || []).map((c) => (
        <Node key={c.id} node={c} depth={depth + 1} numbers={numbers} slides={slides} onNavigate={onNavigate} thumbnails={thumbnails} />
      ))}
    </div>
  )
}

function SlideNode({ node, depth, slides, onNavigate, thumbnails }) {
  const ref = slideRef(node)
  const slide = slides?.[ref]
  const location = useLocation()
  const active = location.pathname === `/slide/${ref}`
  const elRef = useRef(null)

  // keep the active slide scrolled into view as you navigate the deck
  useEffect(() => {
    if (active && elRef.current) elRef.current.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <NavLink
      ref={elRef}
      to={`/slide/${ref}`}
      onClick={onNavigate}
      className={({ isActive }) => 'nt-slide' + (isActive ? ' active' : '')}
      style={{ paddingLeft: (thumbnails ? 10 : 12) + depth * 14 }}
    >
      {thumbnails && (
        <span className="nt-thumb">{slide ? <img src={imageSrcFor(slide, { thumb: true })} alt="" loading="lazy" onError={imageFallback(slide)} /> : null}</span>
      )}
      <span className="nt-slide-title">{slide?.title || ref}</span>
    </NavLink>
  )
}

function Node(props) {
  return isGroup(props.node) ? <GroupNode {...props} /> : <SlideNode {...props} />
}

export default function NavTree({ nodes, numbers, slides, onNavigate, thumbnails = false, depthStart = 0 }) {
  return (nodes || []).map((node) => (
    <Node key={node.id} node={node} depth={depthStart} numbers={numbers || {}} slides={slides} onNavigate={onNavigate} thumbnails={thumbnails} />
  ))
}
