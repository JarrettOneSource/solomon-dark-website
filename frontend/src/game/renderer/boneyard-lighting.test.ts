import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
} from '../protocol/game-state.ts'
import type {
  PrimarySpellEtherImpactState,
  PrimarySpellFireImpactState,
  PrimarySpellFireProjectileState,
} from '../core-kernels/primary-spells.ts'
import {
  nativeRandomFloatFromSemanticWord,
  nativeRandomIntFromSemanticWord,
  nativeSignedRandomFloatFromSemanticWords,
} from '../core-kernels/native-random-domain.ts'
import {
  createNativeWeldMeteor,
  createNativeWeldPersistentActor,
  type NativeWeldProjectileState,
} from '../core-kernels/native-weld-primary-runtime.ts'
import {
  NATIVE_DEFAULT_LIGHT_QUALITY,
  NATIVE_DEFAULT_MULTIPLE_SHADOWS,
  NATIVE_LANTERN_LIGHT_BASE_INTENSITY,
  NATIVE_LANTERN_LIGHT_FLICKER,
  NATIVE_LIGHT_GRID_CELL_SIZE,
  NATIVE_LOW_CAPABILITY_LIGHT_QUALITY,
  NATIVE_PLAYER_LIGHT_RADIUS,
  NATIVE_PLAYER_LIGHT_RASTER_JITTER,
  NATIVE_REGION_LIGHT_ATLAS,
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  NATIVE_REGION_LIGHT_BOTTOM_PADDING,
  NATIVE_REGION_LIGHT_ENTRY,
  NATIVE_REGION_LIGHT_WORLD_SCALE,
  NativeBoneyardLightIndex,
  type NativeBoneyardLightSource,
  nativeAcceptedBoneyardLightSources,
  nativeBoulderLightSource,
  nativeBoneyardLightScalar,
  nativeBoneyardSurfaceLightScalar,
  nativeBoneyardLightTint,
  nativeBoneyardLightVisibleInManager,
  nativeBoneyardWeatherLightingOrder,
  nativeEnemyProjectileEffectLightProvider,
  nativeEnemyProjectileLightProvider,
  nativeEnemyLightSources,
  nativeLanternLightSource,
  nativeMissileLightSource,
  nativePlayerLightSource,
  nativeRegionLightManagerPlan,
  nativeRegionLightTargetPlan,
  nativeRegionLightStamp,
  nativeSolomonSetPieceLighting,
  nativeWeldProjectileLightSource,
  nativeWeldMeteorLightSource,
  nativeWeldRockLightSource,
} from './boneyard-lighting.ts'
import {
  NATIVE_BUILDING_BASE_ENTRIES,
  NATIVE_BUILDING_ROOF_ENTRIES,
  NATIVE_MONUMENT_ENTRIES,
  nativeBuildingLightGrid,
  nativeBuildingMeshGrid,
  nativeWallSurfaceVertexWeights,
  writeNativeStaticSurfaceVertexColors,
  writeNativeWallVertexScalars,
} from './boneyard-static-surface-lighting.ts'
import { etherPrimaryImpactLightSource } from './primary-spell-ether-native.ts'
import {
  nativeFireballLightSource,
  nativeFireImpactLightSource,
} from './primary-spell-fire-native.ts'
import {
  buildNativeAirContactLightSource,
  buildNativeAirPathLightSources,
} from './primary-spell-air-native.ts'
import { nativeMageLightningPulsePlan } from './native-mage-lightning-pulse-presentation.ts'

const LIGHT_VIEW = {
  camera: { x: 800, y: 450, zoom: 1 },
  viewport: { height: 900, width: 1_600 },
}

const WIDE_ZOOMED_LIGHT_VIEW = {
  camera: { x: 800, y: 450, zoom: 1.35 },
  viewport: { height: 900, width: 1_600 },
}

const PORTRAIT_ZOOMED_LIGHT_VIEW = {
  camera: { x: 195, y: 422, zoom: 1.35 },
  viewport: { height: 844, width: 390 },
}

const FLOAT32_STEP_BUFFER = new ArrayBuffer(4)
const FLOAT32_STEP_VIEW = new DataView(FLOAT32_STEP_BUFFER)

function adjacentFloat32(value: number, direction: -1 | 1, steps = 1): number {
  let rounded = Math.fround(value)
  for (let index = 0; index < steps; index += 1) {
    FLOAT32_STEP_VIEW.setFloat32(0, rounded)
    const bits = FLOAT32_STEP_VIEW.getUint32(0)
    const step = (rounded > 0) === (direction > 0) ? 1 : -1
    FLOAT32_STEP_VIEW.setUint32(0, bits + step)
    rounded = FLOAT32_STEP_VIEW.getFloat32(0)
  }
  return rounded
}

test('matches the native inclusive random lattice, biased reducer, and signed draw', () => {
  assert.equal(nativeRandomIntFromSemanticWord(0, 100_001), 0)
  assert.equal(nativeRandomIntFromSemanticWord(64, 100_001), 1)
  assert.equal(nativeRandomIntFromSemanticWord(99_999 * 64, 100_001), 99_999)
  assert.equal(nativeRandomIntFromSemanticWord(100_000 * 64, 100_001), 100_000)
  assert.equal(nativeRandomIntFromSemanticWord(100_001 * 64, 100_001), 0)

  assert.equal(nativeRandomFloatFromSemanticWord(0), 0)
  assert.equal(nativeRandomFloatFromSemanticWord(64), 0.000009999999747378752)
  assert.equal(nativeRandomFloatFromSemanticWord(99_999 * 64), 0.9999899864196777)
  assert.equal(nativeRandomFloatFromSemanticWord(100_000 * 64), 1)
  assert.equal(
    nativeRandomFloatFromSemanticWord(100_000 * 64, 0.2),
    0.20000000298023224,
  )

  assert.equal(nativeRandomIntFromSemanticWord(8 * 64, 9), 8)
  assert.equal(nativeRandomIntFromSemanticWord(9 * 64, 9), 0)
  assert.equal(
    nativeSignedRandomFloatFromSemanticWords(100_000 * 64, 0, 0.1),
    0.10000000149011612,
  )
  assert.equal(
    nativeSignedRandomFloatFromSemanticWords(100_000 * 64, 64, 0.1),
    -0.10000000149011612,
  )
  assert.equal(
    Object.is(nativeSignedRandomFloatFromSemanticWords(0, 64, 0.1), -0),
    true,
  )
})

function enemyProjectile(
  overrides: Partial<BoneyardEnemyProjectileSnapshot> = {},
): BoneyardEnemyProjectileSnapshot {
  return {
    ageTicks: 3,
    contactRadius: 12,
    headingDeg: 90,
    homing: false,
    id: 17,
    kind: 'arrow',
    lightRegistration: null,
    lifetimeTicks: 100,
    nativeTypeId: 0x7da,
    ownerActorId: 9,
    payload: 'normal',
    position: { x: 31, y: 47 },
    spawnTick: 80,
    ...overrides,
  }
}

function weldProjectile(buildId: 1000 | 1009): NativeWeldProjectileState {
  return {
    ageTicks: 1,
    ballLightningAcceleration: null,
    basePresentationPhaseDegrees: buildId === 1009 ? null : 20,
    buildId,
    castPlaybackRate: 1,
    castSoundVariant: buildId === 1009 ? 0 : null,
    charge: 1,
    contactsRemaining: 1,
    damage: 8,
    direction: { x: 1, y: 0 },
    flightTicks: 1,
    frostPulseAspect: null,
    frostPresentationLanes: null,
    frostTurnDegrees: null,
    groundSparkNativeAgeTicks: buildId === 1009 ? 20 : null,
    groundSparkTurnTicksRemaining: buildId === 1009 ? 10 : null,
    headingDegrees: 90,
    hitTargetIds: [],
    id: 9,
    kind: 'weld',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 9 },
    ownerId: 'wizard',
    phase: 'flight',
    position: { x: 10, y: 20 },
    presentationSeed: buildId === 1009 ? 17 : 42,
    projectileIndex: 0,
    reacquiresTarget: false,
    secondaryPresentationPhaseDegrees: null,
    speed: buildId === 1009 ? 4 : 3,
    targetId: null,
    turnAccumulator: 0.01,
    turnInput: buildId === 1009 ? 0 : 2,
    underpowered: false,
    vector: buildId === 1009
      ? [8, 2, 0, 1, 0, 1]
      : [8, 8, 2, 1, 1, 0, 0, 0, 0],
    velocity: { x: buildId === 1009 ? 4 : 3, y: 0 },
    worldKey: 'boneyard:1',
  }
}

