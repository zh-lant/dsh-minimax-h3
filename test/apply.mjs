/**
 * Mount the Host entry against a fake Cordis context: verifies tool names,
 * registration disposers, and optional webServer route wiring.
 */
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { apply, inject } from '../src/index.js'

assert.deepEqual(inject, ['tools'])

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3-apply-'))
const registered = []
const routes = []
let disposed = 0

const webServer = {
  getOrigin: () => 'http://127.0.0.1:9999',
  register(route) {
    routes.push(route)
    return () => {
      disposed += 1
    }
  },
}

const ctx = {
  get(name) {
    if (name === 'tools') return { register: () => () => {} }
    if (name === 'credentials') {
      return { resolve: async () => ({ value: 'k' }), describe: async () => ({ configured: true, writable: true }) }
    }
    return undefined
  },
  tools: {
    register(definition) {
      registered.push(definition)
      return () => {
        disposed += 1
      }
    },
  },
  effect(callback) {
    const dispose = callback()
    return () => dispose?.()
  },
  inject(dependencies, callback) {
    assert.deepEqual(dependencies, ['webServer'])
    callback({
      webServer,
      effect(callback2) {
        return callback2()
      },
    })
  },
}

apply(ctx, { media: { dataDir } })

assert.deepEqual(
  registered.map((definition) => definition.name).sort(),
  [
    'minimax_h3_edit_image',
    'minimax_h3_enhance_prompt',
    'minimax_h3_image',
    'minimax_h3_media_list',
    'minimax_h3_media_status',
    'minimax_h3_video',
  ],
)
for (const definition of registered) {
  assert.equal(typeof definition.execute, 'function')
  assert.equal(typeof definition.output.render, 'function')
  assert.equal(typeof definition.output.presentationMeta, 'function')
  assert.equal(definition.parameters.type, 'object')
}
assert.equal(routes.length, 1)
assert.equal(routes[0].kind, 'prefix')
assert.equal(routes[0].path, '/dsh-minimax-h3')
assert.equal(typeof routes[0].handler, 'function')

fs.rmSync(dataDir, { recursive: true, force: true })
console.log('apply mount passed: 6 tools, 1 route.')
