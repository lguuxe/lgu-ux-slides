// Resolve the <img> src for a slide.
// If the slide has a Figma frame link, render it live via the serverless function;
// otherwise use the slide's static image path.
export function imageSrcFor(slide, opts = {}) {
  if (slide?.figmaUrl) {
    let url = `/.netlify/functions/figma-image?url=${encodeURIComponent(slide.figmaUrl)}`
    if (opts.refresh) url += '&refresh=1' // editor: re-capture from Figma + store in Blobs
    if (opts.bust) url += `&t=${opts.bust}`
    return url
  }
  return slide?.image || ''
}

// onError handler: if the live/figma image fails, fall back to the static image once.
export function imageFallback(slide) {
  return (e) => {
    const img = e.currentTarget
    if (slide?.image && !img.dataset.fellback) {
      img.dataset.fellback = '1'
      img.src = slide.image
    }
  }
}