function enemy(
  enemyToken: BoneyardEnemySnapshot['enemyToken'],
  overrides: Partial<Omit<BoneyardEnemySnapshot, 'animation' | 'enemyToken'>> & {
    animation?: Partial<BoneyardEnemySnapshot['animation']>
  } = {},
): BoneyardEnemySnapshot {
  return {
    animation: {
      action: null,
      actionProgress: 0,
      alpha: 1,
      bodyPose: 0,
      coffinPose: 0,
      coffinRotationRadians: 0,
      coffinScaleX: 1,
      coffinSecondaryPose: null,
      coffinState: 'closed',
      deathEpoch: 0,
      deathTick: 0,
      demonFrontJointRotationRadians: 0,
      demonFrontLimbRotationRadians: 0,
      demonRearJointRotationRadians: 0,
      demonRearLimbRotationRadians: 0,
      effects: [],
      gaitPose: 0,
      hitFlash: 0,
      impEffectFrame: -1,
      maggots: [],
      state: 'idle',
      stridePhaseDeg: 0,
      verticalOffset: 0,
      zombieAngularOffsetDeg: 0,
      zombieFrontArmPose: 0,
      zombieFrontArmRotationRadians: 0,
      zombieRearArmPose: 0,
      zombieRearArmRotationRadians: 0,
      ...overrides.animation,
    },
    armored: false,
    currentHealth: 5,
    enemyToken,
    flags: [],
    headingDeg: 0,
    id: 23,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    lighting: { charge: 0, glow: 0, providerCopies: 0 },
    mageCloak: false,
    maximumHealth: 5,
    nativeTypeId: 1_001,
    position: { x: 20, y: 30 },
    scale: 1,
    shieldHealth: 0,
    shieldMaximumHealth: 0,
    spawnTick: 1,
    ...overrides,
  }
}

test('anchors the ordinary player light fifteen units along native heading', () => {
  const forward = nativePlayerLightSource({
    headingIndex: 0,
    id: 'player-a',
    lighting: {
      driveActive: false,
      overlayEffectPhase: 0,
    },
    position: { x: 100, y: 200 },
  }, 7, false)!
  assert.equal(forward.intensity, 1)
  assert.equal(forward.castsDirectionalShadow, true)
  assert.deepEqual(forward.position, { x: 100, y: 185 })
  assert.equal(forward.radius, 2.5999999046325684)
  assert.ok(
    forward.rasterScale >= Math.fround(
      NATIVE_PLAYER_LIGHT_RADIUS - Math.fround(NATIVE_PLAYER_LIGHT_RASTER_JITTER),
    )
    && forward.rasterScale <= NATIVE_PLAYER_LIGHT_RADIUS,
  )
  const right = nativePlayerLightSource({
    headingIndex: 6,
    id: 'player-a',
    lighting: {
      driveActive: false,
      overlayEffectPhase: 0,
    },
    position: { x: 100, y: 200 },
  }, 7, false)!
  assert.ok(Math.abs(right.position.x - 115) < 1e-12)
  assert.ok(Math.abs(right.position.y - 200) < 1e-12)
})

test('matches the native player drive/local gate matrix and authoritative overlay radius', () => {
  for (const { driveActive, isLocalPlayer, providerPresent } of [
    { driveActive: false, isLocalPlayer: false, providerPresent: true },
    { driveActive: false, isLocalPlayer: true, providerPresent: true },
    { driveActive: true, isLocalPlayer: false, providerPresent: false },
    { driveActive: true, isLocalPlayer: true, providerPresent: true },
  ]) {
    const source = nativePlayerLightSource({
      headingIndex: 0,
      id: 'player-a',
      lighting: {
        driveActive,
        overlayEffectPhase: 0.25,
      },
      position: { x: 100, y: 200 },
    }, 10, isLocalPlayer)
    assert.equal(
      source !== null,
      providerPresent,
      `drive=${driveActive}, local=${isLocalPlayer}`,
    )
  }

  const localPlayer = {
    headingIndex: 0,
    id: 'player-a',
    lighting: {
      driveActive: true,
      overlayEffectPhase: 0.25,
    },
    position: { x: 100, y: 200 },
  }
  const local = nativePlayerLightSource(localPlayer, 10, true)!
  assert.ok(Math.abs(local.radius - 1.25 * 2.5999999046325684) < 1e-6)
  const nextFrame = nativePlayerLightSource(localPlayer, 11, true)!
  assert.equal(nextFrame.radius, local.radius)
  assert.notEqual(nextFrame.rasterScale, local.rasterScale)
})

test('culls providers against the native camera-relative manager rectangle before admission', () => {
  const source = {
    castsDirectionalShadow: true,
    intensity: 1,
    position: { x: -145, y: 100 },
    radius: 1,
  }
  assert.equal(nativeBoneyardLightVisibleInManager(source, LIGHT_VIEW), false)
  assert.equal(nativeBoneyardLightVisibleInManager({
    ...source,
    position: { x: -144.99, y: 100 },
  }, LIGHT_VIEW), true)
  assert.equal(nativeBoneyardLightVisibleInManager({
    ...source,
    position: { x: 2_145, y: 100 },
  }, LIGHT_VIEW), false)
})

test('pins all strict manager-edge tangencies for wide and portrait zoom-1.35 views', () => {
  const cases = [
    {
      axis: 'x',
      edge: 'left',
      inward: 1,
      inwardSteps: 3,
      position: { x: 62.40740966796875, y: 1076.1573486328125 },
      view: WIDE_ZOOMED_LIGHT_VIEW,
      viewport: 'wide',
    },
    {
      axis: 'x',
      edge: 'right',
      inward: -1,
      inwardSteps: 2,
      position: { x: 1833.888916015625, y: 1076.1573486328125 },
      view: WIDE_ZOOMED_LIGHT_VIEW,
      viewport: 'wide',
    },
    {
      axis: 'y',
      edge: 'top',
      inward: 1,
      inwardSteps: 5,
      position: {
        x: Math.fround(120_740_735 / 100_000),
        y: -28.333335876464844,
      },
      view: WIDE_ZOOMED_LIGHT_VIEW,
      viewport: 'wide',
    },
    {
      axis: 'y',
      edge: 'bottom',
      inward: -1,
      inwardSteps: 1,
      position: { x: 948.1481323242188, y: 2180.648193359375 },
      view: WIDE_ZOOMED_LIGHT_VIEW,
      viewport: 'wide',
    },
    {
      axis: 'x',
      edge: 'left',
      inward: 1,
      inwardSteps: 2,
      position: { x: -94.44444274902344, y: 508.7129821777344 },
      view: PORTRAIT_ZOOMED_LIGHT_VIEW,
      viewport: 'portrait',
    },
    {
      axis: 'x',
      edge: 'right',
      inward: -1,
      inwardSteps: 2,
      position: { x: 556.6666870117188, y: 508.7129821777344 },
      view: PORTRAIT_ZOOMED_LIGHT_VIEW,
      viewport: 'portrait',
    },
    {
      axis: 'y',
      edge: 'top',
      inward: 1,
      inwardSteps: 3,
      position: { x: 231.11111450195312, y: -35.59259033203125 },
      view: PORTRAIT_ZOOMED_LIGHT_VIEW,
      viewport: 'portrait',
    },
    {
      axis: 'y',
      edge: 'bottom',
      inward: -1,
      inwardSteps: 1,
      position: { x: 231.11111450195312, y: 1053.0185546875 },
      view: PORTRAIT_ZOOMED_LIGHT_VIEW,
      viewport: 'portrait',
    },
  ] as const

  const index = new NativeBoneyardLightIndex({ height: 4_000, width: 4_000 })
  for (const edgeCase of cases) {
    for (const castsDirectionalShadow of [false, true]) {
      const tangent: NativeBoneyardLightSource = {
        castsDirectionalShadow,
        intensity: 1,
        position: edgeCase.position,
        radius: 1,
      }
      const inward: NativeBoneyardLightSource = {
        ...tangent,
        position: {
          ...tangent.position,
          [edgeCase.axis]: adjacentFloat32(
            tangent.position[edgeCase.axis],
            edgeCase.inward,
            edgeCase.inwardSteps,
          ),
        },
      }
      const label = [
        edgeCase.viewport,
        edgeCase.edge,
        `Multiple Shadows ${castsDirectionalShadow}`,
      ].join(' ')

      assert.equal(
        nativeBoneyardLightVisibleInManager(tangent, edgeCase.view),
        false,
        `${label} tangent`,
      )
      assert.equal(
        nativeBoneyardLightVisibleInManager(inward, edgeCase.view),
        true,
        `${label} first manager-visible float32`,
      )
      assert.equal(index.rebuild([tangent], [], edgeCase.view).length, 0, `${label} provider`)
      assert.equal(index.rebuild([inward], [], edgeCase.view).length, 1, `${label} provider in`)
      assert.equal(index.rebuild([], [tangent], edgeCase.view).length, 0, `${label} Misc`)
      assert.equal(index.rebuild([], [inward], edgeCase.view).length, 1, `${label} Misc in`)
    }
  }
})

