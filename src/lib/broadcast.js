const CHANNEL = 'lgu-ux-presenter'
let bc = null

function get() {
  if (!bc) bc = new BroadcastChannel(CHANNEL)
  return bc
}

export function sendNav(path) {
  get().postMessage({ type: 'nav', path })
}

export function sendCursor(x, y) {
  get().postMessage({ type: 'cursor', x, y })
}

export function hideCursor() {
  get().postMessage({ type: 'cursor', x: null, y: null })
}

export function onMessage(callback) {
  const ch = get()
  const handler = (e) => callback(e.data)
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}

export function onNav(callback) {
  return onMessage((d) => { if (d?.type === 'nav') callback(d.path) })
}
