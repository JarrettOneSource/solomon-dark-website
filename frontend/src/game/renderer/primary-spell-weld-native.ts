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
  NativeWeldProjectileState,
} from '../core-kernels/native-weld-primary-runtime.ts'
import type { NativeWeldMeteorMarkerState } from '../core-kernels/native-weld-meteor.ts'
import type { NativeWeldSteamActorState } from '../core-kernels/native-weld-steam.ts'
import { earthBoulderPresentationPlan } from './earth-boulder-presentation.ts'
import { nativeFireballPlan } from './primary-spell-fire-native.ts'
import {
  nativeEnemySpriteRegistration,
  type NativeEnemySpriteRegistration,
} from './native-enemy-sprite-registration.ts'

const DEG = Math.PI / 180

export const NATIVE_WELD_BADGUYS_RECORDS = Object.freeze([
  6, 15, 18, 31, 43, 44, 50, 51, 70, 71, 76, 86, 110, 111, 112,
  168, 169, 170, 171,
  ...integerRange(251, 266),
  ...integerRange(271, 282),
  ...integerRange(1836, 1839),
  ...integerRange(2008, 2010),
] as const)

export type NativeWeldBadGuysRecord = typeof NATIVE_WELD_BADGUYS_RECORDS[number]

export const NATIVE_WELD_SPRITES = Object.freeze(Object.fromEntries(
  NATIVE_WELD_BADGUYS_RECORDS.map((record) => [
    record,
    nativeEnemySpriteRegistration('BadGuys', record),
  ]),
)) as Readonly<Record<NativeWeldBadGuysRecord, NativeEnemySpriteRegistration>>

export type NativeWeldPresentationState =
  | NativeWeldProjectileState
  | Extract<PrimarySpellTransientState, {
      kind:
        | 'weld-boulder-debris'
        | 'weld-channel'
        | 'weld-frost-fade'
        | 'weld-ground-spark-fade'
        | 'weld-hail-rock-fade'
        | 'weld-impact'
        | 'weld-meteor'
        | 'weld-meteor-marker'
        | 'weld-persistent'
        | 'weld-steam'
    }>

export interface NativeWeldSpriteDraw {
  readonly alpha: number
  readonly blend: 'add' | 'normal'
  readonly offset: Readonly<{ x: number; y: number }>
  readonly record: NativeWeldBadGuysRecord
  readonly role: string
  readonly rotationRadians: number
  readonly scaleX: number
  readonly scaleY: number
  readonly tint: number
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

export interface NativeWeldVisualPlan {
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
    || state.kind === 'weld-boulder-debris'
    || state.kind === 'weld-channel'
    || state.kind === 'weld-frost-fade'
    || state.kind === 'weld-ground-spark-fade'
    || state.kind === 'weld-hail-rock-fade'
    || state.kind === 'weld-impact'
    || state.kind === 'weld-meteor'
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
    case 'weld-boulder-debris': return debrisPlan(state)
    case 'weld-channel': return channelPlan(state)
    case 'weld-frost-fade': return frostFadePlan(state, presentationFrame)
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
    case 'weld-hail-rock-fade': return hailRockFadePlan(state)
    case 'weld-impact': return impactPlan(state, presentationFrame)
    case 'weld-meteor': return meteorPlan(state, presentationFrame)
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
    const body = sprite(
      (271 + Math.floor(state.ageTicks / 4) % 12) as NativeWeldBadGuysRecord,
      'frost-missile-body',
      {
        alpha: alphaFactor * (0.75 + visualUnit(state.id, frame, 0) * 0.25),
        rotationRadians: state.ageTicks * DEG,
        scaleX: 1.7,
        scaleY: 1.7,
      },
    )
    const lanes = state.frostPresentationLanes!.map((lane, index) => sprite(
      110,
      `frost-missile-lane-${index}`,
      {
        alpha: alphaFactor * 0.5,
        blend: 'add',
        rotationRadians: lane.rotationDegrees * DEG,
        scaleX: lane.scale,
        scaleY: lane.scale * lane.aspect,
        tint: 0x80bfff,
      },
    ))
    return positioned(state.position, [
      body,
      ...frostCore(state.id, frame, 1, alphaFactor, 'frost-missile'),
      ...lanes,
    ], { regionLightPoint: state.position })
  }
  if (state.buildId === 1002) {
    return positioned(state.position, lightningCore(
      state.id,
      frame,
      0.75 + visualUnit(state.id, frame, 0) * 0.5,
      1,
      'ball-lightning',
    ), { regionLightPoint: state.position })
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
    return positioned(state.origin, [], {
      meshes: [beamMesh(44, midpoint, endpoint, 8, 'flame-lash', 0xff8040)],
    })
  }
  const width = Math.max(20, state.vector[6]! * 125)
  return positioned(state.origin, [], {
    meshes: [
      beamMesh(43, midpoint, endpoint, width, 'blizzard-beam-core', 0x80bfff),
      beamMesh(44, midpoint, endpoint, width * 0.5, 'blizzard-beam-over', 0xffffff),
    ],
  })
}

