import assert from 'node:assert/strict'
import test from 'node:test'

import { Container, Texture } from 'pixi.js'

import type { NativeWeldPrimarySkillProfile } from '../core-kernels/native-primary-skill-profile.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import {
  createNativeWeldBoulderDebrisActor,
  createNativeWeldGroundSparkFadeActor,
  createNativeWeldMeteor,
  createNativeWeldMeteorFlash,
  createNativeWeldPersistentActor,
  releaseNativeWeldPersistentActor,
  spawnNativeWeldOneShot,
  stepNativeWeldProjectilePresentation,
  updateNativeWeldPersistentActor,
  type NativeWeldWorldActor,
} from '../core-kernels/native-weld-primary-runtime.ts'
import {
  createNativeWeldEtherealBoulderWeakDebrisProgram,
} from '../core-kernels/native-weld-boulder-debris.ts'
import { createNativeWeldGroundSparkFadeProgram } from '../core-kernels/native-weld-ground-spark.ts'
import {
  createNativeWeldMeteorImpactProgram,
  spawnNativeWeldMeteorMarker,
} from '../core-kernels/native-weld-meteor.ts'
import { spawnNativeWeldSteamActor } from '../core-kernels/native-weld-steam.ts'
import {
  createNativeWeldHailContactPresentation,
  createNativeWeldHailTerrainImpact,
} from '../core-kernels/native-weld-hail-contact.ts'
import { createPrimarySpellWeldImpact } from '../core-kernels/primary-spells.ts'
import {
  NATIVE_WELD_BADGUYS_RECORDS,
  NATIVE_WELD_SPRITES,
  isNativeWeldPresentationState,
  nativeWeldVisualPlan,
} from './primary-spell-weld-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const WORLD_KEY = 'boneyard:weld-render'

test('Weld atlas membership covers every recovered direct owner', () => {
  for (const record of [
    6, 15, 18, 31, 32, 43, 44, 45, 50, 51, 70, 71, 76, 86,
    110, 111, 112, 168, 169, 170, 171, 251, 266, 271, 282,
    1836, 1839, 2008, 2010,
  ]) assert.ok((NATIVE_WELD_BADGUYS_RECORDS as readonly number[]).includes(record))
  assert.equal(NATIVE_WELD_SPRITES[44].atlas, 'BadGuys')
  assert.equal(NATIVE_WELD_SPRITES[76].entry, 76)
})

test('one-shot Weld plans preserve native body, compositor, and child ownership', () => {
  const fire = projectile(1000)
  assert.deepEqual(
    nativeWeldVisualPlan(fire).sprites.map(({ record }) => record),
    [110, 255, 255],
  )

  const frostBirth = projectile(1001)
  const frost = stepNativeWeldProjectilePresentation(frostBirth, createNativeRng(90)).projectile
  const frostPlan = nativeWeldVisualPlan(frost)
  assert.ok(frostPlan.sprites.some(({ record }) => record === 271))
  assert.equal(frostPlan.sprites.filter(({ role }) => role.includes('lane')).length, 2)

  const ball = nativeWeldVisualPlan(projectile(1002))
  assert.ok(ball.sprites.some(({ record }) => record === 110))
  assert.ok(ball.sprites.some(({ record }) => record >= 1836 && record <= 1839))

  const spark = projectile(1009)
  assert.deepEqual(nativeWeldVisualPlan(spark).sprites, [])
  const fadeProgram = createNativeWeldGroundSparkFadeProgram({
    projectile: { ...spark, groundSparkNativeAgeTicks: 0 },
    rng: createNativeRng(7),
  })
  const fade = createNativeWeldGroundSparkFadeActor({
    direction: spark.direction,
    id: 90,
    ownerId: spark.ownerId,
    seed: fadeProgram.fades[0]!,
    tick: 1,
    vector: spark.vector,
    worldKey: spark.worldKey,
  })
  assert.equal(nativeWeldVisualPlan(fade).sprites[0]!.record, 71)
})

