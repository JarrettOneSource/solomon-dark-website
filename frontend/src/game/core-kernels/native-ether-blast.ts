import {
  drawNativeFloat,
  type NativeRngState,
} from './native-rng.ts'
import { directionFromHeading } from './primary-spell-targeting.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_ETHER_BLAST_CHARGE_PER_TICK = Math.fround(0.00700000022)
export const NATIVE_ETHER_BLAST_PULSE_FORWARD_DISTANCE = 100
export const NATIVE_ETHER_BLAST_CONTACT_RADIUS = 175
export const NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS = 100
export const NATIVE_ETHER_BLAST_PARTICLE_COUNT = 108
export const NATIVE_ETHER_BLAST_PRESENTATION_RNG_WORDS = 720
export const NATIVE_ETHER_BLAST_SCREEN_FLASH_DECAY = Math.fround(0.025)
export const NATIVE_ETHER_BLAST_SCREEN_GREEN = Math.fround(0.25)
export const NATIVE_ETHER_BLAST_WEAPON_PULSE = Math.fround(0.25)
export const NATIVE_PLAYER_CAST_WEAPON_PULSE = Math.fround(0.15)
export const NATIVE_PLAYER_WEAPON_PULSE_DECAY = Math.fround(0.899999976)

const PULSE_HEADING_LIMIT = 720
const PULSE_HEADING_STEP = 20
const PULSE_POSITION_RADIUS = 200
const PULSE_HEADING_JITTER = 10
const PULSE_SCALE_JITTER = 4
const PULSE_DAMPING = Math.fround(0.95)
const PULSE_ALPHA_LOSS_BASE = Math.fround(0.1)

export interface NativeEtherBlastChargeStep {
  readonly charge: number
  readonly crossedInteger: boolean
}

export interface NativeEtherBlastParticle {
  readonly alphaLoss: number
  readonly blue: number
  readonly damping: number
  readonly green: number
  readonly offset: Vector2
  readonly red: number
  readonly rotationDegrees: number
  readonly scale: number
  readonly spriteRecord: 11 | 45
  readonly velocity: Vector2
}

export interface NativeEtherBlastParticleFrame extends NativeEtherBlastParticle {
  readonly alpha: number
  readonly position: Vector2
}

export function advanceNativeEtherBlastCharge(
  source: number,
  capacity: number,
  fullManaAvailable: boolean,
  planeActive: boolean,
): NativeEtherBlastChargeStep {
  if (!Number.isFinite(source) || source < 0) {
    throw new RangeError('Ether Blast charge must be finite and non-negative')
  }
  if (!Number.isSafeInteger(capacity) || capacity < 0) {
    throw new RangeError('Ether Blast capacity must be a non-negative integer')
  }
  if (planeActive || !fullManaAvailable) {
    return Object.freeze({ charge: 0, crossedInteger: false })
  }
  if (capacity === 0) {
    return Object.freeze({ charge: Math.fround(source), crossedInteger: false })
  }
  const charge = Math.min(
    capacity,
    Math.fround(Math.fround(source) + NATIVE_ETHER_BLAST_CHARGE_PER_TICK),
  )
  return Object.freeze({
    charge,
    crossedInteger: Math.floor(charge) > Math.floor(source),
  })
}

export function nativeEtherBlastReleaseCharges(charge: number): number {
  if (!Number.isFinite(charge) || charge < 0) {
    throw new RangeError('Ether Blast release charge must be finite and non-negative')
  }
  return Math.round(Math.fround(charge))
}

export function nativeEtherBlastPulseOrigin(
  playerPosition: Readonly<Vector2>,
  direction: Readonly<Vector2>,
): Vector2 {
  return {
    x: Math.fround(
      playerPosition.x + direction.x * NATIVE_ETHER_BLAST_PULSE_FORWARD_DISTANCE,
    ),
    y: Math.fround(
      playerPosition.y + direction.y * NATIVE_ETHER_BLAST_PULSE_FORWARD_DISTANCE,
    ),
  }
}

export function nativeEtherBlastDamage(charges: number, currentHealth: number): number {
  if (!Number.isSafeInteger(charges) || charges < 1) {
    throw new RangeError('Ether Blast damage requires at least one integer charge')
  }
  if (!Number.isFinite(currentHealth) || currentHealth < 0) {
    throw new RangeError('Ether Blast target health must be finite and non-negative')
  }
  const factor = Math.min(
    Math.fround(0.949999988),
    Math.fround(Math.fround(charges) * Math.fround(0.150000006)),
  )
  return Math.fround(Math.max(Math.fround(0.001), Math.fround(factor * currentHealth)))
}

