import assert from 'node:assert/strict'
import test from 'node:test'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { createPrimarySpellSimulation, type PrimarySpellEtherImpactState } from '../core-kernels/primary-spells.ts'
import { removeNativeSecondaryOwner, spawnNativeScriptFires } from '../core-kernels/native-secondary-abilities.ts'
import { createGameSimulation, enterBoneyardWorld, gameSimulationPlayerRecords } from './game-simulation.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { boneyardWorldLightQuery } from './boneyard-world-light.ts'

function fixture() {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 67))!
  const state = enterBoneyardWorld(createGameSimulation({ owner: {
    displayName: 'Spider lights', element: 'ether', discipline: 'arcane',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const players = { owner: { ...gameSimulationPlayerRecords(state).owner, position: { x: 1000, y: 1000 } } }
  const world = { ...state.world, arenaTransition: null, bounds: { x: 0, y: 0, w: 4000, h: 4000 }, lanternPosition: null }
  const point = { x: 1480, y: 1000 }
  return { state, players, world, point, order: createNativeWorldManagerOrder(state.worldManagerOrder) }
}

test('a primary spell outside player light enables full Spider movement and expires without retained illumination', () => {
  const { state, players, world, point, order } = fixture()
  const targets = { owner: { alive: true, connected: true, eligible: true, collisionRadius: 25, position: players.owner.position, velocityPerTick: { x: 0, y: 0 } } }
  const context = {
    players: targets, projectileWorldBlocked: () => false,
    resolveMovement: ({ requestedPosition }: { requestedPosition: { x: number; y: number } }) => requestedPosition,
  }
  const enemies = stepBoneyardEnemyStore(createBoneyardEnemyStore('spider-light'), {
    ...context, registerWorldPainter: order.register, tick: 0,
    resolveSpawnIntents: () => [{ enemyToken: 'SPIDER', flags: [], id: 1, locationPolicy: 'anywhere', nativeTypeId: 2057, position: point, spawnTick: 0, waveOrdinal: 4 }],
  }).store
  const spider = enemies.actors[0]!
  if (spider.brain.family !== 'spider') throw new Error('Expected Spider')
  const held = { ...enemies, actors: [{ ...spider, brain: { ...spider.brain, actionState: 3 as const, actionTicksRemaining: 10 } }] }
  const impact: PrimarySpellEtherImpactState = {
    kind: 'ether-impact', id: 1, ageTicks: 0, birthTick: 1, origin: point,
    ownerId: 'owner', visualScale: 1, worldKey: `boneyard:${world.runId}`,
    painterRegistration: order.register('actor'), lightRegistration: order.register('actor'),
  }
  const spellState = { ...createPrimarySpellSimulation(), nextId: 2, transients: [impact] }
  const environment = { playerEntities: state.playerEntities }
  const dark = boneyardWorldLightQuery(world, players, held, 1, environment)
  const lit = boneyardWorldLightQuery(world, players, held, 1, { ...environment, primarySpells: spellState })
  assert.equal(dark.scalarAt(point), 0)
  assert.equal(lit.scalarAt(point), Math.fround(1 + Math.fround(-0.05)))
  for (const [light, expectedTicks] of [[dark, 10], [lit, 8]] as const) {
    const moved = stepBoneyardEnemyStore(held, {
      ...context, tick: 1, resolveSpawnIntents: () => [], lightAt: light.scalarAt,
      spiderMovementView: { arenaBounds: world.bounds, cameras: light.cameras, enhancedEffects: true },
    }).store.actors[0]!
    if (moved.brain.family !== 'spider') throw new Error('Expected Spider')
    assert.equal(moved.brain.actionTicksRemaining, expectedTicks)
  }
  const expired = boneyardWorldLightQuery(world, players, held, 21, {
    ...environment, primarySpells: { ...spellState, transients: [{ ...impact, ageTicks: 20 }] },
  })
  assert.equal(expired.scalarAt(point), 0)
  assert.equal(boneyardWorldLightQuery(world, players, held, 1, {
    ...environment, primarySpells: { ...spellState, transients: [{ ...impact, worldKey: 'hub' }] },
  }).scalarAt(point), 0)
})

test('secondary light follows its live owner and contributes no light before ignition or after cleanup', () => {
  const { state, players, world, point, order } = fixture()
  const born = spawnNativeScriptFires(state.secondaryAbilities, 'owner', `boneyard:${world.runId}`, [{
    position: point, damage: 1, radius: 100, lifetimeTicks: 100,
  }], order.register)
  const query = (secondaryAbilities: typeof born) => boneyardWorldLightQuery(world, players, world.enemies, 1, {
    playerEntities: state.playerEntities, secondaryAbilities,
  }).scalarAt(point)
  assert.equal(query(born), 0)
  const burning = { ...born, actors: born.actors.map(actor => ({ ...actor, radius: 1 })) }
  assert.equal(query(burning), 1)
  assert.equal(query(removeNativeSecondaryOwner(burning, 'owner')), 0)
})
