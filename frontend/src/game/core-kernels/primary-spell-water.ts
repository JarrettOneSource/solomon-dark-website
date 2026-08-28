import type { PrimarySpellWaterTransientState } from './primary-spells.ts'
import type { Vector2 } from './vector.ts'

export const WATER_FROST_PARTICLES_PER_TICK = 2
export const WATER_FROST_UNDERPOWERED_PARTICLES_PER_TICK = 1
export const WATER_FROST_MAX_PARTICLES_PER_TICK = 10
export const WATER_FROST_MINIMUM_SPEED = 4
export const WATER_FROST_MAXIMUM_SPEED = 10

const DEGREES_TO_RADIANS = Math.fround(Math.PI) / 180
const FROST_HEADING_MULTIPLIER = 65
const FROST_CAST_SPEED = 1 * DEGREES_TO_RADIANS
const FROST_JITTER_ANGLE = 45 * DEGREES_TO_RADIANS
const FROST_JITTER_RADIUS = 10
const FROST_SPEED = WATER_FROST_MINIMUM_SPEED
const FROST_LIFETIME_BASE = 1.25
const FROST_LIFETIME_RANDOM = Math.fround(0.05)
const FROST_LIFETIME_STEP = Math.fround(0.04)
const FROST_NORMAL_PHASE_STEP = Math.fround(0.05)
const FROST_OVER_PHASE_STEP = Math.fround(FROST_NORMAL_PHASE_STEP * 0.5)
const FROST_ADDITIVE_ALPHA = 0.75
const FROST_ADDITIVE_ALPHA_STEP = 0.05000000074505806
const FROST_CORE_SCALE_BASE = 0.5
const FROST_CORE_SCALE_RANDOM = Math.fround(0.75)
const FROST_CORE_GROWTH = 0.009999999776482582
const FROST_GLINT_SCALE_BASE = 2
const FROST_GLINT_SCALE_RANDOM = 1
const FROST_GLINT_SHRINK = 0.949999988079071
const FROST_COLOR_RAMP_RANDOM = Math.fround(0.1)
const FROST_COLOR_RAMP_STEP = 0.07500000298023224
const FROST_OPACITY_MULTIPLIER = 1
const FROST_NORMAL_GLINT_OPACITY_GATE = 0.8999999761581421
const UINT32_RANGE = 0x1_0000_0000

export type WaterFrostJetKind = 'normal' | 'over'
export type WaterFrostJetBlend = 'add' | 'normal'
export type WaterFrostJetSprite = 'core' | 'glint'
export type WaterFrostJetPass = 'additive-core' | 'core' | 'glint'

export interface WaterFrostJetColor {
  blue: number
  green: number
  red: number
}

export interface WaterFrostJetDraw {
  alpha: number
  blend: WaterFrostJetBlend
  color: WaterFrostJetColor
  pass: WaterFrostJetPass
  position: Vector2
  rotation: number
  scale: number
  sprite: WaterFrostJetSprite
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
  jitterRadius: number
  origin: Vector2
  speed: number
}

export interface WaterFrostJetChainingState {
  readonly ageTicks: number
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
}

export interface WaterFrostJetObstruction {
  distance: number
  point: Vector2
}

export interface WaterFrostJetPainterPolicy {
  lane: 'post-world-queue' | 'world-sorted'
  queueFamily: 'zanim' | null
}

interface WaterFrostJetFields {
  additiveCoreAlpha: number
  colorRamp: number
  coreScale: number
  glintScale: number
  lifetime: number
  opacityMultiplier: number
  phase: number
}

export function waterFrostJetEmission(
  emitter: Vector2,
  baseDirection: Vector2,
  tick: number,
  ordinal: number,
  id: number,
  particleCount: number,
  speed: number,
): WaterFrostJetEmission {
  const baseHeading = Math.atan2(baseDirection.x, -baseDirection.y)
  const phaseStep = Math.fround(FROST_HEADING_MULTIPLIER / particleCount)
  let phase = Math.fround(tick)
  for (let index = 0; index < ordinal; index += 1) {
    phase = Math.fround(phase + phaseStep)
  }
  const heading = baseHeading + Math.sin(
    phase * FROST_HEADING_MULTIPLIER * DEGREES_TO_RADIANS,
  ) * FROST_CAST_SPEED
  const jitterHeading = baseHeading
    + signedWaterFrostBoundedRandom(id, 2, FROST_JITTER_ANGLE)
  const jitterRadius = waterFrostBoundedRandom(id, 3, FROST_JITTER_RADIUS)
  const jitter = unitForHeading(
    jitterHeading,
    jitterRadius,
  )
  return {
    direction: float32Vector(unitForHeading(heading, 1)),
    jitterRadius,
    origin: {
      x: Math.fround(emitter.x + Math.fround(jitter.x)),
      y: Math.fround(emitter.y + Math.fround(jitter.y)),
    },
    speed,
  }
}

