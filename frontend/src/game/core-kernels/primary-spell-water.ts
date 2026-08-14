import type { PrimarySpellTransientState } from './primary-spells.ts'
import type { Vector2 } from './vector.ts'

export const WATER_FROST_PARTICLES_PER_TICK = 2

const DEGREES_TO_RADIANS = Math.PI / 180
const FROST_HEADING_STEP = 65 * DEGREES_TO_RADIANS
const FROST_SPREAD = 15 * DEGREES_TO_RADIANS
const FROST_INTRA_TICK_PHASE = FROST_HEADING_STEP / WATER_FROST_PARTICLES_PER_TICK
const FROST_JITTER_ANGLE = 45 * DEGREES_TO_RADIANS
const FROST_JITTER_RADIUS = 10
const FROST_SPEED = 4
const FROST_LIFETIME_BASE = 1.25
const FROST_LIFETIME_RANDOM = 0.05
const FROST_LIFETIME_STEP = 0.04
const FROST_NORMAL_PHASE_STEP = 0.05
const FROST_OVER_PHASE_STEP = 0.025
const FROST_ADDITIVE_ALPHA = 0.75
const FROST_ADDITIVE_ALPHA_STEP = 0.05
const FROST_CORE_SCALE_BASE = 0.5
const FROST_CORE_SCALE_RANDOM = 0.75
const FROST_CORE_GROWTH = 2
const FROST_GLINT_SCALE_BASE = 2
const FROST_GLINT_SCALE_RANDOM = 1
const FROST_GLINT_SHRINK = 0.95
const UINT32_RANGE = 0x1_0000_0000

export type WaterFrostJetKind = 'normal' | 'over'
export type WaterFrostJetBlend = 'add' | 'normal'
export type WaterFrostJetSprite = 'core' | 'glint'
export type WaterFrostJetPass = 'additive-core' | 'core' | 'glint'

export interface WaterFrostJetDraw {
  alpha: number
  blend: WaterFrostJetBlend
  pass: WaterFrostJetPass
  position: Vector2
  rotation: number
  scale: number
  sprite: WaterFrostJetSprite
  tint: number
}

export interface WaterFrostJetPlan {
  coreScale: number
  draws: readonly WaterFrostJetDraw[]
  glintScale: number
  heading: number
  kind: WaterFrostJetKind
  lifetime: number
  position: Vector2
  velocity: Vector2
  worldY: number
}

export interface WaterFrostJetEmission {
  direction: Vector2
  origin: Vector2
}

export function waterFrostJetEmission(
  emitter: Vector2,
  baseDirection: Vector2,
  tick: number,
  ordinal: number,
  id: number,
): WaterFrostJetEmission {
  const baseHeading = Math.atan2(baseDirection.x, -baseDirection.y)
  const heading = baseHeading + Math.sin(
    tick * FROST_HEADING_STEP + ordinal * FROST_INTRA_TICK_PHASE,
  ) * FROST_SPREAD
  const jitterHeading = baseHeading
    + signedWaterFrostRandom(id, 2) * FROST_JITTER_ANGLE
  const jitter = unitForHeading(
    jitterHeading,
    waterFrostRandom(id, 3) * FROST_JITTER_RADIUS,
  )
  return {
    direction: unitForHeading(heading, 1),
    origin: {
      x: emitter.x + jitter.x,
      y: emitter.y + jitter.y,
    },
  }
}

export function waterFrostJetLifetimeTicks(id: number): 32 | 33 {
  const updates = Math.floor(waterFrostJetInitialLifetime(id) / FROST_LIFETIME_STEP) + 1
  return updates === 32 ? 32 : 33
}

