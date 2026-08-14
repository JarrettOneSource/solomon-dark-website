import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { PLAYER_CHARACTER_RADIUS } from '../core-kernels/player-character.ts'
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

test('Boneyard entry retains shared player collision against authored geometry', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = [{
    eid: 'east-wall',
    points: [{ x: 220, y: 0 }, { x: 220, y: 500 }],
    segmentCode: 0,
    typeId: 3005,
  }]
  let world = createBoneyardWorld(loaded)
  let players = {
    first: {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'arcane',
        displayName: 'First',
        element: 'fire',
      }, world),
      position: { x: 100, y: 250 },
    },
    second: {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'mind',
        displayName: 'Second',
        element: 'water',
      }, world),
      position: { x: 170, y: 250 },
    },
  }

  for (let tick = 0; tick < 160; tick += 1) {
    const result = stepBoneyardWorldTick(world, players, {
      first: { movement: { x: 1, y: 0 } },
      second: { movement: { x: 0, y: 0 } },
    })
    world = result.world
    players = result.players
  }

  assert.ok(players.second.position.x > 170, 'the moving player must displace the idle player')
  assert.ok(
    players.second.position.x <= 220 - PLAYER_CHARACTER_RADIUS,
    'the authored fence must constrain the pushed player',
  )
  assert.ok(
    players.first.position.x < players.second.position.x,
    'the moving player must not pass through the idle player',
  )
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
