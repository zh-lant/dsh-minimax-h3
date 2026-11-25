/**
 * Host half of dsh-minimax-h3.
 *
 * Registers the six `minimax_h3_*` tools and one same-origin JSON/media route
 * used by the Client half (settings page, dock, detail popover, result cards).
 * All media work goes through media.js; all money estimates through ledger.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Store, resolveDataDir, dshHome } from './store.js'
import { Ledger } from './ledger.js'
import { createClient, MinimaxError, keyShapeHint } from './api.js'
import {
  MediaService,
  IMAGE_MODELS,
  VIDEO_MODELS,
  RATIOS,
  VIDEO_RATIOS,
  IMAGE_AREAS,
  IMAGE_FORMATS,
  VIDEO_RESOLUTIONS,
  validateImageBytes,
} from './media.js'

export const name = 'minimax-h3'
export const inject = ['tools']

const ROUTE_PREFIX = '/dsh-minimax-h3'
const MAX_BODY_BYTES = 90 * 1024 * 1024

function text(content) {
  return [{ type: 'text', text: String(content) }]
}

function sessionOf(exec) {
  return String(exec?.agent?.id ?? 'global')
}

function cardMeta(kind, task, extra = {}) {
  return { card: 'minimax-h3', kind, task, ok: true, ...extra }
}

function toolOutput(kind, summarize) {
  return {
    schema: { type: 'object', additionalProperties: true },
    render(_args, value) {
      return text(summarize(value))
    },
    presentationMeta(_args, value) {
      return cardMeta(kind, value?.task ?? null, { message: value?.message ?? '' })
    },
  }
}

function describeTask(task) {
  if (!task) return '没有任务记录。'
  const lines = [`${task.id}  ${task.kind}  ${task.status}  ${task.model}`]
  if (task.prompt) lines.push(`prompt: ${task.prompt.length > 160 ? `${task.prompt.slice(0, 160)}…` : task.prompt}`)
  if (task.provider?.taskId) lines.push(`服务端任务: ${task.provider.taskId}（${task.provider.status ?? ''}）`)
  if (task.params?.duration) lines.push(`时长: ${task.params.duration}s  分辨率: ${task.params.resolution}  比例: ${task.params.ratio}`)
  if (task.files?.length) {
    for (const file of task.files) lines.push(`文件: ${file.path}${file.width ? `  ${file.width}×${file.height}` : ''}`)
  }
  if (task.failures?.length) lines.push(`失败张: ${task.failures.map((f) => `${f.index + 1}(${f.code})`).join(', ')}`)
  if (task.error) lines.push(`错误: ${task.error.message}${task.error.hint ? ` — ${task.error.hint}` : ''}`)
  if (task.cost) lines.push(`本次估算: ¥${Number(task.cost).toFixed(2)}`)
  if (task.enhance?.prompt) lines.push(`增强提示词:\n${task.enhance.prompt}`)
  return lines.join('\n')
}

const params = {
  model: (allowed) => ({ type: 'string', enum: allowed, description: '模型；省略时用设置页选中的模型。' }),
  prompt: { type: 'string', description: '画面描述（prompt）。' },
  aspectRatio: {
    type: 'string',
    enum: RATIOS,
    description: '输出宽高比，顺序固定 9:16 / 16:9 / 21:9 / 1:1 / 4:3 / 3:4。',
  },
  area: { type: 'string', enum: IMAGE_AREAS, description: '面积档；实际宽高由服务端按比例计算。image-01 没有面积档。' },
  n: { type: 'integer', minimum: 1, maximum: 10, description: '生成张数；image-01 最多 9 张，H3 最多 10 张。' },
  format: { type: 'string', enum: IMAGE_FORMATS, description: '输出格式；image-01 固定 jpg。' },
  enhance: { type: 'boolean', description: '是否开启 Prompt 增强；图生图始终增强。' },
  images: {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    maxItems: 16,
    description: '参考图 1–16 张；每项为本地绝对路径、公网 URL、对话附件 sha256:<hex> 或上一条生成结果路径。本地文件先校验尺寸与体积。',
  },
  mode: { type: 'string', enum: ['text', 'frames', 'reference'], description: 'text=文生视频；frames=首尾帧；reference=参考生视频。三种模式互斥。' },
  resolution: { type: 'string', enum: VIDEO_RESOLUTIONS, description: '视频分辨率。H3 支持 2K；Highspeed/Lite/Max 只到 768P；Hailuo 用 768P/1080P。' },
  duration: { type: 'integer', minimum: 1, maximum: 15, description: '视频时长（秒）。H3 4–15；Hailuo 只支持 6 或 10。' },
  ratio: { type: 'string', enum: VIDEO_RATIOS, description: '视频比例。文生视频必填且不能 adaptive；首尾帧强制 adaptive；参考生视频默认 adaptive，若接口在该分辨率拒绝 adaptive，请显式传 16:9 等具体比例。' },
  audio: { type: 'boolean', description: '是否生成带音频的视频（generate_audio）。' },
  firstFrame: { type: 'string', description: '首帧：本地路径 / URL / sha256 附件 / 上一条生成结果。首尾帧模式必填。' },
  lastFrame: { type: 'string', description: '尾帧，可选；与首帧一起让视频在两者之间过渡。' },
  referenceImages: { type: 'array', items: { type: 'string' }, maxItems: 9, description: '参考图 ≤9 张（参考生视频）。' },
  referenceVideos: { type: 'array', items: { type: 'string' }, maxItems: 3, description: '参考视频 ≤3 段，每段 2–15 秒，总长 ≤15 秒。' },
  referenceAudios: { type: 'array', items: { type: 'string' }, maxItems: 3, description: '参考音频 ≤3 段，每段 2–15 秒；不能单独使用。' },
  taskId: { type: 'string', description: 'minimax_h3_video 返回的任务 ID；省略时取本会话最近一条任务。' },
}

/** Build the Host half. Kept exportable so the self-test can mount it without Cordis. */
export function createHost(config, ctx, { log = () => {}, fetchImpl, resolveKey: resolveKeyOverride } = {}) {
  const normalized = config && typeof config === 'object' ? config : {}
  const store = new Store(resolveDataDir(normalized), { log })
  store.init(normalized)
  const ledger = new Ledger(store, { log }).init()

  const getCredentials = () => {
    try {
      return ctx?.get?.('credentials') ?? undefined
    } catch {
      return undefined
    }
  }
  const getAttachments = () => {
    try {
      return ctx?.get?.('attachments') ?? undefined
    } catch {
      return undefined
    }
  }

  async function resolveKey() {
    if (resolveKeyOverride) return resolveKeyOverride()
    const ref = store.getSettings().connection.apiKeyEnv || 'MINIMAX_API_KEY'
    const credentials = getCredentials()
    if (credentials && typeof credentials.resolve === 'function') {
      try {
        const resolved = await credentials.resolve(ref)
        if (resolved?.value) return resolved.value
      } catch (error) {
        log('credential resolve failed', error)
      }
    }
    return process.env[ref] || ''
  }

  const media = new MediaService({
    store,
    ledger,
    client: createClient({ getSettings: () => store.getSettings(), resolveKey, fetchImpl, log }),
    attachments: getAttachments(),
    log,
    fetchImpl,
  })

  const tools = createTools({ store, ledger, media, log })
  const baseClient = media.client
  return {
    store,
    ledger,
    media,
    tools,
    resolveKey,
    client: baseClient,
    testWith(connection, apiKey) {
      const client = createClient({
        getSettings: () => ({
          ...store.getSettings(),
          connection: { ...store.getSettings().connection, ...(connection || {}) },
        }),
        resolveKey: async () => (apiKey ? String(apiKey) : resolveKey()),
        log,
      })
      return client.testConnection()
    },
    ctx,
  }
}