test('manager cull uses analytic radius and never the Region raster scale', () => {
  const position = { x: 62.40741729736328, y: 1335.4166259765625 }
  for (const rasterScale of [0.001, 10_000]) {
    assert.equal(nativeBoneyardLightVisibleInManager({
      castsDirectionalShadow: true,
      intensity: 1,
      position,
      radius: 1,
      rasterScale,
    }, WIDE_ZOOMED_LIGHT_VIEW), false)
  }
  assert.equal(nativeBoneyardLightVisibleInManager({
    castsDirectionalShadow: true,
    intensity: 1,
    position,
    radius: 2,
    rasterScale: 0.001,
  }, WIDE_ZOOMED_LIGHT_VIEW), true)
})

test('normalizes the submitted light ABI to float32 and keeps raster scale separate', () => {
  const index = new NativeBoneyardLightIndex({ height: 600, width: 600 })
  const accepted = index.rebuild([{
    castsDirectionalShadow: true,
    intensity: 0.85,
    position: { x: 0.1, y: -0.1 },
    radius: 0.6,
    rasterScale: 2.6,
  }], [], LIGHT_VIEW)
  assert.deepEqual(accepted, [{
    castsDirectionalShadow: true,
    intensity: Math.fround(0.85),
    position: { x: Math.fround(0.1), y: Math.fround(-0.1) },
    radius: Math.fround(0.6),
    rasterScale: Math.fround(2.6),
  }])

  const submitted = accepted[0]!
  assert.equal(nativeBoneyardLightScalar(submitted.position, index), submitted.intensity)
  assert.equal(nativeBoneyardLightScalar({
    x: submitted.position.x + submitted.radius * 145,
    y: submitted.position.y,
  }, index), 0)
  assert.equal(nativeRegionLightStamp(
    submitted,
    { x: 400, y: 300 },
    { anchorX: 168, anchorY: 153, h: 305, w: 336 },
    1.35,
  ).scale, Math.fround(2.6) * 1.35)

  for (const castsDirectionalShadow of [false, true]) {
    assert.equal(nativeBoneyardLightVisibleInManager({
      castsDirectionalShadow,
      intensity: 1,
      position: { x: -145, y: 100 },
      radius: 1,
      rasterScale: 100,
    }, LIGHT_VIEW), false)
  }
})

test('uses the recovered elliptical plateau, squared falloff, and outer edge', () => {
  const source = [{ intensity: 0.6, position: { x: 0, y: 0 }, radius: 1 }]
  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 0 }, source), 0.6)
  assert.equal(nativeBoneyardLightScalar({ x: 75, y: 0 }, source), 0.6)
  assert.equal(
    nativeBoneyardLightScalar({ x: 100, y: 0 }, source),
    0.6 * (1 - (10_000 - 5_625) / 15_400),
  )
  assert.equal(nativeBoneyardLightScalar({ x: 145, y: 0 }, source), 0)
  assert.ok(nativeBoneyardLightScalar({ x: 0, y: 123.249 }, source) > 0)
  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 123.25 }, source), 0)
})

test('uses independent radial and height maxima for native elevated surfaces', () => {
  const sources = [
    { intensity: 0.8, position: { x: 0, y: -80 }, radius: 10 },
    { intensity: 0.5, position: { x: 0, y: 1 }, radius: 10 },
  ]

  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 0 }, sources), 0.8)
  assert.equal(nativeBoneyardSurfaceLightScalar({ x: 0, y: 0 }, sources), 0.4)
  assert.equal(nativeBoneyardSurfaceLightScalar({ x: 0, y: 0 }, [sources[0]]), (
    0.8 * 0.8 * (1 - 80 * 1.5 / 145)
  ))
})

test('squares one unattenuated source and clamps an overhead source at the height cutoff', () => {
  assert.equal(nativeBoneyardSurfaceLightScalar({ x: 0, y: 0 }, [{
    intensity: 0.5,
    position: { x: 0, y: 1 },
    radius: 10,
  }]), 0.25)
  assert.equal(nativeBoneyardSurfaceLightScalar({ x: 0, y: 145 / 1.5 }, [{
    intensity: 1,
    position: { x: 0, y: 0 },
    radius: 10,
  }]), 0)
})

test('closes every Building and Monument authored lighting row', () => {
  assert.deepEqual(NATIVE_BUILDING_BASE_ENTRIES, [148, 149, 150, 151])
  assert.deepEqual(NATIVE_BUILDING_ROOF_ENTRIES, [152, 153, 154, 155])
  assert.deepEqual(NATIVE_MONUMENT_ENTRIES, Array.from({ length: 21 }, (_, index) => 156 + index))
})

test('builds every native Building query-grid branch in row-major order', () => {
  const sprite = { anchorX: 150, anchorY: 150, h: 300, w: 300 }
  const position = { x: 1_000, y: 2_000 }
  assert.deepEqual(nativeBuildingLightGrid({
    enhancedEffects: true,
    position,
    sprite,
    variant: 0,
  }), [
    { x: 850, y: 1_985 }, { x: 1_000, y: 1_985 }, { x: 1_150, y: 1_985 },
    { x: 850, y: 2_135 }, { x: 1_000, y: 2_135 }, { x: 1_150, y: 2_135 },
    { x: 850, y: 2_150 }, { x: 1_000, y: 2_150 }, { x: 1_150, y: 2_150 },
  ])
  assert.deepEqual(nativeBuildingLightGrid({
    enhancedEffects: true,
    position,
    sprite,
    variant: 1,
  }).map(({ y }) => y), [1_950, 1_950, 1_950, 2_100, 2_100, 2_100, 2_150, 2_150, 2_150])
  for (const variant of [2, 3]) {
    assert.deepEqual(nativeBuildingLightGrid({
      enhancedEffects: true,
      position,
      sprite,
      variant,
    }).map(({ y }) => y), [1_850, 1_850, 1_850, 2_000, 2_000, 2_000, 2_150, 2_150, 2_150])
  }
  assert.deepEqual(nativeBuildingLightGrid({
    enhancedEffects: false,
    position,
    sprite,
    variant: 0,
  }), [
    { x: 850, y: 1_985 }, { x: 1_150, y: 1_985 },
    { x: 850, y: 2_150 }, { x: 1_150, y: 2_150 },
  ])
})

