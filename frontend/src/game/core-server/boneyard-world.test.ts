import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../core-kernels/boneyard-zombie-beat.ts'
import {
  BONEYARD_ARENA_SEAL_TICKS,
  startBoneyardArenaTransition,
} from '../core-kernels/boneyard-arena-transition.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import {
  type BoneyardEnemySpawnIntent,
  startBoneyardWaveDirector,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  NATIVE_TUTORIAL_CAMERA_TARGET,
  NATIVE_TUTORIAL_MONSTER_RECIPES,
  createNativeTutorialState,
  nativeTutorialAmuletItem,
  nativeTutorialEnemyCameraPositionIsAllowed,
  stepNativeTutorial,
} from '../core-kernels/native-tutorial.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import { materializeStockTutorial } from '../host/boneyard-catalog.ts'
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
import { canPlaceBoneyardBody, resolveBoneyardMovement } from './boneyard-collision.ts'
import { spawnBoneyardCustomLootItems } from './boneyard-loot-store.ts'

function movementInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, quickbar: null },
    movement: { x, y },
    viewportWidth: 1_600,
  }
}

function stepWorld(
  world: Parameters<typeof stepBoneyardWorldTick>[0],
  players: Parameters<typeof stepBoneyardWorldTick>[1],
  inputs: Parameters<typeof stepBoneyardWorldTick>[2],
  tick: number,
  externalSpawnIntents: readonly BoneyardEnemySpawnIntent[] = [],
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
    undefined,
    undefined,
    {},
    [],
    externalSpawnIntents,
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

test('movement contact classifies every hostile actor family and excludes Coffin', () => {
  const tokens = [
    'SKELETON',
    'SKELETONARCHER',
    'SKELETONMAGE',
    'IMP',
    'ZOMBIE',
    'WRAITH',
    'DEMON',
    'COFFIN',
  ] as const

  for (const token of tokens) {
    const loaded = gatedBoneyard()
    loaded.scene.fences = []
    let world = createBoneyardWorld(loaded)
    let player = {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'body',
        displayName: `${token} Contact`,
        element: 'air',
      }, world),
      position: { x: 100, y: 350 },
    }
    const seeded = stepBoneyardEnemyStore(world.enemies, {
      firstProjectileWorldContact: () => null,
      players: {},
      resolveMovement: ({ requestedPosition }) => requestedPosition,
      resolveSpawnIntents: () => [{
        enemyToken: token,
        flags: [],
        id: 1,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[token],
        position: { x: 200, y: 350 },
        spawnTick: 0,
        waveOrdinal: 1,
      }],
      tick: 0,
    })
    const actor = seeded.store.actors[0]!
    world = {
      ...world,
      enemies: {
        ...seeded.store,
        actors: [{
          ...actor,
          nextMovementTick: Number.MAX_SAFE_INTEGER,
          position: {
            x: player.position.x + PLAYER_CHARACTER_RADIUS + actor.config.collisionRadius + 4,
            y: player.position.y,
          },
        }],
      },
    }

    let contacts: readonly { bodyId: string; staffHostile: boolean }[] = []
    for (let tick = 1; tick <= 30 && contacts.length === 0; tick += 1) {
      const result = stepWorld(
        world,
        { player },
        { player: movementInput(1, 0) },
        tick,
      )
      world = result.world
      player = result.players.player
      contacts = result.movementContactsByPlayerId.player ?? []
    }

    assert.deepEqual(contacts, [{
      bodyId: `enemy-${actor.id}`,
      staffHostile: token !== 'COFFIN',
    }], token)
  }
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
  let observedContact = false

  for (let tick = 2; tick <= 50; tick += 1) {
    const result = stepWorld(
      world,
      { player },
      { player: movementInput(1, 0) },
      tick,
    )
    observedContact ||= result.movementContactsByPlayerId.player?.some(({ bodyId, staffHostile }) => (
      bodyId === `enemy-${maggot.id}` && staffHostile
    )) ?? false
    world = result.world
    player = result.players.player
  }

  const retained = world.enemies.maggots[0]!
  assert.equal(observedContact, true)
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
  const openingCount = world.waves!.openingBursts[0]!.count

  result = stepWorld(world, { player }, {}, tick)
  world = result.world
  assert.equal(world.enemies.actors.length, openingCount)
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
    cellBindingOrder: firstEnemy.nativeCellBindingOrder,
    headingDeg: firstEnemy.headingDeg,
    id: `enemy:${firstEnemy.id}`,
    kind: 'enemy',
    nativePriority: 0,
    pendingRemove: false,
    position: firstEnemy.position,
    registrationOrder: firstEnemy.nativeRegistrationOrder,
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

  const wavesBeforeTargetLoss = world.waves
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
  assert.notDeepEqual(world.waves, wavesBeforeTargetLoss)
  assert.equal(world.waves?.activeBurstIndex, 1)
  assert.ok(
    world.enemies.actors.length > openingCount,
    'the delayed opening must continue through the camera-center fallback',
  )
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

test('a generated lock waits for existing enemies and ground Sacks without admitting new entrance births', () => {
  let world = createBoneyardWorld(encounterBoneyard('default'))
  assert.ok(world.arenaTransition)
  assert.ok(world.waves)
  world = { ...world, encounter: null }
  let player = spawnPlayerCharacterInBoneyard({
    discipline: 'arcane',
    displayName: 'Arena safety tester',
    element: 'ether',
  }, world)
  const outsideIntent = (id: number): BoneyardEnemySpawnIntent => ({
    enemyToken: 'SKELETON',
    flags: [],
    id,
    locationPolicy: 'anywhere',
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
    position: { x: 1000, y: 1500 },
    positionPolicy: 'direct',
    spawnTick: 0,
    waveOrdinal: 1,
  })

  let result = stepWorld(world, { player }, {}, 1, [outsideIntent(9001)])
  world = {
    ...result.world,
    waves: startBoneyardWaveDirector(result.world.waves!),
  }
  player = result.players.player
  assert.ok(world.enemies.actors.some(({ position }) => position.y > 1200))

  result = stepWorld(world, { player }, {}, 2, [outsideIntent(9002)])
  world = result.world
  player = result.players.player
  assert.equal(world.arenaTransition?.phase, 'open')
  const confinedBirth = world.enemies.actors.find(({ sourceSpawnIntentId }) => (
    sourceSpawnIntentId === 9002
  ))
  assert.ok(confinedBirth)
  assert.ok(
    confinedBirth.position.y + confinedBirth.config.collisionRadius <= 1200,
    'a birth after the run request must fit the future combat rectangle',
  )

  world = {
    ...world,
    enemies: { ...world.enemies, actors: [], maggots: [] },
    loot: spawnBoneyardCustomLootItems(
      world.loot,
      [nativeTutorialAmuletItem()],
      { x: 1000, y: 1500 },
      2,
    ).store,
  }
  result = stepWorld(world, { player }, {}, 3)
  world = result.world
  player = result.players.player
  assert.equal(world.arenaTransition?.phase, 'open', 'required Sack keeps the entry reachable')

  world = { ...world, loot: { ...world.loot, actors: [] } }
  result = stepWorld(world, { player }, {}, 4)
  assert.equal(result.world.arenaTransition?.phase, 'locking')
})

test('the tick-400 generated cleanup retires outside authored scenery targets and Goodies but keeps Fence', () => {
  const loaded = encounterBoneyard('default')
  loaded.scene.objects = [
    { eid: 'inside-grave', pos: { x: 800, y: 1000 }, typeId: 2029, variant: 0 },
    { eid: 'outside-grave', pos: { x: 800, y: 1400 }, typeId: 2029, variant: 0 },
    { eid: 'inside-goodie', pos: { x: 1200, y: 1000 }, typeId: 2061, variant: 0 },
    { eid: 'outside-goodie', pos: { x: 1200, y: 1400 }, typeId: 2061, variant: 0 },
  ]
  let world = createBoneyardWorld(loaded)
  assert.ok(world.arenaTransition)
  const started = startBoneyardArenaTransition(world.arenaTransition)
  assert.equal(started.sealTicksRemaining, BONEYARD_ARENA_SEAL_TICKS)
  world = {
    ...world,
    arenaTransition: { ...started, sealTicksRemaining: 1 },
    encounter: null,
    waves: null,
  }
  const player = spawnPlayerCharacterInBoneyard({
    discipline: 'arcane',
    displayName: 'Cleanup tester',
    element: 'fire',
  }, world)

  const result = stepWorld(world, { player }, {}, 1)

  assert.equal(result.world.arenaTransition?.phase, 'sealed')
  assert.deepEqual(
    result.world.earthquakeSceneryTargets.map(({ id }) => id),
    [0, 2],
  )
  assert.deepEqual(
    result.world.primarySceneryTargets.map(({ id }) => id),
    ['scenery:inside-grave', 'scenery:inside-goodie'],
  )
  assert.deepEqual(
    result.world.scenerySpellTargets.map(({ id }) => id),
    ['scenery:inside-grave'],
  )
  assert.deepEqual(result.world.loot.goodies.map(({ eid }) => eid), ['inside-goodie'])
  assert.equal(result.world.gateLeaves.length, 2)
})

test('direct spawn materialization escapes the captured object-213 grave with a mobile body', () => {
  const capturedPosition = { x: 1723.75, y: 2189.125 }
  const loaded = capturedGraveBoneyard()
  const spawnIntent: BoneyardEnemySpawnIntent = {
    enemyToken: 'SKELETON',
    flags: [],
    id: 1,
    locationPolicy: 'anywhere',
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
    position: capturedPosition,
    positionPolicy: 'direct',
    spawnTick: 0,
    waveOrdinal: 1,
  }
  const world = { ...createBoneyardWorld(loaded), encounter: null, waves: null }
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Captured Grave Target',
      element: 'fire',
    }, world),
    position: { x: 1000, y: 1000 },
  }

  const result = stepWorld(world, { player }, {}, 0, [spawnIntent])
  const controlWorld = createBoneyardWorld({
    ...loaded,
    scene: { ...loaded.scene, objects: [] },
  })
  const control = stepWorld(
    { ...controlWorld, encounter: null, waves: null },
    { player },
    {},
    0,
    [spawnIntent],
  )
  const firstActor = result.world.enemies.actors[0]
  const controlFirstActor = control.world.enemies.actors[0]
  assert.ok(firstActor)
  assert.ok(controlFirstActor)
  assert.deepEqual(controlFirstActor.position, capturedPosition)
  assert.notDeepEqual(firstActor.position, capturedPosition)
  assert.deepEqual(result.world.enemies.actors.map(({ id }) => id), [1])
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
  assert.equal(canPlaceBoneyardBody(
    firstActor.position,
    result.world.bounds,
    result.world.collision,
    firstActor.config.collisionRadius,
  ), true)
  const canMoveOneNormalProbe = [
    { x: 0.5, y: 0 },
    { x: 0, y: 0.5 },
    { x: -0.5, y: 0 },
    { x: 0, y: -0.5 },
  ].some((delta) => {
    const moved = resolveBoneyardMovement(
      firstActor.position,
      { x: firstActor.position.x + delta.x, y: firstActor.position.y + delta.y },
      result.world.bounds,
      result.world.collision,
      firstActor.config.collisionRadius,
    )
    return Math.hypot(
      moved.x - firstActor.position.x,
      moved.y - firstActor.position.y,
    ) >= 0.49
  })
  assert.equal(canMoveOneNormalProbe, true)
  assert.equal(firstActor.targetPlayerId, 'player')
  assert.equal(firstActor.headingDeg, actorHeadingFromVector(
    player.position.x - firstActor.position.x,
    player.position.y - firstActor.position.y,
  ))
})

