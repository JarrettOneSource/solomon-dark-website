import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import type {
  NativeWeldBoulderDebrisActorState,
  NativeWeldChannelActorState,
  NativeWeldEtherealBoulderState,
  NativeWeldFrostFadeActorState,
  NativeWeldHailRockFadeActorState,
  NativeWeldHailstonesState,
  NativeWeldImpactActorState,
  NativeWeldMeteorActorState,
  NativeWeldMeteorFlashActorState,
  NativeWeldProjectileState,
} from '../core-kernels/native-weld-primary-runtime.ts'
import type {
  NativeWeldHailFlashState,
  NativeWeldHailLineState,
  NativeWeldHailTerrainBouncerState,
  NativeWeldHailTerrainParticleState,
} from '../core-kernels/native-weld-hail-contact.ts'
import type { NativeWeldFlameLashFadeState } from '../core-kernels/native-weld-flame-lash.ts'
import {
  nativeWeldBlizzardBeamPlan,
  type NativeWeldBlizzardGlowState,
} from '../core-kernels/native-weld-blizzard.ts'
import type { NativeWeldMeteorMarkerState } from '../core-kernels/native-weld-meteor.ts'
import type { NativeWeldSteamActorState } from '../core-kernels/native-weld-steam.ts'
import {
  nativeElementVfxPlanAtPhase,
  type NativeElement,
} from '../element-vfx-native.ts'
import { earthBoulderPresentationPlan } from './earth-boulder-presentation.ts'
import { nativeFireballPlan } from './primary-spell-fire-native.ts'
import {
  AIR_LIGHTNING_BRANCH_RECORDS,
  buildNativeAirCoronaPlan,
  buildNativeAirRibbonLayer,
} from './primary-spell-air-native.ts'
import {
  nativeEnemySpriteRegistration,
  type NativeEnemySpriteRegistration,
} from './native-enemy-sprite-registration.ts'

const DEG = Math.PI / 180

export const NATIVE_WELD_BADGUYS_RECORDS = Object.freeze([
  5, 6, 15, 16, 18, 31, 32, 35, 43, 44, 45, 50, 51, 67, 70, 71, 76, 86, 87,
  110, 111, 112,
  168, 169, 170, 171,
  ...integerRange(251, 266),
  ...integerRange(271, 282),
  ...AIR_LIGHTNING_BRANCH_RECORDS,
  ...integerRange(1836, 1839),
  ...integerRange(2008, 2010),
] as const)

export type NativeWeldBadGuysRecord = typeof NATIVE_WELD_BADGUYS_RECORDS[number]

export const NATIVE_WELD_DEADHAWG_RECORDS = Object.freeze([19] as const)
export type NativeWeldDeadHawgRecord = typeof NATIVE_WELD_DEADHAWG_RECORDS[number]
export type NativeWeldAtlas = 'BadGuys' | 'DeadHawg'
export type NativeWeldRecord = NativeWeldBadGuysRecord | NativeWeldDeadHawgRecord

export const NATIVE_WELD_SPRITES = Object.freeze(Object.fromEntries(
  NATIVE_WELD_BADGUYS_RECORDS.map((record) => [
    record,
    nativeEnemySpriteRegistration('BadGuys', record),
  ]),
)) as Readonly<Record<NativeWeldBadGuysRecord, NativeEnemySpriteRegistration>>

export const NATIVE_WELD_DEADHAWG_SPRITES = Object.freeze(Object.fromEntries(
  NATIVE_WELD_DEADHAWG_RECORDS.map((record) => [
    record,
    nativeEnemySpriteRegistration('DeadHawg', record),
  ]),
)) as Readonly<Record<NativeWeldDeadHawgRecord, NativeEnemySpriteRegistration>>

export type NativeWeldPresentationState =
  | NativeWeldProjectileState
  | Extract<PrimarySpellTransientState, {
      kind:
        | 'weld-blizzard-glow'
        | 'weld-boulder-debris'
        | 'weld-channel'
        | 'weld-frost-fade'
        | 'weld-flame-lash-fade'
        | 'weld-ground-spark-fade'
        | 'weld-hail-flash'
        | 'weld-hail-knockback'
        | 'weld-hail-line'
        | 'weld-hail-rock-fade'
        | 'weld-hail-terrain-bouncer'
        | 'weld-hail-terrain-particle'
        | 'weld-impact'
        | 'weld-meteor'
        | 'weld-meteor-flash'
        | 'weld-meteor-marker'
        | 'weld-persistent'
        | 'weld-steam'
    }>

export interface NativeWeldSpriteDraw {
  readonly alpha: number
  readonly atlas: NativeWeldAtlas
  readonly blend: 'add' | 'normal'
  readonly matrix: NativeWeldAffineMatrix | null
  readonly offset: Readonly<{ x: number; y: number }>
  readonly record: NativeWeldRecord
  readonly role: string
  readonly rotationRadians: number
  readonly scaleX: number
  readonly scaleY: number
  readonly tint: number
}

