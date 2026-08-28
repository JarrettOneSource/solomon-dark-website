import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  compileWebSessionContentDefinitions,
  materializeWebSessionContent,
} from './web-mod-content.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')

test('session content materializes exact Lua identities and final Boneyard overlays', async () => {
  const fixture = await readFile(new URL('../../../../tests/fixtures/flat_multiplayer_test.boneyard', import.meta.url))
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xz6rAAAAAElFTkSuQmCC',
    'base64',
  )
  const audio = Buffer.from('OggSweb-lua-test', 'utf8')
  const content = await compileWebSessionContentDefinitions(materializeWebSessionContent({
    manifestSha256: 'f'.repeat(64),
    mods: [
      {
        boneyards: [],
        contentSha256: 'a'.repeat(64),
        entryScript: `
local map = sd.art.boneyard('levels/lua-contract.boneyard')
local crypt = sd.kit.boneyard({
  key = 'lua_contract',
  name = 'Lua Contract',
  source = 'levels/lua-contract.boneyard',
  environment = {mode = 2},
})
return sd.mod({api = '1.0.0', assets = {map = map}, content = {crypt}})
`,
        files: [
          {
            byteLength: png.length,
            bytesBase64: png.toString('base64'),
            contentType: 'image/png',
            kind: 'image',
            path: 'sprites/item.png',
            sha256: createHash('sha256').update(png).digest('hex'),
          },
          {
            byteLength: audio.length,
            bytesBase64: audio.toString('base64'),
            contentType: 'audio/ogg',
            kind: 'audio',
            path: 'audio/chime.ogg',
            sha256: createHash('sha256').update(audio).digest('hex'),
          },
          {
            byteLength: fixture.length,
            bytesBase64: fixture.toString('base64'),
            contentType: 'application/vnd.solomon-dark.boneyard',
            kind: 'boneyard',
            path: 'levels/lua-contract.boneyard',
            sha256: createHash('sha256').update(fixture).digest('hex'),
          },
        ],
        id: 'tests.first',
        name: 'First',
        priority: 10,
        slug: 'first',
        version: '1.0.0',
      },
      {
        boneyards: [{
          bytesBase64: fixture.toString('base64'),
          target: 'sandbox/DarkCloud/mylevels/Contract.boneyard',
        }],
        contentSha256: 'b'.repeat(64),
        entryScript: null,
        files: [],
        id: 'tests.second',
        name: 'Second',
        priority: 20,
        slug: 'second',
        version: '2.0.0',
      },
    ],
  }), wasmPath)
  assert.deepEqual(content.manifest, {
    manifestSha256: 'f'.repeat(64),
    mods: [
      { contentSha256: 'a'.repeat(64), id: 'tests.first', version: '1.0.0' },
      { contentSha256: 'b'.repeat(64), id: 'tests.second', version: '2.0.0' },
    ],
  })
  assert.equal(content.modSources.length, 1)
  assert.equal(content.compiledMods.length, 1)
  assert.equal(content.modSources[0]?.identity.id, 'tests.first')
  assert.equal(content.summary.mods[0]?.graphSha256, content.compiledMods[0]?.graphSha256)
  assert.equal(content.boneyards.length, 2)
  assert.equal(content.boneyards[0]?.choice.modId, 'tests.second')
  assert.equal(content.boneyards[0]?.choice.name, 'Contract')
  const luaBoneyard = content.boneyards.find(entry => entry.choice.modId === 'tests.first')!
  assert.equal(luaBoneyard.choice.name, 'Lua Contract')
  assert.equal(luaBoneyard.scene.environmentMode, 2)
  assert.equal(luaBoneyard.webLuaContentId, content.compiledMods[0]?.content[0]?.contentId)
  assert.deepEqual(content.assets, [
    {
      byteLength: png.length,
      contentType: 'image/png',
      kind: 'image',
      modId: 'tests.first',
      path: 'sprites/item.png',
      sha256: createHash('sha256').update(png).digest('hex'),
    },
    {
      byteLength: audio.length,
      contentType: 'audio/ogg',
      kind: 'audio',
      modId: 'tests.first',
      path: 'audio/chime.ogg',
      sha256: createHash('sha256').update(audio).digest('hex'),
    },
    {
      byteLength: fixture.length,
      contentType: 'application/vnd.solomon-dark.boneyard',
      kind: 'boneyard',
      modId: 'tests.first',
      path: 'levels/lua-contract.boneyard',
      sha256: createHash('sha256').update(fixture).digest('hex'),
    },
  ])
  assert.deepEqual(content.summary.mods[0]?.assets, content.assets)
})

test('session content rejects duplicate identities and native overlay targets', () => {
  const base = {
    boneyards: [],
    contentSha256: 'a'.repeat(64),
    entryScript: null,
    files: [],
    id: 'tests.same',
    name: 'Same',
    priority: 0,
    slug: 'same',
    version: '1.0.0',
  }
  assert.throws(() => materializeWebSessionContent({
    manifestSha256: '0'.repeat(64),
    mods: [base, base],
  }), /duplicate/)
  assert.throws(() => materializeWebSessionContent({
    manifestSha256: '0'.repeat(64),
    mods: [{
      ...base,
      boneyards: [{ bytesBase64: 'eA==', target: 'images/Skills.png' }],
    }],
  }), /target is invalid/)
})
