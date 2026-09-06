import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNativeBossNarration,
  enqueueNativeBossNarration,
} from '../core-kernels/native-boss-audio.ts'
import {
  createNativeFacultyAction,
} from '../core-kernels/native-faculty-actions.ts'
import {
  createNativeRng,
} from '../core-kernels/native-rng.ts'
import {
  nativeFacultyRecipe,
  type NativeFacultyName,
} from '../core-kernels/native-survival-faculty.ts'
import {
  projectBoneyardEnemies,
  projectBoneyardEnemyDeathEffect,
} from '../host/project-boneyard-enemies.ts'
import {
  boneyardEnemyDeathEffectDescriptor,
  boneyardEnemyDeathEffectSample,
  materializeBoneyardEnemyDeathEffect,
} from '../protocol/boneyard-enemy-death-effect-replication.ts'
import {
  boneyardEnemyDescriptor,
  boneyardEnemySample,
  materializeBoneyardEnemy,
} from '../protocol/boneyard-enemy-replication.ts'
import { nativeBossSpells } from '../protocol/codecs/boss-spells.ts'
import { boneyardEnemySnapshot } from '../protocol/codecs/enemies.ts'
import { boneyardEnemyDeathEffectSnapshot, boneyardEnemyEvents } from '../protocol/codecs/enemy-effects.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  damageBoneyardEnemy,
} from './enemies/damage.ts'
import {
  type BoneyardEnemyStore,
  type BoneyardEnemyStoreStepContext,
} from './enemies/model.ts'

const SHA = '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9'
const names: readonly NativeFacultyName[] = ['Dire Sirmin', 'Dire Lucritius', 'Dire Aliss']
const context: BoneyardEnemyStoreStepContext = {
  nativeViewBounds: { x: -800, y: -500, w: 1600, h: 1000 },
  projectileWorldBlocked: () => false,
  clipSpellSegment: ({ end }) => end,
  players: { player: { alive: true, collisionRadius: 25, connected: true, eligible: true,
    headingDeg: 0, position: { x: 0, y: -200 }, velocityPerTick: { x: 0, y: 0 } } },
  resolveMovement: ({ position }) => position,
  resolveSpawnIntents: () => [],
  tick: 1,
}

function spawned(): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('faculty-integration'), {
    ...context, tick: 0, resolveSpawnIntents: () => names.map((name, index) => ({
      authoredRecipe: nativeFacultyRecipe(SHA, name), enemyToken: 'DIREFACULTY', flags: [], id: index + 1,
      locationPolicy: 'anywhere', nativeTypeId: 1010, pathfindingMode: 2,
      position: { x: index * 10, y: 0 }, spawnTick: 0, waveOrdinal: 32,
    })),
  }).store
}

test('the Faculty materializes three distinct members and preserves appearance and action on both wire forms', () => {
  const source = spawned()
  assert.deepEqual(source.actors.map(({ config }) => config.recipeName), names)
  assert.deepEqual(source.actors.map(({ config }) => config.maximumHealth), [2010, 2010, 2010])
  assert.ok(source.actors.every(({ config }) => config.classification === 'multiple-boss'))
  const snapshots = projectBoneyardEnemies(source, 0)
  for (const snapshot of snapshots) {
    assert.deepEqual(boneyardEnemySnapshot(JSON.parse(JSON.stringify(snapshot)), 'enemy'), snapshot)
    const decoded = materializeBoneyardEnemy(boneyardEnemyDescriptor(snapshot), boneyardEnemySample(snapshot))
    assert.equal(decoded.name, snapshot.name)
    assert.deepEqual(decoded.faculty?.bodyColor, snapshot.faculty?.bodyColor)
    assert.equal(decoded.faculty?.female, snapshot.name === 'Dire Aliss')
  }
})