export interface NativeWeldAffineMatrix {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly tx: number
  readonly ty: number
}

export interface NativeWeldMeshDraw {
  readonly alpha: number
  readonly blend: 'add' | 'normal'
  readonly indices: readonly number[]
  readonly record: NativeWeldBadGuysRecord
  readonly role: string
  readonly tint: number
  readonly uvs: readonly number[]
  readonly vertices: readonly number[]
}

export interface NativeWeldLineDraw {
  readonly alpha: number
  readonly color: number
  readonly end: Readonly<{ x: number; y: number }>
  readonly role: string
  readonly start: Readonly<{ x: number; y: number }>
  readonly width: number
}

export interface NativeWeldVisualPlan {
  readonly lines: readonly NativeWeldLineDraw[]
  readonly meshes: readonly NativeWeldMeshDraw[]
  readonly position: Readonly<{ x: number; y: number }>
  readonly regionLightPoint: Readonly<{ x: number; y: number }> | null
  readonly sortBias: number
  readonly sprites: readonly NativeWeldSpriteDraw[]
  readonly worldY: number
}

export function isNativeWeldPresentationState(
  state: PrimarySpellProjectileState | PrimarySpellTransientState,
): state is NativeWeldPresentationState {
  return state.kind === 'weld'
    || state.kind === 'weld-blizzard-glow'
    || state.kind === 'weld-boulder-debris'
    || state.kind === 'weld-channel'
    || state.kind === 'weld-frost-fade'
    || state.kind === 'weld-flame-lash-fade'
    || state.kind === 'weld-ground-spark-fade'
    || state.kind === 'weld-hail-flash'
    || state.kind === 'weld-hail-knockback'
    || state.kind === 'weld-hail-line'
    || state.kind === 'weld-hail-rock-fade'
    || state.kind === 'weld-hail-terrain-bouncer'
    || state.kind === 'weld-hail-terrain-particle'
    || state.kind === 'weld-impact'
    || state.kind === 'weld-meteor'
    || state.kind === 'weld-meteor-flash'
    || state.kind === 'weld-meteor-marker'
    || state.kind === 'weld-persistent'
    || state.kind === 'weld-steam'
}

export function nativeWeldVisualPlan(
  state: NativeWeldPresentationState,
  presentationFrame = Math.floor(state.ageTicks),
): NativeWeldVisualPlan {
  switch (state.kind) {
    case 'weld': return projectilePlan(state, presentationFrame)
    case 'weld-blizzard-glow': return blizzardGlowPlan(state, presentationFrame)
    case 'weld-boulder-debris': return debrisPlan(state)
    case 'weld-channel': return channelPlan(state)
    case 'weld-frost-fade': return frostFadePlan(state, presentationFrame)
    case 'weld-flame-lash-fade': return flameLashFadePlan(state, presentationFrame)
    case 'weld-ground-spark-fade': return positioned(state.position, [sprite(
      state.record,
      'ground-spark-fade',
      {
        alpha: state.alpha,
        rotationRadians: state.rotationDegrees * DEG,
        scaleX: state.scale,
        scaleY: state.scale,
      },
    )])
    case 'weld-hail-flash': return hailFlashPlan(state)
    case 'weld-hail-knockback': return empty(state.origin)
    case 'weld-hail-line': return hailLinePlan(state)
    case 'weld-hail-rock-fade': return hailRockFadePlan(state)
    case 'weld-hail-terrain-bouncer': return hailTerrainBouncerPlan(state)
    case 'weld-hail-terrain-particle': return hailTerrainParticlePlan(state)
    case 'weld-impact': return impactPlan(state, presentationFrame)
    case 'weld-meteor': return meteorPlan(state, presentationFrame)
    case 'weld-meteor-flash': return meteorFlashPlan(state)
    case 'weld-meteor-marker': return markerPlan(state)
    case 'weld-persistent':
      if (state.buildId === 1006) return etherealBoulderPlan(state, presentationFrame)
      if (state.buildId === 1008) return hailstonesPlan(state, presentationFrame)
      return empty(state.origin)
    case 'weld-steam': return steamPlan(state)
  }
}

