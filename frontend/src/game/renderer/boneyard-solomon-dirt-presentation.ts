import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { BoneyardSolomonDigEvent } from '../core-kernels/boneyard-encounter.ts'

export const NATIVE_SOLOMON_DIRT_DRAW_PASSES = 2
export const NATIVE_SOLOMON_DIRT_VISIBLE_TICKS = 29

const NATIVE_SOLOMON_DIRT_OFFSET_X = -22
const NATIVE_SOLOMON_DIRT_OFFSET_Y = -62
const NATIVE_SOLOMON_DIRT_INITIAL_HEADING_DEGREES = 35
const NATIVE_SOLOMON_DIRT_INITIAL_SPEED = 2
const NATIVE_SOLOMON_DIRT_SPEED_RETENTION = 0.9750000238418579
const NATIVE_SOLOMON_DIRT_HEADING_STEP_DEGREES = 2
const NATIVE_SOLOMON_DIRT_ALPHA_STEP = 0.03500000014901161

export interface NativeSolomonDirtState {
  ageTicks: number
  alpha: number
  headingDegrees: number
  position: BoneyardPoint
  speed: number
}

export interface NativeSolomonDirtDrawOperation {
  alpha: number
  blendMode: 'normal'
  headingDegrees: number
  position: BoneyardPoint
}

export function nativeSolomonDirtEventDelta(
  lastSeenEventId: number | null,
  current: readonly BoneyardSolomonDigEvent[],
): Readonly<{
  eventId: number
  events: readonly BoneyardSolomonDigEvent[]
}> {
  const latestEventId = current.at(-1)?.id ?? 0
  if (lastSeenEventId === null) return { eventId: latestEventId, events: [] }
  return {
    eventId: Math.max(lastSeenEventId, latestEventId),
    events: current.filter((event) => (
      event.id > lastSeenEventId
      && (event.cue === 'throw-dirt-1' || event.cue === 'throw-dirt-2')
    )),
  }
}

export function nativeSolomonDirtStateAt(
  solomonPosition: BoneyardPoint,
  ageTicks: number,
): NativeSolomonDirtState | null {
  if (!Number.isSafeInteger(ageTicks) || ageTicks < 0) {
    throw new RangeError('Solomon dirt age must be a nonnegative safe integer')
  }
  if (ageTicks >= NATIVE_SOLOMON_DIRT_VISIBLE_TICKS) return null

  let state: NativeSolomonDirtState = {
    ageTicks: 0,
    alpha: Math.fround(1),
    headingDegrees: Math.fround(NATIVE_SOLOMON_DIRT_INITIAL_HEADING_DEGREES),
    position: nativeSolomonDirtOrigin(solomonPosition),
    speed: Math.fround(NATIVE_SOLOMON_DIRT_INITIAL_SPEED),
  }
  for (let age = 1; age <= ageTicks; age += 1) state = stepDirt(state)
  return state
}

export function nativeSolomonDirtOrigin(
  solomonPosition: BoneyardPoint,
): BoneyardPoint {
  return {
    x: Math.fround(solomonPosition.x + NATIVE_SOLOMON_DIRT_OFFSET_X),
    y: Math.fround(solomonPosition.y + NATIVE_SOLOMON_DIRT_OFFSET_Y),
  }
}

export function nativeSolomonDirtDrawOperations(
  state: NativeSolomonDirtState,
): readonly NativeSolomonDirtDrawOperation[] {
  return Array.from({ length: NATIVE_SOLOMON_DIRT_DRAW_PASSES }, () => ({
    alpha: state.alpha,
    blendMode: 'normal' as const,
    headingDegrees: state.headingDegrees,
    position: { ...state.position },
  }))
}

function stepDirt(source: NativeSolomonDirtState): NativeSolomonDirtState {
  const radians = source.headingDegrees * Math.PI / 180
  const unitX = Math.fround(Math.sin(radians))
  const unitY = Math.fround(-Math.cos(radians))
  const deltaX = Math.fround(source.speed * unitX)
  const deltaY = Math.fround(source.speed * unitY)
  return {
    ageTicks: source.ageTicks + 1,
    alpha: Math.max(0, Math.fround(source.alpha - NATIVE_SOLOMON_DIRT_ALPHA_STEP)),
    headingDegrees: Math.fround(
      source.headingDegrees + NATIVE_SOLOMON_DIRT_HEADING_STEP_DEGREES,
    ),
    position: {
      x: Math.fround(source.position.x + deltaX),
      y: Math.fround(source.position.y + deltaY),
    },
    speed: Math.fround(source.speed * NATIVE_SOLOMON_DIRT_SPEED_RETENTION),
  }
}
