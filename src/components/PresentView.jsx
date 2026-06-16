import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { imageSrcFor, imageFallback, slideKind } from '../lib/images.js'
import { onNav } from '../lib/broadcast.js'
import Hotspot from './Hotspot.jsx'

export default function PresentView() {
  const { id } = useParams()
  const { data } = useData()
  const navigate = useNavigate()
  const slide = data?.slides?.[id]

  useEffect(() => onNav((path) => navigate(path, { replace: true })), [navigate])

  if (!slide) return <div className="centered">슬라이드를 찾을 수 없습니다.</div>

  const kind = slideKind(slide)

  return (
    <div className="present-view">
      {kind === 'iframe' || kind === 'html' ? (() => {
        const frameWidth = kind === 'html' ? slide.htmlWidth : slide.iframeWidth
        return (
          <div className={'slide-iframe-wrap present-iframe' + (frameWidth ? ' is-bounded' : '')}>
            <iframe
              {...(kind === 'iframe' ? { src: slide.iframeUrl } : { srcDoc: slide.html || '' })}
              title={slide.title}
              allow="clipboard-write; fullscreen; microphone; camera; geolocation; storage-access"
              style={frameWidth ? { maxWidth: `${frameWidth}px` } : undefined}
            />
          </div>
        )
      })() : kind === 'video' ? (
        <video
          src={slide.video}
          poster={imageSrcFor(slide)}
          controls
          playsInline
          className="present-video"
        />
      ) : (
        <div className={'present-slide fit-' + (slide.fit || 'contain')}>
          <div className="present-canvas">
            <img src={imageSrcFor(slide)} alt={slide.title} draggable={false} onError={imageFallback(slide)} />
            {(slide.hotspots || []).map((hs) => (
              <Hotspot key={hs.id} hotspot={hs} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
