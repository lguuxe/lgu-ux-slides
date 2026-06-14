import { useEffect, useMemo, useState } from 'react'
import { isGroup, slideRef, groupNumbers, flattenForPicker } from '../lib/nav.js'
import { imageSrcFor, imageFallback } from '../lib/images.js'

function Thumb({ slide }) {
  return <span className="pk-thumb">{slide && <img src={imageSrcFor(slide, { thumb: true })} alt="" loading="lazy" onError={imageFallback(slide)} />}</span>
}

function PickNode({ node, depth, numbers, slides, value, onPick }) {
  if (isGroup(node)) {
    return (
      <div className="pk-group">
        <div className="pk-group-head" style={{ paddingLeft: 12 + depth * 16 }}>
          {numbers[node.id] && <span className="pk-num">{numbers[node.id]}</span>}
          <span className="pk-group-title">{node.title}</span>
        </div>
        {(node.children || []).map((c) => (
          <PickNode key={c.id} node={c} depth={depth + 1} numbers={numbers} slides={slides} value={value} onPick={onPick} />
        ))}
      </div>
    )
  }
  const ref = slideRef(node)
  const slide = slides?.[ref]
  return (
    <button type="button" className={'pk-item' + (ref === value ? ' active' : '')} style={{ paddingLeft: 16 + depth * 16 }} onClick={() => onPick(ref)}>
      <Thumb slide={slide} />
      <span className="pk-item-text"><span className="pk-title">{slide?.title || ref}</span></span>
    </button>
  )
}

function PickerModal({ value, data, onPick, onClose }) {
  const [q, setQ] = useState('')
  const numbers = useMemo(() => groupNumbers(data.nav), [data])
  const flat = useMemo(() => flattenForPicker(data), [data])
  const orphans = flat.filter((it) => it.orphan)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const ql = q.trim().toLowerCase()
  const results = ql ? flat.filter((it) => it.title.toLowerCase().includes(ql) || it.pathLabel.toLowerCase().includes(ql)) : null

  return (
    <div className="pk-overlay" onMouseDown={onClose}>
      <div className="pk-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pk-head">
          <span>슬라이드 선택</span>
          <button className="pk-close" onClick={onClose}>✕</button>
        </div>
        <input className="pk-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·경로 검색…" />
        <div className="pk-list">
          {results ? (
            results.length ? results.map((it) => (
              <button key={it.ref} type="button" className={'pk-item' + (it.ref === value ? ' active' : '')} onClick={() => onPick(it.ref)}>
                <Thumb slide={data.slides[it.ref]} />
                <span className="pk-item-text">
                  {it.pathLabel && <span className="pk-path">{it.pathLabel}</span>}
                  <span className="pk-title">{it.title}</span>
                </span>
              </button>
            )) : <div className="pk-empty">결과 없음</div>
          ) : (
            <>
              {(data.nav || []).map((n) => <PickNode key={n.id} node={n} depth={0} numbers={numbers} slides={data.slides} value={value} onPick={onPick} />)}
              {orphans.length > 0 && (
                <div className="pk-group">
                  <div className="pk-group-head" style={{ paddingLeft: 12 }}><span className="pk-group-title">링크 전용 (네비 미포함)</span></div>
                  {orphans.map((it) => (
                    <button key={it.ref} type="button" className={'pk-item' + (it.ref === value ? ' active' : '')} style={{ paddingLeft: 28 }} onClick={() => onPick(it.ref)}>
                      <Thumb slide={data.slides[it.ref]} />
                      <span className="pk-item-text"><span className="pk-title">{it.title}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SlidePicker({ value, onChange, data, placeholder = '슬라이드 선택' }) {
  const [open, setOpen] = useState(false)
  const current = value ? data.slides?.[value] : null
  return (
    <div className="slide-picker">
      <button type="button" className="sp-trigger" onClick={() => setOpen(true)}>
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
      {open && <PickerModal value={value} data={data} onPick={(ref) => { onChange(ref); setOpen(false) }} onClose={() => setOpen(false)} />}
    </div>
  )
}
