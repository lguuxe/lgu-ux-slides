import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataContext.jsx'
import { imageSrcFor, imageFallback, setImageVersion } from '../lib/images.js'
import {
  isGroup, slideRef, groupNumbers, deckSlideRefs, allNavSlideRefs,
  findNode, containsId, removeNode, insertNode, updateNode,
} from '../lib/nav.js'

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`

// parse a Figma frame URL → { fileKey, nodeId } (node-id "1-23" → "1:23")
function parseFigmaLink(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/(?:file|design|proto)\/([A-Za-z0-9]+)/)
    let nodeId = u.searchParams.get('node-id')
    if (nodeId) nodeId = decodeURIComponent(nodeId).replace(/-/g, ':')
    return m && nodeId ? { fileKey: m[1], nodeId } : null
  } catch {
    return null
  }
}

const LOCK_FN = '/.netlify/functions/edit-lock'

// ===================== Auth gate + single-editor lock =====================
export default function Editor() {
  const [token, setToken] = useState(null)

  // keep the lock alive while editing; release it on leave
  useEffect(() => {
    if (!token) return
    const beat = () => {
      fetch(LOCK_FN, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat', token }),
      }).then((r) => r.json()).then((j) => {
        if (j && j.ok === false && j.reason === 'lost') {
          alert('편집 세션이 만료되어 잠금이 해제됐습니다. 다시 진입해 주세요.')
          sessionStorage.removeItem('edit-token')
          setToken(null)
        }
      }).catch(() => {})
    }
    const hb = setInterval(beat, 45000)
    const release = () => {
      try {
        const blob = new Blob([JSON.stringify({ action: 'release', token })], { type: 'application/json' })
        navigator.sendBeacon?.(LOCK_FN, blob)
      } catch { /* ignore */ }
    }
    window.addEventListener('pagehide', release)
    return () => { clearInterval(hb); window.removeEventListener('pagehide', release); release() }
  }, [token])

  if (!token) return <EditGate onAuthed={setToken} />
  return <EditorInner />
}

function EditGate({ onAuthed }) {
  const [pw, setPw] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | bad | locked | error
  const [lockedSince, setLockedSince] = useState(null)

  const tryAcquire = async (password) => {
    setStatus('checking')
    let token = sessionStorage.getItem('edit-token')
    if (!token) token = (window.crypto?.randomUUID?.() || ('t' + Date.now() + Math.random())).toString()
    try {
      const res = await fetch(LOCK_FN, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'acquire', password, token }),
      })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        // function unavailable (e.g. local `vite dev`) → allow in for local editing
        sessionStorage.setItem('edit-token', token)
        sessionStorage.setItem('edit-pw', password)
        onAuthed(token)
        return
      }
      const j = await res.json()
      if (j.ok) {
        sessionStorage.setItem('edit-token', token)
        sessionStorage.setItem('edit-pw', password)
        onAuthed(token)
      } else if (j.reason === 'bad-password') setStatus('bad')
      else if (j.reason === 'locked') { setStatus('locked'); setLockedSince(j.since) }
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  // auto-resume if this browser session already authenticated
  useEffect(() => {
    const savedPw = sessionStorage.getItem('edit-pw')
    if (savedPw) { setPw(savedPw); tryAcquire(savedPw) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const minsAgo = lockedSince ? Math.max(1, Math.round((Date.now() - lockedSince) / 60000)) : null

  return (
    <div className="edit-gate">
      <form className="edit-gate-card" onSubmit={(e) => { e.preventDefault(); tryAcquire(pw) }}>
        <Link to="/" className="back-to-show">← 발표 보기</Link>
        <h1>편집 모드</h1>
        {status === 'locked' ? (
          <>
            <p className="gate-msg warn">다른 사람이 편집 중입니다{minsAgo ? ` (약 ${minsAgo}분 전 시작)` : ''}.<br />잠시 후 다시 시도해 주세요.</p>
            <button type="button" className="gate-btn" onClick={() => tryAcquire(pw)}>다시 시도</button>
          </>
        ) : (
          <>
            <p className="gate-msg">편집하려면 비밀번호를 입력하세요.</p>
            <input
              type="password" value={pw} autoFocus
              onChange={(e) => { setPw(e.target.value); if (status !== 'idle') setStatus('idle') }}
              placeholder="편집 비밀번호"
            />
            {status === 'bad' && <p className="gate-msg err">비밀번호가 올바르지 않습니다.</p>}
            {status === 'error' && <p className="gate-msg err">확인 중 오류가 발생했습니다.</p>}
            <button type="submit" className="gate-btn" disabled={status === 'checking' || !pw}>
              {status === 'checking' ? '확인 중…' : '입장'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

function EditorInner() {
  const { data, setData, source, resetToPublished, importData, publish, hasDraft, loadDraft, discardDraft } = useData()

  // resume an unsaved local draft only inside the editor (never on viewer pages)
  useEffect(() => {
    if (hasDraft()) {
      if (confirm('이 브라우저에 저장하지 않은 이전 편집 내용이 있습니다. 불러올까요?\n(취소하면 최신 게시본으로 시작하며 그 초안은 삭제됩니다.)')) loadDraft()
      else discardDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selectedId, setSelectedId] = useState(() => {
    const first = deckSlideRefs(data.nav)[0]
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

  // ---- orphan slides (in data.slides but not anywhere in the nav tree) ----
  const orphanIds = useMemo(() => {
    const refs = allNavSlideRefs(data.nav)
    return Object.keys(data.slides || {}).filter((id) => !refs.has(id))
  }, [data])
  const numbers = useMemo(() => groupNumbers(data.nav), [data])

  const selected = selectedId ? data.slides?.[selectedId] : null

  // ---------- tree structure mutations ----------
  const addGroup = (parentId) => {
    const node = { id: uid('g'), title: '새 그룹', children: [] }
    setData((d) => ({ ...d, nav: parentId ? insertNode(d.nav, parentId, 'inside', node) : [...(d.nav || []), node] }))
  }
  const addSlideNode = (parentId) => {
    const ref = uid('slide')
    const node = { id: uid('n'), ref }
    setData((d) => ({
      ...d,
      slides: { ...d.slides, [ref]: { title: '새 슬라이드', image: '/slides/default.png', hotspots: [] } },
      nav: parentId ? insertNode(d.nav, parentId, 'inside', node) : [...(d.nav || []), node],
    }))
    setSelectedId(ref)
  }
  const addOrphan = () => {
    const ref = uid('slide')
    setData((d) => ({ ...d, slides: { ...d.slides, [ref]: { title: '새 슬라이드(링크 전용)', image: '/slides/default.png', hotspots: [] } } }))
    setSelectedId(ref)
  }
  const renameNode = (nodeId, title) => setData((d) => ({ ...d, nav: updateNode(d.nav, nodeId, { title }) }))
  const renameSlide = (ref, title) => setData((d) => ({ ...d, slides: { ...d.slides, [ref]: { ...d.slides[ref], title } } }))
  const updateMeta = (patch) => setData((d) => ({ ...d, meta: { ...(d.meta || {}), ...patch } }))

  const deleteNode = (node) => {
    if (isGroup(node)) {
      if (!confirm('이 그룹과 하위 항목을 네비에서 제거할까요?\n(슬라이드 내용은 남아 "링크 전용"으로 이동합니다)')) return
      setData((d) => ({ ...d, nav: removeNode(d.nav, node.id).nav }))
    } else {
      if (!confirm('이 슬라이드를 완전히 삭제할까요?')) return
      const ref = slideRef(node)
      setData((d) => {
        const slides = { ...d.slides }
        delete slides[ref]
        return { ...d, slides, nav: removeNode(d.nav, node.id).nav }
      })
      if (selectedId === ref) setSelectedId(null)
    }
  }
  const deleteOrphan = (ref) => {
    if (!confirm('이 슬라이드를 완전히 삭제할까요?')) return
    setData((d) => { const slides = { ...d.slides }; delete slides[ref]; return { ...d, slides } })
    if (selectedId === ref) setSelectedId(null)
  }

  // ---------- drag & drop ----------
  const [dragId, setDragId] = useState(null)
  const [dropInfo, setDropInfo] = useState(null)
  const onDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', id) } catch { /* ignore */ }
  }
  const onDragOver = (e, node, group) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height || 1
    const pos = group
      ? (y < h * 0.3 ? 'before' : y > h * 0.7 ? 'after' : 'inside')
      : (y < h * 0.5 ? 'before' : 'after')
    setDropInfo((prev) => (prev && prev.id === node.id && prev.pos === pos ? prev : { id: node.id, pos }))
  }
  const onDrop = (e, targetId) => {
    e.preventDefault(); e.stopPropagation()
    const pos = dropInfo?.pos || 'after'
    const dId = dragId
    if (dId && dId !== targetId) {
      setData((d) => {
        const dragged = findNode(d.nav, dId)
        if (!dragged) return d
        if (isGroup(dragged) && containsId(dragged, targetId)) return d // no dropping into own subtree
        const without = removeNode(d.nav, dId).nav
        return { ...d, nav: insertNode(without, targetId, pos, dragged) }
      })
    }
    setDragId(null); setDropInfo(null)
  }
  const onDragEnd = () => { setDragId(null); setDropInfo(null) }

  const tree = {
    numbers, slides: data.slides, selectedId, onSelect: setSelectedId,
    addGroup, addSlide: addSlideNode, rename: renameNode, renameSlide, del: deleteNode,
    dragId, dropInfo, onDragStart, onDragOver, onDrop, onDragEnd,
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

  // ---------- global shortcuts (right rail) ----------
  const addShortcut = () => {
    setData((d) => ({ ...d, shortcuts: [...(d.shortcuts || []), { id: uid('sc'), label: '바로가기', target: { type: 'slide', ref: '' } }] }))
  }
  const updateShortcut = (id, patch) => {
    setData((d) => ({ ...d, shortcuts: d.shortcuts.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  }
  const updateShortcutTarget = (id, patch) => {
    setData((d) => ({ ...d, shortcuts: d.shortcuts.map((s) => (s.id === id ? { ...s, target: { ...s.target, ...patch } } : s)) }))
  }
  const deleteShortcut = (id) => {
    setData((d) => ({ ...d, shortcuts: d.shortcuts.filter((s) => s.id !== id) }))
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
  // Password was provided at edit-mode entry (stored for the session).
  const save = async () => {
    const pw = sessionStorage.getItem('edit-pw')
    if (!pw) { alert('편집 세션이 없습니다. 편집 모드로 다시 진입해 주세요.'); return }
    setSaving(true)
    try {
      await publish(pw)
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const [refreshing, setRefreshing] = useState(false)
  const [refreshProg, setRefreshProg] = useState(null) // { done, total }

  // Pull the latest Figma state for ALL Figma-linked slides — batched in small
  // chunks (Figma's multi-id render) so we don't hit rate limits, then commit.
  const refreshFigma = async () => {
    const pw = sessionStorage.getItem('edit-pw')
    if (!pw) { alert('편집 세션이 없습니다. 다시 진입해 주세요.'); return }
    const entries = []
    for (const s of Object.values(data.slides || {})) {
      const p = parseFigmaLink(s.figmaUrl)
      if (p) entries.push(p)
    }
    if (!entries.length) return alert('Figma 링크가 있는 슬라이드가 없습니다.')
    if (!confirm(`Figma ${entries.length}개 슬라이드를 최신 상태로 다시 캡쳐할까요?\n(1~2분 정도 걸릴 수 있어요.)`)) return

    setRefreshing(true)
    setRefreshProg({ done: 0, total: entries.length })
    const startFr = data.figmaRev || 0
    try {
      // kick off the background build (returns 202 immediately)
      await fetch('/.netlify/functions/figma-refresh-background', { method: 'POST', headers: { 'x-edit-password': pw } })
      // poll status until done (up to ~12 min)
      for (let i = 0; i < 240; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await fetch('/.netlify/functions/figma-refresh').then((r) => r.json()).catch(() => null)
        if (st && st.total) setRefreshProg({ done: st.done || 0, total: st.total })
        if (st && st.state === 'done' && st.fr > startFr) {
          setImageVersion(`${data._rev || 0}-${st.fr}`)
          alert('최신화 완료! 발표 화면을 새로고침하면 반영됩니다.')
          return
        }
      }
      alert('최신화가 백그라운드에서 계속 진행 중입니다. 잠시 후 다시 시도하면 이어서 진행됩니다.')
    } catch (e) {
      alert('최신화 실패: ' + e.message)
    } finally {
      setRefreshing(false)
      setRefreshProg(null)
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
        <button className="save-btn" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
        <span className={`src-badge ${source}`}>
          {source === 'local' ? '● 저장 안 된 변경' : ''}
        </span>
        <div className="editor-top-actions">
          <button onClick={refreshFigma} disabled={refreshing} title="모든 Figma 링크를 최신 상태로 다시 캡쳐">
            {refreshing ? `최신화 중… ${refreshProg ? `${refreshProg.done}/${refreshProg.total}` : ''}` : '⟳ Figma 최신화'}
          </button>
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
          <div className="ed-meta">
            <label>사이트 제목
              <input value={data.meta?.title || ''} onChange={(e) => updateMeta({ title: e.target.value })} placeholder="제목" />
            </label>
            <label>부제
              <input value={data.meta?.subtitle || ''} onChange={(e) => updateMeta({ subtitle: e.target.value })} placeholder="부제(선택)" />
            </label>
          </div>

          <div className="panel-head">
            <span>구조</span>
            <span className="panel-head-actions">
              <button onClick={() => addGroup(null)}>+ 그룹</button>
              <button onClick={() => addSlideNode(null)}>+ 슬라이드</button>
            </span>
          </div>
          <p className="ed-tree-hint">드래그해서 순서·그룹을 바꿀 수 있어요. 그룹 위에 떨어뜨리면 안으로 들어갑니다.</p>

          <div className="ed-tree" onDragOver={(e) => e.preventDefault()}>
            {(data.nav || []).map((node) => (
              <EdNode key={node.id} node={node} depth={0} t={tree} />
            ))}
          </div>

          {/* link-only slides (not in the nav tree) */}
          <div className="ed-section">
            <div className="ed-section-head static">
              <span>링크 전용 (네비 미포함)</span>
              <button onClick={addOrphan}>+ 슬라이드</button>
            </div>
            {orphanIds.map((id) => (
              <div
                key={id}
                className={'ed-slide-row' + (selectedId === id ? ' active' : '')}
                onClick={() => setSelectedId(id)}
              >
                <span className="ed-thumb-sm">{data.slides[id] && <img src={imageSrcFor(data.slides[id], { thumb: true })} alt="" loading="lazy" onError={imageFallback(data.slides[id])} />}</span>
                <span className="ed-slide-title">{data.slides[id]?.title || id}</span>
                <span className="ed-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => deleteOrphan(id)}>✕</button>
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

          {/* global shortcuts (right rail) */}
          <div className="ed-section">
            <div className="ed-section-head static">
              <span>바로가기 (전역 · 우측)</span>
              <button onClick={addShortcut}>+ 추가</button>
            </div>
            {(data.shortcuts || []).map((s) => (
              <div key={s.id} className="ed-shortcut">
                <input className="ed-sc-label" value={s.label} onChange={(e) => updateShortcut(s.id, { label: e.target.value })} placeholder="버튼 이름" />
                <div className="ed-sc-row">
                  <select value={s.target.type} onChange={(e) => updateShortcutTarget(s.id, { type: e.target.value, ref: '' })}>
                    <option value="slide">슬라이드</option>
                    <option value="demo">데모</option>
                    <option value="url">URL</option>
                  </select>
                  {s.target.type === 'slide' && (
                    <select value={s.target.ref} onChange={(e) => updateShortcutTarget(s.id, { ref: e.target.value })}>
                      <option value="">— 선택 —</option>
                      {Object.keys(data.slides).map((id) => (
                        <option key={id} value={id}>{data.slides[id]?.title || id}</option>
                      ))}
                    </select>
                  )}
                  {s.target.type === 'demo' && (
                    <select value={s.target.ref} onChange={(e) => updateShortcutTarget(s.id, { ref: e.target.value })}>
                      <option value="">— 선택 —</option>
                      {(data.demos || []).map((d) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                  )}
                  {s.target.type === 'url' && (
                    <input value={s.target.ref} onChange={(e) => updateShortcutTarget(s.id, { ref: e.target.value })} placeholder="https://..." />
                  )}
                  <button onClick={() => deleteShortcut(s.id)}>✕</button>
                </div>
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
  const [linkInput, setLinkInput] = useState(slide.figmaUrl || '')
  const [loading, setLoading] = useState(() => !!slide.figmaUrl)
  const [imgSrc, setImgSrc] = useState(() => imageSrcFor(slide, { draft: true }))
  const [uploadProg, setUploadProg] = useState(null) // { done, total } for video upload

  // upload a local video file in chunks → Blobs, set slide.video to the serve URL
  const onVideoFile = async (file) => {
    const pw = sessionStorage.getItem('edit-pw')
    if (!pw) { alert('편집 세션이 없습니다.'); return }
    const id = uid('vid')
    const CHUNK = 4 * 1024 * 1024
    const parts = Math.max(1, Math.ceil(file.size / CHUNK))
    setUploadProg({ done: 0, total: parts })
    try {
      for (let i = 0; i < parts; i++) {
        const res = await fetch(`/.netlify/functions/video-upload?id=${id}&part=${i}`, {
          method: 'POST', headers: { 'x-edit-password': pw }, body: file.slice(i * CHUNK, (i + 1) * CHUNK),
        })
        if (!res.ok) throw new Error('파트 업로드 실패 (' + (i + 1) + ')')
        setUploadProg({ done: i + 1, total: parts })
      }
      const fin = await fetch(
        `/.netlify/functions/video-upload?id=${id}&action=finalize&parts=${parts}&type=${encodeURIComponent(file.type || 'video/mp4')}`,
        { method: 'POST', headers: { 'x-edit-password': pw } }
      )
      if (!fin.ok) throw new Error('마무리 실패')
      updateSlide({ video: `/.netlify/functions/video?id=${id}` })
      alert('동영상 업로드 완료! 좌측 상단 「저장」을 눌러야 발표에 반영됩니다.')
    } catch (e) {
      alert('동영상 업로드 실패: ' + e.message)
    } finally {
      setUploadProg(null)
    }
  }

  // 「적용」: capture the typed link from Figma into the draft (preview only, not yet saved)
  const applyLink = () => {
    const url = linkInput.trim()
    updateSlide({ figmaUrl: url || undefined })
    if (url) {
      setLoading(true)
      setImgSrc(imageSrcFor({ figmaUrl: url }, { refresh: true, bust: Date.now() }))
    } else {
      setLoading(false)
      setImgSrc(slide.image || '')
    }
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
      <div className="se-fields">
        <label style={{ flex: 1 }}>
          동영상 (업로드 또는 URL · 있으면 이미지 대신 재생)
          <div className="se-link-row">
            <input
              value={slide.video || ''}
              onChange={(e) => updateSlide({ video: e.target.value || undefined })}
              placeholder="로컬 업로드 또는 https://…/video.mp4"
            />
            <label className={'se-apply' + (uploadProg ? ' busy' : '')} style={{ cursor: 'pointer' }}>
              {uploadProg ? `${uploadProg.done}/${uploadProg.total}` : '업로드'}
              <input type="file" accept="video/*" hidden disabled={!!uploadProg}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideoFile(f); e.target.value = '' }} />
            </label>
            {slide.video && (
              <button type="button" className="se-apply" title="동영상 제거" onClick={() => updateSlide({ video: undefined })}>✕</button>
            )}
          </div>
        </label>
        <label>
          이미지 맞춤
          <select value={slide.fit || 'contain'} onChange={(e) => updateSlide({ fit: e.target.value })}>
            <option value="contain">전체 보기 (기본)</option>
            <option value="width">폭 채우기 · 세로 스크롤</option>
            <option value="height">높이 채우기 · 가로 스크롤</option>
          </select>
        </label>
      </div>

      <p className="se-hint">
        Figma 링크를 넣고 <b>«적용»</b>을 누르면 아래 미리보기가 그 프레임 캡쳐로 바뀝니다(아직 미게시).
        <b>저장</b>을 눌러야 발표 화면에 반영됩니다. · 피그마 디자인 자체를 수정했다면 우상단 <b>«⟳ Figma 최신화»</b> 를 누르면 전체가 다시 캡쳐돼 바로 반영됩니다(저장 불필요, 보는 쪽은 새로고침).
        · 이미지 위에서 <b>드래그</b>하면 클릭영역(링크)이 만들어지고, 만든 영역을 클릭하면 아래에서 링크 대상을 지정할 수 있어요.
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
            src={imgSrc}
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

// ===================== Editor structure tree =====================
function EdNode({ node, depth, t }) {
  return isGroup(node) ? <EdGroup node={node} depth={depth} t={t} /> : <EdSlide node={node} depth={depth} t={t} />
}

function EdGroup({ node, depth, t }) {
  const [open, setOpen] = useState(node.kind !== 'appendix') // appendix collapsed by default
  const dropCls = t.dropInfo?.id === node.id ? ' drop-' + t.dropInfo.pos : ''
  return (
    <div className="ed-node">
      <div
        className={'ed-row ed-grouprow' + dropCls + (t.dragId === node.id ? ' dragging' : '')}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable
        onDragStart={(e) => t.onDragStart(e, node.id)}
        onDragOver={(e) => t.onDragOver(e, node, true)}
        onDrop={(e) => t.onDrop(e, node.id)}
        onDragEnd={t.onDragEnd}
      >
        <button className="ed-twist" onClick={() => setOpen((o) => !o)} title={open ? '접기' : '펼치기'}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(-90deg)' }}>
            <path d="M4 6.5l4 4 4-4" />
          </svg>
        </button>
        {t.numbers[node.id] && <span className="ed-num">{t.numbers[node.id]}</span>}
        <input
          className="ed-group-input"
          value={node.title}
          onChange={(e) => t.rename(node.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <span className="ed-row-actions">
          <button title="하위 그룹 추가" onClick={() => t.addGroup(node.id)}>▢﹢</button>
          <button title="슬라이드 추가" onClick={() => t.addSlide(node.id)}>﹢</button>
          <button title="삭제" onClick={() => t.del(node)}>✕</button>
        </span>
      </div>
      <div className={'ed-children' + (open ? ' open' : '')}>
        <div className="ed-children-inner">
          {(node.children || []).map((c) => <EdNode key={c.id} node={c} depth={depth + 1} t={t} />)}
        </div>
      </div>
    </div>
  )
}

function EdSlide({ node, depth, t }) {
  const ref = slideRef(node)
  const slide = t.slides?.[ref]
  const dropCls = t.dropInfo?.id === node.id ? ' drop-' + t.dropInfo.pos : ''
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const startEdit = () => { setVal(slide?.title || ''); setEditing(true) }
  const commit = () => { t.renameSlide(ref, val.trim() || (slide?.title || ref)); setEditing(false) }

  return (
    <div className="ed-node">
      <div
        className={'ed-row ed-sliderow' + dropCls + (t.selectedId === ref ? ' active' : '') + (t.dragId === node.id ? ' dragging' : '')}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable={!editing}
        onDragStart={(e) => t.onDragStart(e, node.id)}
        onDragOver={(e) => t.onDragOver(e, node, false)}
        onDrop={(e) => t.onDrop(e, node.id)}
        onDragEnd={t.onDragEnd}
        onClick={() => { if (!editing) t.onSelect(ref) }}
      >
        <span className="ed-thumb-sm">{slide && <img src={imageSrcFor(slide, { thumb: true })} alt="" loading="lazy" onError={imageFallback(slide)} />}</span>
        {editing ? (
          <input
            className="ed-slide-input"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              else if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <span
            className="ed-slide-title"
            onDoubleClick={(e) => { e.stopPropagation(); startEdit() }}
            title="더블클릭하여 이름 변경"
          >
            {slide?.title || ref}
          </span>
        )}
        <span className="ed-row-actions" onClick={(e) => e.stopPropagation()}>
          <button title="삭제" onClick={() => t.del(node)}>✕</button>
        </span>
      </div>
    </div>
  )
}
