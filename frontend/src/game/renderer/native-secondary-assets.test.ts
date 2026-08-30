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
      NATIVE_SECONDARY_STOCK_FRAMED_ASSET_SOURCES: readonly string[]
      NATIVE_SECONDARY_SPRITE_MEMBERSHIP: Readonly<Record<'BadGuys' | 'Clothes' | 'DeadHawg' | 'Golem', readonly number[]>>
      NATIVE_SECONDARY_SPRITE_RECORDS: readonly unknown[]
      nativeSecondarySpriteRecord(atlas: 'BadGuys' | 'Clothes' | 'DeadHawg' | 'Golem', entry: number): { source: string }
    }
    const hubTextures = await server.ssrLoadModule('/src/game/renderer/hub-textures.ts') as {
      hubWorldAssetSources(): readonly string[]
    }
    const hubVisualAtlas = await server.ssrLoadModule('/src/game/renderer/hub-visual-atlas.ts') as {
      HUB_VISUAL_ATLAS_DECODED_BYTES: number
      HUB_VISUAL_ATLAS_ORIGINAL_SOURCES: readonly string[]
      HUB_VISUAL_ATLAS_SOURCES: readonly string[]
    }
    const membership = module.NATIVE_SECONDARY_SPRITE_MEMBERSHIP
    assert.deepEqual(membership.BadGuys.slice(0, 29), [
      0, 7, 10, 11, 15, 16, 17, 22, 36, 38, 39, 40, 45, 48, 49, 51, 53, 55, 58, 62, 63, 68, 72, 74, 75, 78, 84, 85, 86,
    ])
    assert.equal(membership.BadGuys.includes(343), true)
    assert.equal(membership.BadGuys.includes(400), true)
    assert.deepEqual(
      membership.BadGuys.filter((entry) => entry >= 401 && entry <= 433),
      Array.from({ length: 33 }, (_, index) => 401 + index),
    )
    assert.equal(membership.BadGuys.includes(2008), true)
    assert.deepEqual(membership.Clothes, [2])
    for (const entry of [15, 40, 45, 55, 88]) {
      assert.equal(membership.BadGuys.includes(entry), true, `missing Staff VFX record ${entry}`)
      const record = module.nativeSecondarySpriteRecord('BadGuys', entry) as unknown as {
        anchorX: number
        anchorY: number
        height: number
        width: number
      }
      assert.equal(record.anchorX / record.width, 0.5)
      assert.equal(record.anchorY / record.height, 0.5)
    }
    for (const entry of [15, 16, 17, 74, 85, 111, 112, 158, 167]) {
      assert.equal(membership.BadGuys.includes(entry), true, `missing Magic Trap record ${entry}`)
    }
    assert.deepEqual(
      membership.BadGuys.filter((entry) => entry >= 255 && entry <= 266),
      Array.from({ length: 12 }, (_, index) => 255 + index),
    )
    const dampenProjectileEntries = [
      ...Array.from({ length: 12 }, (_, index) => 255 + index),
      110,
      111,
      112,
    ]
    for (const entry of dampenProjectileEntries) {
      assert.match(
        module.nativeSecondarySpriteRecord('BadGuys', entry).source,
        /^boneyard-combat:BadGuys:/,
        `Dampen projectile record ${entry} did not reuse the loaded combat atlas`,
      )
    }
    assert.equal(membership.DeadHawg.includes(2), true)
    assert.equal(membership.DeadHawg.includes(4), true)
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
    assert.deepEqual(module.NATIVE_SECONDARY_STOCK_FRAMED_ASSET_SOURCES, [
      module.nativeSecondarySpriteRecord('Clothes', 2).source,
    ])
    const hubSources = new Set(hubTextures.hubWorldAssetSources())
    assert.equal(hubVisualAtlas.HUB_VISUAL_ATLAS_DECODED_BYTES, 44_408_832)
    assert.equal(hubVisualAtlas.HUB_VISUAL_ATLAS_SOURCES.length, 3)
    assert.equal(hubVisualAtlas.HUB_VISUAL_ATLAS_ORIGINAL_SOURCES.length, 87)
    for (const source of hubVisualAtlas.HUB_VISUAL_ATLAS_SOURCES) {
      assert.equal(hubSources.has(source), true, `Hub omitted compact visual page ${source}`)
    }
    const loadedOriginals = hubVisualAtlas.HUB_VISUAL_ATLAS_ORIGINAL_SOURCES.filter((source) => (
      hubSources.has(source)
    ))
    assert.equal(loadedOriginals.length, 1)
    assert.match(loadedOriginals[0]!, /hub-prop-statue-aura/)
    for (const source of hubVisualAtlas.HUB_VISUAL_ATLAS_ORIGINAL_SOURCES) {
      if (source === loadedOriginals[0]) continue
      assert.equal(hubSources.has(source), false, `Hub still requests padded visual ${source}`)
    }
    for (const source of module.NATIVE_SECONDARY_ASSET_SOURCES) {
      const physicallyLoaded = !source.startsWith('boneyard-combat:')
      assert.equal(
        hubSources.has(source),
        physicallyLoaded,
        `Hub physical-source ownership drifted for ${source}`,
      )
    }
    const etherPlane = await readFile(new URL(
      '../../assets/game/boneyard/textures/etherplane.png',
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(etherPlane).digest('hex'),
      'cd9aee555fecde2d4917e1776f6bff927c8957e813659dcf163798a2c9e398fb',
    )
    assert.equal(module.nativeSecondarySpriteRecord('BadGuys', 343).source, 'boneyard-combat:BadGuys:343')
    assert.equal(module.nativeSecondarySpriteRecord('BadGuys', 22).source, 'boneyard-combat:BadGuys:22')
    assert.equal(module.nativeSecondarySpriteRecord('BadGuys', 63).source, 'boneyard-combat:BadGuys:63')
    assert.equal(module.nativeSecondarySpriteRecord('BadGuys', 78).source, 'boneyard-combat:BadGuys:78')
    assert.equal(module.nativeSecondarySpriteRecord('DeadHawg', 4).source, 'boneyard-combat:DeadHawg:4')
    assert.equal(module.nativeSecondarySpriteRecord('Golem', 1).source, 'boneyard-combat:Golem:1')
    assert.ok(module.nativeSecondarySpriteRecord('Clothes', 2).source.includes('player-mindblast-ring.png'))
    const mindblastRing = await readFile(new URL(
      '../../assets/game/player-mindblast-ring.png',
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(mindblastRing).digest('hex'),
      '9312387b1ba6a8eba523eaf955504c564f39aec89e1d67fbfd10e358991a627e',
    )
    assert.throws(() => module.nativeSecondarySpriteRecord('BadGuys', 1), /outside the closed membership/)
  } finally {
    await server.close()
  }
})
