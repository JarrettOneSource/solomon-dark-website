import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  assetDisplayName,
  collectAssetSources,
  loadAssetBatch,
  loadAssetBatches,
  type AssetProgress,
} from './game-asset-readiness.ts'

const GAME_ASSET_ROOT = new URL('../assets/game/', import.meta.url)

function pngDimensions(name: string): readonly [number, number] {
  const contents = readFileSync(new URL(name, GAME_ASSET_ROOT))
  assert.equal(contents.subarray(1, 4).toString('ascii'), 'PNG')
  return [contents.readUInt32BE(16), contents.readUInt32BE(20)]
}

function assetSha256(name: string): string {
  return createHash('sha256')
    .update(readFileSync(new URL(name, GAME_ASSET_ROOT)))
    .digest('hex')
}

test('collects a stable unique manifest from nested asset groups', () => {
  assert.deepEqual(
    collectAssetSources({ first: ['a.png', 'b.png'], second: { repeat: 'a.png', last: 'c.png' } }),
    ['a.png', 'b.png', 'c.png'],
  )
})

test('reports actual task completions and resolves only after every asset', async () => {
  const releases = new Map<string, () => void>()
  const progress: AssetProgress[] = []
  const loading = loadAssetBatch(
    ['one', 'two', 'one'],
    (source) => new Promise<void>((resolve) => releases.set(source, resolve)),
    (next) => progress.push(next),
  )

  assert.deepEqual(progress, [{ activeSource: 'one', completed: 0, total: 2 }])
  releases.get('two')?.()
  await Promise.resolve()
  assert.deepEqual(progress, [
    { activeSource: 'one', completed: 0, total: 2 },
    { activeSource: 'one', completed: 1, total: 2 },
  ])
  releases.get('one')?.()
  await loading
  assert.deepEqual(progress, [
    { activeSource: 'one', completed: 0, total: 2 },
    { activeSource: 'one', completed: 1, total: 2 },
    { activeSource: null, completed: 2, total: 2 },
  ])
})

test('composes staged batches into one de-duplicated monotonic total', async () => {
  const loaded: string[] = []
  const progress: Array<AssetProgress & { stage: 'loader' | 'resident' }> = []

  await loadAssetBatches([
    {
      load: async (source) => { loaded.push(source) },
      sources: ['loader-logo', 'shared'],
      stage: 'loader' as const,
    },
    {
      load: async (source) => { loaded.push(source) },
      sources: ['shared', 'title-art'],
      stage: 'resident' as const,
    },
  ], (next) => progress.push(next))

  assert.deepEqual(loaded, ['loader-logo', 'shared', 'title-art'])
  assert.equal(progress[0]?.completed, 0)
  assert.equal(progress[0]?.total, 3)
  assert.equal(progress.at(-1)?.completed, 3)
  assert.equal(progress.at(-1)?.total, 3)
  assert.ok(progress.some(({ completed, stage }) => stage === 'resident' && completed === 2))
  assert.ok(progress.every((next, index) => (
    index === 0 || next.completed >= progress[index - 1].completed
  )))
})

test('formats readable asset names without Vite transport noise', () => {
  assert.equal(
    assetDisplayName('/src/assets/game/hub-courtyard.png?t=1786712400'),
    'hub-courtyard.png',
  )
  assert.equal(
    assetDisplayName('/assets/hub-courtyard-DhFEGPzz.png'),
    'hub-courtyard.png',
  )
  assert.equal(assetDisplayName('/assets/011-a1B2c3D4.png'), '011.png')
})

