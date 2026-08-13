import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  createBoneyardWorld,
  spawnPlayerCharacterInBoneyard,
  stepBoneyardWorldTick,
} from './boneyard-world.ts'

test('a wizard pushes both native gate leaves aside and crosses the opening', () => {
  let world = createBoneyardWorld(gatedBoneyard())
  const initialTips = world.gateLeaves.map((leaf) => ({ ...leaf.tip }))
  let player = spawnPlayerCharacterInBoneyard({
    discipline: 'arcane',
    displayName: 'Gate Tester',
    element: 'fire',
  }, world)

  for (let tick = 0; tick < 220; tick += 1) {
    const result = stepBoneyardWorldTick(
      world,
      { player },
      { player: { movement: { x: 0, y: 1 } } },
    )
    world = result.world
    player = result.players.player
  }

  assert.ok(player.position.y > 325)
  assert.equal(world.gateLeaves.length, 2)
  assert.ok(world.gateLeaves.every((leaf, index) => (
    leaf.tip.y > initialTips[index].y + 50
  )))
})

function gatedBoneyard(): LoadedBoneyard {
  return {
    choice: { id: 'default-random', name: 'Default Boneyard', source: 'default' },
    geometrySha256: 'b'.repeat(64),
    runId: 'gate-crossing-run',
    seed: 'gate-crossing-seed',
    sourceSha256: 'a'.repeat(64),
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 },
      environmentMode: 2,
      fences: [{
        eid: 'entry-gate',
        points: [{ x: 100, y: 200 }, { x: 300, y: 200 }],
        segmentCode: 2,
        typeId: 3005,
      }],
      name: 'Gate crossing fixture',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 200, y: 120 },
      sprites: [],
      terrain: [],
    },
  }
}
