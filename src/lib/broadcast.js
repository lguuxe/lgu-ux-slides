const CHANNEL = 'lgu-ux-presenter'
let bc = null

function get() {
  if (!bc) bc = new BroadcastChannel(CHANNEL)
  return bc
}

export function sendNav(path) {
  get().postMessage({ type: 'nav', path })
}

export function onNav(callback) {
  const ch = get()
  const handler = (e) => {
    if (e.data?.type === 'nav') callback(e.data.path)
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}
