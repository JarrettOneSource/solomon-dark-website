import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeSilk } from '../core-kernels/native-silk.ts'
import { nativePrimarySkillProfile } from '../core-kernels/native-primary-skill-profile.ts'
import { createPlayerSkillBook, playerStatBook } from '../core-kernels/player-progression.ts'
import type { PrimarySpellChannelEmission } from '../core-kernels/primary-spells.ts'
import { createBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { resolveBoneyardSpellCombat } from './boneyard-spell-combat.ts'
import type { BoneyardEnemyStore } from './enemies/model.ts'

const worldKey = 'boneyard:silk-combat'
const waterProfile = nativePrimarySkillProfile(createPlayerSkillBook({
  discipline: 'arcane', displayName: 'Water', element: 'water',
}), playerStatBook(), { damage: 1, manaCost: 1 })
if (waterProfile.kind !== 'water') throw new Error('Water fixture did not resolve Frost Jet')

const water: PrimarySpellChannelEmission = {
  id: 1, kind: 'water', ownerId: 'player', worldKey,
  origin: { x: 0, y: -10 }, queryOrigin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 }, endpoint: { x: 200, y: -10 },
  terrainContact: false, damage: 1, manaCost: 0, underpowered: false,
  primarySkill: { ...waterProfile, pushbackFactor: 4 },
}

function withSilk(): BoneyardEnemyStore {
  const source = createBoneyardEnemyStore('silk-combat')
  const created = createNativeSilk({ x: 50, y: 0 }, {
    position: { x: 100, y: 0 }, velocityPerTick: { x: 0, y: 0 },
  }, 10, createNativeRng(10))
  return {
    ...source, nextProjectileId: 2, nextNativeCellBindingOrder: 2, nextNativeRegistrationOrder: 2,
    silks: [{
      id: 1, ownerActorId: 10, spawnTick: 0,
      nativeCellBindingOrder: 1, nativeRegistrationOrder: 1,
      painterRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
      state: { ...created.state, phase: 2 },
    }],
  }
}

function cast(store: BoneyardEnemyStore, emission: PrimarySpellChannelEmission) {
  return resolveBoneyardSpellCombat(store, { nextId: 10, projectiles: [], transients: [] },
    [emission], 1, worldKey, undefined, null, undefined, undefined, [], undefined,
    [], undefined, [], undefined, () => 1)
}

test('powered Frost Jet includes Silk in mask 0x1082 and transfers the broken trail to its own animation queue', () => {
  const result = cast(withSilk(), water)
  assert.equal(result.enemies.silks.length, 0)
  assert.ok(result.enemies.silkFragments.length > 0)
  assert.deepEqual(result.hits, [])
  assert.deepEqual(result.targetEffects, [])
})

test('underpowered Frost Jet excludes Silk and preserves its force accumulator', () => {
  const source = withSilk()
  const result = cast(source, { ...water, underpowered: true })
  assert.deepEqual(result.enemies.silks, source.silks)
  assert.deepEqual(result.enemies.silkFragments, [])
})

test('Blizzard sends its fixed force to Silk even on the underpowered branch', () => {
  const blizzard = weldEmission(1004, true)
  const result = cast(withSilk(), blizzard)
  assert.deepEqual(result.enemies.silks, [])
  assert.ok(result.enemies.silkFragments.length > 0)
  assert.deepEqual(result.spells.transients, [])
  assert.deepEqual(result.targetEffects, [])
})

function weldEmission(buildId: 1004 | 1005, underpowered = false): PrimarySpellChannelEmission {
  return {
    ...water, kind: 'weld', underpowered,
    primarySkill: {
      kind: 'weld', buildId, castKind: 'channel', damageFactor: 1,
      damageMaximum: 2, damageMinimum: 2, damageRollCount: 1,
      manaCost: 1, rank: 1, skillId: buildId,
      vector: { buildId, castKind: 'channel', values: [200, 10, 0, 4, 0, 0, 0, 0] },
    },
  }
}

test('Steam Jet includes Silk in its native force branch and excludes it when underpowered', () => {
  const source = withSilk()
  assert.equal(cast(source, weldEmission(1005)).enemies.silks.length, 0)
  assert.deepEqual(cast(source, weldEmission(1005, true)).enemies.silks, source.silks)
})