function createTools({ store, ledger, media, log }) {
  const sessionOfExec = sessionOf

  const imageTool = {
    name: 'minimax_h3_image',
    description:
      'MiniMax H3 文生图（同步）。返回落盘文件、实际尺寸与本次估算费用。接口非幂等：超时或失败都不要自动重试，重试会重复计费。',
    parameters: {
      type: 'object',
      properties: {
        prompt: params.prompt,
        model: params.model(IMAGE_MODELS),
        aspectRatio: params.aspectRatio,
        area: params.area,
        n: params.n,
        format: params.format,
        enhance: params.enhance,
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: toolOutput('image', (value) => {
      const task = value?.task
      if (!task) return value?.message || '没有结果。'
      const lines = [`已生成 ${task.files.length} 张（${task.model} · ${task.params.aspectRatio} · ${task.params.area ?? '—'}）`]
      for (const file of task.files) lines.push(`${file.path}  ${file.width}×${file.height}  ${(file.bytes / 1024).toFixed(0)} KB`)
      if (task.params.actualSize) lines.push(`实际输出 ${task.params.actualSize}；与所选比例${task.params.ratioMatch === false ? '不一致' : '一致'}。`)
      if (task.failures.length) lines.push(`部分失败：${task.failures.map((f) => `#${f.index + 1} ${f.code} ${f.message}`).join('；')}`)
      lines.push(`估算费用 ¥${task.cost.toFixed(2)}。同步接口最长等 600 秒，非幂等。`)
      return lines.join('\n')
    }),
    timeoutMs: 660000,
    isConcurrencySafe: () => false,
    presentCall: () => ({ card: 'generic', title: 'MiniMax H3 文生图', kind: 'other' }),
    async execute(args, exec) {
      const task = await media.generateImage(args || {}, { sessionId: sessionOfExec(exec), signal: exec.signal })
      return { ok: true, task, message: `已生成 ${task.files.length} 张` }
    },
  }

  const editTool = {
    name: 'minimax_h3_edit_image',
    description:
      'MiniMax H3 图生图 / 编辑（同步）。参考图顺序即 <Picture N>，始终开启提示词增强；不支持 mask。接口非幂等，不要自动重试。',
    parameters: {
      type: 'object',
      properties: {
        prompt: params.prompt,
        model: params.model(IMAGE_MODELS.filter((model) => model !== 'image-01')),
        images: params.images,
        aspectRatio: params.aspectRatio,
        area: params.area,
        n: params.n,
        format: params.format,
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: toolOutput('image', (value) => value?.task ? describeTask(value.task) : value?.message || '没有结果。'),
    timeoutMs: 660000,
    isConcurrencySafe: () => false,
    presentCall: () => ({ card: 'generic', title: 'MiniMax H3 图生图', kind: 'other' }),
    async execute(args, exec) {
      const task = await media.editImage(args || {}, { sessionId: sessionOfExec(exec), signal: exec.signal })
      return { ok: true, task, message: `已生成 ${task.files.length} 张` }
    },
  }

  const videoTool = {
    name: 'minimax_h3_video',
    description:
      '提交 MiniMax 视频任务（异步，立即返回 task_id）。mode=text 文生视频；mode=frames 首尾帧（ratio 强制 adaptive）；mode=reference 参考生视频。首尾帧与参考素材互斥。用 minimax_h3_media_status 取回结果。',
    parameters: {
      type: 'object',
      properties: {
        prompt: params.prompt,
        mode: params.mode,
        model: params.model(VIDEO_MODELS),
        resolution: params.resolution,
        duration: params.duration,
        ratio: params.ratio,
        audio: params.audio,
        firstFrame: params.firstFrame,
        lastFrame: params.lastFrame,
        referenceImages: params.referenceImages,
        referenceVideos: params.referenceVideos,
        referenceAudios: params.referenceAudios,
      },
      required: ['prompt', 'mode'],
      additionalProperties: false,
    },
    output: toolOutput('video', (value) => {
      const task = value?.task
      if (!task) return value?.message || '没有结果。'
      return `任务已提交：${task.provider?.taskId}\n${describeTask(task)}\n用 minimax_h3_media_status(taskId) 取回结果；按秒计费。`
    }),
    timeoutMs: 180000,
    isConcurrencySafe: () => false,
    presentCall: () => ({ card: 'generic', title: '提交 MiniMax 视频任务', kind: 'other' }),
    async execute(args, exec) {
      const task = await media.submitVideo(args || {}, { sessionId: sessionOfExec(exec), signal: exec.signal })
      const view = media.view(task)
      return {
        ok: true,
        task: view,
        message: `任务 ${view.provider?.taskId} 已提交（${view.params.duration}s · ${view.params.resolution} · ${view.params.ratio}）`,
      }
    },
  }

  const statusTool = {
    name: 'minimax_h3_media_status',
    description:
      '查询或下载本会话的媒体任务。视频成功后自动下载到数据目录；action=download 只重试下载，不会重新提交或重复计费。',
    parameters: {
      type: 'object',
      properties: {
        taskId: params.taskId,
        action: { type: 'string', enum: ['query', 'download'], description: 'query=查任务并自动取回；download=只重试下载。' },
      },
      additionalProperties: false,
    },
    output: toolOutput('status', (value) => value?.task ? describeTask(value.task) : value?.message || '没有结果。'),
    timeoutMs: 240000,
    isConcurrencySafe: () => true,
    presentCall: () => ({ card: 'generic', title: '查询 MiniMax 媒体任务', kind: 'other' }),
    async execute(args, exec) {
      const sessionId = sessionOfExec(exec)
      const action = args?.action === 'download' ? 'download' : 'query'
      let taskId = args?.taskId
      if (!taskId) {
        const latest = store.tasks(sessionId)[0]
        if (!latest) throw new MinimaxError('本会话还没有媒体任务。', { code: 'NO_TASK' })
        taskId = latest.id
      }
      const task = await media.refresh(sessionId, String(taskId), action, { signal: exec.signal })
      return { ok: true, task, message: task ? `状态 ${task.status}` : '' }
    },
  }

  const listTool = {
    name: 'minimax_h3_media_list',
    description: '列出本会话的 MiniMax 媒体任务（图片 / 视频 / 提示词增强），含状态、文件路径与估算费用。',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['image', 'video', 'enhance'], description: '只看某一类任务。' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: '返回条数，默认 20。' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render(_args, value) {
        const tasks = value?.tasks || []
        if (!tasks.length) return text('本会话没有任务记录。')
        return text(
          tasks
            .map(
              (task) =>
                `${task.id}  ${task.kind}  ${task.status}  ${(task.files || []).length} 文件  ¥${Number(task.cost || 0).toFixed(2)}  ${task.prompt?.slice(0, 60) ?? ''}`,
            )
            .join('\n'),
        )
      },
      presentationMeta(_args, value) {
        return { card: 'minimax-h3', kind: 'list', tasks: value?.tasks || [], ok: true }
      },
    },
    isConcurrencySafe: () => true,
    presentCall: () => ({ card: 'generic', title: '列出 MiniMax 媒体任务', kind: 'other' }),
    async execute(args) {
      const tasks = media.list(sessionOfExec(args?.__exec), { kind: args?.kind, limit: args?.limit })
      return { ok: true, tasks }
    },
  }

  const enhanceTool = {
    name: 'minimax_h3_enhance_prompt',
    description:
      '用 H3-Context-IR 把一句话扩展成结构化视频提示词（integrated_multimodal_description / overall_soundscape / non_diegetic_music）。只返回提示词，不出片。',
    parameters: {
      type: 'object',
      properties: {
        prompt: params.prompt,
        duration: { type: 'integer', minimum: 4, maximum: 15, description: '目标视频时长，影响结构化描述。' },
        ratio: { type: 'string', enum: RATIOS, description: '目标比例（不能 adaptive）。' },
        firstFrame: { type: 'string', description: '可选首帧参考，参与上下文理解。' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: toolOutput('enhance', (value) => {
      const task = value?.task
      if (!task?.enhance?.prompt) return value?.message || '没有增强结果。'
      return `${task.enhance.prompt}\n\n（tokens ${task.enhance.tokens}；估算 ¥${task.cost.toFixed(2)}）`
    }),
    timeoutMs: 300000,
    isConcurrencySafe: () => false,
    presentCall: () => ({ card: 'generic', title: 'H3-Context-IR 提示词增强', kind: 'other' }),
    async execute(args, exec) {
      const task = await media.enhancePrompt(args || {}, { sessionId: sessionOfExec(exec), signal: exec.signal })
      return { ok: true, task, message: '提示词已增强' }
    },
  }

  return [imageTool, editTool, videoTool, statusTool, listTool, enhanceTool]
}

/** Register every tool on the live registry, disposing with the plugin fiber. */
function registerTools(ctx, tools) {
  const disposers = []
  for (const definition of tools) {
    // media_list needs the calling session only for its scope; the execute
    // argument is injected by the wrapper below.
    const definitionWithSession = definition.name === 'minimax_h3_media_list'
      ? { ...definition, execute: async (args, exec) => definition.execute({ __exec: exec, ...(args || {}) }) }
      : definition
    disposers.push(ctx.tools.register(definitionWithSession))
  }
  return disposers
}

// ------------------------------------------------------------------ HTTP

function isLoopbackHostname(hostname) {
  const value = String(hostname || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (value === 'localhost' || value === '::1' || value.endsWith('.localhost')) return true
  return /^127(\.\d{1,3}){3}$/.test(value) && value.split('.').every((part) => Number(part) <= 255)
}

function requestAllowed(req, origin) {
  try {
    const own = new URL(origin)
    const host = String(req.headers.host || '')
    if (!host) return false
    const hostname = host.replace(/:\d+$/, '')
    if (host !== own.host && !isLoopbackHostname(hostname)) return false
    if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false
    const requestOrigin = req.headers.origin
    if (requestOrigin && requestOrigin !== 'null') {
      const other = new URL(requestOrigin)
      const ownPort = own.port || (own.protocol === 'https:' ? '443' : '80')
      const otherPort = other.port || (other.protocol === 'https:' ? '443' : '80')
      const sameAuthority = other.host === own.host
      // localhost and 127.0.0.1 are the same DSH instance; accept the alias.
      const loopbackAlias = isLoopbackHostname(other.hostname) && isLoopbackHostname(own.hostname) && otherPort === ownPort
      if (!sameAuthority && !loopbackAlias) return false
    }
    return true
  } catch {
    return false
  }
}

function json(res, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new MinimaxError('请求体过大。', { code: 'BODY_TOO_LARGE' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new MinimaxError('请求体不是 JSON。', { code: 'BAD_JSON' }))
      }
    })
    req.on('error', reject)
  })
}

function sanitizeSettings(settings) {
  return {
    ...settings,
    connection: { ...settings.connection },
  }
}

function statePayload({ store, ledger, media, origin, sessionId, balance }) {
  const settings = store.getSettings()
  return {
    ok: true,
    settings: sanitizeSettings(settings),
    dataDir: store.dataDir,
    origin,
    ratios: RATIOS,
    videoRatios: VIDEO_RATIOS,
    imageModels: IMAGE_MODELS,
    videoModels: VIDEO_MODELS,
    areas: IMAGE_AREAS,
    formats: IMAGE_FORMATS,
    resolutions: VIDEO_RESOLUTIONS,
    balance,
    tasks: media.list(sessionId, { limit: 30 }),
    pending: store.readPending(sessionId),
    pricing: settings.pricing,
  }
}

/** Balance view; admin-key mode asks the platform on each read. */
async function balancePayload(host, ledger, sessionId) {
  const status = ledger.status(sessionId)
  if (status.source === 'admin-key') {
    const live = await host.client.adminBalance()
    if (live.ok && live.balance !== null) {
      status.current = Number(Number(live.balance).toFixed(2))
      status.live = true
    } else {
      status.liveError = live
    }
  }
  return status
}

function maskKey(value) {
  const text = String(value || '')
  if (text.length <= 8) return '••••'
  return `${text.slice(0, 4)}••••${text.slice(-4)}`
}

/** Key presence for the settings form; never returns the secret itself. */
async function describeKey(host, store) {
  const ref = store.getSettings().connection.apiKeyEnv || 'MINIMAX_API_KEY'
  const credentials = host.ctx?.get?.('credentials')
  if (credentials && typeof credentials.describe === 'function') {
    try {
      const info = await credentials.describe(ref)
      return { ref, configured: Boolean(info.configured), source: info.source, writable: info.writable, masked: info.masked }
    } catch (error) {
      console.warn('[minimax-h3] credential describe failed', error)
    }
  }
  const env = process.env[ref]
  return {
    ref,
    configured: Boolean(env),
    source: env ? 'environment' : undefined,
    writable: false,
    masked: env ? maskKey(env) : undefined,
  }
}

function findTaskAnywhere(store, taskId) {
  for (const key of store.sessionIds()) {
    const tasks = store.tasksByKey(key)
    const task = tasks.find((entry) => entry.id === taskId)
    if (task) return task
  }
  return undefined
}

function realPathInside(file, roots) {
  try {
    const real = fs.realpathSync(path.resolve(String(file || '')))
    const stat = fs.statSync(real)
    if (!stat.isFile()) return ''
    for (const root of roots) {
      let realRoot
      try {
        realRoot = fs.realpathSync(path.resolve(root))
      } catch {
        continue
      }
      if (real === realRoot || real.startsWith(realRoot + path.sep)) return real
    }
  } catch {}
  return ''
}

function serveFile(req, res, store, taskId, index) {
  const task = findTaskAnywhere(store, taskId)
  if (!task) return json(res, 404, { ok: false, error: '任务不存在' })
  const file = task.files?.[Number(index)]
  if (!file || !file.path) return json(res, 404, { ok: false, error: '文件不存在' })
  const resolved = realPathInside(file.path, [store.mediaRoot])
  if (!resolved) return json(res, 403, { ok: false, error: '路径越界或文件缺失' })
  return serveResolvedFile(req, res, resolved)
}

function serveRefFile(req, res, store, file) {
  const resolved = realPathInside(file, [store.refsDir, store.mediaRoot])
  if (!resolved) return json(res, 403, { ok: false, error: '参考文件不存在' })
  return serveResolvedFile(req, res, resolved)
}

function serveResolvedFile(req, res, resolved) {
  const stat = fs.statSync(resolved)
  if (!stat.isFile()) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('not a file')
  }
  const ext = path.extname(resolved).toLowerCase()
  const type =
    ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif'
            : ext === '.mp4' ? 'video/mp4'
              : ext === '.m4v' ? 'video/mp4'
                : ext === '.mov' ? 'video/quicktime'
                  : ext === '.webm' ? 'video/webm'
                    : ext === '.mp3' ? 'audio/mpeg'
                      : ext === '.wav' ? 'audio/wav'
                        : ext === '.heic' ? 'image/heic'
                          : 'image/jpeg'
  const range = req.headers.range
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=60',
  }
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    const start = match && match[1] ? Number(match[1]) : 0
    const end = match && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1
    if (!match || start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
      return res.end()
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
    })
    fs.createReadStream(resolved, { start, end }).on('error', () => res.destroy()).pipe(res)
    return
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size })
  fs.createReadStream(resolved).on('error', () => res.destroy()).pipe(res)
}

