// Recursive nav-tree helpers.
//
// A nav node is either:
//   - a GROUP:  { id, title, children:[...], kind? }   (kind:'appendix' is special)
//   - a SLIDE:  { id, ref }                              (ref → slides[ref]; legacy: ref omitted, id IS the slide id)
//
// Back-compat: any node with a `children` array is a group; otherwise it's a
// slide whose ref is `ref ?? id`.

export const isGroup = (node) => Array.isArray(node?.children)
export const slideRef = (node) => node?.ref ?? node?.id

// Ordered slide refs for the main deck (skips appendix groups) — for prev/next.
export function deckSlideRefs(nav) {
  const out = []
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (isGroup(n)) {
        if (n.kind === 'appendix') continue
        walk(n.children)
      } else {
        out.push(slideRef(n))
      }
    }
  }
  walk(nav)
  return out
}

// Hierarchical numbers for GROUPS only (appendix excluded). { nodeId: "2.1" }
export function groupNumbers(nav) {
  const map = {}
  const walk = (nodes, prefix) => {
    let i = 0
    for (const n of nodes || []) {
      if (!isGroup(n) || n.kind === 'appendix') continue
      i += 1
      const num = prefix ? `${prefix}.${i}` : `${i}`
      map[n.id] = num
      walk(n.children, num)
    }
  }
  walk(nav, '')
  return map
}

// Chain of ancestor GROUP nodes for a slide ref (root → immediate parent).
export function ancestorGroups(nav, ref) {
  let result = []
  const walk = (nodes, chain) => {
    for (const n of nodes || []) {
      if (isGroup(n)) {
        if (walk(n.children, [...chain, n])) return true
      } else if (slideRef(n) === ref) {
        result = chain
        return true
      }
    }
    return false
  }
  walk(nav, [])
  return result
}

export function findNode(nav, id) {
  for (const n of nav || []) {
    if (n.id === id) return n
    if (isGroup(n)) {
      const found = findNode(n.children, id)
      if (found) return found
    }
  }
  return null
}

export function containsId(node, id) {
  if (!node) return false
  if (node.id === id) return true
  if (isGroup(node)) return node.children.some((c) => containsId(c, id))
  return false
}

// Remove a node by id. Returns { nav, removed }.
export function removeNode(nav, nodeId) {
  let removed = null
  const walk = (nodes) => {
    const res = []
    for (const n of nodes) {
      if (n.id === nodeId) { removed = n; continue }
      res.push(isGroup(n) ? { ...n, children: walk(n.children) } : n)
    }
    return res
  }
  return { nav: walk(nav), removed }
}

// Insert `node` relative to `targetId`. position: 'before' | 'after' | 'inside'.
export function insertNode(nav, targetId, position, node) {
  const walk = (nodes) => {
    const res = []
    for (const n of nodes) {
      const recursed = isGroup(n) ? { ...n, children: walk(n.children) } : n
      if (n.id === targetId) {
        if (position === 'before') { res.push(node); res.push(recursed) }
        else if (position === 'after') { res.push(recursed); res.push(node) }
        else if (position === 'inside' && isGroup(n)) {
          res.push({ ...recursed, children: [...recursed.children, node] })
        } else { res.push(recursed) }
      } else {
        res.push(recursed)
      }
    }
    return res
  }
  return walk(nav)
}

// Shallow-patch a node (by id) anywhere in the tree.
export function updateNode(nav, id, patch) {
  return (nav || []).map((n) => {
    if (n.id === id) return { ...n, ...patch }
    if (isGroup(n)) return { ...n, children: updateNode(n.children, id, patch) }
    return n
  })
}

// All slide refs referenced anywhere in the nav (to compute orphan slides).
export function allNavSlideRefs(nav) {
  const set = new Set()
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (isGroup(n)) walk(n.children)
      else set.add(slideRef(n))
    }
  }
  walk(nav)
  return set
}
