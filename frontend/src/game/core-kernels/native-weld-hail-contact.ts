import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { NativeWeldHailstonesState } from './native-weld-primary-runtime.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS = 3
export const NATIVE_WELD_HAIL_SUBSTEP_DISTANCE = 10
export const NATIVE_WELD_HAIL_LOOKAHEAD_DISTANCE = 30
export const NATIVE_WELD_HAIL_TARGET_RADIUS_FACTOR = 1.5
export const NATIVE_WELD_HAIL_COLD_SLOW_FACTOR = 0.5
export const NATIVE_WELD_HAIL_COLD_SLOW_TICKS = 250
export const NATIVE_WELD_HAIL_KNOCKBACK_TICK_FACTOR = 20
export const NATIVE_WELD_HAIL_LINE_ALPHA_STEP = Math.fround(0.075)
export const NATIVE_WELD_HAIL_FLASH_ALPHA_STEP = Math.fround(0.1)

const HAIL_TERRAIN_PARTICLE_COUNT_PER_ROCK = 15
const HAIL_TERRAIN_PARTICLE_ALPHA_STEP = Math.fround(0.125)
const HAIL_TERRAIN_PARTICLE_VELOCITY_FACTOR = Math.fround(0.92)
const HAIL_TERRAIN_BOUNCER_ALPHA_STEP = Math.fround(0.015)
const HAIL_TERRAIN_BOUNCER_GRAVITY = Math.fround(0.4)
const HAIL_TERRAIN_BOUNCER_RESTITUTION = Math.fround(0.65)
const HAIL_TERRAIN_BOUNCER_SETTLE_VELOCITY = Math.fround(-0.75)

interface NativeWeldHailActorBase {
  readonly ageTicks: number
  readonly birthTick: number
  readonly buildId: 1008
  readonly direction: Vector2
  readonly id: number
  readonly lightRegistration: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly vector: readonly number[]
  readonly worldKey: string
}

export interface NativeWeldHailTerrainParticleState extends NativeWeldHailActorBase {
  readonly alpha: number
  readonly alphaStep: number
  readonly kind: 'weld-hail-terrain-particle'
  readonly position: Vector2
  readonly record: 45
  readonly rotationDegrees: number
  readonly scale: number
  readonly tint: number
  readonly velocity: Vector2
  readonly velocityFactor: number
}

export interface NativeWeldHailTerrainBouncerState extends NativeWeldHailActorBase {
  readonly alpha: number
  readonly bounceVelocity: number
  readonly enhancedShadow: boolean
  readonly height: number
  readonly kind: 'weld-hail-terrain-bouncer'
  readonly position: Vector2
  readonly record: 32
  readonly rotationDegrees: number
  readonly rotationStepDegrees: number
  readonly scale: number
  readonly velocity: Vector2
  readonly verticalVelocity: number
}

export interface NativeWeldHailLineState extends NativeWeldHailActorBase {
  readonly alpha: number
  readonly alphaStep: number
  readonly end: Vector2
  readonly endAlpha: number
  readonly kind: 'weld-hail-line'
  readonly start: Vector2
  readonly width: number
}

export interface NativeWeldHailFlashState extends NativeWeldHailActorBase {
  readonly alpha: number
  readonly alphaStep: number
  readonly kind: 'weld-hail-flash'
  readonly position: Vector2
  readonly record: 15
}

export interface NativeWeldHailKnockbackState extends NativeWeldHailActorBase {
  readonly delta: Vector2
  readonly kind: 'weld-hail-knockback'
  readonly remainingTicks: number
  readonly targetId: string
}

export type NativeWeldHailChildActorState =
  | NativeWeldHailFlashState
  | NativeWeldHailKnockbackState
  | NativeWeldHailLineState
  | NativeWeldHailTerrainBouncerState
  | NativeWeldHailTerrainParticleState

