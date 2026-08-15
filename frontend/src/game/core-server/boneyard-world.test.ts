import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  boneyardPrimarySpellTargets,
  createBoneyardWorld,
  spawnPlayerCharacterInBoneyard,
  stepBoneyardWorldTick,
} from './boneyard-world.ts'
import {
  damageBoneyardEnemy,
  stepBoneyardEnemyStore,
} from './boneyard-enemy-store.ts'

function movementInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, secondary: false },
    movement: { x, y },
  }
}

function stepWorld(
  world: Parameters<typeof stepBoneyardWorldTick>[0],
  players: Parameters<typeof stepBoneyardWorldTick>[1],
  inputs: Parameters<typeof stepBoneyardWorldTick>[2],
  tick: number,
) {
  return stepBoneyardWorldTick(
    world,
    players,
    inputs,
    Object.fromEntries(Object.keys(players).map((playerId) => [
      playerId,
      { alive: true, eligible: true, movementScale: 1 },
    ])),
    tick,
  )
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
    const result = stepWorld(
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
    const result = stepWorld(
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

test('enemy locomotion resolves against players and peer actors before committing', () => {
  let world = createBoneyardWorld(gatedBoneyard())
  let player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Collision Target',
      element: 'fire',
    }, world),
    position: { x: 140, y: 250 },
  }
  const seeded = stepBoneyardEnemyStore(world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {
      player: {
        alive: true,
        collisionRadius: PLAYER_CHARACTER_RADIUS,
        connected: true,
        eligible: true,
        position: player.position,
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [50, 70].map((x, index) => ({
      enemyToken: 'SKELETON' as const,
      flags: [],
      id: index + 1,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x, y: 250 },
      spawnTick: 0,
      waveOrdinal: 1,
    })),
    tick: 0,
  })
  world = { ...world, enemies: seeded.store }

  for (let tick = 1; tick <= 2; tick += 1) {
    const result = stepWorld(world, { player }, {}, tick)
    world = result.world
    player = result.players.player
  }

  const [first, second] = world.enemies.actors
  assert.ok(first && second)
  assert.ok(
    Math.hypot(
      first.position.x - second.position.x,
      first.position.y - second.position.y,
    ) >= first.config.collisionRadius + second.config.collisionRadius,
  )
  for (const enemy of world.enemies.actors) {
    assert.ok(
      Math.hypot(
        enemy.position.x - player.position.x,
        enemy.position.y - player.position.y,
      ) >= enemy.config.collisionRadius + PLAYER_CHARACTER_RADIUS,
    )
  }
})

test('player movement separates from live enemy circles and commits the displaced enemy', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = []
  let world = createBoneyardWorld(loaded)
  let player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Enemy Pusher',
      element: 'fire',
    }, world),
    position: { x: 100, y: 350 },
  }
  const seeded = stepBoneyardEnemyStore(world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON' as const,
      flags: [],
      id: 1,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 145, y: 350 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  world = {
    ...world,
    enemies: {
      ...seeded.store,
      actors: seeded.store.actors.map((actor) => ({
        ...actor,
        nextMovementTick: 10_000,
      })),
    },
  }
  const initialEnemyX = world.enemies.actors[0]!.position.x

  for (let tick = 1; tick <= 80; tick += 1) {
    const result = stepWorld(
      world,
      { player },
      { player: movementInput(1, 0) },
      tick,
    )
    world = result.world
    player = result.players.player
  }

  const enemy = world.enemies.actors[0]!
  assert.ok(enemy.position.x > initialEnemyX, 'the authoritative enemy position must retain player push')
  assert.ok(
    Math.hypot(
      enemy.position.x - player.position.x,
      enemy.position.y - player.position.y,
    ) >= enemy.config.collisionRadius + PLAYER_CHARACTER_RADIUS,
  )
  assert.ok(player.position.x < enemy.position.x, 'the player must not pass through the enemy')
})

test('player movement separates from a live owned Maggot and commits the displaced child', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = []
  let world = createBoneyardWorld(loaded)
  let player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'mind',
      displayName: 'Maggot Pusher',
      element: 'water',
    }, world),
    position: { x: 100, y: 350 },
  }
  let seeded = stepBoneyardEnemyStore(world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'COFFIN' as const,
      flags: [],
      id: 1,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.COFFIN,
      position: { x: 350, y: 350 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const coffin = seeded.store.actors[0]!
  if (coffin.brain.family !== 'coffin') throw new Error('expected Coffin brain')
  seeded = stepBoneyardEnemyStore({
    ...seeded.store,
    actors: [{
      ...coffin,
      brain: {
        ...coffin.brain,
        phase: 'opening',
        phaseTicksRemaining: 1,
      },
    }],
  }, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [],
    tick: 1,
  })
  const maggot = seeded.store.maggots[0]!
  world = {
    ...world,
    enemies: {
      ...seeded.store,
      maggots: [{
        ...maggot,
        nextAttackTick: 10_000,
        nextMovementTick: 10_000,
        position: { x: 133, y: 350 },
      }],
    },
  }
  const initialMaggotX = world.enemies.maggots[0]!.position.x

  for (let tick = 2; tick <= 50; tick += 1) {
    const result = stepWorld(
      world,
      { player },
      { player: movementInput(1, 0) },
      tick,
    )
    world = result.world
    player = result.players.player
  }

  const retained = world.enemies.maggots[0]!
  assert.ok(retained.position.x > initialMaggotX, 'the authoritative Maggot position must retain player push')
  assert.ok(
    Math.hypot(
      retained.position.x - player.position.x,
      retained.position.y - player.position.y,
    ) >= retained.collisionRadius + PLAYER_CHARACTER_RADIUS,
  )
  assert.ok(player.position.x < retained.position.x, 'the player must not pass through the Maggot')
})

