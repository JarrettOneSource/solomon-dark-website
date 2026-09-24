import { drawNativeFloat } from '../core-kernels/native-rng.ts'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeSecondaryAtlas } from './native-secondary-assets.ts'
import { repeatedFloatDecay, repeatedFloatMultiply } from './native-secondary-draws.ts'
import type { NativeSecondarySpriteDraw } from './native-secondary-presentation-types.ts'

// DeadHawg builder 004E8A90 loads records sequentially. These inline fields
// are unrelated to the compact-decoration array (records 114..144).
export const NATIVE_ICEBLAST_RECORD = 16
export const NATIVE_ICE_GROUND_RECORD = 17
const BURST_GROWTH = [1.02, 1.015, 1.01] as const
const BURST_LOSS = [0.05, 0.05, 0.065] as const
const PERSPECTIVE = Math.fround(0.8)
const ANGULAR_DECAY = Math.fround(0.975)
const HEIGHT_DECAY = Math.fround(0.99)
const SNOW_LOSS = Math.fround(0.02)
const PI = Math.fround(Math.PI)

export function freezeWaveVisualDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): Readonly<{
  backgroundDraws: readonly NativeSecondarySpriteDraw[]
  draws: readonly NativeSecondarySpriteDraw[]
  underlayDraws: readonly NativeSecondarySpriteDraw[]
}> {
  if (actor.presentationRng === null) {
    throw new TypeError('FreezeWave presentation requires its pre-consumption RNG state')
  }
  let rng = actor.presentationRng
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const underlayDraws: NativeSecondarySpriteDraw[] = []
  const backgroundDraws: NativeSecondarySpriteDraw[] = []
  const draws: NativeSecondarySpriteDraw[] = []
  for (let index = 0; index < BURST_GROWTH.length; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const life = repeatedFloatDecay(4.5, BURST_LOSS[index]!, age)
    if (life <= 0) continue
    const scale = repeatedFloatMultiply(1, BURST_GROWTH[index]!, age)
    underlayDraws.push(draw('DeadHawg', NATIVE_ICEBLAST_RECORD, {
      alpha: Math.min(life, 1),
      blend: 'add',
      role: `freeze-wave-burst-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: scale,
      scaleY: Math.fround(scale * PERSPECTIVE),
    }))
  }
  const groundLife = repeatedFloatDecay(1.75, 0.01, age)
  if (groundLife > 0) {
    backgroundDraws.push(draw('DeadHawg', NATIVE_ICE_GROUND_RECORD, {
      alpha: Math.min(groundLife, 1),
      role: 'freeze-wave-ring',
      scaleX: 1.5,
      scaleY: 1.5,
    }))
  }
  const snowCount = actor.enhanced ? 200 : 100
  for (let index = 0; index < snowCount; index += 1) {
    const initialAngle = drawNativeFloat(rng, 360)
    const initialAngularVelocity = drawNativeFloat(initialAngle.state, 10)
    const initialRadius = drawNativeFloat(initialAngularVelocity.state, 40)
    const radialVelocity = drawNativeFloat(initialRadius.state, 4)
    const initialHeight = drawNativeFloat(radialVelocity.state, 250)
    const scaleDraw = drawNativeFloat(initialHeight.state, 0.5)
    const initialRotation = drawNativeFloat(scaleDraw.state, 360)
    const lifeDraw = drawNativeFloat(initialRotation.state, 1.5)
    rng = lifeDraw.state
    let angle = initialAngle.value
    let angularVelocity = Math.fround(10 + initialAngularVelocity.value)
    let radius = Math.fround(20 + initialRadius.value)
    const radialStep = Math.fround(1 + radialVelocity.value)
    let height = Math.fround(50 + initialHeight.value)
    let rotation = initialRotation.value
    let life = Math.fround(2 + lifeDraw.value)
    for (let tick = 0; tick < age && life > 0; tick += 1) {
      angle = Math.fround(angle + angularVelocity)
      angularVelocity = Math.fround(angularVelocity * ANGULAR_DECAY * ANGULAR_DECAY)
      height = Math.fround(height * HEIGHT_DECAY)
      radius = Math.fround(radius + radialStep * Math.min(angularVelocity, 1))
      rotation = Math.fround(rotation + angularVelocity)
      life = Math.fround(life - SNOW_LOSS)
    }
    if (life <= 0) continue
    // Native UnitVector is (sin, -cos), with a float32 radian store.
    const radians = Math.fround(angle * PI / 180)
    const x = Math.fround(actor.position.x + radius * Math.fround(Math.sin(radians)))
    const y = Math.fround(actor.position.y - radius * Math.fround(Math.cos(radians)) * PERSPECTIVE)
    const scale = Math.fround(1 - scaleDraw.value)
    draws.push(draw('BadGuys', 72, {
      alpha: Math.min(life, 1),
      offset: { x: x - actor.position.x, y: Math.fround(y - height) - actor.position.y },
      role: `freeze-wave-snow-${index}`,
      rotationRadians: rotation * Math.PI / 180,
      scaleX: scale,
      scaleY: scale,
    }))
  }
  return { backgroundDraws, draws, underlayDraws }
}