export function createNativeWeldHailTerrainImpact(input: {
  readonly actor: NativeWeldHailstonesState
  readonly enhancedEffects: boolean
  readonly firstId: number
  readonly rng: NativeRngState
  readonly tick: number
}): Readonly<{
  actors: readonly (NativeWeldHailTerrainBouncerState | NativeWeldHailTerrainParticleState)[]
  nextId: number
  rng: NativeRngState
}> {
  const { actor } = input
  if (actor.rocks.length === 0) {
    return Object.freeze({ actors: Object.freeze([]), nextId: input.firstId, rng: input.rng })
  }
  const actors: Array<NativeWeldHailTerrainBouncerState | NativeWeldHailTerrainParticleState> = []
  let rng = input.rng
  let nextId = input.firstId
  let angle = Math.fround(normalizeDegrees(directionHeading(actor.direction) + 100))
  const rockStep = Math.fround(160 / actor.rocks.length)

  for (let rockIndex = 0; rockIndex < actor.rocks.length; rockIndex += 1) {
    for (let index = 0; index < HAIL_TERRAIN_PARTICLE_COUNT_PER_ROCK; index += 1) {
      const angleStep = drawNativeInteger(rng, 5); rng = angleStep.state
      angle = Math.fround(angle + angleStep.value + 24)
      const speed = drawNativeFloat(rng, 4); rng = speed.state
      const lead = drawNativeFloat(rng, 5); rng = lead.state
      const scale = drawNativeFloat(rng, Math.fround(0.25)); rng = scale.state
      const alpha = drawNativeFloat(rng, Math.fround(0.75)); rng = alpha.state
      const radial = directionFromHeading(angle)
      const velocity = Object.freeze({
        x: Math.fround(radial.x * Math.fround(speed.value + 1)),
        y: Math.fround(radial.y * Math.fround(speed.value + 1)),
      })
      const distance = Math.fround(lead.value + 3)
      actors.push(Object.freeze({
        ...hailActorBase(actor, nextId, input.tick),
        alpha: Math.fround(alpha.value + 0.25),
        alphaStep: HAIL_TERRAIN_PARTICLE_ALPHA_STEP,
        kind: 'weld-hail-terrain-particle',
        position: Object.freeze({
          x: Math.fround(actor.origin.x + velocity.x * distance),
          y: Math.fround(actor.origin.y - 35 + velocity.y * distance),
        }),
        record: 45,
        rotationDegrees: angle,
        scale: Math.fround(scale.value + 0.25),
        tint: 0xffffff,
        velocity,
        velocityFactor: HAIL_TERRAIN_PARTICLE_VELOCITY_FACTOR,
      }))
      nextId += 1
    }

    const bounce = drawNativeFloat(rng, 3); rng = bounce.state
    const height = drawNativeFloat(rng, 20); rng = height.state
    const rotation = drawNativeFloat(rng, 360); rng = rotation.state
    const rotationStep = drawNativeFloat(rng, 10); rng = rotationStep.state
    const scale = drawNativeFloat(rng, Math.fround(0.25)); rng = scale.state
    const distance = drawNativeFloat(rng, 10); rng = distance.state
    const speed = drawNativeFloat(rng, 1); rng = speed.state
    const angleJitter = drawNativeFloat(rng, 10); rng = angleJitter.state
    const radial = directionFromHeading(angle)
    const initialVelocity = {
      x: Math.fround(radial.x * 1.5),
      y: radial.y,
    }
    const leadDistance = Math.fround(distance.value + 10)
    const velocityScale = Math.fround(speed.value + 1)
    const velocity = Object.freeze({
      x: Math.fround(initialVelocity.x * velocityScale),
      y: Math.fround(initialVelocity.y * velocityScale),
    })
    actors.push(Object.freeze({
      ...hailActorBase(actor, nextId, input.tick),
      alpha: 1.5,
      bounceVelocity: Math.fround(-(bounce.value + 2)),
      enhancedShadow: input.enhancedEffects,
      height: Math.fround(-height.value),
      kind: 'weld-hail-terrain-bouncer',
      position: Object.freeze({
        x: Math.fround(
          actor.origin.x + initialVelocity.x * leadDistance + velocity.x * 2,
        ),
        y: Math.fround(
          actor.origin.y + initialVelocity.y * leadDistance + velocity.y * 2,
        ),
      }),
      record: 32,
      rotationDegrees: rotation.value,
      rotationStepDegrees: Math.fround(rotationStep.value + 1),
      scale: Math.fround(scale.value + 0.5),
      velocity,
      verticalVelocity: Math.fround(-(bounce.value + 2)),
    }))
    nextId += 1
    angle = Math.fround(angle + rockStep + angleJitter.value)
  }

  return Object.freeze({ actors: Object.freeze(actors), nextId, rng })
}