function projectilePlan(
  state: NativeWeldProjectileState,
  frame: number,
): NativeWeldVisualPlan {
  if (state.buildId === 1000) {
    const plan = nativeFireballPlan({
      ...state,
      burnDamage: 0,
      emberDamage: state.vector[7] ?? 0,
      emberFragments: state.vector[8] ?? 0,
      explodeDamage: state.vector[5] ?? 0,
      explodeRadius: state.vector[6] ?? 0,
      kind: 'fire',
      privateSeed: state.presentationSeed ?? 0,
      spentEmber: { kind: 'none' },
    }, frame)
    return positioned(state.position, plan.draws.map((draw) => sprite(
      draw.frame as NativeWeldBadGuysRecord,
      `fire-missile-${draw.pass}`,
      {
        alpha: draw.alpha,
        blend: draw.blend,
        offset: { x: draw.x, y: draw.y },
        rotationRadians: draw.rotation,
        scaleX: draw.scaleX,
        scaleY: draw.scaleY,
        tint: draw.tint,
      },
    )), { regionLightPoint: state.position })
  }
  if (state.buildId === 1001) {
    const alphaFactor = state.underpowered ? 0.5 : 1
    const age = state.ageTicks
    const body = sprite(
      (271 + Math.floor(age / 4) % 12) as NativeWeldBadGuysRecord,
      'frost-missile-body',
      {
        alpha: alphaFactor * (0.75 + visualUnit(state.id, frame, 0) * 0.25),
        rotationRadians: age * DEG,
        scaleX: 1.7,
        scaleY: 1.7,
      },
    )
    const lanes = state.frostPresentationLanes!.map((lane, index) => sprite(
      16,
      `frost-missile-lane-${index}`,
      {
        alpha: alphaFactor,
        blend: 'add',
        rotationRadians: lane.rotationDegrees * DEG,
        scaleX: lane.scale,
        scaleY: lane.scale * lane.aspect,
        tint: 0x80ffff,
      },
    ))
    const helperAlpha = alphaFactor * (0.2 + visualUnit(state.id, frame, 1) * 0.25)
    const helpers = [
      sprite(5, 'frost-missile-random-helper', {
        alpha: helperAlpha,
        blend: 'add',
        rotationRadians: visualUnit(state.id, frame, 2) * Math.PI * 2,
        tint: 0x80bfff,
      }),
      sprite(110, 'frost-missile-pulse-helper', {
        alpha: alphaFactor * (0.2 + visualUnit(state.id, frame, 3) * 0.25),
        blend: 'add',
        scaleX: Math.abs(Math.sin(age * 15 * DEG)) * 2,
        scaleY: Math.abs(Math.sin(age * 15 * DEG)) * 2,
        tint: 0xff80ff,
      }),
    ]
    const overlays = state.vector[5]! > 0
      ? frostMissileLearnedOverlays(age, state.frostTurnDegrees ?? 0, alphaFactor)
      : []
    return positioned(state.position, [
      body,
      ...helpers,
      ...lanes,
      ...overlays,
    ], { regionLightPoint: state.position })
  }
  if (state.buildId === 1002) {
    const alpha = state.underpowered ? 0.5 : 1
    return positioned(state.position, [...lightningCore(
      state.id,
      frame,
      0.75 + visualUnit(state.id, frame, 0) * 0.5,
      alpha,
      'ball-lightning',
    ), sprite(70, 'ball-lightning-body', {
      alpha: alpha * visualUnit(state.id, frame, 0x70),
      offset: { x: 0, y: -10 },
      scaleX: 1.25 + visualUnit(state.id, frame, 0x71) * 0.1,
      scaleY: 1.25 + visualUnit(state.id, frame, 0x71) * 0.1,
    }), ...elementVfxSprites(
      'ether',
      state.basePresentationPhaseDegrees ?? 0,
      1 + visualUnit(state.id, frame, 0x535a30) * 0.5,
      0.1,
      'ball-lightning-ether',
    )], { regionLightPoint: state.position })
  }
  // GroundSpark owns no immediate draw. Its tick-created fades are separate actors.
  return positioned(state.position, [], { regionLightPoint: state.position })
}

function channelPlan(state: NativeWeldChannelActorState): NativeWeldVisualPlan {
  if (state.endpoint === null) return empty(state.origin)
  const endpoint = {
    x: state.endpoint.x - state.origin.x,
    y: state.endpoint.y - state.origin.y,
  }
  const midpoint = state.midpoint === null
    ? { x: endpoint.x * 0.5, y: endpoint.y * 0.5 }
    : {
        x: state.midpoint.x - state.origin.x,
        y: state.midpoint.y - state.origin.y,
      }
  if (state.buildId === 1003) {
    const layer = buildNativeAirRibbonLayer({
      alpha: state.underpowered ? 0.5 : 1,
      basePhaseDegrees: -3 * state.birthTick,
      birthTick: state.birthTick,
      endpoint,
      id: state.id,
      midpoint,
      source: { x: 0, y: 0 },
      tint: 0xffffff,
      width: state.underpowered ? 0.75 : 1,
    })
    return positioned(state.origin, [], {
      meshes: flameLashMeshes(layer),
    })
  }
  const blizzard = nativeWeldBlizzardBeamPlan({
    birthTick: state.birthTick,
    endpoint,
    source: { x: 0, y: 0 },
    underpowered: state.underpowered,
    widen: state.vector[6]!,
  })
  return positioned(state.origin, [], {
    meshes: blizzard.quads.map((quad, index) => Object.freeze({
      alpha: 1,
      blend: 'add' as const,
      indices: Object.freeze([0, 1, 2, 1, 3, 2]),
      record: quad.record,
      role: index === 0 ? 'blizzard-beam-core' : 'blizzard-beam-strip',
      tint: blizzard.tint,
      uvs: Object.freeze([0, 0, 1, 0, 0, 1, 1, 1]),
      vertices: quad.vertices,
    })),
  })
}