export function createNativeEtherBlastParticleProgram(
  source: NativeRngState,
): Readonly<{
  particles: readonly NativeEtherBlastParticle[]
  rng: NativeRngState
}> {
  let rng = source
  const particles: NativeEtherBlastParticle[] = []
  for (let heading = 0; heading < PULSE_HEADING_LIMIT; heading += PULSE_HEADING_STEP) {
    const core = createParticle(rng, heading, 11)
    rng = core.rng
    particles.push(core.particle)
    for (let copy = 0; copy < 2; copy += 1) {
      const ray = createParticle(rng, heading, 45)
      rng = ray.rng
      particles.push(ray.particle)
    }
  }
  if (particles.length !== NATIVE_ETHER_BLAST_PARTICLE_COUNT) {
    throw new Error('Ether Blast particle census diverged')
  }
  return Object.freeze({ particles: Object.freeze(particles), rng })
}

export function nativeEtherBlastParticleFrame(
  particle: NativeEtherBlastParticle,
  ageTicks: number,
): NativeEtherBlastParticleFrame {
  if (!Number.isFinite(ageTicks) || ageTicks < 0) {
    throw new RangeError('Ether Blast presentation age must be finite and non-negative')
  }
  const wholeTicks = Math.floor(ageTicks)
  const fraction = ageTicks - wholeTicks
  let velocity = { ...particle.velocity }
  let position = { ...particle.offset }
  for (let tick = 0; tick < wholeTicks; tick += 1) {
    position = {
      x: Math.fround(position.x + velocity.x),
      y: Math.fround(position.y + velocity.y),
    }
    velocity = {
      x: Math.fround(velocity.x * particle.damping),
      y: Math.fround(velocity.y * particle.damping),
    }
  }
  position = {
    x: Math.fround(position.x + velocity.x * fraction),
    y: Math.fround(position.y + velocity.y * fraction),
  }
  return Object.freeze({
    ...particle,
    alpha: Math.max(0, Math.fround(1 - ageTicks * particle.alphaLoss)),
    position,
  })
}

function createParticle(
  source: NativeRngState,
  heading: number,
  spriteRecord: 11 | 45,
): Readonly<{ particle: NativeEtherBlastParticle; rng: NativeRngState }> {
  const radialDistance = drawNativeFloat(source, PULSE_POSITION_RADIUS)
  const headingJitter = drawNativeFloat(
    radialDistance.state,
    PULSE_HEADING_JITTER,
    true,
  )
  const scaleJitter = drawNativeFloat(headingJitter.state, PULSE_SCALE_JITTER)
  let rng = scaleJitter.state
  let green = Math.fround(0.5)
  if (spriteRecord === 45) {
    const greenJitter = drawNativeFloat(rng, Math.fround(0.8))
    rng = greenJitter.state
    green = Math.fround(green + greenJitter.value)
  }
  const speedJitter = drawNativeFloat(rng, Math.fround(5))
  const alphaJitter = drawNativeFloat(
    speedJitter.state,
    spriteRecord === 11 ? Math.fround(0.05) : Math.fround(0.25),
  )
  const positionDirection = directionFromHeading(heading + headingJitter.value)
  const velocityDirection = directionFromHeading(heading)
  const speed = spriteRecord === 11
    ? speedJitter.value
    : Math.fround(5 + speedJitter.value)
  const alphaLossFloor = spriteRecord === 11 ? Math.fround(0.1) : Math.fround(0.25)
  return Object.freeze({
    particle: Object.freeze({
      alphaLoss: Math.fround(
        PULSE_ALPHA_LOSS_BASE * Math.fround(alphaLossFloor + alphaJitter.value),
      ),
      blue: 1,
      damping: PULSE_DAMPING,
      green,
      offset: {
        x: Math.fround(radialDistance.value * positionDirection.x),
        y: Math.fround(radialDistance.value * positionDirection.y),
      },
      red: 1,
      rotationDegrees: heading,
      scale: Math.fround(1 + scaleJitter.value),
      spriteRecord,
      velocity: {
        x: Math.fround(speed * velocityDirection.x),
        y: Math.fround(speed * velocityDirection.y),
      },
    }),
    rng: alphaJitter.state,
  })
}
