import assert from 'node:assert/strict'
import test from 'node:test'

import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../core-kernels/boneyard-zombie-beat.ts'
import { startBoneyardArenaTransition } from '../core-kernels/boneyard-arena-transition.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import {
  createBoneyardWaveDirector,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
} from '../core-kernels/boneyard-wave-director.ts'
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
  BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
  damageBoneyardEnemy,
  NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS,
  stepBoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  canPlaceBoneyardBody,
  resolveBoneyardMovement,
} from './boneyard-collision.ts'

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
      { alive: true, collisionEnabled: true, eligible: true, movementScale: 1 },
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

test('collision-disabled death presentation neither moves nor blocks a living player', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = []
  let world = createBoneyardWorld(loaded)
  let players: Readonly<Record<string, PlayerCharacterState>> = {
    corpse: {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'mind',
        displayName: 'Corpse',
        element: 'water',
      }, world),
      position: { x: 145, y: 350 },
    },
    living: {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'arcane',
        displayName: 'Living',
        element: 'fire',
      }, world),
      position: { x: 100, y: 350 },
    },
  }
  const corpsePosition = { ...players.corpse!.position }

  for (let tick = 1; tick <= 80; tick += 1) {
    const result = stepBoneyardWorldTick(
      world,
      players,
      {
        corpse: movementInput(1, 0),
        living: movementInput(1, 0),
      },
      {
        corpse: {
          alive: false,
          collisionEnabled: false,
          eligible: false,
          movementScale: 0,
        },
        living: {
          alive: true,
          collisionEnabled: true,
          eligible: true,
          movementScale: 1,
        },
      },
      tick,
    )
    world = result.world
    players = result.players
  }

  assert.deepEqual(players.corpse!.position, corpsePosition)
  assert.ok(
    players.living!.position.x > corpsePosition.x + PLAYER_CHARACTER_RADIUS,
    'the living player must pass through the disabled corpse body',
  )
})

