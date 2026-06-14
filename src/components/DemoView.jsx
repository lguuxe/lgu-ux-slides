import { useState, useRef, useEffect } from 'react'
import { useData } from '../data/DataContext.jsx'
import BackButton from './BackButton.jsx'

export default function DemoView({ demoId }) {
  const { data } = useData()
  const demo = (data.demos || []).find((d) => d.id === demoId)
  const [reloadKey, setReloadKey] = useState(0)
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  const vp = demo?.viewport

  useEffect(() => {
    if (!vp || !wrapRef.current) return
    const el = wrapRef.current
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width && height) setScale(Math.min(width / vp.width, height / vp.height))
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [vp])

  if (!demo) {
    return <div className="centered">데모 «{demoId}» 를 찾을 수 없습니다.</div>
  }

  return (
    <div className="demo-view">
      <div className="toolbar">
        <BackButton />
        <div className="toolbar-title">{demo.title}</div>
        <div className="toolbar-spacer" />
        <a className="ext-link" href={demo.url} target="_blank" rel="noopener noreferrer">새 탭에서 열기 ↗</a>
        <button className="reload-btn" onClick={() => setReloadKey((k) => k + 1)}>↻ 새로고침</button>
      </div>
      <div ref={wrapRef} className={`iframe-wrap${vp ? ' iframe-wrap--viewport' : ''}`}>
        {vp ? (
          <div
            className="iframe-scaler"
            style={{ width: vp.width * scale, height: vp.height * scale }}
          >
            <iframe
              key={reloadKey}
              src={demo.url}
              title={demo.title}
              allow="clipboard-write; fullscreen; microphone; camera; geolocation"
              style={{ width: vp.width, height: vp.height, transform: `scale(${scale})` }}
            />
          </div>
        ) : (
          <iframe
            key={reloadKey}
            src={demo.url}
            title={demo.title}
            allow="clipboard-write; fullscreen; microphone; camera; geolocation"
          />
        )}
      </div>
    </div>
  )
}