test('authoritative offscreen placement materializes the logged Tutorial policy with and without a living player', () => {
  const loggedPosition = { x: 1455.7955322265625, y: 1313.0782470703125 }
  const loaded = encounterBoneyard('mod')
  const spawnIntent: BoneyardEnemySpawnIntent = {
    enemyToken: 'SKELETON',
    flags: [],
    id: 1,
    locationPolicy: 'near-player',
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
    position: loggedPosition,
    positionPolicy: 'offscreen',
    spawnTick: 0,
    waveOrdinal: 2,
  }
  const initialWorld = { ...createBoneyardWorld(loaded), encounter: null, waves: null }
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Tutorial Offscreen Target',
      element: 'ether',
    }, initialWorld),
    position: { x: loggedPosition.x, y: loggedPosition.y + 100 },
  }

  const withPlayer = stepWorld(initialWorld, { player }, {}, 0, [spawnIntent])
  const actor = withPlayer.world.enemies.actors[0]
  assert.ok(actor)
  assert.equal(spawnIsOutsideNativePolicyView(
    actor.position,
    withPlayer.world.bounds,
    [player.position],
  ), true)
  assert.equal(canPlaceBoneyardBody(
    actor.position,
    withPlayer.world.bounds,
    withPlayer.world.collision,
    actor.config.collisionRadius,
  ), true)

  const withoutPlayer = stepWorld(initialWorld, {}, {}, 0, [spawnIntent])
  const fallbackActor = withoutPlayer.world.enemies.actors[0]
  assert.ok(fallbackActor)
  assert.equal(spawnIsOutsideNativePolicyView(
    fallbackActor.position,
    withoutPlayer.world.bounds,
    [{
      x: withoutPlayer.world.bounds.x + withoutPlayer.world.bounds.w / 2,
      y: withoutPlayer.world.bounds.y + withoutPlayer.world.bounds.h / 2,
    }],
  ), true)
})