function openWithDefaultApp(file, log) {
  const resolved = path.resolve(String(file || ''))
  if (!fs.existsSync(resolved)) throw new MinimaxError('文件不存在。', { code: 'FILE_NOT_FOUND' })
  const platform = process.platform
  const command = platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open'
  const args = [resolved]
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', (error) => log('open failed', error))
    child.unref()
    return { ok: true, path: resolved }
  } catch (error) {
    throw new MinimaxError(`无法打开文件：${error instanceof Error ? error.message : String(error)}`, { code: 'OPEN_FAILED' })
  }
}

export function createRouteHandler(host, { origin }) {
  const { store, ledger, media, resolveKey } = host
  const credentials = () => host.ctx?.get?.('credentials')
  return async function handler(req, res) {
    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname
    if (!requestAllowed(req, origin)) return json(res, 403, { ok: false, error: '拒绝跨站访问' })
    try {
      if (req.method === 'GET' && pathname.startsWith(`${ROUTE_PREFIX}/file/`)) {
        const rest = pathname.slice(`${ROUTE_PREFIX}/file/`.length).split('/')
        return serveFile(req, res, store, decodeURIComponent(rest[0] || ''), rest[1] || '0')
      }
      if (req.method === 'GET' && pathname === `${ROUTE_PREFIX}/ref-file`) {
        return serveRefFile(req, res, store, url.searchParams.get('path') || '')
      }
      if (req.method === 'GET' && pathname === `${ROUTE_PREFIX}/state`) {
        const sessionId = url.searchParams.get('sessionId') || ''
        const key = await describeKey(host, store)
        const balance = await balancePayload(host, ledger, sessionId)
        return json(res, 200, { ...statePayload({ store, ledger, media, origin, sessionId, balance }), key })
      }
      if (req.method === 'GET' && pathname === `${ROUTE_PREFIX}/task`) {
        const sessionId = url.searchParams.get('sessionId') || ''
        const taskId = url.searchParams.get('taskId') || ''
        const task = store.findTask(sessionId, taskId)
        return json(res, 200, { ok: true, task: task ? media.view(task) : null })
      }
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' })
      const body = await readBody(req)
      const sessionId = String(body.sessionId || '')
      if (pathname === `${ROUTE_PREFIX}/settings`) {
        const incoming = body.settings && typeof body.settings === 'object' ? body.settings : {}
        if (incoming.connection) {
          if (incoming.connection.plan !== undefined && !['payg-cn', 'payg-global', 'custom'].includes(incoming.connection.plan)) {
            return json(res, 400, { ok: false, error: '接入方式不合法' })
          }
          if (incoming.connection.timeoutMs !== undefined) {
            const timeout = Number(incoming.connection.timeoutMs)
            if (!Number.isFinite(timeout) || timeout < 1000) return json(res, 400, { ok: false, error: 'timeoutMs 必须是 ≥1000 的数字' })
            incoming.connection.timeoutMs = Math.round(timeout)
          }
        }
        for (const key of ['imagePerCall', 'videoPerSecond', 'enhancePer1kTokens']) {
          if (incoming.pricing?.[key] !== undefined) {
            const value = Number(incoming.pricing[key])
            if (!Number.isFinite(value) || value < 0) return json(res, 400, { ok: false, error: '单价必须是非负数字' })
            incoming.pricing[key] = value
          }
        }
        if (incoming.balance?.current !== undefined) {
          const value = Number(incoming.balance.current)
          if (!Number.isFinite(value)) return json(res, 400, { ok: false, error: '当前余额必须是数字' })
          incoming.balance.current = value
        }
        if (incoming.alert?.threshold !== undefined) {
          const value = Number(incoming.alert.threshold)
          if (!Number.isFinite(value)) return json(res, 400, { ok: false, error: '预警阈值必须是数字（不做范围校验）' })
          incoming.alert.threshold = value
        }
        const apiKey = String(body.apiKey || '').trim()
        let keySaved = false
        if (apiKey) {
          if (/^\d{6,}$/.test(apiKey)) {
            return json(res, 400, { ok: false, error: keyShapeHint(apiKey) })
          }
          const credentialsService = credentials()
          if (!credentialsService || typeof credentialsService.set !== 'function') {
            return json(res, 400, { ok: false, error: '当前 profile 没有凭据服务，无法安全保存 Key。' })
          }
          await credentialsService.set(store.getSettings().connection.apiKeyEnv || 'MINIMAX_API_KEY', apiKey)
          keySaved = true
        }
        store.saveSettings(incoming)
        if (incoming.balance?.current !== undefined) {
          // Re-anchoring is a user action; saving unrelated fields must not
          // move the anchor and silently drop earlier spend from the balance.
          const before = Number(ledger.state.anchor)
          if (Number(incoming.balance.current) !== before) ledger.setAnchor(incoming.balance.current)
        }
        if (incoming.alert) ledger.setAlert(incoming.alert)
        const balance = await balancePayload(host, ledger, sessionId)
        const keyInfo = await describeKey(host, store)
        return json(res, 200, { ...statePayload({ store, ledger, media, origin, sessionId, balance }), key: keyInfo, keySaved })
      }
      if (pathname === `${ROUTE_PREFIX}/test`) {
        const result = await host.testWith(body.connection, body.apiKey)
        return json(res, 200, result)
      }
      if (pathname === `${ROUTE_PREFIX}/balance`) {
        if (body.current !== undefined) ledger.setAnchor(body.current)
        if (body.enabled !== undefined || body.threshold !== undefined) ledger.setAlert({ enabled: body.enabled, threshold: body.threshold })
        if (body.source !== undefined) store.saveSettings({ balance: { source: String(body.source) } })
        const status = await balancePayload(host, ledger, sessionId)
        return json(res, 200, { ok: true, balance: status })
      }
      if (pathname === `${ROUTE_PREFIX}/generate`) {
        const kind = String(body.kind || '')
        let task
        if (kind === 'image') task = await media.generateImage(body, { sessionId })
        else if (kind === 'edit') task = await media.editImage(body, { sessionId })
        else if (kind === 'video') task = media.view(await media.submitVideo(body, { sessionId }))
        else return json(res, 400, { ok: false, error: 'kind 只能是 image / edit / video' })
        return json(res, 200, { ok: true, task })
      }
      if (pathname === `${ROUTE_PREFIX}/upload-ref`) {
        const data = String(body.data || '')
        const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data
        if (!base64) return json(res, 400, { ok: false, error: '没有文件内容' })
        const bytes = Buffer.from(base64, 'base64')
        if (!bytes.length) return json(res, 400, { ok: false, error: '文件为空' })
        const kind = String(body.kind || 'image')
        if (kind === 'image') {
          if (bytes.length > 64 * 1024 * 1024) return json(res, 400, { ok: false, error: '文件超过 64 MB' })
          const sniffed = validateImageBytes(new Uint8Array(bytes), '本地参考图')
          const file = store.saveRefBytes(body.name || `ref.${sniffed.format}`, bytes)
          return json(res, 200, { ok: true, path: file, width: sniffed.width, height: sniffed.height, format: sniffed.format })
        }
        if (bytes.length > 50 * 1024 * 1024) return json(res, 400, { ok: false, error: '媒体文件超过 50 MB；改用公网 URL' })
        const file = store.saveRefBytes(body.name || 'ref.bin', bytes)
        return json(res, 200, { ok: true, path: file })
      }
      if (pathname === `${ROUTE_PREFIX}/action`) {
        const action = String(body.action || '')
        if (action === 'open') {
          const file = String(body.path || '')
          const resolved = path.resolve(file)
          const roots = [path.resolve(store.dataDir), path.resolve(dshHome(), 'attachments')]
          if (!roots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
            return json(res, 403, { ok: false, error: '只能打开插件数据目录内的文件' })
          }
          return json(res, 200, openWithDefaultApp(resolved, (...values) => console.warn('[minimax-h3]', ...values)))
        }
        if (action === 'open-folder') {
          const file = String(body.path || '')
          const resolved = path.resolve(file)
          const roots = [path.resolve(store.dataDir), path.resolve(dshHome(), 'attachments')]
          const folder = path.dirname(resolved)
          if (!roots.some((root) => folder === root || folder.startsWith(root + path.sep))) {
            return json(res, 403, { ok: false, error: '只能打开插件数据目录内的文件所在文件夹' })
          }
          return json(res, 200, openWithDefaultApp(folder, (...values) => console.warn('[minimax-h3]', ...values)))
        }
        if (action === 'status' || action === 'download') {
          const task = await media.refresh(sessionId, String(body.taskId || ''), action === 'download' ? 'download' : 'query')
          return json(res, 200, { ok: true, task })
        }
        if (action === 'enhance') {
          const task = await media.enhancePrompt(
            {
              prompt: String(body.prompt || ''),
              duration: body.duration,
              ratio: body.ratio,
              firstFrame: body.firstFrame,
            },
            { sessionId },
          )
          return json(res, 200, { ok: true, task })
        }
        if (action === 'regenerate') {
          const task = store.findTask(sessionId, String(body.taskId || ''))
          if (!task) return json(res, 404, { ok: false, error: '任务不存在' })
          if (task.kind === 'video') {
            const params = task.params || {}
            const source = params.source || {}
            const base = {
              prompt: task.prompt,
              model: task.model,
              resolution: params.resolution,
              duration: params.duration,
              ratio: params.ratio,
              audio: params.audio,
            }
            let next
            if (params.mode === 'frames') {
              if (!source.firstFrame) {
                return json(res, 400, { ok: false, error: '这条首尾帧任务没有保存原始素材，无法重试；请重新提交。' })
              }
              next = await media.submitVideo(
                { ...base, mode: 'frames', firstFrame: source.firstFrame, lastFrame: source.lastFrame || '' },
                { sessionId },
              )
            } else if (params.mode === 'reference') {
              const images = Array.isArray(source.images) ? source.images : []
              const videos = Array.isArray(source.videos) ? source.videos : []
              const audios = Array.isArray(source.audios) ? source.audios : []
              if (!images.length && !videos.length && !audios.length) {
                return json(res, 400, { ok: false, error: '这条参考任务没有保存原始素材，无法重试；请重新提交。' })
              }
              next = await media.submitVideo(
                {
                  ...base,
                  mode: 'reference',
                  referenceImages: images,
                  referenceVideos: videos,
                  referenceAudios: audios,
                },
                { sessionId },
              )
            } else if (params.mode === 'text') {
              next = await media.submitVideo({ ...base, mode: 'text' }, { sessionId })
            } else {
              return json(res, 400, { ok: false, error: '这条视频任务缺少模式信息，无法重试；请重新提交。' })
            }
            return json(res, 200, { ok: true, task: media.view(next) })
          }
          if (task.kind !== 'image') return json(res, 400, { ok: false, error: '只有图片或文生视频任务可以重新生成。' })
          const params = task.params || {}
          const next = params.mode === 'edit'
            ? await media.editImage(
              {
                prompt: task.prompt,
                model: task.model,
                images: params.sourceRefs || [],
                aspectRatio: params.aspectRatio,
                area: params.area,
                n: params.n,
                format: params.format,
              },
              { sessionId },
            )
            : await media.generateImage(
              {
                prompt: task.prompt,
                model: task.model,
                aspectRatio: params.aspectRatio,
                area: params.area,
                n: params.n,
                format: params.format,
                enhance: params.enhance,
              },
              { sessionId },
            )
          return json(res, 200, { ok: true, task: next })
        }
        if (action === 'select') {
          const kind = body.kind === 'reference' ? 'references' : 'firstFrame'
          const file = String(body.path || '')
          if (!file) return json(res, 400, { ok: false, error: '缺少路径' })
          const pending = store.updatePending(sessionId, kind === 'references' ? { references: [file] } : { firstFrame: file })
          return json(res, 200, { ok: true, pending })
        }
        if (action === 'delete') {
          const task = store.findTask(sessionId, String(body.taskId || ''))
          if (!task) return json(res, 404, { ok: false, error: '任务不存在' })
          const paths = new Set((task.files || []).map((file) => file.path).filter(Boolean))
          const removed = store.deleteTask(sessionId, task.id, { deleteFiles: body.deleteFiles === true })
          if (!removed) return json(res, 404, { ok: false, error: '任务不存在' })
          const pending = store.readPending(sessionId)
          const patch = {}
          if (pending.firstFrame && paths.has(pending.firstFrame)) patch.firstFrame = ''
          if (pending.lastFrame && paths.has(pending.lastFrame)) patch.lastFrame = ''
          if (Array.isArray(pending.references) && pending.references.some((file) => paths.has(file))) {
            patch.references = pending.references.filter((file) => !paths.has(file))
          }
          if (Object.keys(patch).length) store.updatePending(sessionId, patch)
          return json(res, 200, { ok: true })
        }
        if (action === 'clear-pending') {
          store.clearPending(sessionId)
          return json(res, 200, { ok: true })
        }
        if (action === 'clear-local') {
          store.clearLocal()
          ledger.clearSpend()
          return json(res, 200, { ok: true })
        }
        return json(res, 400, { ok: false, error: `未知操作 ${action}` })
      }
      return json(res, 404, { ok: false, error: 'Not found' })
    } catch (error) {
      const status = error instanceof MinimaxError && error.status ? error.status : 400
      return json(res, status, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        code: error?.code || '',
        hint: error?.hint || '',
      })
    }
  }
}

// ------------------------------------------------------------------ plugin

export function apply(ctx, config) {
  const host = createHost(config || {}, ctx, { log: (...values) => console.warn('[minimax-h3]', ...values) })
  host.ctx = ctx
  const toolDisposers = []
  try {
    if (ctx.get?.('tools')) toolDisposers.push(...registerTools(ctx, host.tools))
  } catch (error) {
    console.warn('[minimax-h3] tool registration failed', error)
  }
  ctx.effect?.(() => () => {
    for (const dispose of toolDisposers) {
      try {
        dispose()
      } catch {}
    }
  })

  // The browser route is optional so the Host half still works in profiles
  // without the Web server (for example an ACP session).
  ctx.inject?.(['webServer'], (scope) => {
    try {
      const origin = scope.webServer.getOrigin()
      const dispose = scope.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: createRouteHandler(host, { origin }),
      })
      scope.effect(() => dispose)
    } catch (error) {
      console.warn('[minimax-h3] route registration failed', error)
    }
  })
}
