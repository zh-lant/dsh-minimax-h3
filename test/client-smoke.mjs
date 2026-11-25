/**
 * Client-half smoke test without a browser or React renderer.
 * Checks that the module registers the expected slots and that every
 * registered component can run once with minimal props (start phases and an
 * empty hub). It does not validate styling or DOM behavior.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const file = path.resolve(here, '..', 'src', 'client.js')
const code = fs.readFileSync(file, 'utf8')

let captured = null
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition
    },
  },
}

const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  useState(initial) {
    const value = typeof initial === 'function' ? initial() : initial
    return [value, () => {}]
  },
  useEffect() {},
  useRef() {
    return { current: null }
  },
}

// Evaluate the artifact as the browser module table would.
new Function('window', code)(globalThis.window)
assert.ok(captured, 'module loader received a definition')
assert.equal(captured.id, 'dsh-minimax-h3')

const plugin = captured.factory((name) => {
  assert.equal(name, 'react')
  return React
})
assert.equal(typeof plugin.apply, 'function')
assert.deepEqual(plugin.inject, ['slots'])

const registrations = []
const ctx = {
  get(name) {
    if (name === 'locale') return { getLocale: () => ({ active: 'zh' }), subscribe: () => () => {} }
    return undefined
  },
  effect(callback) {
    return callback()
  },
  on() {
    return () => {}
  },
  slots: {
    inject(key, callback) {
      assert.equal(typeof key, 'string')
      const dispose = callback()
      assert.equal(typeof dispose, 'function')
      return dispose
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

plugin.apply(ctx)

const ids = registrations.map((entry) => `${entry.options.name}:${entry.options.id || entry.options.key}`)
assert.ok(ids.includes('settings.section:minimax-h3'), 'settings section registered')
assert.ok(ids.includes('conversation.composer.dock:minimax-h3-balance'), 'dock registered')
assert.ok(ids.includes('shell.overlay:minimax-h3-overlay'), 'overlay registered')
for (const tool of [
  'minimax_h3_image',
  'minimax_h3_edit_image',
  'minimax_h3_video',
  'minimax_h3_enhance_prompt',
  'minimax_h3_media_status',
  'minimax_h3_media_list',
]) {
  assert.ok(ids.includes(`tool.call.toolview:${tool}`), `${tool} card registered`)
}

// Render every registered component once with minimal props. Components that
// need hub data return null/loading, but reference errors still surface.
const sessionProps = {
  sessionId: 'smoke-session',
  callId: 'c1',
  toolName: 'minimax_h3_image',
  phase: 'start',
  block: { phase: 'start', argsRaw: JSON.stringify({ prompt: '雨夜', duration: 5, model: 'MiniMax-H3' }), time: Date.now() },
  inputActions: {
    captureInsertion: () => ({}),
    insertText: () => true,
    setDraft: () => {},
    submit: () => {},
  },
  useInput: () => '',
}
for (const entry of registrations) {
  const component = entry.component
  if (typeof component !== 'function') continue
  try {
    component(sessionProps)
  } catch (error) {
    throw new Error(`render failed for ${entry.options.name}:${entry.options.id || entry.options.key}: ${error.stack}`)
  }
}

console.log(`client smoke: ${registrations.length} registrations, all components ran once.`)

// ---------------------------------------------------------------- right tab
const tabDefs = []
const opened = []
const rightRegistrations = []
const tabsService = {
  register(definition) {
    tabDefs.push(definition)
    return () => {}
  },
}
const rightService = {
  openTab(kind) {
    opened.push(kind)
  },
}
const ctx2 = {
  get(name) {
    if (name === 'locale') return { getLocale: () => ({ active: 'zh' }), subscribe: () => () => {} }
    if (name === 'sidebarRightTabs') return tabsService
    if (name === 'sidebarRight') return rightService
    return undefined
  },
  effect(callback) {
    return callback()
  },
  on() {
    return () => {}
  },
  slots: {
    inject(key, callback) {
      const dispose = callback()
      return dispose
    },
    register(options, component) {
      rightRegistrations.push({ options, component })
      return () => {}
    },
  },
}

plugin.apply(ctx2)
assert.equal(tabDefs.length, 1, 'one tab type registered')
assert.equal(tabDefs[0].id, 'dsh-minimax-h3')
assert.equal(tabDefs[0].kind, 'minimax-h3')
assert.equal(typeof tabDefs[0].title, 'function')
assert.equal(tabDefs[0].guide?.[0]?.id, 'minimax-h3')

const rightIds = rightRegistrations.map((entry) => `${entry.options.name}:${entry.options.id || entry.options.key}`)
assert.ok(rightIds.includes('sidebar.right.pane.tab:dsh-minimax-h3'), 'right tab body registered')
assert.ok(!rightIds.includes('settings.section:minimax-h3'), 'settings section removed in right-tab mode')
assert.ok(!rightIds.includes('conversation.composer.dock:minimax-h3-balance'), 'dock removed in right-tab mode')
assert.ok(!rightIds.includes('shell.overlay:minimax-h3-overlay'), 'overlay removed in right-tab mode')

const tabEntry = rightRegistrations.find((entry) => entry.options.name === 'sidebar.right.pane.tab')
assert.equal(tabEntry.component.name, 'MiniMaxTab')
tabEntry.component({ sessionId: 'smoke-session' })

const launcher = rightRegistrations.find(
  (entry) => entry.options.name === 'tool.call.toolview' && entry.options.key === 'minimax_h3_image',
)
assert.equal(launcher.component.name, 'ToolLauncher')
const tree = launcher.component(sessionProps)
function findButton(node) {
  if (!node || typeof node !== 'object') return null
  if (typeof node.props?.onClick === 'function' && JSON.stringify(node.children).includes('打开 MiniMax')) return node
  for (const child of node.children || []) {
    const found = findButton(child)
    if (found) return found
  }
  return null
}
const openButton = findButton(tree)
assert.ok(openButton, 'launcher has an open button')
openButton.props.onClick()
assert.deepEqual(opened, ['minimax-h3'])
console.log('client right-tab smoke: tab type, body, launcher wiring passed.')