test('matches the native Building tessellator and packed vertex color', () => {
  const enhanced = nativeBuildingMeshGrid(300, 200, true)
  assert.deepEqual([...enhanced.positions], [
    0, 0, 150, 0, 300, 0,
    0, 100, 150, 100, 300, 100,
    0, 200, 150, 200, 300, 200,
  ])
  assert.deepEqual([...enhanced.uvs], [
    0, 0, 0.5, 0, 1, 0,
    0, 0.5, 0.5, 0.5, 1, 0.5,
    0, 1, 0.5, 1, 1, 1,
  ])
  assert.deepEqual([...enhanced.indices], [
    0, 1, 3, 1, 3, 4,
    1, 2, 4, 2, 4, 5,
    3, 4, 6, 4, 6, 7,
    4, 5, 7, 5, 7, 8,
  ])
  assert.deepEqual([...nativeBuildingMeshGrid(300, 200, false).indices], [0, 1, 2, 1, 2, 3])

  const colors = new Uint8Array(5 * 4)
  writeNativeStaticSurfaceVertexColors(colors, [-1, 0, 0.5, 1, 2])
  assert.deepEqual([...colors], [
    0, 0, 0, 255,
    0, 0, 0, 255,
    127, 127, 127, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
  ])
})

test('projects the two native Wall endpoint samples across its retained raster', () => {
  const bounds = { h: 100, w: 200, x: 100, y: 200 }
  assert.deepEqual([...nativeWallSurfaceVertexWeights(
    bounds,
    { x: 100, y: 250 },
    { x: 300, y: 250 },
  )], [0, 1, 0, 1])
  const diagonalWeights = nativeWallSurfaceVertexWeights(
    bounds,
    { x: 100, y: 200 },
    { x: 300, y: 300 },
  )
  assert.deepEqual([...diagonalWeights], [0, Math.fround(0.8), Math.fround(0.2), 1])
  const scalars = new Float32Array(4)
  writeNativeWallVertexScalars(scalars, diagonalWeights, 0.2, 0.8)
  assert.deepEqual([...scalars], [
    Math.fround(0.2),
    Math.fround(0.68),
    Math.fround(0.32),
    Math.fround(0.8),
  ])
})

test('takes the native maximum contribution and keeps signed Lantern flicker cosmetic', () => {
  const sources = [
    { intensity: 0.4, position: { x: 0, y: 0 }, radius: 1 },
    { intensity: 0.7, position: { x: 0, y: 0 }, radius: 1 },
  ]
  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 0 }, sources), 0.7)
  const samples = Array.from({ length: 64 }, (_, frame) => (
    nativeLanternLightSource({ x: 4, y: 5 }, frame).intensity
  ))
  assert.ok(samples.every((sample) => (
    sample >= Math.fround(NATIVE_LANTERN_LIGHT_BASE_INTENSITY - NATIVE_LANTERN_LIGHT_FLICKER)
    && sample <= Math.fround(NATIVE_LANTERN_LIGHT_BASE_INTENSITY + NATIVE_LANTERN_LIGHT_FLICKER)
  )))
  assert.ok(samples.some((sample) => sample < NATIVE_LANTERN_LIGHT_BASE_INTENSITY))
  assert.ok(samples.some((sample) => sample > NATIVE_LANTERN_LIGHT_BASE_INTENSITY))
  assert.ok(new Set(samples).size > 60)
  assert.equal(NATIVE_DEFAULT_MULTIPLE_SHADOWS, true)
  assert.equal(nativeLanternLightSource({ x: 4, y: 5 }, 0).castsDirectionalShadow, true)
  assert.equal(
    nativeLanternLightSource({ x: 4, y: 5 }, 0, false).castsDirectionalShadow,
    false,
  )
  assert.equal(NATIVE_LANTERN_LIGHT_BASE_INTENSITY, 0.55)
  assert.equal(NATIVE_LANTERN_LIGHT_FLICKER, 0.2)
  assert.equal(nativeLanternLightSource({ x: 4, y: 5 }, 0).radius, 0.65)
  assert.deepEqual(nativeLanternLightSource({ x: 4, y: 5 }, 0).position, { x: 4, y: 5 })
})

test('uses the signed stock ranges for shared Missile and Arrow-family providers', () => {
  const missileRadii = Array.from({ length: 128 }, (_, frame) => (
    nativeMissileLightSource({ id: 9, position: { x: 0, y: 0 } }, frame).radius
  ))
  assert.ok(missileRadii.every((radius) => radius >= 0.65 && radius <= 0.85))
  assert.ok(missileRadii.some((radius) => radius < 0.75))
  assert.ok(missileRadii.some((radius) => radius > 0.75))

  const arrowRadii = Array.from({ length: 128 }, (_, frame) => (
    nativeEnemyProjectileLightProvider(enemyProjectile({ payload: 'fire' }), frame)!.source.radius
  ))
  assert.ok(arrowRadii.every((radius) => radius >= 0.25 && radius <= 0.75))
  assert.ok(arrowRadii.some((radius) => radius < 0.5))
  assert.ok(arrowRadii.some((radius) => radius > 0.5))
})

test('uses the shipped Windows quality profile and next-power-of-two Region target', () => {
  assert.equal(NATIVE_DEFAULT_LIGHT_QUALITY, 0.25)
  assert.equal(NATIVE_LOW_CAPABILITY_LIGHT_QUALITY, Math.fround(0.06))
  assert.equal(NATIVE_REGION_LIGHT_WORLD_SCALE, 0.8)
  assert.equal(NATIVE_REGION_LIGHT_BOTTOM_PADDING, 350)
  assert.deepEqual(nativeRegionLightTargetPlan(
    { height: 390, width: 844 },
    2,
  ), {
    logicalSide: 512 / Math.fround(0.4),
    physicalSide: 512,
    renderResolution: Math.fround(0.4),
  })
  assert.deepEqual(nativeRegionLightTargetPlan(
    { height: 801, width: 390 },
    1.25,
  ), {
    logicalSide: 1_024,
    physicalSide: 256,
    renderResolution: 0.25,
  })
  assert.deepEqual(nativeRegionLightTargetPlan(
    { height: 900, width: 1_600 },
    1,
    Math.fround(0.06),
  ), {
    logicalSide: 128 / Math.fround(0.048),
    physicalSide: 128,
    renderResolution: Math.fround(0.048),
  })
  assert.deepEqual(nativeRegionLightTargetPlan(
    { height: 900, width: 1_600 },
    1,
  ), {
    logicalSide: 512 / Math.fround(0.2),
    physicalSide: 512,
    renderResolution: Math.fround(0.2),
  })
})

test('pins the live stock Region manager scale, top-left, and active rectangles', () => {
  assert.deepEqual(nativeRegionLightManagerPlan(WIDE_ZOOMED_LIGHT_VIEW), {
    managerScale: 0.20000000298023224,
    targetHeight: 383.7962951660156,
    targetWidth: 296.2962951660156,
    topLeft: { x: 207.40740966796875, y: 116.66666412353516 },
  })
  assert.deepEqual(nativeRegionLightManagerPlan(
    WIDE_ZOOMED_LIGHT_VIEW,
    NATIVE_LOW_CAPABILITY_LIGHT_QUALITY,
  ), {
    managerScale: 0.04800000041723251,
    targetHeight: 92.1111068725586,
    targetWidth: 71.1111068725586,
    topLeft: { x: 207.40740966796875, y: 116.66666412353516 },
  })
})