export function createNativeWeldHailContactPresentation(input: {
  readonly actor: NativeWeldHailstonesState
  readonly end: Vector2
  readonly firstId: number
  readonly rng: NativeRngState
  readonly start: Vector2
  readonly tick: number
}): Readonly<{
  actors: readonly [NativeWeldHailLineState, NativeWeldHailFlashState]
  rng: NativeRngState
}> {
  const endAlpha = drawNativeFloat(input.rng, Math.fround(0.25))
  const line: NativeWeldHailLineState = Object.freeze({
    ...hailActorBase(input.actor, input.firstId, input.tick),
    alpha: 1,
    alphaStep: NATIVE_WELD_HAIL_LINE_ALPHA_STEP,
    end: Object.freeze({ ...input.end }),
    endAlpha: Math.fround(endAlpha.value + 0.25),
    kind: 'weld-hail-line',
    start: Object.freeze({ ...input.start }),
    width: 6,
  })
  const flash: NativeWeldHailFlashState = Object.freeze({
    ...hailActorBase(input.actor, input.firstId + 1, input.tick),
    alpha: 1,
    alphaStep: NATIVE_WELD_HAIL_FLASH_ALPHA_STEP,
    kind: 'weld-hail-flash',
    position: Object.freeze({ ...input.end }),
    record: 15,
  })
  return Object.freeze({
    actors: Object.freeze([line, flash] as const),
    rng: endAlpha.state,
  })
}

export function createNativeWeldHailKnockback(input: {
  readonly actor: NativeWeldHailstonesState
  readonly id: number
  readonly targetId: string
  readonly tick: number
}): NativeWeldHailKnockbackState | null {
  const remainingTicks = roundHalfToEven(
    input.actor.pushback * NATIVE_WELD_HAIL_KNOCKBACK_TICK_FACTOR,
  )
  if (remainingTicks <= 0) return null
  return Object.freeze({
    ...hailActorBase(input.actor, input.id, input.tick),
    delta: Object.freeze({ ...input.actor.direction }),
    kind: 'weld-hail-knockback',
    remainingTicks,
    targetId: input.targetId,
  })
}

