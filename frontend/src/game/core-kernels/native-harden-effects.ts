import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { nativeHardenBreakAngleStep } from './native-harden.ts'
import type { Vector2 } from './vector.ts'

export interface NativeHardenShardBody {
  readonly bounceVelocity: number
  readonly height: number
  readonly life: number
  readonly position: Vector2
  readonly record: number
  readonly rotationDegrees: number
  readonly rotationStepDegrees: number
  readonly velocity: Vector2
  readonly verticalVelocity: number
}

interface NativeHardenEffectOwner {
  readonly ageTicks: number
  readonly birthTick: number
  readonly id: number
  readonly ownerId: string
  readonly worldKey: string
}

export interface NativeHardenShard extends NativeHardenEffectOwner, NativeHardenShardBody {
  readonly kind: 'harden-shard'
}

export interface NativeHardenBurst extends NativeHardenEffectOwner {
  readonly alpha: number
  readonly kind: 'harden-burst'
  readonly position: Vector2
}

export type NativeHardenEffect = NativeHardenShard | NativeHardenBurst

export interface NativeHardenChip {
  readonly pitch: number
  readonly shard: NativeHardenShardBody
}

/** Native chip draw precedes resistance and flat armor, so blocked physical hits still chip. */
export function createNativeHardenChip(
  position: Vector2,
  sourceRng: NativeRngState,
): { chip: NativeHardenChip | null; rng: NativeRngState } {
  const chance = drawNativeInteger(sourceRng, 3)
  if (chance.value !== 1) return { chip: null, rng: chance.state }
  const pitch = drawNativeFloat(chance.state, Math.fround(0.1))
  const heading = drawNativeFloat(pitch.state, 360)
  const shard = createNativeHardenShardBody(position, heading.value, heading.state)
  return {
    chip: { pitch: Math.fround(1 + pitch.value), shard: shard.body },
    rng: shard.rng,
  }
}

export function createNativeHardenBreakup(
  coating: number,
  position: Vector2,
  ownerId: string,
  worldKey: string,
  tick: number,
  firstId: number,
  sourceRng: NativeRngState,
): { effects: NativeHardenEffect[]; nextId: number; pitch: number; rng: NativeRngState } {
  const pitch = drawNativeFloat(sourceRng, Math.fround(0.1), true)
  let rng = pitch.state
  let nextId = firstId
  const effects: NativeHardenEffect[] = []
  const angleStep = nativeHardenBreakAngleStep(coating)
  if (angleStep !== null) {
    for (let heading = 0; heading < 360; heading += angleStep) {
      const shard = createNativeHardenShardBody(position, heading, rng)
      rng = shard.rng
      effects.push({
        ...shard.body, ageTicks: 0, birthTick: tick, id: nextId++,
        kind: 'harden-shard', ownerId, worldKey,
      })
    }
    effects.push({
      ageTicks: 0, alpha: 1, birthTick: tick, id: nextId++,
      kind: 'harden-burst', ownerId, position: { ...position }, worldKey,
    })
  }
  return { effects, nextId, pitch: Math.fround(1 + pitch.value), rng }
}

function createNativeHardenShardBody(
  origin: Vector2,
  headingDegrees: number,
  sourceRng: NativeRngState,
): { body: NativeHardenShardBody; rng: NativeRngState } {
  const bounce = drawNativeFloat(sourceRng, 3)
  const height = drawNativeFloat(bounce.state, 20)
  const rotation = drawNativeFloat(height.state, 360)
  const spin = drawNativeFloat(rotation.state, 10)
  const record = drawNativeInteger(spin.state, 5)
  const jitter = drawNativeFloat(record.state, 10, true)
  const speed = drawNativeFloat(jitter.state, Math.fround(0.5))
  const lead = drawNativeFloat(speed.state, 10)
  const heading = Math.fround(headingDegrees + jitter.value) * Math.PI / 180
  const velocity = {
    x: Math.fround(Math.fround(Math.fround(Math.sin(heading)) * 1.5) * Math.fround(1 + speed.value)),
    y: Math.fround(Math.fround(-Math.cos(heading)) * Math.fround(1 + speed.value)),
  }
  const leadDistance = Math.fround(10 + lead.value)
  const position = {
    x: Math.fround(origin.x + Math.fround(velocity.x * leadDistance)),
    y: Math.fround(origin.y + Math.fround(velocity.y * leadDistance)),
  }
  // The shipped factory applies the final two-velocity offset only to X.
  position.x = Math.fround(position.x + velocity.x + velocity.x)
  const bounceVelocity = Math.fround(-(2 + bounce.value))
  return {
    body: {
      bounceVelocity,
      height: Math.fround(-height.value),
      life: 10,
      position,
      record: 446 + record.value,
      rotationDegrees: rotation.value,
      rotationStepDegrees: Math.fround(1 + spin.value),
      velocity,
      verticalVelocity: bounceVelocity,
    },
    rng: lead.state,
  }
}

export function stepNativeHardenEffect<T extends NativeHardenEffect>(
  source: T,
  tick: number,
  sourceRng: NativeRngState,
  canLandAt: (position: Vector2) => boolean,
): { effect: T | null; rng: NativeRngState } {
  const ageTicks = tick - source.birthTick
  if (source.kind === 'harden-burst') {
    const alpha = Math.fround(source.alpha - Math.fround(0.05))
    return { effect: alpha > 0 ? { ...source, ageTicks, alpha } : null, rng: sourceRng }
  }
  if (source.height !== 0 && tick % 3 === 0) {
    return { effect: { ...source, ageTicks }, rng: sourceRng }
  }
  const life = Math.fround(source.life - Math.fround(0.015))
  if (life <= 0) return { effect: null, rng: sourceRng }
  if (source.height === 0) return { effect: { ...source, ageTicks, life }, rng: sourceRng }
  const position = {
    x: Math.fround(source.position.x + source.velocity.x),
    y: Math.fround(source.position.y + source.velocity.y),
  }
  let height = Math.fround(source.height + source.verticalVelocity)
  let verticalVelocity = Math.fround(source.verticalVelocity + Math.fround(0.4))
  let bounceVelocity = source.bounceVelocity
  let rotationStepDegrees = source.rotationStepDegrees
  let velocity = source.velocity
  let rng = sourceRng
  let landingBlocked = false
  if (height > 0) {
    landingBlocked = !canLandAt(position)
    const spin = drawNativeFloat(rng, 10)
    const damp = drawNativeInteger(spin.state, 2)
    rng = damp.state
    rotationStepDegrees = Math.fround(1 + spin.value)
    bounceVelocity = Math.fround(source.bounceVelocity * Math.fround(0.65))
    verticalVelocity = bounceVelocity
    if (damp.value === 1) velocity = {
      x: Math.fround(velocity.x * Math.fround(0.65)),
      y: Math.fround(velocity.y * Math.fround(0.65)),
    }
    if (verticalVelocity > -0.75) {
      verticalVelocity = 0
      bounceVelocity = 0
      rotationStepDegrees = 0
      velocity = { x: 0, y: 0 }
    }
    height = verticalVelocity
  }
  return {
    effect: landingBlocked ? null : {
      ...source, ageTicks, bounceVelocity, height, life, position,
      rotationDegrees: Math.fround(source.rotationDegrees + rotationStepDegrees),
      rotationStepDegrees, velocity, verticalVelocity,
    },
    rng,
  }
}