test('every Tutorial opening enemy materializes on the combat side of the entrance Fence', () => {
  const playerPosition = { x: 1025, y: 1350 }
  for (let seed = 0; seed < 64; seed += 1) {
    const tutorial = {
      ...createNativeTutorialState(playerPosition, 0, `tutorial-fence-${seed}`),
      introActive: false,
      introBlend: 1,
      introDelayTicksRemaining: 0,
      introFade: 0,
      introMovementTicksRemaining: 0,
      stage: 1 as const,
    }
    const spawned = stepNativeTutorial(tutorial, {
      acidRainCastSequence: 0,
      acidRainLastSkillId: null,
      cameraLockSafetyClear: true,
      currentHealth: 100,
      enemyCount: 0,
      groundSackCount: 0,
      hasTopLevelNonPotionItem: false,
      healthPotionCount: 0,
      level: 1,
      levelUpPending: false,
      maximumHealth: 100,
      playerActionIdle: true,
      playerMovementActive: false,
      playerPosition,
      primaryCastSequence: 0,
      solomonPhase: 'escaping',
      solomonRunEventId: 1,
      tick: 1,
    })
    assert.equal(spawned.spawnIntents.length, 10)

    const created = createBoneyardWorld(materializeStockTutorial(
      Buffer.alloc(16, seed),
    ))
    const world = { ...created, encounter: null, waves: null }
    const player = {
      ...spawnPlayerCharacterInBoneyard({
        discipline: 'arcane',
        displayName: 'Fence Domain Tester',
        element: 'ether',
      }, world),
      position: playerPosition,
    }
    const result = stepWorld(world, { player }, {}, 1, spawned.spawnIntents)
    const violations = result.world.enemies.actors.filter((actor) => (
      actor.position.y + actor.config.collisionRadius
      > tutorialEntranceFenceY(actor.position.x)
    ))
    assert.deepEqual(violations.map(({ id, position }) => ({ id, position })), [], `seed ${seed}`)
  }
})

