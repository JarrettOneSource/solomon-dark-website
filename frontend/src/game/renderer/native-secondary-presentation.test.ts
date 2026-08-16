import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SECONDARY_ACTOR_KINDS,
  nativeSecondaryLightDisposition,
  type NativeSecondaryActorKind,
  type NativeSecondaryActorState,
  type NativeSecondaryEventState,
  type NativeSecondaryScreenFlashState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
} from '../core-kernels/native-rng.ts'
import {
  nativeSecondaryMiscLightSource,
  nativeSecondaryProviderLightSource,
} from './boneyard-lighting.ts'
import {
  nativeGolemFacing,
  nativeGolemPresentationPlan,
  nativePlayerMagicShieldPlan,
  nativePlayerMaterialTint,
  nativeEtherFadeScalar,
  nativeSecondaryPresentationPlan,
  nativeRegionPointGain,
  NativeSecondaryScreenFeedbackPresentation,
  nativeSecondaryWorldShake,
} from './native-secondary-presentation.ts'

const KINDS: readonly NativeSecondaryActorKind[] = [
  'leviathan', 'leviathan-appendage', 'leviathan-mote', 'ether-bolt', 'ether-fade', 'phase-burst',
  'plane-orb-shot', 'plane-orb-particle', 'moving-fire', 'shockwave', 'fire-patch', 'fire-burn',
  'fire-burn-flame', 'storm-cloud',
  'storm-drop', 'storm-strike', 'prismatic-wave', 'freeze-wave', 'freeze-wave-visual',
  'ice-blast', 'earthquake', 'earthquake-scenery-wobble', 'earthquake-quake',
  'earthquake-dust', 'earthquake-debris',
  'golem', 'golem-death', 'teleport-burst', 'magic-circle',
  'magic-circle-player-flash', 'magic-trap', 'magic-trap-shimmer',
  'magic-trap-burst', 'electric-burn', 'dampen-wave', 'shield-break',
  'shield-explosion', 'acid-rain', 'acid-drop', 'acid-splash', 'ether-drain',
  'ether-drain-cloud', 'ether-drain-debris', 'ether-drain-capture-flare', 'comet',
  'comet-trail', 'comet-impact', 'comet-debris', 'turn-undead',
]

function actor(kind: NativeSecondaryActorKind): NativeSecondaryActorState {
  return {
    ageTicks: kind === 'golem' ? 400 : 10,
    alpha: 1,
    damage: 1,
    enhanced: true,
    endpoint: { x: 140, y: 240 },
    frame: kind === 'moving-fire' || kind === 'fire-patch' ? 46 : 0,
    freezeTicks: 0,
    golem: kind === 'golem' ? {
      actionDurationTicks: 0,
      actionTick: 0,
      currentHealth: 100,
      damageMaximum: 8,
      iron: false,
      maximumHealth: 100,
      orbitDirection: 0,
      orbitHeadingRadians: null,
      phase: 'active',
      poseVariant: 0,
      provokeRollBound: 1_200,
      reflectFactor: 0,
      targetPollTicksRemaining: 50,
    } : null,
    hitTargetIds: [],
    id: 1,
    kind,
    lifetimeTicks: 1_000,
    lightRegistration: null,
    midpoint: { x: 120, y: 180 },
    miscLightAppendOrdinal: null,
    ownerId: 'player',
    phase: 0,
    position: { x: 100, y: 200 },
    presentationRng: kind === 'dampen-wave' || kind === 'golem-death' || kind === 'freeze-wave-visual'
      || kind === 'storm-cloud' || kind === 'prismatic-wave' || kind === 'magic-circle'
      || kind === 'shield-explosion' || kind === 'magic-trap-burst'
      ? createNativeRng(711)
      : null,
    quantity: 1,
    radius: 400,
    rank: 1,
    rotationRadians: 0,
    scale: 1,
    skillId: kind.startsWith('acid-') ? 72 : kind.startsWith('comet') ? 76 : kind.startsWith('golem') ? 45 : 11,
    slowFactor: 0.5,
    targetId: null,
    variant: 0,
    velocity: { x: 1, y: 0 },
    worldKey: 'boneyard:test',
  }
}

function screenEvent(
  eventId: number,
  tick: number,
  screenFlash: NativeSecondaryScreenFlashState,
  position = { x: 0, y: 0 },
): NativeSecondaryEventState {
  return {
    actorId: null,
    cue: null,
    eventId,
    kind: 'pulse',
    ownerId: 'player',
    pitch: 1,
    position,
    screenFlash,
    skillId: 48,
    tick,
    worldKey: 'boneyard:test',
  }
}

test('every authoritative secondary actor kind has an explicit stock presentation disposition', () => {
  assert.deepEqual(KINDS, NATIVE_SECONDARY_ACTOR_KINDS)
  for (const kind of KINDS) {
    const plan = nativeSecondaryPresentationPlan(actor(kind))
    assert.equal(plan.root.x, 100, kind)
    assert.ok(['ordinary-dynamic', 'zanim'].includes(plan.queueFamily), kind)
    if (![
      'shockwave', 'fire-burn', 'electric-burn', 'storm-cloud', 'storm-strike', 'freeze-wave', 'ice-blast',
      'earthquake-scenery-wobble',
    ].includes(kind)) {
      assert.ok(plan.draws.length > 0, `${kind} unexpectedly became invisible`)
    }
  }
})

test('the complete secondary light census stays split between providers and MiscLight writers', () => {
  const actorProviders = new Set<NativeSecondaryActorKind>([
    'leviathan', 'ether-bolt', 'moving-fire', 'shockwave', 'fire-patch',
    'storm-cloud', 'freeze-wave', 'golem', 'magic-trap', 'acid-rain',
    'ether-drain', 'comet',
  ])
  const miscWriters = new Set<NativeSecondaryActorKind>([
    'magic-circle', 'fire-burn', 'electric-burn',
  ])
  for (const kind of KINDS) {
    const source = actor(kind)
    const expectedDisposition = actorProviders.has(kind)
      ? 'actor-provider'
      : miscWriters.has(kind)
        ? 'misc'
        : 'none'
    assert.equal(nativeSecondaryLightDisposition(source), expectedDisposition, kind)
    assert.equal(
      nativeSecondaryProviderLightSource(source) !== null,
      actorProviders.has(kind),
      `${kind} provider`,
    )
    assert.equal(
      nativeSecondaryMiscLightSource(source) !== null,
      miscWriters.has(kind),
      `${kind} MiscLight`,
    )
  }

  const litFade = {
    ...actor('ether-fade'),
    ageTicks: 0,
    alpha: 2,
    scale: 1.5,
    slowFactor: 0.1,
    variant: 1,
  }
  assert.equal(nativeSecondaryLightDisposition(litFade), 'transient-provider')
  assert.deepEqual(nativeSecondaryProviderLightSource(litFade), {
    castsDirectionalShadow: true,
    intensity: 1,
    position: litFade.position,
    radius: 1.5,
  })
})

test('secondary provider adapters preserve every recovered radius, intensity, and shadow flag', () => {
  const cases = [
    [
      { ...actor('moving-fire'), radius: 0.2 },
      { castsDirectionalShadow: true, intensity: 0.6000000000000001, radius: 0.6 },
    ],
    [
      actor('leviathan'),
      { castsDirectionalShadow: true, intensity: 1, radius: 1 },
    ],
    [
      actor('ether-bolt'),
      { castsDirectionalShadow: true, intensity: 1, radius: 0.5 },
    ],
    [
      actor('golem'),
      { castsDirectionalShadow: true, intensity: 0.75, radius: 1 },
    ],
    [
      actor('magic-trap'),
      { castsDirectionalShadow: false, intensity: 1, radius: 0.25 },
    ],
  ] as const
  for (const [source, expected] of cases) {
    assert.deepEqual(nativeSecondaryProviderLightSource(source), {
      ...expected,
      position: source.position,
    }, source.kind)
  }
})

