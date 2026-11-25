/**
 * Lightweight component tests for the right-sidebar UI.
 *
 * The DSH client bundle is plain ESM and expects React from the host module
 * table. This file provides a tiny hook/renderer shim so the real components
 * can be exercised without a browser or a React install.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultSettings } from '../src/store.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const code = fs.readFileSync(path.resolve(here, '..', 'src', 'client.js'), 'utf8')

let captured = null
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition
    },
  },
}

const listeners = new Map()
globalThis.document = {
  activeElement: null,
  body: {},
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(fn)
  },
  removeEventListener(type, fn) {
    listeners.get(type)?.delete(fn)
  },
  dispatch(type, event) {
    for (const fn of [...(listeners.get(type) || [])]) fn(event)
  },
}
globalThis.window.addEventListener = (type, fn) => globalThis.document.addEventListener(type, fn)
globalThis.window.removeEventListener = (type, fn) => globalThis.document.removeEventListener(type, fn)

const instances = new Map()
let currentInstance = null
let rootType = null
let rootProps = null
let rendering = false
let rerenderRequested = false
let effectQueue = []

function createElement(type, props, ...children) {
  return { type, props: props || {}, children }
}

function hookSlot() {
  const inst = currentInstance
  const index = inst.cursor++
  if (!(index in inst.hooks)) inst.hooks[index] = {}
  return [inst, index, inst.hooks[index]]
}

function useState(initial) {
  const [, index, hook] = hookSlot()
  if (!('value' in hook)) hook.value = typeof initial === 'function' ? initial() : initial
  return [
    hook.value,
    (next) => {
      hook.value = typeof next === 'function' ? next(hook.value) : next
      requestRender()
    },
  ]
}

function useEffect(fn, deps) {
  const [, index, hook] = hookSlot()
  const changed = !hook.deps || !deps || deps.length !== hook.deps.length || deps.some((value, at) => !Object.is(value, hook.deps[at]))
  hook.deps = deps
  if (changed) effectQueue.push({ hook, fn })
}

function useRef(initial) {
  const [, index, hook] = hookSlot()
  if (!('current' in hook)) hook.current = initial ?? null
  return hook
}

const Fragment = Symbol('Fragment')
const React = { Fragment, createElement, useState, useEffect, useRef }

function sameSelector(node, selector) {
  if (typeof node !== 'object' || !node || typeof node.type !== 'string') return false
  const value = String(selector || '').trim()
  if (!value) return false
  if (value.startsWith('.')) return String(node.props.className || '').split(/\s+/).includes(value.slice(1))
  if (value === 'button') return node.type === 'button'
  if (value === 'input') return node.type === 'input'
  if (value === 'button:not([disabled])') return node.type === 'button' && !node.props.disabled
  if (value === 'input:not([disabled])') return node.type === 'input' && !node.props.disabled
  if (value === '[tabindex]:not([tabindex="-1"])') return node.props.tabIndex !== undefined && node.props.tabIndex !== -1
  const role = value.match(/^\[role="([^"]+)"\]$/)
  if (role) return node.props.role === role[1]
  return false
}

function descendants(node, out = []) {
  for (const child of node.children || []) {
    if (!child || typeof child !== 'object') continue
    out.push(child)
    descendants(child, out)
  }
  return out
}

function hasAncestor(node, selector) {
  let parent = node.parent
  while (parent) {
    if (sameSelector(parent, selector)) return true
    parent = parent.parent
  }
  return false
}

function matches(node, selector) {
  const parts = String(selector || '').split(/\s+/).filter(Boolean)
  if (!parts.length) return false
  const last = parts[parts.length - 1]
  if (!sameSelector(node, last)) return false
  return parts.slice(0, -1).every((ancestor) => hasAncestor(node, ancestor))
}

function attachDom(node) {
  node.parent = null
  node.isConnected = true
  node.focus = () => {
    globalThis.document.activeElement = node
  }
  node.contains = (other) => {
    let cursor = other
    while (cursor) {
      if (cursor === node) return true
      cursor = cursor.parent
    }
    return false
  }
  node.querySelectorAll = (selector) => {
    const selectors = String(selector || '').split(',').map((item) => item.trim()).filter(Boolean)
    return descendants(node).filter((child) => selectors.some((item) => matches(child, item)))
  }
  node.querySelector = (selector) => node.querySelectorAll(selector)[0] || null
}

function renderChildren(children, pathPrefix) {
  const out = []
  const list = Array.isArray(children) ? children : [children]
  for (const child of list) {
    if (Array.isArray(child)) {
      out.push(...renderChildren(child, pathPrefix))
      continue
    }
    if (child === null || child === undefined || child === false || child === true) continue
    if (typeof child === 'string' || typeof child === 'number') {
      out.push(String(child))
      continue
    }
    if (typeof child === 'object') {
      out.push(renderNode(child, `${pathPrefix}.${out.length}`))
    }
  }
  return out
}

function renderNode(node, pathKey) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child, index) => renderNode(child, `${pathKey}.${index}`))
  if (node.type === Fragment) return renderChildren(node.children, pathKey)
  if (typeof node.type === 'function') {
    let instance = instances.get(pathKey)
    if (!instance) {
      instance = { hooks: [], cursor: 0, type: node.type }
      instances.set(pathKey, instance)
    }
    const previous = currentInstance
    currentInstance = instance
    instance.cursor = 0
    let output
    try {
      output = node.type({ ...node.props, children: node.children })
    } finally {
      currentInstance = previous
    }
    return renderChildren(output, `${pathKey}.out`)
  }
  const host = { type: node.type, props: node.props || {}, children: [] }
  attachDom(host)
  host.children = renderChildren(node.children, `${pathKey}.${node.type}`)
  for (const child of host.children) {
    if (child && typeof child === 'object') child.parent = host
  }
  if (host.props.ref) host.props.ref.current = host
  return host
}

let renderTree = null
function render(component, props) {
  rootType = component
  rootProps = props
  renderTree = null
  rerenderRequested = false
  effectQueue = []
  rendering = true
  renderTree = renderNode({ type: component, props, children: [] }, 'root')
  rendering = false
  for (const { hook, fn } of effectQueue) {
    if (typeof hook.cleanup === 'function') hook.cleanup()
    hook.cleanup = fn()
  }
  let guard = 0
  while (rerenderRequested && ++guard < 6) {
    rerenderRequested = false
    rendering = true
    renderTree = renderNode({ type: rootType, props: rootProps, children: [] }, 'root')
    rendering = false
    for (const { hook, fn } of effectQueue) {
      if (typeof hook.cleanup === 'function') hook.cleanup()
      hook.cleanup = fn()
    }
  }
  return renderTree
}

function requestRender() {
  if (rendering) {
    rerenderRequested = true
    return
  }
  if (rootType) render(rootType, rootProps)
}

globalThis.__MINIMAX_H3_TEST__ = true
new Function('window', code)(globalThis.window)
assert.ok(captured, 'module loader received a definition')
const plugin = captured.factory((name) => (name === 'react' ? React : undefined))
assert.equal(plugin.inject[0], 'slots')
const ui = globalThis.__MINIMAX_H3_INTERNALS__
assert.ok(ui?.TaskRow && ui?.DeleteDialog && ui?.RefSlots && ui?.TaskPanel, 'test internals exposed')

function nodes(tree, predicate, out = []) {
  if (Array.isArray(tree)) {
    for (const item of tree) nodes(item, predicate, out)
    return out
  }
  if (!tree || typeof tree !== 'object') return out
  if (predicate(tree)) out.push(tree)
  nodes(tree.children, predicate, out)
  return out
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (!node || typeof node !== 'object') return String(node ?? '')
  return text(node.children)
}

function buttons(tree) {
  return nodes(tree, (node) => node.type === 'button')
}

function buttonByText(tree, label) {
  return buttons(tree).find((node) => text(node).includes(label))
}

function click(node) {
  assert.ok(node?.props?.onClick, `no click handler on ${node?.type}`)
  node.props.onClick({
    currentTarget: node,
    target: node,
    preventDefault() {},
    stopPropagation() {},
  })
}

// ---------------------------------------------------------------- TaskRow

const baseTask = {
  id: 'video-test-1',
  kind: 'video',
  status: 'failed',
  model: 'MiniMax-H3',
  prompt: 'test prompt',
  createdAt: new Date(Date.now() - 120000).toISOString(),
  cost: 0,
  params: { mode: 'frames', duration: 4, resolution: '480P', ratio: '9:16', audio: false, source: { firstFrame: 'C:\\tmp\\first.png' } },
  provider: { status: 'failed', checkedAt: new Date().toISOString() },
  files: [],
  failures: [],
  error: { message: 'video output audio removal failed' },
}

let tree = render(ui.TaskRow, { sessionId: 's', task: baseTask, inputActions: {} })
assert.ok(buttonByText(tree, '重试'), 'failed video exposes retry')
assert.equal(buttonByText(tree, '更多'), undefined, 'failed video has no More menu')
click(buttonByText(tree, '重试'))
tree = render(ui.TaskRow, { sessionId: 's', task: baseTask, inputActions: {} })
assert.ok(buttonByText(tree, '确认重试'), 'retry uses a confirmation step')

tree = render(ui.TaskRow, {
  sessionId: 's',
  task: { ...baseTask, status: 'generating', provider: { status: 'running', checkedAt: new Date().toISOString() }, error: null },
  inputActions: {},
})
assert.ok(text(tree).includes('已等待'), 'running card shows elapsed time')
assert.ok(text(tree).includes('最近查询'), 'running card shows last check')
assert.ok(buttonByText(tree, '取回结果'), 'running card keeps manual fetch')

tree = render(ui.TaskRow, {
  sessionId: 's',
  task: {
    ...baseTask,
    status: 'saved',
    provider: { status: 'succeeded' },
    error: null,
    files: [{ name: 'result-1.mp4', path: 'D:\\tmp\\result-1.mp4', url: '/dsh-minimax-h3/file/video-test-1/0', bytes: 10, format: 'mp4' }],
  },
  inputActions: {},
})
const more = buttonByText(tree, '更多')
assert.ok(more, 'saved video exposes More')
click(more)
tree = render(ui.TaskRow, { sessionId: 's', task: { ...baseTask, status: 'saved', provider: { status: 'succeeded' }, error: null, files: [{ name: 'result-1.mp4', path: 'D:\\tmp\\result-1.mp4', url: '/dsh-minimax-h3/file/video-test-1/0', bytes: 10, format: 'mp4' }] }, inputActions: {} })
const taskMenu = nodes(tree, (node) => node.props?.role === 'menu')[0]
assert.ok(taskMenu, 'task More opens a menu role')
assert.ok(nodes(taskMenu, (node) => node.props?.role === 'menuitem').some((node) => text(node).includes('打开所在文件夹')), 'task menu has open-folder action')
globalThis.document.dispatch('pointerdown', { target: {} })
tree = render(ui.TaskRow, { sessionId: 's', task: { ...baseTask, status: 'saved', provider: { status: 'succeeded' }, error: null, files: [{ name: 'result-1.mp4', path: 'D:\\tmp\\result-1.mp4', url: '/dsh-minimax-h3/file/video-test-1/0', bytes: 10, format: 'mp4' }] }, inputActions: {} })
assert.equal(nodes(tree, (node) => node.props?.role === 'menu').length, 0, 'outside click closes task More')

// --------------------------------------------------------------- DeleteDialog

let cancelled = 0
tree = render(ui.DeleteDialog, {
  task: baseTask,
  running: true,
  deleteFiles: true,
  onToggle: () => {},
  onCancel: () => { cancelled += 1 },
  onConfirm: () => {},
  busy: false,
  error: '',
})
assert.ok(nodes(tree, (node) => node.props?.role === 'dialog').length, 'delete dialog uses dialog role')
assert.ok(nodes(tree, (node) => node.type === 'input').length, 'delete dialog has file checkbox')
globalThis.document.dispatch('keydown', { key: 'Escape', preventDefault() {} })
assert.equal(cancelled, 1, 'Escape cancels delete dialog')

// ------------------------------------------------------------------ RefSlots

tree = render(ui.RefSlots, { refs: [], max: 4, kind: 'image', labelled: true, hint: '请上传文件', onChange: () => {}, lastResults: [] })
const add = buttons(tree).find((node) => text(node) === '+')
assert.ok(add, 'reference add button exists')
click(add)
tree = render(ui.RefSlots, { refs: [], max: 4, kind: 'image', labelled: true, hint: '请上传文件', onChange: () => {}, lastResults: [] })
const menu = nodes(tree, (node) => node.props?.role === 'menu')[0]
assert.ok(menu, 'reference menu opens with menu role')
assert.ok(nodes(menu, (node) => node.props?.role === 'menuitem').length >= 3, 'reference menu has menuitems')
globalThis.document.dispatch('pointerdown', { target: {} })
tree = render(ui.RefSlots, { refs: [], max: 4, kind: 'image', labelled: true, hint: '请上传文件', onChange: () => {}, lastResults: [] })
assert.equal(nodes(tree, (node) => node.props?.role === 'menu').length, 0, 'outside click closes reference menu')
tree = render(ui.RefSlots, { refs: ['D:\\tmp\\ref.png'], max: 4, kind: 'image', labelled: true, hint: '请上传文件', onChange: () => {}, lastResults: [] })
const thumbnail = nodes(tree, (node) => node.type === 'img')[0]
assert.ok(thumbnail?.props?.src?.includes('/ref-file?path='), 'uploaded references render a thumbnail URL')
tree = render(ui.RefSlots, { refs: ['D:\\tmp\\ref.mp4'], max: 3, kind: 'video', onChange: () => {}, lastResults: [] })
const videoThumb = nodes(tree, (node) => node.type === 'video')[0]
assert.ok(videoThumb?.props?.src?.includes('/ref-file?path='), 'reference video uses a first-frame video element')
assert.ok(nodes(tree, (node) => String(node.props?.className || '').includes('h3-ref-play')).length, 'reference video shows a play badge')
tree = render(ui.RefSlots, { refs: ['D:\\tmp\\ref.mp3'], max: 3, kind: 'audio', onChange: () => {}, lastResults: [] })
assert.ok(nodes(tree, (node) => String(node.props?.className || '').includes('h3-ref-audio')).length, 'reference audio shows a waveform icon')

// ------------------------------------------------------------------ TaskPanel

let newClicked = 0
tree = render(ui.TaskPanel, { sessionId: 's', data: { tasks: [], balance: null }, onNew: () => { newClicked += 1 }, inputActions: {} })
assert.ok(text(tree).includes('还没有任务'), 'empty history renders empty state')
const newButton = buttonByText(tree, '去新建')
assert.ok(newButton, 'empty history offers create')
click(newButton)
assert.equal(newClicked, 1, 'create button calls onNew')

// ---------------------------------------------------------------- Settings

const settings = defaultSettings()
settings.ui = { language: 'en' }
ui.hub.states.set('settings-session', {
  settings,
  key: { configured: false, masked: '' },
  balance: { current: 0, sessionSpend: 0, byModel: [], alert: { enabled: false, triggered: false, threshold: 5 } },
})
ui.hub.refresh = () => Promise.resolve()
tree = render(ui.SettingsPage, { sessionId: 'settings-session' })
assert.ok(text(tree).includes('Language'), 'settings renders the language section')

console.log('ui components: TaskRow, DeleteDialog, RefSlots, TaskPanel and SettingsPage passed.')
