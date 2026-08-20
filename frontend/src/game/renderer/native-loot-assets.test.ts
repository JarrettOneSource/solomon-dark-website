import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

import type { NativeLootAtlas } from './native-loot-assets.ts'

test('the complete native loot and Goodie record census is selected for preload', async (t) => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    server: { middlewareMode: true },
  })
  t.after(() => server.close())
  const module = await server.ssrLoadModule('/src/game/renderer/native-loot-assets.ts') as {
    NATIVE_LOOT_ASSET_SOURCES: readonly string[]
    nativeLootSpriteRecord(
      atlas: NativeLootAtlas,
      entry: number,
    ): { readonly source: string }
  }
  const records: readonly (readonly [NativeLootAtlas, number])[] = [
    ...[7, 15, 33, 52, 61, 67, 73, 83]
      .map((entry) => ['BadGuys', entry] as const),
    ...pairs('BadGuys', 122, 157),
    ...pairs('BadGuys', 188, 201),
    ...pairs('BadGuys', 377, 380),
    ...pairs('BadGuys', 434, 445),
    ...pairs('DeadHawg', 145, 147),
  ]
  const sources = new Set<string>()
  for (const [atlas, entry] of records) {
    const record = module.nativeLootSpriteRecord(atlas, entry)
    assert.ok(record.source.length > 0)
    sources.add(record.source)
  }
  assert.equal(records.length, 77)
  assert.equal(sources.size, 77)
  assert.equal(module.NATIVE_LOOT_ASSET_SOURCES.length, 77)
})

function pairs(
  atlas: NativeLootAtlas,
  first: number,
  last: number,
): Array<readonly [NativeLootAtlas, number]> {
  return Array.from({ length: last - first + 1 }, (_, index) => [atlas, first + index] as const)
}
