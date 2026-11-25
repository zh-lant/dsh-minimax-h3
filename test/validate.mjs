/**
 * Bundle manifest / display-resource checks before installation.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const json = (file) => JSON.parse(read(file))

const pkg = json('package.json')
assert.equal(pkg.name, 'dsh-minimax-h3')
assert.equal(pkg.type, 'module')
assert.notEqual(pkg.private, true, 'publishable package must not be private')
assert.ok(pkg.engines?.dsh, 'plugins must declare a DSH compatibility range')
assert.ok(pkg.engines?.node, 'plugins must declare a Node range')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.dsh.client.platform, 'web')
assert.equal(pkg.dsh.client.immediately, true)
assert.equal(typeof pkg.exports['.'], 'string')
assert.equal(typeof pkg.exports['./client'], 'string')
assert.ok(pkg.files.includes('src'))
assert.ok(pkg.files.includes('docs'))

// Every exported runtime path exists.
for (const value of Object.values(pkg.exports)) {
  if (!value.includes('*')) assert.ok(fs.existsSync(path.join(root, value)), `missing export target ${value}`)
}
assert.ok(fs.existsSync(path.join(root, pkg.dsh.bundle.patch)))

// The patch inserts exactly the Host row; the Client half rides dsh.client.
const patch = read(pkg.dsh.bundle.patch)
assert.match(patch, /- insert:/)
assert.match(patch, /id: minimax-h3/)
assert.match(patch, /name: dsh-minimax-h3/)
assert.doesNotMatch(patch, /minimax-h3\/client/)
assert.doesNotMatch(patch, /dataDir|data_dir/i)

// Locales carry display metadata and an existing detail document.
for (const locale of ['en', 'zh']) {
  const data = json(`locale/${locale}.json`)
  assert.equal(typeof data.meta.title, 'string')
  assert.ok(data.meta.title.length > 0)
  assert.ok(data.meta.description.length > 160, `${locale} description is substantive`)
  assert.equal(data.meta.detail, locale === 'zh' ? 'docs/DETAIL.zh.md' : 'docs/DETAIL.md')
  const detail = read(data.meta.detail).trim()
  const image = /^!\[[^\]]+\]\(([^)]+)\)$/.exec(detail)
  assert.ok(image, `${locale} detail is one image line`)
  assert.ok(fs.existsSync(path.join(root, path.dirname(data.meta.detail), image[1])), `${locale} detail image exists`)
}

// Marketplace screenshots are real files and stay inside the package.
const screenshots = json('screenshots.json')
assert.ok(Array.isArray(screenshots) && screenshots.length >= 1 && screenshots.length <= 8)
for (const shot of screenshots) {
  assert.equal(typeof shot, 'string')
  assert.ok(!shot.startsWith('/') && !shot.split('/').includes('..'), `screenshot path is relative: ${shot}`)
  assert.ok(fs.existsSync(path.join(root, shot)), `screenshot exists: ${shot}`)
}

// Icon: SVG, small, self-contained (no script/style/image/foreignObject).
const icon = read('icon.svg')
assert.ok(Buffer.byteLength(icon) < 256 * 1024)
assert.match(icon, /viewBox="0 0 64 64"/)
for (const forbidden of ['<script', '<style', '<image', 'foreignObject', 'onload=']) {
  assert.ok(!icon.includes(forbidden), `icon must not contain ${forbidden}`)
}

// Detail preview: text-free and self-contained.
const preview = read('docs/preview.svg')
assert.match(preview, /width="640" height="300" viewBox="0 0 640 300"/)
for (const forbidden of ['<text', '<script', '<style', '<image', 'foreignObject', 'onload=']) {
  assert.ok(!preview.includes(forbidden), `preview must not contain ${forbidden}`)
}

// Host modules import only relative files and node: builtins.
for (const file of fs.readdirSync(path.join(root, 'src'))) {
  if (!file.endsWith('.js')) continue
  const source = read(`src/${file}`)
  for (const match of source.matchAll(/^\s*import\s+(?:[^'"]*from\s*)?['"]([^'"]+)['"]/gm)) {
    const specifier = match[1]
    assert.ok(specifier.startsWith('.') || specifier.startsWith('node:'), `${file} imports non-local ${specifier}`)
  }
}

// The six tool names are exactly the spec's set.
const hostSource = read('src/index.js')
const tools = [...hostSource.matchAll(/name: '(minimax_h3_[a-z_]+)'/g)].map((match) => match[1])
assert.deepEqual(
  [...new Set(tools)].sort(),
  [
    'minimax_h3_edit_image',
    'minimax_h3_enhance_prompt',
    'minimax_h3_image',
    'minimax_h3_media_list',
    'minimax_h3_media_status',
    'minimax_h3_video',
  ],
)
assert.ok(!hostSource.includes('minimax_generate_'), 'must not collide with dsh-minimax-api names')

// The client registers every tool view.
const clientSource = read('src/client.js')
for (const tool of tools) assert.ok(clientSource.includes(`'${tool}'`), `client card for ${tool}`)

console.log('bundle validation passed.')
