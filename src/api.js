/**
 * HTTP boundary for the MiniMax media APIs.
 *
 * Submission requests are never retried: the image APIs are non-idempotent
 * and a retry bills a second generation. Downloads are separate helpers and
 * may be retried by the caller.
 */
import fs from 'node:fs'

export class MinimaxError extends Error {  constructor(message, options = {}) {
    super(message)
    this.name = 'MinimaxError'
    this.status = options.status ?? 0
    this.code = options.code ?? ''
    this.hint = options.hint ?? ''
    this.stage = options.stage ?? 'request'
    this.retryable = options.retryable ?? false
    this.body = options.body
  }

  toJSON() {
    return {
      message: this.message,
      status: this.status,
      code: this.code,
      hint: this.hint,
      stage: this.stage,
      retryable: this.retryable,
    }
  }
}

/** Parse the internal numeric code out of MiniMax error copy, e.g. "... (1004)". */
export function extractCode(message) {
  const match = /\((\d{3,4})\)\s*$/.exec(String(message || '').trim())
  return match ? match[1] : ''
}

/** Pull `{message, code}` from every error envelope the API family uses. */
export function parseErrorBody(body) {
  if (body === undefined || body === null) return { message: '', code: '' }
  const data = typeof body === 'string' ? safeJson(body) : body
  if (!data || typeof data !== 'object') return { message: String(body), code: '' }
  if (data.error && typeof data.error === 'object') {
    const message = String(data.error.message || '')
    return { message, code: String(data.error.code || extractCode(message)) }
  }
  if (data.base_resp && typeof data.base_resp === 'object') {
    const code = data.base_resp.status_code
    const message = String(data.base_resp.status_msg || '')
    return { message, code: code === 0 || code === undefined ? '' : String(code) }
  }
  if (data.message || data.status_msg) {
    const message = String(data.message || data.status_msg)
    return { message, code: String(data.code || extractCode(message)) }
  }
  return { message: safeStringify(body), code: '' }
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value).slice(0, 500)
  } catch {
    return String(value).slice(0, 500)
  }
}

const HINTS = {
  1004: '国内 Key 只能配 api.minimaxi.com（国际站同 Key 返回 401）。',
  401: '国内 Key 只能配 api.minimaxi.com（国际站同 Key 返回 401）。',
  1008: '去控制台充值；视频与图片都需要按量付费 Key。',
  402: '去控制台充值；视频与图片都需要按量付费 Key。',
  2053: '积分不足，去控制台充值或更换套餐。',
  2067: '套餐额度已用完，且未开启积分自动消耗。',
  2068: '当前套餐等级不支持该模型。',
  1002: '稍后重试，勿并发；每个请求按张数计入限流。',
  429: '稍后重试，勿并发；每个请求按张数计入限流。',
  1026: '换个描述或参考图；内容未通过安全检查。',
  1027: '换个描述或参考图；生成的图片未通过安全检查。',
  2013: '参数越界，常见于比例、时长、分辨率或张数。原文见上。',
  2062: '与 H3 无关的订阅计划提示，可忽略。',
}

/** Common save mistakes: a numeric GroupId, or a truncated paste. */
export function keyShapeHint(value) {
  const key = String(value || '').trim()
  if (!key) return ''
  if (/^\d{6,}$/.test(key)) {
    return '这串是纯数字，像是 GroupId / 账号 ID，不是 API Key；请到 控制台 → 接口密钥 复制完整的 Key（通常以 eyJ 开头、长度远大于 32）。'
  }
  if (key.length < 32) {
    return 'Key 偏短；MiniMax API Key 通常是控制台里一长串字符（JWT，常以 eyJ 开头）。'
  }
  return ''
}

/** Map an HTTP status plus error envelope to a user-facing failure. */
export function describeFailure(status, body, plan = 'payg-cn') {
  const parsed = parseErrorBody(body)
  const code = parsed.code || String(status || '')
  let message = parsed.message || `HTTP ${status}`
  if (code === '2062' || /not have a subscription/i.test(message)) {
    return { code, message: '', hint: '', ignored: true }
  }
  let hint = HINTS[code] || HINTS[status] || ''
  if (!hint && (status === 400 || code === '2013')) hint = HINTS[2013]
  if (status === 401 || code === '1004' || code === '2049') hint = HINTS[1004]
  if (status === 402 || code === '1008') hint = HINTS[1008]
  if (plan === 'payg-global' && (status === 401 || code === '1004')) {
    hint = '国际站 Key 只能配 api.minimax.io。'
  }
  if (/invalid task_id/i.test(message)) hint = '任务 ID 只能查询最近 7 天内的记录。'
  return { code, message, hint, ignored: false }
}

