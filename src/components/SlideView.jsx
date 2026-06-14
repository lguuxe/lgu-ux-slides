import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { imageSrcFor, imageFallback, slideKind } from '../lib/images.js'
import { ancestorGroups, groupNumbers } from '../lib/nav.js'
import Hotspot from './Hotspot.jsx'
import BackButton from './BackButton.jsx'

export default function SlideView({ slideId }) {
  const { data, orderedSlideIds } = useData()
  const navigate = useNavigate()
  const slide = data.slides?.[slideId]

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

  const kind = slideKind(slide)

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
        {kind === 'iframe' || kind === 'html' ? (() => {
          const frameWidth = kind === 'html' ? slide.htmlWidth : slide.iframeWidth
          return (
          <div className={'slide-iframe-wrap' + (frameWidth ? ' is-bounded' : '')}>
            {kind === 'iframe' && slide.iframeUrl && (
              <a
                className="iframe-popout"
                href={slide.iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="새 창에서 열기 (로그인 세션 유지)"
              >
                새 창에서 열기 ↗
              </a>
            )}
            <iframe
              {...(kind === 'iframe' ? { src: slide.iframeUrl } : { srcDoc: slide.html || '' })}
              title={slide.title}
              allow="clipboard-write; fullscreen; microphone; camera; geolocation; storage-access"
              style={frameWidth ? { maxWidth: `${frameWidth}px` } : undefined}
            />
          </div>
          )
        })() : (
          <div className={'slide-scroll fit-' + (slide.fit || 'contain')}>
            <div className="slide-stage">
              <div className="slide-canvas">
                {kind === 'video' ? (
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
          </div>
        )}
      </div>
    </div>
  )
}