function blizzardGlowPlan(
  state: NativeWeldBlizzardGlowState,
  frame: number,
): NativeWeldVisualPlan {
  return positioned(state.position, lightningCore(
    state.id,
    frame,
    state.scale,
    1,
    `blizzard-source-glow-${state.glowIndex}`,
  ).map((draw) => Object.freeze({
    ...draw,
    rotationRadians: draw.rotationRadians + state.rotationDegrees * DEG,
  })))
}

function flameLashMeshes(
  layer: ReturnType<typeof buildNativeAirRibbonLayer>,
): readonly NativeWeldMeshDraw[] {
  const body: NativeWeldMeshDraw = Object.freeze({
    alpha: layer.alpha,
    blend: 'add',
    indices: Object.freeze(Array.from(layer.indices)),
    record: 44,
    role: 'flame-lash-ribbon',
    tint: layer.tint,
    uvs: Object.freeze(Array.from(layer.uvs)),
    vertices: Object.freeze(Array.from(layer.vertices)),
  })
  if (!layer.branch) return Object.freeze([body])
  return Object.freeze([body, Object.freeze({
    alpha: layer.alpha,
    blend: 'add',
    indices: Object.freeze(Array.from(layer.branch.indices)),
    record: layer.branch.textureRecord,
    role: `flame-lash-branch-${layer.branch.geometryRecord}`,
    tint: layer.tint,
    uvs: Object.freeze(Array.from(layer.branch.uvs)),
    vertices: Object.freeze(Array.from(layer.branch.vertices)),
  })])
}

function impactPlan(state: NativeWeldImpactActorState, frame: number): NativeWeldVisualPlan {
  if (state.buildId === 1001) {
    return positioned(state.position, elementVfxSprites(
      'water',
      frame,
      state.presentationScale,
      state.alpha,
      'frost-missile-impact',
    ))
  }
  if (state.buildId === 1002 || state.buildId === 1009) {
    const draws = lightningCore(
      state.id,
      frame,
      state.presentationScale,
      state.alpha,
      state.buildId === 1002 ? 'ball-lightning-impact' : 'ground-spark-impact',
      ((state.presentationRotationDegrees ?? 0) + state.ageTicks) * DEG,
    )
    return positioned(state.position, draws)
  }
  return empty(state.position)
}

function markerPlan(state: NativeWeldMeteorMarkerState): NativeWeldVisualPlan {
  return positioned(state.origin, [sprite(51, 'meteor-iceblast-marker', {
    alpha: state.alpha,
    blend: 'add',
    rotationRadians: state.rotationDegrees * DEG,
    scaleX: state.scale,
    scaleY: state.scale,
    tint: 0xff0000 | Math.round(state.colorGreen * 255) << 8,
  })])
}

function meteorPlan(state: NativeWeldMeteorActorState, frame: number): NativeWeldVisualPlan {
  if (state.phase === 'fall') {
    const fallOffset = {
      x: 0,
      y: Math.fround(-768 * state.fallHeight),
    }
    const bodyScaleX = visualUnit(state.id, frame, 0x5e16c0) < 0.5
      ? -state.bodyScale
      : state.bodyScale
    const groundAlpha = Math.max(0, 1 - state.fallHeight) * 0.5
    return positioned(state.position, [
      sprite(15, 'meteor-fall-corona', {
        alpha: 1,
        blend: 'add',
        offset: fallOffset,
        scaleX: 3 + visualUnit(state.id, frame, 0) * 0.5,
        scaleY: 3 + visualUnit(state.id, frame, 0) * 0.5,
        tint: 0xff8000,
      }),
      sprite(50, 'meteor-fall-body', {
        offset: fallOffset,
        rotationRadians: (state.fallHeadingDegrees * 0.5 + 180) * DEG,
        scaleX: bodyScaleX,
        scaleY: Math.max(0, state.bodyScale * 2),
      }),
      ...(groundAlpha > 0 ? [sprite(19, 'meteor-final-descent-ground', {
        alpha: groundAlpha,
        atlas: 'DeadHawg',
        scaleX: 2,
        scaleY: 1.6,
      })] : []),
    ])
  }
  const impactAlpha = Math.min(1, state.impactTicksRemaining / 100)
  return positioned(state.position, [sprite(67, 'meteor-impact-body', {
    alpha: impactAlpha,
    blend: 'add',
    rotationRadians: state.impactRotationDegrees * DEG,
    scaleX: state.impactRadiusScalar,
    scaleY: state.impactRadiusScalar * 0.8,
  })])
}

function meteorFlashPlan(state: NativeWeldMeteorFlashActorState): NativeWeldVisualPlan {
  return positioned(state.position, [sprite(15, 'meteor-impact-flash', {
    alpha: state.alpha,
    blend: 'add',
    scaleX: state.scale,
    scaleY: state.scale,
    tint: 0xff8000,
  })])
}

