/**
 * MiniMax H3 media operations: synchronous images, asynchronous video, and
 * H3-Context-IR prompt enhancement. Every submission is recorded before the
 * network call so a timeout leaves a "submission unknown" record instead of a
 * record that invites a duplicate, billable retry.
 */
import fs from 'node:fs'
import path from 'node:path'
import { MinimaxError, endpoints, downloadBytes } from './api.js'
import { imageCost, tokenCost, videoCost } from './ledger.js'
import { newTaskId, dshHome, sessionKey } from './store.js'

export const RATIOS = ['9:16', '16:9', '21:9', '1:1', '4:3', '3:4']
export const IMAGE_AREAS = ['1K', '2K', '4K']
export const IMAGE_MODELS = ['MiniMax-H3-Image', 'MiniMax-H3-Image-Highspeed', 'image-01']
export const VIDEO_MODELS = ['MiniMax-H3', 'MiniMax-H3-Highspeed', 'MiniMax-H3-Lite', 'MiniMax-H3-Max', 'MiniMax-Hailuo-2.3']
export const IMAGE_FORMATS = ['jpeg', 'png', 'webp']
export const VIDEO_RESOLUTIONS = ['480P', '768P', '2K']
export const VIDEO_RATIOS = ['adaptive', ...RATIOS]
export const IMAGE01_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9']
export const IMAGE01_SIZES = {
  '1:1': [1024, 1024],
  '16:9': [1280, 720],
  '4:3': [1152, 864],
  '3:2': [1248, 832],
  '2:3': [832, 1248],
  '3:4': [864, 1152],
  '9:16': [720, 1280],
  '21:9': [1344, 576],
}

const AREA_PIXELS = { '1K': 1024 * 1024, '2K': 2048 * 2048, '4K': 4096 * 4096 }
const VIDEO_SHORT_SIDE = { '480P': 480, '768P': 768, '2K': 1440 }
const MAX_IMAGE_REF_BYTES = 64 * 1024 * 1024
const MAX_REQUEST_BYTES = 64 * 1024 * 1024
const MAX_VIDEO_REF_BYTES = 50 * 1024 * 1024
const MAX_AUDIO_REF_BYTES = 15 * 1024 * 1024
const IMAGE_TIMEOUT_MS = 600000

export function isH3ImageModel(model) {
  return String(model || '').startsWith('MiniMax-H3-Image')
}

export function isHailuo(model) {
  return String(model || '').includes('Hailuo')
}

function ratioParts(ratio) {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(ratio || ''))
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

/** Predicted image pixels: target area by aspect ratio, rounded to 16 px. */
export function imagePixels(area, ratio) {
  const total = AREA_PIXELS[area]
  const parts = ratioParts(ratio)
  if (!total || !parts) return null
  const [a, b] = parts
  const width = Math.floor(Math.sqrt((total * a) / b) / 16) * 16
  const height = Math.floor(Math.sqrt((total * b) / a) / 16) * 16
  return { width, height }
}

/** Predicted video pixels: short side fixed, long side floored to 32 px. */
export function videoPixels(resolution, ratio) {
  const short = VIDEO_SHORT_SIDE[resolution]
  const parts = ratioParts(ratio)
  if (!short || !parts) return null
  const [a, b] = parts
  const landscape = a >= b
  const long = Math.floor((short * Math.max(a, b)) / Math.min(a, b) / 32) * 32
  return landscape ? { width: long, height: short } : { width: short, height: long }
}

/** Compare an actual "WxH" against a requested ratio with a 1.5% tolerance. */
export function ratioMatches(size, ratio) {
  const parsed = parseSize(size)
  const parts = ratioParts(ratio)
  if (!parsed || !parts) return false
  const actual = parsed.width / parsed.height
  const wanted = parts[0] / parts[1]
  return Math.abs(actual - wanted) / wanted <= 0.015
}

export function parseSize(size) {
  const match = /^(\d+)x(\d+)$/i.exec(String(size || '').trim())
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

/** Minimal raster header sniffing: enough to validate references and name files. */
export function sniffImage(bytes) {
  if (!bytes || bytes.length < 12) return null
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return {
      mediaType: 'image/png',
      format: 'png',
      width: readUInt32BE(bytes, 16),
      height: readUInt32BE(bytes, 20),
    }
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1
        continue
      }
      const marker = bytes[offset + 1]
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2
        continue
      }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (length < 2) break
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return {
          mediaType: 'image/jpeg',
          format: 'jpeg',
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        }
      }
      offset += 2 + length
    }
    return { mediaType: 'image/jpeg', format: 'jpeg', width: null, height: null }
  }
  // WebP
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const chunk = ascii(bytes, 12, 4)
    if (chunk === 'VP8X') {
      return {
        mediaType: 'image/webp',
        format: 'webp',
        width: 1 + readUInt24LE(bytes, 24),
        height: 1 + readUInt24LE(bytes, 27),
      }
    }
    if (chunk === 'VP8 ') {
      return {
        mediaType: 'image/webp',
        format: 'webp',
        width: readUInt16LE(bytes, 26) & 0x3fff,
        height: readUInt16LE(bytes, 28) & 0x3fff,
      }
    }
    if (chunk === 'VP8L') {
      const bits = readUInt32LE(bytes, 21)
      return {
        mediaType: 'image/webp',
        format: 'webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      }
    }
    return { mediaType: 'image/webp', format: 'webp', width: null, height: null }
  }
  // GIF
  if (ascii(bytes, 0, 3) === 'GIF') {
    return {
      mediaType: 'image/gif',
      format: 'gif',
      width: readUInt16LE(bytes, 6),
      height: readUInt16LE(bytes, 8),
    }
  }
  // HEIC/HEIF: dimensions live in an ispe box; accept the container without them.
  if (ascii(bytes, 4, 4) === 'ftyp' && /hei[cf]|mif1|avif/i.test(ascii(bytes, 8, 12))) {
    return { mediaType: 'image/heic', format: 'heic', width: null, height: null }
  }
  return null
}

function ascii(bytes, offset, length) {
  let text = ''
  for (let i = 0; i < length && offset + i < bytes.length; i++) text += String.fromCharCode(bytes[offset + i])
  return text
}

