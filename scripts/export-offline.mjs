#!/usr/bin/env node
/**
 * Export a self-contained offline HTML viewer.
 * Usage: node scripts/export-offline.mjs [site-url]
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SITE = process.argv[2] || 'https://lgu-ux-slides.netlify.app'
const OUT = path.join(ROOT, 'offline.html')
const CONCURRENCY = 6

async function main() {
  console.log('Fetching slide data...')
  const res = await fetch(`${SITE}/.netlify/functions/slides`)
  if (!res.ok) throw new Error(`Failed to fetch slides: ${res.status}`)
  const data = await res.json()
  console.log(`  ${Object.keys(data.slides || {}).length} slides`)

  const figmaSlides = Object.entries(data.slides || {}).filter(([, s]) => s.figmaUrl)
  console.log(`Downloading ${figmaSlides.length} Figma images...`)

  const ver = `${data._rev || 0}-${data.figmaRev || 0}`
  let done = 0

  async function downloadImage(slideId, slide) {
    const url = `${SITE}/.netlify/functions/figma-image?url=${encodeURIComponent(slide.figmaUrl)}&v=${ver}`
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      done++
      if (done % 10 === 0 || done === figmaSlides.length) console.log(`  ${done}/${figmaSlides.length}`)
      return [slideId, `data:image/png;base64,${buf.toString('base64')}`]
    } catch (e) {
      console.warn(`  ⚠ ${slideId}: ${e.message}`)
      done++
      return [slideId, null]
    }
  }

  for (let i = 0; i < figmaSlides.length; i += CONCURRENCY) {
    const batch = figmaSlides.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(([id, s]) => downloadImage(id, s)))
    for (const [id, b64] of results) {
      if (b64) {
        data.slides[id].image = b64
        delete data.slides[id].figmaUrl
      }
    }
  }

  // Build
  console.log('Building...')
  execSync('npx vite build', { cwd: ROOT, stdio: 'pipe' })

  // Inline everything into one HTML
  console.log('Inlining assets...')
  const distDir = path.join(ROOT, 'dist')
  let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

  // Inline CSS
  html = html.replace(
    /<link rel="stylesheet"[^>]*href="([^"]*\.css)"[^>]*>/g,
    (_, href) => {
      const css = fs.readFileSync(path.join(distDir, href), 'utf8')
      return `<style>${css}</style>`
    }
  )

  // Inline JS
  html = html.replace(
    /<script[^>]*src="([^"]*\.js)"[^>]*><\/script>/g,
    (_, src) => {
      const js = fs.readFileSync(path.join(distDir, src), 'utf8')
      return `<script type="module">${js}</script>`
    }
  )

  // Embed data as global variable (before the app script)
  const dataJson = JSON.stringify(data)
  html = html.replace(
    '<head>',
    `<head><script>window.__EMBEDDED_DATA__=${dataJson}</script>`
  )

  fs.writeFileSync(OUT, html)
  const sizeMB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1)
  console.log(`\n✓ ${OUT} (${sizeMB} MB)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