function debrisPlan(state: NativeWeldBoulderDebrisActorState): NativeWeldVisualPlan {
  const debris = state.debris
  const role = state.buildId === 1006 ? 'ethereal-boulder-debris' : 'meteor-debris'
  const position = {
    x: Math.fround(state.position.x + debris.position.x),
    y: Math.fround(state.position.y + debris.position.y),
  }
  const sprites: NativeWeldSpriteDraw[] = []
  if (debris.enhancedShadow && debris.height !== 0) {
    sprites.push(sprite(debris.record, `${role}-shadow-${debris.index}`, {
      alpha: Math.min(1, debris.alpha),
      offset: { x: 0, y: 2 },
      rotationRadians: debris.rotationDegrees * DEG,
      scaleX: debris.scale,
      scaleY: debris.scale * 0.75,
      tint: 0x000000,
    }))
  }
  sprites.push(sprite(debris.record, `${role}-${debris.index}`, {
    alpha: Math.min(1, debris.alpha),
    offset: { x: 0, y: debris.height },
    rotationRadians: debris.rotationDegrees * DEG,
    scaleX: debris.scale,
    scaleY: debris.scale,
    tint: 0xff0000 | Math.trunc(debris.colorGreen * 255) << 8,
  }))
  return positioned(position, sprites, { regionLightPoint: position, sortBias: -15 })
}

function etherealBoulderPlan(
  state: NativeWeldEtherealBoulderState,
  frame: number,
): NativeWeldVisualPlan {
  const plan = earthBoulderPresentationPlan({
    ageTicks: state.ageTicks,
    assemblyCharge: state.assemblyScale,
    charge: state.scale,
    flightTicks: state.flightTicks,
    id: state.id,
    orientation: state.orientation,
    phase: state.phase,
  }, frame)
  const centers = state.phase === 'held'
    ? etherealBoulderHeldCenters(state)
    : [{ x: 0, y: 0 }]
  const bodyTint = packRgb(plan.bodyAlpha, plan.bodyAlpha * 0.75, 1)
  const body = centers.flatMap((center, centerIndex) => plan.rocks.flatMap((rock) => {
    const offset = {
      x: plan.visualOffset.x + center.x + rock.position.x,
      y: plan.visualOffset.y + center.y + rock.position.y,
    }
    if (rock.shellIndex === null) {
      return elementVfxSprites(
        'ether',
        frame,
        (1 + visualUnit(state.id, frame, 0x60c540 + centerIndex) * 0.1) * 2 * state.scale,
        1,
        `ethereal-boulder-center-${centerIndex}`,
      ).map((draw) => Object.freeze({
        ...draw,
        offset: Object.freeze({
          x: draw.offset.x + offset.x,
          y: draw.offset.y + offset.y,
        }),
      }))
    }
    const scale = Math.max(0.25, rock.storedScale * 0.75)
    return [sprite(rock.record, `ethereal-boulder-rock-${centerIndex}`, {
      offset,
      rotationRadians: rock.rotation,
      scaleX: scale,
      scaleY: scale,
      tint: bodyTint,
    })]
  }))
  const auxiliary = boulderAuxiliarySprite(
    state.id,
    frame,
    state.scale,
    state.phase,
    'ethereal-boulder',
  )
  return positioned(state.origin, [
    sprite(15, 'ethereal-boulder-aura', {
      alpha: plan.aura.alpha,
      offset: plan.visualOffset,
      scaleX: plan.aura.scale,
      scaleY: plan.aura.scale,
      tint: packRgb(1, 0.9, 1),
    }),
    sprite(86, 'ethereal-boulder-opening', {
      alpha: plan.openingFlash.alpha,
      blend: 'add',
      offset: plan.visualOffset,
      rotationRadians: plan.openingFlash.rotation,
      scaleX: plan.openingFlash.scale,
      scaleY: plan.openingFlash.scale,
    }),
    ...body,
    auxiliary,
  ], {
    regionLightPoint: state.origin,
    sortBias: plan.sortBias,
  })
}

function etherealBoulderHeldCenters(
  state: NativeWeldEtherealBoulderState,
): readonly Readonly<{ x: number; y: number }>[] {
  const direction = state.direction
  const perpendicular = { x: direction.y, y: -direction.x }
  const centers = state.quantity === 1
    ? [{ x: 0, y: 0 }]
    : state.quantity === 2
      ? [
          { x: perpendicular.x * 30, y: perpendicular.y * 30 },
          { x: perpendicular.x * -30, y: perpendicular.y * -30 },
        ]
      : state.quantity === 3
        ? [
            { x: direction.x * 30, y: direction.y * 30 },
            { x: perpendicular.x * 30, y: perpendicular.y * 30 },
            { x: perpendicular.x * -30, y: perpendicular.y * -30 },
          ]
        : [
            { x: direction.x * 30, y: direction.y * 30 },
            { x: perpendicular.x * 30, y: perpendicular.y * 30 },
            { x: perpendicular.x * -30, y: perpendicular.y * -30 },
            { x: direction.x * -15, y: direction.y * -15 },
          ]
  return Object.freeze(centers
    .map((center, sourceOrder) => ({ ...center, sourceOrder }))
    .sort((left, right) => left.y - right.y || left.sourceOrder - right.sourceOrder)
    .map(({ x, y }) => Object.freeze({ x: Math.fround(x), y: Math.fround(y) })))
}