function readUInt32BE(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function readUInt32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function readUInt16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUInt24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

export function validateImageBytes(bytes, label, { maxBytes = MAX_IMAGE_REF_BYTES } = {}) {
  if (!bytes || bytes.length === 0) throw new MinimaxError(`${label} 是空文件。`, { code: 'REF_EMPTY' })
  if (bytes.length > maxBytes) {
    throw new MinimaxError(`${label} 体积 ${(bytes.length / 1048576).toFixed(1)} MB，超过 ${Math.round(maxBytes / 1048576)} MB 上限。`, {
      code: 'REF_TOO_LARGE',
    })
  }
  const sniffed = sniffImage(bytes)
  if (!sniffed) throw new MinimaxError(`${label} 不是可识别的 JPG/PNG/WEBP/HEIC 图片。`, { code: 'REF_TYPE' })
  if (sniffed.width !== null && sniffed.height !== null) {
    if (sniffed.width < 128 || sniffed.height < 128 || sniffed.width > 8192 || sniffed.height > 8192) {
      throw new MinimaxError(`${label} 尺寸 ${sniffed.width}×${sniffed.height}，超出 128–8192 px 范围。`, {
        code: 'REF_DIMENSIONS',
      })
    }
    const long = Math.max(sniffed.width, sniffed.height)
    const short = Math.min(sniffed.width, sniffed.height)
    if (long / short > 4) {
      throw new MinimaxError(`${label} 长宽比 ${(long / short).toFixed(2)}:1，超过 4:1 上限。`, { code: 'REF_ASPECT' })
    }
  }
  return { ...sniffed, bytes: bytes.length }
}

function dataUri(mediaType, bytes) {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`
}

function extensionFor(format) {
  if (format === 'jpeg' || format === 'jpg') return 'jpg'
  if (format === 'heic' || format === 'heif') return 'heic'
  return format || 'bin'
}

function mediaTypeFor(format) {
  if (format === 'jpg' || format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  if (format === 'gif') return 'image/gif'
  if (format === 'mp4') return 'video/mp4'
  if (format === 'mov') return 'video/quicktime'
  if (format === 'mp3') return 'audio/mpeg'
  if (format === 'wav') return 'audio/wav'
  if (format === 'heic') return 'image/heic'
  return 'application/octet-stream'
}

function ensureString(value, name, { max = 32000, required = true } = {}) {
  const text = value === undefined || value === null ? '' : String(value)
  if (required && !text.trim()) throw new MinimaxError(`缺少 ${name}。`, { code: 'BAD_INPUT' })
  if (text.length > max) throw new MinimaxError(`${name} 超过 ${max} 字符。`, { code: 'BAD_INPUT' })
  return text
}

function ensureEnum(value, allowed, name, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (!allowed.includes(value)) {
    throw new MinimaxError(`${name} 只能是 ${allowed.join(' / ')}。`, { code: 'BAD_INPUT' })
  }
  return value
}

function ensureInteger(value, min, max, name, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new MinimaxError(`${name} 必须是 ${min}–${max} 的整数。`, { code: 'BAD_INPUT' })
  }
  return number
}

function isoNow() {
  return new Date().toISOString()
}

export class MediaService {
  constructor({ store, ledger, client, attachments, log = () => {}, fetchImpl }) {
    this.store = store
    this.ledger = ledger
    this.client = client
    this.attachments = attachments
    this.log = log
    this.fetchImpl = fetchImpl
  }

  settings() {
    return this.store.getSettings()
  }

  ep() {
    return endpoints(this.settings().connection.baseURL)
  }

  // ---------------------------------------------------------------- tasks

  newTask(sessionId, kind, fields) {
    const task = {
      id: newTaskId(kind),
      kind,
      sessionId: String(sessionId ?? ''),
      status: 'submitting',
      createdAt: isoNow(),
      updatedAt: isoNow(),
      cost: 0,
      billed: false,
      files: [],
      failures: [],
      error: null,
      ...fields,
    }
    this.store.putTask(sessionId, task)
    return task
  }

  updateTask(task, patch) {
    Object.assign(task, patch, { updatedAt: isoNow() })
    this.store.putTask(task.sessionId, task)
    return task
  }

  failTask(task, error) {
    const failure = error instanceof MinimaxError ? error : null
    const unknown = failure?.code === 'TIMEOUT' || failure?.code === 'NETWORK' || failure?.code === 'ABORTED'
    return this.updateTask(task, {
      status: unknown ? 'submission-unknown' : 'failed',
      error: {
        code: failure?.code || 'ERROR',
        message: error instanceof Error ? error.message : String(error),
        hint: failure?.hint || '',
        retryable: false,
        submissionUnknown: unknown,
      },
    })
  }

  /** Card-facing projection; keeps prompt text and bounded file metadata. */
  view(task) {
    if (!task) return null
    return {
      id: task.id,
      kind: task.kind,
      status: task.status,
      model: task.model,
      prompt:
        task.kind === 'enhance'
          ? String(task.prompt || '')
          : String(task.prompt || '').slice(0, 2000),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      cost: Number(task.cost) || 0,
      billed: Boolean(task.billed),
      params: task.params || {},
      error: task.error || null,
      failures: task.failures || [],
      provider: task.provider || null,
      enhance: task.enhance || null,
      files: (task.files || []).map((file, index) => ({
        name: file.name,
        index,
        path: file.path,
        bytes: file.bytes,
        width: file.width ?? null,
        height: file.height ?? null,
        format: file.format,
        url: `/dsh-minimax-h3/file/${encodeURIComponent(task.id)}/${index}`,
      })),
      sessionKey: sessionKey(task.sessionId),
    }
  }

  taskStatus(sessionId, taskId, action = 'query') {
    const task = this.store.findTask(sessionId, taskId)
    if (!task) throw new MinimaxError(`本会话找不到任务 ${taskId}。`, { code: 'TASK_NOT_FOUND' })
    return { task, action }
  }

  list(sessionId, { kind, limit = 20 } = {}) {
    let list = this.store.tasks(sessionId)
    if (kind) list = list.filter((task) => task.kind === kind)
    return list.slice(0, Math.max(1, Math.min(100, Number(limit) || 20))).map((task) => this.view(task))
  }

  // ---------------------------------------------------------------- refs

  /** Resolve one reference string to a public URL or a validated data URI. */
  async resolveImageRef(ref, label = '参考图') {
    const text = String(ref ?? '').trim()
    if (!text) throw new MinimaxError(`${label} 为空。`, { code: 'REF_EMPTY' })
    if (/^https?:\/\//i.test(text)) return { url: text, source: 'url', label }
    if (/^sha256:[a-f0-9]{64}$/i.test(text)) {
      const file = this.attachmentPath(text)
      if (!file || !fs.existsSync(file)) {
        throw new MinimaxError(`${label} 附件 ${text.slice(0, 18)}… 不在本机附件库；确认附件属于当前会话。`, {
          code: 'REF_NOT_FOUND',
        })
      }
      const bytes = new Uint8Array(fs.readFileSync(file))
      const sniffed = validateImageBytes(bytes, label)
      return { url: dataUri(sniffed.mediaType, bytes), source: 'attachment', label, width: sniffed.width, height: sniffed.height, bytes: bytes.length }
    }
    const file = path.resolve(text)
    if (!fs.existsSync(file)) throw new MinimaxError(`${label} 文件不存在：${file}`, { code: 'REF_NOT_FOUND' })
    const bytes = new Uint8Array(fs.readFileSync(file))
    const sniffed = validateImageBytes(bytes, label)
    return { url: dataUri(sniffed.mediaType, bytes), source: 'file', label, path: file, width: sniffed.width, height: sniffed.height, bytes: bytes.length }
  }

  attachmentPath(ref) {
    try {
      if (this.attachments && typeof this.attachments.imageHostPath === 'function') {
        const result = this.attachments.imageHostPath({ attachmentId: ref })
        if (result) return result
      }
    } catch (error) {
      this.log('attachment path lookup failed', error)
    }
    const match = /^sha256:([a-f0-9]{64})$/i.exec(String(ref))
    if (!match) return undefined
    return path.join(dshHome(), 'attachments', 'v1', 'objects', match[1].slice(0, 2), match[1])
  }

  /** Resolve a video/audio reference; local files become data URIs with a size cap. */
  resolveMediaRef(ref, { kind, label }) {
    const text = String(ref ?? '').trim()
    if (!text) throw new MinimaxError(`${label} 为空。`, { code: 'REF_EMPTY' })
    if (/^https?:\/\//i.test(text)) return { url: text, source: 'url', label }
    if (/^mm_file:\/\//i.test(text)) return { url: text, source: 'platform', label }
    const file = path.resolve(text)
    if (!fs.existsSync(file)) throw new MinimaxError(`${label} 文件不存在：${file}`, { code: 'REF_NOT_FOUND' })
    const bytes = new Uint8Array(fs.readFileSync(file))
    const cap = kind === 'audio' ? MAX_AUDIO_REF_BYTES : MAX_VIDEO_REF_BYTES
    if (bytes.length > cap) {
      throw new MinimaxError(`${label} 体积 ${(bytes.length / 1048576).toFixed(1)} MB，超过 ${Math.round(cap / 1048576)} MB；改用公网 URL。`, {
        code: 'REF_TOO_LARGE',
      })
    }
    const format = kind === 'audio' ? guessAudioFormat(file) : guessVideoFormat(file)
    return { url: dataUri(mediaTypeFor(format), bytes), source: 'file', path: file, label, bytes: bytes.length, format }
  }

  // ---------------------------------------------------------------- images

  buildImagePayload(args) {
    const settings = this.settings()
    const model = ensureEnum(args.model ?? settings.models.image, IMAGE_MODELS, '图片模型', settings.models.image)
    const prompt = ensureString(args.prompt, 'prompt')
    const enhance = args.enhance === undefined ? settings.image.enhance : Boolean(args.enhance)
    const ratio = ensureEnum(args.aspectRatio ?? args.aspect_ratio ?? settings.image.aspectRatio, RATIOS, '比例', settings.image.aspectRatio)
    const n = ensureInteger(args.n ?? settings.image.n, 1, 10, '张数', settings.image.n)
    const format = ensureEnum(args.format ?? settings.image.format, IMAGE_FORMATS, '格式', settings.image.format)
    if (model === 'image-01') {
      const image01Ratio = ensureEnum(ratio, IMAGE01_RATIOS, 'image-01 比例', ratio)
      return {
        model,
        prompt,
        ratio: image01Ratio,
        n: Math.min(n, 9),
        format: 'jpg',
        enhance,
        payload: {
          model: 'image-01',
          prompt,
          aspect_ratio: image01Ratio,
          response_format: 'url',
          n: Math.min(n, 9),
          prompt_optimizer: enhance,
        },
        predicted: { width: IMAGE01_SIZES[image01Ratio][0], height: IMAGE01_SIZES[image01Ratio][1] },
      }
    }
    const area = ensureEnum(args.area ?? settings.image.area, IMAGE_AREAS, '分辨率（area）', settings.image.area)
    return {
      model,
      prompt,
      ratio,
      area,
      n,
      format,
      enhance,
      payload: {
        model,
        prompt,
        aspect_ratio: ratio,
        area,
        n,
        output_format: format,
        response_format: 'url',
        disable_prompt_enhanced: !enhance,
      },
      predicted: imagePixels(area, ratio),
    }
  }

  async generateImage(args, { sessionId, signal } = {}) {
    const built = this.buildImagePayload(args || {})
    const task = this.newTask(sessionId, 'image', {
      model: built.model,
      prompt: built.prompt,
      params: {
        aspectRatio: built.ratio,
        area: built.area ?? null,
        n: built.n,
        format: built.format,
        enhance: built.enhance,
        predicted: built.predicted,
      },
    })
    const settings = this.settings()
    const timeoutMs = Math.max(IMAGE_TIMEOUT_MS, Number(settings.connection.timeoutMs) || 0)
    let payload
    try {
      const url = built.model === 'image-01' ? this.ep().legacyImage : this.ep().images
      payload = await this.client.call(url, {
        method: 'POST',
        body: built.payload,
        timeoutMs,
        signal,
        stage: 'image-submit',
      })
    } catch (error) {
      this.failTask(task, error)
      throw error
    }
    return this.finishImages(task, payload, { model: built.model, requestedN: built.n, ratio: built.ratio, timeoutMs, signal })
  }

  async editImage(args, { sessionId, signal } = {}) {
    const settings = this.settings()
    const model = ensureEnum(args.model ?? settings.models.image, IMAGE_MODELS, '图片模型', settings.models.image)
    if (model === 'image-01') {
      throw new MinimaxError('image-01 不支持图生图；选择 MiniMax-H3-Image 或 MiniMax-H3-Image-Highspeed。', {
        code: 'MODEL_UNSUPPORTED',
      })
    }
    const prompt = ensureString(args.prompt, 'prompt')
    const rawRefs = Array.isArray(args.images)
      ? args.images
      : args.images === undefined
        ? toArray(settings.image.references)
        : [args.images]
    if (rawRefs.length < 1 || rawRefs.length > 16) {
      throw new MinimaxError('图生图需要 1–16 张参考图。', { code: 'BAD_INPUT' })
    }
    const resolved = []
    let totalBytes = Buffer.byteLength(prompt, 'utf8')
    for (let index = 0; index < rawRefs.length; index++) {
      const ref = await this.resolveImageRef(rawRefs[index], `参考图 ${index + 1}`)
      totalBytes += ref.url.length
      resolved.push(ref)
    }
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new MinimaxError('参考图总大小超过 64 MiB；改用公网 URL（本地文件已压缩后仍过大）。', { code: 'REQUEST_TOO_LARGE' })
    }
    const ratio = ensureEnum(args.aspectRatio ?? args.aspect_ratio ?? settings.image.aspectRatio, RATIOS, '比例', settings.image.aspectRatio)
    const area = ensureEnum(args.area ?? settings.image.area, IMAGE_AREAS, '分辨率（area）', settings.image.area)
    const n = ensureInteger(args.n ?? settings.image.n, 1, 10, '张数', settings.image.n)
    const format = ensureEnum(args.format ?? settings.image.format, IMAGE_FORMATS, '格式', settings.image.format)
    const task = this.newTask(sessionId, 'image', {
      model,
      prompt,
      params: {
        mode: 'edit',
        aspectRatio: ratio,
        area,
        n,
        format,
        enhance: true,
        refs: resolved.map((ref) => ({ source: ref.source, label: ref.label, width: ref.width ?? null, height: ref.height ?? null })),
        sourceRefs: rawRefs,
        predicted: imagePixels(area, ratio),
      },
    })
    const timeoutMs = Math.max(IMAGE_TIMEOUT_MS, Number(settings.connection.timeoutMs) || 0)
    let payload
    try {
      payload = await this.client.call(this.ep().edits, {
        method: 'POST',
        body: {
          model,
          prompt,
          images: resolved.map((ref) => ({ image_url: ref.url })),
          aspect_ratio: ratio,
          area,
          n,
          output_format: format,
          response_format: 'url',
        },
        timeoutMs,
        signal,
        stage: 'image-edit-submit',
      })
    } catch (error) {
      this.failTask(task, error)
      throw error
    }
    return this.finishImages(task, payload, { model, requestedN: n, ratio, timeoutMs, signal })
  }

  async finishImages(task, payload, { model, requestedN, ratio, timeoutMs, signal }) {
    const isLegacy = model === 'image-01'
    const items = isLegacy ? legacyImageItems(payload) : Array.isArray(payload?.data) ? payload.data : []
    if (!items.length) {
      const error = new MinimaxError('接口未返回任何图片。', { code: 'EMPTY_RESPONSE' })
      this.failTask(task, error)
      throw error
    }
    const settings = this.settings()
    let saved = 0
    const failures = []
    const files = []
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const failure = item?.error
      if (failure) {
        failures.push({ index, code: String(failure.code || ''), message: String(failure.message || '') })
        continue
      }
      let bytes
      let sniffed = null
      try {
        if (item.b64_json) {
          bytes = new Uint8Array(Buffer.from(item.b64_json, 'base64'))
          sniffed = sniffImage(bytes)
        } else if (item.url) {
          bytes = await downloadBytes(item.url, { timeoutMs: 180000, signal, fetchImpl: this.fetchImpl })
          sniffed = sniffImage(bytes)
        } else {
          failures.push({ index, code: 'NO_URL', message: '该张没有返回 url。' })
          continue
        }
        const format = sniffed?.format || (isLegacy ? 'jpg' : String(payload?.output_format || 'jpeg'))
        const name = `result-${files.length + 1}.${extensionFor(format)}`
        const file = this.store.saveMedia(task.sessionId, task.id, name, bytes)
        const size = item.size ? parseSize(item.size) : null
        files.push({
          path: file,
          name,
          bytes: bytes.length,
          width: sniffed?.width ?? size?.width ?? null,
          height: sniffed?.height ?? size?.height ?? null,
          format,
          revisedPrompt: item.revised_prompt ? String(item.revised_prompt) : '',
        })
        saved += 1
      } catch (error) {
        failures.push({ index, code: 'DOWNLOAD_FAILED', message: error instanceof Error ? error.message : String(error) })
      }
    }
    if (saved === 0) {
      const first = failures[0]
      const error = new MinimaxError(
        first ? `${first.message || '全部图片生成失败'}${first.code ? `（${first.code}）` : ''}` : '全部图片生成失败。',
        { code: first?.code || 'IMAGE_FAILED', hint: '检查提示词内容安全与余额；本接口非幂等，重试会重新计费。' },
      )
      this.updateTask(task, { failures, status: 'failed', error: { code: error.code, message: error.message, hint: error.hint } })
      throw error
    }
    const cost = imageCost(saved, settings.pricing.imagePerCall)
    const actual = files[0] && files[0].width && files[0].height ? `${files[0].width}x${files[0].height}` : ''
    const ratioOk = actual ? ratioMatches(actual, ratio) : null
    this.updateTask(task, {
      status: failures.length ? 'partial' : 'succeeded',
      files,
      failures,
      cost,
      billed: true,
      params: { ...task.params, requestedN, predicted: task.params.predicted, actualSize: actual, ratioMatch: ratioOk },
      provider: {
        requestId: payload?.request_id || payload?.id || '',
        generated: payload?.usage?.generated_images ?? saved,
        usage: payload?.usage || null,
      },
    })
    this.ledger.charge({
      taskId: task.id,
      sessionId: task.sessionId,
      kind: 'image',
      model,
      cost,
      units: saved,
      unit: 'image',
    })
    return this.view(task)
  }

  // ---------------------------------------------------------------- video

  buildVideoRequest(args) {
    const settings = this.settings()
    const model = ensureEnum(args.model ?? settings.models.video, VIDEO_MODELS, '视频模型', settings.models.video)
    const mode = ensureEnum(args.mode ?? 'text', ['text', 'frames', 'reference'], '模式', 'text')
    const prompt = ensureString(args.prompt, 'prompt', { max: 7000 })
    const duration = ensureInteger(args.duration ?? settings.video.duration, 1, 15, '时长', settings.video.duration)
    const resolution = ensureEnum(args.resolution ?? settings.video.resolution, VIDEO_RESOLUTIONS, '分辨率', settings.video.resolution)
    const audio = args.audio === undefined ? settings.video.audio : Boolean(args.audio)
    const firstFrame = firstValue(args.firstFrame, args.first_frame)
    const lastFrame = firstValue(args.lastFrame, args.last_frame)
    const referenceImages = toArray(args.referenceImages ?? args.reference_images)
    const referenceVideos = toArray(args.referenceVideos ?? args.reference_videos)
    const referenceAudios = toArray(args.referenceAudios ?? args.reference_audios)
    const pending = this.store.readPending(String(args.__sessionId ?? '')) || {}
    const effectiveFirst = firstFrame || (mode === 'frames' ? pending.firstFrame || settings.video.firstFrame : '')
    const effectiveLast = lastFrame || (mode === 'frames' ? pending.lastFrame || settings.video.lastFrame : '')
    const effectiveRefs = referenceImages.length
      ? referenceImages
      : mode === 'reference'
        ? toArray(pending.references).length ? toArray(pending.references) : toArray(settings.video.referenceImages)
        : []

    if (mode === 'text') {
      if (effectiveFirst || effectiveLast || referenceImages.length || referenceVideos.length || referenceAudios.length) {
        throw new MinimaxError('文生视频不能同时给首尾帧或参考素材；切换模式会清空上一模式的输入。', { code: 'MODE_CONFLICT' })
      }
    } else if (mode === 'frames') {
      if (referenceImages.length || referenceVideos.length || referenceAudios.length) {
        throw new MinimaxError('首尾帧与参考生视频互斥：content 里的 first_frame/last_frame 不能和 reference_* 同时出现。', {
          code: 'MODE_CONFLICT',
        })
      }
      if (!effectiveFirst) throw new MinimaxError('首尾帧模式必须给首帧；尾帧可选。', { code: 'BAD_INPUT' })
    } else {
      if (effectiveFirst || effectiveLast) {
        throw new MinimaxError('参考生视频与首尾帧互斥：不能同时给 first_frame/last_frame 与 reference_*。', {
          code: 'MODE_CONFLICT',
        })
      }
      if (!effectiveRefs.length && !referenceVideos.length && !referenceAudios.length) {
        throw new MinimaxError('参考生视频至少需要一张参考图、一段参考视频或一段参考音频。', { code: 'BAD_INPUT' })
      }
    }

    if (isHailuo(model)) {
      if (mode === 'reference') throw new MinimaxError('MiniMax-Hailuo-2.3 不支持参考生视频；改选 H3 系列。', { code: 'MODEL_UNSUPPORTED' })
      if (referenceImages.length || referenceVideos.length || referenceAudios.length) {
        throw new MinimaxError('MiniMax-Hailuo-2.3 不支持参考素材。', { code: 'MODEL_UNSUPPORTED' })
      }
      if (![6, 10].includes(duration)) throw new MinimaxError('MiniMax-Hailuo-2.3 只支持 6 或 10 秒。', { code: 'BAD_INPUT' })
      if (!['768P', '1080P'].includes(resolution)) throw new MinimaxError('MiniMax-Hailuo-2.3 只支持 768P/1080P。', { code: 'BAD_INPUT' })
      if (duration === 10 && resolution === '1080P') throw new MinimaxError('MiniMax-Hailuo-2.3 的 10 秒只支持 768P。', { code: 'BAD_INPUT' })
      if (mode === 'frames' && effectiveLast) throw new MinimaxError('MiniMax-Hailuo-2.3 只支持首帧，不支持尾帧；尾帧请用 H3 系列。', { code: 'MODEL_UNSUPPORTED' })
      return {
        provider: 'hailuo',
        model,
        mode,
        prompt,
        duration,
        resolution,
        ratio: 'adaptive',
        audio,
        firstFrame: effectiveFirst,
        references: null,
        payload: {
          model,
          prompt,
          duration,
          resolution,
          prompt_optimizer: true,
          ...(effectiveFirst ? { first_frame_image: effectiveFirst } : {}),
        },
      }
    }

    const maxDuration = 15
    const minDuration = model === 'MiniMax-H3-Max' ? 5 : 4
    if (duration < minDuration || duration > maxDuration) {
      throw new MinimaxError(`${model} 时长只能是 ${minDuration}–${maxDuration} 秒。`, { code: 'BAD_INPUT' })
    }
    if (model === 'MiniMax-H3' && resolution === '480P') {
      // The spec records a tested H3 480P/4s task; keep it allowed even though
      // the model table lists 768P/2K for H3.
    }
    if (model !== 'MiniMax-H3' && resolution === '2K') {
      throw new MinimaxError(`${model} 不支持 2K，选 480P 或 768P。`, { code: 'BAD_INPUT' })
    }
    let ratio
    if (mode === 'text') {
      ratio = ensureEnum(args.ratio ?? settings.video.ratio, RATIOS, '比例', settings.video.ratio)
    } else if (mode === 'frames') {
      ratio = 'adaptive'
    } else {
      ratio = ensureEnum(args.ratio ?? 'adaptive', VIDEO_RATIOS, '比例', 'adaptive')
      if (model === 'MiniMax-H3-Lite' && ratio === 'adaptive') {
        throw new MinimaxError('MiniMax-H3-Lite 暂不支持 adaptive；显式指定一个比例。', { code: 'BAD_INPUT' })
      }
    }
    return {
      provider: 'h3',
      model,
      mode,
      prompt,
      duration,
      resolution,
      ratio,
      audio,
      firstFrame: effectiveFirst,
      lastFrame: mode === 'frames' ? effectiveLast : '',
      references: mode === 'reference' ? { images: effectiveRefs, videos: referenceVideos, audios: referenceAudios } : null,
    }
  }

  async submitVideo(args, { sessionId, signal } = {}) {
    const request = this.buildVideoRequest({ ...args, __sessionId: sessionId })
    const content = []
    const totalBytes = { value: Buffer.byteLength(request.prompt, 'utf8') }
    content.push({ type: 'text', text: request.prompt })
    const addImage = async (ref, role, label) => {
      const resolved = await this.resolveImageRef(ref, label)
      totalBytes.value += resolved.url.length
      content.push({ type: 'image_url', image_url: { url: resolved.url }, role })
    }
    if (request.mode === 'frames') {
      await addImage(request.firstFrame, 'first_frame', '首帧')
      if (request.lastFrame) await addImage(request.lastFrame, 'last_frame', '尾帧')
    }
    if (request.mode === 'reference') {
      const { images, videos, audios } = request.references
      if (images.length > 9) throw new MinimaxError('参考图最多 9 张。', { code: 'REF_LIMIT' })
      if (videos.length > 3) throw new MinimaxError('参考视频最多 3 段。', { code: 'REF_LIMIT' })
      if (audios.length > 3) throw new MinimaxError('参考音频最多 3 段。', { code: 'REF_LIMIT' })
      if (images.length + videos.length + audios.length > 12) throw new MinimaxError('参考文件总数不能超过 12。', { code: 'REF_LIMIT' })
      if (audios.length && !images.length && !videos.length) {
        throw new MinimaxError('参考音频不能单独使用，必须配参考图或参考视频。', { code: 'AUDIO_WITHOUT_VISUAL' })
      }
      for (let i = 0; i < images.length; i++) await addImage(images[i], 'reference_image', `参考图 ${i + 1}`)
      for (let i = 0; i < videos.length; i++) {
        const ref = this.resolveMediaRef(videos[i], { kind: 'video', label: `参考视频 ${i + 1}` })
        totalBytes.value += ref.url.length
        content.push({ type: 'video_url', video_url: { url: ref.url }, role: 'reference_video' })
      }
      for (let i = 0; i < audios.length; i++) {
        const ref = this.resolveMediaRef(audios[i], { kind: 'audio', label: `参考音频 ${i + 1}` })
        totalBytes.value += ref.url.length
        content.push({ type: 'audio_url', audio_url: { url: ref.url }, role: 'reference_audio' })
      }
    }
    if (totalBytes.value > MAX_REQUEST_BYTES) {
      throw new MinimaxError('请求体超过 64 MiB；改用公网 URL，不要用 Base64 传大文件。', { code: 'REQUEST_TOO_LARGE' })
    }
    if (request.provider === 'hailuo' && request.firstFrame) {
      const resolved = await this.resolveImageRef(request.firstFrame, '首帧')
      request.payload.first_frame_image = resolved.url
    }

    const task = this.newTask(sessionId, 'video', {
      model: request.model,
      prompt: request.prompt,
      params: {
        mode: request.mode,
        duration: request.duration,
        resolution: request.resolution,
        ratio: request.ratio,
        audio: request.audio,
        predicted: request.ratio === 'adaptive' ? null : videoPixels(request.resolution, request.ratio),
        source: {
          firstFrame: request.mode === 'frames' ? request.firstFrame : '',
          lastFrame: request.mode === 'frames' ? request.lastFrame : '',
          images: request.mode === 'reference' ? request.references.images : [],
          videos: request.mode === 'reference' ? request.references.videos : [],
          audios: request.mode === 'reference' ? request.references.audios : [],
        },
      },
      provider: { status: 'submitting', taskId: '' },
    })
    const settings = this.settings()
    const timeoutMs = Math.max(60000, Number(settings.connection.timeoutMs) || 60000)
    let payload
    try {
      if (request.provider === 'hailuo') {
        payload = await this.client.call(this.ep().legacyVideo, {
          method: 'POST',
          body: request.payload,
          timeoutMs,
          signal,
          stage: 'video-submit',
        })
      } else {
        payload = await this.client.call(this.ep().videoV2, {
          method: 'POST',
          body: {
            model: request.model,
            content,
            resolution: request.resolution,
            duration: request.duration,
            ratio: request.ratio,
            generate_audio: request.audio,
          },
          timeoutMs,
          signal,
          stage: 'video-submit',
        })
      }
    } catch (error) {
      this.failTask(task, error)
      throw error
    }
    const taskId = String(payload?.task_id || payload?.task?.id || '')
    if (!taskId) {
      const error = new MinimaxError('提交成功但没有返回 task_id，无法取回结果。', { code: 'NO_TASK_ID' })
      this.failTask(task, error)
      throw error
    }
    // A resolved first-frame/reference selection is consumed by this submit.
    if (request.mode === 'frames' || request.mode === 'reference') this.store.clearPending(sessionId)
    return this.updateTask(task, {
      status: 'generating',
      provider: { status: 'queued', taskId, submittedAt: isoNow(), mode: request.provider },
    })
  }

  /** Query one task; auto-downloads a succeeded video on first sight. */
  async queryVideo(task, { download = true, signal } = {}) {
    if (task.kind !== 'video') return this.view(task)
    if (!task.provider?.taskId) {
      const error = new MinimaxError('该任务没有服务端 task_id，无法查询；提交结果未知，勿重复提交。', { code: 'NO_TASK_ID' })
      throw error
    }
    const settings = this.settings()
    const timeoutMs = Math.max(30000, Number(settings.connection.timeoutMs) || 60000)
    let providerStatus = ''
    let usage = null
    let contentUrl = ''
    let providerError = null
    if (task.provider?.mode === 'hailuo') {
      const payload = await this.client.call(this.ep().legacyVideoQuery(task.provider.taskId), { timeoutMs, signal, stage: 'video-query' })
      providerStatus = mapLegacyStatus(payload?.status)
      if (providerStatus === 'succeeded') {
        const fileId = String(payload?.file_id || '')
        if (!fileId) throw new MinimaxError('任务成功但没有 file_id。', { code: 'NO_FILE_ID' })
        if (!task.provider?.contentUrl) {
          const file = await this.client.call(this.ep().legacyFile(fileId), { timeoutMs, signal, stage: 'video-file' })
          contentUrl = String(file?.file?.download_url || file?.download_url || '')
        } else contentUrl = task.provider.contentUrl
      }
      if (providerStatus === 'failed') providerError = { code: String(payload?.base_resp?.status_code || ''), message: String(payload?.base_resp?.status_msg || '生成失败') }
    } else {
      const payload = await this.client.call(this.ep().videoQuery(task.provider.taskId), { timeoutMs, signal, stage: 'video-query' })
      const data = payload?.task ?? payload
      providerStatus = mapH3Status(data?.status)
      usage = data?.usage || null
      contentUrl = String(data?.content?.url || '')
      if (providerStatus === 'failed') providerError = { code: String(data?.error?.code || ''), message: String(data?.error?.message || '生成失败') }
      if (providerStatus === 'succeeded' && data?.ratio) task.params.actualRatio = data.ratio
    }
    if (providerStatus === 'failed' || providerStatus === 'cancelled') {
      const error = providerError || { code: '', message: '任务已结束' }
      return this.updateTask(task, {
        status: 'failed',
        provider: { ...task.provider, status: providerStatus, usage, error },
        error: {
          code: error.code,
          message: error.message,
          hint: providerFailureHint(error.message),
        },
      })
    }
    if (providerStatus !== 'succeeded') {
      return this.updateTask(task, { provider: { ...task.provider, status: providerStatus || 'running', usage, checkedAt: isoNow() } })
    }
    if (!contentUrl && task.files?.length) {
      return this.updateTask(task, { provider: { ...task.provider, status: 'succeeded', usage, contentUrl: task.provider.contentUrl } })
    }
    if (!task.provider?.contentUrl) task.provider = { ...task.provider, contentUrl }
    if (!download) return this.updateTask(task, { provider: { ...task.provider, status: 'succeeded', usage } })
    return this.downloadVideo(task, { usage })
  }

  /** Download (or re-download) the finished video. This is the only retryable step. */
  async downloadVideo(task, { usage } = {}) {
    const url = String(task.provider?.contentUrl || '')
    if (!url) throw new MinimaxError('没有可下载的成片链接；先查询一次任务获取新链接。', { code: 'NO_CONTENT_URL' })
    this.updateTask(task, { status: 'downloading' })
    const attempts = Math.max(1, Number(task.provider?.downloadAttempts) || 0)
    let bytes
    try {
      bytes = await downloadBytes(url, { timeoutMs: 180000, fetchImpl: this.fetchImpl })
    } catch (error) {
      return this.updateTask(task, {
        status: 'download-failed',
        error: {
          code: error?.code || 'DOWNLOAD_FAILED',
          message: error instanceof Error ? error.message : String(error),
          hint: '成片已经生成，未重复计费；可以只重试下载。',
          retryable: true,
        },
        provider: { ...task.provider, downloadAttempts: attempts + 1 },
      })
    }
    const name = 'result-1.mp4'
    const file = this.store.saveMedia(task.sessionId, task.id, name, bytes)
    const seconds = Number(usage?.output_seconds ?? task.params?.duration ?? 0)
    const settings = this.settings()
    const wasBilled = Boolean(task.billed)
    const cost = wasBilled ? Number(task.cost) || 0 : videoCost(seconds, settings.pricing.videoPerSecond)
    const updated = this.updateTask(task, {
      status: 'saved',
      files: [
        {
          path: file,
          name,
          bytes: bytes.length,
          width: null,
          height: null,
          format: 'mp4',
        },
      ],
      cost,
      billed: true,
      error: null,
      provider: { ...task.provider, status: 'succeeded', usage: usage || task.provider?.usage || null, outputSeconds: seconds },
    })
    if (!wasBilled) {
      this.ledger.charge({
        taskId: task.id,
        sessionId: task.sessionId,
        kind: 'video',
        model: task.model,
        cost,
        units: seconds,
        unit: 'second',
      })
    }
    return updated
  }

  // ---------------------------------------------------------------- enhance

  async enhancePrompt(args, { sessionId, signal } = {}) {
    const settings = this.settings()
    const model = 'MiniMax-H3'
    const prompt = ensureString(args.prompt, 'prompt', { max: 7000 })
    const duration = ensureInteger(args.duration ?? settings.video.duration, 4, 15, '时长', settings.video.duration)
    const ratio = ensureEnum(args.ratio ?? settings.video.ratio, VIDEO_RATIOS, '比例', '16:9')
    if (ratio === 'adaptive') throw new MinimaxError('H3-Context-IR 的 ratio 不能是 adaptive；文生视频比例必填。', { code: 'BAD_INPUT' })
    const content = [{ type: 'text', text: prompt }]
    const firstFrame = firstValue(args.firstFrame, args.first_frame)
    if (firstFrame) {
      const resolved = await this.resolveImageRef(firstFrame, '首帧')
      content.push({ type: 'image_url', image_url: { url: resolved.url }, role: 'first_frame' })
    }
    const task = this.newTask(sessionId, 'enhance', {
      model,
      prompt,
      params: { duration, ratio },
      provider: { status: 'submitting', taskId: '' },
    })
    let payload
    try {
      payload = await this.client.call(this.ep().contextIR, {
        method: 'POST',
        body: { model, content, duration, ratio },
        timeoutMs: Math.max(60000, Number(settings.connection.timeoutMs) || 60000),
        signal,
        stage: 'enhance-submit',
      })
    } catch (error) {
      this.failTask(task, error)
      throw error
    }
    const taskId = String(payload?.task_id || payload?.task?.id || '')
    if (!taskId) {
      const error = new MinimaxError('增强任务提交成功但没有 task_id。', { code: 'NO_TASK_ID' })
      this.failTask(task, error)
      throw error
    }
    this.updateTask(task, { status: 'polling', provider: { status: 'queued', taskId } })
    const polled = await this.pollEnhance(task, { signal })
    return polled
  }

  async pollEnhance(task, { signal } = {}) {
    const timeoutMs = Math.max(60000, Number(this.settings().connection.timeoutMs) || 90000) * 2
    const interval = 2500
    const started = Date.now()
    let last = null
    while (Date.now() - started < timeoutMs) {
      if (signal?.aborted) throw new MinimaxError('增强任务已取消。', { code: 'ABORTED' })
      const payload = await this.client.call(this.ep().videoQuery(task.provider.taskId), {
        timeoutMs: 30000,
        signal,
        stage: 'enhance-query',
      })
      const data = payload?.task ?? payload
      const status = String(data?.status || '')
      last = data
      if (status === 'succeeded') {
        const prompt = String(data?.content?.prompt || '')
        if (!prompt) throw new MinimaxError('任务成功但 content.prompt 为空。', { code: 'EMPTY_PROMPT' })
        const usage = data?.usage || {}
        const cost = tokenCost(usage.total_tokens, this.settings().pricing.enhancePer1kTokens)
        this.updateTask(task, {
          status: 'succeeded',
          cost,
          billed: true,
          enhance: {
            prompt,
            ...splitEnhancedPrompt(prompt),
            tokens: Number(usage.total_tokens) || 0,
          },
          provider: { status: 'succeeded', taskId: task.provider.taskId, usage },
        })
        this.ledger.charge({
          taskId: task.id,
          sessionId: task.sessionId,
          kind: 'enhance',
          model: 'MiniMax-H3',
          cost,
          units: Number(usage.total_tokens) || 0,
          unit: 'token',
        })
        return this.view(task)
      }
      if (status === 'failed' || status === 'cancelled') {
        const error = { code: String(data?.error?.code || ''), message: String(data?.error?.message || '增强失败') }
        this.updateTask(task, {
          status: 'failed',
          error: { ...error, hint: error.code === '1026' ? '换个描述或参考图。' : '' },
          provider: { status, taskId: task.provider.taskId, usage: data?.usage || null },
        })
        throw new MinimaxError(error.message, { code: error.code })
      }
      this.updateTask(task, { provider: { ...task.provider, status: status || 'running' } })
      await delay(interval, signal)
    }
    const error = new MinimaxError('增强任务轮询超时；任务可能仍在运行，先查任务再决定。', { code: 'POLL_TIMEOUT' })
    this.updateTask(task, {
      status: 'submission-unknown',
      error: { code: 'POLL_TIMEOUT', message: error.message, hint: '勿重复提交；稍后用任务 ID 查询。' },
      provider: { ...task.provider, status: last?.status || 'running' },
    })
    throw error
  }

  /** Convenience for the status tool: query/download one recorded task. */
  async refresh(sessionId, taskId, action = 'query', { signal } = {}) {
    const task = this.store.findTask(sessionId, taskId)
    if (!task) throw new MinimaxError(`本会话找不到任务 ${taskId}。`, { code: 'TASK_NOT_FOUND' })
    if (task.kind === 'video') {
      if (action === 'download') return this.view(await this.downloadVideo(task))
      return this.view(await this.queryVideo(task, { download: true, signal }))
    }
    return this.view(task)
  }
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      if (value.length) return value[0]
    } else if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function toArray(value) {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null && String(item).trim() !== '') : [value]
}

/** Translate provider-side task failures into actionable next steps. */
function providerFailureHint(message) {
  const text = String(message || '')
  if (/adaptive/i.test(text) && /not supported/i.test(text)) {
    return '参考生视频在部分分辨率下不支持 adaptive；显式指定 ratio（如 16:9）后重新提交。'
  }
  if (/sensitive|content safety|1026/i.test(text)) return '换个描述或参考图。'
  return ''
}

function mapH3Status(status) {  const value = String(status || '').toLowerCase()
  if (value === 'succeeded') return 'succeeded'
  if (value === 'failed') return 'failed'
  if (value === 'cancelled' || value === 'canceled') return 'cancelled'
  if (value === 'queued') return 'queued'
  if (value === 'running' || value === 'processing') return 'running'
  return value || 'running'
}

function mapLegacyStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'success') return 'succeeded'
  if (value === 'fail' || value === 'failed') return 'failed'
  if (value === 'queueing' || value === 'queued') return 'queued'
  return 'running'
}

function legacyImageItems(payload) {
  const urls = payload?.data?.image_urls
  if (Array.isArray(urls)) return urls.map((url) => ({ url }))
  const base64 = payload?.data?.image_base64
  if (Array.isArray(base64)) return base64.map((b64) => ({ b64_json: b64 }))
  return []
}

function guessVideoFormat(file) {
  const ext = path.extname(file).toLowerCase()
  return ext === '.mov' ? 'mov' : 'mp4'
}

function guessAudioFormat(file) {
  const ext = path.extname(file).toLowerCase()
  return ext === '.wav' ? 'wav' : 'mp3'
}

/** Split the structured H3-Context-IR prompt into its named sections. */
export function splitEnhancedPrompt(prompt) {
  const text = String(prompt || '')
  const sections = {}
  const pattern = /(integrated_multimodal_description|overall_soundscape|non_diegetic_music)\s*:\s*/g
  const matches = [...text.matchAll(pattern)]
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    sections[matches[i][1]] = text.slice(start, end).trim()
  }
  return sections
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new MinimaxError('已取消。', { code: 'ABORTED' }))
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new MinimaxError('已取消。', { code: 'ABORTED' }))
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}