test('default Boneyard walks through Solomon dialogue, retreat, then authoritative spawns', () => {
  let world = createBoneyardWorld(encounterBoneyard('default'))
  let player = spawnPlayerCharacterInBoneyard({
    discipline: 'arcane',
    displayName: 'Encounter Tester',
    element: 'ether',
  }, world)

  let result = stepWorld(world, { player }, {}, 1)
  world = result.world
  player = result.players.player
  assert.equal(world.encounter?.phase, 'turning')
  let tick = 2
  while (world.encounter?.phase === 'turning') {
    result = stepWorld(world, { player }, {}, tick)
    world = result.world
    player = result.players.player
    tick += 1
    if (tick > 100) throw new Error('Solomon did not finish native facing')
  }
  assert.equal(world.encounter?.phase, 'speaking')

  const lockedPosition = { ...player.position }
  for (let lockedTick = 0; lockedTick < 17; lockedTick += 1) {
    result = stepWorld(
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
    result = stepWorld(world, { player }, {}, tick)
    world = result.world
    player = result.players.player
    tick += 1
    if (tick > 1200) throw new Error('Solomon did not reach the native run edge')
  }
  assert.equal(world.waves?.phase, 'opening')
  assert.equal(world.enemies.actors.length, 0)

  result = stepWorld(world, { player }, {}, tick)
  world = result.world
  assert.equal(world.enemies.actors.length, 10)
  assert.ok(world.enemies.actors.every((enemy) => (
    enemy.config.enemyToken === 'SKELETON'
    && enemy.config.flags.includes('FLAG_WEAK')
    && enemy.config.flags.includes('FLAG_HPDOWN')
    && enemy.config.flags.includes('FLAG_XPBONUS')
  )))
  const firstEnemy = world.enemies.actors[0]
  assert.deepEqual(boneyardPrimarySpellTargets(world)[0], {
    airPriority: 0,
    attachment: { x: 0, y: 0 },
    id: `enemy:${firstEnemy.id}`,
    kind: 'enemy',
    position: firstEnemy.position,
  })
  const enemyId = world.enemies.actors[0].id
  const damaged = damageBoneyardEnemy(world.enemies, {
    actorId: enemyId,
    amount: Number.MAX_SAFE_INTEGER,
    sourcePlayerId: 'player',
    tick,
  })
  assert.equal(damaged.killed, true)
  assert.equal(damaged.store.actors[0].lifeState, 'dying')

  const frozenWaves = world.waves
  for (let noTargetTick = 0; noTargetTick < 600; noTargetTick += 1) {
    result = stepBoneyardWorldTick(
      world,
      { player },
      {},
      { player: { alive: false, eligible: false, movementScale: 0 } },
      tick + noTargetTick + 1,
    )
    world = result.world
    player = result.players.player
  }
  assert.deepEqual(world.waves, frozenWaves)
  assert.equal(world.enemies.actors.length, 10)
})

test('Solomon ignores dead and ineligible proximity targets', () => {
  let world = createBoneyardWorld(encounterBoneyard('default'))
  const player = spawnPlayerCharacterInBoneyard({
    discipline: 'arcane',
    displayName: 'Spectator',
    element: 'ether',
  }, world)

  let result = stepBoneyardWorldTick(
    world,
    { player },
    {},
    { player: { alive: false, eligible: false, movementScale: 0 } },
    1,
  )
  world = result.world
  assert.equal(world.encounter?.phase, 'digging')
  assert.equal(world.encounter?.targetPlayerId, null)

  result = stepBoneyardWorldTick(
    world,
    { player: result.players.player },
    {},
    { player: { alive: true, eligible: true, movementScale: 1 } },
    2,
  )
  assert.equal(result.world.encounter?.phase, 'turning')
  assert.equal(result.world.encounter?.targetPlayerId, 'player')
})

test('primary spell targets use live authoritative enemy actors and owned Maggots', () => {
  let world = createBoneyardWorld(gatedBoneyard())
  let seeded = stepBoneyardEnemyStore(world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'COFFIN',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.COFFIN,
      position: { x: 250, y: 250 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const coffin = seeded.store.actors[0]
  assert.ok(coffin)
  if (coffin.brain.family !== 'coffin') throw new Error('expected Coffin brain')
  seeded = stepBoneyardEnemyStore({
    ...seeded.store,
    actors: [{
      ...coffin,
      brain: {
        ...coffin.brain,
        phase: 'opening',
        phaseTicksRemaining: 1,
      },
    }],
  }, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [],
    tick: 1,
  })
  assert.equal(seeded.store.maggots.length, 20)

  const killed = damageBoneyardEnemy(seeded.store, {
    actorId: coffin.id,
    amount: Number.MAX_SAFE_INTEGER,
    sourcePlayerId: 'player',
    tick: 1,
  })
  world = { ...world, enemies: killed.store }

  assert.deepEqual(
    boneyardPrimarySpellTargets(world).map(({ id }) => id),
    world.enemies.maggots.map(({ id }) => `enemy:${id}`),
  )
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

  const result = stepWorld(escaping, {}, {}, 1)

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