test('collision-disabled death presentation does not block enemy locomotion', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = []
  let world = createBoneyardWorld(loaded)
  let players: Readonly<Record<string, PlayerCharacterState>> = {
    corpse: {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'mind',
        displayName: 'Corpse',
        element: 'water',
      }, world),
      position: { x: 145, y: 350 },
    },
    living: {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'arcane',
        displayName: 'Living Target',
        element: 'fire',
      }, world),
      position: { x: 400, y: 350 },
    },
  }
  const seeded = stepBoneyardEnemyStore(world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {
      living: {
        alive: true,
        collisionRadius: PLAYER_CHARACTER_RADIUS,
        connected: true,
        eligible: true,
        position: players.living!.position,
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON' as const,
      flags: [],
      id: 1,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 100, y: 350 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  world = { ...world, enemies: seeded.store }
  const corpsePosition = { ...players.corpse!.position }

  for (let tick = 1; tick <= 240; tick += 1) {
    const result = stepBoneyardWorldTick(
      world,
      players,
      {},
      {
        corpse: {
          alive: false,
          collisionEnabled: false,
          eligible: false,
          movementScale: 0,
        },
        living: {
          alive: true,
          collisionEnabled: true,
          eligible: true,
          movementScale: 1,
        },
      },
      tick,
    )
    world = result.world
    players = result.players
  }

  assert.deepEqual(players.corpse!.position, corpsePosition)
  assert.ok(
    world.enemies.actors[0]!.position.x > corpsePosition.x + PLAYER_CHARACTER_RADIUS,
    'the enemy must pass through the disabled corpse body',
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

test('a Skeleton attacks from the settled native player-contact distance', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = []
  let world = createBoneyardWorld(loaded)
  let player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Settled Contact Target',
      element: 'fire',
    }, world),
    position: { x: 140, y: 350 },
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
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 100, y: 350 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const seededActor = seeded.store.actors[0]!
  player = {
    ...player,
    position: {
      x: 100 + seededActor.config.collisionRadius + PLAYER_CHARACTER_RADIUS - 1,
      y: 350,
    },
  }
  world = { ...world, enemies: seeded.store }

  let result = stepWorld(world, { player }, {}, 1)
  world = result.world
  player = result.players.player
  const actor = world.enemies.actors[0]!
  const distance = Math.hypot(
    actor.position.x - player.position.x,
    actor.position.y - player.position.y,
  )
  assert.ok(distance >= actor.config.collisionRadius + PLAYER_CHARACTER_RADIUS)
  assert.ok(
    distance <= actor.config.collisionRadius
      + PLAYER_CHARACTER_RADIUS
      + NATIVE_ACTOR_SEPARATION_EPSILON
      + 1e-9,
    JSON.stringify({
      actorPosition: actor.position,
      actorRadius: actor.config.collisionRadius,
      distance,
      playerPosition: player.position,
    }),
  )
  assert.equal(actor.brain.phase, 'attack')

  const damage = []
  for (let tick = 2; tick <= 60; tick += 1) {
    result = stepWorld(world, { player }, {}, tick)
    world = result.world
    player = result.players.player
    damage.push(...result.playerDamage)
  }
  assert.ok(damage.length > 0)
})

test('Zombie contact knockback displaces the authoritative player through world collision', () => {
  const loaded = gatedBoneyard()
  loaded.scene.fences = [{
    eid: 'knockback-wall',
    points: [{ x: 220, y: 0 }, { x: 220, y: 500 }],
    segmentCode: 0,
    typeId: 3005,
  }]
  let world = createBoneyardWorld(loaded)
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Knockback Target',
      element: 'fire',
    }, world),
    position: { x: 190, y: 250 },
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
    resolveSpawnIntents: () => [{
      enemyToken: 'ZOMBIE',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE,
      position: { x: 150, y: 250 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const zombie = seeded.store.actors[0]!
  if (zombie.brain.family !== 'zombie') throw new Error('expected Zombie brain')
  world = {
    ...world,
    enemies: {
      ...seeded.store,
      actors: [{
        ...zombie,
        brain: {
          ...zombie.brain,
          actionProgress: NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress - 1,
          actionRate: 1,
          contactTargetPlayerId: 'player',
          impactStateTicksRemaining: 0,
          markerEmitted: false,
          phase: 'swipe',
        },
        config: { ...zombie.config, collisionRadius: 0 },
      }],
    },
  }

  const result = stepWorld(world, { player }, {}, 1)

  assert.equal(result.playerDamage.length, 1)
  assert.ok(result.players.player!.position.x > player.position.x)
  assert.ok(
    result.players.player!.position.x < player.position.x + BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
    'the authored wall must clip the bounded Zombie displacement',
  )
  assert.ok(result.players.player!.position.x <= 220 - PLAYER_CHARACTER_RADIUS + 0.01)
  assert.deepEqual(result.players.player!.velocity, { x: 0, y: 0 })
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
  assert.equal(world.arenaTransition?.phase, 'locking')
  assert.deepEqual(world.arenaTransition?.combatBounds, {
    h: 1200,
    w: 2000,
    x: 0,
    y: 0,
  })
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
  assert.ok(world.enemies.actors.every((enemy) => canPlaceBoneyardBody(
    enemy.position,
    world.arenaTransition!.combatBounds,
    world.collision,
    enemy.config.collisionRadius,
  )), 'post-transition enemies must materialize inside the combat arena')
  const firstEnemy = world.enemies.actors[0]
  assert.deepEqual(boneyardPrimarySpellTargets(world)[0], {
    active: true,
    actorFlags: 0x2,
    attachment: { x: 0, y: 0 },
    bodyRadius: firstEnemy.config.collisionRadius,
    id: `enemy:${firstEnemy.id}`,
    kind: 'enemy',
    nativePriority: 0,
    pendingRemove: false,
    position: firstEnemy.position,
    registrationOrder: world.scenerySpellTargets.length,
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
      {
        player: {
          alive: false,
          collisionEnabled: false,
          eligible: false,
          movementScale: 0,
        },
      },
      tick + noTargetTick + 1,
    )
    world = result.world
    player = result.players.player
  }
  assert.deepEqual(world.waves, frozenWaves)
  assert.equal(world.enemies.actors.length, 10)
})

test('the retired entrance is a one-way authoritative movement boundary', () => {
  let world = createBoneyardWorld(encounterBoneyard('default'))
  assert.ok(world.arenaTransition)
  world = {
    ...world,
    arenaTransition: startBoneyardArenaTransition(world.arenaTransition),
    encounter: null,
    waves: null,
  }
  let player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'One Way Tester',
      element: 'fire',
    }, world),
    position: { x: 1000, y: 1180 },
  }

  for (let tick = 0; tick < 300; tick += 1) {
    const result = stepWorld(
      world,
      { player },
      { player: movementInput(0, 1) },
      tick,
    )
    world = result.world
    player = result.players.player
  }

  assert.ok(player.position.y <= 1200 - PLAYER_CHARACTER_RADIUS)
  assert.ok(player.position.y < 1400, 'the retired entry Gate must remain unreachable')
  assert.equal(world.gateLeaves.length, 2, 'the Gate actor remains outside the active arena')
})