test('Leviathan owns the portal redraw, authored appendage bank, EtherBolt, FadeMM, mote, and lit contact', () => {
  const portal = nativeSecondaryPresentationPlan({
    ...actor('leviathan'),
    alpha: 0.8,
    rotationRadians: 0.25,
    scale: 0.75,
  })
  assert.deepEqual(portal.draws.map(({ alpha, blend, entry, rotationRadians, scaleX }) => ({
    alpha, blend, entry, rotationRadians, scaleX,
  })), [
    { alpha: 0.8, blend: 'normal', entry: 39, rotationRadians: 0.25, scaleX: 0.75 },
    { alpha: 0.4, blend: 'add', entry: 39, rotationRadians: 0.25, scaleX: 0.75 },
  ])
  assert.equal(portal.queueFamily, 'ordinary-dynamic')

  const appendage = nativeSecondaryPresentationPlan({
    ...actor('leviathan-appendage'),
    endpoint: { x: 0, y: -30 },
    frame: 170,
    midpoint: { x: 0, y: 0 },
    phase: 1,
    position: { x: 100, y: 200.75 },
    radius: 2.1,
    rotationRadians: 135 * Math.PI / 180,
    scale: 0.75,
    slowFactor: 0,
    velocity: { x: 0, y: 2.5 },
  })
  assert.equal(appendage.draws[0]?.entry, 364)
  assert.equal(appendage.draws[0]?.rotationRadians, Math.sin(135 * Math.PI / 180) * 5 * Math.PI / 180)
  assert.equal(appendage.draws[0]?.scaleX, 2.1 * 0.75)
  assert.equal(appendage.draws[0]?.scaleY, 2.1 * 0.75)
  assert.equal(appendage.worldY + appendage.sortBias, 200 + 0.07)

  const bolt = nativeSecondaryPresentationPlan({
    ...actor('ether-bolt'),
    alpha: 0.01,
    rotationRadians: 0.5,
    scale: 1,
  }, 12)
  assert.equal(bolt.draws[0]?.entry, 22)
  assert.equal(bolt.draws[0]?.blend, 'add')
  assert.deepEqual(bolt.draws[0]?.offset, { x: 0, y: -25 })
  assert.equal(bolt.draws[0]?.rotationRadians, 0.5)
  assert.ok((bolt.draws[0]?.alpha ?? 0) >= 0.5 && (bolt.draws[0]?.alpha ?? 0) < 1)

  const mote = nativeSecondaryPresentationPlan({
    ...actor('leviathan-mote'),
    alpha: 0.7,
    quantity: 0.5,
    scale: 0.8,
  }).draws[0]!
  assert.deepEqual({
    alpha: mote.alpha,
    blend: mote.blend,
    entry: mote.entry,
    scaleX: mote.scaleX,
    scaleY: mote.scaleY,
    tint: mote.tint,
  }, {
    alpha: 0.7,
    blend: 'add',
    entry: 11,
    scaleX: 0.8,
    scaleY: 0.6400000000000001,
    tint: 0xff80ff,
  })

  assert.equal(nativeEtherFadeScalar(1, 0.05, 0), Math.fround(0.95))
  assert.ok(nativeEtherFadeScalar(1, 0.05, 18) > 0)
  const fadeActor = {
    ...actor('ether-fade'),
    ageTicks: 0,
    alpha: 2,
    quantity: 250,
    scale: 2,
    slowFactor: Math.fround(0.1),
    variant: 1,
  }
  const fade = nativeSecondaryPresentationPlan(fadeActor)
  assert.deepEqual([...new Set(fade.draws.map(({ entry }) => entry))].sort((a, b) => a - b), [110, 111, 112])
  assert.equal(fade.sortBias, 100)
  assert.ok(fade.draws.every(({ alpha }) => alpha >= 0))
  assert.deepEqual(nativeSecondaryProviderLightSource(fadeActor), {
    castsDirectionalShadow: true,
    intensity: 1,
    position: fadeActor.position,
    radius: 2,
  })
})

test('Plane Orb owns the exact core, repeating ether-plane mesh, and perspective particle draw', () => {
  const source = {
    ...actor('plane-orb-shot'),
    enhanced: false,
    position: { x: 96, y: 192 },
    scale: 2,
  }
  const plan = nativeSecondaryPresentationPlan(source, 10)
  assert.deepEqual(plan.draws, [{
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 75,
    offset: { x: 0, y: 0 },
    role: 'plane-orb-shot-BadGuys-75',
    rotationRadians: 15 * Math.PI / 180,
    scaleX: -1.5,
    scaleY: 1.2,
    tint: 0xffffff,
  }])
  assert.equal(plan.meshes.length, 1)
  const mesh = plan.meshes[0]!
  assert.equal(mesh.texture, 'ether-plane')
  assert.equal(mesh.blend, 'normal')
  assert.equal(mesh.vertices.length, 30)
  assert.equal(mesh.uvs.length, 30)
  assert.equal(mesh.indices.length, 63)
  assert.deepEqual(mesh.uvs.slice(0, 2), [0.5, 1])
  const firstX = Math.fround(Math.sin(10 * Math.PI / 180) * 50)
  const firstY = Math.fround(-Math.cos(10 * Math.PI / 180) * 50 * 0.8)
  assert.deepEqual(mesh.vertices.slice(0, 4), [0, 0, firstX, firstY])
  assert.deepEqual(mesh.indices.slice(0, 9), [0, 1, 3, 1, 2, 3, 2, 3, 4])
  assert.deepEqual(mesh.indices.slice(-9), [0, 13, 1, 13, 14, 1, 14, 1, 2])

  const enhanced = nativeSecondaryPresentationPlan({ ...source, enhanced: true }, 10).meshes[0]!
  assert.equal(enhanced.vertices.length, 62)
  assert.equal(enhanced.uvs.length, 62)
  assert.equal(enhanced.indices.length, 135)

  const particle = nativeSecondaryPresentationPlan({
    ...actor('plane-orb-particle'),
    alpha: 0.6,
    quantity: 0.75,
    rotationRadians: 0.4,
    scale: 1.25,
    variant: 45,
  }).draws[0]!
  assert.deepEqual(particle, {
    alpha: 0.6,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 45,
    offset: { x: 0, y: 0 },
    role: 'plane-orb-particle-BadGuys-45',
    rotationRadians: 0.4,
    scaleX: 1.25,
    scaleY: 1,
    tint: 0xffbfff,
  })
})

test('Fire and Burn use the exact additive strip, mirror, scale-in, target flame, and Region light', () => {
  const fire = nativeSecondaryPresentationPlan({
    ...actor('moving-fire'),
    alpha: 0.75,
    frame: 61,
    quantity: -1,
    radius: 0.5,
    scale: 2,
    slowFactor: 0.8,
  })
  assert.equal(fire.queueFamily, 'ordinary-dynamic')
  assert.deepEqual(fire.draws, [{
    alpha: 0.75 * 0.8,
    atlas: 'DeadHawg',
    blend: 'add',
    entry: 61,
    offset: { x: 0, y: -20 },
    role: 'moving-fire-DeadHawg-61',
    rotationRadians: 0,
    scaleX: -1.100000023841858,
    scaleY: 1.100000023841858,
    tint: 0xffffff,
  }])

  const burn = {
    ...actor('fire-burn'),
    ageTicks: 1,
    alpha: 0.4,
    position: { x: 20, y: 30 },
    radius: 0.17,
  }
  assert.deepEqual(nativeSecondaryPresentationPlan(burn).draws, [])
  assert.deepEqual(nativeSecondaryMiscLightSource(burn), {
    castsDirectionalShadow: false,
    intensity: 0.4,
    position: { x: 20, y: 30 },
    radius: 0.17,
  })
  assert.equal(nativeSecondaryMiscLightSource({ ...burn, ageTicks: 0 }), null)

  const flame = nativeSecondaryPresentationPlan({
    ...actor('fire-burn-flame'),
    alpha: 0.125,
    frame: 337,
    scale: 1.2,
  }).draws[0]
  assert.deepEqual(flame, {
    alpha: 0.125,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 337,
    offset: { x: 0, y: 0 },
    role: 'fire-burn-flame-BadGuys-337',
    rotationRadians: 0,
    scaleX: 1.2,
    scaleY: 1.2,
    tint: 0xffffff,
  })
})

