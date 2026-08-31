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
  type NativeWeldImpactActorState,
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
import { createNativeWeldFlameLashFade } from '../core-kernels/native-weld-flame-lash.ts'
import { createNativeWeldBlizzardSourceGlows } from '../core-kernels/native-weld-blizzard.ts'
import { createPrimarySpellWeldImpact } from '../core-kernels/primary-spells.ts'
import { buildNativeAirRibbonLayer } from './primary-spell-air-native.ts'
import {
  NATIVE_WELD_BADGUYS_RECORDS,
  NATIVE_WELD_DEADHAWG_RECORDS,
  NATIVE_WELD_DEADHAWG_SPRITES,
  NATIVE_WELD_SPRITES,
  isNativeWeldPresentationState,
  nativeWeldVisualPlan,
} from './primary-spell-weld-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const WORLD_KEY = 'boneyard:weld-render'

test('Weld atlas membership covers every recovered direct owner', () => {
  for (const record of [
    5, 6, 15, 16, 18, 28, 30, 31, 32, 35, 43, 44, 45, 50, 51, 67, 70, 71, 76, 86, 87,
    110, 111, 112, 168, 169, 170, 171, 251, 266, 271, 282,
    1836, 1839, 2008, 2010,
  ]) assert.ok((NATIVE_WELD_BADGUYS_RECORDS as readonly number[]).includes(record))
  assert.equal(NATIVE_WELD_SPRITES[44].atlas, 'BadGuys')
  assert.equal(NATIVE_WELD_SPRITES[76].entry, 76)
  assert.deepEqual(NATIVE_WELD_DEADHAWG_RECORDS, [19])
  assert.equal(NATIVE_WELD_DEADHAWG_SPRITES[19].atlas, 'DeadHawg')
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
  assert.equal(ball.sprites.filter(({ role }) => role.includes('-circle-')).length, 4)
  assert.equal(ball.sprites.filter(({ role }) => role.includes('-fork-')).length, 2)
  assert.deepEqual(ball.sprites.filter(({ role }) => role === 'ball-lightning-body').map((draw) => ({
    offset: draw.offset,
    record: draw.record,
  })), [{ offset: { x: 0, y: -10 }, record: 70 }])
  const ether = ball.sprites.filter(({ role }) => role.startsWith('ball-lightning-ether-'))
  assert.ok(ether.length >= 12)
  assert.ok(ether.some(({ record }) => record === 111))
  assert.ok(ether.some(({ record }) => record === 112))

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

test('Frost Missile uses its concrete helper, lane, and affine learned-overlay records', () => {
  const frost = {
    ...projectile(1001),
    frostTurnDegrees: 0,
    vector: [8, 8, 2, 1, 1, 1, 1],
  }
  const plan = nativeWeldVisualPlan(frost)
  assert.deepEqual(plan.sprites.map(({ record }) => record), [271, 5, 110, 16, 16, 87, 87])
  assert.ok(plan.sprites.slice(1).every(({ blend }) => blend === 'add'))
  assert.deepEqual(plan.sprites.filter(({ record }) => record === 16).map(({ alpha, tint }) => ({
    alpha,
    tint,
  })), [
    { alpha: 1, tint: 0x80ffff },
    { alpha: 1, tint: 0x80ffff },
  ])
  assert.deepEqual(plan.sprites.filter(({ record }) => record === 87).map(({ matrix }) => matrix), [
    { a: 1.4, b: 0, c: 0, d: 1.12, tx: 0, ty: 0 },
    { a: 1.75, b: 0, c: 0, d: 1.4, tx: 0, ty: 0 },
  ])

  const weak = nativeWeldVisualPlan({
    ...frost,
    underpowered: true,
    vector: [4, 4, 2, 1, 0.8, 0, 0],
  })
  assert.equal(weak.sprites.some(({ record }) => record === 87), false)
  assert.ok(weak.sprites.filter(({ record }) => record === 16).every(({ alpha }) => alpha === 0.5))
})

test('channel and Steam plans use their concrete native classes', () => {
  const flame: Extract<NativeWeldWorldActor, { kind: 'weld-channel' }> = {
    ageTicks: 0, birthTick: 1, buildId: 1003, direction: { x: 1, y: 0 },
    endpoint: { x: 100, y: 0 }, id: 1, kind: 'weld-channel', lightRegistration: null,
    midpoint: { x: 50, y: 10 }, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    targetId: 'enemy:1', underpowered: false, variant: 0,
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    worldKey: WORLD_KEY,
  }
  const flamePlan = nativeWeldVisualPlan(flame)
  assert.deepEqual(flamePlan.meshes.map(({ record }) => record), [44])
  const nativeLayer = buildNativeAirRibbonLayer({
    alpha: 1,
    basePhaseDegrees: -3,
    birthTick: 1,
    endpoint: { x: 100, y: 0 },
    id: 1,
    midpoint: { x: 50, y: 10 },
    source: { x: 0, y: 0 },
    tint: 0xffffff,
    width: 1,
  })
  assert.deepEqual(flamePlan.meshes[0]!.vertices, Array.from(nativeLayer.vertices))
  assert.deepEqual(flamePlan.meshes[0]!.uvs, Array.from(nativeLayer.uvs))
  const weakFlame = nativeWeldVisualPlan({ ...flame, underpowered: true })
  assert.equal(weakFlame.meshes[0]!.alpha, 0.5)
  assert.notDeepEqual(weakFlame.meshes[0]!.vertices, flamePlan.meshes[0]!.vertices)
  const blizzard = { ...flame, buildId: 1004 as const, vector: [8, 2, 1, 0.8, 0, 0, 0.2] }
  assert.deepEqual(nativeWeldVisualPlan(blizzard).meshes.map(({ record }) => record), [43, 44])
  const glows = createNativeWeldBlizzardSourceGlows({
    direction: blizzard.direction, firstId: 20, origin: blizzard.origin,
    ownerId: blizzard.ownerId, rng: createNativeRng(44), tick: 2,
    vector: blizzard.vector, worldKey: WORLD_KEY,
  })
  assert.ok(glows.actors.every((glow) => (
    nativeWeldVisualPlan(glow).sprites.some(({ record }) => record === 110)
  )))
  const chainFrost = nativeWeldVisualPlan({
    ageTicks: 0,
    birthTick: 2,
    buildId: 1004,
    direction: { x: 0.5, y: 0 },
    id: 22,
    kind: 'weld-blizzard-chain-frost',
    lightRegistration: null,
    origin: { x: 100, y: 0 },
    ownerId: 'wizard',
    vector: blizzard.vector,
    worldKey: WORLD_KEY,
  })
  assert.ok(chainFrost.sprites.some(({ record }) => record === 30))
  assert.ok(chainFrost.sprites.some(({ record }) => record === 28))

  const fade = createNativeWeldFlameLashFade({
    direction: { x: 1, y: 0 }, id: 3, origin: { x: 100, y: 0 }, ownerId: 'wizard',
    rng: createNativeRng(30), tick: 2, variant: 'endpoint',
    vector: flame.vector, worldKey: WORLD_KEY,
  }).actor
  const fadePlan = nativeWeldVisualPlan(fade)
  assert.equal(fadePlan.sprites[0]!.record, 35)
  assert.equal(fadePlan.sprites[0]!.blend, 'add')
  assert.deepEqual(fadePlan.regionLightPoint, fade.position)

  const steam = spawnNativeWeldSteamActor({
    damage: 8, direction: { x: 1, y: 0 }, id: 2, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    queryOrigin: { x: 0, y: 0 }, rng: createNativeRng(1), tick: 2, underpowered: true,
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0], worldKey: WORLD_KEY,
  }).actor!
  const steamPlan = nativeWeldVisualPlan(steam)
  assert.ok(steamPlan.sprites.every(({ record }) => record === 76))
  assert.equal(steamPlan.sprites.length, 2)
  assert.ok(steamPlan.sprites.every(({ blend }) => blend === 'add'))
  assert.ok(steamPlan.sprites.every(({ alpha }) => alpha <= Math.fround(0.25)))
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
  const bouncerSprites = nativeWeldVisualPlan(terrainBouncer).sprites
  assert.deepEqual(bouncerSprites.slice(0, 2).map(({ alpha, record, scaleX, scaleY }) => ({
    alpha,
    record,
    scaleX,
    scaleY,
  })), [
    {
      alpha: Math.min(1, terrainBouncer.alpha),
      record: 32,
      scaleX: terrainBouncer.scale,
      scaleY: terrainBouncer.scale * 0.75,
    },
    {
      alpha: Math.min(1, terrainBouncer.alpha),
      record: 32,
      scaleX: terrainBouncer.scale,
      scaleY: terrainBouncer.scale,
    },
  ])
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
    debris: debrisProgram.debris[0]!, direction: { x: 1, y: 0 }, id: 21,
    origin: { x: 0, y: 0 }, ownerId: 'wizard', tick: 1,
    vector: [8, 2, 1, 1, 1, 1], worldKey: WORLD_KEY,
  })
  const debrisSprites = nativeWeldVisualPlan(debris).sprites
  assert.deepEqual(debrisSprites.map(({ alpha, record, scaleX, scaleY }) => ({
    alpha,
    record,
    scaleX,
    scaleY,
  })), [
    {
      alpha: 1,
      record: debris.debris.record,
      scaleX: debris.debris.scale,
      scaleY: debris.debris.scale * 0.75,
    },
    {
      alpha: 1,
      record: debris.debris.record,
      scaleX: debris.debris.scale,
      scaleY: debris.debris.scale,
    },
  ])
})