test('every Tutorial MonsterRecipe and authored placement policy excludes the spawn strip', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 47))
  const created = createBoneyardWorld(loaded)
  const world = { ...created, encounter: null, waves: null }
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Tutorial Recipe Tester',
      element: 'ether',
    }, world),
    position: { x: 1025, y: 1350 },
  }
  const policyByRecipe = new Map<number, readonly ('dark' | 'light' | 'offscreen')[]>([
    [10004, ['dark', 'offscreen']],
    [10051, ['offscreen', 'light']],
    [10059, ['dark']],
    [10065, ['light']],
    [10076, ['light']],
    [10077, ['light']],
    [10085, ['light']],
  ])

  let intentId = 1
  for (const [uidText, definition] of Object.entries(NATIVE_TUTORIAL_MONSTER_RECIPES)) {
    const uid = Number(uidText)
    for (const positionPolicy of policyByRecipe.get(uid)!) {
      const result = stepWorld(world, { player }, {}, intentId, [{
        authoredRecipe: definition,
        enemyToken: definition.enemyToken,
        flags: [],
        flanking: definition.flanking,
        id: intentId++,
        locationPolicy: 'near-player',
        nativeTypeId: definition.enemyToken === 'SKELETON' ? 1001 : 1002,
        pathfindingMode: definition.pathfindingMode,
        position: { x: 700, y: 1750 },
        positionPolicy,
        spawnTick: 0,
        waveOrdinal: 1,
      }])
      const actor = result.world.enemies.actors[0]
      assert.ok(actor, `recipe ${uid} ${positionPolicy}`)
      assert.ok(
        actor.position.y + actor.config.collisionRadius
          <= tutorialEntranceFenceY(actor.position.x),
        `recipe ${uid} ${positionPolicy}`,
      )
    }
  }
})