test('Ether Drain uses the exact parent painter, child classes, capture pulse, and Region light', () => {
  const source = {
    ...actor('ether-drain'),
    alpha: 0.8,
    id: 7,
    rotationRadians: 0.4,
    scale: 0.5,
    slowFactor: 1.9,
  }
  const plan = nativeSecondaryPresentationPlan(source, 12)
  assert.deepEqual(plan.draws.slice(0, 4).map((draw) => ({
    alpha: draw.alpha,
    blend: draw.blend,
    entry: draw.entry,
    offset: draw.offset,
    role: draw.role,
    rotationRadians: draw.rotationRadians,
    scaleX: draw.scaleX,
    scaleY: draw.scaleY,
    tint: draw.tint,
  })), [
    { alpha: 1, blend: 'add', entry: 75, offset: { x: 0, y: 0 }, role: 'ether-drain-galaxy-near', rotationRadians: 0.4 * 1.5, scaleX: -0.4, scaleY: 0.32, tint: 0xff80ff },
    { alpha: 0.4, blend: 'add', entry: 75, offset: { x: 0, y: -5 }, role: 'ether-drain-galaxy-middle-near', rotationRadians: 0.4 * 0.5, scaleX: -1.5, scaleY: 1.2, tint: 0xffffff },
    { alpha: 0.2, blend: 'add', entry: 75, offset: { x: 0, y: -10 }, role: 'ether-drain-galaxy-middle-far', rotationRadians: 0.4 * 0.25, scaleX: -2.5, scaleY: 2, tint: 0xffffff },
    { alpha: 0.08000000000000002, blend: 'add', entry: 75, offset: { x: 0, y: -20 }, role: 'ether-drain-galaxy-far', rotationRadians: 0.4 * 0.125, scaleX: -4.5, scaleY: 3.6, tint: 0xffffff },
  ])
  const shimmer = plan.draws[4]!
  assert.equal(shimmer.entry, 38)
  assert.equal(shimmer.blend, 'normal')
  assert.equal(shimmer.tint, 0xff4080)
  assert.ok(shimmer.scaleX >= 0.5 * 0.25 * 0.9800000190734863)
  assert.ok(shimmer.scaleX < 0.5 * 0.25 * 1.05)
  assert.equal(shimmer.scaleY, shimmer.scaleX)
  assert.equal(nativeSecondaryPresentationPlan(source, 12).draws[4]?.scaleX, shimmer.scaleX)
  assert.deepEqual(plan.draws[5], {
    alpha: 1.9,
    atlas: 'BadGuys',
    blend: 'normal',
    entry: 38,
    offset: { x: 0, y: 0 },
    role: 'ether-drain-capture-pulse',
    rotationRadians: 0,
    scaleX: 0.95,
    scaleY: 0.95,
    tint: 0xffffff,
  })

  const cloud = nativeSecondaryPresentationPlan({
    ...actor('ether-drain-cloud'),
    alpha: 0.2,
    phase: 90,
    rotationRadians: 0.7,
    scale: 2,
    variant: 1,
  }).draws[0]!
  assert.deepEqual({
    alpha: cloud.alpha,
    atlas: cloud.atlas,
    blend: cloud.blend,
    entry: cloud.entry,
    rotationRadians: cloud.rotationRadians,
    scaleX: cloud.scaleX,
  }, {
    alpha: 0.2,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 11,
    rotationRadians: 0.7,
    scaleX: 2,
  })
  const debris = nativeSecondaryPresentationPlan({
    ...actor('ether-drain-debris'),
    variant: 2,
  }).draws[0]!
  assert.equal(debris.atlas, 'DeadHawg')
  assert.equal(debris.entry, 179)
  assert.equal(debris.blend, 'normal')
  const flare = nativeSecondaryPresentationPlan({
    ...actor('ether-drain-capture-flare'),
    alpha: 1.5,
    scale: 1.5,
  }).draws[0]!
  assert.equal(flare.entry, 36)
  assert.equal(flare.blend, 'add')
  assert.equal(flare.alpha, 1.5)

  const light = nativeSecondaryProviderLightSource(source, 12)!
  assert.equal(light.radius, 2)
  assert.deepEqual(light.position, source.position)
  assert.ok(light.intensity >= 0.25 && light.intensity < 0.5)
  assert.deepEqual(nativeSecondaryProviderLightSource(source, 12), light)
  assert.notEqual(nativeSecondaryProviderLightSource(source, 13)?.intensity, light.intensity)
})

test('gameplay waves stay invisible while the independent Ring visual owns exact children', () => {
  assert.equal(nativeSecondaryPresentationPlan(actor('shockwave')).draws.length, 0)
  assert.equal(nativeSecondaryPresentationPlan(actor('freeze-wave')).draws.length, 0)
  const ring = nativeSecondaryPresentationPlan({
    ...actor('freeze-wave-visual'),
    enhanced: false,
  }).draws
  assert.deepEqual(ring.slice(0, 4).map(({ entry }) => entry), [114, 114, 114, 121])
  assert.equal(ring.length, 104)
  assert.ok(ring.slice(4).every(({ entry }) => entry === 72))
  const enhanced = nativeSecondaryPresentationPlan({
    ...actor('freeze-wave-visual'),
    enhanced: true,
  }).draws
  assert.equal(enhanced.length, 204)
  assert.ok(enhanced.slice(4).every(({ entry }) => entry === 72))
  const late = nativeSecondaryPresentationPlan({
    ...actor('freeze-wave-visual'),
    ageTicks: 100,
    enhanced: false,
  }).draws
  assert.equal(late.some(({ entry }) => entry === 114), false)
  assert.equal(late.filter(({ entry }) => entry === 121).length, 1)
  assert.ok(late.filter(({ entry }) => entry === 72).length > 0)
  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('freeze-wave-visual'),
    ageTicks: 175,
    enhanced: true,
  }).draws, [])
  assert.equal(nativeSecondaryPresentationPlan(actor('ice-blast')).draws.length, 0)
  assert.ok(nativeSecondaryPresentationPlan(actor('dampen-wave')).draws.length >= 360)
})

test('Dampen replays 360 source-over MoveFades and 30 centered additive fades', () => {
  const initial = createNativeRng(711)
  const born = nativeSecondaryPresentationPlan({
    ...actor('dampen-wave'),
    ageTicks: 0,
    presentationRng: initial,
  }).draws
  assert.equal(born.length, 390)

  const record = drawNativeInteger(initial, 2)
  const speed = drawNativeFloat(record.state, 4)
  const drag = drawNativeInteger(speed.state, 6)
  const rotation = drawNativeFloat(drag.state, 360)
  const scale = drawNativeFloat(rotation.state, 0.5)
  const loss = drawNativeFloat(scale.state, 0.02)
  const gray = drawNativeFloat(loss.state, 0.25)
  const channel = Math.round(gray.value * 255)
  assert.deepEqual(born[0], {
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'normal',
    entry: 10 + record.value,
    offset: { x: 0, y: 0 },
    role: 'dampen-move-fade-0',
    rotationRadians: rotation.value * Math.PI / 180,
    scaleX: Math.fround(1.5 + scale.value),
    scaleY: Math.fround(1.5 + scale.value),
    tint: channel << 16 | channel << 8 | channel,
  })

  const firstAdditiveRng = advanceNativeRngWords(initial, 360 * 8)
  const additiveRotation = drawNativeFloat(firstAdditiveRng, 360)
  const additiveScale = drawNativeFloat(additiveRotation.state, 4.75)
  const additiveLife = drawNativeFloat(additiveScale.state, 1)
  const spriteScale = Math.fround(0.75 + additiveScale.value)
  assert.deepEqual(born[360], {
    alpha: Math.min(Math.fround(0.5 + additiveLife.value), 1),
    atlas: 'BadGuys',
    blend: 'add',
    entry: 48,
    offset: { x: 0, y: 0 },
    role: 'dampen-additive-0',
    rotationRadians: additiveRotation.value * Math.PI / 180,
    scaleX: spriteScale,
    scaleY: Math.fround(spriteScale * 0.8),
    tint: 0xffffff,
  })

  const moved = nativeSecondaryPresentationPlan({
    ...actor('dampen-wave'),
    ageTicks: 1,
    presentationRng: initial,
  }).draws[0]!
  assert.equal(moved.offset.x, 0)
  assert.equal(moved.offset.y, Math.fround(-(6 + speed.value)))
  assert.equal(
    moved.alpha,
    Math.fround(1 - Math.fround(0.01 + loss.value)),
  )
  const undead = nativeSecondaryPresentationPlan(actor('turn-undead')).draws[0]!
  assert.equal(undead.tint, 0x808080)
  assert.equal(undead.scaleY, actor('turn-undead').scale * 0.8)
})

