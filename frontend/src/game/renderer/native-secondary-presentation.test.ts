import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SECONDARY_ACTOR_KINDS,
  createNativeSecondaryPlayerState,
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
import { nativeInitialGolemArticulation } from '../core-kernels/native-secondary-golem.ts'
import {
  nativeSecondaryMiscLightSource,
  nativeSecondaryProviderLightSource,
} from './boneyard-lighting.ts'
import { writeNativeRotationThenScaleMatrix } from './native-affine-transform.ts'
import {
  NativeSecondaryPresentationScratch,
  NATIVE_PLAYER_MAGIC_SHIELD,
  nativeGolemFacing,
  nativeGolemPresentationPlan,
  nativeLeviathanCompositePlan,
  nativePlayerMagicShieldPlan,
  nativeEtherFadeScalar,
  nativeSecondaryPresentationPlan,
  nativeSecondaryCompositeOwnerEntries,
  nativeRegionPointGain,
  presentNativeSecondaryScreenOverlay,
  NativeSecondaryScreenFeedbackPresentation,
  nativeSecondaryWorldShake,
  updateNativeSecondaryPresentationPlan,
} from './native-secondary-presentation.ts'

const KINDS: readonly NativeSecondaryActorKind[] = [
  'leviathan', 'leviathan-appendage', 'leviathan-mote', 'ether-bolt', 'ether-fade', 'phase-burst',
  'plane-orb-shot', 'plane-orb-particle', 'moving-fire', 'shockwave', 'fire-patch', 'fire-burn',
  'fire-burn-flame', 'ether-burn', 'ether-burn-flare', 'storm-cloud',
  'storm-drop', 'storm-strike', 'prismatic-wave', 'freeze-wave', 'freeze-wave-visual',
  'ice-blast', 'frost-burn-flare', 'earthquake', 'earthquake-scenery-wobble', 'earthquake-quake',
  'earthquake-dust', 'earthquake-debris',
  'golem', 'golem-death', 'teleport-burst', 'magic-circle',
  'magic-circle-player-flash', 'magic-trap', 'magic-trap-shimmer',
  'magic-trap-burst', 'electric-burn', 'flash-response-fade', 'flash-response-grow',
  'dampen-wave', 'dampened-projectile', 'shield-break',
  'shield-explosion', 'acid-rain', 'acid-drop', 'mindblast-burst',
  'mindblast-shockwave', 'ring-fire-explosion',
  'ring-fire-fragment', 'acid-splash', 'ether-drain',
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
      ...nativeInitialGolemArticulation({ x: 100, y: 200 }, 0),
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
      || kind === 'mindblast-burst'
      ? createNativeRng(711)
      : null,
    quantity: kind === 'mindblast-shockwave' ? 8 : 1,
    radius: 400,
    rank: 1,
    rotationRadians: 0,
    scale: 1,
    skillId: kind.startsWith('mindblast-')
      ? null
      : kind.startsWith('ether-burn')
        ? 14
      : kind.startsWith('dampen')
        ? 51
      : kind.startsWith('flash-response-')
        ? 53
      : kind.startsWith('acid-')
        ? 72
        : kind.startsWith('comet')
          ? 76
          : kind.startsWith('golem')
            ? 45
            : 11,
    slowFactor: 0.5,
    targetId: null,
    variant: 0,
    velocity: { x: 1, y: 0 },
    worldKey: 'boneyard:test',
  }
}

function close(actual: number, expected: number, message: string): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `${message}: expected ${expected}, received ${actual}`,
  )
}

test('native sprite affine order rotates before fixed-axis scale', () => {
  const matrix = { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 }
  writeNativeRotationThenScaleMatrix(matrix, Math.PI / 6, 2, 3, 7, 11)
  close(matrix.a, Math.sqrt(3), 'positive a')
  close(matrix.b, 1.5, 'positive b uses Y scale')
  close(matrix.c, -1, 'positive c uses X scale')
  close(matrix.d, 3 * Math.sqrt(3) / 2, 'positive d')
  assert.equal(matrix.tx, 7)
  assert.equal(matrix.ty, 11)
  assert.notEqual(matrix.b, Math.sin(Math.PI / 6) * 2)
  assert.notEqual(matrix.c, -Math.sin(Math.PI / 6) * 3)

  writeNativeRotationThenScaleMatrix(matrix, Math.PI / 2, -0.8, 0.64, 0, 0)
  close(matrix.a, 0, 'reflected a')
  close(matrix.b, 0.64, 'reflected b')
  close(matrix.c, 0.8, 'reflected c')
  close(matrix.d, 0, 'reflected d')

  writeNativeRotationThenScaleMatrix(matrix, 0.75, 4, 4, -2, 5)
  close(matrix.a, Math.cos(0.75) * 4, 'uniform a')
  close(matrix.b, Math.sin(0.75) * 4, 'uniform b')
  close(matrix.c, -Math.sin(0.75) * 4, 'uniform c')
  close(matrix.d, Math.cos(0.75) * 4, 'uniform d')

  writeNativeRotationThenScaleMatrix(matrix, 0, 1.5, 3, 0, -200)
  assert.deepEqual(matrix, { a: 1.5, b: 0, c: -0, d: 3, tx: 0, ty: -200 })
})