for (const secondary of [false, true]) {
  test(`Faculty ${secondary ? 'secondary' : 'primary'} dispatch reaches each native spell program`, () => {
    const source = spawned()
    const actors = source.actors.map((actor) => {
      if (actor.brain.family !== 'faculty' || actor.config.enemyToken !== 'DIREFACULTY') throw new Error('Faculty required')
      const kind = secondary ? 'two-hand' : actor.config.family.primary === 1 ? 'lightning' : 'throw'
      const action = createNativeFacultyAction(kind, createNativeRng(actor.id)).action
      return { ...actor, brain: { ...actor.brain, phase: 'cast' as const, handMask: action.handMask,
        action: { ...action, progress: action.marker - .01, rate: .1 } } }
    })
    const step = stepBoneyardEnemyStore({ ...source, actors }, context)
    assert.deepEqual([...new Set(step.store.bossSpells.map(({ kind }) => kind))].sort(), secondary
      ? ['dark-fireball', 'rain-of-bones', 'tragic-circle'] : ['blightning', 'dark-fireball', 'death-magic', 'skull-missile'])
    if (secondary) assert.equal(step.store.bossSpells.filter(({ kind }) => kind === 'dark-fireball').length, 14)
    else assert.ok(step.playerDamage.some(({ manaDamageMaximumFraction }) => manaDamageMaximumFraction === .005))
    assert.deepEqual(nativeBossSpells(JSON.parse(JSON.stringify(step.store.bossSpells)), 'spells', 1), step.store.bossSpells)
    const later = stepBoneyardEnemyStore(step.store, { ...context, tick: 2 })
    assert.ok(later.store.bossSpells.length > 0)
    assert.ok(later.store.bossSpells.every(({ ageTicks }) => ageTicks >= 0))
    assert.deepEqual(nativeBossSpells(JSON.parse(JSON.stringify(later.store.bossSpells)), 'spells', 2), later.store.bossSpells)
    let store = later.store
    let contacts = 0
    let retirements = 0
    for (let tick = 3; tick <= 300; tick += 1) {
      const next = stepBoneyardEnemyStore(store, { ...context, tick })
      store = next.store
      const events = next.events.map(event => ({ ...event, runId: 'faculty-lifecycle' }))
      assert.deepEqual(boneyardEnemyEvents(JSON.parse(JSON.stringify(events)), 'events', 'faculty-lifecycle', tick), events)
      contacts += events.filter(event => event.type === 'projectile-impact').length
      retirements += events.filter(event => event.type === 'projectile-retired').length
    }
    assert.ok(contacts > 0 && retirements > 0)
  })
}

test('all Faculty deaths retain their native clocks, streams, detached fragments and strict wire records', () => {
  let store = spawned()
  for (const actor of store.actors) store = damageBoneyardEnemy(store, {
    actorId: actor.id, amount: actor.currentHealth + 1, tick: 0, sourcePlayerId: 'player',
  }).store
  for (let tick = 1; tick <= 250; tick += 1) {
    const step = stepBoneyardEnemyStore(store, { ...context, tick })
    store = step.store
    if (tick < 250) assert.equal(store.actors.length, 3)
    if (tick === 1) {
      assert.equal(step.events.filter(({ stream }) => stream === 'faculty-die').length, 3)
      assert.equal(store.deathEffects.filter(({ role }) => role === 'faculty-start-smoke').length, 216)
    }
    if (tick === 101) {
      assert.deepEqual(step.events.filter(({ stream }) => stream !== undefined).map(({ stream }) => stream),
        ['faculty-no', 'faculty-no', 'faculty-no-female'])
      const events = step.events.map(event => ({ ...event, runId: 'faculty-wire' }))
      assert.deepEqual(boneyardEnemyEvents(JSON.parse(JSON.stringify(events)), 'events', 'faculty-wire', tick), events)
    }
  }
  assert.equal(store.actors.length, 0)
  const finale = store.deathEffects.filter(({ spawnTick }) => spawnTick === 250)
  for (const actorId of [1, 2, 3]) {
    const effects = finale.filter(({ ownerActorId }) => ownerActorId === actorId)
    assert.equal(effects.filter(({ role }) => role === 'faculty-bone').length, 18)
    assert.equal(effects.filter(({ kind }) => kind === 'scrap').length, 72)
    assert.equal(effects.filter(({ kind }) => kind === 'banish-black').length, 1)
    assert.equal(effects.filter(({ role }) => role === 'faculty-terminal-smoke').length, 72)
    const scrap = projectBoneyardEnemyDeathEffect(effects.find(({ kind }) => kind === 'scrap')!)
    assert.deepEqual(boneyardEnemyDeathEffectSnapshot(JSON.parse(JSON.stringify(scrap)), 'scrap'), scrap)
    const compact = materializeBoneyardEnemyDeathEffect(boneyardEnemyDeathEffectDescriptor(scrap), boneyardEnemyDeathEffectSample(scrap))
    assert.ok(Math.abs(compact.painterSortBias! - scrap.painterSortBias!) <= 1 / 32)
  }
})

