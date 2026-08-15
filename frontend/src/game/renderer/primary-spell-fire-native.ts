import type {
  PrimarySpellFireEmberState,
  PrimarySpellFireGoodImpState,
  PrimarySpellFireImpactState,
  PrimarySpellFirePatchState,
  PrimarySpellFireParticleState,
  PrimarySpellFireProjectileState,
} from '../core-kernels/primary-spells.ts'
import { nativeImpEffectFrame } from '../core-kernels/boneyard-imp-flight.ts'
import {
  nativeFireParticleFadeStep,
  nativeFirePresentationRandom,
  nativeFirePresentationRandomInt,
} from '../core-kernels/primary-spell-fire-native.ts'
import {
  NATIVE_DEFAULT_MULTIPLE_SHADOWS,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'
import {
  nativeEnemyFacingBucket,
  roundHalfToEven,
} from './native-enemy-presentation.ts'

export const NATIVE_FIREBALL_CORE_RECORD = 110
export const NATIVE_FIREBALL_FRAME_FIRST = 255
export const NATIVE_FIREBALL_FRAME_COUNT = 12
export const NATIVE_FIREBALL_TICKS_PER_FRAME = 3
export const NATIVE_FIRE_PARTICLE_FRAME_FIRST = 267
export const NATIVE_FIRE_PARTICLE_DEPTH_BIAS = 30
export const NATIVE_FIRE_IMPACT_FRAME_FIRST = 251
export const NATIVE_FIRE_IMPACT_FRAME_COUNT = 4
export const NATIVE_FIRE_IMPACT_TICKS_PER_FRAME = 4
export const NATIVE_FIRE_IMPACT_DEPTH_BIAS = 50
export const NATIVE_FIRE_EMBER_GLOW_RECORD = 15
export const NATIVE_FIRE_EMBER_FRAME_FIRST = 267
export const NATIVE_FIRE_PATCH_FRAME_FIRST = 46
export const NATIVE_FIRE_PATCH_FRAME_COUNT = 32
export const NATIVE_GOOD_IMP_BODY_FIRST = 285
export const NATIVE_GOOD_IMP_UPPER_FIRST = 333
export const NATIVE_GOOD_IMP_CONTACT_FIRST = 251

export interface NativeFireActorDraw {
  readonly alpha: number
  readonly atlas: 'BadGuys' | 'DeadHawg'
  readonly blend: 'add' | 'normal'
  readonly entry: number
  readonly offset: Readonly<{ x: number; y: number }>
  readonly role: string
  readonly rotation: number
  readonly scale: number
  readonly scaleX?: number
  readonly scaleY?: number
  readonly tint: number
}

export interface NativeFireEmberPlan {
  readonly draws: readonly NativeFireActorDraw[]
  readonly position: Readonly<{ x: number; y: number }>
  readonly regionLightPoint: null
  readonly worldY: number
}

export interface NativeFirePatchPlan {
  readonly alpha: number
  readonly atlas: 'DeadHawg'
  readonly blend: 'add'
  readonly entry: number
  readonly position: Readonly<{ x: number; y: number }>
  readonly regionLightPoint: null
  readonly scaleX: number
  readonly scaleY: number
  readonly tint: number
  readonly worldY: number
}

export interface NativeFireGoodImpPlan {
  readonly draws: readonly NativeFireActorDraw[]
  readonly position: Readonly<{ x: number; y: number }>
  readonly regionLightPoint: Readonly<{ x: number; y: number }>
  readonly worldY: number
}

export interface NativeFireballDraw {
  alpha: number
  blend: 'add' | 'normal'
  frame: number
  pass: 'additive-body' | 'body' | 'core'
  rotation: number
  scaleX: number
  scaleY: number
  tint: number
  x: number
  y: number
}

export interface NativeFireballPlan {
  draws: readonly NativeFireballDraw[]
  frameIndex: number
  position: { x: number; y: number }
  regionLightPoint: null
  worldY: number
}

export interface NativeFireParticlePlan {
  alpha: number
  fadeStep: number
  frame: number
  position: { x: number; y: number }
  regionLightPoint: null
  rotation: number
  scale: number
  tint: number
  worldY: number
}

export interface NativeFireImpactDraw {
  alpha: number
  blend: 'add' | 'normal'
  frame: number
  pass: 'burst' | 'core'
  rotation: number
  scaleX: number
  scaleY: number
  tint: number
  x: number
  y: number
}

export interface NativeFireImpactPlan {
  draws: readonly NativeFireImpactDraw[]
  frameIndex: number
  position: { x: number; y: number }
  regionLightPoint: null
  worldY: number
}

export function nativeFireballPlan(
  state: PrimarySpellFireProjectileState,
  presentationSample = Math.floor(state.ageTicks),
): NativeFireballPlan {
  const frameIndex = Math.floor(state.ageTicks / NATIVE_FIREBALL_TICKS_PER_FRAME)
    % NATIVE_FIREBALL_FRAME_COUNT
  const rotation = Math.atan2(state.direction.y, state.direction.x) + Math.PI / 2
  const coreAlpha = 0.2
    + nativeFirePresentationRandom(state.id, presentationSample, 7, 0.25)
  const common = {
    rotation,
    x: 0,
    y: -10,
  }
  const alphaMultiplier = state.underpowered ? 0.5 : 1
  return {
    draws: [
      {
        ...common,
        alpha: coreAlpha * alphaMultiplier,
        blend: 'normal',
        frame: NATIVE_FIREBALL_CORE_RECORD,
        pass: 'core',
        scaleX: 3.2,
        scaleY: 4,
        tint: 0xff8000,
      },
      {
        ...common,
        alpha: alphaMultiplier,
        blend: 'add',
        frame: NATIVE_FIREBALL_FRAME_FIRST + frameIndex,
        pass: 'additive-body',
        scaleX: 2,
        scaleY: 2.5,
        tint: 0xffffff,
      },
      {
        ...common,
        alpha: 0.5 * alphaMultiplier,
        blend: 'normal',
        frame: NATIVE_FIREBALL_FRAME_FIRST + frameIndex,
        pass: 'body',
        scaleX: 2,
        scaleY: 2.5,
        tint: 0xffffff,
      },
    ],
    frameIndex,
    position: { ...state.position },
    regionLightPoint: null,
    worldY: state.position.y,
  }
}

export function nativeFireParticlePlan(
  state: PrimarySpellFireParticleState,
): NativeFireParticlePlan {
  const angle = nativeFirePresentationRandom(state.id, 0, 0, Math.PI * 2)
  const radius = nativeFirePresentationRandom(state.id, 0, 1, 10)
  const ageTicks = state.ageTicks
  const travel = -10 + ageTicks * 2
  const position = {
    x: state.origin.x + Math.cos(angle) * radius + state.direction.x * travel,
    y: state.origin.y - 10 + Math.sin(angle) * radius + state.direction.y * travel,
  }
  const fadeStep = nativeFireParticleFadeStep(state.id)
  const red = clamp01(1 - fadeStep * ageTicks)
  const greenBlue = clamp01(1 - fadeStep * 2 * ageTicks)
  return {
    alpha: red,
    fadeStep,
    frame: NATIVE_FIRE_PARTICLE_FRAME_FIRST + state.variant,
    position,
    regionLightPoint: null,
    rotation: (
      nativeFirePresentationRandom(state.id, 0, 2, 360) + ageTicks
    ) * Math.PI / 180,
    scale: (
      nativeFirePresentationRandom(state.id, 0, 3) + 0.5
    ) * 1.25 * 0.95 ** ageTicks,
    tint: colorTint(red, greenBlue, greenBlue),
    worldY: position.y + NATIVE_FIRE_PARTICLE_DEPTH_BIAS,
  }
}

export function nativeFireImpactPlan(
  state: PrimarySpellFireImpactState,
): NativeFireImpactPlan {
  const ageTicks = state.ageTicks
  const frameIndex = Math.floor(ageTicks / NATIVE_FIRE_IMPACT_TICKS_PER_FRAME)
  const scale = 1 + nativeFirePresentationRandom(state.id, 0, 9, 0.1)
  const angularMagnitude = 0.5 + nativeFirePresentationRandom(state.id, 0, 11)
  const angularDirection = nativeFirePresentationRandomInt(state.id, 0, 13, 2) === 1
    ? -1
    : 1
  const rotation = (
    nativeFirePresentationRandom(state.id, 0, 10, 360)
    + angularDirection * angularMagnitude * ageTicks
  ) * Math.PI / 180
  const position = {
    x: state.origin.x,
    y: state.origin.y - 10 - ageTicks,
  }
  return {
    draws: [
      {
        alpha: 0.5 * (1 - ageTicks / 16),
        blend: 'normal',
        frame: NATIVE_FIREBALL_CORE_RECORD,
        pass: 'core',
        rotation: 0,
        scaleX: 5 * scale,
        scaleY: 5 * scale,
        tint: 0xff8000,
        x: 0,
        y: 0,
      },
      {
        alpha: 1,
        blend: 'add',
        frame: NATIVE_FIRE_IMPACT_FRAME_FIRST + frameIndex,
        pass: 'burst',
        rotation,
        scaleX: scale,
        scaleY: scale,
        tint: 0xffffbf,
        x: 0,
        y: 0,
      },
    ],
    frameIndex,
    position,
    regionLightPoint: null,
    worldY: position.y + NATIVE_FIRE_IMPACT_DEPTH_BIAS,
  }
}

export function nativeFireEmberPlan(
  state: PrimarySpellFireEmberState,
): NativeFireEmberPlan {
  const bodyAlpha = Math.min(state.life, 1)
  const frame = NATIVE_FIRE_EMBER_FRAME_FIRST + Math.floor(state.phase) % 4
  const position = {
    x: state.position.x,
    y: state.position.y + state.height,
  }
  return {
    draws: [
      fireActorDraw('BadGuys', NATIVE_FIRE_EMBER_GLOW_RECORD, 'glow', {
        alpha: Math.min(state.life * 0.2, 1),
        scale: Math.min(state.life, 1),
        tint: 0xff8000,
      }),
      fireActorDraw('BadGuys', frame, 'additive-body', {
        alpha: bodyAlpha,
        blend: 'add',
      }),
      fireActorDraw('BadGuys', frame, 'body', { alpha: bodyAlpha }),
    ],
    position,
    regionLightPoint: null,
    worldY: state.position.y,
  }
}

export function nativeFirePatchPlan(
  state: PrimarySpellFirePatchState,
): NativeFirePatchPlan {
  const commonScale = 1.1 * state.scale * state.fadeAlpha
  return {
    alpha: Math.min(state.drawAlpha * state.life, 1),
    atlas: 'DeadHawg',
    blend: 'add',
    entry: NATIVE_FIRE_PATCH_FRAME_FIRST
      + positiveModulo(roundHalfToEven(state.atlasPhase), NATIVE_FIRE_PATCH_FRAME_COUNT),
    position: { x: state.position.x, y: state.position.y - 20 },
    regionLightPoint: null,
    scaleX: commonScale * state.shapeSample,
    scaleY: commonScale,
    tint: 0xffffff,
    worldY: state.position.y,
  }
}

export function nativeFireGoodImpPlan(
  state: PrimarySpellFireGoodImpState,
): NativeFireGoodImpPlan {
  const facing = nativeEnemyFacingBucket('IMP', state.headingDegrees)
  const draws: NativeFireActorDraw[] = [fireActorDraw(
    'BadGuys',
    NATIVE_GOOD_IMP_BODY_FIRST + state.bodyVariant * 12 + facing,
    'body',
    {
      offset: { x: 0, y: state.verticalOffset },
      rotation: state.bodyRotationDeg * Math.PI / 180,
      scale: state.bodyScale,
    },
  )]
  if (state.effectAlpha > 0) {
    draws.push(fireActorDraw(
      'BadGuys',
      NATIVE_GOOD_IMP_UPPER_FIRST + nativeImpEffectFrame(state.effectPhase),
      'upper-effect',
      {
        alpha: state.effectAlpha,
        offset: { x: 0, y: state.verticalOffset - 10 },
        scale: state.bodyScale,
      },
    ))
  }
  if (state.contactAgeTicks !== null && state.contactOrigin !== null) {
    draws.push(fireActorDraw(
      'BadGuys',
      NATIVE_GOOD_IMP_CONTACT_FIRST + Math.min(3, Math.floor(state.contactAgeTicks / 4)),
      'contact',
      {
        offset: {
          x: state.contactOrigin.x - state.position.x,
          y: state.contactOrigin.y - state.position.y,
        },
        scale: state.contactScale,
      },
    ))
  }
  return {
    draws,
    position: { ...state.position },
    regionLightPoint: { ...state.position },
    worldY: state.position.y,
  }
}

export function nativeFireImpactLightSource(
  state: PrimarySpellFireImpactState,
): NativeBoneyardLightSource {
  const plan = nativeFireImpactPlan(state)
  return {
    intensity: Math.max(0, 1 - state.ageTicks * 0.04),
    castsDirectionalShadow: false,
    position: plan.position,
    radius: 1.5,
  }
}

/** Shared Imp provider `0x00478CC0`, projected from GoodImp's owned glow lane. */
export function nativeFireGoodImpLightSource(
  state: PrimarySpellFireGoodImpState,
  presentationFrame: number,
): NativeBoneyardLightSource {
  const radiusMagnitude = nativeFirePresentationRandom(
    state.id,
    Math.floor(presentationFrame),
    21,
    Math.fround(0.1),
  )
  const radiusSign = nativeFirePresentationRandomInt(
    state.id,
    Math.floor(presentationFrame),
    22,
    2,
  ) === 1 ? -1 : 1
  return {
    castsDirectionalShadow: false,
    intensity: Math.fround(
      Math.fround(state.lightGlow)
      * Math.fround(0.75 + nativeFirePresentationRandom(
        state.id,
        Math.floor(presentationFrame),
        20,
        Math.fround(0.25),
      )),
    ),
    position: { ...state.position },
    radius: Math.fround(0.25 + radiusSign * radiusMagnitude),
  }
}

export function nativeFireballLightSource(
  state: PrimarySpellFireProjectileState,
  presentationFrame: number,
): NativeBoneyardLightSource {
  return {
    intensity: 0.75,
    castsDirectionalShadow: NATIVE_DEFAULT_MULTIPLE_SHADOWS,
    position: { ...state.position },
    radius: Math.fround(1 + nativeFirePresentationRandom(
      state.id,
      Math.floor(presentationFrame),
      8,
      0.25,
    )),
  }
}

function colorTint(red: number, green: number, blue: number): number {
  return (
    (Math.round(clamp01(red) * 255) << 16)
    | (Math.round(clamp01(green) * 255) << 8)
    | Math.round(clamp01(blue) * 255)
  )
}

function fireActorDraw(
  atlas: NativeFireActorDraw['atlas'],
  entry: number,
  role: string,
  options: Partial<Pick<
    NativeFireActorDraw,
    'alpha' | 'blend' | 'offset' | 'rotation' | 'scale' | 'tint'
  >> = {},
): NativeFireActorDraw {
  return {
    alpha: options.alpha ?? 1,
    atlas,
    blend: options.blend ?? 'normal',
    entry,
    offset: options.offset ?? { x: 0, y: 0 },
    role,
    rotation: options.rotation ?? 0,
    scale: options.scale ?? 1,
    tint: options.tint ?? 0xffffff,
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
