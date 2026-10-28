import type { Vector2 } from './vector.ts'
import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { nativeHurricaneFastDistance } from './native-hurricane.ts'

export type NativeEtherDrainTargetRef =
  | Readonly<{ kind: 'enemy'; id: number; registrationOrdinal: number }>
  | Readonly<{ kind: 'golem'; id: number }>
  | Readonly<{ kind: 'loot'; id: number; registrationOrdinal: number }>
  | Readonly<{ kind: 'player'; id: string }>

export interface NativeEtherDrainTarget {
  readonly activationDelayTicks: number
  readonly forceFactor: number
  readonly nativeFlags: number
  readonly position: Readonly<Vector2>
  readonly ref: NativeEtherDrainTargetRef
}

export interface NativeEtherDrainState {
  readonly animations: readonly NativeEtherDrainAnimation[]
  readonly targetsInitialized: boolean
  readonly lastLootRegistrationOrdinal: number
  readonly loose: readonly NativeEtherDrainTargetRef[]
  readonly queried: readonly NativeEtherDrainTargetRef[]
  readonly scenery: readonly number[]
  readonly worldAnimationRefs: readonly NativeEtherDrainWorldAnimationRef[]
  readonly lastWorldAnimationIds: Readonly<Record<NativeEtherDrainWorldAnimationRef['kind'], number>>
}

export type NativeEtherDrainWorldAnimationRef =
  | Readonly<{ kind: 'enemy-death-effect' | 'primary-transient' | 'secondary-actor' | 'death-weapon'; id: number }>
  | Readonly<{ kind: 'golem-fragment'; id: number; index: number }>

export interface NativeEtherDrainWorldAnimationTarget {
  readonly bounceVelocity: number
  readonly position: Readonly<Vector2>
  readonly ref: NativeEtherDrainWorldAnimationRef
}

export interface NativeEtherDrainWorldAnimationContact {
  readonly consume: boolean
  readonly delta: Readonly<Vector2>
  readonly ref: NativeEtherDrainWorldAnimationRef
  readonly sourceActorId: number
}

export function createNativeEtherDrainState(): NativeEtherDrainState {
  return { animations: [], targetsInitialized: false, lastLootRegistrationOrdinal: -1,
    loose: [], queried: [], scenery: [], worldAnimationRefs: [],
    lastWorldAnimationIds: { 'enemy-death-effect': 0, 'primary-transient': 0, 'secondary-actor': 0,
      'death-weapon': 0, 'golem-fragment': 0 } }
}

export function nativeEtherDrainWorldAnimationKey(ref: NativeEtherDrainWorldAnimationRef): string {
  return `${ref.kind}:${ref.id}${ref.kind === 'golem-fragment' ? `:${ref.index}` : ''}`
}

export type NativeEtherDrainAnimation = NativeEtherDrainDebris | NativeEtherDrainCapturedImage

export interface NativeEtherDrainDebris {
  readonly kind: 'debris'
  readonly position: Readonly<Vector2>
  readonly direction: Readonly<Vector2>
  readonly remainingDistance: number
  readonly speed: number
  readonly oscillationDegrees: number
  readonly rotationDegrees: number
  readonly variant: 0 | 1 | 2
}

export interface NativeEtherDrainCapturedImage {
  readonly kind: 'captured'
  readonly alpha: number
  readonly atlas: 'BadGuys' | 'Demon'
  readonly entry: number
  readonly tint: number
  readonly bodyYOffset: 0 | 23
}

export function createNativeEtherDrainDebris(center: Readonly<Vector2>, position: Readonly<Vector2>,
  oscillationDegrees: number, rotationDegrees: number, variant: 0 | 1 | 2): NativeEtherDrainDebris {
  const dx = f32(position.x - center.x)
  const dy = f32(position.y - center.y)
  const distance = f32(Math.sqrt(f32(dx * dx + dy * dy)))
  const inverse = distance === 0 ? 0 : f32(1 / distance)
  return { kind: 'debris', position, direction: { x: f32(dx * inverse), y: f32(dy * inverse) },
    remainingDistance: distance, speed: 1, oscillationDegrees, rotationDegrees, variant }
}

/** 0x00404F40 accumulates the signed area and first moments in binary32. */
export function nativeEtherDrainLeafCenter(polygon: readonly Readonly<Vector2>[]): Vector2 {
  let area = 0
  let x = 0
  let y = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!
    const cross = f32(current.x * previous.y - current.y * previous.x)
    area = f32(area + cross)
    x = f32(x + f32((current.x + previous.x) * cross))
    y = f32(y + f32((current.y + previous.y) * cross))
  }
  const denominator = f32(area * 3)
  return { x: f32(x / denominator), y: f32(y / denominator) }
}

export interface NativeEtherDrainContact {
  readonly amount: number
  readonly damageFlags: 0x10a
  readonly magicContact: boolean
  readonly consume: boolean
  readonly delta: Readonly<Vector2>
  readonly ownerId: string
  readonly sourceActorId: number
  readonly target: NativeEtherDrainTargetRef
  readonly hitStrength: number
}