test('a locked Tutorial admits every new enemy circle inside the visible camera target', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 53))
  const created = createBoneyardWorld(loaded)
  assert.ok(created.tutorial)
  const world = {
    ...created,
    encounter: null,
    tutorial: {
      ...created.tutorial,
      active: false,
      cameraLockAgeTicks: NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
      cameraLockTriggered: true,
      cameraLockTicksRemaining: 0,
      introActive: false,
      introBlend: 1,
      introDelayTicksRemaining: 0,
      introFade: 0,
      introMovementTicksRemaining: 0,
      stage: 19 as const,
      waveOrdinal: 0,
    },
    waves: null,
  }
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Tutorial Camera Spawn Tester',
      element: 'ether',
    }, world),
    position: { x: 1025, y: 800 },
  }
  const result = stepWorld(world, { player }, {}, 1, [{
    enemyToken: 'SKELETON',
    flags: [],
    id: 1,
    locationPolicy: 'near-player',
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
    position: { x: 1025, y: 1200 },
    positionPolicy: 'dark',
    spawnTick: 0,
    waveOrdinal: 1,
  }])
  const actor = result.world.enemies.actors[0]
  assert.ok(actor)
  assert.equal(nativeTutorialEnemyCameraPositionIsAllowed(
    actor.position,
    actor.config.collisionRadius,
  ), true)
})

test('the Tutorial tick-300 cleanup retires outside authored scene ownership but keeps Fence', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 59))
  const created = createBoneyardWorld(loaded)
  assert.ok(created.tutorial)
  const outsideTargetCount = created.earthquakeSceneryTargets.filter(({ position }) => (
    position.x < NATIVE_TUTORIAL_CAMERA_TARGET.x
    || position.y < NATIVE_TUTORIAL_CAMERA_TARGET.y
    || position.x > NATIVE_TUTORIAL_CAMERA_TARGET.x + NATIVE_TUTORIAL_CAMERA_TARGET.w
    || position.y > NATIVE_TUTORIAL_CAMERA_TARGET.y + NATIVE_TUTORIAL_CAMERA_TARGET.h
  )).length
  assert.ok(outsideTargetCount > 0)
  const world = {
    ...created,
    encounter: null,
    tutorial: {
      ...created.tutorial,
      active: false,
      cameraLockAgeTicks: NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
      cameraLockTriggered: true,
      cameraLockTicksRemaining: 0,
      introActive: false,
      introBlend: 1,
      introDelayTicksRemaining: 0,
      introFade: 0,
      introMovementTicksRemaining: 0,
      stage: 19 as const,
    },
    waves: null,
  }
  const player = {
    ...spawnPlayerCharacterInBoneyard({
      discipline: 'arcane',
      displayName: 'Tutorial cleanup tester',
      element: 'ether',
    }, world),
    position: { x: 1025, y: 700 },
  }

  const result = stepWorld(world, { player }, {}, 1)

  assert.ok(result.world.earthquakeSceneryTargets.every(({ position }) => (
    position.x >= NATIVE_TUTORIAL_CAMERA_TARGET.x
    && position.y >= NATIVE_TUTORIAL_CAMERA_TARGET.y
    && position.x <= NATIVE_TUTORIAL_CAMERA_TARGET.x + NATIVE_TUTORIAL_CAMERA_TARGET.w
    && position.y <= NATIVE_TUTORIAL_CAMERA_TARGET.y + NATIVE_TUTORIAL_CAMERA_TARGET.h
  )))
  assert.ok(result.world.earthquakeSceneryTargets.length < created.earthquakeSceneryTargets.length)
  assert.equal(result.world.gateLeaves.length, created.gateLeaves.length)
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

  const targets = boneyardPrimarySpellTargets(world)
  assert.deepEqual(targets.map(({ id }) => id), [
    `enemy:${coffin.id}`,
    ...world.enemies.maggots.map(({ id }) => `enemy:${id}`),
  ])
  assert.equal(targets[0]?.active, false)
  assert.ok(targets.slice(1).every(({ active }) => active))
})

