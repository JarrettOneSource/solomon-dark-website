import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { readGameArtifact, remountGameArtifact, stageGameArtifact } from './game-artifact.mjs'

const revision = 'a'.repeat(40)
const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])
const document = (entry = 'boot.mjs', extra = '') => `<!doctype html><head>
<meta name="solomon-build-revision" content="${revision}">
<meta name="solomon-game-mount" content="/game-stg">
<meta name="solomon-website-mount" content="/game-stg">
<script type="module" src="/game-stg/${entry}" ${extra}></script></head>`

async function fixture(context) {
  const work = await mkdtemp(join(tmpdir(), 'sdr-artifact-contract-'))
  context.after(() => rm(work, { recursive: true, force: true }))
  const root = join(work, 'artifact')
  const files = {
    'bin/solomon-darker': '#!/bin/sh\nexit 0\n',
    'client/index.html': document(),
    'client/deployment.json': JSON.stringify({ revision }),
    'client/boot.mjs': "import init from '/game-stg/game.js'; await loader.boot_loader(); await init('/game-stg/game.wasm');",
    'client/game.js': 'export default async function init() {}',
    'client/game.wasm': wasm,
    'client/editor-boot.mjs': "import '/game-stg/boot.mjs';",
    'client/editor-test/index.html': document('editor-boot.mjs', 'data-editor-test-boot'),
    'client/save-tools/solomon_save_tools.js': "export default new URL('solomon_save_tools_bg.wasm', import.meta.url);",
    'client/save-tools/solomon_save_tools_bg.wasm': wasm,
  }
  for (const [name, bytes] of Object.entries(files)) {
    await mkdir(join(root, name, '..'), { recursive: true })
    await writeFile(join(root, name), bytes, { mode: name.startsWith('bin/') ? 0o755 : 0o644 })
  }
  const manifest = { schemaVersion: 1, revision, target: 'x86_64-unknown-linux-gnu', files: {} }
  async function commit() {
    for (const name of Object.keys(files)) {
      manifest.files[name] = createHash('sha256').update(await readFile(join(root, name))).digest('hex')
    }
    await writeFile(join(root, 'game-artifact.json'), JSON.stringify(manifest))
  }
  await commit()
  const inputs = { dist: join(root, 'client'), nativeHost: join(root, 'bin/solomon-darker') }
  return { root, inputs, manifest, commit }
}

test('a complete matching artifact stages its actual mounted browser, editor and save tools', async context => {
  const { root, inputs } = await fixture(context)
  const artifact = await readGameArtifact(inputs)
  assert.equal(artifact.manifest.revision, revision)
  assert.equal(artifact.mount, '/game-stg')
  const target = join(root, '../website/game')
  await stageGameArtifact(artifact, target)
  assert.equal(await readFile(join(target, 'index.html'), 'utf8'), document())
  assert.deepEqual(await readFile(join(target, 'game.wasm')), wasm)
  assert.ok((await readdir(target)).includes('editor-test'))
  assert.ok(!(await readdir(target)).includes('bin'))
})

test('the Website requires explicit client and native inputs', async () => {
  await assert.rejects(readGameArtifact({}), /SDR_GAME_DIST.*SDR_GAME_NATIVE_HOST/)
})

test('remounting preserves native and WASM bytes and gives changed browser members truthful hashes', async context => {
  const { root, inputs } = await fixture(context)
  const source = await readGameArtifact(inputs)
  const originalManifest = await readFile(join(root, 'game-artifact.json'))
  const originalBoot = await readFile(join(root, 'client/boot.mjs'))
  const mounted = await remountGameArtifact(source, join(root, '../mounted'), '/game-rust')
  assert.equal(mounted.mount, '/game-rust')
  assert.equal(mounted.manifest.revision, source.manifest.revision)
  assert.equal(mounted.manifest.remountedFrom.manifestSha256,
    createHash('sha256').update(originalManifest).digest('hex'))
  assert.deepEqual(await readFile(mounted.native), await readFile(source.native))
  assert.deepEqual(await readFile(join(mounted.client, 'game.wasm')), wasm)
  assert.deepEqual(await readFile(join(root, 'game-artifact.json')), originalManifest)
  assert.deepEqual(await readFile(join(root, 'client/boot.mjs')), originalBoot)
  const html = await readFile(join(mounted.client, 'index.html'), 'utf8')
  const editor = await readFile(join(mounted.client, 'editor-test/index.html'), 'utf8')
  assert.match(html, /name="solomon-website-mount" content="\/game-rust"/)
  assert.ok(!html.includes('/game-stg'))
  assert.ok(!editor.includes('/game-stg'))
  assert.ok(Object.hasOwn(mounted.manifest.files, 'client/parallel-save-migration.mjs'))
  const rechecked = await readGameArtifact({ dist: mounted.client, nativeHost: mounted.native })
  assert.equal(rechecked.mount, '/game-rust')
})

test('a different native host cannot be paired with the client manifest', async context => {
  const { root, inputs } = await fixture(context)
  const other = join(root, 'other-native-host')
  await writeFile(other, '#!/bin/sh\nexit 0\n')
  await assert.rejects(readGameArtifact({ ...inputs, nativeHost: other }), /same artifact/)
})

test('altered client bytes and unlisted client files fail admission', async context => {
  const { root, inputs, commit } = await fixture(context)
  await writeFile(join(root, 'client/game.js'), 'changed')
  await assert.rejects(readGameArtifact(inputs), /SHA-256/)
  await commit()
  await writeFile(join(root, 'client/unlisted.js'), 'export {}')
  await assert.rejects(readGameArtifact(inputs), /unlisted client file/)
})

test('manifest paths cannot leave the artifact root', async context => {
  const { root, inputs, manifest } = await fixture(context)
  manifest.files['../outside'] = '0'.repeat(64)
  await writeFile(join(root, 'game-artifact.json'), JSON.stringify(manifest))
  await assert.rejects(readGameArtifact(inputs), /unsafe artifact path/)
})

test('deployment metadata must identify the same full revision', async context => {
  const { root, inputs, commit } = await fixture(context)
  await writeFile(join(root, 'client/deployment.json'), JSON.stringify({ revision: 'b'.repeat(40) }))
  await commit()
  await assert.rejects(readGameArtifact(inputs), /deployment revision/)
})

test('the bootstrap must reference the actual module and WASM in the artifact', async context => {
  const { root, inputs, commit } = await fixture(context)
  await writeFile(join(root, 'client/boot.mjs'), "import '/game-stg/missing.js';")
  await commit()
  await assert.rejects(readGameArtifact(inputs), /bootstrap|module|WASM/)
})

test('save tools must contain an actual WASM module', async context => {
  const { root, inputs, commit } = await fixture(context)
  await writeFile(join(root, 'client/save-tools/solomon_save_tools_bg.wasm'), 'not wasm')
  await commit()
  await assert.rejects(readGameArtifact(inputs), /WASM/)
})

test('staging cannot delete its own artifact input', async context => {
  const { inputs } = await fixture(context)
  const artifact = await readGameArtifact(inputs)
  await assert.rejects(stageGameArtifact(artifact, inputs.dist), /overlap/)
})
