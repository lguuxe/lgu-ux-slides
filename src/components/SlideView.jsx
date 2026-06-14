import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { imageSrcFor, imageFallback } from '../lib/images.js'
import { ancestorGroups, groupNumbers } from '../lib/nav.js'
import Hotspot, { useHotspotAction } from './Hotspot.jsx'
import BackButton from './BackButton.jsx'

export default function SlideView({ slideId }) {
  const { data, orderedSlideIds } = useData()
  const navigate = useNavigate()
  const act = useHotspotAction()
  const slide = data.slides?.[slideId]
  const shortcuts = data.shortcuts || []

  const idx = orderedSlideIds.indexOf(slideId)
  const inDeck = idx !== -1
  const prevId = inDeck && idx > 0 ? orderedSlideIds[idx - 1] : null
  const nextId = inDeck && idx < orderedSlideIds.length - 1 ? orderedSlideIds[idx + 1] : null

  // Arrow-key navigation through the deck
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight' && nextId) navigate(`/slide/${nextId}`)
      if (e.key === 'ArrowLeft' && prevId) navigate(`/slide/${prevId}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, nextId, prevId])

  if (!slide) {
    return <div className="centered">슬라이드 «{slideId}» 를 찾을 수 없습니다.</div>
  }

  return (
    <div className="slide-view">
      <div className="toolbar">
        <BackButton />
        <div className="toolbar-title">
          {(() => {
            const numbers = groupNumbers(data.nav)
            return ancestorGroups(data.nav, slideId).map((g) => (
              <span key={g.id} className="crumb">
                {numbers[g.id] && <span className="crumb-num">{numbers[g.id]}</span>}
                {g.title}
                <span className="crumb-sep">›</span>
              </span>
            ))
          })()}
          <span className="crumb-current">{slide.title}</span>
        </div>
        <div className="toolbar-spacer" />
        {inDeck && (
          <div className="deck-nav">
            <button disabled={!prevId} onClick={() => prevId && navigate(`/slide/${prevId}`)}>←</button>
            <span className="deck-pos">{idx + 1} / {orderedSlideIds.length}</span>
            <button disabled={!nextId} onClick={() => nextId && navigate(`/slide/${nextId}`)}>→</button>
          </div>
        )}
      </div>

      <div className="slide-body">
        <div className={'slide-scroll fit-' + (slide.fit || 'contain')}>
          <div className="slide-canvas">
            {slide.video ? (
              <video
                src={slide.video}
                poster={imageSrcFor(slide)}
                controls
                playsInline
                className="slide-video"
              />
            ) : (
              <img src={imageSrcFor(slide)} alt={slide.title} draggable={false} onError={imageFallback(slide)} />
            )}
            {(slide.hotspots || []).map((hs) => (
              <Hotspot key={hs.id} hotspot={hs} />
            ))}
          </div>
        </div>
        {shortcuts.length > 0 && (
          <aside className="slide-rail">
            {shortcuts.map((s) => (
              <button key={s.id} className="rail-btn" onClick={() => act(s.target)} title={s.label}>
                {s.label}
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}