export const NATIVE_ETHER_DRAIN_BROAD_RADIUS = 1_024
export const NATIVE_ETHER_DRAIN_CORPSE_TIMER_TICKS = 130
export const NATIVE_ETHER_DRAIN_CONSUMPTION_DISTANCE_SQUARED = 100
const PRESSURE_DISTANCE_SQUARED = 262_144
const f32 = Math.fround

export function nativeEtherDrainTargetKey(ref: NativeEtherDrainTargetRef): string {
  return ref.kind === 'enemy' || ref.kind === 'loot'
      ? JSON.stringify([ref.kind, ref.id, ref.registrationOrdinal])
      : JSON.stringify([ref.kind, ref.id])
}

/** The loose-object prefix survives spatial refresh; new drops notify the field. */
export function refreshNativeEtherDrainTargets(
  source: NativeEtherDrainState | null,
  targets: readonly NativeEtherDrainTarget[],
  center: Readonly<Vector2>,
  refresh: boolean,
): Readonly<{ refreshed: boolean; state: NativeEtherDrainState }> {
  const live = new Set(targets.map(({ ref }) => nativeEtherDrainTargetKey(ref)))
  const loose = source?.loose.filter(ref => live.has(nativeEtherDrainTargetKey(ref))) ?? []
  let lastLootRegistrationOrdinal = source?.lastLootRegistrationOrdinal ?? -1
  let notified = false
  for (const target of targets) {
    if (target.ref.kind !== 'loot') continue
    if (target.ref.registrationOrdinal > (source?.lastLootRegistrationOrdinal ?? -1)
      && (!source?.targetsInitialized || insideBroadEllipse(center, target.position, f32(.85)))) {
      loose.push(target.ref)
      notified = true
    }
    lastLootRegistrationOrdinal = Math.max(lastLootRegistrationOrdinal, target.ref.registrationOrdinal)
  }
  const refreshed = refresh || source === null || notified
  const queried = refreshed
    ? targets.filter(target => target.ref.kind !== 'loot'
      && (target.nativeFlags & 0xc02) !== 0
      && insideBroadEllipse(center, target.position, f32(.8))).map(({ ref }) => ref)
    : source.queried.filter(ref => live.has(nativeEtherDrainTargetKey(ref)))
  return { refreshed, state: { ...(source ?? createNativeEtherDrainState()), targetsInitialized: true,
    lastLootRegistrationOrdinal, loose: Object.freeze(loose), queried: Object.freeze(queried) } }
}

/** Bouncer +1C -> 0x0045AE30 registers with nearby fields before grounding. */
export function refreshNativeEtherDrainWorldAnimations(
  source: NativeEtherDrainState,
  targets: readonly NativeEtherDrainWorldAnimationTarget[],
  center: Readonly<Vector2>,
  initialized: boolean,
): NativeEtherDrainState {
  const key = nativeEtherDrainWorldAnimationKey
  const live = new Set(targets.map(target => key(target.ref)))
  const refs = source.worldAnimationRefs.filter(ref => live.has(key(ref)))
  const retained = new Set(refs.map(key))
  const lastIds = { ...source.lastWorldAnimationIds }
  for (const { position, ref } of targets) {
    const dx = f32(position.x - center.x)
    const dy = f32(position.y - center.y)
    if ((!initialized || ref.id > source.lastWorldAnimationIds[ref.kind])
      && f32(dx * dx + dy * dy) < NATIVE_ETHER_DRAIN_BROAD_RADIUS ** 2 && !retained.has(key(ref))) {
      refs.push(ref)
      retained.add(key(ref))
    }
    lastIds[ref.kind] = Math.max(lastIds[ref.kind], ref.id)
  }
  return { ...source, worldAnimationRefs: Object.freeze(refs), lastWorldAnimationIds: lastIds }
}

/** 0x0061DA9E: separate fast normalization, squared strength and no512 cutoff. */
export function nativeEtherDrainWorldAnimationContact(
  field: Readonly<{ alpha: number; id: number; position: Readonly<Vector2> }>,
  target: NativeEtherDrainWorldAnimationTarget,
): NativeEtherDrainWorldAnimationContact | null {
  if (target.bounceVelocity !== 0) return null
  const dx = f32(field.position.x - target.position.x)
  const dy = f32(field.position.y - target.position.y)
  const squaredDistance = f32(dx * dx + dy * dy)
  const inverse = f32(1 / nativeHurricaneFastDistance(squaredDistance))
  const strength = f32(f32(Math.max(f32(.1), 1 - squaredDistance / PRESSURE_DISTANCE_SQUARED)) * 1.100000023841858)
  const component = (delta: number) => f32(f32(f32(f32(delta * inverse) * strength) * strength) * field.alpha)
  return { consume: squaredDistance < NATIVE_ETHER_DRAIN_CONSUMPTION_DISTANCE_SQUARED,
    delta: { x: component(dx), y: component(dy) }, ref: target.ref, sourceActorId: field.id }
}