function screenEvent(
  eventId: number,
  tick: number,
  screenFlash: NativeSecondaryScreenFlashState,
  position = { x: 0, y: 0 },
): NativeSecondaryEventState {
  return {
    actorId: null,
    cameraDisplacement: null,
    cameraMagnitude: 0,
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
    const source = kind === 'acid-rain'
      ? { ...actor(kind), phase: 1 }
      : actor(kind)
    const plan = nativeSecondaryPresentationPlan(source)
    assert.equal(plan.root.x, 100, kind)
    assert.ok(['ordinary-dynamic', 'zanim'].includes(plan.queueFamily), kind)
    if (![
      'shockwave', 'mindblast-shockwave', 'fire-burn', 'ether-burn', 'electric-burn', 'storm-cloud', 'storm-strike', 'freeze-wave', 'ice-blast',
      'earthquake-scenery-wobble',
    ].includes(kind)) {
      assert.ok(plan.draws.length > 0, `${kind} unexpectedly became invisible`)
    }
  }
})

test('Phasing keeps its native bright-then-fade record-53 painter without a screen proxy', () => {
  const born = nativeSecondaryPresentationPlan({
    ...actor('phase-burst'),
    alpha: 2,
    position: { x: 120, y: 240 },
    rotationRadians: 0.25,
    scale: 2,
    skillId: 15,
  })
  assert.deepEqual({
    alpha: born.draws[0]?.alpha,
    atlas: born.draws[0]?.atlas,
    blend: born.draws[0]?.blend,
    entry: born.draws[0]?.entry,
    rotationRadians: born.draws[0]?.rotationRadians,
    scaleX: born.draws[0]?.scaleX,
    scaleY: born.draws[0]?.scaleY,
    queueFamily: born.queueFamily,
    sortBias: born.sortBias,
    worldY: born.worldY,
  }, {
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 53,
    rotationRadians: 0.25 + Math.PI / 2,
    scaleX: 2,
    scaleY: 2,
    queueFamily: 'zanim',
    sortBias: 15,
    worldY: 240,
  })

  const fading = nativeSecondaryPresentationPlan({
    ...actor('phase-burst'),
    alpha: Math.fround(0.9),
    skillId: 15,
  })
  assert.equal(fading.draws[0]?.alpha, Math.fround(0.9))
})

test('view-owned secondary scratch reproduces every plan and reuses hot draw storage', () => {
  const scratch = new NativeSecondaryPresentationScratch()
  for (const kind of KINDS) {
    const source = kind === 'acid-rain'
      ? { ...actor(kind), phase: 1 }
      : actor(kind)
    const expected = nativeSecondaryPresentationPlan(source, 37, 0.75)
    const actual = updateNativeSecondaryPresentationPlan(scratch, source, 37, 0.75)
    assert.deepEqual(actual, expected, kind)
  }

  const first = updateNativeSecondaryPresentationPlan(
    scratch,
    { ...actor('moving-fire'), frame: 50, scale: 0.75 },
    40,
    1,
  )
  const planStorage = first
  const drawStorage = first.draws[0]
  const secondSource = { ...actor('moving-fire'), alpha: 0.5, frame: 51, scale: 1.25 }
  const secondExpected = nativeSecondaryPresentationPlan(secondSource, 41, 1)
  const second = updateNativeSecondaryPresentationPlan(scratch, secondSource, 41, 1)
  assert.equal(second, planStorage)
  assert.equal(second.draws[0], drawStorage)
  assert.deepEqual(second, secondExpected)

  const fallingStorm = { ...actor('storm-drop'), phase: -155, quantity: 4 }
  const firstStorm = updateNativeSecondaryPresentationPlan(scratch, fallingStorm, 40, 1)
  const stormPlanStorage = firstStorm
  const stormGradientStorage = firstStorm.gradients[0]
  const nextStorm = { ...fallingStorm, phase: -145, quantity: 4.25 }
  const secondStorm = updateNativeSecondaryPresentationPlan(scratch, nextStorm, 41, 1)
  assert.equal(secondStorm, stormPlanStorage)
  assert.equal(secondStorm.gradients[0], stormGradientStorage)
  assert.deepEqual(secondStorm, nativeSecondaryPresentationPlan(nextStorm, 41, 1))
})

test('only ring-fire explosions consume the sampled Region point gain', () => {
  for (const kind of KINDS) {
    const source = kind === 'acid-rain'
      ? { ...actor(kind), phase: 1 }
      : actor(kind)
    const dim = nativeSecondaryPresentationPlan(source, 37, 0.25)
    const full = nativeSecondaryPresentationPlan(source, 37, 1)
    if (kind === 'ring-fire-explosion') assert.notDeepEqual(dim, full)
    else assert.deepEqual(dim, full, kind)
  }
})

