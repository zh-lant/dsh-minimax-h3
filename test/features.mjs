import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Store, defaultSettings, mergeSettings, resolveDataDir } from '../src/store.js'
import { MediaService } from '../src/media.js'

assert.equal(defaultSettings().ui.language, 'zh')
assert.equal(mergeSettings(defaultSettings(), { ui: { language: 'en' } }).ui.language, 'en')
assert.ok(resolveDataDir(defaultSettings()).endsWith(path.join('plugins', 'dsh-minimax-h3')), 'default data dir is per-user')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-minimax-h3-features-'))
const store = new Store(root)
store.init()
const sessionId = 'feature-session'
function seed(suffix) {
  const taskId = `image-${suffix}`
  store.putTask(sessionId, { id: taskId, kind: 'image', status: 'succeeded', cost: 0, files: [] })
  const file = store.saveMedia(sessionId, taskId, 'result-1.jpg', Buffer.from('x'))
  store.putTask(sessionId, { id: taskId, kind: 'image', status: 'succeeded', cost: 0, files: [{ name: 'result-1.jpg', path: file, format: 'jpeg' }] })
  return { taskId, file }
}
const kept = seed('kept')
assert.equal(store.deleteTask(sessionId, kept.taskId, { deleteFiles: false }), true)
assert.equal(fs.existsSync(kept.file), true, 'deleteFiles=false keeps the media file')
const dropped = seed('dropped')
assert.equal(store.deleteTask(sessionId, dropped.taskId, { deleteFiles: true }), true)
assert.equal(fs.existsSync(dropped.file), false, 'deleteFiles=true removes the media file')
assert.equal(store.findTask(sessionId, dropped.taskId), undefined)
fs.rmSync(root, { recursive: true, force: true })

// New video tasks must persist their source materials so failed
// frames/reference jobs can be retried with the original settings.
const tasks = new Map()
const settings = defaultSettings()
const fakeStore = {
  getSettings: () => settings,
  getPending: () => ({}),
  readPending: () => ({}),
  putTask: (id, task) => tasks.set(task.id, task),
  clearPending: () => {},
}
const media = new MediaService({
  store: fakeStore,
  ledger: {},
  client: { call: async () => ({ task_id: 'provider-test-1' }) },
  attachments: {},
})
media.resolveImageRef = async () => ({ url: 'https://example.com/ref.png' })
const frames = await media.submitVideo({
  prompt: 'frame test',
  mode: 'frames',
  firstFrame: 'first.png',
  lastFrame: 'last.png',
  duration: 4,
  resolution: '480P',
  ratio: '9:16',
}, { sessionId: 'feature-session' })
assert.equal(frames.params.source.firstFrame, 'first.png')
assert.equal(frames.params.source.lastFrame, 'last.png')
const reference = await media.submitVideo({
  prompt: 'reference test',
  mode: 'reference',
  referenceImages: ['ref.png'],
  duration: 4,
  resolution: '480P',
  ratio: '16:9',
}, { sessionId: 'feature-session' })
assert.deepEqual(reference.params.source.images, ['ref.png'])
console.log('feature tests passed: settings language, delete file flag, video source persistence')
