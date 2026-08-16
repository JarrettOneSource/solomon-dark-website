import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

test('the stock right-click atlas membership is complete and every row is registered', async () => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    server: { middlewareMode: true },
  })
  try {
    const module = await server.ssrLoadModule('/src/game/renderer/native-secondary-assets.ts') as {
      NATIVE_SECONDARY_ASSET_SOURCES: readonly string[]
      NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES: Readonly<{ etherPlane: string }>
      NATIVE_SECONDARY_SPRITE_MEMBERSHIP: Readonly<Record<'BadGuys' | 'DeadHawg' | 'Golem', readonly number[]>>
      NATIVE_SECONDARY_SPRITE_RECORDS: readonly unknown[]
      nativeSecondarySpriteRecord(atlas: 'BadGuys' | 'DeadHawg' | 'Golem', entry: number): { source: string }
    }
    const membership = module.NATIVE_SECONDARY_SPRITE_MEMBERSHIP
    assert.deepEqual(membership.BadGuys.slice(0, 26), [
      0, 7, 10, 11, 15, 16, 17, 22, 36, 38, 39, 45, 48, 49, 51, 53, 58, 62, 68, 72, 74, 75, 78, 84, 85, 86,
    ])
    assert.equal(membership.BadGuys.includes(343), true)
    assert.equal(membership.BadGuys.includes(400), true)
    assert.equal(membership.BadGuys.includes(2008), true)
    for (const entry of [15, 16, 17, 74, 85, 111, 112, 158, 167]) {
      assert.equal(membership.BadGuys.includes(entry), true, `missing Magic Trap record ${entry}`)
    }
    assert.equal(membership.DeadHawg.includes(2), true)
    assert.equal(membership.DeadHawg.includes(18), true)
    assert.equal(membership.DeadHawg.includes(46), true)
    assert.equal(membership.DeadHawg.includes(114), true)
    assert.equal(membership.DeadHawg.includes(121), true)
    assert.equal(membership.DeadHawg.includes(207), true)
    assert.equal(membership.BadGuys.includes(333), true)
    assert.equal(membership.BadGuys.includes(342), true)
    assert.equal(membership.Golem.length, 203)
    assert.equal(
      module.NATIVE_SECONDARY_ASSET_SOURCES.length,
      module.NATIVE_SECONDARY_SPRITE_RECORDS.length + 1,
    )
    assert.ok(module.NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES.etherPlane.includes('etherplane.png'))
    const etherPlane = await readFile(new URL(
      '../../assets/game/boneyard/textures/etherplane.png',
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(etherPlane).digest('hex'),
      'cd9aee555fecde2d4917e1776f6bff927c8957e813659dcf163798a2c9e398fb',
    )
    assert.ok(module.nativeSecondarySpriteRecord('BadGuys', 343).source.includes('0343.png'))
    assert.ok(module.nativeSecondarySpriteRecord('BadGuys', 22).source.includes('0022.png'))
    assert.throws(() => module.nativeSecondarySpriteRecord('BadGuys', 1), /outside the closed membership/)
  } finally {
    await server.close()
  }
})
