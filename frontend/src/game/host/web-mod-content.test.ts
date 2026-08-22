import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { materializeWebSessionContent } from './web-mod-content.ts'

test('session content materializes exact Lua identities and final Boneyard overlays', async () => {
  const fixture = await readFile(new URL('../../../../tests/fixtures/flat_multiplayer_test.boneyard', import.meta.url))
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xz6rAAAAAElFTkSuQmCC',
    'base64',
  )
  const content = materializeWebSessionContent({
    manifestSha256: 'f'.repeat(64),
    mods: [
      {
        boneyards: [],
        contentSha256: 'a'.repeat(64),
        entryScript: "sd.state.set('first', true)",
        files: [{
          byteLength: png.length,
          bytesBase64: png.toString('base64'),
          path: 'sprites/item.png',
          sha256: createHash('sha256').update(png).digest('hex'),
        }],
        id: 'tests.first',
        name: 'First',
        priority: 10,
        requiredCapabilities: [],
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
        requiredCapabilities: [],
        slug: 'second',
        version: '2.0.0',
      },
    ],
  })
  assert.deepEqual(content.manifest, {
    manifestSha256: 'f'.repeat(64),
    mods: [
      { contentSha256: 'a'.repeat(64), id: 'tests.first', version: '1.0.0' },
      { contentSha256: 'b'.repeat(64), id: 'tests.second', version: '2.0.0' },
    ],
  })
  assert.equal(content.modSources.length, 1)
  assert.equal(content.modSources[0]?.identity.id, 'tests.first')
  assert.equal(content.boneyards.length, 1)
  assert.equal(content.boneyards[0]?.choice.modId, 'tests.second')
  assert.equal(content.boneyards[0]?.choice.name, 'Contract')
  assert.deepEqual(content.assets, [{
    byteLength: png.length,
    modId: 'tests.first',
    path: 'sprites/item.png',
    sha256: createHash('sha256').update(png).digest('hex'),
  }])
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
    requiredCapabilities: [],
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