test('a casting Faculty holds its ground and stasis leaves its outer light and smoke clocks running', () => {
  const original = spawned()
  const first = original.actors[0]!
  if (first.brain.family !== 'faculty') throw new Error('Faculty required')
  const action = createNativeFacultyAction('throw', createNativeRng(42)).action
  const actor = { ...first, brain: { ...first.brain, action: { ...action, progress: 3 } } }
  const source = { ...original, actors: [actor] }
  const effect = {
    circleSlowFactor: 1,
    circleSlowTicks: 0,
    coldSlowFactor: 1,
    coldSlowMaterial: false,
    coldSlowTicks: 0,
    dazzleMaximumTicks: 0,
    dazzleTicks: 0,
    disruptedTicks: 0,
    electricBurn: null,
    fleeTicks: 0,
    frostBurnDamagePerTick: 0,
    frostBurnOwnerId: null,
    frostBurnSkillId: null,
    frostBurnSourceActorId: null,
    frostBurnTicks: 0,
    frozenTicks: 500,
    frozenTimeScale: 0,
    movementModifierOrder: ['frozen'],
    prismaticTicks: 0,
    stunFactor: 1,
    stunTicks: 0,
    steamed: null,
    targetId: 1,
    timeScale: 0,
    weakenFactor: 1,
    worldKey: 'boneyard:test',
  } as const
  for (const frozen of [false, true]) {
    const step = stepBoneyardEnemyStore(source, { ...context, tick: 2,
      resolveMovement: ({ requestedPosition }) => requestedPosition,
      ...(frozen ? { abilityEffects: { [actor.id]: effect } } : {}),
    })
    const after = step.store.actors[0]!
    assert.deepEqual(after.position, actor.position)
    assert.equal(after.brain.family, 'faculty')
    if (after.brain.family !== 'faculty') throw new Error('Faculty required')
    assert.equal(after.brain.lightPhase, Math.fround(actor.brain.lightPhase + 1))
    assert.ok(after.brain.lightIntensity > actor.brain.lightIntensity)
    assert.equal(step.store.deathEffects.filter(({ role }) => role === 'faculty-living-smoke').length, 1)
    assert.equal(after.brain.action?.progress, frozen ? 3 : Math.fround(3 + action.rate))
  }
})

test('a lethal hit on any Faculty member immediately interrupts active and queued dialogue', () => {
  const initial = spawned()
  const bossNarration = enqueueNativeBossNarration(createNativeBossNarration(),
    ['faculty-join-us-1', 'faculty-join-us-1-female'], 0, false)
  const source = { ...initial, bossNarration }
  const first = source.actors[0]!
  const result = damageBoneyardEnemy(source, { actorId: first.id, amount: first.currentHealth,
    tick: 0, sourcePlayerId: 'player' })
  assert.equal(result.store.bossNarration.current, null)
  assert.deepEqual(result.store.bossNarration.pending, [])
  assert.equal(result.store.actors.filter(({ lifeState }) => lifeState === 'alive').length, 2)
  assert.ok(result.events.some(({ type }) => type === 'enemy-dialogue-stop'))
  assert.equal(source.bossNarration.current?.cue, 'faculty-join-us-1')
})

test('featured boss selection follows spawn classification, health damage and lethal clearing', () => {
  const classes = ['normal', 'miniboss', 'multiple-boss', 'boss'] as const
  let store = stepBoneyardEnemyStore(createBoneyardEnemyStore('featured-boss'), {
    ...context, tick: 0, resolveSpawnIntents: () => classes.map((classification, index) => ({
      authoredRecipe: { ...nativeFacultyRecipe(SHA, 'Dire Sirmin'), classification },
      enemyToken: 'DIREFACULTY', flags: [], id: index + 1, locationPolicy: 'anywhere',
      nativeTypeId: 1010, pathfindingMode: 2, position: { x: index * 10, y: 0 }, spawnTick: 0, waveOrdinal: 32,
    })),
  }).store
  assert.equal(store.featuredBossId, 3, 'normal and miniboss births do not claim the display')
  store = damageBoneyardEnemy(store, { actorId: 1, amount: 1, tick: 1, sourcePlayerId: 'player' }).store
  assert.equal(store.featuredBossId, 3, 'normal health damage leaves the display alone')
  store = { ...store, actors: store.actors.map(actor => actor.id === 2
    ? { ...actor, shieldHealth: 10, shieldMaximumHealth: 10 } : actor) }
  store = damageBoneyardEnemy(store, { actorId: 2, amount: 1, tick: 2, sourcePlayerId: 'player' }).store
  assert.equal(store.featuredBossId, 3, 'the shield-interception path does not select')
  store = { ...store, actors: store.actors.map(actor => ({ ...actor, shieldHealth: 0 })) }
  store = damageBoneyardEnemy(store, { actorId: 2, amount: 1, tick: 3, sourcePlayerId: 'player' }).store
  assert.equal(store.featuredBossId, 2, 'a miniboss health hit becomes featured')
  store = damageBoneyardEnemy(store, { actorId: 4, amount: 1, tick: 4, sourcePlayerId: 'player' }).store
  assert.equal(store.featuredBossId, 4)
  store = damageBoneyardEnemy(store, { actorId: 4, amount: 99999, tick: 5, sourcePlayerId: 'player' }).store
  assert.equal(store.featuredBossId, null, 'a surviving boss does not automatically replace a lethal selection')
  store = stepBoneyardEnemyStore(store, { ...context, tick: 6 }).store
  assert.equal(store.featuredBossId, null)
  store = damageBoneyardEnemy(store, { actorId: 3, amount: 1, tick: 7, sourcePlayerId: 'player' }).store
  assert.equal(store.featuredBossId, 3)
  store = stepBoneyardEnemyStore({ ...store, actors: store.actors.filter(actor => actor.id !== 3) },
    { ...context, tick: 8 }).store
  assert.equal(store.featuredBossId, null, 'external removal clears the identity')
})