/** Build every endpoint from one configured base URL. */
export function endpoints(baseURL) {
  const base = String(baseURL || '').trim().replace(/\/+$/, '')
  let origin = base
  try {
    origin = new URL(base).origin
  } catch {
    // Keep the raw string; the request will fail with a clear URL error.
  }
  return {
    base,
    origin,
    images: `${base}/images/generations`,
    edits: `${base}/images/edits`,
    legacyImage: `${base}/image_generation`,
    videoV2: `${origin}/v2/video_generation`,
    videoQuery: (taskId) => `${origin}/v2/query/video_generation/${encodeURIComponent(taskId)}`,
    videoList: `${origin}/v2/query/video_generation`,
    contextIR: `${origin}/v2/h3_context_ir`,
    legacyVideo: `${base}/video_generation`,
    legacyVideoQuery: (taskId) => `${base}/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    legacyFile: (fileId) => `${base}/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    models: `${base}/models`,
    balance: `${base}/account/balance`,
  }
}

function composeSignal(timeoutMs, externalSignal) {
  const controller = new AbortController()
  let timer
  let timedOut = false
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('timeout'))
    }, timeoutMs)
    timer.unref?.()
  }
  const onAbort = () => controller.abort(externalSignal?.reason)
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason)
    else externalSignal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      if (timer) clearTimeout(timer)
      externalSignal?.removeEventListener?.('abort', onAbort)
    },
  }
}

async function readBody(response) {
  const text = await response.text()
  if (!text) return undefined
  return safeJson(text) ?? text
}

/**
 * One attempt. `timeoutMs` is the whole exchange; an abort is reported as a
 * timeout so callers can say "do not retry" for non-idempotent submissions.
 */
export async function requestJson(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 60000,
    signal: outerSignal,
    fetchImpl = globalThis.fetch,
    stage = 'request',
  } = options
  const composed = composeSignal(timeoutMs, outerSignal)
  let response
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: composed.signal,
    })
  } catch (error) {
    if (composed.timedOut()) {
      throw new MinimaxError(
        stage === 'download'
          ? `下载超时（${Math.round(timeoutMs / 1000)} 秒），可只重试下载。`
          : `请求超时（${Math.round(timeoutMs / 1000)} 秒）。该接口非幂等，服务端可能仍在生成；不要自动重试，先查任务或到控制台核对。`,
        { code: 'TIMEOUT', stage, retryable: stage === 'download' },
      )
    }
    if (outerSignal?.aborted) {
      throw new MinimaxError('请求已取消。', { code: 'ABORTED', stage, retryable: stage === 'download' })
    }
    const reason = error instanceof Error ? error.message : String(error)
    throw new MinimaxError(`网络错误：${reason}`, { code: 'NETWORK', stage, retryable: stage === 'download' })
  } finally {
    composed.dispose()
  }

  const payload = await readBody(response)
  const rawBase = payload && typeof payload === 'object' && payload.base_resp ? payload.base_resp.status_code : undefined
  const baseStatus = rawBase === undefined || rawBase === null ? undefined : Number(rawBase)
  if (!response.ok || (baseStatus !== undefined && baseStatus !== 0)) {
    const failure = describeFailure(response.status, payload)
    if (failure.ignored) return payload
    throw new MinimaxError(failure.message || `HTTP ${response.status}`, {
      status: response.status,
      code: failure.code,
      hint: failure.hint,
      stage,
      body: payload,
    })
  }
  return payload
}

