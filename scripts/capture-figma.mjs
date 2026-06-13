#!/usr/bin/env node
/**
 * Build-time Figma capture.
 *
 * For every slide in public/slides.json that has a `figmaUrl`, this renders the
 * referenced frame via the Figma Images API and writes it to
 * public/slides/<slideId>.png, then rewrites the slide's `image` path.
 *
 * The render always reflects the *current* state of the Figma file, so a Figma
 * edit shows up the next time this runs (i.e. the next build / redeploy).
 *
 * Requires the env var FIGMA_TOKEN (a Figma personal access token with file read
 * scope). If it is missing, the script is a graceful no-op so local/preview
 * builds without a token still succeed.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SLIDES_JSON = join(ROOT, 'public', 'slides.json')
const SLIDES_DIR = join(ROOT, 'public', 'slides')

const SCALE = process.env.FIGMA_SCALE || '2'
const FORMAT = process.env.FIGMA_FORMAT || 'png'
const TOKEN = process.env.FIGMA_TOKEN

// figma.com/(design|file)/:fileKey/...?node-id=1-23  ->  { fileKey, nodeId: "1:23" }
function parseFigmaUrl(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/(?:file|design|proto)\/([A-Za-z0-9]+)/)
    const fileKey = m && m[1]
    let nodeId = u.searchParams.get('node-id')
    if (nodeId) nodeId = decodeURIComponent(nodeId).replace(/-/g, ':')
    if (!fileKey || !nodeId) return null
    return { fileKey, nodeId }
  } catch {
    return null
  }
}

async function main() {
  const raw = await readFile(SLIDES_JSON, 'utf8')
  const data = JSON.parse(raw)
  const slides = data.slides || {}

  // collect slides that ask to be captured from Figma
  const jobs = []
  for (const [id, slide] of Object.entries(slides)) {
    if (!slide.figmaUrl) continue
    const parsed = parseFigmaUrl(slide.figmaUrl)
    if (!parsed) {
      console.warn(`⚠︎  ${id}: figmaUrl을 해석할 수 없어 건너뜁니다 → ${slide.figmaUrl}`)
      continue
    }
    jobs.push({ id, ...parsed })
  }

  if (jobs.length === 0) {
    console.log('ℹ︎  캡쳐할 Figma 프레임(figmaUrl)이 없습니다. 건너뜁니다.')
    return
  }
  if (!TOKEN) {
    console.warn(
      `⚠︎  FIGMA_TOKEN 환경변수가 없어 Figma 캡쳐를 건너뜁니다 (${jobs.length}개). ` +
      `기존 이미지를 그대로 사용합니다.`
    )
    return
  }

  await mkdir(SLIDES_DIR, { recursive: true })

  // group node ids per file so we can ask the Images API in batches
  const byFile = new Map()
  for (const job of jobs) {
    if (!byFile.has(job.fileKey)) byFile.set(job.fileKey, [])
    byFile.get(job.fileKey).push(job)
  }

  let ok = 0
  for (const [fileKey, fileJobs] of byFile) {
    const ids = [...new Set(fileJobs.map((j) => j.nodeId))]
    const api =
      `https://api.figma.com/v1/images/${fileKey}` +
      `?ids=${encodeURIComponent(ids.join(','))}&format=${FORMAT}&scale=${SCALE}`

    const res = await fetch(api, { headers: { 'X-Figma-Token': TOKEN } })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Figma API ${res.status} (file ${fileKey}): ${body}`)
    }
    const json = await res.json()
    if (json.err) throw new Error(`Figma API error (file ${fileKey}): ${json.err}`)

    for (const job of fileJobs) {
      const imageUrl = json.images?.[job.nodeId]
      if (!imageUrl) {
        console.warn(`⚠︎  ${job.id}: Figma가 이 프레임(${job.nodeId})을 렌더하지 못했습니다.`)
        continue
      }
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) {
        console.warn(`⚠︎  ${job.id}: 이미지 다운로드 실패 (${imgRes.status})`)
        continue
      }
      const buf = Buffer.from(await imgRes.arrayBuffer())
      const fileName = `${job.id}.${FORMAT}`
      await writeFile(join(SLIDES_DIR, fileName), buf)
      slides[job.id].image = `/slides/${fileName}`
      ok++
      console.log(`✓  ${job.id}  ←  ${job.fileKey}:${job.nodeId}  (${(buf.length / 1024).toFixed(0)} KB)`)
    }
  }

  // persist updated image paths
  await writeFile(SLIDES_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`\n완료: ${ok}/${jobs.length}개 프레임을 캡쳐했습니다.`)
}

main().catch((err) => {
  console.error('✗  Figma 캡쳐 실패:', err.message)
  process.exit(1)
})