test('Explosive Shield replays the exact four-layer burst and one hundred FuzzySpears', () => {
  const initial = createNativeRng(811)
  const born = nativeSecondaryPresentationPlan({
    ...actor('shield-explosion'),
    ageTicks: 0,
    presentationRng: initial,
  }).draws
  assert.equal(born.length, 204)
  assert.deepEqual(born.slice(0, 4).map((draw) => ({
    atlas: draw.atlas,
    blend: draw.blend,
    entry: draw.entry,
    offset: draw.offset,
    role: draw.role,
    scaleX: draw.scaleX,
    scaleY: draw.scaleY,
  })), [
    {
      atlas: 'BadGuys', blend: 'normal', entry: 15, offset: { x: 0, y: -25 },
      role: 'explosive-shield-center-flash', scaleX: 12, scaleY: 12,
    },
    {
      atlas: 'DeadHawg', blend: 'normal', entry: 2, offset: { x: 0, y: -35 },
      role: 'explosive-shield-expanding-ring', scaleX: 2.5, scaleY: 2.5,
    },
    {
      atlas: 'BadGuys', blend: 'add', entry: 158, offset: { x: 0, y: -35 },
      role: 'explosive-shield-sprite-array-0', scaleX: 6, scaleY: 6,
    },
    {
      atlas: 'BadGuys', blend: 'add', entry: 158, offset: { x: 0, y: -35 },
      role: 'explosive-shield-sprite-array-1', scaleX: 6, scaleY: 6,
    },
  ])

  const arrayRotation0 = drawNativeFloat(initial, 360)
  const arrayRotation1 = drawNativeFloat(arrayRotation0.state, 360)
  const heading = drawNativeFloat(arrayRotation1.state, 360)
  const speed = drawNativeFloat(heading.state, 2)
  const doubleSpeed = drawNativeInteger(speed.state, 5)
  const alpha = drawNativeFloat(doubleSpeed.state, 1)
  const scale = drawNativeFloat(alpha.state, 1.5)
  const headingRadians = heading.value * Math.PI / 180
  const direction = {
    x: Math.fround(Math.sin(headingRadians)),
    y: Math.fround(-Math.cos(headingRadians)),
  }
  assert.equal(born[2]!.rotationRadians, arrayRotation0.value * Math.PI / 180)
  assert.equal(born[3]!.rotationRadians, arrayRotation1.value * Math.PI / 180)
  assert.deepEqual({
    alpha: born[4]!.alpha,
    atlas: born[4]!.atlas,
    blend: born[4]!.blend,
    entry: born[4]!.entry,
    offset: born[4]!.offset,
    role: born[4]!.role,
    rotationRadians: born[4]!.rotationRadians,
    scaleX: Math.abs(born[4]!.scaleX),
    scaleY: born[4]!.scaleY,
  }, {
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 17,
    offset: {
      x: Math.fround(direction.x * 75),
      y: Math.fround(direction.y * 75),
    },
    role: 'explosive-shield-fuzzy-spear-base-0',
    rotationRadians: headingRadians,
    scaleX: 1,
    scaleY: 1,
  })
  assert.deepEqual({
    entry: born[5]!.entry,
    offset: born[5]!.offset,
    role: born[5]!.role,
    scaleX: born[5]!.scaleX,
    scaleY: born[5]!.scaleY,
  }, {
    entry: 74,
    offset: born[4]!.offset,
    role: 'explosive-shield-fuzzy-spear-glow-0',
    scaleX: Math.fround(2 + scale.value),
    scaleY: Math.fround(2 + scale.value),
  })

  const speedFactor = doubleSpeed.value === 2 ? 2 : 1
  const velocity = {
    x: Math.fround(direction.x * Math.fround(3 + speed.value) * speedFactor),
    y: Math.fround(direction.y * Math.fround(3 + speed.value) * speedFactor),
  }
  const stepped = nativeSecondaryPresentationPlan({
    ...actor('shield-explosion'),
    ageTicks: 1,
    presentationRng: initial,
  }).draws
  const steppedBase = stepped.find(({ role }) => role === 'explosive-shield-fuzzy-spear-base-0')!
  assert.deepEqual(steppedBase.offset, {
    x: Math.fround(Math.fround(direction.x * 75) + velocity.x),
    y: Math.fround(Math.fround(direction.y * 75) + velocity.y),
  })
  assert.equal(
    stepped.find(({ role }) => role === 'explosive-shield-expanding-ring')!.scaleX,
    Math.fround(Math.fround(2.5) * Math.fround(1.01)),
  )
  assert.equal(born.some(({ entry }) => entry === 68), false)
  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('shield-explosion'),
    ageTicks: 67,
    presentationRng: initial,
  }).draws, [])
})

test('Magic Trap draws the armed stock body, selector shimmer, and full terminal FuzzySpear program', () => {
  const ageTicks = 10
  const ageRadians = ageTicks * Math.PI / 180
  const sine = Math.sin(ageRadians)
  const chargeMultiplier = Math.fround(0.75)
  const chargeScale = Math.fround(
    Math.fround(0.5 + Math.fround(0.5 * 0.5)) * chargeMultiplier,
  )
  const armed = nativeSecondaryPresentationPlan({
    ...actor('magic-trap'),
    ageTicks,
    scale: 0.5,
    variant: 2,
  }).draws
  assert.deepEqual(armed.map(({ atlas, blend, entry, role, tint }) => ({
    atlas, blend, entry, role, tint,
  })), [
    { atlas: 'BadGuys', blend: 'normal', entry: 15, role: 'magic-trap-shadow', tint: 0x000000 },
    { atlas: 'BadGuys', blend: 'add', entry: 111, role: 'magic-trap-clockwise-halo', tint: 0xffffff },
    { atlas: 'BadGuys', blend: 'add', entry: 112, role: 'magic-trap-counterclockwise-halo', tint: 0xffffff },
    { atlas: 'BadGuys', blend: 'add', entry: 15, role: 'magic-trap-selector-glow', tint: 0x1affff },
    { atlas: 'BadGuys', blend: 'normal', entry: 85, role: 'magic-trap-body', tint: 0xffffff },
  ])
  assert.equal(armed.some(({ entry }) => entry >= 393 && entry <= 400), false)
  assert.deepEqual(armed.slice(1, 3).map(({ alpha, offset, scaleX, scaleY }) => ({
    alpha, offset, scaleX, scaleY,
  })), [0, 1].map(() => ({
    alpha: Math.fround(
      Math.fround(0.5 - Math.fround(0.125 * sine)) * chargeMultiplier,
    ),
    offset: { x: 0, y: Math.fround(5 * sine - 12) },
    scaleX: chargeScale,
    scaleY: Math.fround(chargeScale * Math.fround(0.8)),
  })))
  assert.equal(armed[1]!.rotationRadians, ageTicks * 2 * Math.PI / 180)
  assert.equal(armed[2]!.rotationRadians, ageTicks * -3 * Math.PI / 180)
  assert.deepEqual({
    scaleX: armed[4]!.scaleX,
    scaleY: armed[4]!.scaleY,
  }, {
    scaleX: Math.fround(1 - Math.fround(0.1 * Math.sin(ageRadians * 2))),
    scaleY: Math.fround(1 + Math.fround(0.1 * Math.cos(ageRadians))),
  })

  const belowFull = nativeSecondaryPresentationPlan({
    ...actor('magic-trap'),
    ageTicks: 0,
    scale: 0.99,
  }).draws[1]!
  const nativeFull = nativeSecondaryPresentationPlan({
    ...actor('magic-trap'),
    ageTicks: 0,
    scale: Math.fround(0.9900000095367432),
  }).draws[1]!
  assert.equal(belowFull.scaleX, Math.fround(Math.fround(0.995) * Math.fround(0.75)))
  assert.equal(nativeFull.scaleX, Math.fround(
    0.5 + Math.fround(0.5 * Math.fround(0.9900000095367432)),
  ))

  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('magic-trap-shimmer'),
    alpha: 0.875,
    rotationRadians: 0.75,
    scale: 5,
    variant: 1,
  }).draws, [{
    alpha: 0.875,
    atlas: 'BadGuys',
    blend: 'normal',
    entry: 16,
    offset: { x: 0, y: 0 },
    role: 'magic-trap-shimmer',
    rotationRadians: 0.75,
    scaleX: 5,
    scaleY: Math.fround(5 * Math.fround(0.8)),
    tint: 0xff591a,
  }])

  const initial = createNativeRng(811)
  const burst = nativeSecondaryPresentationPlan({
    ...actor('magic-trap-burst'),
    ageTicks: 0,
    presentationRng: initial,
  }).draws
  assert.equal(burst.length, 203)
  assert.deepEqual(burst.slice(0, 4).map(({ atlas, blend, entry, role, scaleX, scaleY }) => ({
    atlas, blend, entry, role, scaleX: Math.abs(scaleX), scaleY,
  })), [
    {
      atlas: 'BadGuys', blend: 'normal', entry: 15,
      role: 'magic-trap-center-flash', scaleX: 6, scaleY: 6,
    },
    {
      atlas: 'BadGuys', blend: 'add', entry: 158,
      role: 'magic-trap-sprite-array-0', scaleX: 6, scaleY: 6,
    },
    {
      atlas: 'BadGuys', blend: 'add', entry: 158,
      role: 'magic-trap-sprite-array-1', scaleX: 6, scaleY: 6,
    },
    {
      atlas: 'BadGuys', blend: 'add', entry: 17,
      role: 'magic-trap-fuzzy-spear-base-0', scaleX: 1, scaleY: 1,
    },
  ])
  assert.equal(burst.some(({ atlas }) => atlas === 'DeadHawg'), false)
  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('magic-trap-burst'),
    ageTicks: 67,
    presentationRng: initial,
  }).draws, [])
  assert.deepEqual(nativeSecondaryWorldShake([{
    ...actor('magic-trap-burst'),
    ageTicks: 1,
  }], 'boneyard:test'), {
    magnitude: Math.fround(Math.fround(1.25) * Math.fround(0.94)),
    x: 0,
    y: 0,
  })
})