test('wave materialization escapes the captured object-213 grave with a mobile body', () => {
  const capturedPosition = { x: 1723.75, y: 2189.125 }
  const loaded = capturedGraveBoneyard()
  let world = createBoneyardWorld(loaded)
  assert.ok(world.waves)
  const startedWaves = startBoneyardWaveDirector(
    createBoneyardWaveDirector(loaded.seed),
  )
  const probePlayer = { position: { x: 1000, y: 1000 } }
  const probe = stepBoneyardWaveDirector(startedWaves, {
    bounds: world.bounds,
    liveEnemyCount: 0,
    players: { player: probePlayer },
    tick: 0,
  })
  const firstProbe = probe.spawnIntents[0]
  assert.ok(firstProbe)
  const playerPosition = {
    x: capturedPosition.x - (firstProbe.position.x - probePlayer.position.x),
    y: capturedPosition.y - (firstProbe.position.y - probePlayer.position.y),
  }
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Captured Grave Target',
      element: 'fire',
    }, world),
    position: playerPosition,
  }
  world = { ...world, waves: startedWaves }

  const result = stepWorld(world, { player }, {}, 0)
  const controlWorld = createBoneyardWorld({
    ...loaded,
    scene: { ...loaded.scene, objects: [] },
  })
  const control = stepWorld(
    { ...controlWorld, waves: startedWaves },
    { player },
    {},
    0,
  )
  const firstActor = result.world.enemies.actors.find(({ sourceSpawnIntentId }) => (
    sourceSpawnIntentId === 1
  ))
  const controlFirstActor = control.world.enemies.actors.find(({ sourceSpawnIntentId }) => (
    sourceSpawnIntentId === 1
  ))
  assert.ok(firstActor)
  assert.ok(controlFirstActor)
  assert.deepEqual(controlFirstActor.position, capturedPosition)
  assert.notDeepEqual(firstActor.position, capturedPosition)
  assert.deepEqual(result.world.enemies.actors.map(({ id }) => id), [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ])
  assert.deepEqual(result.enemyEvents, control.enemyEvents)
  assert.deepEqual(result.world.waves, control.world.waves)
  assert.equal(result.world.enemies.nextActorId, control.world.enemies.nextActorId)
  assert.equal(result.world.enemies.nextEventId, control.world.enemies.nextEventId)
  assert.equal(result.world.enemies.rngState, control.world.enemies.rngState)
  assert.deepEqual(
    result.world.enemies.actors.map((actor) => ({
      config: actor.config,
      id: actor.id,
      sourceSpawnIntentId: actor.sourceSpawnIntentId,
      spawnTick: actor.spawnTick,
      targetPlayerId: actor.targetPlayerId,
      waveOrdinal: actor.waveOrdinal,
    })),
    control.world.enemies.actors.map((actor) => ({
      config: actor.config,
      id: actor.id,
      sourceSpawnIntentId: actor.sourceSpawnIntentId,
      spawnTick: actor.spawnTick,
      targetPlayerId: actor.targetPlayerId,
      waveOrdinal: actor.waveOrdinal,
    })),
  )
  for (const actor of result.world.enemies.actors) {
    assert.equal(
      canPlaceBoneyardBody(
        actor.position,
        result.world.bounds,
        result.world.collision,
        actor.config.collisionRadius,
      ),
      true,
      `actor ${actor.id} must materialize outside authored collision`,
    )
    const canMoveOneNormalProbe = [
      { x: 0.5, y: 0 },
      { x: 0, y: 0.5 },
      { x: -0.5, y: 0 },
      { x: 0, y: -0.5 },
    ].some((delta) => {
      const moved = resolveBoneyardMovement(
        actor.position,
        { x: actor.position.x + delta.x, y: actor.position.y + delta.y },
        result.world.bounds,
        result.world.collision,
        actor.config.collisionRadius,
      )
      return Math.hypot(
        moved.x - actor.position.x,
        moved.y - actor.position.y,
      ) >= 0.49
    })
    assert.equal(canMoveOneNormalProbe, true, `actor ${actor.id} must have a tick-sized exit`)
    assert.equal(actor.targetPlayerId, 'player')
    assert.equal(
      actor.headingDeg,
      actorHeadingFromVector(
        player.position.x - actor.position.x,
        player.position.y - actor.position.y,
      ),
    )
  }
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
    {
      player: {
        alive: false,
        collisionEnabled: false,
        eligible: false,
        movementScale: 0,
      },
    },
    1,
  )
  world = result.world
  assert.equal(world.encounter?.phase, 'digging')
  assert.equal(world.encounter?.targetPlayerId, null)

  result = stepBoneyardWorldTick(
    world,
    { player: result.players.player },
    {},
    {
      player: {
        alive: true,
        collisionEnabled: true,
        eligible: true,
        movementScale: 1,
      },
    },
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
  assert.equal(
    seeded.store.maggots.length,
    NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS,
  )

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
  assert.equal(world.arenaTransition, null)
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
    active: true,
    actorFlags: 0x4,
    attachment: { x: 0, y: 0 },
    bodyRadius: 0,
    id: 'scenery:grave-7',
    kind: 'gravestone',
    nativePriority: 1000,
    pendingRemove: false,
    position: { x: 300, y: 320 },
    registrationOrder: 0,
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
      fences: [{
        eid: 'retired-entry-gate',
        points: [{ x: 900, y: 1400 }, { x: 1100, y: 1400 }],
        segmentCode: 2,
        typeId: 3005,
      }],
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

function capturedGraveBoneyard(): LoadedBoneyard {
  const loaded = encounterBoneyard('default')
  return {
    ...loaded,
    runId: 'captured-object-213-run',
    seed: 'captured-object-213-seed',
    scene: {
      ...loaded.scene,
      bounds: { x: 0, y: 0, w: 2101.429931640625, h: 3698.570068359375 },
      objects: [{
        eid: 'object-213',
        overlayVariant: 8,
        pos: { x: 1719.501953125, y: 2128.44189453125 },
        typeId: 2029,
        variant: 10,
      }],
    },
  }
}
