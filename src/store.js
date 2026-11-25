/**
 * Plugin-owned state: settings, per-session task records, pending reference
 * selections, and media files. Everything lives below one data directory so
 * uninstalling the bundle leaves generated files and task records in place.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'

export const PLUGIN_DIR_NAME = 'dsh-minimax-h3'

/** Current settings shape; every field is user-editable through the settings page. */
export function defaultSettings() {
  return {
    connection: {
      plan: 'payg-cn',
      baseURL: 'https://api.minimaxi.com/v1',
      apiKeyEnv: 'MINIMAX_API_KEY',
      timeoutMs: 60000,
    },
    models: {
      image: 'MiniMax-H3-Image',
      video: 'MiniMax-H3',
    },
    ui: {
      language: 'zh',
    },
    image: {
      aspectRatio: '16:9',
      area: '1K',
      n: 1,
      format: 'jpeg',
      enhance: true,
      references: [],
    },
    video: {
      mode: 'text',
      resolution: '768P',
      duration: 5,
      ratio: '16:9',
      audio: true,
      firstFrame: '',
      lastFrame: '',
      referenceImages: [],
      referenceVideos: [],
      referenceAudios: [],
    },
    pricing: {
      videoPerSecond: 0.5,
      imagePerCall: 0.3,
      enhancePer1kTokens: 0,
    },
    balance: {
      source: 'ledger',
      current: 100,
      updatedAt: new Date().toISOString(),
    },
    alert: {
      enabled: false,
      threshold: 5,
    },
    media: {
      dataDir: '',
    },
  }
}

const PLAN_BASES = {
  'payg-cn': 'https://api.minimaxi.com/v1',
  'payg-global': 'https://api.minimax.io/v1',
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Deep-merge saved/supplied values over defaults, ignoring unknown keys. */
export function mergeSettings(base, patch) {
  if (!isPlainObject(patch)) return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in out)) continue
    if (isPlainObject(out[key]) && isPlainObject(value)) out[key] = mergeSettings(out[key], value)
    else if (value !== undefined) out[key] = value
  }
  return out
}

/** Resolve the configured data directory, defaulting to $DSH_HOME/plugins/dsh-minimax-h3. */
export function resolveDataDir(settings) {
  const configured = String(settings?.media?.dataDir ?? '').trim()
  if (configured) return path.resolve(configured)
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'plugins', PLUGIN_DIR_NAME)
}

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function nowIso() {
  return new Date().toISOString()
}

export function shortHash(value) {
  return createHash('sha1').update(String(value)).digest('hex').slice(0, 8)
}

/** Directory-safe session key; the hash suffix prevents sanitized collisions. */
export function sessionKey(sessionId) {
  const raw = String(sessionId ?? '') || 'global'
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48)
  return `${clean || 'session'}-${shortHash(raw)}`
}