test('retained EBoulder and Hail preserve their native center, overlay, and auxiliary owners', () => {
  const ethereal = createNativeWeldPersistentActor({
    buildId: 1006, direction: { x: 1, y: 0 }, id: 70, origin: { x: 0, y: 0 },
    ownerId: 'wizard', tick: 1, vector: [8, 2, 4, 1, 1, 1], worldKey: WORLD_KEY,
  })
  assert.equal(ethereal.buildId, 1006)
  const held = nativeWeldVisualPlan(ethereal)
  assert.equal(held.sprites.filter(({ role }) => role === 'ethereal-boulder-aura').length, 1)
  assert.equal(held.sprites.filter(({ role }) => role === 'ethereal-boulder-held-auxiliary').length, 1)
  assert.equal(held.sprites.some(({ record }) => record === 171), false)
  for (let center = 0; center < 4; center += 1) {
    assert.ok(held.sprites.some(({ role }) => role.startsWith(
      `ethereal-boulder-center-${center}-`,
    )))
  }
  assert.ok(held.sprites.filter(({ role }) => role.startsWith('ethereal-boulder-rock-'))
    .every(({ scaleX, scaleY }) => scaleX === scaleY && scaleX >= 0.25))

  const released = releaseNativeWeldPersistentActor({
    actor: ethereal, firstChildId: 80, rng: createNativeRng(3), tick: 2,
  })
  const flight = nativeWeldVisualPlan(released.actors[0]!)
  assert.equal(flight.sprites.filter(({ role }) => role.startsWith(
    'ethereal-boulder-center-0-',
  )).length > 0, true)
  assert.equal(flight.sprites.some(({ role }) => role.includes('center-1-')), false)
  assert.deepEqual(flight.sprites.filter(({ role }) => (
    role === 'ethereal-boulder-flight-auxiliary'
  )).map(({ record, scaleX }) => ({ record, scaleX })), [{
    record: 67,
    scaleX: ethereal.scale * 2.5,
  }])

  const hailSource = createNativeWeldPersistentActor({
    buildId: 1008, direction: { x: 1, y: 0 }, id: 90, origin: { x: 0, y: 0 },
    ownerId: 'wizard', tick: 1, vector: [8, 2, 40, 1.5, 0.1, 0.5],
    worldKey: WORLD_KEY,
  })
  assert.equal(hailSource.buildId, 1008)
  const hail = updateNativeWeldPersistentActor(
    hailSource, hailSource.origin, hailSource.direction, createNativeRng(4),
  ).actor
  assert.equal(hail.buildId, 1008)
  const hailPlan = nativeWeldVisualPlan(hail)
  assert.ok(hailPlan.sprites.some(({ role, record }) => (
    role.startsWith('hailstones-held-water-water-') && record >= 271 && record <= 282
  )))
  assert.equal(hailPlan.sprites.filter(({ role }) => role.startsWith(
    'hailstones-rock-overlay-',
  )).length, hail.rocks.length)
  assert.ok(hailPlan.sprites.filter(({ role }) => role.startsWith(
    'hailstones-rock-overlay-',
  )).every(({ record, scaleX, scaleY }) => record === 32 && scaleX === 1 && scaleY === 1))
  assert.equal(hailPlan.sprites.some(({ role }) => role === 'hailstones-held-auxiliary'), true)
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
  assert.equal(Math.abs(fallPlan.sprites[1]!.scaleX), 1)
  assert.equal(fallPlan.sprites[1]!.scaleY, 2)
  const finalDescent = nativeWeldVisualPlan({ ...meteor, fallHeight: 0.5 })
  assert.deepEqual(finalDescent.sprites.filter(({ atlas }) => atlas === 'DeadHawg').map((draw) => ({
    alpha: draw.alpha,
    record: draw.record,
    scaleX: draw.scaleX,
    scaleY: draw.scaleY,
  })), [{ alpha: 0.25, record: 19, scaleX: 2, scaleY: 1.6 }])
  assert.equal(finalDescent.sortBias, 0)
  const impactProgram = createNativeWeldMeteorImpactProgram({
    bodyScale: 1, rng: createNativeRng(5), underpowered: false,
  })
  const impacted = {
    ...meteor,
    debris: impactProgram.debris,
    impactRotationDegrees: impactProgram.impactRotationDegrees,
    phase: 'impact' as const,
  }
  assert.deepEqual(nativeWeldVisualPlan(impacted).sprites.map(({ record }) => record), [67])
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
  const base = createPrimarySpellWeldImpact(1106, projectile(1000), 1, createNativeRng(7)).impact
  const etherealImpact = {
    ...base,
    alpha: 2,
    boulderTerminalCharge: 0.5,
    buildId: 1006,
    lightRegistration: { managerLane: 'transient' as const, registrationOrdinal: 1106 },
    presentationScale: 2,
    vector: [8, 2, 1, 1, 1, 1],
  } satisfies NativeWeldImpactActorState
  const etherealPlan = nativeWeldVisualPlan(etherealImpact)
  assert.ok(etherealPlan.sprites.every(({ role }) => role.startsWith(
    'ethereal-boulder-impact-',
  )))
  assert.deepEqual(etherealPlan.regionLightPoint, etherealImpact.position)
})