export function waterFrostJetParticleCount(
  widenHalfDegrees: number,
  enhancedEffects = true,
): number {
  return 1 - Math.trunc((widenHalfDegrees + 15) / (enhancedEffects ? -10 : -20))
}

export function waterFrostJetSpeed(widenHalfDegrees: number): number {
  const factor = Math.fround(
    Math.fround(widenHalfDegrees / 2.5) * Math.fround(0.05000000074505806) + 1,
  )
  return Math.fround(FROST_SPEED * factor)
}

export function waterFrostJetObstruction(
  emission: WaterFrostJetEmission,
  casterPosition: Vector2,
  id: number,
  clip: (start: Vector2, end: Vector2) => Vector2 | null,
  underpowered = false,
): WaterFrostJetObstruction | null {
  if (waterFrostJetKind(id, underpowered) !== 'normal') return null
  const velocity = frostVelocity(emission.direction, emission.speed)
  const predictionSteps = Math.fround(
    waterFrostJetInitialLifetime(id) / FROST_LIFETIME_STEP + emission.jitterRadius,
  )
  const predictionEnd = {
    x: Math.fround(casterPosition.x + Math.fround(velocity.x * predictionSteps)),
    y: Math.fround(casterPosition.y + Math.fround(velocity.y * predictionSteps)),
  }
  const hit = clip(casterPosition, predictionEnd)
  if (!hit) return null
  const point = float32Vector(hit)
  const distance = nativeFloat32Distance(emission.origin, point)
  return {
    distance: nativeFloat32DistanceSquared(casterPosition, emission.origin)
        > nativeFloat32DistanceSquared(casterPosition, point)
      ? 0
      : distance,
    point,
  }
}

export function waterFrostJetLifetimeTicks(id: number): 32 | 33 {
  let lifetime = waterFrostJetInitialLifetime(id)
  let updates = 0
  do {
    updates += 1
    lifetime = Math.fround(lifetime - FROST_LIFETIME_STEP)
  } while (lifetime > 0)
  return updates === 32 ? 32 : 33
}

export function waterFrostJetPainterLane(
  kind: WaterFrostJetKind,
): WaterFrostJetPainterPolicy {
  return kind === 'normal'
    ? { lane: 'world-sorted', queueFamily: 'zanim' }
    : { lane: 'post-world-queue', queueFamily: null }
}

export function waterFrostJetPlan(
  state: PrimarySpellWaterTransientState,
): WaterFrostJetPlan {
  const kind = waterFrostJetKind(state.id, state.underpowered)
  const fields = waterFrostJetFields(state.id, state.ageTicks, kind, state.underpowered)
  const heading = Math.atan2(state.direction.x, -state.direction.y)
  const motion = waterFrostJetMotion(state)
  const { position, velocity } = motion
  return waterFrostJetPlanFromFields(kind, fields, heading, position, velocity)
}

export function waterFrostJetChainingPlan(
  state: WaterFrostJetChainingState,
): WaterFrostJetPlan {
  const fields = waterFrostJetFields(state.id, state.ageTicks, 'normal', false)
  let lifetime = waterFrostJetInitialLifetime(state.id)
  let coreScale = Math.fround(0.5)
  const completedUpdates = Math.max(0, Math.floor(state.ageTicks))
  for (let tick = 0; tick < completedUpdates; tick += 1) {
    lifetime = Math.fround(lifetime - FROST_LIFETIME_STEP)
    if (lifetime < 1) coreScale = Math.fround(coreScale + FROST_CORE_GROWTH)
    coreScale = Math.fround(coreScale - FROST_CORE_GROWTH)
  }
  const velocity = frostVelocity(state.direction, FROST_SPEED)
  const position = float32Vector(state.origin)
  for (let tick = 0; tick < completedUpdates; tick += 1) {
    position.x = Math.fround(position.x + velocity.x)
    position.y = Math.fround(position.y + velocity.y)
  }
  return waterFrostJetPlanFromFields(
    'normal',
    { ...fields, coreScale },
    Math.atan2(state.direction.x, -state.direction.y),
    position,
    velocity,
  )
}