test('mod Boneyards retain opaque script ownership instead of receiving retail waves', () => {
  const world = createBoneyardWorld(encounterBoneyard('mod'))
  assert.equal(world.arenaTransition, null)
  assert.equal(world.encounter, null)
  assert.equal(world.waves, null)
})

test('retains Gravestones in the grave-specific scenery lane', () => {
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
    cellBindingOrder: 0,
    id: 'scenery:grave-7',
    kind: 'gravestone',
    nativePriority: 1000,
    pendingRemove: false,
    position: { x: 300, y: 320 },
    registrationOrder: 0,
  }])
})

test('retains the complete native flag-four primary scenery roots, priorities, and radii', () => {
  const loaded = gatedBoneyard()
  loaded.scene.objects = [
    { eid: 'tree', typeId: 2001, pos: { x: 80, y: 90 }, variant: 1 },
    { eid: 'monument', typeId: 2009, pos: { x: 100, y: 110 }, variant: 2 },
    { eid: 'grave', typeId: 2029, pos: { x: 120, y: 130 }, variant: 2 },
    { eid: 'building', typeId: 2040, pos: { x: 140, y: 150 }, variant: 1 },
    { eid: 'goodie', typeId: 2061, pos: { x: 160, y: 170 }, variant: 0 },
    { eid: 'scrub', typeId: 2062, pos: { x: 180, y: 190 }, variant: 0 },
  ]

  assert.deepEqual(createBoneyardWorld(loaded).primarySceneryTargets, [
    primarySceneryTarget('tree', 2001, 0, 8, { x: 80, y: 90 }),
    primarySceneryTarget('monument', 2009, 1, 1, { x: 100, y: 110 }),
    primarySceneryTarget('grave', 2029, 2, 0.01, { x: 120, y: 130 }),
    primarySceneryTarget('building', 2040, 3, 1, { x: 140, y: 150 }),
    primarySceneryTarget('goodie', 2061, 4, 20, { x: 160, y: 170 }),
  ])
})

test('retains Goodie actor membership after its contents materialize', () => {
  const loaded = gatedBoneyard()
  loaded.scene.objects = [
    { eid: 'goodie', typeId: 2061, pos: { x: 160, y: 170 }, variant: 0 },
  ]
  const world = createBoneyardWorld(loaded)
  const exhaustedWorld = {
    ...world,
    loot: {
      ...world.loot,
      goodies: world.loot.goodies.map((goodie) => ({
        ...goodie,
        active: false,
        exhausted: true,
        phase: 2 as const,
        timer: 250,
      })),
    },
  }

  assert.deepEqual(
    boneyardPrimarySpellTargets(exhaustedWorld),
    [primarySceneryTarget('goodie', 2061, 0, 20, { x: 160, y: 170 })],
  )
})