/** Download bytes without an Authorization header. Used for signed asset URLs. */
export async function downloadBytes(url, options = {}) {
  const { timeoutMs = 180000, signal, fetchImpl = globalThis.fetch } = options
  const composed = composeSignal(timeoutMs, signal)
  let response
  try {
    response = await fetchImpl(url, { signal: composed.signal, redirect: 'follow' })
  } catch (error) {
    if (composed.timedOut()) {
      throw new MinimaxError(`下载超时（${Math.round(timeoutMs / 1000)} 秒），可只重试下载。`, {
        code: 'DOWNLOAD_TIMEOUT',
        stage: 'download',
        retryable: true,
      })
    }
    throw new MinimaxError(`下载失败：${error instanceof Error ? error.message : String(error)}`, {
      code: 'DOWNLOAD_NETWORK',
      stage: 'download',
      retryable: true,
    })
  } finally {
    composed.dispose()
  }
  if (!response.ok) {
    throw new MinimaxError(`下载失败：HTTP ${response.status}（链接可能已过期，先重新查询任务）。`, {
      code: 'DOWNLOAD_HTTP',
      status: response.status,
      stage: 'download',
      retryable: true,
    })
  }
  return new Uint8Array(await response.arrayBuffer())
}

/** Key + settings aware facade used by media.js. */
export function createClient({ getSettings, resolveKey, fetchImpl, log = () => {} }) {
  async function authorizedKey() {
    const key = await resolveKey()
    const value = String(key || '').trim()
    if (!value) {
      throw new MinimaxError('未配置 API Key：在 设置 → MiniMax → 连接 里填写并保存（写入凭据 MINIMAX_API_KEY）。', {
        code: 'NO_KEY',
      })
    }
    return value
  }

  async function call(url, options = {}) {
    const settings = getSettings()
    const key = await authorizedKey()
    return requestJson(url, {
      ...options,
      headers: { Authorization: `Bearer ${key}`, ...(options.headers || {}) },
      fetchImpl,
      stage: options.stage || 'request',
    })
  }

  /** Free key check: /v1/models works with any quota and lists chat models only. */
  async function testConnection({ signal } = {}) {
    const settings = getSettings()
    const key = String(await resolveKey() || '').trim()
    if (!key) {
      return { ok: false, code: 'NO_KEY', message: '未配置 API Key。', hint: '在连接区填写 Key 并保存。' }
    }
    const endpoint = endpoints(settings.connection.baseURL)
    const shapeHint = keyShapeHint(key)
    if (/^\d{6,}$/.test(key)) {
      return { ok: false, code: 'BAD_KEY_SHAPE', message: '保存的 Key 不是 API Key。', hint: shapeHint }
    }
    try {
      const payload = await requestJson(endpoint.models, {
        headers: { Authorization: `Bearer ${key}` },
        timeoutMs: Math.min(30000, Math.max(5000, Number(settings.connection.timeoutMs) || 15000)),
        fetchImpl,
        signal,
      })
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : []
      return {
        ok: true,
        message: `连接正常，/v1/models 返回 ${list.length} 个模型。`,
        models: list.slice(0, 20).map((item) => item?.id ?? item?.name).filter(Boolean),
        host: new URL(endpoint.base).host,
      }
    } catch (error) {
      if (error instanceof MinimaxError) {
        return { ok: false, status: error.status, code: error.code, message: error.message, hint: error.hint || shapeHint }
      }
      return { ok: false, code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error), hint: '' }
    }
  }

  /** Admin-key balance probe; ordinary keys get 403 `not an admin key`. */
  async function adminBalance() {
    const settings = getSettings()
    const endpoint = endpoints(settings.connection.baseURL)
    try {
      const payload = await call(endpoint.balance, { timeoutMs: 15000 })
      const value = pickBalance(payload)
      return { ok: true, balance: value, raw: payload }
    } catch (error) {
      if (error instanceof MinimaxError) {
        return {
          ok: false,
          status: error.status,
          code: error.code,
          message: error.message,
          hint: error.status === 403 || error.status === 401 ? '普通 Key 拿不到真实余额（需要 admin key）；改用本地记账。' : error.hint,
        }
      }
      return { ok: false, message: error instanceof Error ? error.message : String(error), hint: '' }
    }
  }

  return { call, testConnection, adminBalance, authorizedKey }
}

function pickBalance(payload) {
  const candidates = [
    payload?.balance,
    payload?.data?.balance,
    payload?.data?.available_balance,
    payload?.account?.balance,
  ]
  for (const candidate of candidates) {
    const number = Number(candidate)
    if (Number.isFinite(number)) return number
  }
  return null
}

/** Read a local file for a reference; the caller validates dimensions. */
export function readLocalBytes(file) {
  return new Uint8Array(fs.readFileSync(file))
}
