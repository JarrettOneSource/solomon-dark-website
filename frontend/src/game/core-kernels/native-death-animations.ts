import type { NativeWorldManagerRegistration } from './native-world-manager-order.ts'
import type { Vector2 } from './vector.ts'
import type { PlayerDeathEquipmentAppearance } from './player-equipment-appearance.ts'
import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { stepNativeBouncerMotion, type NativeBouncerMotion } from './native-bouncer.ts'

// Height<=20, retained speed<=5 and .65 damping bound airborne skips below41.
// These are wire lifetime envelopes; the fragment life values own retirement.
export const NATIVE_GOLEM_DEATH_MAX_AGE = { on: 710, off: 177 } as const
export const NATIVE_GOLEM_DEATH_FRAGMENT_COUNT = 30
export const NATIVE_GOLEM_DEATH_PAINTER_COUNT = NATIVE_GOLEM_DEATH_FRAGMENT_COUNT + 1
export const NATIVE_GOLEM_DEATH_STAR_TICKS = 15

export interface NativeDeathFragment extends NativeBouncerMotion {
  readonly life: number
}

export interface NativeGolemDeathAnimation {
  readonly fragments: readonly (NativeDeathFragment | null)[]
  readonly starRotationDegrees: number
  readonly starStepDegrees: number
}

export interface NativeDeathWeaponActor {
  readonly ageTicks: number
  readonly birthTick: number
  readonly deathEpoch: number
  readonly id: number
  readonly life: number
  readonly motion: NativeBouncerMotion
  readonly ownerId: string
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly weapon: PlayerDeathEquipmentAppearance['weapon']
}

export function createNativeGolemDeathAnimation(sourceRng: NativeRngState, position: Readonly<Vector2>, enhanced: boolean):
  Readonly<{ animation: NativeGolemDeathAnimation; rng: NativeRngState }> {
  let rng = sourceRng
  const angles = Array.from({ length: NATIVE_GOLEM_DEATH_FRAGMENT_COUNT }, (_, index) => index * 18)
  for (let index = 0; index < angles.length; index++) {
    const draw = drawNativeInteger(rng, angles.length)
    rng = draw.state
    ;[angles[index], angles[draw.value]] = [angles[draw.value]!, angles[index]!]
  }
  const float = (maximum: number, signed = false) => {
    const draw = drawNativeFloat(rng, maximum, signed); rng = draw.state; return draw.value
  }
  const fragments = angles.map(angle => {
    const bounceVelocity = Math.fround(-(float(3) + 2))
    const height = Math.fround(-float(20))
    const rotationDegrees = float(360)
    float(10) // Base constructor spin is overwritten by the death recipe.
    const magnitude = Math.fround(1.5 * (float(1) + .5))
    const radius = Math.fround(float(10) + 17)
    const rotationStepDegrees = float(20, true)
    const radians = angle * Math.PI / 180
    const velocity = { x: Math.fround(Math.sin(radians) * magnitude), y: Math.fround(-Math.cos(radians) * magnitude) }
    return { bounceVelocity, height, life: enhanced ? 10 : 2,
      position: { x: Math.fround(position.x + velocity.x * radius), y: Math.fround(position.y + velocity.y * radius) },
      rotationDegrees, rotationStepDegrees, velocity, verticalVelocity: bounceVelocity }
  })
  const starRotationDegrees = float(360)
  const starPitch = float(5)
  const starSample = drawNativeInteger(rng, 10); rng = starSample.state
  return { animation: { fragments, starRotationDegrees, starStepDegrees: Math.fround((starSample.value + starPitch) * .5) }, rng }
}

export function stepNativeGolemDeathAnimation(source: NativeGolemDeathAnimation, tick: number, sourceRng: NativeRngState):
  Readonly<{ animation: NativeGolemDeathAnimation; rng: NativeRngState }> {
  let rng = sourceRng
  const random = {
    float: (maximum: number) => { const draw = drawNativeFloat(rng, maximum); rng = draw.state; return draw.value },
    integer: (maximum: number) => { const draw = drawNativeInteger(rng, maximum); rng = draw.state; return draw.value },
  }
  const fragments = source.fragments.map(fragment => {
    if (fragment === null) return null
    const stepped = stepNativeBouncerMotion(fragment, tick, random)
    const life = stepped.skipped ? fragment.life : Math.fround(fragment.life - .015)
    return life <= 0 ? null : { ...stepped.motion, life }
  })
  return { animation: { ...source, fragments }, rng }
}

export function createNativeDeathWeaponActor(options: Readonly<{
  deathEpoch: number; headingIndex: number; id: number; ownerId: string; painterRegistration: NativeWorldManagerRegistration;
  position: Readonly<Vector2>; tick: number; weapon: PlayerDeathEquipmentAppearance['weapon'];
}>, sourceRng: NativeRngState): Readonly<{ actor: NativeDeathWeaponActor; rng: NativeRngState }> {
  let rng = sourceRng
  const float = (maximum: number) => { const draw = drawNativeFloat(rng, maximum); rng = draw.state; return draw.value }
  const bounceVelocity = Math.fround(-(2 + float(3)))
  const height = Math.fround(-float(20))
  const rotationDegrees = float(360)
  const rotationStepDegrees = Math.fround(1 + float(10))
  const radius = Math.fround(15 + float(10))
  const radians = options.headingIndex * 15 * Math.PI / 180
  const velocity = { x: Math.fround(Math.sin(radians) * 1.5), y: Math.fround(-Math.cos(radians) * 1.5) }
  const position = { x: Math.fround(options.position.x + velocity.x * (radius + 2)),
    y: Math.fround(options.position.y + velocity.y * radius) }
  return { actor: { ageTicks: 0, birthTick: options.tick, deathEpoch: options.deathEpoch, id: options.id, life: 99999,
    motion: { bounceVelocity, height, position, rotationDegrees, rotationStepDegrees, velocity, verticalVelocity: bounceVelocity },
    ownerId: options.ownerId, painterRegistration: options.painterRegistration, weapon: options.weapon }, rng }
}

export function stepNativeDeathWeaponActors(source: readonly NativeDeathWeaponActor[], tick: number, sourceRng: NativeRngState):
  Readonly<{ actors: readonly NativeDeathWeaponActor[]; rng: NativeRngState }> {
  let rng = sourceRng
  const random = {
    float: (maximum: number) => { const draw = drawNativeFloat(rng, maximum); rng = draw.state; return draw.value },
    integer: (maximum: number) => { const draw = drawNativeInteger(rng, maximum); rng = draw.state; return draw.value },
  }
  const actors = source.flatMap(actor => {
    const stepped = stepNativeBouncerMotion(actor.motion, tick, random)
    const life = stepped.skipped ? actor.life : Math.fround(actor.life - .015)
    return life <= 0 ? [] : [{ ...actor, ageTicks: actor.ageTicks + 1, life, motion: stepped.motion }]
  })
  return { actors, rng }
}
