import type { Vector2 } from './vector.ts'

/** Anim_Bouncer 0x00456720; +0x2C is the retained bounce, +0x38 height. */
export interface NativeBouncerMotion {
  readonly bounceVelocity: number
  readonly height: number
  readonly position: Readonly<Vector2>
  readonly rotationDegrees: number
  readonly rotationStepDegrees: number
  readonly velocity: Readonly<Vector2>
  readonly verticalVelocity: number
}

export interface NativeBouncerRandom {
  readonly float: (maximum: number) => number
  readonly integer: (maximum: number) => number
}

export function stepNativeBouncerMotion(
  source: NativeBouncerMotion,
  tick: number,
  random: NativeBouncerRandom,
): Readonly<{ motion: NativeBouncerMotion; skipped: boolean }> {
  if (source.height === 0) return { motion: source, skipped: false }
  if (tick % 3 === 0) return { motion: source, skipped: true }
  const f32 = Math.fround
  const position = { x: f32(source.position.x + source.velocity.x), y: f32(source.position.y + source.velocity.y) }
  let height = f32(source.height + source.verticalVelocity)
  let verticalVelocity = f32(source.verticalVelocity + .4)
  let bounceVelocity = source.bounceVelocity
  let rotationStepDegrees = source.rotationStepDegrees
  let velocity = source.velocity
  // Admit exact-plane landings too; the stock strict test strands motion at0.
  if (height >= 0) {
    rotationStepDegrees = f32(1 + random.float(10))
    bounceVelocity = f32(bounceVelocity * f32(.65))
    verticalVelocity = bounceVelocity
    if (random.integer(2) === 1) velocity = { x: f32(velocity.x * .65), y: f32(velocity.y * .65) }
    if (verticalVelocity > -.75) {
      bounceVelocity = 0
      verticalVelocity = 0
      velocity = { x: 0, y: 0 }
      rotationStepDegrees = 0
    }
    height = verticalVelocity
  }
  return { skipped: false, motion: { bounceVelocity, height, position, rotationStepDegrees, velocity,
    verticalVelocity, rotationDegrees: f32(source.rotationDegrees + rotationStepDegrees) } }
}
