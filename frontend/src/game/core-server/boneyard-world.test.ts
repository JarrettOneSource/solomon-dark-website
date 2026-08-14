import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  createBoneyardWorld,
  retireBoneyardWorldEnemy,
  spawnPlayerCharacterInBoneyard,
  stepBoneyardWorldTick,
} from './boneyard-world.ts'

function movementInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, secondary: false },
    movement: { x, y },
  }
}

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
      { player: movementInput(0, 1) },
      tick,
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
  let players: Readonly<Record<string, PlayerCharacterState>> = {
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
    const result = stepBoneyardWorldTick(
      world,
      players,
      {
        first: movementInput(1, 0),
        second: movementInput(0, 0),
      },
      tick,
    )
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

test('default Boneyard walks through Solomon dialogue, retreat, then authoritative spawns', () => {
  let world = createBoneyardWorld(encounterBoneyard('default'))
  let player = spawnPlayerCharacterInBoneyard({
    discipline: 'arcane',
    displayName: 'Encounter Tester',
    element: 'ether',
  }, world)

  let result = stepBoneyardWorldTick(world, { player }, {}, 1)
  world = result.world
  player = result.players.player
  assert.equal(world.encounter?.phase, 'turning')
  let tick = 2
  while (world.encounter?.phase === 'turning') {
    result = stepBoneyardWorldTick(world, { player }, {}, tick)
    world = result.world
    player = result.players.player
    tick += 1
    if (tick > 100) throw new Error('Solomon did not finish native facing')
  }
  assert.equal(world.encounter?.phase, 'speaking')

  const lockedPosition = { ...player.position }
  for (let lockedTick = 0; lockedTick < 17; lockedTick += 1) {
    result = stepBoneyardWorldTick(
      world,
      { player },
      { player: movementInput(1, 0) },
      tick,
    )
    world = result.world
    player = result.players.player
    tick += 1
  }
  assert.deepEqual(player.position, lockedPosition)

  while ((world.encounter?.runEventId ?? 0) === 0) {
    result = stepBoneyardWorldTick(world, { player }, {}, tick)
    world = result.world
    player = result.players.player
    tick += 1
    if (tick > 1200) throw new Error('Solomon did not reach the native run edge')
  }
  assert.equal(world.waves?.phase, 'opening')
  assert.equal(world.waves?.enemies.length, 0)

  result = stepBoneyardWorldTick(world, { player }, {}, tick)
  world = result.world
  assert.equal(world.waves?.enemies.length, 10)
  assert.ok(world.waves?.enemies.every((enemy) => (
    enemy.enemyToken === 'SKELETON'
    && enemy.flags.includes('FLAG_WEAK')
    && enemy.flags.includes('FLAG_HPDOWN')
    && enemy.flags.includes('FLAG_XPBONUS')
  )))
  const enemyId = world.waves!.enemies[0].id
  const retired = retireBoneyardWorldEnemy(world, enemyId)
  assert.equal(retired.waves?.enemies.length, 9)
})

test('mod Boneyards retain opaque script ownership instead of receiving retail waves', () => {
  const world = createBoneyardWorld(encounterBoneyard('mod'))
  assert.equal(world.encounter, null)
  assert.equal(world.waves, null)
})

test('retains Gravestones as stable lower-priority Lightning targets', () => {
  const loaded = gatedBoneyard()
  loaded.scene.objects = [
    { eid: 'grave-7', typeId: 2029, pos: { x: 300, y: 320 }, variant: 2 },
    { eid: 'tree-2', typeId: 2001, pos: { x: 400, y: 420 }, variant: 0 },
  ]
  assert.deepEqual(createBoneyardWorld(loaded).scenerySpellTargets, [{
    airPriority: 1000,
    attachment: { x: 0, y: 0 },
    id: 'scenery:grave-7',
    kind: 'gravestone',
    position: { x: 300, y: 320 },
  }])
})

test('Solomon escape intent is clipped by authoritative Boneyard collision', () => {
  const loaded = encounterBoneyard('default')
  const world = createBoneyardWorld({
    ...loaded,
    scene: {
      ...loaded.scene,
      fences: [{
        eid: 'escape-wall',
        points: [{ x: 1025, y: 900 }, { x: 1025, y: 1100 }],
        segmentCode: 0,
        typeId: 3005,
      }],
    },
  })
  assert.ok(world.encounter)
  const escaping = {
    ...world,
    encounter: {
      ...world.encounter,
      acceleration: -3,
      escapeSpeed: 10,
      headingDeg: 90,
      lifetimeTicksRemaining: 100,
      phase: 'escaping' as const,
      position: { x: 1000, y: 1000 },
    },
  }

  const result = stepBoneyardWorldTick(escaping, {}, {}, 1)

  assert.ok(result.world.encounter)
  assert.ok(result.world.encounter.position.x < 1007.01)
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

function encounterBoneyard(source: 'default' | 'mod'): LoadedBoneyard {
  return {
    choice: {
      id: source === 'default' ? 'default-random' : 'mod:test',
      name: 'Encounter fixture',
      source,
      ...(source === 'mod' ? { modId: 'test', modName: 'Test' } : {}),
    },
    geometrySha256: 'd'.repeat(64),
    runId: `encounter-${source}`,
    seed: `encounter-${source}-seed`,
    sourceSha256: 'c'.repeat(64),
    scene: {
      bounds: { x: 0, y: 0, w: 2000, h: 1600 },
      environmentMode: 0,
      fences: [],
      name: 'Encounter fixture',
      objects: [],
      roads: [],
      solomonDig: {
        frameProgram: [0, 3, 1],
        gravePosition: { x: 990, y: 887 },
        lanternPosition: { x: 935, y: 927 },
        position: { x: 1000, y: 1000 },
        ticksPerFrame: 5,
      },
      spawn: { facingDeg: 180, x: 1000, y: 990 },
      sprites: [],
      terrain: [],
    },
  }
}