function hailstonesPlan(
  state: NativeWeldHailstonesState,
  frame: number,
): NativeWeldVisualPlan {
  const sprites: NativeWeldSpriteDraw[] = []
  const openingMix = Math.max(0, 1 - state.ageTicks * 0.03500000014901161)
  if (state.phase === 'held') {
    sprites.push(sprite(15, 'hailstones-held-core', {
      alpha: 0.35 + visualUnit(state.id, frame, 0x611160) * 0.25,
      scaleX: state.scale * 4.099999904632568,
      scaleY: state.scale * 4.099999904632568,
      tint: packRgb(1, 1, 0.9),
    }), ...elementVfxSprites(
      'water',
      frame,
      1.75,
      1,
      'hailstones-held-water',
    ))
  }
  for (const [index, rock] of state.rocks.entries()) {
    const offset = state.phase === 'flight'
      ? {
          x: rock.localPosition.x,
          y: Math.fround(
            rock.localPosition.y
              + Math.fround(
                Math.fround(50 - rock.localPosition.z * Math.fround(0.8))
                  - rock.localPosition.y,
              ) * rock.decay,
          ),
        }
      : { x: rock.localPosition.x, y: rock.localPosition.y }
    const scale = Math.max(0.45, rock.visualScale)
      * (state.phase === 'held' ? 0.85 : 0.75)
    sprites.push(sprite(rock.spriteRecord, `hailstones-rock-${index}`, {
      offset,
      scaleX: scale,
      scaleY: scale,
      tint: state.phase === 'held'
        ? packRgb(1 - openingMix, 1 - openingMix, 1 - openingMix)
        : 0xffffff,
    }), sprite(32, `hailstones-rock-overlay-${index}`, {
      alpha: rock.phase * (state.phase === 'held' ? 0.8 : 1),
      offset,
      rotationRadians: Math.atan2(state.direction.y, state.direction.x),
    }))
  }
  sprites.push(boulderAuxiliarySprite(
    state.id,
    frame,
    state.scale,
    state.phase,
    'hailstones',
  ))
  return positioned(state.origin, sprites, {
    regionLightPoint: state.origin,
    sortBias: state.rocks.reduce((highest, rock) => (
      Math.max(highest, rock.localPosition.z)
    ), 0),
  })
}

function boulderAuxiliarySprite(
  id: number,
  frame: number,
  scale: number,
  phase: 'flight' | 'held',
  role: string,
): NativeWeldSpriteDraw {
  return phase === 'held'
    ? sprite(15, `${role}-held-auxiliary`, {
        alpha: 0.25 + visualUnit(id, frame, 0x5e5530) * 0.5,
        scaleX: scale * 2.5,
        scaleY: scale * 2.5,
        tint: packRgb(0.85, 1, 0.85),
      })
    : sprite(67, `${role}-flight-auxiliary`, {
        scaleX: scale * 2.5,
        scaleY: scale * 2.5,
      })
}

function hailTerrainParticlePlan(
  state: NativeWeldHailTerrainParticleState,
): NativeWeldVisualPlan {
  return positioned(state.position, [sprite(45, 'hailstones-terrain-particle', {
    alpha: state.alpha,
    blend: 'add',
    rotationRadians: state.rotationDegrees * DEG,
    scaleX: state.scale,
    scaleY: state.scale,
    tint: state.tint,
  })])
}

function hailTerrainBouncerPlan(
  state: NativeWeldHailTerrainBouncerState,
): NativeWeldVisualPlan {
  const sprites: NativeWeldSpriteDraw[] = []
  if (state.enhancedShadow && state.height !== 0) {
    sprites.push(sprite(32, 'hailstones-terrain-bouncer-shadow', {
      alpha: Math.min(1, state.alpha),
      offset: { x: 0, y: 2 },
      rotationRadians: state.rotationDegrees * DEG,
      scaleX: state.scale,
      scaleY: state.scale * 0.75,
      tint: 0x000000,
    }))
  }
  sprites.push(sprite(32, 'hailstones-terrain-bouncer', {
    alpha: Math.min(1, state.alpha),
    offset: { x: 0, y: state.height },
    rotationRadians: state.rotationDegrees * DEG,
    scaleX: state.scale,
    scaleY: state.scale,
  }))
  return positioned(state.position, sprites)
}

