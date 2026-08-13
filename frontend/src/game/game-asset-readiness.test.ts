import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { collectAssetSources, loadAssetBatch } from './game-asset-readiness.ts'

const GAME_ASSET_ROOT = new URL('../assets/game/', import.meta.url)

function pngDimensions(name: string): readonly [number, number] {
  const contents = readFileSync(new URL(name, GAME_ASSET_ROOT))
  assert.equal(contents.subarray(1, 4).toString('ascii'), 'PNG')
  return [contents.readUInt32BE(16), contents.readUInt32BE(20)]
}

test('collects a stable unique manifest from nested asset groups', () => {
  assert.deepEqual(
    collectAssetSources({ first: ['a.png', 'b.png'], second: { repeat: 'a.png', last: 'c.png' } }),
    ['a.png', 'b.png', 'c.png'],
  )
})

test('reports actual task completions and resolves only after every asset', async () => {
  const releases = new Map<string, () => void>()
  const progress: Array<readonly [number, number]> = []
  const loading = loadAssetBatch(
    ['one', 'two', 'one'],
    (source) => new Promise<void>((resolve) => releases.set(source, resolve)),
    ({ completed, total }) => progress.push([completed, total]),
  )

  assert.deepEqual(progress, [[0, 2]])
  releases.get('two')?.()
  await Promise.resolve()
  assert.deepEqual(progress, [[0, 2], [1, 2]])
  releases.get('one')?.()
  await loading
  assert.deepEqual(progress, [[0, 2], [1, 2], [2, 2]])
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