test('the complete secondary light census stays split between providers and MiscLight writers', () => {
  const actorProviders = new Set<NativeSecondaryActorKind>([
    'leviathan', 'ether-bolt', 'moving-fire', 'shockwave', 'mindblast-shockwave', 'fire-patch',
    'storm-cloud', 'freeze-wave', 'golem', 'magic-trap', 'acid-rain',
    'ether-drain', 'comet', 'ring-fire-fragment',
  ])
  const transientProviders = new Set<NativeSecondaryActorKind>(['ring-fire-explosion'])
  const miscWriters = new Set<NativeSecondaryActorKind>([
    'magic-circle', 'fire-burn', 'ether-burn', 'electric-burn',
  ])
  for (const kind of KINDS) {
    const source = kind === 'acid-rain'
      ? { ...actor(kind), phase: 1 }
      : actor(kind)
    const expectedDisposition = actorProviders.has(kind)
      ? 'actor-provider'
      : transientProviders.has(kind)
        ? 'transient-provider'
      : miscWriters.has(kind)
        ? 'misc'
        : 'none'
    assert.equal(nativeSecondaryLightDisposition(source), expectedDisposition, kind)
    assert.equal(
      nativeSecondaryProviderLightSource(source) !== null,
      actorProviders.has(kind) || transientProviders.has(kind),
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
  }, 10)
  assert.deepEqual(portal.draws.map(({
    alpha,
    blend,
    entry,
    rotationRadians,
    scaleX,
    scaleY,
    tint,
  }) => ({
    alpha, blend, entry, rotationRadians, scaleX, scaleY, tint,
  })), [
    {
      alpha: 1,
      blend: 'add',
      entry: 75,
      rotationRadians: 30 * Math.PI / 180,
      scaleX: -0.8 * 0.75,
      scaleY: 0.48,
      tint: 0xff80ff,
    },
    {
      alpha: 1,
      blend: 'normal',
      entry: 38,
      rotationRadians: 0,
      scaleX: 0.75,
      scaleY: 0.75,
      tint: 0xffffff,
    },
  ])
  assert.equal(portal.queueFamily, 'ordinary-dynamic')
  assert.deepEqual(nativeLeviathanCompositePlan(0.75), {
    clear: {
      blend: 'multiply',
      color: 0x000000,
      height: 1_000,
      width: 256,
      x: 0,
      y: 128 + 64 * 0.75,
    },
    mask: {
      blend: 'multiply',
      clipTop: 128,
      entry: 39,
      scale: 0.75,
    },
    outputs: [
      { alpha: 1, blend: 'normal' },
      { alpha: 0.5, blend: 'add' },
    ],
  })

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

test('Leviathan appendages share one parent painter owner and cannot interleave as world actors', () => {
  const parent = { ...actor('leviathan'), id: 10 }
  const first = {
    ...actor('leviathan-appendage'),
    hitTargetIds: [parent.id],
    id: 11,
  }
  const second = { ...first, id: 12 }
  const unrelated = { ...actor('moving-fire'), id: 13 }
  assert.deepEqual(nativeSecondaryCompositeOwnerEntries(
    [parent, first, second, unrelated],
    'boneyard:test',
  ), [[11, 10], [12, 10]])
  assert.deepEqual(nativeSecondaryCompositeOwnerEntries(
    [parent, first, second, unrelated],
    'hub:courtyard',
  ), [])
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
  assert.deepEqual(mesh.vertexColors, [
    0xffffffff,
    0xffffffff, 0,
    0xffffffff, 0,
    0xffffffff, 0,
    0xffffffff, 0,
    0xffffffff, 0,
    0xffffffff, 0,
    0xffffffff, 0,
  ])
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
  assert.equal(enhanced.vertexColors.length, 31)
  assert.equal(enhanced.vertexColors[0], 0xffffffff)
  for (let vertex = 1; vertex < enhanced.vertexColors.length; vertex += 2) {
    assert.equal(enhanced.vertexColors[vertex], 0xffffffff)
    assert.equal(enhanced.vertexColors[vertex + 1], 0)
  }

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

  const etherBurn = {
    ...actor('ether-burn'),
    ageTicks: 1,
    alpha: 0.6,
    position: { x: 25, y: 35 },
    radius: 0.14,
  }
  assert.deepEqual(nativeSecondaryPresentationPlan(etherBurn).draws, [])
  assert.deepEqual(nativeSecondaryMiscLightSource(etherBurn), {
    castsDirectionalShadow: false,
    intensity: 0.6,
    position: { x: 25, y: 35 },
    radius: 0.14,
  })
  const etherFlare = nativeSecondaryPresentationPlan({
    ...actor('ether-burn-flare'),
    alpha: 0.125,
    frame: 248,
    scale: 1.1,
  }).draws[0]
  assert.deepEqual(etherFlare, {
    alpha: 0.125,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 248,
    offset: { x: 0, y: 0 },
    role: 'ether-burn-flare-BadGuys-248',
    rotationRadians: 0,
    scaleX: 1.1,
    scaleY: 1.1,
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
  assert.equal(nativeSecondaryPresentationPlan({
    ...actor('dampen-wave'),
    ageTicks: 0,
  }).draws.length, 39)
})

test('FrostBurn and maximum Ring fire own target and contact VFX with enrolled lights', () => {
  const frost = nativeSecondaryPresentationPlan({
    ...actor('frost-burn-flare'),
    alpha: 0.75,
    frame: 11,
    quantity: 0x408080,
    rotationRadians: 0.25,
    scale: 0.8,
  }).draws
  assert.deepEqual(frost.map(({ alpha, blend, entry, tint }) => ({
    alpha, blend, entry, tint,
  })), [{ alpha: 0.75, blend: 'add', entry: 11, tint: 0x408080 }])

  const explosionActor = {
    ...actor('ring-fire-explosion'),
    ageTicks: 0,
    radius: 165,
    scale: 1.5,
  }
  assert.deepEqual(
    nativeSecondaryPresentationPlan(explosionActor).draws.map(({ entry, role }) => ({ entry, role })),
    [
      { entry: 15, role: 'explosion-core' },
      { entry: 401, role: 'explosion-array' },
      { entry: 420, role: 'explosion-lit-array' },
    ],
  )
  assert.deepEqual(nativeSecondaryProviderLightSource(explosionActor), {
    castsDirectionalShadow: true,
    intensity: 1,
    position: explosionActor.position,
    radius: 2,
  })

  const fragment = {
    ...actor('ring-fire-fragment'),
    ageTicks: 0,
    alpha: 3,
    frame: 2,
    phase: -6,
  }
  const fragmentPlan = nativeSecondaryPresentationPlan(fragment)
  assert.deepEqual(
    fragmentPlan.draws.map(({ blend, entry }) => ({ blend, entry })),
    [
      { blend: 'normal', entry: 269 },
      { blend: 'add', entry: 269 },
      { blend: 'add', entry: 269 },
      { blend: 'add', entry: 15 },
    ],
  )
  assert.deepEqual(fragmentPlan.quads, [{
    alpha: Math.fround((1 - fragment.phase / -50 * 0.5) * 0.25),
    atlas: null,
    blend: 'normal',
    entry: null,
    role: 'ring-fire-fragment-enhanced-ground-glow',
    tint: 0xff8040,
    vertices: [
      -14.25, -Math.fround(37 * Math.fround(0.6000000238418579)) / 2,
      14.25, -Math.fround(37 * Math.fround(0.6000000238418579)) / 2,
      -14.25, Math.fround(37 * Math.fround(0.6000000238418579)) / 2,
      14.25, Math.fround(37 * Math.fround(0.6000000238418579)) / 2,
    ],
  }])
  const fragmentLight = nativeSecondaryProviderLightSource(fragment)!
  assert.equal(fragmentLight.castsDirectionalShadow, false)
  assert.equal(fragmentLight.intensity, 0.25)
  assert.deepEqual(fragmentLight.position, fragment.position)
  assert.ok(fragmentLight.radius >= 0.75 && fragmentLight.radius <= 1)
})

test('Dampen repairs the crashing suffix as 36 radial wisps and three magical arcs', () => {
  const initial = createNativeRng(711)
  const born = nativeSecondaryPresentationPlan({
    ...actor('dampen-wave'),
    ageTicks: 0,
    presentationRng: initial,
  }).draws
  assert.equal(born.length, 39)
  assert.deepEqual(
    born.slice(0, 36).map(({ role }) => role),
    Array.from({ length: 36 }, (_, index) => `dampen-move-fade-${index * 10}`),
  )
  assert.deepEqual(
    born.slice(36).map(({ role }) => role),
    ['dampen-additive-0', 'dampen-additive-10', 'dampen-additive-20'],
  )

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
  assert.deepEqual(born[36], {
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

test('Dampen flyouts keep Firebolt and both Guided Missile native compositors', () => {
  const fire = nativeSecondaryPresentationPlan({
    ...actor('dampened-projectile'),
    frame: 8,
    targetId: 40,
    variant: 0,
  }).draws
  assert.deepEqual(fire.map(({ entry, role }) => ({ entry, role })), [
    { entry: 15, role: 'dampened-projectile-firebolt-orange-glow' },
    { entry: 263, role: 'dampened-projectile-firebolt-body' },
  ])

  for (const [variant, mainEntry, payload] of [
    [1, 111, 'poison'],
    [2, 110, 'cold'],
  ] as const) {
    const guided = nativeSecondaryPresentationPlan({
      ...actor('dampened-projectile'),
      frame: 12,
      phase: 30,
      targetId: 41 + variant,
      variant,
    }).draws
    assert.deepEqual(guided.map(({ entry, role }) => ({ entry, role })), [
      { entry: mainEntry, role: `dampened-projectile-guided-missile-${payload}-body` },
      { entry: 112, role: `dampened-projectile-guided-missile-${payload}-aura` },
    ])
  }
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
      atlas: 'Clothes', blend: 'add', entry: 2, offset: { x: 0, y: -35 },
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

test('Mindblowing Ring replays its exact core, three Clothes rings, arrays, and cyan FuzzySpears', () => {
  const initial = createNativeRng(0x52a220)
  const bornActor = {
    ...actor('mindblast-burst'),
    ageTicks: 0,
    presentationRng: initial,
    rank: 12,
    scale: 9,
    skillId: null,
    variant: 0,
  }
  const born = nativeSecondaryPresentationPlan(bornActor).draws
  assert.equal(born.length, 206)
  assert.deepEqual(born.slice(0, 6).map((operation) => ({
    alpha: operation.alpha,
    atlas: operation.atlas,
    blend: operation.blend,
    entry: operation.entry,
    offset: operation.offset,
    role: operation.role,
    scaleX: operation.scaleX,
    scaleY: operation.scaleY,
    tint: operation.tint,
  })), [{
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'normal',
    entry: 15,
    offset: { x: 0, y: -25 },
    role: 'mindblast-center-flash',
    scaleX: 54,
    scaleY: 54,
    tint: 0xffffff,
  }, ...[1.1, 1.05, 1.025].map((_, index) => ({
    alpha: 1,
    atlas: 'Clothes' as const,
    blend: 'add' as const,
    entry: 2,
    offset: { x: 0, y: -35 },
    role: `mindblast-expanding-ring-${index}`,
    scaleX: 4.5,
    scaleY: 4.5,
    tint: 0x00ffff,
  })), {
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 158,
    offset: { x: 0, y: 0 },
    role: 'mindblast-sprite-array-0',
    scaleX: 10,
    scaleY: 10,
    tint: 0xffffff,
  }, {
    alpha: 1,
    atlas: 'BadGuys',
    blend: 'add',
    entry: 158,
    offset: { x: 0, y: 0 },
    role: 'mindblast-sprite-array-1',
    scaleX: 10,
    scaleY: 10,
    tint: 0xffffff,
  }])

  const firstRotation = drawNativeFloat(initial, 360)
  const secondRotation = drawNativeFloat(firstRotation.state, 360)
  assert.equal(born[4]!.rotationRadians, firstRotation.value * Math.PI / 180)
  assert.equal(born[5]!.rotationRadians, secondRotation.value * Math.PI / 180)
  assert.deepEqual(born.slice(6, 8).map(({ atlas, blend, entry, role, tint }) => ({
    atlas, blend, entry, role, tint,
  })), [{
    atlas: 'BadGuys', blend: 'add', entry: 17,
    role: 'mindblast-fuzzy-spear-base-0', tint: 0x00ffff,
  }, {
    atlas: 'BadGuys', blend: 'add', entry: 74,
    role: 'mindblast-fuzzy-spear-glow-0', tint: 0x00ffff,
  }])

  const stepped = nativeSecondaryPresentationPlan({ ...bornActor, ageTicks: 1 }).draws
  assert.equal(
    stepped.find(({ role }) => role === 'mindblast-expanding-ring-0')!.scaleX,
    Math.fround(Math.fround(4.5) * Math.fround(1.1)),
  )
  assert.equal(
    stepped.find(({ role }) => role === 'mindblast-expanding-ring-1')!.scaleX,
    Math.fround(Math.fround(4.5) * Math.fround(1.05)),
  )
  assert.equal(
    stepped.find(({ role }) => role === 'mindblast-expanding-ring-2')!.scaleX,
    Math.fround(Math.fround(4.5) * Math.fround(1.025)),
  )
  assert.deepEqual(nativeSecondaryPresentationPlan({ ...bornActor, ageTicks: 230 }).draws, [])

  const wave = {
    ...actor('mindblast-shockwave'),
    alpha: Math.fround(0.9),
    lightRegistration: { managerLane: 'actor' as const, registrationOrdinal: 9 },
    radius: 155,
    skillId: null,
  }
  assert.deepEqual(nativeSecondaryProviderLightSource(wave), {
    castsDirectionalShadow: false,
    intensity: Math.fround(0.9),
    position: wave.position,
    radius: 155 / 140,
  })
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
  }], 'boneyard:test'), { x: 0, y: 0 })
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
    bottomAlpha: 0.5,
    bottomColor: 0xccf2ff,
    height: 4,
    role: 'storm-raindrop-streak',
    topAlpha: 0,
    topColor: 0x66f2ff,
    topLeft: { x: 0, y: -155 },
    width: 2,
  }])
  const acid = nativeSecondaryPresentationPlan({ ...drop, kind: 'acid-drop', skillId: 72 })
  assert.deepEqual(acid.gradients, [{
    bottomAlpha: 0.5,
    bottomColor: 0xb3f2bf,
    height: 4,
    role: 'acid-raindrop-streak',
    topAlpha: 0,
    topColor: 0x66f280,
    topLeft: { x: -1, y: -155 },
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
    offset: { x: 0, y: 0 },
    tint: 0xb3f2bf,
  })

  const landedStorm = nativeSecondaryPresentationPlan({ ...drop, phase: 0, scale: 0.5 })
  const landedAcid = nativeSecondaryPresentationPlan({
    ...drop,
    kind: 'acid-drop',
    phase: 0,
    scale: 0.5,
    skillId: 72,
  })
  assert.deepEqual(landedStorm.draws.map(({ alpha, atlas, entry, tint }) => ({
    alpha, atlas, entry, tint,
  })), [{ alpha: 0.75, atlas: 'BadGuys', entry: 63, tint: 0xccffff }])
  assert.deepEqual(landedAcid.draws.map(({ alpha, atlas, entry, tint }) => ({
    alpha, atlas, entry, tint,
  })), [{ alpha: 0.75, atlas: 'BadGuys', entry: 63, tint: 0xccffcc }])
})

test('Acid Rain uses fixed-tick actor age for its cloud and splits out ground residue', () => {
  const source = {
    ...actor('acid-rain'),
    ageTicks: 80,
    alpha: 0.625,
    phase: 0.8,
    rotationRadians: 0.4,
    scale: 0.5,
  }
  const plan = nativeSecondaryPresentationPlan(source, 987)
  assert.equal(plan.sortBias, 0)
  assert.equal(plan.worldY, source.position.y + 350)
  assert.deepEqual(plan.draws.map((draw) => ({
    alpha: draw.alpha,
    atlas: draw.atlas,
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
      atlas: 'BadGuys',
      blend: 'normal',
      entry: 78,
      offset: { x: 0, y: -175 },
      role: 'acid-rain-cloud-mottled-source-over',
      rotationRadians: Math.PI / 180,
      scaleX: 2.5,
      scaleY: 2,
      tint: 0x698c52,
    },
    {
      alpha: 0.6000000238418579,
      atlas: 'BadGuys',
      blend: 'add',
      entry: 78,
      offset: { x: 0, y: -175 },
      role: 'acid-rain-cloud-mottled-additive',
      rotationRadians: Math.PI / 180,
      scaleX: 2.5,
      scaleY: 2,
      tint: 0x698c52,
    },
    {
      alpha: 0.800000011920929,
      atlas: 'BadGuys',
      blend: 'add',
      entry: 10,
      offset: { x: 0, y: -200 },
      role: 'acid-rain-cloud-circle-additive',
      rotationRadians: -40 * Math.PI / 180,
      scaleX: 1.5,
      scaleY: 3,
      tint: 0x407326,
    },
  ])
  assert.deepEqual(plan.underlayDraws.map((draw) => ({
    alpha: draw.alpha,
    atlas: draw.atlas,
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
      alpha: 0.625,
      atlas: 'DeadHawg',
      blend: 'normal',
      entry: 4,
      offset: { x: 0, y: 0 },
      role: 'acid-rain-ground-residue',
      rotationRadians: 0,
      scaleX: 4.5,
      scaleY: 4.5,
      tint: 0x0d1a0d,
    },
  ])
  const noResidue = nativeSecondaryPresentationPlan({ ...source, alpha: 0 }, 987)
  assert.equal(noResidue.draws.length, 3)
  assert.equal(noResidue.underlayDraws.length, 0)
  const residueOnly = nativeSecondaryPresentationPlan({ ...source, phase: 0 }, 987)
  assert.equal(residueOnly.draws.length, 0)
  assert.equal(residueOnly.underlayDraws.length, 1)

  const center = plan.draws[2]!
  const centerMatrix = { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 }
  writeNativeRotationThenScaleMatrix(
    centerMatrix,
    center.rotationRadians,
    center.scaleX,
    center.scaleY,
    center.offset.x,
    center.offset.y,
  )
  close(centerMatrix.a, 1.149066664678467, 'Acid center a')
  close(centerMatrix.b, -1.9283628290596178, 'Acid center b uses Y scale')
  close(centerMatrix.c, 0.9641814145298089, 'Acid center c uses X scale')
  close(centerMatrix.d, 2.298133329356934, 'Acid center d')
  assert.equal(centerMatrix.tx, 0)
  assert.equal(centerMatrix.ty, -200)
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
  assert.deepEqual(plan.root, source.position)
  assert.equal(plan.worldY, source.position.y + 350)
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

test('reduced screen flashes scale only the final Region overlay alpha', () => {
  const white = { alpha: 1, color: 0xffffff }
  const cyanAtHalfPointGain = { alpha: 0.5, color: 0xe6ffff }
  assert.equal(presentNativeSecondaryScreenOverlay(null, true), null)
  assert.equal(presentNativeSecondaryScreenOverlay(white, false), white)
  assert.deepEqual(presentNativeSecondaryScreenOverlay(white, true), {
    alpha: 0.2,
    color: 0xffffff,
  })
  assert.deepEqual(presentNativeSecondaryScreenOverlay(cyanAtHalfPointGain, true), {
    alpha: 0.1,
    color: 0xe6ffff,
  })
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

  const camera = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:test')
  camera.consume({
    ...screenEvent(1, 0, {
      alpha: 1,
      blue: 1,
      decayPerTick: 0.01,
      green: 0.5,
      pointAttenuated: true,
      red: 1,
    }),
    cameraMagnitude: 0.25,
  }, context)
  assert.equal(camera.sampleCameraMagnitude(0), Math.fround(0.25))
  assert.equal(
    camera.sampleCameraMagnitude(1),
    Math.fround(Math.fround(0.25) * Math.fround(0.94)),
  )

  camera.consume({
    ...screenEvent(2, 1, {
      alpha: 1,
      blue: 1,
      decayPerTick: 0.05,
      green: 1,
      pointAttenuated: true,
      red: 1,
    }),
    cameraDisplacement: { x: 1.8, y: -2.4 },
  }, context)
  assert.deepEqual(camera.sampleCameraDisplacement(1), {
    x: Math.fround(1.8),
    y: Math.fround(-2.4),
  })
  assert.deepEqual(camera.sampleCameraDisplacement(2), {
    x: Math.fround(Math.fround(1.8) * Math.fround(0.75)),
    y: Math.fround(Math.fround(-2.4) * Math.fround(0.75)),
  })
  assert.deepEqual(camera.sampleCameraDisplacement(8), { x: 0, y: 0 })

  const etherBlast = new NativeSecondaryScreenFeedbackPresentation(20, 'boneyard:test')
  etherBlast.consumePrimaryEtherBlast({
    ageTicks: 0,
    birthTick: 20,
    charges: 4,
    id: 39,
    kind: 'ether-blast',
    origin: { x: 0, y: 0 },
    ownerId: 'player',
    presentationRng: createNativeRng(14),
    worldKey: 'boneyard:test',
  }, context)
  assert.deepEqual(etherBlast.sample(20), { alpha: 1, color: 0xff40ff })
  assert.equal(etherBlast.sampleCameraMagnitude(20), Math.fround(0.4))
  assert.equal(etherBlast.sample(21)?.alpha, Math.fround(0.975))
  assert.equal(
    etherBlast.sampleCameraMagnitude(21),
    Math.fround(Math.fround(0.4) * Math.fround(0.94)),
  )

  const meteor = new NativeSecondaryScreenFeedbackPresentation(20, 'boneyard:test')
  meteor.consumePrimaryCameraDisplacement({
    displacement: { x: 6, y: -8 },
    eventId: 40,
    tick: 18,
    worldKey: 'boneyard:test',
  })
  assert.deepEqual(meteor.sampleCameraDisplacement(20), {
    x: Math.fround(Math.fround(6) * Math.fround(0.75) * Math.fround(0.75)),
    y: Math.fround(Math.fround(-8) * Math.fround(0.75) * Math.fround(0.75)),
  })
  meteor.consumePrimaryCameraDisplacement({
    displacement: { x: 10, y: 0 },
    eventId: 40,
    tick: 20,
    worldKey: 'boneyard:test',
  })
  assert.notDeepEqual(meteor.sampleCameraDisplacement(20), { x: 10, y: 0 })

  const hail = new NativeSecondaryScreenFeedbackPresentation(20, 'boneyard:test')
  hail.consumePrimaryCameraMagnitude({
    eventId: 41,
    magnitude: Math.fround(0.1),
    tick: 18,
    worldKey: 'boneyard:test',
  })
  assert.equal(
    hail.sampleCameraMagnitude(20),
    Math.fround(Math.fround(Math.fround(0.1) * Math.fround(0.94)) * Math.fround(0.94)),
  )
  hail.consumePrimaryCameraMagnitude({
    eventId: 41,
    magnitude: 1,
    tick: 20,
    worldKey: 'boneyard:test',
  })
  assert.notEqual(hail.sampleCameraMagnitude(20), 1)
})

test('Flash response actors retain the exact record-16 growth and record-15 fade passes', () => {
  const grow = nativeSecondaryPresentationPlan({
    ...actor('flash-response-grow'),
    alpha: 0.75,
    scale: 1.5,
  }).draws[0]!
  assert.deepEqual({
    alpha: grow.alpha,
    blend: grow.blend,
    entry: grow.entry,
    role: grow.role,
    scaleX: grow.scaleX,
    scaleY: grow.scaleY,
  }, {
    alpha: 0.75,
    blend: 'add',
    entry: 16,
    role: 'flash-response-grow-perspective',
    scaleX: 1.5,
    scaleY: Math.fround(1.5 * Math.fround(0.8)),
  })
  const fade = nativeSecondaryPresentationPlan({
    ...actor('flash-response-fade'),
    alpha: 0.5,
    scale: 6,
  }).draws[0]!
  assert.deepEqual({
    alpha: fade.alpha,
    blend: fade.blend,
    entry: fade.entry,
    role: fade.role,
    scaleX: fade.scaleX,
    scaleY: fade.scaleY,
  }, {
    alpha: 0.5,
    blend: 'add',
    entry: 15,
    role: 'flash-response-fade',
    scaleX: 6,
    scaleY: 6,
  })
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
  assert.deepEqual(nativeSecondaryProviderLightSource({
    ...actor('storm-cloud'),
    alpha: 0.8,
  }), {
    castsDirectionalShadow: false,
    intensity: 0.4,
    position: { x: 100, y: 200 },
    radius: 2,
  })
  const acid = { ...actor('acid-rain'), alpha: 1, phase: 0.8 }
  assert.equal(nativeSecondaryLightDisposition(acid), 'actor-provider')
  assert.deepEqual(nativeSecondaryProviderLightSource(acid), {
    castsDirectionalShadow: false,
    intensity: 0.4,
    position: { x: 100, y: 200 },
    radius: 2,
  })
  const residueOnly = { ...acid, phase: 0 }
  assert.equal(nativeSecondaryLightDisposition(residueOnly), 'actor-provider')
  assert.equal(nativeSecondaryProviderLightSource(residueOnly), null)
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

test('the player shield uses its own Clothes shell and alpha, independent of body materials', () => {
  assert.deepEqual(NATIVE_PLAYER_MAGIC_SHIELD, {
    atlas: 'Clothes', entry: 2, offsetY: -35, scale: Math.fround(2.15),
  })
  const state = {
    ...createNativeSecondaryPlayerState(),
    magicShieldAbsorb: 25,
    magicShieldMaximum: 25,
  }
  assert.deepEqual(nativePlayerMagicShieldPlan(state, 0), {
    alpha: 0.25,
    scale: Math.fround(2.15),
    tint: 0xffffff,
    visible: true,
  })
  for (const [pulseTicks, alpha] of [[40, 0.75], [30, 0.5], [20, 0.25], [10, 0.25], [0, 0.25]] as const) {
    const pulsed = { ...state, magicShieldPulseTicks: pulseTicks }
    const peak = nativePlayerMagicShieldPlan(pulsed, 4)
    const trough = nativePlayerMagicShieldPlan(pulsed, 13)
    assert.equal(peak.alpha, alpha)
    assert.equal(peak.tint, 0xffffff)
    if (pulseTicks >= 20) {
      assert.ok(peak.scale > 2.24 && peak.scale < 2.25)
      assert.ok(trough.scale > 2.05 && trough.scale < 2.06)
    } else if (pulseTicks === 10) {
      assert.ok(peak.scale > 2.19 && peak.scale < 2.2)
      assert.ok(trough.scale > 2.1 && trough.scale < 2.11)
    } else {
      assert.equal(peak.scale, Math.fround(2.15))
      assert.equal(trough.scale, Math.fround(2.15))
    }
  }
  for (const material of [{ stoneskinTicksRemaining: 10 }, { planewalkerTicksRemaining: 10 }]) {
    assert.deepEqual(nativePlayerMagicShieldPlan({ ...state, ...material }, 4),
      nativePlayerMagicShieldPlan(state, 4))
  }
  assert.equal(nativePlayerMagicShieldPlan(undefined, 0).visible, false)
  assert.equal(nativePlayerMagicShieldPlan({ ...state, magicShieldAbsorb: 0 }, 0).visible, false)
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

test('Golem keeps visible transforms separate from internal sort keys', () => {
  const source = actor('golem')
  const plan = nativeGolemPresentationPlan({
    ...source,
    golem: {
      ...source.golem!,
      leftConnectorOffset: { x: 2, y: -12 },
      leftFootRotationDegrees: 7,
      rightConnectorOffset: { x: -3, y: -12 },
      rightFootRotationDegrees: -6,
    },
  })
  const draw = (role: string) => plan.draws.find((entry) => entry.role === role)!
  assert.deepEqual(draw('golem-core-lower').offset, { x: 0, y: -11 })
  assert.deepEqual(draw('golem-core-upper').offset, { x: 0, y: -6 })
  assert.deepEqual(draw('golem-limb-left').offset, { x: 38, y: -11 })
  assert.deepEqual(draw('golem-limb-right').offset, { x: -38, y: -11 })
  assert.deepEqual(draw('golem-piece-forward-right').offset, { x: -12, y: 4 })
  assert.deepEqual(draw('golem-piece-forward-left').offset, { x: 12, y: 7 })
  assert.deepEqual(draw('golem-piece-center').offset, { x: 0, y: 9 })
  assert.deepEqual(draw('golem-piece-rear-right').offset, { x: -12, y: -7 })
  assert.deepEqual(draw('golem-piece-rear-left').offset, { x: 12, y: -10 })
  assert.equal(draw('golem-limb-left').rotationRadians, 7 * Math.PI / 180)
  assert.equal(draw('golem-limb-right').rotationRadians, -6 * Math.PI / 180)
  assert.equal(draw('golem-connector-endpoint-left').rotationRadians, 0)
  assert.equal(draw('golem-connector-endpoint-right').rotationRadians, 0)
  assert.deepEqual(draw('golem-connector-endpoint-left').offset, { x: 12, y: 7 })
  assert.deepEqual(draw('golem-connector-endpoint-right').offset, { x: -13, y: 7 })
  assert.deepEqual(draw('golem-connector-cap-left').offset, { x: 12, y: -8 })
  assert.deepEqual(draw('golem-connector-cap-right').offset, { x: -13, y: -8 })
  assert.deepEqual(draw('golem-connector-glow-left').offset, { x: 12, y: -4.25 })
  assert.deepEqual(draw('golem-connector-glow-right').offset, { x: -13, y: -4.25 })
})

test('Golem preserves every visible body formula through all sixteen headings', () => {
  const position = { x: 100, y: 200 }
  const base = actor('golem')
  const expectedRecords = [
    ['golem-core-lower', 0, 0, 10],
    ['golem-limb-left', -5, -38, 5],
    ['golem-limb-right', -5, 38, 5],
    ['golem-piece-forward-right', -20, 12, 5],
    ['golem-piece-forward-left', -20, -12, 8],
    ['golem-piece-center', -15, 0, 15],
    ['golem-piece-rear-right', 1, 12, 15],
    ['golem-piece-rear-left', 1, -12, 12],
  ] as const
  for (let facing = 0; facing < 16; facing += 1) {
    const rotationRadians = facing * Math.PI * 2 / 16
    const articulation = nativeInitialGolemArticulation(position, rotationRadians)
    const plan = nativeGolemPresentationPlan({
      ...base,
      position,
      rotationRadians,
      golem: { ...base.golem!, ...articulation },
    })
    const forward = {
      x: Math.sin(rotationRadians),
      y: -Math.cos(rotationRadians),
    }
    const lateral = { x: forward.y, y: -forward.x }
    const center = {
      x: (articulation.leftFoot.x + articulation.rightFoot.x) * 0.5 - position.x,
      y: (articulation.leftFoot.y + articulation.rightFoot.y) * 0.5 - position.y,
    }
    for (const [role, forwardOffset, lateralOffset, verticalOffset] of expectedRecords) {
      const actual = plan.draws.find((draw) => draw.role === role)?.offset
      assert.ok(actual, `${role} heading ${facing}`)
      const expected = {
        x: center.x + forward.x * forwardOffset + lateral.x * lateralOffset,
        y: center.y + forward.y * forwardOffset + lateral.y * lateralOffset
          - 40 + verticalOffset,
      }
      assert.ok(Math.abs(actual.x - expected.x) < 1e-5, `${role} heading ${facing} x`)
      assert.ok(Math.abs(actual.y - expected.y) < 1e-5, `${role} heading ${facing} y`)
    }
  }
})

test('Golem attack and provoke phases select the native limb banks and rotations', () => {
  const base = actor('golem')
  const attack = nativeGolemPresentationPlan({
    ...base,
    golem: {
      ...base.golem!,
      actionHeadingOffsetDegrees: -38,
      actionDurationTicks: 80,
      actionTick: 10,
      leftLimbMode: 1,
      phase: 'attack',
      poseVariant: 0,
      rightLimbMode: 0,
    },
  })
  const attackingLeft = attack.draws.find(({ role }) => role === 'golem-limb-left')!
  assert.equal(attackingLeft.entry, 16)
  assert.equal(attackingLeft.rotationRadians, Math.PI / 4)

  const recovery = nativeGolemPresentationPlan({
    ...base,
    golem: {
      ...base.golem!,
      actionHeadingOffsetDegrees: 47,
      actionDurationTicks: 80,
      actionTick: 38,
      leftLimbMode: 2,
      phase: 'attack',
      poseVariant: 0,
      rightLimbMode: 1,
    },
  })
  assert.equal(recovery.draws.find(({ role }) => role === 'golem-limb-left')!.entry, 19)
  assert.equal(recovery.draws.find(({ role }) => role === 'golem-limb-right')!.rotationRadians, -Math.PI / 4)

  const provoke = nativeGolemPresentationPlan({
    ...base,
    golem: {
      ...base.golem!,
      actionTick: 101,
      leftConnectorOffset: { x: 0, y: -12 },
      leftLimbMode: 3,
      phase: 'provoke',
      rightConnectorOffset: { x: 0, y: -12 },
      rightLimbMode: 3,
    },
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
  ], 'boneyard:test'), { x: -2, y: 8 })
  assert.deepEqual(nativeSecondaryWorldShake([
    { ...quake, id: 2, velocity: { x: 3, y: 0 } },
  ], 'boneyard:test', { x: 6, y: 0 }), { x: 6, y: 0 })
  assert.deepEqual(nativeSecondaryWorldShake([
    { ...quake, id: 2, velocity: { x: 8, y: 0 } },
  ], 'boneyard:test', { x: 6, y: 0 }), { x: 8, y: 0 })
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