function hailLinePlan(state: NativeWeldHailLineState): NativeWeldVisualPlan {
  const midpoint = {
    x: Math.fround((state.end.x - state.start.x) * 0.5),
    y: Math.fround((state.end.y - state.start.y) * 0.5),
  }
  const end = {
    x: Math.fround(state.end.x - state.start.x),
    y: Math.fround(state.end.y - state.start.y),
  }
  return positioned(state.start, [], {
    lines: Object.freeze([Object.freeze({
      alpha: state.alpha * 0.5,
      color: 0x00ffff,
      end: midpoint,
      role: 'hailstones-contact-line-cyan',
      start: Object.freeze({ x: 0, y: 0 }),
      width: state.width,
    }), Object.freeze({
      alpha: state.alpha * state.endAlpha,
      color: 0xffffff,
      end,
      role: 'hailstones-contact-line-white',
      start: midpoint,
      width: state.width,
    })]),
  })
}

function hailFlashPlan(state: NativeWeldHailFlashState): NativeWeldVisualPlan {
  return positioned(state.position, [sprite(15, 'hailstones-contact-flash', {
    alpha: state.alpha,
  })])
}

function hailRockFadePlan(state: NativeWeldHailRockFadeActorState): NativeWeldVisualPlan {
  return positioned(state.position, [sprite(18, 'hailstones-rock-birth-fade', {
    alpha: Math.max(0, 4 - state.ageTicks * 0.01),
    rotationRadians: state.rotationDegrees * DEG,
    scaleX: 0.5,
    scaleY: 0.5,
  })])
}

function frostFadePlan(
  state: NativeWeldFrostFadeActorState,
  frame: number,
): NativeWeldVisualPlan {
  return positioned(state.position, elementVfxSprites(
    'water',
    frame,
    state.scale,
    Math.max(0, 1 - state.ageTicks * 0.05),
    'hailstones-release-frost',
  ))
}

function flameLashFadePlan(
  state: NativeWeldFlameLashFadeState,
  frame: number,
): NativeWeldVisualPlan {
  const scale = state.baseScale * (2 + visualUnit(state.id, frame, 0x57370) * 0.25)
  return positioned(state.position, [sprite(35, `flame-lash-${state.variant}-fade`, {
    alpha: state.alpha,
    blend: 'add',
    scaleX: scale,
    scaleY: scale,
    tint: packRgb(1, state.colorGreen, 0),
  })], {
    regionLightPoint: state.position,
    sortBias: state.variant === 'endpoint' ? 100 : 50,
  })
}

function steamPlan(state: NativeWeldSteamActorState): NativeWeldVisualPlan {
  const scale = state.scale * 2
  if (state.variant === 'over') {
    return positioned(state.position, [sprite(76, 'steam-jet-over', {
      alpha: 0.25 * Math.min(state.life, state.phase),
      rotationRadians: state.rotationDegrees * DEG,
      scaleX: scale,
      scaleY: scale,
    })])
  }
  const alpha = state.alphaMultiplier * Math.min(state.life * state.life, state.phase)
  const green = Math.max(0, 1 - state.tintFade)
  const blue = Math.max(0, 1 - state.tintFade * 4)
  const tint = packRgb(1, green, blue)
  const draw = sprite(76, 'steam-jet-normal', {
    alpha,
    blend: state.tintFade > 0 ? 'add' : 'normal',
    rotationRadians: state.rotationDegrees * DEG,
    scaleX: scale,
    scaleY: scale,
    tint,
  })
  return positioned(state.position, state.tintFade > 0
    ? [draw, { ...draw, role: 'steam-jet-normal-additive-copy' }]
    : [draw])
}

function elementVfxSprites(
  element: Extract<NativeElement, 'ether' | 'water'>,
  phase: number,
  scale: number,
  alpha: number,
  role: string,
): NativeWeldSpriteDraw[] {
  return nativeElementVfxPlanAtPhase(element, phase, scale).map((draw, index) => {
    let record: NativeWeldBadGuysRecord
    switch (draw.sprite) {
      case 'core': record = 110; break
      case 'ray': record = 112; break
      case 'spark': record = 111; break
      case 'water': record = (271 + draw.frame) as NativeWeldBadGuysRecord; break
      default: throw new Error(`Unexpected ${element} Weld compositor sprite ${draw.sprite}`)
    }
    return sprite(record, `${role}-${draw.sprite}-${index}`, {
      alpha: alpha * draw.alpha,
      blend: draw.blend === 'lighter' ? 'add' : 'normal',
      offset: { x: draw.x, y: draw.y },
      rotationRadians: draw.rotation * DEG,
      scaleX: draw.scale,
      scaleY: draw.scale,
      tint: packRgb(draw.color[0], draw.color[1], draw.color[2]),
    })
  })
}

