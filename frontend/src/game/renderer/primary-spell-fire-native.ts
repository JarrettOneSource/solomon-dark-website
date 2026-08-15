import type {
  PrimarySpellFireImpactState,
  PrimarySpellFireParticleState,
  PrimarySpellFireProjectileState,
} from '../core-kernels/primary-spells.ts'
import {
  nativeFireParticleFadeStep,
  nativeFirePresentationRandom,
  nativeFirePresentationRandomInt,
} from '../core-kernels/primary-spell-fire-native.ts'
import {
  NATIVE_DEFAULT_MULTIPLE_SHADOWS,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'

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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