export function waterFrostJetPlan(
  state: PrimarySpellTransientState,
): WaterFrostJetPlan {
  const kind = waterFrostJetKind(state.id)
  const initialLifetime = waterFrostJetInitialLifetime(state.id)
  const lifetime = initialLifetime - state.ageTicks * FROST_LIFETIME_STEP
  const heading = Math.atan2(state.direction.x, -state.direction.y)
  const velocity = {
    x: state.direction.x * FROST_SPEED,
    y: state.direction.y * FROST_SPEED,
  }
  const position = {
    x: state.origin.x + velocity.x * state.ageTicks,
    y: state.origin.y + velocity.y * state.ageTicks,
  }
  const firstGrowthUpdate = Math.floor(
    (initialLifetime - 1) / FROST_LIFETIME_STEP,
  ) + 1
  const growthUpdates = Math.max(0, state.ageTicks - firstGrowthUpdate + 1)
  const initialCoreScale = FROST_CORE_SCALE_BASE
    + waterFrostRandom(state.id, 4) * FROST_CORE_SCALE_RANDOM
  const coreScale = initialCoreScale + growthUpdates * FROST_CORE_GROWTH
  const initialGlintScale = (
    FROST_GLINT_SCALE_BASE
    + waterFrostRandom(state.id, 5) * FROST_GLINT_SCALE_RANDOM
  ) * initialCoreScale
  const glintScale = initialGlintScale * FROST_GLINT_SHRINK ** growthUpdates
  const phase = state.ageTicks * (
    kind === 'normal' ? FROST_NORMAL_PHASE_STEP : FROST_OVER_PHASE_STEP
  )
  const colorRamp = kind === 'normal'
    ? Math.max(0, 1 + waterFrostRandom(state.id, 6) * 0.5 - state.ageTicks * 2)
    : 0
  const coreTint = rgb(1 - colorRamp, 1, 1)
  const glintPosition = {
    x: position.x + velocity.x * 3,
    y: position.y + velocity.y * 3,
  }
  const draws: WaterFrostJetDraw[] = [{
    alpha: kind === 'normal'
      ? Math.min(lifetime * lifetime, phase)
      : 0.5 * Math.min(lifetime, phase),
    blend: 'normal',
    pass: 'core',
    position,
    rotation: heading,
    scale: coreScale,
    sprite: 'core',
    tint: coreTint,
  }]

  const additiveCoreAlpha = FROST_ADDITIVE_ALPHA
    - state.ageTicks * FROST_ADDITIVE_ALPHA_STEP
  if (kind === 'normal' && additiveCoreAlpha > 0) {
    draws.push({
      alpha: additiveCoreAlpha,
      blend: 'add',
      pass: 'additive-core',
      position,
      rotation: heading,
      scale: coreScale * 0.5,
      sprite: 'core',
      tint: 0xffffff,
    })
  }

  draws.push({
    alpha: kind === 'normal'
      ? Math.min(lifetime * 10, 1)
      : Math.min(3 * Math.min(phase * 0.5, lifetime), 1),
    blend: 'add',
    pass: 'glint',
    position: glintPosition,
    rotation: heading,
    scale: kind === 'normal' ? Math.min(glintScale, 1) : glintScale * 0.25,
    sprite: 'glint',
    tint: 0xffffff,
  })

  return {
    coreScale,
    draws,
    glintScale,
    heading,
    kind,
    lifetime,
    position,
    velocity,
    worldY: position.y,
  }
}

export function multiplyWaterFrostTint(worldTint: number, localTint: number): number {
  const channel = (shift: number): number => Math.round(
    ((worldTint >>> shift) & 0xff) * ((localTint >>> shift) & 0xff) / 0xff,
  )
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

function waterFrostJetInitialLifetime(id: number): number {
  return FROST_LIFETIME_BASE + waterFrostRandom(id, 1) * FROST_LIFETIME_RANDOM
}

function waterFrostJetKind(id: number): WaterFrostJetKind {
  return (waterFrostHash(id, 0) & 3) === 1 ? 'over' : 'normal'
}

function signedWaterFrostRandom(id: number, salt: number): number {
  return waterFrostRandom(id, salt) * 2 - 1
}

function waterFrostRandom(id: number, salt: number): number {
  return waterFrostHash(id, salt) / UINT32_RANGE
}

function waterFrostHash(id: number, salt: number): number {
  let value = (id ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  return (value ^ (value >>> 16)) >>> 0
}

function unitForHeading(heading: number, magnitude: number): Vector2 {
  return {
    x: Math.sin(heading) * magnitude,
    y: -Math.cos(heading) * magnitude,
  }
}

function rgb(red: number, green: number, blue: number): number {
  return (Math.round(Math.max(0, Math.min(1, red)) * 0xff) << 16)
    | (Math.round(Math.max(0, Math.min(1, green)) * 0xff) << 8)
    | Math.round(Math.max(0, Math.min(1, blue)) * 0xff)
}