test('keeps recovered Hub parity art at its native registrations', () => {
  const dimensions: Readonly<Record<string, readonly [number, number]>> = {
    'hub-astronomer-assistants.png': [1800, 150],
    'hub-astronomer-green-gesture.png': [2250, 450],
    'hub-astronomer-green-idle.png': [1800, 450],
    'hub-astronomer-green-transition.png': [1350, 450],
    'hub-astronomer-red-gesture.png': [2250, 450],
    'hub-astronomer-red-idle.png': [1800, 450],
    'hub-astronomer-red-transition.png': [1350, 450],
    'hub-astronomer-telescope.png': [1870, 292],
    'hub-courtyard-foreground.png': [2000, 1024],
    'hub-hud-inventory-digits.png': [80, 14],
    'hub-hud-font-atlas.png': [512, 256],
    'hub-hud-golem.png': [37, 7],
    'hub-hud-map-compass.png': [121, 118],
    'hub-hud-map-play.png': [121, 118],
    'hub-hud-mouse-right.png': [22, 31],
    'hub-hud-secondary-acid-rain.png': [45, 43],
    'hub-hud-xp-fill.png': [4, 48],
    'hub-hud-xp-frame.png': [12, 56],
    'hub-npc-potion.png': [175, 49],
    'hub-room-arch-chancellor.png': [450, 150],
    'hub-room-arch-desk.png': [819, 819],
    'hub-room-dowser.png': [600, 150],
    'hub-room-librarian-frames.png': [600, 150],
    'hub-room-librarian.png': [992, 819],
    'hub-room-library-background.png': [1024, 1024],
    'hub-room-library-flame.png': [10, 26],
    'hub-room-library-foreground.png': [1024, 1024],
    'hub-room-library-props.png': [3072, 1024],
    'hub-room-memorator-marker.png': [58, 64],
    'hub-room-memorator.png': [2720, 170],
    'hub-room-mortuary-background.png': [1024, 1024],
    'hub-room-mortuary-flame.png': [10, 26],
    'hub-room-mortuary-paintings.png': [740, 224],
    'hub-room-office-background.png': [1024, 1024],
    'hub-room-office-flame.png': [10, 26],
    'hub-room-office-foreground.png': [1024, 1024],
    'hub-room-office-prop.png': [1024, 1024],
    'hub-room-storeroom-background.png': [1075, 800],
    'hub-room-storeroom-flame.png': [10, 26],
    'hub-room-storeroom-foreground.png': [1075, 800],
    'hub-room-storeroom-props.png': [3225, 800],
    'hub-courtyard-depth-props.png': [2032, 263],
    'hub-southern-battlement.png': [209, 126],
    'hub-southern-platform-east.png': [530, 415],
    'hub-southern-platform-west.png': [365, 407],
    'hub-southern-seam.png': [58, 125],
    'hub-southern-tower.png': [179, 186],
    'hub-tent-back.png': [2000, 1024],
    'hub-tent-balloons.png': [270, 72],
  }
  for (const [name, expected] of Object.entries(dimensions)) {
    assert.deepEqual(pngDimensions(name), expected, name)
  }
})