function castFacultyPrimaries() {
  const source = spawned()
  const actors = source.actors.map(actor => {
    if (actor.brain.family !== 'faculty' || actor.config.enemyToken !== 'DIREFACULTY') throw new Error('Faculty required')
    const kind = actor.config.family.primary === 1 ? 'lightning' : 'throw'
    const action = createNativeFacultyAction(kind, createNativeRng(actor.id)).action
    return { ...actor, brain: { ...actor.brain, action: { ...action, progress: action.marker - .01, rate: .1 } } }
  })
  return { ...source, actors }
}

test('Faculty projectile trails use their own tick cadences and survive caster removal', () => {
  const cast = stepBoneyardEnemyStore(castFacultyPrimaries(), context).store
  const detached = { ...cast, actors: [], deathEffects: [] }
  const even = stepBoneyardEnemyStore(detached, { ...context, tick: 2 })
  assert.equal(even.store.deathEffects.filter(effect => effect.role === 'skull-trail').length, 1)
  assert.equal(even.store.deathEffects.filter(effect => effect.role === 'dark-trail').length, 2)
  const odd = stepBoneyardEnemyStore(even.store, { ...context, tick: 3 })
  assert.equal(odd.store.deathEffects.filter(effect => effect.role === 'skull-trail' && effect.spawnTick === 3).length, 1)
  assert.equal(odd.store.deathEffects.filter(effect => effect.role === 'dark-trail' && effect.spawnTick === 3).length, 0)
})

test('blocked Faculty birth segments run full native impacts before retiring the missiles', () => {
  const result = stepBoneyardEnemyStore(castFacultyPrimaries(), {
    ...context, projectileWorldBlocked: request => request.kind === 'line' && request.nativeExclusionMask === 0x380,
  })
  assert.equal(result.store.bossSpells.some(spell => spell.kind === 'skull-missile' || spell.kind === 'dark-fireball'), false)
  assert.equal(result.store.deathEffects.filter(effect => effect.role === 'skull-impact').length, 72)
  assert.equal(result.store.deathEffects.filter(effect => effect.role === 'dark-impact').length, 72)
  assert.equal(result.store.projectileEffects.filter(effect => effect.kind === 'fire-burst').length, 1)
  const glow = result.store.bossSpells.find(spell => spell.kind === 'death-magic' && spell.scale === 2)
  assert.ok(glow)
  assert.equal(result.events.filter(event => event.type === 'projectile-retired').length, 2)
})

test('Skull contact honors the target ten-pixel test and still runs the same-tick terrain callback', () => {
  const cast = stepBoneyardEnemyStore(castFacultyPrimaries(), context).store
  const source = cast.bossSpells.find(spell => spell.kind === 'skull-missile')!
  assert.equal(source.kind, 'skull-missile')
  if (source.kind !== 'skull-missile') throw new Error('Skull required')
  const result = stepBoneyardEnemyStore({ ...cast, actors: [], deathEffects: [], bossSpells: [{
    ...source, ageTicks: 4, position: { x: -12, y: -200 }, headingDeg: 90,
  }] }, { ...context, tick: 6,
    players: { player: { ...context.players.player!, collisionRadius: 0 } },
    projectileWorldBlocked: request => request.kind === 'line',
  })
  assert.equal(result.playerDamage.length, 1)
  assert.equal(result.playerDamage[0]!.manaDamageMaximumFraction, .15)
  assert.equal(result.events.filter(event => event.type === 'projectile-impact').length, 2)
  assert.equal(result.events.filter(event => event.type === 'projectile-retired').length, 1)
  assert.equal(result.store.deathEffects.filter(effect => effect.role === 'skull-impact').length, 144)
})