test('publishes currently modeled Ether and Earth providers through native defaults', () => {
  const missile = nativeMissileLightSource(
    { id: 9, position: { x: 10, y: 20 } },
    41,
  )
  assert.deepEqual(missile.position, { x: 10, y: 20 })
  assert.equal(missile.intensity, 0.75)
  assert.ok(missile.radius >= Math.fround(0.65) && missile.radius <= Math.fround(0.85))
  assert.equal(missile.castsDirectionalShadow, true)
  assert.deepEqual(nativeBoulderLightSource({
    charge: 0.3,
    position: { x: 30, y: 40 },
  }), {
    castsDirectionalShadow: true,
    intensity: 0.5,
    position: { x: 30, y: 40 },
    radius: 1,
  })
  assert.equal(nativeBoulderLightSource({
    charge: 0.8,
    position: { x: 30, y: 40 },
  }).radius, 1.6)
})

test('Multiple Shadows changes every MS provider without changing literal flags', () => {
  assert.equal(nativeMissileLightSource(
    { id: 9, position: { x: 10, y: 20 } },
    41,
    false,
  ).castsDirectionalShadow, false)
  assert.equal(nativeBoulderLightSource({
    charge: 0.8,
    position: { x: 30, y: 40 },
  }, false).castsDirectionalShadow, false)
  assert.equal(nativeWeldProjectileLightSource(weldProjectile(1000), 41, false)
    .castsDirectionalShadow, false)
  assert.equal(nativeWeldProjectileLightSource(weldProjectile(1009), 41, false)
    .castsDirectionalShadow, false)
  assert.equal(nativePlayerLightSource({
    headingIndex: 0,
    id: 'player',
    lighting: { driveActive: false, overlayEffectPhase: 0 },
    position: { x: 0, y: 0 },
  }, 1, true)?.castsDirectionalShadow, true)
})

test('enemy FireBurst ZAnimLit follows the rising child and fades by 0.04 per tick', () => {
  const provider = nativeEnemyProjectileEffectLightProvider({
    ageTicks: 5,
    alpha: 0.25,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 110,
    id: 52,
    kind: 'fire-burst-glow',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 12 },
    lifetimeTicks: 16,
    ownerActorId: 4,
    ownerProjectileId: 9,
    phaseOriginTicks: 0,
    position: { x: 10, y: 15 },
    rotationRadians: 0,
    scale: 3,
    spawnTick: 10,
    tint: 0xff8000,
  })
  assert.deepEqual(provider, {
    lane: 'transient',
    source: {
      castsDirectionalShadow: false,
      intensity: 0.8000000044703484,
      position: { x: 10, y: 15 },
      radius: 1.5,
    },
  })
})