test('channel and Steam plans use their concrete native classes', () => {
  const flame: Extract<NativeWeldWorldActor, { kind: 'weld-channel' }> = {
    ageTicks: 0, birthTick: 1, buildId: 1003, direction: { x: 1, y: 0 },
    endpoint: { x: 100, y: 0 }, id: 1, kind: 'weld-channel', lightRegistration: null,
    midpoint: { x: 50, y: 10 }, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    targetId: 'enemy:1', variant: 0, vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    worldKey: WORLD_KEY,
  }
  assert.deepEqual(nativeWeldVisualPlan(flame).meshes.map(({ record }) => record), [44])
  const blizzard = { ...flame, buildId: 1004 as const, vector: [8, 2, 1, 0.8, 0, 0, 0.2] }
  assert.deepEqual(nativeWeldVisualPlan(blizzard).meshes.map(({ record }) => record), [43, 44])

  const steam = spawnNativeWeldSteamActor({
    direction: { x: 1, y: 0 }, id: 2, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    rng: createNativeRng(1), tick: 2, underpowered: true,
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0], worldKey: WORLD_KEY,
  }).actor!
  assert.ok(nativeWeldVisualPlan(steam).sprites.every(({ record }) => record === 76))
})

test('retained rocks, independent fades, Meteor marker, and debris all render', () => {
  const ethereal = createNativeWeldPersistentActor({
    buildId: 1006, direction: { x: 1, y: 0 }, id: 10, origin: { x: 0, y: 0 },
    ownerId: 'wizard', tick: 1, vector: [8, 2, 1, 1, 1, 1], worldKey: WORLD_KEY,
  })
  assert.equal(ethereal.buildId, 1006)
  assert.ok(nativeWeldVisualPlan(ethereal).sprites.some(({ record }) => record === 86))

  const hailSource = createNativeWeldPersistentActor({
    buildId: 1008, direction: { x: 1, y: 0 }, id: 11, origin: { x: 0, y: 0 },
    ownerId: 'wizard', tick: 1, vector: [8, 2, 40, 1.5, 0.1, 0.5],
    worldKey: WORLD_KEY,
  })
  assert.equal(hailSource.buildId, 1008)
  const hailUpdate = updateNativeWeldPersistentActor(
    hailSource, hailSource.origin, hailSource.direction, createNativeRng(2),
  )
  assert.equal(hailUpdate.actor.buildId, 1008)
  assert.ok(nativeWeldVisualPlan(hailUpdate.actor).sprites.some(({ record }) => (
    record >= 168 && record <= 170
  )))
  const released = releaseNativeWeldPersistentActor({
    actor: hailUpdate.actor, firstChildId: 100, rng: hailUpdate.rng, tick: 3,
  })
  const frostFade = released.actors.find(({ kind }) => kind === 'weld-frost-fade')!
  assert.ok(nativeWeldVisualPlan(frostFade).sprites.length >= 3)

  const terrain = createNativeWeldHailTerrainImpact({
    actor: released.actors.find((actor) => (
      actor.kind === 'weld-persistent' && actor.buildId === 1008
    ))!,
    enhancedEffects: true,
    firstId: 110,
    rng: released.rng,
    tick: 4,
  })
  const terrainParticle = terrain.actors.find(({ kind }) => (
    kind === 'weld-hail-terrain-particle'
  ))!
  const terrainBouncer = terrain.actors.find(({ kind }) => (
    kind === 'weld-hail-terrain-bouncer'
  ))!
  assert.equal(nativeWeldVisualPlan(terrainParticle).sprites[0]!.record, 45)
  assert.ok(nativeWeldVisualPlan(terrainBouncer).sprites.some(({ record }) => record === 32))
  const contact = createNativeWeldHailContactPresentation({
    actor: released.actors.find((actor) => (
      actor.kind === 'weld-persistent' && actor.buildId === 1008
    ))!,
    end: { x: 5, y: 10 },
    firstId: terrain.nextId,
    rng: terrain.rng,
    start: { x: 0, y: 0 },
    tick: 5,
  })
  assert.equal(nativeWeldVisualPlan(contact.actors[0]).lines.length, 2)
  assert.equal(nativeWeldVisualPlan(contact.actors[1]).sprites[0]!.record, 15)

  const marker = spawnNativeWeldMeteorMarker({
    direction: { x: 0, y: -1 }, id: 20, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    rng: createNativeRng(3), tick: 1, vector: [8, 8, 2, 1, 1, 0, 0, 0, 0],
    worldKey: WORLD_KEY,
  }).marker
  assert.equal(nativeWeldVisualPlan(marker).sprites[0]!.record, 51)

  const debrisProgram = createNativeWeldEtherealBoulderWeakDebrisProgram({
    direction: { x: 1, y: 0 }, rng: createNativeRng(4), scale: 0.4,
  })
  const debris = createNativeWeldBoulderDebrisActor({
    buildId: 1006,
    debris: debrisProgram.debris, direction: { x: 1, y: 0 }, id: 21,
    origin: { x: 0, y: 0 }, ownerId: 'wizard', tick: 1,
    vector: [8, 2, 1, 1, 1, 1], worldKey: WORLD_KEY,
  })
  assert.equal(nativeWeldVisualPlan(debris).sprites.length, debrisProgram.debris.length)
})