function insideBroadEllipse(center: Readonly<Vector2>, point: Readonly<Vector2>, vertical: number): boolean {
  const dx = f32(point.x - center.x)
  const dy = f32(f32(point.y - center.y) / vertical)
  return f32(dx * dx + dy * dy) < NATIVE_ETHER_DRAIN_BROAD_RADIUS ** 2
}

/** 0x005F8620: physical displacement and pre-displacement contact distance. */
export function nativeEtherDrainContact(
  field: Readonly<{ alpha: number; damage: number; id: number; ownerId: string; position: Readonly<Vector2> }>,
  target: NativeEtherDrainTarget,
): Omit<NativeEtherDrainContact, 'hitStrength'> | null {
  const dx = f32(field.position.x - target.position.x)
  const dy = f32(field.position.y - target.position.y)
  const distanceSquared = f32(dx * dx + dy * dy)
  if (distanceSquared > PRESSURE_DISTANCE_SQUARED) return null
  const loose = (target.nativeFlags & 0x400) !== 0
  if (loose && target.activationDelayTicks > 0) return null
  const falloff = f32(Math.max(f32(.1), 1 - distanceSquared / PRESSURE_DISTANCE_SQUARED))
  const strength = f32(falloff * 1.100000023841858)
  const inverseDistance = distanceSquared === 0 ? 0 : f32(1 / f32(Math.sqrt(distanceSquared)))
  const component = (delta: number) => {
    let value = f32(f32(f32(delta * inverseDistance) * strength) * field.alpha)
    if (loose) value = f32(value * falloff)
    return f32(value * target.forceFactor)
  }
  let amount = distanceSquared < 400 && !loose ? f32(field.damage / 100) : 0
  if (distanceSquared < 225) amount = f32(amount * 2)
  if (distanceSquared < 100) amount = f32(amount * 2)
  if ((target.nativeFlags & 1) !== 0) amount = f32(amount * 2)
  return {
    amount,
    damageFlags: 0x10a,
    magicContact: !loose && distanceSquared < 400,
    consume: loose && distanceSquared < NATIVE_ETHER_DRAIN_CONSUMPTION_DISTANCE_SQUARED,
    delta: { x: component(dx), y: component(dy) },
    ownerId: field.ownerId,
    sourceActorId: field.id,
    target: target.ref,
  }
}

export function nativeEtherDrainEnemyForceFactor(family: string): number {
  switch (family) {
    case 'DEMON': return .5
    case 'DIREFACULTY': return f32(.35)
    case 'DEMONSKULL': return f32(.1)
    case 'HEARTMONGER': return .25
    default: return 1
  }
}

/** Anim_Manager at +1A0 runs after the field, including children born this tick. */
export function stepNativeEtherDrainAnimations(
  source: readonly NativeEtherDrainAnimation[],
  center: Readonly<Vector2>,
  sourceRng: NativeRngState,
): Readonly<{ animations: readonly NativeEtherDrainAnimation[]; pulses: readonly number[]; rng: NativeRngState }> {
  let rng = sourceRng
  const animations: NativeEtherDrainAnimation[] = []
  const pulses: number[] = []
  for (const animation of source) {
    if (animation.kind === 'captured') {
      const alpha = f32(animation.alpha - f32(.2))
      if (alpha <= 0) pulses.push(1.5)
      else animations.push({ ...animation, alpha })
      continue
    }
    const oscillation = drawNativeFloat(rng, 17)
    const speedGate = drawNativeInteger(oscillation.state, 100)
    const rotation = drawNativeFloat(speedGate.state, 5)
    rng = rotation.state
    const remainingDistance = f32(animation.remainingDistance - animation.speed)
    let speed = f32(animation.speed + f32(.05))
    if (speedGate.value === 3) speed = f32(speed * f32(.5))
    const oscillationDegrees = f32(animation.oscillationDegrees + 3 + oscillation.value)
    const perpendicular = f32(Math.sin(oscillationDegrees * Math.PI / 180) * remainingDistance / 7)
    if (remainingDistance <= 0) { pulses.push(.5); continue }
    animations.push({ ...animation, oscillationDegrees, remainingDistance, speed,
      rotationDegrees: f32(animation.rotationDegrees + 3 + rotation.value),
      position: {
        x: f32(center.x + remainingDistance * animation.direction.x + perpendicular * animation.direction.y),
        y: f32(center.y + remainingDistance * animation.direction.y - perpendicular * animation.direction.x),
      },
    })
  }
  return { animations: Object.freeze(animations), pulses: Object.freeze(pulses), rng }
}

export function nativeEtherDrainCapturesFamily(family: string): boolean {
  return ['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE', 'ZOMBIE', 'DEMON', 'SPIDER', 'IMP', 'WRAITH', 'MAGGOT'].includes(family)
}