test('Magic Trap ElectricBurn is light-only and owns no FadeLightning sprite at chain count zero', () => {
  const born = {
    ...actor('electric-burn'),
    ageTicks: 0,
    alpha: 0,
    position: { x: 125, y: -20 },
    radius: 0.5,
    skillId: 50 as const,
    targetId: 33,
    variant: 2,
  }
  assert.deepEqual(nativeSecondaryPresentationPlan(born).draws, [])
  assert.equal(nativeSecondaryMiscLightSource(born), null)

  const live = { ...born, ageTicks: 1, alpha: 1, radius: Math.fround(0.63) }
  assert.deepEqual(nativeSecondaryPresentationPlan(live).draws, [])
  assert.deepEqual(nativeSecondaryMiscLightSource(live), {
    castsDirectionalShadow: false,
    intensity: 1,
    position: { x: 125, y: -20 },
    radius: Math.fround(0.63),
  })
})

test('Prismatic replays the exact record-58 parent and three-child emission program', () => {
  const initial = createNativeRng(733)
  const sign = drawNativeSign(initial, 1)
  const palette = drawNativeInteger(sign.state, 5)
  const firstTick = nativeSecondaryPresentationPlan({
    ...actor('prismatic-wave'),
    ageTicks: 1,
    alpha: Math.fround(0.025),
    phase: 186 * sign.value,
    presentationRng: palette.state,
    scale: Math.fround(2 + Math.fround(0.065)),
    slowFactor: sign.value,
  }).draws
  assert.equal(firstTick.length, 4)
  assert.deepEqual(firstTick.slice(0, 3).map(({ entry }) => entry), [58, 111, 111])
  assert.ok(firstTick[3]!.entry === 10 || firstTick[3]!.entry === 11)
  assert.equal(firstTick[0]!.role, 'prismatic-spray-core')
  assert.equal(firstTick[0]!.blend, 'add')
  assert.equal(firstTick[0]!.scaleX, sign.value * Math.fround(2 + Math.fround(0.065)) * 1.5)
  assert.equal(firstTick[0]!.scaleY, Math.fround(2 + Math.fround(0.065)) * 1.2)
  assert.ok(firstTick.slice(1).every(({ tint }) => [
    0xff8080, 0xffbf80, 0xffff80, 0x80ff80, 0x80ffff,
  ].includes(tint)))

  const tail = nativeSecondaryPresentationPlan({
    ...actor('prismatic-wave'),
    ageTicks: 100,
    alpha: 1,
    phase: 600 * sign.value,
    presentationRng: palette.state,
    scale: 1.5,
    slowFactor: sign.value,
  }).draws
  assert.equal(tail.some(({ entry }) => entry === 58), false)
  assert.equal(tail.some(({ entry }) => entry === 110 || entry === 112), false)
  assert.ok(tail.some(({ entry }) => entry === 111))
  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('prismatic-wave'),
    ageTicks: 167,
    alpha: 0,
    presentationRng: palette.state,
    slowFactor: sign.value,
  }).draws, [])
})

test('Magic Circle owns centered parity-count ring particles, attached record 7, and Region light', () => {
  const circle = {
    ...actor('magic-circle'),
    ageTicks: 0,
    alpha: 0.75,
    phase: 1,
    presentationRng: createNativeRng(91),
    scale: 4,
  }
  const initial = nativeSecondaryPresentationPlan(circle).draws
  assert.equal(initial.length, 2)
  assert.ok(initial.every(({ blend, entry, offset, scaleX, scaleY }) => (
    blend === 'add'
      && entry === 48
      && offset.x === 0
      && offset.y === 0
      && scaleX >= 3.9
      && scaleX <= 4
      && scaleY >= 3.12
      && scaleY <= 3.21
  )))
  assert.equal(initial.some(({ entry }) => entry === 7), false)

  const playerFlash = nativeSecondaryPresentationPlan({
    ...actor('magic-circle-player-flash'),
    alpha: 0.6,
    rotationRadians: 1.25,
    scale: 1.4,
  }).draws
  assert.deepEqual(playerFlash.map(({ alpha, blend, entry, role, tint }) => ({
    alpha, blend, entry, role, tint,
  })), [{
    alpha: 0.6,
    blend: 'add',
    entry: 7,
    role: 'magic-circle-player-recovery-pulse',
    tint: 0x80ffff,
  }])
  assert.deepEqual(nativeSecondaryMiscLightSource(circle), {
    castsDirectionalShadow: true,
    intensity: 0.75,
    position: { x: 100, y: 200 },
    radius: 2,
  })
  assert.equal(nativeSecondaryMiscLightSource({ ...circle, ageTicks: 1_500 }), null)
})

test('Storm and Acid falling drops use the exact native gradient streaks', () => {
  const drop = {
    ...actor('storm-drop'),
    phase: -155,
    quantity: 4,
    scale: Math.fround(0.1),
  }
  assert.deepEqual(nativeSecondaryPresentationPlan(drop).gradients, [{
    end: { x: 0, y: -159 },
    endAlpha: 0,
    endColor: 0x66f2ff,
    role: 'storm-raindrop-streak',
    start: { x: 0, y: -155 },
    startAlpha: 0.5,
    startColor: 0xccf2ff,
    width: 2,
  }])
  const acid = nativeSecondaryPresentationPlan({ ...drop, kind: 'acid-drop', skillId: 72 })
  assert.deepEqual(acid.gradients, [{
    end: { x: 0, y: -159 },
    endAlpha: 0,
    endColor: 0x66f2ff,
    role: 'acid-raindrop-streak',
    start: { x: 0, y: -155 },
    startAlpha: 1,
    startColor: 0xb3f2bf,
    width: 3,
  }])
  assert.deepEqual({
    alpha: acid.draws[0]!.alpha,
    entry: acid.draws[0]!.entry,
    offset: acid.draws[0]!.offset,
    tint: acid.draws[0]!.tint,
  }, {
    alpha: 0.25,
    entry: 0,
    offset: { x: 0, y: -155 },
    tint: 0xb3f2bf,
  })
})