test('Meteor impact and all one-shot FadeFrost/FadeLightning variants are visible', () => {
  const meteor = createNativeWeldMeteor({
    bodyScale: 1, damage: 8, direction: { x: 0, y: -1 }, fallHeadingDegrees: 20,
    fallHeight: 5, fallStep: 0.04, id: 40, impactTicks: 200,
    origin: { x: 0, y: 0 }, ownerId: 'wizard', position: { x: 0, y: 0 },
    privateSeed: 1, tick: 1, underpowered: false,
    vector: [8, 8, 2, 1, 1, 0, 0, 0, 0], worldKey: WORLD_KEY,
  })
  const fallPlan = nativeWeldVisualPlan(meteor)
  assert.ok(fallPlan.sprites.length >= 2)
  assert.equal(fallPlan.sprites[0]!.offset.y, -3840)
  assert.equal(fallPlan.sprites[1]!.scaleX, 1)
  assert.equal(fallPlan.sprites[1]!.scaleY, 2)
  const impactProgram = createNativeWeldMeteorImpactProgram({
    bodyScale: 1, rng: createNativeRng(5), underpowered: false,
  })
  const impacted = {
    ...meteor,
    debris: impactProgram.debris,
    impactRotationDegrees: impactProgram.impactRotationDegrees,
    phase: 'impact' as const,
  }
  assert.ok(nativeWeldVisualPlan(impacted).sprites.length >= 6)
  const flash = createNativeWeldMeteorFlash({ actor: impacted, id: 41, tick: 2 })
  assert.deepEqual(nativeWeldVisualPlan(flash).sprites.map(({ record, scaleX }) => ({
    record,
    scaleX,
  })), [{ record: 15, scaleX: 6 }])

  for (const buildId of [1001, 1002, 1009] as const) {
    const spell = projectile(buildId)
    const impact = createPrimarySpellWeldImpact(100 + buildId, spell, 1, createNativeRng(6))
    assert.ok(nativeWeldVisualPlan(impact.impact).sprites.length >= 3)
  }
})

test('PrimarySpellWorldView routes and tears down native Weld plans', () => {
  const root = new Container()
  const view = new PrimarySpellWorldView(root, textures())
  const spell = projectile(1000)
  view.update({ nextId: 2, projectiles: [spell], transients: [] }, WORLD_KEY, 1)
  assert.equal(view.count, 1)
  assert.ok(view.kinds[0]!.startsWith('weld'))
  assert.ok(view.painterLayers().length > 0)
  view.update({ nextId: 2, projectiles: [], transients: [] }, WORLD_KEY, 2)
  assert.equal(view.count, 0)
  view.destroy()
})

test('Weld presentation guard excludes unrelated primary actors', () => {
  assert.equal(isNativeWeldPresentationState(projectile(1000)), true)
  assert.equal(isNativeWeldPresentationState({
    ageTicks: 0, id: 1, kind: 'fire-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
    origin: { x: 0, y: 0 }, ownerId: 'wizard', worldKey: WORLD_KEY,
  }), false)
})

function projectile(buildId: 1000 | 1001 | 1002 | 1009) {
  return spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: buildId, origin: { x: 0, y: 0 },
    ownerId: 'wizard', primarySkill: profile(buildId), rng: createNativeRng(buildId),
    targets: [], underpowered: false, worldKey: WORLD_KEY,
  }).projectiles[0]!
}

function profile(buildId: 1000 | 1001 | 1002 | 1009): NativeWeldPrimarySkillProfile {
  const values = buildId === 1000
    ? [8, 8, 2, 1, 1, 0, 0, 0, 0]
    : buildId === 1009
      ? [8, 2, 1, 1, 1, 0]
      : [8, 8, 2, 1, 1, 0, 0]
  return {
    buildId, castKind: 'one-shot', damageFactor: 1, damageMaximum: 8,
    damageMinimum: 8, kind: 'weld', manaCost: 2, skillId: buildId,
    vector: { values, weldEffectFactor: 1 },
  }
}

function textures(): PlayerWorldTextures {
  const weldActors = Object.fromEntries(NATIVE_WELD_BADGUYS_RECORDS.map((entry) => [
    entry,
    { ...NATIVE_WELD_SPRITES[entry], texture: Texture.EMPTY },
  ]))
  return { primarySpells: { weldActors } } as unknown as PlayerWorldTextures
}