export function newTaskId(kind) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${kind}-${stamp}-${randomBytes(3).toString('hex')}`
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

/** Durable plugin store. JSON files are small and written atomically. */
export class Store {
  constructor(dataDir, { log = () => {} } = {}) {
    this.dataDir = path.resolve(dataDir)
    this.settingsFile = path.join(this.dataDir, 'settings.json')
    this.ledgerFile = path.join(this.dataDir, 'ledger.json')
    this.pendingFile = path.join(this.dataDir, 'pending.json')
    this.sessionsDir = path.join(this.dataDir, 'sessions')
    this.mediaRoot = path.join(this.dataDir, 'media')
    this.refsDir = path.join(this.dataDir, 'refs')
    this.log = log
  }

  init(config) {
    fs.mkdirSync(this.dataDir, { recursive: true })
    fs.mkdirSync(this.sessionsDir, { recursive: true })
    fs.mkdirSync(this.mediaRoot, { recursive: true })
    fs.mkdirSync(this.refsDir, { recursive: true })
    const fromConfig = mergeSettings(defaultSettings(), config || {})
    const saved = readJson(this.settingsFile, null)
    this.settings = saved ? mergeSettings(fromConfig, saved) : fromConfig
    // Normalize plan presets so a plan switch always implies its public base.
    const plan = this.settings.connection.plan
    if (PLAN_BASES[plan]) this.settings.connection.baseURL = PLAN_BASES[plan]
    if (!saved) writeJsonAtomic(this.settingsFile, this.settings)
    return this.settings
  }

  getSettings() {
    return this.settings
  }

  saveSettings(patch) {
    if (isPlainObject(patch?.connection)) {
      const plan = patch.connection.plan
      if (PLAN_BASES[plan]) patch = { ...patch, connection: { ...patch.connection, baseURL: PLAN_BASES[plan] } }
    }
    this.settings = mergeSettings(this.settings, patch)
    writeJsonAtomic(this.settingsFile, this.settings)
    return this.settings
  }

  sessionDir(sessionId) {
    return path.join(this.sessionsDir, sessionKey(sessionId))
  }

  tasksFile(sessionId) {
    return path.join(this.sessionDir(sessionId), 'tasks.json')
  }

  tasks(sessionId) {
    const list = readJson(this.tasksFile(sessionId), [])
    return Array.isArray(list) ? list : []
  }

  findTask(sessionId, taskId) {
    if (!taskId) return undefined
    return this.tasks(sessionId).find((task) => task.id === taskId)
  }

  /** Insert or replace one task, newest first, bounded per session. */
  putTask(sessionId, task) {
    const list = this.tasks(sessionId)
    const index = list.findIndex((entry) => entry.id === task.id)
    if (index >= 0) list[index] = task
    else list.unshift(task)
    const bounded = list.slice(0, 200)
    writeJsonAtomic(this.tasksFile(sessionId), bounded)
    return task
  }

  /** Remove one task record; optionally remove its downloaded media directory. */
  deleteTask(sessionId, taskId, { deleteFiles = true } = {}) {
    const list = this.tasks(sessionId)
    const index = list.findIndex((entry) => entry.id === taskId)
    if (index < 0) return false
    list.splice(index, 1)
    writeJsonAtomic(this.tasksFile(sessionId), list)
    if (deleteFiles) {
      try {
        fs.rmSync(this.mediaDir(sessionId, taskId), { recursive: true, force: true })
      } catch (error) {
        this.log('delete task media failed', error)
      }
    }
    return true
  }

  allTasks() {
    let entries = []
    try {
      entries = fs.readdirSync(this.sessionsDir, { withFileTypes: true })
    } catch {
      return []
    }
    const out = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      out.push(...this.tasksByKey(entry.name))
    }
    return out
  }

  tasksByKey(key) {
    const list = readJson(path.join(this.sessionsDir, key, 'tasks.json'), [])
    return Array.isArray(list) ? list.map((task) => ({ ...task, sessionKey: key })) : []
  }

  sessionIds() {
    try {
      return fs.readdirSync(this.sessionsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  }

  mediaDir(sessionId, taskId) {
    return path.join(this.mediaRoot, sessionKey(sessionId), taskId)
  }

  mediaPath(sessionId, taskId, name) {
    return path.join(this.mediaDir(sessionId, taskId), name)
  }

  saveMedia(sessionId, taskId, name, bytes) {
    const file = this.mediaPath(sessionId, taskId, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, bytes)
    return file
  }

  saveRefBytes(name, bytes) {
    fs.mkdirSync(this.refsDir, { recursive: true })
    const safe = String(name || 'ref').replace(/[^A-Za-z0-9_.-]/g, '_').slice(-80)
    const file = path.join(this.refsDir, `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}-${safe}`)
    fs.writeFileSync(file, bytes)
    return file
  }

  readPending(sessionId) {
    const all = readJson(this.pendingFile, {})
    return all[String(sessionId)] || {}
  }

  updatePending(sessionId, patch) {
    const all = readJson(this.pendingFile, {})
    const key = String(sessionId)
    const current = isPlainObject(all[key]) ? all[key] : {}
    all[key] = { ...current, ...patch, updatedAt: nowIso() }
    writeJsonAtomic(this.pendingFile, all)
    return all[key]
  }

  clearPending(sessionId) {
    const all = readJson(this.pendingFile, {})
    delete all[String(sessionId)]
    writeJsonAtomic(this.pendingFile, all)
  }

  readLedger() {
    return readJson(this.ledgerFile, null)
  }

  writeLedger(ledger) {
    writeJsonAtomic(this.ledgerFile, ledger)
  }

  clearLocal() {
    let removed = 0
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '')
    for (const dir of [this.sessionsDir, this.mediaRoot, this.refsDir]) {
      if (!fs.existsSync(dir)) continue
      const trash = `${dir}.cleared-${stamp}`
      try {
        fs.renameSync(dir, trash)
        fs.rmSync(trash, { recursive: true, force: true })
        removed += 1
      } catch (error) {
        this.log('clear-local failed', error)
      }
    }
    fs.mkdirSync(this.sessionsDir, { recursive: true })
    fs.mkdirSync(this.mediaRoot, { recursive: true })
    fs.mkdirSync(this.refsDir, { recursive: true })
    try {
      fs.rmSync(this.pendingFile, { force: true })
    } catch {}
    // Keep settings and the balance anchor; only task/media records are cleared.
    return { removed }
  }
}
