import { MAX_BONEYARD_PUPPET_HITS } from '../game-protocol-limits.ts'
import { NATIVE_WORLD_PUPPET_HIT_KINDS, type NativePuppetHitState, type NativeWorldPuppetHit } from '../../core-kernels/native-puppet-hit.ts'
import type { BoneyardBounds, BoneyardPoint } from '../../core-kernels/boneyard.ts'
import type { NativeEnemyPathState } from '../../core-kernels/native-enemy-pathfinding.ts'
import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import {
  NATIVE_WORLD_MANAGER_LANES,
  type NativeWorldManagerLane,
  type NativeWorldManagerRegistration,
} from '../../core-kernels/native-world-manager-order.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import {
  GameProtocolError,
  boundedInteger,
  finite,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  unitInterval,
  onlyKeys,
  positiveFinite,
  record,
} from './values.ts'

export function unitVector(value: unknown, field: string): Vector2 {
  const result = vector(value, field)
  if (Math.hypot(result.x, result.y) > 1.001) {
    throw new GameProtocolError(`${field} magnitude exceeds one`)
  }
  return result
}

export function vector(value: unknown, field: string): Vector2 {
  const source = record(value, field)
  onlyKeys(source, field, ['x', 'y'])
  return {
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

export function nativeWorldManagerRegistration(
  value: unknown,
  field: string,
  expectedLane: NativeWorldManagerLane,
): NativeWorldManagerRegistration {
  const source = record(value, field)
  onlyKeys(source, field, ['managerLane', 'registrationOrdinal'])
  const managerLane = limitedString(source.managerLane, `${field}.managerLane`, 16)
  if (!(NATIVE_WORLD_MANAGER_LANES as readonly string[]).includes(managerLane)) {
    throw new GameProtocolError(`${field}.managerLane is not supported`)
  }
  if (managerLane !== expectedLane) {
    throw new GameProtocolError(`${field}.managerLane must be ${expectedLane}`)
  }
  return {
    managerLane: managerLane as NativeWorldManagerLane,
    registrationOrdinal: nonnegativeInteger(
      source.registrationOrdinal,
      `${field}.registrationOrdinal`,
    ),
  }
}

export function nativeWorldPainterRegistrations(
  value: unknown,
  field: string,
  expectedLane: NativeWorldManagerRegistration['managerLane'],
  expectedCount: number,
): readonly NativeWorldManagerRegistration[] {
  const registrations = limitedArray(value, field, 512).map((entry, index) => (
    nativeWorldManagerRegistration(entry, `${field}[${index}]`, expectedLane)
  ))
  if (registrations.length !== expectedCount) {
    throw new GameProtocolError(`${field} must contain exactly ${expectedCount} roots`)
  }
  if (new Set(registrations.map(({ registrationOrdinal }) => registrationOrdinal)).size
      !== registrations.length) {
    throw new GameProtocolError(`${field} contains duplicate manager registrations`)
  }
  return registrations
}

export function absentNativeWorldManagerRegistration(value: unknown, field: string): null {
  if (value !== null) throw new GameProtocolError(`${field} must be null`)
  return null
}

export function absentNativeActorLight(source: Record<string, unknown>, field: string): null {
  return absentNativeWorldManagerRegistration(
    source.lightRegistration,
    `${field}.lightRegistration`,
  )
}

export function nullableNativeWorldManagerRegistration(
  value: unknown,
  field: string,
  expectedLane: NativeWorldManagerLane,
): NativeWorldManagerRegistration | null {
  return value === null
    ? null
    : nativeWorldManagerRegistration(value, field, expectedLane)
}

export function boneyardPoint(value: unknown, field: string): BoneyardPoint {
  return vector(value, field)
}

export function boneyardBounds(value: unknown, field: string): BoneyardBounds {
  const source = record(value, field)
  onlyKeys(source, field, ['h', 'w', 'x', 'y'])
  return {
    h: positiveFinite(source.h, `${field}.h`),
    w: positiveFinite(source.w, `${field}.w`),
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

export function nativeRngState(value: unknown, field: string): NativeRngState {
  const source = record(value, field)
  onlyKeys(source, field, ['indexA', 'indexB', 'words'])
  const words = limitedArray(source.words, `${field}.words`, 55).map((word, index) => (
    boundedInteger(word, `${field}.words[${index}]`, 0, 0x3fffffff)
  ))
  if (words.length !== 55) {
    throw new GameProtocolError(`${field}.words must contain 55 entries`)
  }
  return {
    indexA: boundedInteger(source.indexA, `${field}.indexA`, 0, 54),
    indexB: boundedInteger(source.indexB, `${field}.indexB`, 0, 54),
    words,
  }
}

export function nativeEnemyPathState(value: unknown, field: string): NativeEnemyPathState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'baseTurnRate', 'flankAngleDeg', 'flankRadius', 'flankTicksRemaining',
    'reorientationTicksRemaining', 'routePreviousVector',
    'routeRefreshTicksRemaining', 'routeTicksRemaining',
    'routeWaypointIndex', 'routeWaypoints', 'speedFactor',
    'stalledMovementTicks', 'turnFactor', 'wanderHeadingDeg',
  ])
  const routeWaypoints = source.routeWaypoints === null
    ? null
    : limitedArray(source.routeWaypoints, `${field}.routeWaypoints`, 2).map(
        (waypoint, index) => vector(waypoint, `${field}.routeWaypoints[${index}]`),
      )
  if (routeWaypoints !== null && routeWaypoints.length !== 2) {
    throw new GameProtocolError(`${field}.routeWaypoints must contain two entries`)
  }
  return {
    baseTurnRate: positiveFinite(source.baseTurnRate, `${field}.baseTurnRate`),
    flankAngleDeg: finite(source.flankAngleDeg, `${field}.flankAngleDeg`),
    flankRadius: nonnegativeFinite(source.flankRadius, `${field}.flankRadius`),
    flankTicksRemaining: nonnegativeInteger(
      source.flankTicksRemaining,
      `${field}.flankTicksRemaining`,
    ),
    reorientationTicksRemaining: nonnegativeInteger(
      source.reorientationTicksRemaining,
      `${field}.reorientationTicksRemaining`,
    ),
    routePreviousVector: source.routePreviousVector === null
      ? null
      : vector(source.routePreviousVector, `${field}.routePreviousVector`),
    routeRefreshTicksRemaining: nonnegativeInteger(
      source.routeRefreshTicksRemaining,
      `${field}.routeRefreshTicksRemaining`,
    ),
    routeTicksRemaining: nonnegativeInteger(
      source.routeTicksRemaining,
      `${field}.routeTicksRemaining`,
    ),
    routeWaypointIndex: boundedInteger(
      source.routeWaypointIndex,
      `${field}.routeWaypointIndex`,
      0,
      1,
    ) as 0 | 1,
    routeWaypoints: routeWaypoints === null
      ? null
      : [routeWaypoints[0]!, routeWaypoints[1]!],
    speedFactor: positiveFinite(source.speedFactor, `${field}.speedFactor`),
    stalledMovementTicks: nonnegativeInteger(
      source.stalledMovementTicks,
      `${field}.stalledMovementTicks`,
    ),
    turnFactor: positiveFinite(source.turnFactor, `${field}.turnFactor`),
    wanderHeadingDeg: finite(source.wanderHeadingDeg, `${field}.wanderHeadingDeg`),
  }
}

export function nativePuppetHit(value: unknown, field: string): NativePuppetHitState {
  const source = record(value, field)
  onlyKeys(source, field, ['strength', 'tick', 'timer'])
  return {
    strength: nonnegativeFinite(source.strength, `${field}.strength`),
    tick: nonnegativeInteger(source.tick, `${field}.tick`),
    timer: unitInterval(source.timer, `${field}.timer`),
  }
}

export function nativeWorldPuppetHits(value: unknown, field: string, snapshotTick: number): NativeWorldPuppetHit[] {
  const ids = new Set<string>()
  return limitedArray(value, field, MAX_BONEYARD_PUPPET_HITS).map((entry, index) => {
    const name = `${field}[${index}]`
    const source = record(entry, name)
    onlyKeys(source, name, ['feedback', 'hitTick', 'kind', 'targetId'])
    const kind = NATIVE_WORLD_PUPPET_HIT_KINDS.find(kind => kind === source.kind)
    if (kind === undefined) throw new GameProtocolError(`${name}.kind is invalid`)
    const targetId = limitedString(source.targetId, `${name}.targetId`, 256)
    const prefixes = kind === 'scenery' ? ['scenery:', 'fencepost:'] : kind === 'goodie' ? ['goodie:']
      : kind === 'arrow' || kind === 'firebolt' ? ['projectile:'] : kind === 'meteor' ? ['primary:'] : ['secondary:']
    if (!prefixes.some(prefix => targetId.startsWith(prefix) && targetId.length > prefix.length) || ids.has(targetId)) {
      throw new GameProtocolError(`${name}.targetId is invalid or duplicated`)
    }
    ids.add(targetId)
    const feedback = nativePuppetHit(source.feedback, `${name}.feedback`)
    const hitTick = nonnegativeInteger(source.hitTick, `${name}.hitTick`)
    if (feedback.timer <= 0 || feedback.tick > snapshotTick || hitTick > feedback.tick) {
      throw new GameProtocolError(`${name} hit clock is invalid`)
    }
    return { feedback, hitTick, kind, targetId }
  })
}
