import type {
  NativePlayerStaffPikeBreakVfx,
  NativePlayerStaffVfx,
} from '../core-kernels/native-player-staff-action.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'

export interface PlayerStaffVfxRenderPlan {
  readonly alpha: number
  readonly blendMode: 'add' | 'normal'
  readonly entry: 15 | 40 | 45 | 88
  readonly light: null
  readonly position: Readonly<{ x: number; y: number }>
  readonly rotationRadians: number
  readonly scale: number
  readonly tint: number | null
}

export function nativePlayerStaffVfxRenderPlan(
  state: NativePlayerStaffVfx,
): PlayerStaffVfxRenderPlan {
  return Object.freeze({
    alpha: state.alpha,
    blendMode: 'add',
    entry: state.entry,
    light: null,
    position: Object.freeze({ ...state.position }),
    rotationRadians: state.rotationDegrees * Math.PI / 180,
    scale: state.scale,
    tint: state.kind === 'player-staff-smoke' ? null : state.tint,
  })
}

export interface PlayerStaffPikeBreakDraw {
  readonly alpha: number
  readonly blendMode: 'add' | 'normal'
  readonly entry: 15 | 55
  readonly offset: Readonly<{ x: number; y: number }>
  readonly role: string
  readonly rotationRadians: number
  readonly scaleX: number
  readonly scaleY: number
  readonly tint: number | null
}

interface PikeBreakDebris {
  alpha: number
  bounceProgress: number
  bounceVelocity: number
  height: number
  position: { x: number; y: number }
  rotationDegrees: number
  rotationStepDegrees: number
  velocity: { x: number; y: number }
  verticalVelocity: number
}

export function nativePlayerStaffPikeBreakDraws(
  state: NativePlayerStaffPikeBreakVfx,
): readonly PlayerStaffPikeBreakDraw[] {
  const draws: PlayerStaffPikeBreakDraw[] = []
  const fadeAlpha = repeatedFloatDecay(1, Math.fround(0.025), state.ageTicks)
  if (fadeAlpha > 0) {
    const radians = state.headingDegrees * Math.PI / 180
    draws.push(Object.freeze({
      alpha: Math.min(1, fadeAlpha),
      blendMode: 'add',
      entry: 15,
      offset: Object.freeze({
        x: Math.fround(Math.sin(radians) * 75),
        y: Math.fround(-Math.cos(radians) * 75),
      }),
      role: 'pike-break-flash',
      rotationRadians: 0,
      scaleX: 3,
      scaleY: 3,
      tint: null,
    }))
  }

  const created = createPikeBreakDebris(state.presentationRng)
  const stepped = stepPikeBreakDebris(created.debris, created.rng, state.ageTicks + 1)
  for (let index = 0; index < stepped.debris.length; index += 1) {
    const particle = stepped.debris[index]!
    if (particle.alpha <= 0) continue
    draws.push(Object.freeze({
      alpha: Math.min(1, particle.alpha),
      blendMode: 'normal',
      entry: 55,
      offset: Object.freeze({
        x: particle.position.x,
        y: particle.position.y + particle.height,
      }),
      role: `pike-break-debris-${index}`,
      rotationRadians: particle.rotationDegrees * Math.PI / 180,
      scaleX: 1,
      scaleY: 1,
      tint: null,
    }))
  }
  return Object.freeze(draws)
}