function impactPlan(state: NativeWeldImpactActorState, frame: number): NativeWeldVisualPlan {
  if (state.buildId === 1001) {
    return positioned(state.position, frostCore(
      state.id,
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
    ).map((draw) => ({
      ...draw,
      rotationRadians: draw.rotationRadians
        + (state.presentationRotationDegrees ?? 0) * DEG,
    }))
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
      x: Math.fround(Math.sin(state.fallHeadingDegrees * DEG) * 768 * state.fallScalar),
      y: Math.fround(-Math.cos(state.fallHeadingDegrees * DEG) * 768 * state.fallScalar),
    }
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
        rotationRadians: (state.impactRotationDegrees + state.ageTicks) * DEG,
        scaleX: state.size * 0.2,
        scaleY: state.size * 0.2,
      }),
    ], { sortBias: fallOffset.y })
  }
  const flashAlpha = Math.max(0, 2 - state.impactAgeTicks * 0.1)
  return positioned(state.position, [
    ...(flashAlpha > 0 ? [sprite(15, 'meteor-impact-flash', {
      alpha: flashAlpha,
      blend: 'add',
      rotationRadians: state.impactRotationDegrees * DEG,
      scaleX: 6,
      scaleY: 6,
      tint: 0xff8000,
    })] : []),
    ...debrisSprites(state.debris, state.impactAgeTicks, 'meteor-debris'),
  ])
}

function debrisPlan(state: NativeWeldBoulderDebrisActorState): NativeWeldVisualPlan {
  return positioned(state.position, debrisSprites(
    state.debris,
    state.ageTicks,
    'ethereal-boulder-weak-debris',
  ))
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
  return positioned(state.origin, [
    sprite(86, 'ethereal-boulder-opening', {
      alpha: plan.openingFlash.alpha,
      blend: 'add',
      offset: plan.visualOffset,
      rotationRadians: plan.openingFlash.rotation,
      scaleX: plan.openingFlash.scale * state.visualScaleFactor,
      scaleY: plan.openingFlash.scale * state.visualScaleFactor,
    }),
    ...plan.rocks.map((rock) => sprite(rock.record, 'ethereal-boulder-rock', {
      alpha: plan.bodyAlpha,
      offset: {
        x: (plan.visualOffset.x + rock.position.x) * state.visualScaleFactor,
        y: (plan.visualOffset.y + rock.position.y) * state.visualScaleFactor,
      },
      rotationRadians: rock.rotation,
      scaleX: rock.scale * state.visualScaleFactor,
      scaleY: rock.scale * state.visualScaleFactor,
    })),
  ], {
    regionLightPoint: state.origin,
    sortBias: plan.sortBias * state.visualScaleFactor,
  })
}

function hailstonesPlan(
  state: NativeWeldHailstonesState,
  frame: number,
): NativeWeldVisualPlan {
  const sprites: NativeWeldSpriteDraw[] = []
  if (state.phase === 'held') {
    sprites.push(...frostCore(
      state.id,
      frame,
      state.scale * 4.099999904632568,
      1,
      'hailstones-held-core',
    ))
  }
  for (const [index, rock] of state.rocks.entries()) {
    const offset = rock.releaseOffset ?? {
      x: rock.localPosition.x,
      y: rock.localPosition.y,
    }
    const scale = Math.max(0.45, rock.visualScale)
      * (state.phase === 'held' ? 0.85 : 0.75)
    sprites.push(sprite(rock.spriteRecord, `hailstones-rock-${index}`, {
      alpha: rock.phase * (state.phase === 'held' ? 0.8 : 1),
      offset,
      scaleX: scale,
      scaleY: scale,
    }))
  }
  return positioned(state.origin, sprites, {
    regionLightPoint: state.origin,
    sortBias: state.rocks.reduce((highest, rock) => (
      Math.max(highest, rock.localPosition.z)
    ), 0),
  })
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
  return positioned(state.position, frostCore(
    state.id,
    frame,
    state.scale,
    Math.max(0, 1 - state.ageTicks * 0.05),
    'hailstones-release-frost',
  ))
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
    rotationRadians: state.rotationDegrees * DEG,
    scaleX: scale,
    scaleY: scale,
    tint,
  })
  return positioned(state.position, state.tintFade > 0
    ? [draw, { ...draw, blend: 'add', role: 'steam-jet-normal-additive' }]
    : [draw])
}

function debrisSprites(
  debris: NativeWeldMeteorActorState['debris'],
  age: number,
  role: string,
): NativeWeldSpriteDraw[] {
  return debris.flatMap((seed) => {
    const alpha = Math.max(0, seed.alpha - age * 0.025)
    if (alpha <= 0) return []
    const vertical = seed.height
      + seed.verticalVelocity * age
      + Math.fround(0.075 * age * Math.max(0, age - 1))
    return [sprite(seed.record, `${role}-${seed.index}`, {
      alpha,
      offset: {
        x: seed.position.x + seed.velocity.x * age,
        y: seed.position.y + seed.velocity.y * age + vertical,
      },
      rotationRadians: (seed.rotationDegrees + seed.rotationStepDegrees * age) * DEG,
      scaleX: seed.scale,
      scaleY: seed.scale,
      tint: 0xff0000 | Math.round(seed.colorGreen * 255) << 8,
    })]
  })
}