test('PrimarySpellWorldView routes and tears down native Weld plans', () => {
  const root = new Container()
  const view = new PrimarySpellWorldView(root, textures())
  const spell = projectile(1000)
  view.update({ nextId: 2, projectiles: [spell], transients: [] }, WORLD_KEY, 1)
  assert.equal(view.count, 1)
  assert.ok(view.kinds[0]!.startsWith('weld'))
  const painterLayers = view.painterLayers()
  assert.ok(painterLayers.length > 0)
  assert.equal(view.painterLayers(), painterLayers)
  view.update({ nextId: 2, projectiles: [spell], transients: [] }, WORLD_KEY, 2)
  assert.equal(view.painterLayers(), painterLayers)
  view.update({ nextId: 2, projectiles: [], transients: [] }, WORLD_KEY, 2)
  assert.equal(view.count, 0)
  assert.equal(view.painterLayers(), painterLayers)
  assert.equal(painterLayers.length, 0)
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
  const projectile = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: buildId, origin: { x: 0, y: 0 },
    ownerId: 'wizard', primarySkill: profile(buildId), rng: createNativeRng(buildId),
    targets: [], underpowered: false, worldKey: WORLD_KEY,
  }).projectiles[0]!
  return {
    ...projectile,
    painterRegistrations: [projectile.lightRegistration],
  }
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
  const weldActors = {
    BadGuys: Object.fromEntries(NATIVE_WELD_BADGUYS_RECORDS.map((entry) => [
      entry,
      { ...NATIVE_WELD_SPRITES[entry], texture: Texture.EMPTY },
    ])),
    DeadHawg: Object.fromEntries(NATIVE_WELD_DEADHAWG_RECORDS.map((entry) => [
      entry,
      { ...NATIVE_WELD_DEADHAWG_SPRITES[entry], texture: Texture.EMPTY },
    ])),
  }
  return { primarySpells: { weldActors } } as unknown as PlayerWorldTextures
}