function createPikeBreakDebris(sourceRng: NativeRngState): Readonly<{
  debris: readonly PikeBreakDebris[]
  rng: NativeRngState
}> {
  const initialAngle = drawNativeFloat(sourceRng, 360)
  let angle = initialAngle.value
  let rng = initialAngle.state
  const debris: PikeBreakDebris[] = []
  for (let index = 0; index < 7; index += 1) {
    const vertical = drawNativeFloat(rng, 3)
    const height = drawNativeFloat(vertical.state, 20)
    const rotation = drawNativeFloat(height.state, 360)
    const rotationStep = drawNativeFloat(rotation.state, 10)
    const radial = drawNativeFloat(rotationStep.state, 10)
    const nextAngle = drawNativeFloat(radial.state, 10, true)
    rng = nextAngle.state
    const radians = angle * Math.PI / 180
    const velocity = {
      x: Math.fround(Math.sin(radians) * 1.5),
      y: Math.fround(-Math.cos(radians)),
    }
    const distance = Math.fround(15 + radial.value)
    debris.push({
      alpha: Math.fround(1.5),
      bounceProgress: 0,
      bounceVelocity: Math.fround(-(2 + vertical.value)),
      height: Math.fround(-height.value),
      position: {
        x: Math.fround(velocity.x * Math.fround(distance + 2)),
        y: Math.fround(velocity.y * distance),
      },
      rotationDegrees: rotation.value,
      rotationStepDegrees: Math.fround(1 + rotationStep.value),
      velocity,
      verticalVelocity: Math.fround(-(2 + vertical.value)),
    })
    angle = Math.fround(angle + 55 + nextAngle.value)
  }
  return Object.freeze({ debris: Object.freeze(debris), rng })
}

function stepPikeBreakDebris(
  source: readonly PikeBreakDebris[],
  sourceRng: NativeRngState,
  updates: number,
): Readonly<{ debris: readonly PikeBreakDebris[]; rng: NativeRngState }> {
  const debris = source.map((particle) => ({
    ...particle,
    position: { ...particle.position },
    velocity: { ...particle.velocity },
  }))
  let rng = sourceRng
  for (let tick = 0; tick < Math.floor(updates); tick += 1) {
    for (const particle of debris) {
      if (particle.height !== 0) {
        particle.position.x = Math.fround(particle.position.x + particle.velocity.x)
        particle.position.y = Math.fround(particle.position.y + particle.velocity.y)
        particle.height = Math.fround(
          particle.height + 2 * particle.verticalVelocity,
        )
        particle.verticalVelocity = Math.fround(
          particle.verticalVelocity + 2 * particle.bounceProgress * 0.4,
        )
        particle.bounceProgress = Math.min(
          1,
          Math.fround(particle.bounceProgress + 0.02),
        )
        if (particle.height > 0) {
          const rotation = drawNativeFloat(rng, 10)
          const sound = drawNativeInteger(rotation.state, 3)
          rng = sound.state
          if (sound.value === 1) {
            const pitch = drawNativeFloat(rng, 0.2)
            const sample = drawNativeInteger(pitch.state, 4)
            rng = sample.state
          }
          const damping = drawNativeInteger(rng, 2)
          rng = damping.state
          particle.rotationStepDegrees = Math.fround(1 + rotation.value)
          particle.bounceVelocity = Math.fround(particle.bounceVelocity * 0.65)
          particle.verticalVelocity = particle.bounceVelocity
          if (damping.value === 1) {
            particle.velocity.x = Math.fround(particle.velocity.x * 0.65)
            particle.velocity.y = Math.fround(particle.velocity.y * 0.65)
          }
          if (particle.verticalVelocity > -0.75) {
            particle.bounceProgress = 0
            particle.bounceVelocity = 0
            particle.height = 0
            particle.verticalVelocity = 0
            particle.velocity.x = 0
            particle.velocity.y = 0
            particle.rotationStepDegrees = 0
          } else {
            particle.height = particle.verticalVelocity
          }
        }
      }
      particle.rotationDegrees = Math.fround(
        particle.rotationDegrees + particle.rotationStepDegrees,
      )
      particle.alpha = Math.fround(particle.alpha - 0.015)
    }
  }
  return Object.freeze({ debris: Object.freeze(debris), rng })
}

function repeatedFloatDecay(initial: number, loss: number, ticks: number): number {
  let value = Math.fround(initial)
  for (let tick = 0; tick < Math.floor(ticks); tick += 1) {
    value = Math.fround(value - loss)
  }
  return value
}
