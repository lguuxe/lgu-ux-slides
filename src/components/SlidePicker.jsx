import { useEffect, useMemo, useRef, useState } from 'react'
import { flattenForPicker } from '../lib/nav.js'
import { imageSrcFor, imageFallback } from '../lib/images.js'

// Searchable slide chooser showing hierarchy path + thumbnail.
export default function SlidePicker({ value, onChange, data, placeholder = '슬라이드 선택' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef(null)

  const items = useMemo(() => flattenForPicker(data), [data])
  const current = value ? data.slides?.[value] : null

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const ql = q.trim().toLowerCase()
  const filtered = ql
    ? items.filter((it) => it.title.toLowerCase().includes(ql) || it.pathLabel.toLowerCase().includes(ql))
    : items

  return (
    <div className="slide-picker" ref={rootRef}>
      <button type="button" className="sp-trigger" onClick={() => setOpen((o) => !o)}>
        {current ? (
          <>
            <span className="sp-thumb"><img src={imageSrcFor(current, { thumb: true })} alt="" onError={imageFallback(current)} /></span>
            <span className="sp-trigger-title">{current.title || value}</span>
          </>
        ) : (
          <span className="sp-placeholder">{placeholder}</span>
        )}
        <span className="sp-caret">▾</span>
      </button>
      {open && (
        <div className="sp-pop">
          <input className="sp-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·경로 검색…" />
          <div className="sp-list">
            {filtered.map((it) => (
              <button
                key={it.ref}
                type="button"
                className={'sp-item' + (it.ref === value ? ' active' : '')}
                onClick={() => { onChange(it.ref); setOpen(false); setQ('') }}
              >
                <span className="sp-thumb">{data.slides?.[it.ref] && <img src={imageSrcFor(data.slides[it.ref], { thumb: true })} alt="" loading="lazy" onError={imageFallback(data.slides[it.ref])} />}</span>
                <span className="sp-item-text">
                  {it.pathLabel && <span className="sp-path">{it.pathLabel}</span>}
                  <span className="sp-title">{it.title}</span>
                </span>
              </button>
            ))}
            {!filtered.length && <div className="sp-empty">결과 없음</div>}
          </div>
        </div>
      )}
    </div>
  )
}