test('Acid Rain preserves both parent passes and gates the source-over residue pass', () => {
  const source = {
    ...actor('acid-rain'),
    ageTicks: 80,
    alpha: 0.625,
    phase: 0.8,
    rotationRadians: 0.4,
    scale: 0.5,
  }
  const plan = nativeSecondaryPresentationPlan(source, 80)
  assert.deepEqual(plan.draws.map((draw) => ({
    alpha: draw.alpha,
    blend: draw.blend,
    entry: draw.entry,
    offset: draw.offset,
    role: draw.role,
    rotationRadians: draw.rotationRadians,
    scaleX: draw.scaleX,
    scaleY: draw.scaleY,
    tint: draw.tint,
  })), [
    {
      alpha: 0.6000000238418579,
      blend: 'add',
      entry: 10,
      offset: { x: 0, y: 0 },
      role: 'acid-rain-ground',
      rotationRadians: Math.PI / 180,
      scaleX: 2.5,
      scaleY: 2,
      tint: 0x698c52,
    },
    {
      alpha: 0.800000011920929,
      blend: 'normal',
      entry: 10,
      offset: { x: 0, y: -25 },
      role: 'acid-rain-cloud',
      rotationRadians: -40 * Math.PI / 180,
      scaleX: 1.5,
      scaleY: 3,
      tint: 0x407326,
    },
    {
      alpha: 0.625,
      blend: 'normal',
      entry: 10,
      offset: { x: 0, y: 0 },
      role: 'acid-rain-residue',
      rotationRadians: 0,
      scaleX: 4.5,
      scaleY: 4.5,
      tint: 0x0d1a0d,
    },
  ])
  assert.equal(nativeSecondaryPresentationPlan({ ...source, alpha: 0 }, 80).draws.length, 2)
})

test('Enhanced moving Storm replays fifteen controls into thirty spline arcs and its cloud core', () => {
  const plan = nativeSecondaryPresentationPlan({
    ...actor('storm-cloud'),
    ageTicks: 40,
    enhanced: true,
    scale: 0.75,
    variant: 1,
  }, 80)
  assert.equal(plan.draws.length, 32)
  assert.ok(plan.draws.slice(0, 30).every(({ entry }) => entry === 84))
  assert.deepEqual(plan.draws.slice(0, 4).map(({ role }) => role), [
    'storm-cloud-arc-0-a',
    'storm-cloud-arc-0-b',
    'storm-cloud-arc-1-a',
    'storm-cloud-arc-1-b',
  ])
  assert.deepEqual(
    plan.draws.slice(0, 2).map(({ scaleX, scaleY, tint }) => ({ scaleX, scaleY, tint })),
    [
      { scaleX: 0.2, scaleY: 0.16000000000000003, tint: 0xccffff },
      { scaleX: 0.2, scaleY: 0.16000000000000003, tint: 0xccffff },
    ],
  )
  const core = plan.draws[30]!
  assert.deepEqual({
    alpha: core.alpha,
    entry: core.entry,
    offset: core.offset,
    role: core.role,
    scaleX: core.scaleX,
    scaleY: core.scaleY,
  }, {
    alpha: 0.5,
    entry: 78,
    offset: { x: 0, y: -37.5 },
    role: 'storm-cloud-core',
    scaleX: 2.8125,
    scaleY: 2.8125,
  })
  const auxiliary = plan.draws[31]!
  assert.deepEqual({
    alpha: auxiliary.alpha,
    blend: auxiliary.blend,
    entry: auxiliary.entry,
    offset: auxiliary.offset,
    role: auxiliary.role,
    scaleX: auxiliary.scaleX,
    scaleY: auxiliary.scaleY,
    tint: auxiliary.tint,
  }, {
    alpha: 0.5,
    blend: 'add',
    entry: 78,
    offset: { x: 0, y: -212.5 },
    role: 'storm-weather-moving-composite',
    scaleX: 2.8125,
    scaleY: 2.8125,
    tint: 0xccffff,
  })
})

test('stationary Storm owns the exact three-pass render-target composite and white flash mask', () => {
  const source = {
    ...actor('storm-cloud'),
    ageTicks: 40,
    alpha: 0.8,
    enhanced: false,
    frame: 0.9,
    scale: 0.75,
    variant: 0,
  }
  const phase = drawNativeFloat(source.presentationRng!, 1, true).value
  const plan = nativeSecondaryPresentationPlan(source)
  assert.equal(plan.stormComposite?.scale, 5)
  assert.deepEqual(plan.stormComposite?.offset, { x: 0, y: -175 })
  assert.deepEqual(plan.stormComposite?.draws.map(({ role }) => role), [
    'storm-weather-static-inner',
    'storm-weather-static-middle',
    'storm-weather-static-outer',
  ])
  const [inner, middle, outer] = plan.stormComposite!.draws
  assert.deepEqual({
    alpha: inner!.alpha,
    rotationRadians: inner!.rotationRadians,
    scaleX: inner!.scaleX,
    scaleY: inner!.scaleY,
  }, {
    alpha: 1.6,
    rotationRadians: 40 * 0.03125 * phase * Math.PI / 180,
    scaleX: 0.75,
    scaleY: 0.6000000000000001,
  })
  assert.deepEqual({ offset: middle!.offset, scaleX: middle!.scaleX, scaleY: middle!.scaleY }, {
    offset: { x: 0, y: -7.5 },
    scaleX: 0.5625,
    scaleY: 0.45000000000000007,
  })
  assert.deepEqual(outer!.offset, { x: 0, y: -4.5 })

  const flash = plan.draws.at(-1)!
  assert.deepEqual({
    alpha: flash.alpha,
    colorMode: flash.colorMode,
    offset: flash.offset,
    role: flash.role,
    rotationRadians: flash.rotationRadians,
    scaleX: flash.scaleX,
    scaleY: flash.scaleY,
  }, {
    alpha: 0.6000000000000001,
    colorMode: 'alpha-mask',
    offset: { x: 0, y: -175 },
    role: 'storm-weather-strike-flash',
    rotationRadians: 40 * 0.0625 * phase * Math.PI / 180,
    scaleX: 3,
    scaleY: 2.4000000000000004,
  })
})

test('Region point gain follows the native quarter-width through 1.1-width ramp', () => {
  const camera = { x: 0, y: 0 }
  assert.equal(nativeRegionPointGain({ x: 250, y: 0 }, camera, 1_000, false), 1)
  assert.equal(nativeRegionPointGain({ x: 1_100, y: 0 }, camera, 1_000, false), 0)
  assert.equal(nativeRegionPointGain({ x: 675, y: 0 }, camera, 1_000, false), 0.5)
  assert.equal(
    nativeRegionPointGain({ x: 675, y: 0 }, camera, 1_000, true),
    Math.fround(0.05),
  )
})

