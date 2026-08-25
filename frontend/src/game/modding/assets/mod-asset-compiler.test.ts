import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameModAsset } from '../../protocol/game-protocol.ts'
import type { CompiledWebLuaMod } from '../definition/index.ts'
import { compileModAssets } from './mod-asset-compiler.ts'

const identity = Object.freeze({ id: 'example.assets', name: 'Assets', version: '1.0.0' })

test('asset compiler verifies package identity and compiles sprite and sheet frames', () => {
  const icon = png(53, 50)
  const sheet = png(32, 16)
  const files = {
    'art/icon.png': icon,
    'art/mage.png': sheet,
  }
  const catalog = compileModAssets({
    assets: Object.entries(files).map(([path, bytes]) => metadata(path, bytes)),
    mods: [mod([
      { assetKind: 'sprite', fields: { path: 'art/icon.png' }, key: 'icon' },
      {
        assetKind: 'sheet',
        fields: {
          animations: { idle: [1], move: [1, 2] },
          frame: { height: 16, width: 16 },
          image: 'art/mage.png',
        },
        key: 'mage',
      },
    ])],
    sources: [{ files, identity }],
  })
  assert.equal(catalog.image(identity.id, 'icon').frames[0]?.width, 53)
  assert.equal(catalog.image(identity.id, 'mage').frames.length, 2)
  assert.deepEqual(catalog.image(identity.id, 'mage').animations.move, [0, 1])
})

test('asset compiler rejects mismatched bytes, MIME, and invalid sheet geometry', () => {
  const bytes = png(30, 16)
  const base = {
    assets: [metadata('art/mage.png', bytes)],
    sources: [{ files: { 'art/mage.png': bytes }, identity }],
  }
  assert.throws(() => compileModAssets({
    ...base,
    mods: [mod([{
      assetKind: 'sheet',
      fields: { animations: { idle: [1] }, frame: { height: 16, width: 16 }, path: 'art/mage.png' },
      key: 'mage',
    }])],
  }), /exact multiples/)
  assert.throws(() => compileModAssets({
    ...base,
    assets: [{ ...base.assets[0]!, contentType: 'audio/ogg' }],
    mods: [mod([{ assetKind: 'sprite', fields: { path: 'art/mage.png' }, key: 'mage' }])],
  }), /requires image image\/png/)
  assert.throws(() => compileModAssets({
    ...base,
    sources: [{ files: { 'art/mage.png': new Uint8Array(bytes.length) }, identity }],
    mods: [mod([{ assetKind: 'sprite', fields: { path: 'art/mage.png' }, key: 'mage' }])],
  }), /digest changed/)
})

function mod(assets: CompiledWebLuaMod['assets']): CompiledWebLuaMod {
  return {
    apiVersion: '1.0.0',
    assets,
    canonicalJson: '{}',
    capabilities: [],
    content: [],
    graphSha256: '0'.repeat(64),
    identity,
    reducers: [],
    rules: [],
  }
}

function metadata(path: string, bytes: Uint8Array): GameModAsset {
  return {
    byteLength: bytes.length,
    contentType: 'image/png',
    kind: 'image',
    modId: identity.id,
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}