test('projects every welded projectile and retained-rock light provider exactly', () => {
  const missile = nativeWeldProjectileLightSource(weldProjectile(1000), 41)
  assert.equal(missile.intensity, 0.75)
  assert.equal(missile.castsDirectionalShadow, true)
  assert.ok(missile.radius >= 0.65 && missile.radius <= 0.85)

  const spark = nativeWeldProjectileLightSource(weldProjectile(1009), 41)
  assert.equal(spark.castsDirectionalShadow, false)
  assert.ok(spark.intensity >= 0.5 && spark.intensity <= 1)
  assert.equal(spark.radius, Math.fround(0.4))

  const retained = createNativeWeldPersistentActor({
    buildId: 1006,
    direction: { x: 1, y: 0 },
    id: 8,
    origin: { x: 30, y: 40 },
    ownerId: 'wizard',
    tick: 1,
    vector: [8, 2, 1, 1, 1, 1],
    worldKey: 'boneyard:1',
  })
  assert.equal(retained.buildId, 1006)
  if (retained.buildId !== 1006) throw new Error('expected Ethereal Boulder')
  assert.deepEqual(nativeWeldRockLightSource(retained), {
    castsDirectionalShadow: true,
    intensity: 0.5,
    position: { x: 30, y: 40 },
    radius: 0.5,
  })
  assert.equal(nativeWeldRockLightSource({ ...retained, scale: 1 }).radius, 0.75)

  const meteor = createNativeWeldMeteor({
    bodyScale: 1,
    damage: 8,
    direction: { x: 0, y: -1 },
    fallHeadingDegrees: 0,
    fallHeight: 5,
    fallStep: Math.fround(0.04),
    id: 9,
    impactTicks: 200,
    origin: { x: 30, y: 40 },
    ownerId: 'wizard',
    position: { x: 30, y: 40 },
    privateSeed: 1,
    tick: 1,
    underpowered: false,
    vector: [8, 8, 2, 1, 1, 0, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  assert.equal(nativeWeldMeteorLightSource(meteor), null)
  assert.deepEqual(nativeWeldMeteorLightSource({ ...meteor, fallHeight: 0.5 }), {
    castsDirectionalShadow: false,
    intensity: 0.5,
    position: { x: 30, y: 40 },
    radius: Math.fround(0.6),
  })
  const impact = nativeWeldMeteorLightSource({
    ...meteor,
    fallHeight: 0,
    impactRadiusScalar: 1.25,
    impactTicksRemaining: 25,
    phase: 'impact',
  })
  assert.deepEqual(impact, {
    castsDirectionalShadow: false,
    intensity: 0.5,
    position: { x: 30, y: 40 },
    radius: Math.fround(0.75),
  })
})

test('table-drives every source-family disposition exposed by the pure lighting adapters', () => {
  type SourceLane = 'actor' | 'misc' | 'none' | 'transient'
  interface SourceProjection {
    lane: SourceLane
    sources: readonly NativeBoneyardLightSource[]
  }
  interface SourceFamilyRow {
    directional?: boolean
    expectedCount: number
    expectedLane: SourceLane
    family: string
    project: () => SourceProjection
  }

  const none = (): SourceProjection => ({ lane: 'none', sources: [] })
  const projectSources = (
    lane: Exclude<SourceLane, 'none'>,
    sources: readonly NativeBoneyardLightSource[],
  ): SourceProjection => sources.length === 0 ? none() : { lane, sources }
  const projectPlayer = (driveActive: boolean, isLocalPlayer: boolean): SourceProjection => {
    const source = nativePlayerLightSource({
      headingIndex: 0,
      id: 'player-a',
      lighting: {
        driveActive,
        overlayEffectPhase: 0,
      },
      position: { x: 100, y: 200 },
    }, 12, isLocalPlayer)
    return source ? projectSources('actor', [source]) : none()
  }
  const projectEnemyProjectile = (
    overrides: Partial<BoneyardEnemyProjectileSnapshot>,
  ): SourceProjection => {
    const candidate = nativeEnemyProjectileLightProvider(
      enemyProjectile(overrides),
      12,
    )
    return candidate ? projectSources(candidate.lane, [candidate.source]) : none()
  }

  const fireball: PrimarySpellFireProjectileState = {
    ageTicks: 1,
    charge: 1,
    damage: 4,
    direction: { x: 1, y: 0 },
    flightTicks: 1,
    id: 41,
    kind: 'fire',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 41 },
    ownerId: 'player-a',
    phase: 'flight',
    position: { x: 400, y: 300 },
    velocity: { x: 4.5, y: 0 },
    worldKey: 'boneyard:run',
  }
  const etherImpact: PrimarySpellEtherImpactState = {
    ageTicks: 0,
    birthTick: 20,
    id: 42,
    kind: 'ether-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 42 },
    origin: { x: 400, y: 300 },
    ownerId: 'player-a',
    worldKey: 'boneyard:run',
  }
  const fireImpact: PrimarySpellFireImpactState = {
    ageTicks: 0,
    id: 43,
    kind: 'fire-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 43 },
    origin: { x: 400, y: 300 },
    ownerId: 'player-a',
    worldKey: 'boneyard:run',
  }
  const airPathInput = {
    birthTick: 20,
    endpoint: { x: 650, y: 0 },
    id: 44,
    midpoint: { x: 350, y: 0 },
    origin: { x: 0, y: 0 },
  }
  const magePulse = nativeMageLightningPulsePlan({
    contact: { kind: 'world', position: { x: 650, y: 0 } },
    endpoint: { x: 650, y: 0 },
    midpoint: { x: 350, y: 0 },
    seed: 45,
    source: { x: 0, y: 0 },
    tick: 20,
  }, 20)!

  const rows: readonly SourceFamilyRow[] = [
    {
      directional: true,
      expectedCount: 1,
      expectedLane: 'actor',
      family: 'ordinary player',
      project: () => projectPlayer(false, false),
    },
    {
      expectedCount: 0,
      expectedLane: 'none',
      family: 'remote driven player',
      project: () => projectPlayer(true, false),
    },
    {
      directional: true,
      expectedCount: 1,
      expectedLane: 'actor',
      family: 'Lantern',
      project: () => projectSources(
        'actor',
        [nativeLanternLightSource({ x: 400, y: 300 }, 12)],
      ),
    },
    ...([
      ['SKELETON', true, { charge: 0, glow: 1, providerCopies: 1 }],
      ['SKELETONARCHER', true, { charge: 1, glow: 0, providerCopies: 1 }],
      ['SKELETONMAGE', true, { charge: 1, glow: 0, providerCopies: 1 }],
      ['IMP', false, { charge: 0, glow: 1, providerCopies: 1 }],
      ['WRAITH', true, { charge: 0, glow: 1, providerCopies: 1 }],
      ['DEMON', true, { charge: 0, glow: 0, providerCopies: 1 }],
      ['COFFIN', true, { charge: 0, glow: 0, providerCopies: 1 }],
    ] as const).map(([enemyToken, directional, lighting]): SourceFamilyRow => ({
      directional,
      expectedCount: 1,
      expectedLane: 'actor',
      family: `enemy ${enemyToken}`,
      project: () => projectSources(
        'actor',
        nativeEnemyLightSources(enemy(enemyToken, { lighting }), 12),
      ),
    })),
    {
      expectedCount: 0,
      expectedLane: 'none',
      family: 'enemy ZOMBIE',
      project: () => projectSources('actor', nativeEnemyLightSources(enemy('ZOMBIE', {
        lighting: { charge: 1, glow: 1, providerCopies: 1 },
      }), 12)),
    },
    {
      directional: true,
      expectedCount: 1,
      expectedLane: 'actor',
      family: 'Earth Boulder',
      project: () => projectSources('actor', [nativeBoulderLightSource({
        charge: 1,
        position: { x: 400, y: 300 },
      })]),
    },
    {
      directional: true,
      expectedCount: 1,
      expectedLane: 'actor',
      family: 'Ether Magic Missile',
      project: () => projectSources('actor', [nativeMissileLightSource({
        id: 40,
        position: { x: 400, y: 300 },
      }, 12)]),
    },
    {
      directional: true,
      expectedCount: 1,
      expectedLane: 'actor',
      family: 'Fireball',
      project: () => projectSources('actor', [nativeFireballLightSource(fireball, 12)]),
    },
    ...([
      ['enemy arrow normal', 'none', false, { payload: 'normal' }],
      ['enemy arrow poison', 'none', false, { payload: 'poison' }],
      ['enemy arrow fire', 'transient', false, { payload: 'fire' }],
      ['enemy firebolt', 'transient', false, {
        kind: 'firebolt', nativeTypeId: 0x7eb, payload: 'fire',
      }],
      ['enemy guided cold', 'actor', true, {
        kind: 'guided-missile', nativeTypeId: 0x7ec, payload: 'cold',
      }],
      ['enemy guided poison', 'actor', true, {
        kind: 'guided-missile', nativeTypeId: 0x7ec, payload: 'poison',
      }],
      ['enemy DemonBomb', 'actor', false, {
        kind: 'demon-bomb', nativeTypeId: 0x7f7, payload: 'none',
      }],
      ['enemy PoisonPool', 'none', false, {
        kind: 'poison-pool', nativeTypeId: 0x806, payload: 'poison',
      }],
    ] as const).map(([family, expectedLane, directional, overrides]): SourceFamilyRow => ({
      ...(expectedLane === 'none' ? {} : { directional }),
      expectedCount: expectedLane === 'none' ? 0 : 1,
      expectedLane,
      family,
      project: () => projectEnemyProjectile(overrides),
    })),
    {
      directional: false,
      expectedCount: 1,
      expectedLane: 'transient',
      family: 'enemy FireBurst ZAnimLit',
      project: () => {
        const provider = nativeEnemyProjectileEffectLightProvider({
          ageTicks: 5,
          alpha: 0.25,
          atlas: 'BadGuys',
          blendMode: 'normal',
          entry: 110,
          id: 52,
          kind: 'fire-burst-glow',
          lightRegistration: { managerLane: 'transient', registrationOrdinal: 12 },
          lifetimeTicks: 16,
          ownerActorId: 4,
          ownerProjectileId: 9,
          phaseOriginTicks: 0,
          position: { x: 400, y: 300 },
          rotationRadians: 0,
          scale: 3,
          spawnTick: 10,
          tint: 0xff8000,
        })
        return provider ? projectSources(provider.lane, [provider.source]) : none()
      },
    },
    {
      directional: false,
      expectedCount: 1,
      expectedLane: 'transient',
      family: 'Air contact ZAnimLit',
      project: () => {
        const source = buildNativeAirContactLightSource({
          ageTicks: 0,
          endpoint: { x: 650, y: 0 },
          id: 44,
          origin: { x: 0, y: 0 },
        })
        return source ? projectSources('transient', [source]) : none()
      },
    },
    {
      expectedCount: 0,
      expectedLane: 'none',
      family: 'expired Air contact ZAnimLit',
      project: () => {
        const source = buildNativeAirContactLightSource({
          ageTicks: 5,
          endpoint: { x: 650, y: 0 },
          id: 44,
          origin: { x: 0, y: 0 },
        })
        return source ? projectSources('transient', [source]) : none()
      },
    },
    {
      directional: true,
      expectedCount: 5,
      expectedLane: 'misc',
      family: 'Air factory path MiscLights',
      project: () => projectSources('misc', buildNativeAirPathLightSources(airPathInput)),
    },
    {
      directional: false,
      expectedCount: 1,
      expectedLane: 'transient',
      family: 'Ether impact ZAnimLit',
      project: () => projectSources('transient', [etherPrimaryImpactLightSource(etherImpact)]),
    },
    {
      directional: false,
      expectedCount: 1,
      expectedLane: 'transient',
      family: 'Fire impact provider',
      project: () => projectSources('transient', [nativeFireImpactLightSource(fireImpact)]),
    },
    {
      directional: true,
      expectedCount: 5,
      expectedLane: 'misc',
      family: 'Mage Air factory path MiscLights',
      project: () => projectSources('misc', magePulse.pathLights),
    },
  ]

  assert.equal(new Set(rows.map(({ family }) => family)).size, rows.length)
  for (const row of rows) {
    const projection = row.project()
    assert.equal(projection.lane, row.expectedLane, `${row.family} lane`)
    assert.equal(projection.sources.length, row.expectedCount, `${row.family} count`)
    if (row.directional !== undefined) {
      assert.ok(
        projection.sources.every(({ castsDirectionalShadow }) => (
          castsDirectionalShadow === row.directional
        )),
        `${row.family} Multiple Shadows`,
      )
    }
  }
})

test('exhaustively maps modeled enemy projectiles onto native provider lanes', () => {
  assert.equal(nativeEnemyProjectileLightProvider(enemyProjectile(), 11), null)
  assert.equal(nativeEnemyProjectileLightProvider(enemyProjectile({
    payload: 'poison',
  }), 11), null)

  const fireArrow = nativeEnemyProjectileLightProvider(enemyProjectile({
    payload: 'fire',
  }), 11)
  assert.equal(fireArrow?.lane, 'transient')
  assert.equal(fireArrow?.source.castsDirectionalShadow, false)
  assert.equal(fireArrow?.source.intensity, 0.85)
  assert.deepEqual(fireArrow?.source.position, { x: 31, y: 47 })
  assert.ok(fireArrow!.source.radius >= 0.25 && fireArrow!.source.radius <= 0.75)

  const firebolt = nativeEnemyProjectileLightProvider(enemyProjectile({
    kind: 'firebolt',
    nativeTypeId: 0x7eb,
    payload: 'fire',
  }), 11)
  assert.equal(firebolt?.lane, 'transient')
  assert.equal(firebolt?.source.intensity, 0.85)
  assert.ok(firebolt!.source.radius >= 0.25 && firebolt!.source.radius <= 0.75)

  for (const payload of ['cold', 'poison'] as const) {
    const guided = nativeEnemyProjectileLightProvider(enemyProjectile({
      kind: 'guided-missile',
      nativeTypeId: 0x7ec,
      payload,
    }), 11, false)
    assert.equal(guided?.lane, 'actor')
    assert.equal(guided?.source.castsDirectionalShadow, false)
    assert.equal(guided?.source.intensity, 0.75)
    assert.ok(guided!.source.radius >= Math.fround(0.65))
    assert.ok(guided!.source.radius <= Math.fround(0.85))
  }

  const bomb = nativeEnemyProjectileLightProvider(enemyProjectile({
    kind: 'demon-bomb',
    nativeTypeId: 0x7f7,
    payload: 'none',
  }), 11)
  assert.equal(bomb?.lane, 'actor')
  assert.equal(bomb?.source.castsDirectionalShadow, false)
  assert.equal(bomb?.source.radius, 0.6)
  assert.ok(bomb!.source.intensity >= 0.75 && bomb!.source.intensity <= 1)

  assert.equal(nativeEnemyProjectileLightProvider(enemyProjectile({
    kind: 'poison-pool',
    nativeTypeId: 0x806,
    payload: 'poison',
  }), 11), null)
})

test('exhaustively projects every modeled enemy provider family and duplicate enrollment', () => {
  assert.deepEqual(nativeEnemyLightSources(enemy('ZOMBIE', {
    lighting: { charge: 1, glow: 1, providerCopies: 2 },
  }), 12), [])

  const skeleton = nativeEnemyLightSources(enemy('SKELETON', {
    lighting: { charge: 0, glow: 0.8, providerCopies: 1 },
  }), 12)
  assert.equal(skeleton.length, 1)
  assert.equal(skeleton[0]!.radius, 0.5)
  assert.ok(skeleton[0]!.intensity >= 0.4 && skeleton[0]!.intensity <= 0.8)
  assert.equal(skeleton[0]!.castsDirectionalShadow, true)

  for (const enemyToken of ['SKELETONARCHER', 'SKELETONMAGE'] as const) {
    const charged = nativeEnemyLightSources(enemy(enemyToken, {
      lighting: { charge: 0.8, glow: 0, providerCopies: 1 },
    }), 12)
    assert.equal(charged.length, 1)
    assert.ok(charged[0]!.radius >= 0.32 && charged[0]!.radius <= 0.48)
    assert.equal(charged[0]!.intensity, Math.fround(0.75 * Math.fround(0.8)))

    const burning = nativeEnemyLightSources(enemy(enemyToken, {
      flags: ['FLAG_BURNING'],
      lighting: { charge: 1, glow: 0.7, providerCopies: 2 },
    }), 12)
    assert.equal(burning.length, 2)
    assert.ok(burning.every((source) => source.radius === 0.5))
    assert.ok(burning.every((source) => (
      source.intensity >= 0.35 && source.intensity <= 0.7
    )))
  }

  const imp = nativeEnemyLightSources(enemy('IMP', {
    lighting: { charge: 0, glow: 0.6, providerCopies: 1 },
  }), 12)
  assert.ok(imp[0]!.radius >= 0.15 && imp[0]!.radius <= 0.35)
  assert.ok(imp[0]!.intensity >= 0.45 && imp[0]!.intensity <= 0.6)
  assert.equal(imp[0]!.castsDirectionalShadow, false)

  const wraith = nativeEnemyLightSources(enemy('WRAITH', {
    lighting: { charge: 0, glow: 0.9, providerCopies: 1 },
  }), 12)
  assert.equal(wraith[0]!.radius, 0.5)
  assert.ok(wraith[0]!.intensity >= 0.45 && wraith[0]!.intensity <= 0.9)

  const demonAlive = nativeEnemyLightSources(enemy('DEMON', {
    lighting: { charge: 0, glow: 0, providerCopies: 1 },
  }), 12)
  assert.ok(demonAlive[0]!.radius >= 1.25 && demonAlive[0]!.radius <= 1.75)
  assert.equal(demonAlive[0]!.intensity, 1)
  const demonDeath = nativeEnemyLightSources(enemy('DEMON', {
    animation: { state: 'death' },
    lighting: { charge: 0, glow: 0, providerCopies: 1 },
  }), 12)
  assert.ok(demonDeath[0]!.intensity >= 0.5 && demonDeath[0]!.intensity <= 1)

  const coffin = nativeEnemyLightSources(enemy('COFFIN', {
    animation: { coffinState: 'open' },
    lighting: { charge: 0, glow: 0, providerCopies: 1 },
  }), 12)
  assert.equal(coffin[0]!.radius, 0.65)
  assert.ok(coffin[0]!.intensity >= 0.2 && coffin[0]!.intensity <= 1)
  const coffinIntensities = Array.from({ length: 512 }, (_, frame) => (
    nativeEnemyLightSources(enemy('COFFIN', {
      lighting: { charge: 0, glow: 0, providerCopies: 1 },
    }), frame)[0]!.intensity
  ))
  const nativeCoffinDomain = new Set(Array.from({ length: 9 }, (_, value) => (
    Math.fround(1 - value * 0.1)
  )))
  assert.ok(coffinIntensities.every((intensity) => nativeCoffinDomain.has(intensity)))

  const portal = nativeEnemyLightSources(enemy('PORTAL', {
    animation: { alpha: 0.6 },
    lighting: { charge: 0.6, glow: 0.6, providerCopies: 1 },
  }), 12, true)
  assert.equal(portal[0]!.radius, Math.fround(0.6))
  assert.ok(portal[0]!.intensity >= 0.54 && portal[0]!.intensity <= 0.75)
  assert.equal(portal[0]!.castsDirectionalShadow, true)
})

test('keeps projectile provider randomness presentation-owned and lane ordering explicit', () => {
  const projectile = enemyProjectile({ payload: 'fire' })
  assert.deepEqual(
    nativeEnemyProjectileLightProvider(projectile, 20),
    nativeEnemyProjectileLightProvider(projectile, 20),
  )
  assert.notEqual(
    nativeEnemyProjectileLightProvider(projectile, 20)?.source.radius,
    nativeEnemyProjectileLightProvider(projectile, 21)?.source.radius,
  )

  const inputs = [
    enemyProjectile({ id: 1, kind: 'firebolt', nativeTypeId: 0x7eb, payload: 'fire' }),
    enemyProjectile({ id: 2, kind: 'guided-missile', nativeTypeId: 0x7ec, payload: 'cold' }),
    enemyProjectile({ id: 3, kind: 'demon-bomb', nativeTypeId: 0x7f7, payload: 'fire' }),
    enemyProjectile({ id: 4, payload: 'fire' }),
  ]
  const candidates = inputs.map((input) => (
    nativeEnemyProjectileLightProvider(input, 20)!
  ))
  assert.deepEqual(
    candidates.filter(({ lane }) => lane === 'actor').map(({ source }) => source.position),
    [inputs[1]!.position, inputs[2]!.position],
  )
  assert.deepEqual(
    candidates.filter(({ lane }) => lane === 'transient').map(({ source }) => source.position),
    [inputs[0]!.position, inputs[3]!.position],
  )
})

test('preserves the native ordered containment gate for overlapping sources', () => {
  const dominant = {
    intensity: 1,
    castsDirectionalShadow: true,
    position: { x: 0, y: 0 },
    radius: 2,
  }
  const contained = {
    intensity: 0.8,
    castsDirectionalShadow: false,
    position: { x: 144, y: 0 },
    radius: 1,
  }
  const accepted = nativeAcceptedBoneyardLightSources([dominant, contained], [])
  assert.deepEqual(accepted, [dominant])

  const boundary = { ...contained, position: { x: 145, y: 0 } }
  assert.deepEqual(
    nativeAcceptedBoneyardLightSources([dominant, boundary], []),
    [dominant, boundary],
  )
  assert.deepEqual(
    nativeAcceptedBoneyardLightSources([
      dominant,
      { ...contained, intensity: 1.1 },
      { ...contained, castsDirectionalShadow: true },
    ], []),
    [
      dominant,
      { ...contained, intensity: 1.1 },
      { ...contained, castsDirectionalShadow: true },
    ],
  )
})

test('applies false-Multiple-Shadows containment to the ordered Misc tail', () => {
  const provider: NativeBoneyardLightSource = {
    castsDirectionalShadow: true,
    intensity: 1,
    position: { x: 800, y: 450 },
    radius: 2,
  }
  const containedMisc: NativeBoneyardLightSource = {
    castsDirectionalShadow: false,
    intensity: 0.8,
    position: { x: 944, y: 450 },
    radius: 1,
  }
  const boundaryMisc: NativeBoneyardLightSource = {
    ...containedMisc,
    position: { x: 945, y: 450 },
  }
  const index = new NativeBoneyardLightIndex({ height: 1_600, width: 1_600 })

  assert.deepEqual(
    index.rebuild([provider], [containedMisc, boundaryMisc], LIGHT_VIEW),
    [provider, { ...boundaryMisc, intensity: Math.fround(boundaryMisc.intensity) }],
  )
})

test('reuses the finite generation-tagged native light grid without changing scalar output', () => {
  assert.equal(NATIVE_LIGHT_GRID_CELL_SIZE, 150)
  const index = new NativeBoneyardLightIndex({ height: 600, width: 600 })
  const dominant = {
    intensity: 1,
    castsDirectionalShadow: true,
    position: { x: -151, y: 149 },
    radius: 2,
  }
  const contained = {
    intensity: 0.8,
    castsDirectionalShadow: false,
    position: { x: -7, y: 149 },
    radius: 1,
  }
  const tail = {
    intensity: Math.fround(0.4),
    castsDirectionalShadow: true,
    position: { x: 301, y: -1 },
    radius: 0.75,
  }
  const accepted = index.rebuild([dominant, contained], [tail], LIGHT_VIEW)
  assert.deepEqual(accepted, [dominant, tail])
  assert.equal(index.acceptedSources, accepted)
  assert.ok(index.activeBucketCount > 0)
  assert.ok(index.indexedSourceReferenceCount >= index.activeBucketCount)

  const probes = [
    { x: -151, y: 149 },
    { x: -1, y: 149 },
    { x: 0, y: 149 },
    { x: 299, y: -1 },
    { x: 450, y: -1 },
  ]
  for (const probe of probes) {
    assert.equal(
      index.scalarAt(probe),
      nativeBoneyardLightScalar(probe, accepted),
    )
    assert.equal(
      nativeBoneyardLightScalar(probe, index),
      nativeBoneyardLightScalar(probe, accepted),
    )
  }

  const allocated = index.allocatedBucketCount
  index.rebuild([{ ...tail, position: { x: 310, y: 3 } }], [], LIGHT_VIEW)
  assert.equal(index.acceptedSources.length, 1)
  assert.equal(index.scalarAt(dominant.position), 0)
  assert.equal(index.allocatedBucketCount, allocated)
})

test('uses native float32 truncation, two-cell padding, and finite grid bounds', () => {
  const index = new NativeBoneyardLightIndex({ height: 300, width: 300 })
  index.rebuild([{
    castsDirectionalShadow: true,
    intensity: 1,
    position: { x: 1, y: 1 },
    radius: 0.001,
  }], [], LIGHT_VIEW)

  // Native truncates -1/150 toward zero, so this is the same logical cell as +1.
  assert.deepEqual(index.sourceIndicesAt({ x: -1, y: -1 }), [0])
  // A 300-unit world allocates ceil(300/150)+4 cells: logical -2..3.
  assert.deepEqual(index.sourceIndicesAt({ x: 600, y: 1 }), [])

  index.rebuild([{
    castsDirectionalShadow: true,
    intensity: 1,
    position: { x: -500, y: 1 },
    radius: 0.001,
  }], [], {
    camera: { x: 200, y: 450, zoom: 1 },
    viewport: LIGHT_VIEW.viewport,
  })
  assert.deepEqual(index.sourceIndicesAt({ x: -449.99, y: 1 }), [0])
  assert.deepEqual(index.sourceIndicesAt({ x: -450, y: 1 }), [])

  index.rebuild([{
    castsDirectionalShadow: true,
    intensity: 1,
    position: { x: 599.8, y: 1 },
    radius: 0.001,
  }], [], LIGHT_VIEW)
  assert.deepEqual(index.sourceIndicesAt({ x: 599.99, y: 1 }), [0])
  assert.deepEqual(index.sourceIndicesAt({ x: 600, y: 1 }), [])
})

test('projects the scalar into the renderer grayscale tint lane', () => {
  assert.equal(nativeBoneyardLightTint(0), 0x000000)
  assert.equal(nativeBoneyardLightTint(0.5), 0x7f7f7f)
  assert.equal(nativeBoneyardLightTint(1), 0xffffff)
})

test('stamps the recovered Region light glyph before the native main queue', () => {
  assert.equal(NATIVE_REGION_LIGHT_ATLAS, 'DeadHawg')
  assert.equal(NATIVE_REGION_LIGHT_ENTRY, 18)
  assert.ok(0 < NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX)
  assert.ok(NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX < 1)
  assert.deepEqual(nativeRegionLightStamp(
    {
      intensity: 0.6,
      position: { x: 40, y: 50 },
      radius: 1.4,
      rasterScale: 0.65,
    },
    { x: 400, y: 300 },
    { anchorX: 168, anchorY: 153, h: 305, w: 336 },
    1.35,
  ), {
    alpha: 0.6,
    anchorX: 0.5,
    anchorY: 153 / 305,
    scale: 0.8775000000000001,
    x: 400,
    y: 300,
  })
})

test('world-weather lanes straddle the native Region composite in both lighting branches', () => {
  const complex = nativeBoneyardWeatherLightingOrder(40, true)
  assert.equal(complex.lightCompositeZIndex, NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX)
  assert.ok(complex.splashZIndex < complex.lightCompositeZIndex)
  assert.ok(complex.lightCompositeZIndex < complex.streakZIndex)

  const flattened = nativeBoneyardWeatherLightingOrder(40, false)
  assert.equal(flattened.splashZIndex, complex.splashZIndex)
  assert.equal(flattened.streakZIndex, complex.streakZIndex)
  assert.ok(flattened.splashZIndex < flattened.streakZIndex)
  assert.ok(flattened.streakZIndex < flattened.lightCompositeZIndex)
})

test('keeps Solomon body outside its local light scope and samples Flydirt and lantern', () => {
  assert.deepEqual(nativeSolomonSetPieceLighting(
    { x: 0, y: 0 },
    { x: 300, y: 300 },
    [{ intensity: 1, position: { x: 0, y: 0 }, radius: 1 }],
  ), {
    bodyTint: 0xffffff,
    dirtTint: 0xfcfcfc,
    lanternTint: 0x000000,
  })

  assert.deepEqual(nativeSolomonSetPieceLighting(
    { x: 100, y: 100 },
    { x: 400, y: 400 },
    [{ intensity: 1, position: { x: 78, y: 38 }, radius: 1 }],
  ), {
    bodyTint: 0xffffff,
    dirtTint: 0xffffff,
    lanternTint: 0x000000,
  })
})