test('Region screen feedback is one overwrite lane with exact float32 decay', () => {
  const context = {
    cameraCenter: { x: 0, y: 0 },
    localPlayerAlternate: false,
    visibleWorldWidth: 1_000,
  }
  const earth = screenEvent(1, 10, {
    alpha: 1,
    blue: 0.8,
    decayPerTick: 0.025,
    green: 1,
    pointAttenuated: false,
    red: 0.8,
  })
  const lane = new NativeSecondaryScreenFeedbackPresentation(10, earth.worldKey)
  lane.consume(earth, context)
  assert.deepEqual(lane.sample(10), { alpha: 1, color: 0xccffcc })

  lane.consume({
    ...earth,
    screenFlash: { ...earth.screenFlash!, red: 1 },
  }, context)
  assert.deepEqual(lane.sample(10), { alpha: 1, color: 0xccffcc })

  lane.consume(screenEvent(2, 10, {
    alpha: 1,
    blue: 1,
    decayPerTick: 0.025,
    green: 1,
    pointAttenuated: false,
    red: 1,
  }), context)
  lane.consume(screenEvent(3, 10, {
    alpha: 1,
    blue: 1,
    decayPerTick: 0.025,
    green: 1,
    pointAttenuated: true,
    red: 1,
  }, { x: 675, y: 0 }), context)
  assert.deepEqual(lane.sample(10), { alpha: 0.5, color: 0xffffff })

  const comet = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:test')
  comet.consume(screenEvent(1, 0, {
    alpha: 1,
    blue: 1,
    decayPerTick: Math.fround(0.005),
    green: 1,
    pointAttenuated: false,
    red: 1,
  }), context)
  assert.equal(comet.sample(200)?.alpha, 8.121132850646973e-7)
  assert.equal(comet.sample(201), null)

  const late = new NativeSecondaryScreenFeedbackPresentation(100, 'boneyard:test')
  late.consume(screenEvent(1, 95, {
    alpha: 1,
    blue: 1,
    decayPerTick: Math.fround(0.05),
    green: 1,
    pointAttenuated: false,
    red: 1,
  }), context)
  let expectedLateAlpha = Math.fround(1)
  for (let tick = 0; tick < 5; tick += 1) {
    expectedLateAlpha = Math.max(0, Math.fround(expectedLateAlpha - Math.fround(0.05)))
  }
  assert.equal(late.sample(100)?.alpha, expectedLateAlpha)
})

test('Shockwave and FreezeWave share the expanding Region-light callback', () => {
  const wave = { ...actor('shockwave'), alpha: 0.81, radius: 280 }
  assert.deepEqual(nativeSecondaryProviderLightSource(wave), {
    castsDirectionalShadow: false,
    intensity: 0.81,
    position: { x: 100, y: 200 },
    radius: 2,
  })
  assert.deepEqual(nativeSecondaryProviderLightSource({
    ...actor('freeze-wave'),
    alpha: 0.5,
    radius: 140,
  }), {
    castsDirectionalShadow: false,
    intensity: 0.5,
    position: { x: 100, y: 200 },
    radius: 1,
  })
  for (const kind of ['storm-cloud', 'acid-rain'] as const) {
    assert.deepEqual(nativeSecondaryProviderLightSource({
      ...actor(kind),
      alpha: 0.8,
    }), {
      castsDirectionalShadow: false,
      intensity: 0.4,
      position: { x: 100, y: 200 },
      radius: 2,
    })
  }
  assert.deepEqual(nativeSecondaryProviderLightSource({
    ...actor('comet'),
    alpha: 0.1,
  }), {
    castsDirectionalShadow: true,
    intensity: 0.5,
    position: { x: 100, y: 200 },
    radius: 2,
  })
})

test('Comet impact and Bouncer debris use the exact long fades and record bank', () => {
  const birth = nativeSecondaryPresentationPlan({
    ...actor('comet-impact'),
    ageTicks: 0,
  }).draws
  assert.deepEqual(birth.map(({ alpha, atlas, blend, entry, role, scaleX, scaleY, tint }) => ({
    alpha, atlas, blend, entry, role, scaleX, scaleY, tint,
  })), [
    {
      alpha: 1,
      atlas: 'BadGuys',
      blend: 'add',
      entry: 15,
      role: 'comet-impact-additive',
      scaleX: 10,
      scaleY: 10,
      tint: 0xbfbfbf,
    },
    {
      alpha: 1,
      atlas: 'DeadHawg',
      blend: 'normal',
      entry: 6,
      role: 'comet-impact-ring',
      scaleX: 2,
      scaleY: 2,
      tint: 0xffffff,
    },
  ])
  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('comet-impact'),
    ageTicks: 500,
  }).draws.map(({ entry }) => entry), [6])
  assert.deepEqual(nativeSecondaryPresentationPlan({
    ...actor('comet-impact'),
    ageTicks: 1_000,
  }).draws, [])

  const debris = nativeSecondaryPresentationPlan({
    ...actor('comet-debris'),
    alpha: 2,
    phase: -10,
    rotationRadians: 0.75,
    scale: 0.8,
    variant: 4,
  }).draws[0]!
  assert.deepEqual({
    alpha: debris.alpha,
    atlas: debris.atlas,
    entry: debris.entry,
    offset: debris.offset,
    rotationRadians: debris.rotationRadians,
    scaleX: debris.scaleX,
    scaleY: debris.scaleY,
  }, {
    alpha: 1,
    atlas: 'DeadHawg',
    entry: 207,
    offset: { x: 0, y: -10 },
    rotationRadians: 0.75,
    scaleX: 0.8,
    scaleY: 0.8,
  })
})

test('Teleport source and destination draw stock record 90 with clamped additive alpha', () => {
  const source = nativeSecondaryPresentationPlan({
    ...actor('teleport-burst'),
    alpha: 2,
    rotationRadians: 0.25,
    scale: 1,
    variant: 0,
  }).draws[0]!
  const destination = nativeSecondaryPresentationPlan({
    ...actor('teleport-burst'),
    alpha: 1.9,
    rotationRadians: 0.75,
    scale: 8,
    variant: 1,
  }).draws[0]!

  assert.deepEqual([source, destination].map((entry) => ({
    alpha: entry.alpha,
    atlas: entry.atlas,
    blend: entry.blend,
    entry: entry.entry,
    rotationRadians: entry.rotationRadians,
    scaleX: entry.scaleX,
    scaleY: entry.scaleY,
  })), [
    {
      alpha: 1,
      atlas: 'BadGuys',
      blend: 'add',
      entry: 90,
      rotationRadians: 0.25,
      scaleX: 1,
      scaleY: 1,
    },
    {
      alpha: 1,
      atlas: 'BadGuys',
      blend: 'add',
      entry: 90,
      rotationRadians: 0.75,
      scaleX: 8,
      scaleY: 8,
    },
  ])
})

test('the player shield shell uses the native pulse brightness and sine scale', () => {
  const state = {
    castSequence: 0,
    castSpinTicksRemaining: 0,
    cooldownMaximumTicksBySkill: [],
    cooldownTicksBySkill: [],
    firewalker: false,
    fizzleSequence: 0,
    heldSlot: null,
    lastSkillId: null,
    magicShieldAbsorb: 25,
    magicShieldExplosionDamage: 0,
    magicShieldMaximum: 25,
    magicShieldPulseTicks: 40,
    mindstar: false,
    planeOrbHeld: false,
    planewalkerTicksRemaining: 0,
    regenerate: false,
    reservedMana: 0,
    stoneskinTicksRemaining: 0,
  } as const
  assert.deepEqual(nativePlayerMagicShieldPlan(state, 0), {
    scale: 1.5,
    tint: 0xbfffff,
    visible: true,
  })
  assert.equal(nativePlayerMagicShieldPlan({ ...state, magicShieldAbsorb: 0 }, 0).visible, false)
  assert.equal(nativePlayerMaterialTint(0xffffff, { ...state, stoneskinTicksRemaining: 1 }), 0x808080)
  assert.equal(nativePlayerMaterialTint(0x804020, { ...state, stoneskinTicksRemaining: 1 }), 0x402010)
  assert.equal(nativePlayerMaterialTint(0x804020, state), 0x804020)
})

test('Golem facing follows x87 tie-to-even rounding and sixteen-frame wrap', () => {
  assert.equal(nativeGolemFacing(0), 0)
  assert.equal(nativeGolemFacing(12.5), 0)
  assert.equal(nativeGolemFacing(13), 1)
  assert.equal(nativeGolemFacing(350), 0)
  assert.equal(nativeGolemFacing(-10), 0)
  assert.equal(nativeGolemFacing(180), 8)
})