test('locks every native primary-cast extraction in one asset manifest', () => {
  const manifest: Readonly<Record<string, {
    dimensions?: readonly [number, number]
    sha256: string
  }>> = {
    'audio/sfx/gather-rocks-loop.wav': {
      sha256: '143cfa6a54d77570d3d929c3c536fe0306a9a1f1f5292cf4c1521481d5895990',
    },
    'audio/sfx/ice-loop.wav': {
      sha256: 'fd9aa082bd5bb3b6197528a5f2d6771aac7e2f478d8bdca0abd3d521c70fc89a',
    },
    'audio/sfx/ice-start.wav': {
      sha256: '28cfda1e9d59f39dfacfd808cdb267465592ae5ce0d34a9aa4495a3f659b9694',
    },
    'audio/sfx/lightning-loop.wav': {
      sha256: '4bdd74a6734206d1212c52d623d0b7fe994bf4beeaa2119d34f3d1fad7d68281',
    },
    'audio/sfx/lightning-start.wav': {
      sha256: '1542ec3ab4e41624b5e8d073000a02bb36a3f8c733bf709835768f095494dceb',
    },
    'audio/sfx/magic-missile.wav': {
      sha256: 'a7765b778d5cc49546c5e7e7822f38aac6a3edd8636d91e4ae92ec78611ac567',
    },
    'audio/sfx/rolling-stone-loop.wav': {
      sha256: '66a306a2ebe8443cb017ce8c3737477f196600a82af7472201cc123f70cee706',
    },
    'audio/sfx/start-boulder.wav': {
      sha256: 'c7bbd54f293ae2b8a9dbde4d8a6810a5f98f46ee6fb20912b378631a5033d503',
    },
    'audio/sfx/throw-fire.wav': {
      sha256: 'b6e14b90d00e27a9b2ceba404ea1c113a7d7bf5f14aa69987ec9629669b53de0',
    },
    'element-vfx-core.png': {
      dimensions: [27, 26],
      sha256: 'dc85c8e39483f4256ec7b28240d33a15b6966c0e997554598f19091d7a4c189f',
    },
    'element-vfx-fire.png': {
      dimensions: [384, 54],
      sha256: 'e7cc1d4a3233eab0d93e24684c952779f1c0a88b28cd70a1e738156ce80fcd2b',
    },
    'element-vfx-ray.png': {
      dimensions: [40, 40],
      sha256: 'd442af9ee058baceb7df36d682a4663cfd207818572fe77830833ef555802630',
    },
    'primary-spell-fire-particles.png': {
      dimensions: [100, 25],
      sha256: '08a272090c4fd14b41a4f6ff990d4a1bb25ff1cf729f3e08098c8c35066cbd3c',
    },
    'element-vfx-spark.png': {
      dimensions: [40, 40],
      sha256: '3b02db24cc4caaad26432e4bf3e480c71c1a99e9cc8fb4fb4703077af22180c0',
    },
    'player-character-robe-fixed-air.png': {
      dimensions: [1700, 4080],
      sha256: 'f1dcd51715071a958ea5dd71a606c27301396295a628fe7bf34bed03b3d0c401',
    },
    'player-character-robe-fixed-earth.png': {
      dimensions: [1700, 4080],
      sha256: 'e5480c5819fd9bf6c696f77d6a3228d76b843471a887a4f1caf4d3207faca3f8',
    },
    'player-character-robe-fixed-ether.png': {
      dimensions: [1700, 4080],
      sha256: '6b98394e62cef6415b0cf816def96987ee2498b75c9e94d1b26b92058be1d166',
    },
    'player-character-robe-fixed-fire.png': {
      dimensions: [1700, 4080],
      sha256: '1baac4dcf15b7871ade40e4526fb35ca08891c89b0ae9a8c136e8f806518048c',
    },
    'player-character-robe-fixed-water.png': {
      dimensions: [1700, 4080],
      sha256: '6336d092bb3619bfdf39c66491cb118fbae27ce32220a2004e8ec5e3d750f964',
    },
    'player-character-staff-back.png': {
      dimensions: [1700, 4080],
      sha256: 'e47d4977140767c354363c8808631e933733a96404d2741a61a18b9adcc2ba23',
    },
    'player-character-staff-front.png': {
      dimensions: [1700, 4080],
      sha256: 'e7923b25771a6eb00cdd780cd6902ce3e9cd050e961cbb35c1a4d65201731c0a',
    },
    'primary-spell-earth-glimmer.png': {
      dimensions: [94, 94],
      sha256: '0a6d5925da9f87d26eadd7d3a8e9bfea71471209163eb44671f9e6174baf7e1e',
    },
    'primary-spell-earth-lit-rock-0.png': {
      dimensions: [37, 33],
      sha256: 'db614042c6ba99a42c4a6c040d2026ef9f5e99bc938a0ce9b3a9d549959a0b58',
    },
    'primary-spell-earth-lit-rock-1.png': {
      dimensions: [33, 32],
      sha256: '1192e5a42a2b045bccd6a43565b88e396a20e4b678cfcba397229b098e7f6d9b',
    },
    'primary-spell-earth-lit-rock-2.png': {
      dimensions: [38, 34],
      sha256: '76ebbed82a78e2e003ee3038286002ad10f9fca67093fdcbfbc39f8c1e85f988',
    },
    'primary-spell-earth-rock-0.png': {
      dimensions: [37, 33],
      sha256: 'cadc84452743aee24a3fb45a0092f75e34ddb76d1c903f960f63ecb9af48daca',
    },
    'primary-spell-earth-rock-1.png': {
      dimensions: [33, 32],
      sha256: 'e5cfd7d0bf24482973df9e7efd37a605bf2e221a149e94542b3653f4173e4c61',
    },
    'primary-spell-earth-rock-2.png': {
      dimensions: [38, 34],
      sha256: '0d9c3dd4906dff44c34a2a21547ee3250e46ffbfac136b7decc5523eabba5de2',
    },
    'primary-spell-earth-rock-center.png': {
      dimensions: [17, 17],
      sha256: 'c1d53171295dbc05522a296a8464b195d61738d3ef0566ac8e860e6de2583203',
    },
    'primary-spell-frost-core.png': {
      dimensions: [93, 145],
      sha256: '62aac46ed0f3436cf39023b2c93e8c02b8dee3c0611e74179cc5af92793470b5',
    },
    'primary-spell-frost-extra.png': {
      dimensions: [29, 30],
      sha256: 'eb07de5b4d61b81e48cf34d939a04de461c435d6592580a86e1f30e470ffd6ff',
    },
    'primary-spell-frost-over.png': {
      dimensions: [10, 11],
      sha256: 'e118b2feb22c5ffd4c5f0981e20044b8df6181ead01c572965143ad959e24d60',
    },
    'primary-spell-frost-spark.png': {
      dimensions: [92, 91],
      sha256: '2020e10b7557792c13cc1939a71db8ed3459d32b5554efa120ea4c3d5e6117cb',
    },
    'primary-spell-magic-missile.png': {
      dimensions: [28, 58],
      sha256: '71a6e48a62a0ad1458fee3498bc6b7727cb96f5da173a040d4a97e929e383152',
    },
  }

  for (const [name, expected] of Object.entries(manifest)) {
    assert.equal(assetSha256(name), expected.sha256, name)
    if (expected.dimensions) {
      assert.deepEqual(pngDimensions(name), expected.dimensions, name)
    }
  }
})