export function stepNativeWeldHailChild(
  actor: NativeWeldHailChildActorState,
  sourceRng: NativeRngState,
): Readonly<{
  actor: NativeWeldHailChildActorState | null
  rng: NativeRngState
}> {
  if (actor.kind === 'weld-hail-knockback') {
    return Object.freeze({ actor, rng: sourceRng })
  }
  if (actor.kind === 'weld-hail-line' || actor.kind === 'weld-hail-flash') {
    const alpha = Math.fround(actor.alpha - actor.alphaStep)
    return Object.freeze({
      actor: alpha > 0
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1, alpha })
        : null,
      rng: sourceRng,
    })
  }
  if (actor.kind === 'weld-hail-terrain-particle') {
    const alpha = Math.fround(actor.alpha - actor.alphaStep)
    if (alpha <= 0) return Object.freeze({ actor: null, rng: sourceRng })
    return Object.freeze({
      actor: Object.freeze({
        ...actor,
        ageTicks: actor.ageTicks + 1,
        alpha,
        position: Object.freeze({
          x: Math.fround(actor.position.x + actor.velocity.x),
          y: Math.fround(actor.position.y + actor.velocity.y),
        }),
        velocity: Object.freeze({
          x: Math.fround(actor.velocity.x * actor.velocityFactor),
          y: Math.fround(actor.velocity.y * actor.velocityFactor),
        }),
      }),
      rng: sourceRng,
    })
  }

  const globalTick = actor.birthTick + actor.ageTicks + 1
  if (actor.height !== 0 && globalTick % 3 === 0) {
    return Object.freeze({
      actor: Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1 }),
      rng: sourceRng,
    })
  }
  let rng = sourceRng
  let position = Object.freeze({
    x: Math.fround(actor.position.x + actor.velocity.x),
    y: Math.fround(actor.position.y + actor.velocity.y),
  })
  let velocity = actor.velocity
  let height = Math.fround(actor.height + actor.verticalVelocity)
  let verticalVelocity = Math.fround(actor.verticalVelocity + HAIL_TERRAIN_BOUNCER_GRAVITY)
  let bounceVelocity = actor.bounceVelocity
  let rotationStepDegrees = actor.rotationStepDegrees
  let rotationDegrees = Math.fround(actor.rotationDegrees + rotationStepDegrees)
  if (actor.height !== 0 && height > 0) {
    const spin = drawNativeFloat(rng, 10); rng = spin.state
    const damping = drawNativeInteger(rng, 2); rng = damping.state
    rotationStepDegrees = Math.fround(spin.value + 1)
    bounceVelocity = Math.fround(bounceVelocity * HAIL_TERRAIN_BOUNCER_RESTITUTION)
    verticalVelocity = bounceVelocity
    if (damping.value === 1) {
      velocity = Object.freeze({
        x: Math.fround(velocity.x * HAIL_TERRAIN_BOUNCER_RESTITUTION),
        y: Math.fround(velocity.y * HAIL_TERRAIN_BOUNCER_RESTITUTION),
      })
    }
    if (verticalVelocity > HAIL_TERRAIN_BOUNCER_SETTLE_VELOCITY) {
      velocity = Object.freeze({ x: 0, y: 0 })
      verticalVelocity = 0
      bounceVelocity = 0
      rotationStepDegrees = 0
    }
    height = verticalVelocity
  }
  const alpha = Math.fround(actor.alpha - HAIL_TERRAIN_BOUNCER_ALPHA_STEP)
  if (alpha <= 0) return Object.freeze({ actor: null, rng })
  return Object.freeze({
    actor: Object.freeze({
      ...actor,
      ageTicks: actor.ageTicks + 1,
      alpha,
      bounceVelocity,
      height,
      position,
      rotationDegrees,
      rotationStepDegrees,
      velocity,
      verticalVelocity,
    }),
    rng,
  })
}

function hailActorBase(
  actor: NativeWeldHailstonesState,
  id: number,
  tick: number,
): NativeWeldHailActorBase {
  return {
    ageTicks: 0,
    birthTick: tick,
    buildId: 1008,
    direction: Object.freeze({ ...actor.direction }),
    id,
    lightRegistration: null,
    origin: Object.freeze({ ...actor.origin }),
    ownerId: actor.ownerId,
    vector: Object.freeze([...actor.vector]),
    worldKey: actor.worldKey,
  }
}

function directionHeading(direction: Readonly<Vector2>): number {
  return normalizeDegrees(Math.atan2(direction.x, -direction.y) * 180 / Math.PI)
}

function directionFromHeading(degrees: number): Vector2 {
  const radians = degrees * Math.PI / 180
  return Object.freeze({
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  })
}

function normalizeDegrees(degrees: number): number {
  return (degrees % 360 + 360) % 360
}

function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}