test('Golem assembly uses the exact pulse, elevation, chassis, and Iron overlays', () => {
  const base = actor('golem')
  const plan = nativeGolemPresentationPlan({
    ...base,
    ageTicks: 0,
    golem: { ...base.golem!, iron: true },
    variant: 1,
  })
  assert.deepEqual({ ...plan.quads[0], alpha: 0 }, {
    alpha: 0,
    atlas: 'BadGuys',
    blend: 'normal',
    entry: 36,
    role: 'golem-assembly-beam',
    tint: 0x80ff80,
    vertices: [-35, -200, 35, -200, -40, 25, 40, 25],
  })
  assert.ok(Math.abs(plan.quads[0]!.alpha) < 1e-12)
  assert.deepEqual(plan.draws.map(({ entry }) => entry), [113, 129, 145, 177, 161, 193])
  assert.equal(plan.draws[0]!.scaleX, 1.1109999418258667)
  assert.equal(plan.draws[0]!.tint, 0x595959)
  assert.equal(plan.draws[3]!.tint, 0xffffff)

  const midpoint = nativeGolemPresentationPlan({ ...base, ageTicks: 100 })
  assert.equal(midpoint.quads[0]!.alpha, 0.5)
  assert.equal(midpoint.draws.filter(({ role }) => role.startsWith('golem-core-')).length, 2)
})

test('active Golem draws stock connectors and depth-sorted articulated records', () => {
  const plan = nativeGolemPresentationPlan(actor('golem'))
  assert.equal(plan.quads.length, 0)
  assert.deepEqual(plan.draws.slice(0, 6).map(({ entry }) => entry), [97, 97, 15, 15, 65, 65])
  assert.deepEqual(plan.draws.slice(0, 6).map(({ role }) => role), [
    'golem-connector-endpoint-right',
    'golem-connector-endpoint-left',
    'golem-connector-glow-left',
    'golem-connector-glow-right',
    'golem-connector-cap-right',
    'golem-connector-cap-left',
  ])
  const body = plan.draws.slice(6)
  assert.ok(body.some(({ entry }) => entry === 1))
  assert.ok(body.some(({ entry }) => entry === 33))
  assert.equal(body.filter(({ entry }) => entry === 65 || entry === 73).length, 5)
})

test('Golem attack and provoke phases select the native limb banks and rotations', () => {
  const base = actor('golem')
  const attack = nativeGolemPresentationPlan({
    ...base,
    golem: {
      ...base.golem!,
      actionDurationTicks: 80,
      actionTick: 10,
      phase: 'attack',
      poseVariant: 0,
    },
  })
  const attackingLeft = attack.draws.find(({ role }) => role === 'golem-limb-left')!
  assert.equal(attackingLeft.entry, 16)
  assert.equal(attackingLeft.rotationRadians, Math.PI / 4)

  const recovery = nativeGolemPresentationPlan({
    ...base,
    golem: {
      ...base.golem!,
      actionDurationTicks: 80,
      actionTick: 38,
      phase: 'attack',
      poseVariant: 0,
    },
  })
  assert.equal(recovery.draws.find(({ role }) => role === 'golem-limb-left')!.entry, 19)
  assert.equal(recovery.draws.find(({ role }) => role === 'golem-limb-right')!.rotationRadians, -Math.PI / 4)

  const provoke = nativeGolemPresentationPlan({
    ...base,
    golem: { ...base.golem!, actionTick: 101, phase: 'provoke' },
  })
  assert.equal(provoke.draws.find(({ role }) => role === 'golem-limb-left')!.entry, 17)
  assert.equal(provoke.draws.find(({ role }) => role === 'golem-limb-right')!.entry, 49)
})

test('Golem death replays thirty rock records plus the short additive star', () => {
  const birth = nativeSecondaryPresentationPlan({
    ...actor('golem-death'),
    ageTicks: 0,
    variant: 1,
  })
  assert.equal(birth.draws.length, 31)
  assert.deepEqual(birth.draws.slice(0, 12).map(({ entry }) => entry), [
    78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 78, 79,
  ])
  assert.equal(birth.draws[0]!.tint, 0x595959)
  assert.equal(birth.draws.at(-1)!.entry, 86)
  assert.equal(birth.draws.at(-1)!.blend, 'add')
  assert.equal(nativeSecondaryPresentationPlan({
    ...actor('golem-death'),
    ageTicks: 15,
  }).draws.length, 30)
})

test('Earthquake uses the exact floor-copy thresholds and Region largest-vector reducer', () => {
  const quake = {
    ...actor('earthquake'),
    alpha: 0.5,
    phase: 3.01,
    quantity: 0.4,
    rotationRadians: 0.25,
    velocity: { x: -2, y: 8 },
  }
  const draws = nativeSecondaryPresentationPlan(quake).draws
  assert.deepEqual(draws.slice(0, 3).map(({ entry, alpha, scaleX, scaleY }) => ({
    alpha, entry, scaleX, scaleY,
  })), [
    { alpha: 0.375, entry: 200, scaleX: 1.5, scaleY: 1.2 },
    { alpha: 0.375, entry: 201, scaleX: 1.5, scaleY: 1.2 },
    { alpha: 0.375, entry: 202, scaleX: 1.5, scaleY: 1.2 },
  ])
  assert.deepEqual(draws.slice(3).map(({ tint, alpha }) => ({ alpha, tint })), [
    { alpha: 0.15000000000000002, tint: 0x00ff00 },
    { alpha: 0.15000000000000002, tint: 0x00ff00 },
    { alpha: 0.15000000000000002, tint: 0x00ff00 },
  ])
  assert.deepEqual(nativeSecondaryWorldShake([
    { ...quake, id: 2, velocity: { x: 3, y: 0 } },
    quake,
    { ...actor('shield-explosion'), ageTicks: 1, id: 4 },
    { ...quake, id: 3, worldKey: 'hub:courtyard', velocity: { x: 99, y: 99 } },
  ], 'boneyard:test'), {
    magnitude: Math.fround(Math.fround(1.25) * Math.fround(0.94)),
    x: -2,
    y: 8,
  })
})

test('Earthquake children own record 62, brown FadeSin dust, and the enhanced lit boulder underlay', () => {
  assert.deepEqual(
    nativeSecondaryPresentationPlan(actor('earthquake-scenery-wobble')).draws,
    [],
  )

  const quake = nativeSecondaryPresentationPlan({
    ...actor('earthquake-quake'),
    alpha: 0.8,
    phase: 90,
    rotationRadians: 0.25,
    scale: 3,
    slowFactor: 2.4,
  })
  assert.deepEqual(quake.draws.map((draw) => ({
    alpha: draw.alpha,
    atlas: draw.atlas,
    entry: draw.entry,
    rotationRadians: draw.rotationRadians,
    scaleX: draw.scaleX,
    scaleY: draw.scaleY,
  })), [{
    alpha: 0.8,
    atlas: 'BadGuys',
    entry: 62,
    rotationRadians: 0.25,
    scaleX: 3,
    scaleY: 2.4,
  }])

  const dust = nativeSecondaryPresentationPlan({
    ...actor('earthquake-dust'),
    alpha: 0.4,
    rotationRadians: 0.75,
    scale: 2.5,
  })
  assert.equal(dust.queueFamily, 'zanim')
  assert.deepEqual(dust.draws.map((draw) => ({
    alpha: draw.alpha,
    entry: draw.entry,
    rotationRadians: draw.rotationRadians,
    scaleX: draw.scaleX,
    tint: draw.tint,
  })), [{
    alpha: 0.4,
    entry: 10,
    rotationRadians: 0.75,
    scaleX: 2.5,
    tint: 0x1e1100,
  }])

  const debris = nativeSecondaryPresentationPlan({
    ...actor('earthquake-debris'),
    alpha: 10,
    enhanced: true,
    phase: -12,
    rotationRadians: 0.5,
    scale: 0.6,
    variant: 2,
  })
  assert.equal(debris.queueFamily, 'zanim')
  assert.equal(debris.sortBias, -15)
  assert.deepEqual(debris.draws.map((draw) => ({
    alpha: draw.alpha,
    entry: draw.entry,
    offset: draw.offset,
    role: draw.role,
    scaleX: draw.scaleX,
    tint: draw.tint,
  })), [
    {
      alpha: 1,
      entry: 2010,
      offset: { x: 1, y: -10 },
      role: 'earthquake-boulder-dark-underlay',
      scaleX: 0.44999999999999996,
      tint: 0x000000,
    },
    {
      alpha: 1,
      entry: 2010,
      offset: { x: 0, y: -12 },
      role: 'earthquake-boulder-bit',
      scaleX: 0.6,
      tint: 0xffffff,
    },
  ])
})