function frostMissileLearnedOverlays(
  ageTicks: number,
  turnDegrees: number,
  alphaFactor: number,
): NativeWeldSpriteDraw[] {
  const tint = 0xbfffff
  const first = composeAffine(
    translationAffine(Math.abs(Math.sin(ageTicks * DEG)) * 3, 0),
    rotationAffine(turnDegrees),
    scaleAffine(1.4, 1.12),
    rotationAffine(ageTicks * 8),
  )
  const second = composeAffine(
    rotationAffine(turnDegrees),
    scaleAffine(1.75, 1.4),
    rotationAffine(ageTicks * -12),
  )
  return [
    sprite(87, 'frost-missile-learned-overlay-a', {
      alpha: alphaFactor * 0.15,
      blend: 'add',
      matrix: first,
      tint,
    }),
    sprite(87, 'frost-missile-learned-overlay-b', {
      alpha: alphaFactor * 0.15,
      blend: 'add',
      matrix: second,
      tint,
    }),
  ]
}

function composeAffine(
  ...matrices: readonly NativeWeldAffineMatrix[]
): NativeWeldAffineMatrix {
  return Object.freeze(matrices.reduce(multiplyAffine, identityAffine()))
}

function multiplyAffine(
  left: NativeWeldAffineMatrix,
  right: NativeWeldAffineMatrix,
): NativeWeldAffineMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    tx: left.a * right.tx + left.c * right.ty + left.tx,
    ty: left.b * right.tx + left.d * right.ty + left.ty,
  }
}

function identityAffine(): NativeWeldAffineMatrix {
  return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
}

function rotationAffine(degrees: number): NativeWeldAffineMatrix {
  const radians = degrees * DEG
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return { a: cosine, b: sine, c: -sine, d: cosine, tx: 0, ty: 0 }
}

function scaleAffine(x: number, y: number): NativeWeldAffineMatrix {
  return { a: x, b: 0, c: 0, d: y, tx: 0, ty: 0 }
}

function translationAffine(x: number, y: number): NativeWeldAffineMatrix {
  return { a: 1, b: 0, c: 0, d: 1, tx: x, ty: y }
}

function lightningCore(
  id: number,
  frame: number,
  scale: number,
  alpha: number,
  role: string,
  angleRadians = frame * DEG,
): NativeWeldSpriteDraw[] {
  const corona = buildNativeAirCoronaPlan({
    alpha,
    angle: angleRadians,
    center: { x: 0, y: 0 },
    randomSalt: 0x536380 ^ frame,
    scale,
    seed: id,
  })
  return [
    ...corona.circles.map((circle, index) => sprite(circle.record, `${role}-circle-${index}`, {
      alpha: corona.alpha * circle.alpha,
      blend: 'add',
      scaleX: circle.scale,
      scaleY: circle.scale,
      tint: circle.tint,
    })),
    ...corona.forks.map((fork, index) => sprite(fork.record, `${role}-fork-${index}`, {
      alpha: corona.alpha * fork.alpha,
      blend: 'add',
      rotationRadians: fork.rotation,
      scaleX: fork.scale,
      scaleY: fork.scale,
      tint: fork.tint,
    })),
  ]
}

function sprite(
  record: NativeWeldRecord,
  role: string,
  values: Partial<Omit<NativeWeldSpriteDraw, 'record' | 'role'>> = {},
): NativeWeldSpriteDraw {
  return Object.freeze({
    alpha: values.alpha ?? 1,
    atlas: values.atlas ?? 'BadGuys',
    blend: values.blend ?? 'normal',
    matrix: values.matrix ?? null,
    offset: Object.freeze(values.offset ?? { x: 0, y: 0 }),
    record,
    role,
    rotationRadians: values.rotationRadians ?? 0,
    scaleX: values.scaleX ?? 1,
    scaleY: values.scaleY ?? 1,
    tint: values.tint ?? 0xffffff,
  })
}

function positioned(
  position: Readonly<{ x: number; y: number }>,
  sprites: readonly NativeWeldSpriteDraw[],
  options: Readonly<{
    lines?: readonly NativeWeldLineDraw[]
    meshes?: readonly NativeWeldMeshDraw[]
    regionLightPoint?: Readonly<{ x: number; y: number }> | null
    sortBias?: number
  }> = {},
): NativeWeldVisualPlan {
  return Object.freeze({
    lines: Object.freeze([...(options.lines ?? [])]),
    meshes: Object.freeze([...(options.meshes ?? [])]),
    position: Object.freeze({ ...position }),
    regionLightPoint: options.regionLightPoint === undefined
      ? null
      : options.regionLightPoint === null
        ? null
        : Object.freeze({ ...options.regionLightPoint }),
    sortBias: options.sortBias ?? 0,
    sprites: Object.freeze([...sprites]),
    worldY: position.y,
  })
}

function empty(position: Readonly<{ x: number; y: number }>): NativeWeldVisualPlan {
  return positioned(position, [])
}

function visualUnit(id: number, frame: number, lane: number): number {
  let value = (id ^ Math.imul(frame + 1, 0x9e3779b1) ^ Math.imul(lane + 1, 0x85ebca6b)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}

function packRgb(red: number, green: number, blue: number): number {
  const byte = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255)
  return byte(red) << 16 | byte(green) << 8 | byte(blue)
}

function integerRange(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}
