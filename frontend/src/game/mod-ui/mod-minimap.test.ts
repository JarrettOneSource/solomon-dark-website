import assert from 'node:assert/strict'
import test from 'node:test'

import { projectModMinimap } from './mod-minimap.ts'

test('mod Minimap projects self, party, enemies, and powerups around the viewer', () => {
  const model = projectModMinimap({
    players: {
      self: { position: { x: 10, y: 20 } },
      ally: { position: { x: 30, y: 40 } },
    },
    world: {
      enemies: [{ id: 7, position: { x: 50, y: 60 } }],
      kind: 'boneyard',
    },
  }, {
    content: [{
      art: [],
      contentId: '5000000000000000012',
      contentKind: 'ui',
      description: '',
      key: 'field_minimap',
      modId: 'example.mod',
      name: 'Field Minimap',
      presentation: 'prefab.minimap',
    }],
    manifestSha256: 'a'.repeat(64),
    powerups: [{ contentId: '5000000000000000004', id: 2, spawnedTick: 1, x: 70, y: 80 }],
    revision: 1,
    statuses: [],
  }, 'self')
  assert.deepEqual(model?.center, { x: 10, y: 20 })
  assert.deepEqual(model?.markers.map(marker => marker.kind), [
    'self', 'party', 'enemy', 'powerup',
  ])
})

test('mod Minimap stays absent without an admitted minimap surface or viewer', () => {
  const projection = {
    content: [],
    manifestSha256: 'a'.repeat(64),
    powerups: [],
    revision: 0,
    statuses: [],
  } as const
  assert.equal(projectModMinimap({ players: {}, world: { kind: 'hub' } }, projection, 'missing'), null)
})
