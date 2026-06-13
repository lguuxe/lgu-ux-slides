import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { imageSrcFor, imageFallback } from '../lib/images.js'

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`

export default function Editor() {
  const { data, setData, source, resetToPublished, importData, publish } = useData()
  const [selectedId, setSelectedId] = useState(() => {
    const first = data.nav?.[0]?.children?.[0]?.id
    return first || Object.keys(data.slides || {})[0] || null
  })
  const fileInputRef = useRef(null)
  const bodyRef = useRef(null)
  const [structW, setStructW] = useState(348) // draggable width of the structure panel

  const startResize = (e) => {
    e.preventDefault()
    const move = (ev) => {
      const rect = bodyRef.current?.getBoundingClientRect()
      if (!rect) return
      setStructW(Math.max(240, Math.min(640, ev.clientX - rect.left)))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
  }

  // ---- ids referenced by the nav vs. loose appendix slides ----
  const navSlideIds = useMemo(() => {
    const set = new Set()
    for (const s of data.nav || []) for (const c of s.children || []) set.add(c.id)
    return set
  }, [data])
  const appendixIds = useMemo(
    () => Object.keys(data.slides || {}).filter((id) => !navSlideIds.has(id)),
    [data, navSlideIds]
  )

  const selected = selectedId ? data.slides?.[selectedId] : null

  // ---------- structure mutations ----------
  const addSection = () => {
    const id = uid('sec')
    setData((d) => ({ ...d, nav: [...(d.nav || []), { id, title: '새 섹션', children: [] }] }))
  }
  const renameSection = (sectionId, title) => {
    setData((d) => ({
      ...d,
      nav: d.nav.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    }))
  }
  const deleteSection = (sectionId) => {
    if (!confirm('섹션을 삭제할까요? (슬라이드 데이터는 부록으로 남습니다)')) return
    setData((d) => ({ ...d, nav: d.nav.filter((s) => s.id !== sectionId) }))
  }
  const moveSlide = (sectionId, index, dir) => {
    setData((d) => ({
      ...d,
      nav: d.nav.map((s) => {
        if (s.id !== sectionId) return s
        const children = [...s.children]
        const j = index + dir
        if (j < 0 || j >= children.length) return s
        ;[children[index], children[j]] = [children[j], children[index]]
        return { ...s, children }
      }),
    }))
  }
  const reassignSlide = (slideId, fromSectionId, toSectionId) => {
    setData((d) => ({
      ...d,
      nav: d.nav.map((s) => {
        if (s.id === fromSectionId) return { ...s, children: s.children.filter((c) => c.id !== slideId) }
        if (s.id === toSectionId && !s.children.some((c) => c.id === slideId))
          return { ...s, children: [...s.children, { id: slideId, type: 'slide' }] }
        return s
      }),
    }))
  }
  const addSlide = (sectionId) => {
    const id = uid('slide')
    setData((d) => ({
      ...d,
      slides: { ...d.slides, [id]: { title: '새 슬라이드', image: '/slides/cover.svg', hotspots: [] } },
      nav: d.nav.map((s) =>
        s.id === sectionId ? { ...s, children: [...s.children, { id, type: 'slide' }] } : s
      ),
    }))
    setSelectedId(id)
  }
  const addAppendix = () => {
    const id = uid('appendix')
    setData((d) => ({
      ...d,
      slides: { ...d.slides, [id]: { title: '새 슬라이드(링크 전용)', image: '/slides/cover.svg', hotspots: [] } },
    }))
    setSelectedId(id)
  }
  const deleteSlide = (slideId) => {
    if (!confirm('이 슬라이드를 완전히 삭제할까요?')) return
    setData((d) => {
      const slides = { ...d.slides }
      delete slides[slideId]
      return {
        ...d,
        slides,
        nav: d.nav.map((s) => ({ ...s, children: s.children.filter((c) => c.id !== slideId) })),
      }
    })
    if (selectedId === slideId) setSelectedId(null)
  }

  // ---------- selected-slide mutations ----------
  const updateSlide = (patch) => {
    setData((d) => ({ ...d, slides: { ...d.slides, [selectedId]: { ...d.slides[selectedId], ...patch } } }))
  }
  const updateHotspots = (hotspots) => updateSlide({ hotspots })

  // ---------- demos ----------
  const addDemo = () => {
    const id = uid('demo')
    setData((d) => ({ ...d, demos: [...(d.demos || []), { id, title: '새 데모', url: 'https://' }] }))
  }
  const updateDemo = (id, patch) => {
    setData((d) => ({ ...d, demos: d.demos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }
  const deleteDemo = (id) => {
    setData((d) => ({ ...d, demos: d.demos.filter((x) => x.id !== id) }))
  }

  // ---------- import / export ----------
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'slides.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const [saving, setSaving] = useState(false)

  // Save = publish the current data to the server (Netlify Blobs) for all visitors.
  const save = async () => {
    let pw = sessionStorage.getItem('edit-pw')
    if (!pw) {
      pw = prompt('편집 비밀번호를 입력하세요:')
      if (!pw) return
    }
    setSaving(true)
    try {
      await publish(pw)
      sessionStorage.setItem('edit-pw', pw)
    } catch (e) {
      sessionStorage.removeItem('edit-pw')
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const onImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importData(JSON.parse(reader.result))
        alert('불러왔습니다.')
      } catch (err) {
        alert('JSON 파싱 실패: ' + err)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="editor">
      <header className="editor-top">
        <Link to="/" className="back-to-show">← 발표 보기</Link>
        <h1>편집 모드</h1>
        <button className="save-btn" onClick={save} disabled={saving || source !== 'local'}>
          {saving ? '저장 중…' : source === 'local' ? '저장' : '저장됨'}
        </button>
        <span className={`src-badge ${source}`}>
          {source === 'local' ? '● 저장 안 된 변경' : ''}
        </span>
        <div className="editor-top-actions">
          <button onClick={exportJson} title="백업 파일로 내보내기">⬇ 내보내기</button>
          <button onClick={() => fileInputRef.current?.click()} title="백업 파일 불러오기">⬆ 불러오기</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={onImport} />
          <button className="danger" onClick={() => confirm('저장 안 된 변경을 버리고 마지막 저장본을 불러올까요?') && resetToPublished()}>
            ↺ 되돌리기
          </button>
        </div>
      </header>

      <div className="editor-body" ref={bodyRef}>
        {/* ---------- structure panel ---------- */}
        <aside className="editor-structure" style={{ width: structW, flexBasis: structW }}>
          <div className="panel-head">
            <span>구조</span>
            <button onClick={addSection}>+ 섹션</button>
          </div>

          {(data.nav || []).map((section) => (
            <div key={section.id} className="ed-section">
              <div className="ed-section-head">
                <input
                  value={section.title}
                  onChange={(e) => renameSection(section.id, e.target.value)}
                />
                <button title="섹션 삭제" onClick={() => deleteSection(section.id)}>✕</button>
              </div>
              {section.children.map((child, i) => (
                <div
                  key={child.id}
                  className={'ed-slide-row' + (selectedId === child.id ? ' active' : '')}
                  onClick={() => setSelectedId(child.id)}
                >
                  <span className="ed-slide-title">{data.slides[child.id]?.title || child.id}</span>
                  <span className="ed-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button disabled={i === 0} onClick={() => moveSlide(section.id, i, -1)}>↑</button>
                    <button disabled={i === section.children.length - 1} onClick={() => moveSlide(section.id, i, 1)}>↓</button>
                    <select
                      value={section.id}
                      title="다른 섹션으로 이동"
                      onChange={(e) => reassignSlide(child.id, section.id, e.target.value)}
                    >
                      {data.nav.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                    <button onClick={() => deleteSlide(child.id)}>✕</button>
                  </span>
                </div>
              ))}
              <button className="ed-add-slide" onClick={() => addSlide(section.id)}>+ 슬라이드</button>
            </div>
          ))}

          <div className="ed-section">
            <div className="ed-section-head static">
              <span>링크 전용 (네비 미포함)</span>
              <button onClick={addAppendix}>+ 슬라이드</button>
            </div>
            {appendixIds.map((id) => (
              <div
                key={id}
                className={'ed-slide-row' + (selectedId === id ? ' active' : '')}
                onClick={() => setSelectedId(id)}
              >
                <span className="ed-slide-title">{data.slides[id]?.title || id}</span>
                <span className="ed-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => deleteSlide(id)}>✕</button>
                </span>
              </div>
            ))}
          </div>

          {/* demos */}
          <div className="ed-section">
            <div className="ed-section-head static">
              <span>라이브 시연(데모)</span>
              <button onClick={addDemo}>+ 데모</button>
            </div>
            {(data.demos || []).map((demo) => (
              <div key={demo.id} className="ed-demo">
                <input value={demo.title} onChange={(e) => updateDemo(demo.id, { title: e.target.value })} placeholder="이름" />
                <input value={demo.url} onChange={(e) => updateDemo(demo.id, { url: e.target.value })} placeholder="https://..." />
                <button onClick={() => deleteDemo(demo.id)}>✕</button>
              </div>
            ))}
          </div>
        </aside>

        <div className="ed-resizer" onMouseDown={startResize} title="드래그하여 패널 폭 조절" />

        {/* ---------- slide detail / hotspot canvas ---------- */}
        <section className="editor-detail">
          {!selected ? (
            <div className="centered">왼쪽에서 슬라이드를 선택하세요.</div>
          ) : (
            <SlideEditor
              key={selectedId}
              slideId={selectedId}
              slide={selected}
              data={data}
              updateSlide={updateSlide}
              updateHotspots={updateHotspots}
            />
          )}
        </section>
      </div>
    </div>
  )
}

// ===================== Slide detail editor =====================
function SlideEditor({ slideId, slide, data, updateSlide, updateHotspots }) {
  const canvasRef = useRef(null)
  const [draft, setDraft] = useState(null) // rectangle being drawn
  const [selectedHs, setSelectedHs] = useState(null)
  const [previewBust, setPreviewBust] = useState(() => Date.now()) // force-refresh figma preview
  const [linkInput, setLinkInput] = useState(slide.figmaUrl || '')
  const [loading, setLoading] = useState(() => !!slide.figmaUrl)

  // commit the typed Figma link → refresh the preview (with a loading spinner)
  const applyLink = () => {
    const url = linkInput.trim()
    updateSlide({ figmaUrl: url || undefined })
    setPreviewBust(Date.now())
    setLoading(!!url)
  }

  const pctFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    const start = pctFromEvent(e)
    setDraft({ x0: start.x, y0: start.y, x1: start.x, y1: start.y })
  }
  const onMouseMove = (e) => {
    if (!draft) return
    const p = pctFromEvent(e)
    setDraft((d) => ({ ...d, x1: p.x, y1: p.y }))
  }
  const onMouseUp = () => {
    if (!draft) return
    const x = Math.min(draft.x0, draft.x1)
    const y = Math.min(draft.y0, draft.y1)
    const w = Math.abs(draft.x1 - draft.x0)
    const h = Math.abs(draft.y1 - draft.y0)
    setDraft(null)
    if (w < 1.5 || h < 1.5) return // ignore tiny clicks
    const hs = {
      id: uid('hs'),
      x: round(x), y: round(y), w: round(w), h: round(h),
      label: '링크',
      target: { type: 'slide', ref: '' },
    }
    updateHotspots([...(slide.hotspots || []), hs])
    setSelectedHs(hs.id)
  }

  const updateHs = (id, patch) =>
    updateHotspots(slide.hotspots.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  const updateHsTarget = (id, patch) =>
    updateHotspots(slide.hotspots.map((h) => (h.id === id ? { ...h, target: { ...h.target, ...patch } } : h)))
  const deleteHs = (id) => {
    updateHotspots(slide.hotspots.filter((h) => h.id !== id))
    if (selectedHs === id) setSelectedHs(null)
  }

  const slideOptions = Object.keys(data.slides)

  return (
    <div className="slide-editor">
      <div className="se-fields">
        <label>제목 <input value={slide.title} onChange={(e) => updateSlide({ title: e.target.value })} /></label>
        <span className="se-id">id: {slideId}</span>
      </div>
      <div className="se-fields">
        <label className="se-link-field">
          Figma 프레임 링크
          <div className="se-link-row">
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyLink() }}
              placeholder="https://www.figma.com/design/…?node-id=1-23"
            />
            <button type="button" className="se-apply" onClick={applyLink}>적용</button>
          </div>
        </label>
        {!slide.figmaUrl && (
          <label>이미지 경로 <input value={slide.image || ''} onChange={(e) => updateSlide({ image: e.target.value })} placeholder="/slides/…" /></label>
        )}
      </div>

      <p className="se-hint">
        Figma 링크를 넣고 <b>«적용»</b>을 누르면 아래 이미지가 <b>그 프레임의 최신 캡쳐</b>로 바뀝니다(피그마에서 수정하면 자동 반영).
        · 이미지 위에서 <b>드래그</b>하면 클릭영역(링크)이 만들어지고, 만든 영역을 클릭하면 아래에서 링크 대상을 지정할 수 있어요.
        · 변경 후 좌측 상단 <b>저장</b>을 눌러야 모두에게 반영됩니다.
      </p>

      <div className="se-canvas-scroll">
        <div
          ref={canvasRef}
          className="se-canvas"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => draft && setDraft(null)}
        >
          <img
            src={imageSrcFor(slide, { bust: slide.figmaUrl ? previewBust : undefined, refresh: true })}
            alt={slide.title}
            draggable={false}
            onLoad={() => setLoading(false)}
            onError={(e) => { imageFallback(slide)(e); setLoading(false) }}
          />
          {loading && (
            <div className="se-loading">
              <span className="spinner" />
              <span className="se-loading-text">Figma에서 캡쳐 불러오는 중…</span>
            </div>
          )}
          {(slide.hotspots || []).map((hs) => (
            <div
              key={hs.id}
              className={'se-hotspot' + (selectedHs === hs.id ? ' active' : '')}
              style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.w}%`, height: `${hs.h}%` }}
              onMouseDown={(e) => { e.stopPropagation(); setSelectedHs(hs.id) }}
            >
              <span>{hs.label}</span>
            </div>
          ))}
          {draft && (
            <div
              className="se-draft"
              style={{
                left: `${Math.min(draft.x0, draft.x1)}%`,
                top: `${Math.min(draft.y0, draft.y1)}%`,
                width: `${Math.abs(draft.x1 - draft.x0)}%`,
                height: `${Math.abs(draft.y1 - draft.y0)}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="se-hotspot-list">
        <h3>클릭영역 / 링크 ({(slide.hotspots || []).length})</h3>
        {(slide.hotspots || []).length === 0 && <p className="muted">아직 없습니다. 위 이미지에서 드래그해 추가하세요.</p>}
        {(slide.hotspots || []).map((hs) => (
          <div
            key={hs.id}
            className={'hs-edit' + (selectedHs === hs.id ? ' active' : '')}
            onClick={() => setSelectedHs(hs.id)}
          >
            <input className="hs-label" value={hs.label} onChange={(e) => updateHs(hs.id, { label: e.target.value })} placeholder="라벨" />
            <select value={hs.target.type} onChange={(e) => updateHsTarget(hs.id, { type: e.target.value, ref: '' })}>
              <option value="slide">슬라이드/부록</option>
              <option value="demo">데모(iframe)</option>
              <option value="url">외부 URL</option>
            </select>
            {hs.target.type === 'slide' && (
              <select value={hs.target.ref} onChange={(e) => updateHsTarget(hs.id, { ref: e.target.value })}>
                <option value="">— 대상 선택 —</option>
                {slideOptions.map((id) => (
                  <option key={id} value={id}>{data.slides[id]?.title || id}</option>
                ))}
              </select>
            )}
            {hs.target.type === 'demo' && (
              <select value={hs.target.ref} onChange={(e) => updateHsTarget(hs.id, { ref: e.target.value })}>
                <option value="">— 데모 선택 —</option>
                {(data.demos || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            )}
            {hs.target.type === 'url' && (
              <input value={hs.target.ref} onChange={(e) => updateHsTarget(hs.id, { ref: e.target.value })} placeholder="https://..." />
            )}
            <span className="hs-coords">{hs.x},{hs.y} · {hs.w}×{hs.h}</span>
            <button className="danger" onClick={(e) => { e.stopPropagation(); deleteHs(hs.id) }}>삭제</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const round = (n) => Math.round(n * 10) / 10