function frostCore(
  id: number,
  frame: number,
  scale: number,
  alpha: number,
  role: string,
): NativeWeldSpriteDraw[] {
  const phase = frame * DEG
  const pulse = (3.5 + Math.abs(Math.sin(phase)) * 0.15) * scale
  return [
    sprite(110, `${role}-core`, {
      alpha: alpha * (0.2 + visualUnit(id, frame, 1) * 0.25),
      blend: 'add', scaleX: pulse, scaleY: pulse, tint: 0x80bfff,
    }),
    sprite(112, `${role}-ray-a`, {
      alpha: alpha * Math.abs(Math.sin(phase * 11)) * 0.55,
      blend: 'add', rotationRadians: phase * 50,
      scaleX: scale * (1 + visualUnit(id, frame, 2) * 0.3),
      scaleY: scale * (1 + visualUnit(id, frame, 2) * 0.3),
    }),
    sprite(112, `${role}-ray-b`, {
      alpha: alpha * Math.abs(Math.cos(phase * 11)) * 0.55,
      blend: 'add', rotationRadians: -phase * 50,
      scaleX: scale * (1 + visualUnit(id, frame, 3) * 0.3),
      scaleY: scale * (1 + visualUnit(id, frame, 3) * 0.3),
    }),
  ]
}

function lightningCore(
  id: number,
  frame: number,
  scale: number,
  alpha: number,
  role: string,
): NativeWeldSpriteDraw[] {
  const pulse = (3.5 + Math.abs(Math.sin(frame * DEG)) * 0.15) * scale
  const fork = Math.floor(visualUnit(id, frame, 10) * 4)
  return [
    sprite(110, `${role}-outer`, {
      alpha: alpha * (0.2 + visualUnit(id, frame, 1) * 0.25),
      blend: 'add', scaleX: pulse, scaleY: pulse, tint: 0x80bfbf,
    }),
    sprite(110, `${role}-mid`, {
      alpha: alpha * 0.5, blend: 'add', scaleX: pulse * 0.75,
      scaleY: pulse * 0.75, tint: 0x80bfbf,
    }),
    sprite(110, `${role}-inner`, {
      alpha: alpha * 0.5, blend: 'add', scaleX: pulse * 0.5,
      scaleY: pulse * 0.5, tint: 0x80bfbf,
    }),
    sprite((1836 + fork) as NativeWeldBadGuysRecord, `${role}-fork-a`, {
      alpha, blend: 'add', rotationRadians: frame * DEG,
      scaleX: scale, scaleY: scale,
    }),
    sprite((1839 - fork) as NativeWeldBadGuysRecord, `${role}-fork-b`, {
      alpha: alpha * 0.5, blend: 'add', rotationRadians: frame * DEG + Math.PI / 2,
      scaleX: scale, scaleY: scale,
    }),
  ]
}

function beamMesh(
  record: NativeWeldBadGuysRecord,
  midpoint: Readonly<{ x: number; y: number }>,
  endpoint: Readonly<{ x: number; y: number }>,
  width: number,
  role: string,
  tint: number,
): NativeWeldMeshDraw {
  const points = [{ x: 0, y: 0 }, midpoint, endpoint]
  const vertices: number[] = []
  for (let index = 0; index < points.length; index += 1) {
    const before = points[Math.max(0, index - 1)]!
    const after = points[Math.min(points.length - 1, index + 1)]!
    const dx = after.x - before.x
    const dy = after.y - before.y
    const length = Math.hypot(dx, dy) || 1
    const px = -dy / length * width
    const py = dx / length * width
    vertices.push(points[index]!.x + px, points[index]!.y + py)
    vertices.push(points[index]!.x - px, points[index]!.y - py)
  }
  return Object.freeze({
    alpha: 1,
    blend: 'add',
    indices: Object.freeze([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]),
    record,
    role,
    tint,
    uvs: Object.freeze([0, 0, 0, 1, 0.5, 0, 0.5, 1, 1, 0, 1, 1]),
    vertices: Object.freeze(vertices),
  })
}

function sprite(
  record: NativeWeldBadGuysRecord,
  role: string,
  values: Partial<Omit<NativeWeldSpriteDraw, 'record' | 'role'>> = {},
): NativeWeldSpriteDraw {
  return Object.freeze({
    alpha: values.alpha ?? 1,
    blend: values.blend ?? 'normal',
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
    meshes?: readonly NativeWeldMeshDraw[]
    regionLightPoint?: Readonly<{ x: number; y: number }> | null
    sortBias?: number
  }> = {},
): NativeWeldVisualPlan {
  return Object.freeze({
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