function waterFrostJetPlanFromFields(
  kind: WaterFrostJetKind,
  fields: WaterFrostJetFields,
  heading: number,
  position: Vector2,
  velocity: Vector2,
): WaterFrostJetPlan {
  const coreColor = color(1 - fields.colorRamp, 1, 1)
  const glintPosition = {
    x: Math.fround(position.x + Math.fround(velocity.x * 3)),
    y: Math.fround(position.y + Math.fround(velocity.y * 3)),
  }
  const draws: WaterFrostJetDraw[] = [{
    alpha: kind === 'normal'
      ? Math.fround(fields.opacityMultiplier * Math.min(
        Math.fround(fields.lifetime * fields.lifetime),
        fields.phase,
      ))
      : Math.fround(0.5 * Math.min(fields.lifetime, fields.phase)),
    blend: 'normal',
    color: coreColor,
    pass: 'core',
    position,
    rotation: heading,
    scale: fields.coreScale,
    sprite: 'core',
  }]

  if (kind === 'normal' && fields.additiveCoreAlpha > 0) {
    draws.push({
      alpha: fields.additiveCoreAlpha,
      blend: 'add',
      color: color(1, 1, 1),
      pass: 'additive-core',
      position,
      rotation: heading,
      scale: Math.fround(fields.coreScale * 0.5),
      sprite: 'core',
    })
  }

  if (kind === 'over' || fields.opacityMultiplier >= FROST_NORMAL_GLINT_OPACITY_GATE) {
    draws.push({
      alpha: kind === 'normal'
        ? Math.fround(
          fields.opacityMultiplier * Math.min(fields.lifetime * 10, 1),
        )
        : Math.fround(Math.min(3 * Math.min(fields.phase * 0.5, fields.lifetime), 1)),
      blend: 'add',
      color: color(1, 1, 1),
      pass: 'glint',
      position: glintPosition,
      rotation: heading,
      scale: kind === 'normal'
        ? Math.min(fields.glintScale, 1)
        : Math.fround(fields.glintScale * 0.25),
      sprite: 'glint',
    })
  }

  return {
    coreScale: fields.coreScale,
    draws,
    glintScale: fields.glintScale,
    heading,
    kind,
    lifetime: fields.lifetime,
    position,
    velocity,
    worldY: position.y,
  }
}

export function packWaterFrostTint(localColor: WaterFrostJetColor): number {
  const channel = (value: number): number => Math.trunc(clampUnit(Math.fround(value)) * 255)
  return (channel(localColor.red) << 16)
    | (channel(localColor.green) << 8)
    | channel(localColor.blue)
}

export function quantizeWaterFrostAlpha(alpha: number): number {
  return Math.trunc(clampUnit(Math.fround(alpha)) * 255) / 255
}

function waterFrostJetInitialLifetime(id: number): number {
  return Math.fround(
    FROST_LIFETIME_BASE
      + waterFrostBoundedRandom(id, 1, FROST_LIFETIME_RANDOM),
  )
}

function waterFrostJetFields(
  id: number,
  ageTicks: number,
  kind: WaterFrostJetKind,
  underpowered: boolean,
): WaterFrostJetFields {
  const completedUpdates = Math.max(0, Math.floor(ageTicks))
  let lifetime = waterFrostJetInitialLifetime(id)
  let phase = 0
  let additiveCoreAlpha = Math.fround(
    FROST_ADDITIVE_ALPHA * (underpowered ? 0.25 : 1),
  )
  let coreScale = Math.fround(
    FROST_CORE_SCALE_BASE
      + waterFrostBoundedRandom(id, 4, FROST_CORE_SCALE_RANDOM),
  )
  let glintScale = Math.fround(
    (FROST_GLINT_SCALE_BASE
      + waterFrostBoundedRandom(id, 5, FROST_GLINT_SCALE_RANDOM))
      * coreScale,
  )
  let colorRamp = kind === 'normal'
    ? Math.fround(1 + waterFrostBoundedRandom(id, 6, FROST_COLOR_RAMP_RANDOM))
    : 0
  const opacityMultiplier = Math.fround(
    FROST_OPACITY_MULTIPLIER * (underpowered ? 0.25 : 1),
  )
  const phaseStep = kind === 'normal' ? FROST_NORMAL_PHASE_STEP : FROST_OVER_PHASE_STEP

  for (let tick = 0; tick < completedUpdates; tick += 1) {
    lifetime = Math.fround(lifetime - FROST_LIFETIME_STEP)
    phase = Math.fround(phase + phaseStep)
    additiveCoreAlpha = Math.fround(additiveCoreAlpha - FROST_ADDITIVE_ALPHA_STEP)
    colorRamp = Math.fround(Math.max(0, colorRamp - FROST_COLOR_RAMP_STEP))
    if (lifetime < 1) {
      glintScale = Math.fround(glintScale * FROST_GLINT_SHRINK)
      coreScale = Math.fround(coreScale + FROST_CORE_GROWTH)
    }
  }

  return {
    additiveCoreAlpha,
    colorRamp,
    coreScale,
    glintScale,
    lifetime,
    opacityMultiplier,
    phase,
  }
}

