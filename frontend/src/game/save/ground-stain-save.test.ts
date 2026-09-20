import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { spawnSimpleDeathEffect } from '../core-server/enemies/death-effects.ts'
import type { BoneyardEnemyDeathEffect } from '../core-server/enemies/model.ts'
import { createGameSimulation, enterBoneyardWorld } from '../core-server/game-simulation.ts'
import { materializeStockTutorial } from '../host/boneyard-catalog.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from './game-save-document.ts'

test('Zombie ground stains retain background ownership and migrate the former sorted owner', () => {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 36))
  const state = enterBoneyardWorld(createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Ground stain', element: 'fire' },
  }), loadedBoneyard)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const deathEffects: BoneyardEnemyDeathEffect[] = []
  const work = { deathEffects, nextDeathEffectId: 1,
    registerWorldPainter: order.register }
  spawnSimpleDeathEffect(work, { id: 1, position: state.world.spawn }, state.tick, {
    kind: 'fade-perspective-clipped', role: 'zombie-clipped-fade', atlas: 'DeadHawg', entry: 30,
    alpha: .6, alphaMultiplier: .6, alphaLossPerTick: .01, blendMode: 'normal',
    lifetimeTicks: 1000, opacityTimer: 10, scale: 1.5, presentationOwner: 'background',
  })
  const document = createGameSaveDocument({
    loadedBoneyard, playerId: 'owner', mods: [], modState: {}, integrity: 'local-only',
    state: { ...state, world: { ...state.world, enemies: { ...state.world.enemies,
      deathEffects: work.deathEffects, nextDeathEffectId: work.nextDeathEffectId } } },
  })
  const current = JSON.parse(document)
  const legacy = JSON.parse(document)
  legacy.schemaVersion = 35
  legacy.continuation.simulation.world.enemies.deathEffects[0].presentationOwner = 'world-sorted'
  legacy.continuation.simulation.world.enemies.deathEffects[0].painterRegistration = order.register('transient')
  legacy.continuation.simulation.worldManagerOrder = order.state()
  for (const saved of [current, legacy]) {
    const restored = restoreGameSaveDocument(JSON.stringify(saved)).state
    if (restored.world.kind !== 'boneyard') throw new Error('expected restored Boneyard')
    assert.deepEqual(restored.world.enemies.deathEffects, work.deathEffects)
  }
  current.continuation.simulation.world.enemies.deathEffects[0].presentationOwner = 'world-sorted'
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(current)), /presentation owner is invalid/)
})