test('retains every native group-four scene-object family for Earthquake wobble ownership', () => {
  const loaded = gatedBoneyard()
  loaded.scene.objects = [
    { eid: 'tree', typeId: 2001, pos: { x: 80, y: 90 }, variant: 0 },
    { eid: 'grave', typeId: 2029, pos: { x: 120, y: 130 }, variant: 2 },
    { eid: 'building', typeId: 2040, pos: { x: 160, y: 170 }, variant: 1 },
    { eid: 'goodie', typeId: 2061, pos: { x: 200, y: 210 }, variant: 0 },
  ]

  assert.deepEqual(createBoneyardWorld(loaded).earthquakeSceneryTargets, [
    { id: 0, position: { x: 80, y: 90 }, typeId: 2001 },
    { id: 1, position: { x: 120, y: 130 }, typeId: 2029 },
    { id: 2, position: { x: 160, y: 170 }, typeId: 2040 },
    { id: 3, position: { x: 200, y: 210 }, typeId: 2061 },
  ])
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

function primarySceneryTarget(
  eid: string,
  typeId: number,
  registrationOrder: number,
  bodyRadius: number,
  position: Readonly<{ x: number; y: number }>,
) {
  return {
    active: true,
    actorFlags: 0x4,
    attachment: { x: 0, y: 0 },
    bodyRadius,
    cellBindingOrder: registrationOrder,
    id: `scenery:${eid}`,
    kind: typeId === 2029 ? 'gravestone' : 'scenery',
    nativePriority: 1000,
    pendingRemove: false,
    position: { ...position },
    registrationOrder,
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

const TUTORIAL_ENTRANCE_FENCE_CHAIN = [
  { x: 4.150634765625, y: 1627.25146484375 },
  { x: 149.150634765625, y: 1623.25146484375 },
  { x: 311.150634765625, y: 1620.25146484375 },
  { x: 451.150634765625, y: 1620.25146484375 },
  { x: 604.150634765625, y: 1618.25146484375 },
  { x: 746.150634765625, y: 1616.25146484375 },
  { x: 874.206787109375, y: 1614.6953125 },
  { x: 933.454345703125, y: 1616 },
  { x: 1118.454345703125, y: 1609 },
  { x: 1171.994140625, y: 1609 },
  { x: 1248.994140625, y: 1609 },
  { x: 1325.994140625, y: 1610 },
  { x: 1473.150634765625, y: 1611.25146484375 },
  { x: 1610.150634765625, y: 1609.25146484375 },
  { x: 1747.150634765625, y: 1608.25146484375 },
  { x: 1901.150634765625, y: 1606.25146484375 },
  { x: 2044.150634765625, y: 1605.25146484375 },
] as const

function tutorialEntranceFenceY(x: number): number {
  if (x <= TUTORIAL_ENTRANCE_FENCE_CHAIN[0].x) {
    return TUTORIAL_ENTRANCE_FENCE_CHAIN[0].y
  }
  for (let index = 1; index < TUTORIAL_ENTRANCE_FENCE_CHAIN.length; index += 1) {
    const end = TUTORIAL_ENTRANCE_FENCE_CHAIN[index]
    if (x > end.x) continue
    const start = TUTORIAL_ENTRANCE_FENCE_CHAIN[index - 1]
    const progress = (x - start.x) / (end.x - start.x)
    return start.y + (end.y - start.y) * progress
  }
  return TUTORIAL_ENTRANCE_FENCE_CHAIN.at(-1)!.y
}

function spawnIsOutsideNativePolicyView(
  position: Readonly<{ x: number; y: number }>,
  bounds: Readonly<{ h: number; w: number; x: number; y: number }>,
  focuses: readonly Readonly<{ x: number; y: number }>[],
): boolean {
  const halfWidth = 800 / 1.35
  const halfHeight = 450 / 1.35
  return focuses.every((focus) => {
    const x = clampCameraAxis(focus.x, bounds.x, bounds.w, halfWidth)
    const y = clampCameraAxis(focus.y, bounds.y, bounds.h, halfHeight)
    return position.x < x - halfWidth
      || position.x > x + halfWidth
      || position.y < y - halfHeight
      || position.y > y + halfHeight
  })
}

function clampCameraAxis(position: number, start: number, size: number, halfView: number): number {
  if (size <= halfView * 2) return start + size / 2
  return Math.min(start + size - halfView, Math.max(start + halfView, position))
}
