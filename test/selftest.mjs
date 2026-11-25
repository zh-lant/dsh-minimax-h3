/**
 * Host self-test. Runs without DSH and without network access:
 * - pure helpers (pixel math, raster sniffing, error mapping)
 * - settings / task persistence and session isolation
 * - ledger arithmetic and alert re-arming
 * - image, edit, video (H3 + Hailuo), download retry, and H3-Context-IR flows
 *   against a deterministic fake fetch
 * - the same-origin HTTP surface used by the Client half
 *
 * Usage: ELECTRON_RUN_AS_NODE=1 <electron> test/selftest.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { imagePixels, videoPixels, ratioMatches, sniffImage, splitEnhancedPrompt } from '../src/media.js'
import { describeFailure, extractCode, endpoints } from '../src/api.js'
import { createHost } from '../src/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
let passed = 0
function ok(label) {
  passed += 1
  console.log(`  OK ${label}`)
}
function section(name) {
  console.log(`\n## ${name}`)
}

// ---------------------------------------------------------------- fixtures

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Minimal RGB PNG with a solid color, used for reference validation. */
function makePng(width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = 0x22
    row[2 + x * 3] = 0x88
    row[3 + x * 3] = 0xcc
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const PNG_16_9 = makePng(1360, 768)
const PNG_SQUARE = makePng(256, 256)
const pngPath = path.join(os.tmpdir(), `h3-ref-${process.pid}.png`)
fs.writeFileSync(pngPath, PNG_16_9)

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

function binaryResponse(bytes, status = 200) {
  return new Response(bytes, { status, headers: { 'Content-Type': 'application/octet-stream' } })
}

const KEY = 'test-minimax-key-0123456789abcdef'
const calls = { image: 0, edit: 0, video: 0, query: 0, enhance: 0, download: 0, models: 0, legacyVideo: 0, legacyQuery: 0, legacyFile: 0 }

function makeFetch(state) {
  return async function fakeFetch(url, init = {}) {
    const href = String(url)
    const body = init.body ? JSON.parse(init.body) : undefined
    if (href.endsWith('/images/generations') && init.method === 'POST') {
      calls.image += 1
      state.lastImageBody = body
      if (state.imageMode === 'fail') {
        return jsonResponse({ type: 'error', error: { type: 'bad_request_error', message: 'invalid params (2013)', http_code: '400' } }, 400)
      }
      return jsonResponse({
        created: 1,
        data: [
          { url: 'https://cdn.test/a.png', size: '1360x768', revised_prompt: 'revised' },
          ...(state.partialFail ? [{ error: { code: '1027', message: 'output image failed content safety check' } }] : []),
        ],
        output_format: 'png',
        usage: { generated_images: 1 },
        request_id: 'req-1',
      })
    }
    if (href.endsWith('/images/edits') && init.method === 'POST') {
      calls.edit += 1
      state.lastEditBody = body
      return jsonResponse({
        data: [{ url: 'https://cdn.test/b.png', size: '1360x768', revised_prompt: 'revised edit' }],
        output_format: 'jpeg',
        usage: { generated_images: 1 },
        request_id: 'req-edit',
      })
    }
    if (href === 'https://cdn.test/a.png' || href === 'https://cdn.test/b.png') {
      calls.download += 1
      return binaryResponse(state.squareOutput ? PNG_SQUARE : PNG_16_9)
    }
    if (href.endsWith('/v2/video_generation') && init.method === 'POST') {
      calls.video += 1
      state.lastVideoBody = body
      return jsonResponse({ task_id: `t${calls.video}` })
    }
    if (href.includes('/v2/query/video_generation/')) {
      calls.query += 1
      const taskId = href.split('/').pop()
      if (state.queryPlan && state.queryPlan.length) {
        const next = state.queryPlan.shift()
        return jsonResponse(next(taskId))
      }
      return jsonResponse({ task: { id: taskId, status: 'running' } })
    }
    if (href.endsWith('/v2/h3_context_ir') && init.method === 'POST') {
      calls.enhance += 1
      state.lastEnhanceBody = body
      return jsonResponse({ task_id: 'enh-1' })
    }
    if (href.includes('/v1/video_generation') && init.method === 'POST' && !href.includes('query')) {
      calls.legacyVideo += 1
      state.lastLegacyBody = body
      return jsonResponse({ task_id: 'hailuo-1', base_resp: { status_code: 0, status_msg: 'success' } })
    }
    if (href.includes('/query/video_generation?task_id=')) {
      calls.legacyQuery += 1
      return jsonResponse({ task_id: 'hailuo-1', status: 'Success', file_id: 'file-1', base_resp: { status_code: 0, status_msg: 'success' } })
    }
    if (href.includes('/files/retrieve?file_id=')) {
      calls.legacyFile += 1
      return jsonResponse({ file: { download_url: 'https://cdn.test/hailuo.mp4' }, base_resp: { status_code: 0 } })
    }
    if (href === 'https://cdn.test/video.mp4') {
      calls.download += 1
      if (state.videoDownloadFails > 0) {
        state.videoDownloadFails -= 1
        return new Response('nope', { status: 500 })
      }
      return binaryResponse(Buffer.from('fake-mp4-bytes'))
    }
    if (href === 'https://cdn.test/hailuo.mp4') {
      calls.download += 1
      return binaryResponse(Buffer.from('fake-hailuo-bytes'))
    }
    if (href.endsWith('/v1/models')) {
      calls.models += 1
      if (state.modelsStatus === 401) {
        return jsonResponse({ error: { message: 'login fail (1004)', http_code: '401' } }, 401)
      }
      return jsonResponse({ data: [{ id: 'MiniMax-M3' }, { id: 'MiniMax-M2.7' }] })
    }
    throw new Error(`fake fetch: unexpected ${init.method || 'GET'} ${href}`)
  }
}

const ctxStub = {
  get(name) {
    if (name === 'attachments') return { imageHostPath: () => pngPath }
    if (name === 'credentials') {
      return {
        resolve: async () => ({ value: KEY }),
        describe: async () => ({ configured: true, source: 'stored', writable: true, masked: 'test••••key' }),
        set: async (ref, value) => {
          ctxStub.savedKey = { ref, value }
        },
      }
    }
    return undefined
  },
}

// ---------------------------------------------------------------- helpers

async function expectError(promise, code) {
  try {
    await promise
  } catch (error) {
    assert.equal(error.code, code, `expected code ${code}, got ${error.code}: ${error.message}`)
    return error
  }
  throw new Error(`expected ${code} to throw`)
}

// ---------------------------------------------------------------- tests

section('pure helpers')
{
  assert.deepEqual(imagePixels('1K', '16:9'), { width: 1360, height: 768 })
  assert.deepEqual(imagePixels('2K', '16:9'), { width: 2720, height: 1536 })
  assert.equal(imagePixels('4K', '16:9').width, 5456)
  assert.deepEqual(videoPixels('768P', '16:9'), { width: 1344, height: 768 })
  assert.equal(videoPixels('1080P', '16:9'), null)
  assert.deepEqual(videoPixels('768P', '9:16'), { width: 768, height: 1344 })
  const parsed = sniffImage(PNG_16_9)
  assert.equal(parsed.width, 1360)
  assert.equal(parsed.height, 768)
  assert.equal(parsed.mediaType, 'image/png')
  assert.equal(ratioMatches('1360x768', '16:9'), true)
  assert.equal(ratioMatches('1024x1024', '16:9'), false)
  assert.equal(extractCode('login fail: Please carry ... (1004)'), '1004')
  const failure = describeFailure(401, { error: { message: 'login fail (1004)' } })
  assert.match(failure.hint, /api\.minimaxi\.com/)
  const quota = describeFailure(402, { error: { message: 'insufficient balance (1008)' } })
  assert.match(quota.hint, /充值/)
  const ignored = describeFailure(200, { base_resp: { status_code: 2062, status_msg: 'no subscription plan' } })
  assert.equal(ignored.ignored, true)
  assert.equal(endpoints('https://api.minimaxi.com/v1').videoV2, 'https://api.minimaxi.com/v2/video_generation')
  assert.equal(splitEnhancedPrompt('integrated_multimodal_description: A\noverall_soundscape: B\nnon_diegetic_music: C').overall_soundscape, 'B')
  ok('pixel math, sniffing, error mapping, endpoint derivation')
}

section('settings, task store, ledger, alert')
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3-selftest-'))
const state = { queryPlan: [], videoDownloadFails: 0 }
const fetchImpl = makeFetch(state)
const host = createHost(
  { media: { dataDir }, pricing: { imagePerCall: 0.3, videoPerSecond: 0.5 } },
  ctxStub,
  { fetchImpl, resolveKey: async () => KEY },
)
{
  assert.equal(host.store.dataDir, dataDir)
  assert.equal(host.store.getSettings().connection.baseURL, 'https://api.minimaxi.com/v1')
  host.store.saveSettings({ connection: { plan: 'custom', baseURL: 'https://api.example.com/v1' } })
  assert.equal(host.store.getSettings().connection.baseURL, 'https://api.example.com/v1')
  host.store.saveSettings({ connection: { plan: 'payg-cn' } })
  assert.equal(host.store.getSettings().connection.baseURL, 'https://api.minimaxi.com/v1')

  const ledger = host.ledger
  assert.equal(ledger.currentBalance(), 100)
  ledger.charge({ taskId: 'x', sessionId: 's1', kind: 'image', model: 'MiniMax-H3-Image', cost: 0.3, units: 1, unit: 'image' })
  assert.equal(ledger.currentBalance(), 99.7)
  assert.equal(ledger.sessionSpend('s1'), 0.3)
  assert.equal(ledger.sessionSpend('s2'), 0)
  ledger.setAnchor(4)
  ledger.setAlert({ enabled: true, threshold: 5 })
  assert.equal(ledger.status('s1').alert.triggered, true)
  assert.equal(ledger.status('s1').alert.justTriggered, true)
  ledger.setAnchor(10)
  assert.equal(ledger.status('s1').alert.triggered, false)
  ledger.setAlert({ threshold: 10.05 })
  assert.equal(ledger.status('s1').alert.triggered, true, 'rearm after crossing back down')
  ledger.setAlert({ enabled: false })
  assert.equal(ledger.status('s1').alert.triggered, false)
  ledger.setAlert({ enabled: true, threshold: 5 })
  ledger.setAnchor(100)
  ok('settings plan presets, ledger arithmetic, alert trigger + re-arm')
}

section('image generation')
{
  state.imageMode = 'ok'
  const task = await host.media.generateImage(
    { prompt: '雨夜街头', aspectRatio: '16:9', area: '1K', n: 1, format: 'png', enhance: true },
    { sessionId: 's1' },
  )
  assert.equal(calls.image, 1)
  assert.equal(state.lastImageBody.model, 'MiniMax-H3-Image')
  assert.equal(state.lastImageBody.aspect_ratio, '16:9')
  assert.equal(state.lastImageBody.area, '1K')
  assert.equal(state.lastImageBody.disable_prompt_enhanced, false)
  assert.equal(task.status, 'succeeded')
  assert.equal(task.files.length, 1)
  assert.ok(fs.existsSync(task.files[0].path))
  assert.equal(task.params.actualSize, '1360x768')
  assert.equal(task.params.ratioMatch, true)
  assert.equal(task.cost, 0.3)
  assert.equal(calls.download, 1)
  ok('1K 16:9 jpeg/png path: single request, one saved file, ratio match, billed 0.3')
}

section('image failure is never retried')
{
  const before = calls.image
  const { media, store } = host
  state.imageMode = 'fail'
  await expectError(media.generateImage({ prompt: 'x', aspectRatio: '1:1', area: '1K', n: 1 }, { sessionId: 's1' }), '2013')
  assert.equal(calls.image, before + 1, 'exactly one submit attempt')
  const latest = store.tasks('s1')[0]
  assert.equal(latest.status, 'failed')
  assert.match(latest.error.hint, /比例|参数/)
  state.imageMode = 'ok'
  ok('400/2013 failure: one submit, no automatic retry, mapped hint')
}

section('edit with sha256 attachment ref')
{
  const ref = `sha256:${crypto.createHash('sha256').update(PNG_16_9).digest('hex')}`
  const task = await host.media.editImage(
    { prompt: '把图1的猫换成柴犬', images: [ref], aspectRatio: '16:9', area: '1K', n: 1, format: 'png' },
    { sessionId: 's1' },
  )
  assert.equal(calls.edit, 1)
  assert.match(state.lastEditBody.images[0].image_url, /^data:image\/png;base64,/)
  assert.equal(task.status, 'succeeded')
  assert.equal(task.params.mode, 'edit')
  await expectError(
    host.media.editImage({ prompt: 'x', images: [path.join(dataDir, 'missing.png')], aspectRatio: '1:1', area: '1K', n: 1 }, { sessionId: 's1' }),
    'REF_NOT_FOUND',
  )
  ok('sha256:<hex> resolves through the attachment host path; missing local file rejected locally')
}

section('video text mode + query + download + ledger')
{
  const sessionId = 's1'
  const task = await host.media.submitVideo(
    { mode: 'text', prompt: '雨夜街头', model: 'MiniMax-H3', resolution: '480P', duration: 4, ratio: '16:9', audio: true },
    { sessionId },
  )
  assert.equal(calls.video, 1)
  assert.equal(state.lastVideoBody.ratio, '16:9')
  assert.equal(state.lastVideoBody.duration, 4)
  assert.equal(state.lastVideoBody.resolution, '480P')
  assert.equal(state.lastVideoBody.generate_audio, true)
  assert.equal(task.provider.taskId, 't1')
  // running first, then succeeded with 4 output seconds
  state.queryPlan = [
    () => ({ task: { id: 't1', status: 'running' } }),
    () => ({ task: { id: 't1', status: 'succeeded', content: { url: 'https://cdn.test/video.mp4' }, usage: { output_seconds: 4 } } }),
  ]
  const running = await host.media.refresh(sessionId, task.id, 'query')
  assert.equal(running.provider.status, 'running')
  const saved = await host.media.refresh(sessionId, task.id, 'query')
  assert.equal(saved.status, 'saved')
  assert.equal(saved.provider.outputSeconds, 4)
  assert.equal(saved.cost, 2)
  assert.ok(fs.existsSync(saved.files[0].path))
  assert.equal(host.ledger.sessionSpend(sessionId), 2.9, 'manual 0.3 + image 0.3 + edit 0.3 + video 2.0')
  ok('480P/4s text video: task id, polling, download, output_seconds=4 billed 2.0')
}

section('frames mode and local mutual exclusion')
{
  const one = await host.media.submitVideo(
    { mode: 'frames', prompt: '过渡', firstFrame: pngPath, resolution: '768P', duration: 5 },
    { sessionId: 's1' },
  )
  assert.equal(state.lastVideoBody.ratio, 'adaptive')
  assert.deepEqual(state.lastVideoBody.content.map((item) => item.role || item.type), ['text', 'first_frame'])

  const before = calls.video
  const two = await host.media.submitVideo(
    { mode: 'frames', prompt: '过渡', firstFrame: pngPath, lastFrame: pngPath, resolution: '768P', duration: 5 },
    { sessionId: 's1' },
  )
  assert.deepEqual(state.lastVideoBody.content.map((item) => item.role || item.type), ['text', 'first_frame', 'last_frame'])
  assert.equal(calls.video, before + 1)

  const beforeConflict = calls.video
  await expectError(
    host.media.submitVideo(
      { mode: 'reference', prompt: '换主体', firstFrame: pngPath, referenceImages: [pngPath], resolution: '768P', duration: 5 },
      { sessionId: 's1' },
    ),
    'MODE_CONFLICT',
  )
  await expectError(
    host.media.submitVideo(
      { mode: 'reference', prompt: '音频', referenceAudios: [pngPath], resolution: '768P', duration: 5 },
      { sessionId: 's1' },
    ),
    'AUDIO_WITHOUT_VISUAL',
  )
  assert.equal(calls.video, beforeConflict, 'conflicts are rejected before any network call')
  ok('first frame only → adaptive; both frames → two items; frame/reference and audio-only rejected locally')
}

section('reference mode')
{
  const task = await host.media.submitVideo(
    { mode: 'reference', prompt: '把图1的猫换成图2的柴犬', referenceImages: [pngPath], resolution: '768P', duration: 5 },
    { sessionId: 's1' },
  )
  assert.equal(state.lastVideoBody.ratio, 'adaptive')
  assert.equal(state.lastVideoBody.content[1].role, 'reference_image')
  assert.equal(task.status, 'generating')
  ok('1 reference image submits with role=reference_image and adaptive ratio')
}

section('download retry only')
{
  const task = await host.media.submitVideo(
    { mode: 'text', prompt: '下载重试', model: 'MiniMax-H3', resolution: '768P', duration: 4, ratio: '16:9' },
    { sessionId: 's2' },
  )
  state.queryPlan = [
    () => ({ task: { id: task.provider.taskId, status: 'succeeded', content: { url: 'https://cdn.test/video.mp4' }, usage: { output_seconds: 4 } } }),
  ]
  state.videoDownloadFails = 1
  const failed = await host.media.refresh('s2', task.id, 'query')
  assert.equal(failed.status, 'download-failed')
  assert.equal(failed.error.retryable, true)
  assert.equal(host.ledger.sessionSpend('s2'), 0, 'no charge before a saved file')
  const retried = await host.media.refresh('s2', task.id, 'download')
  assert.equal(retried.status, 'saved')
  assert.equal(host.ledger.sessionSpend('s2'), 2)
  const before = calls.video
  await host.media.refresh('s2', task.id, 'download')
  assert.equal(calls.video, before, 'retry download never resubmits')
  assert.equal(host.ledger.sessionSpend('s2'), 2, 'no double billing')
  ok('download failure is retryable without resubmission or double billing')
}

section('Hailuo 2.3 legacy path')
{
  const task = await host.media.submitVideo(
    { mode: 'frames', prompt: '旧模型', model: 'MiniMax-Hailuo-2.3', firstFrame: pngPath, resolution: '768P', duration: 6, ratio: '16:9' },
    { sessionId: 's3' },
  )
  assert.equal(calls.legacyVideo, 1)
  assert.equal(state.lastLegacyBody.duration, 6)
  assert.match(state.lastLegacyBody.first_frame_image, /^data:image\/png;base64,/)
  const saved = await host.media.refresh('s3', task.id, 'query')
  assert.equal(saved.status, 'saved')
  assert.equal(saved.cost, 3)
  await expectError(
    host.media.submitVideo({ mode: 'text', prompt: 'x', model: 'MiniMax-Hailuo-2.3', duration: 8, resolution: '768P', ratio: '16:9' }, { sessionId: 's3' }),
    'BAD_INPUT',
  )
  ok('Hailuo 6s legacy submission, file retrieve, download; 8s rejected locally')
}

section('enhance prompt')
{
  host.store.saveSettings({ pricing: { enhancePer1kTokens: 0.01 } })
  state.queryPlan = [
    () => ({ task: { id: 'enh-1', status: 'running' } }),
    () => ({
      task: {
        id: 'enh-1',
        status: 'succeeded',
        content: { prompt: 'integrated_multimodal_description: [Shot 1] rain\noverall_soundscape: rain / traffic\nnon_diegetic_music: low synth' },
        usage: { total_tokens: 1000 },
      },
    }),
  ]
  const task = await host.media.enhancePrompt({ prompt: '雨夜', duration: 5, ratio: '16:9' }, { sessionId: 's1' })
  assert.equal(task.status, 'succeeded')
  assert.match(task.enhance.integrated_multimodal_description, /rain/)
  assert.equal(task.enhance.overall_soundscape, 'rain / traffic')
  assert.equal(task.cost, 0.01)
  const text = splitEnhancedPrompt(task.enhance.prompt)
  assert.match(text.non_diegetic_music, /synth/)
  ok('H3-Context-IR poll, structured prompt split, token estimate')
}

section('session isolation and list')
{
  assert.equal(host.media.list('s1', {}).length > 0, true)
  assert.equal(host.media.list('unknown-session', {}).length, 0)
  const images = host.media.list('s1', { kind: 'image' })
  assert.ok(images.every((task) => task.kind === 'image'))
  ok('tasks are per session; kind filter works')
}

section('same-origin HTTP surface')
{
  const server = http.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const origin = `http://127.0.0.1:${port}`
  const { createRouteHandler } = await import('../src/index.js')
  server.on('request', createRouteHandler(host, { origin }))
  const base = `${origin}/dsh-minimax-h3`
  try {
    const stateResponse = await fetch(`${base}/state?sessionId=s1`)
    const stateJson = await stateResponse.json()
    assert.equal(stateResponse.status, 200)
    assert.equal(stateJson.settings.connection.apiKeyEnv, 'MINIMAX_API_KEY')
    assert.equal(stateJson.key.configured, true)

    const save = await fetch(`${base}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 's1',
        apiKey: 'new-key-value',
        settings: { alert: { enabled: true, threshold: 3 }, balance: { current: 50 }, pricing: { videoPerSecond: 0.6 } },
      }),
    })
    assert.equal(save.status, 200)
    assert.equal(ctxStub.savedKey.value, 'new-key-value')
    assert.equal(ctxStub.savedKey.ref, 'MINIMAX_API_KEY')
    assert.equal(host.store.getSettings().alert.threshold, 3)
    assert.equal(host.ledger.currentBalance(), 50)
    assert.equal(host.store.getSettings().pricing.videoPerSecond, 0.6)

    const upload = await fetch(`${base}/upload-ref`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ref.png', data: PNG_16_9.toString('base64') }),
    })
    const uploaded = await upload.json()
    assert.equal(upload.status, 200)
    assert.ok(fs.existsSync(uploaded.path))

    const task = host.store.tasks('s1').find((entry) => entry.files?.length)
    assert.ok(task, 'a task with a saved file exists')
    const file = await fetch(`${base}/file/${encodeURIComponent(task.id)}/0`, { headers: { Range: 'bytes=0-9' } })
    assert.equal(file.status, 206)
    assert.equal(file.headers.get('content-range')?.startsWith('bytes 0-9/'), true)
    const bytes = await file.arrayBuffer()
    assert.equal(bytes.byteLength, 10)

    const crossSite = await fetch(`${base}/state`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })
    assert.equal(crossSite.status, 403)

    const bad = await fetch(`${base}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { alert: { threshold: 'NaN' } } }),
    })
    assert.equal(bad.status, 400)
    ok('state/settings/upload/file(206)/cross-site(403)/validation(400) route behavior')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

section('connection self-check')
{
  state.modelsStatus = 200
  const good = await host.client.testConnection()
  assert.equal(good.ok, true)
  assert.equal(calls.models, 1)
  state.modelsStatus = 401
  const bad = await host.client.testConnection()
  assert.equal(bad.ok, false)
  assert.match(bad.hint, /api\.minimaxi\.com/)
  ok('/v1/models self-check success + 401 region hint')
}

// ---------------------------------------------------------------- done

fs.rmSync(dataDir, { recursive: true, force: true })
fs.rmSync(pngPath, { force: true })
console.log(`\n${passed} checks passed.`)