export function waterFrostJetKind(
  id: number,
  underpowered = false,
): WaterFrostJetKind {
  if (underpowered) return 'normal'
  return (waterFrostHash(id, 0) & 3) === 1 ? 'over' : 'normal'
}

function signedWaterFrostRandom(id: number, salt: number): number {
  return waterFrostRandom(id, salt) * 2 - 1
}

function signedWaterFrostBoundedRandom(id: number, salt: number, bound: number): number {
  return Math.fround(signedWaterFrostRandom(id, salt) * Math.fround(bound))
}

function waterFrostBoundedRandom(id: number, salt: number, bound: number): number {
  return Math.fround(waterFrostRandom(id, salt) * Math.fround(bound))
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

function float32Vector(vector: Vector2): Vector2 {
  return { x: Math.fround(vector.x), y: Math.fround(vector.y) }
}

function waterFrostJetMotion(state: PrimarySpellWaterTransientState): {
  position: Vector2
  velocity: Vector2
} {
  const velocity = frostVelocity(state.direction, state.speed)
  const obstructionPoint = state.obstructionPoint
  let pendingDistance = state.obstructionDistance
  let currentVelocity = velocity
  const position = float32Vector(state.origin)
  const completedUpdates = Math.max(0, Math.floor(state.ageTicks))
  for (let tick = 0; tick < completedUpdates; tick += 1) {
    if (pendingDistance !== null && obstructionPoint !== null) {
      pendingDistance = Math.fround(
        pendingDistance - nativeFloat32Distance({ x: 0, y: 0 }, currentVelocity),
      )
      if (pendingDistance <= 0) {
        position.x = Math.fround(obstructionPoint.x)
        position.y = Math.fround(obstructionPoint.y)
        const sign = waterFrostSplaySign(state.id)
        currentVelocity = {
          x: Math.fround(sign * currentVelocity.y * 0.5),
          y: Math.fround(sign * -currentVelocity.x * 0.5),
        }
        pendingDistance = null
      }
    }
    position.x = Math.fround(position.x + currentVelocity.x)
    position.y = Math.fround(position.y + currentVelocity.y)
  }
  return { position, velocity: currentVelocity }
}

function frostVelocity(direction: Vector2, speed: number): Vector2 {
  const speedFactor = Math.fround(speed / FROST_SPEED)
  return {
    x: Math.fround(Math.fround(Math.fround(direction.x) * FROST_SPEED) * speedFactor),
    y: Math.fround(Math.fround(Math.fround(direction.y) * FROST_SPEED) * speedFactor),
  }
}

function waterFrostSplaySign(id: number): -1 | 1 {
  return (waterFrostHash(id, 7) & 1) === 0 ? -1 : 1
}

function nativeFloat32Distance(first: Vector2, second: Vector2): number {
  return Math.fround(Math.sqrt(nativeFloat32DistanceSquared(first, second)))
}

function nativeFloat32DistanceSquared(first: Vector2, second: Vector2): number {
  const dx = Math.fround(Math.fround(first.x) - Math.fround(second.x))
  const dy = Math.fround(Math.fround(first.y) - Math.fround(second.y))
  return Math.fround(dx * dx + dy * dy)
}

function color(red: number, green: number, blue: number): WaterFrostJetColor {
  return {
    blue: Math.max(0, Math.min(1, blue)),
    green: Math.max(0, Math.min(1, green)),
    red: Math.max(0, Math.min(1, red)),
  }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}
