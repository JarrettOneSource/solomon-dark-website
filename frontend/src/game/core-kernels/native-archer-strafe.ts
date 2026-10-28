import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardPoint } from './boneyard.ts'

export interface NativeArcherStrafeState {
  readonly direction: -1 | 0 | 1
  readonly limbHeadingDeg: number
  readonly movementRamp: number
  readonly turnBlend: number
}

export interface NativeArcherStrafeRequest {
  readonly attacking: boolean
  readonly enabled: boolean
  readonly headingDeg: number
  readonly movementScalar: number
  readonly position: Readonly<BoneyardPoint>
  readonly targetPosition: Readonly<BoneyardPoint> | null
  readonly pathIsClear: (end: Readonly<BoneyardPoint>) => boolean
}

export interface NativeArcherStrafeStep {
  readonly delta: Readonly<BoneyardPoint> | null
  readonly gaitAdvance: number
  readonly state: NativeArcherStrafeState
  readonly strideAdvance: number
}

export function stepNativeArcherStrafe(
  source: NativeArcherStrafeState,
  request: NativeArcherStrafeRequest,
): NativeArcherStrafeStep {
  let state = { ...source, limbHeadingDeg: request.headingDeg }
  if (!request.enabled || request.targetPosition === null || request.movementScalar === 0) {
    return { delta: null, gaitAdvance: 0, state, strideAdvance: 0 }
  }
  if (!request.attacking || state.direction === 0) {
    state = { ...state, movementRamp: 0, turnBlend: 0 }
    return { delta: null, gaitAdvance: 0, state, strideAdvance: 0 }
  }
  const target = request.targetPosition
  const dx = Math.fround(request.position.x - target.x)
  const dy = Math.fround(request.position.y - target.y)
  const distance = Math.fround(Math.hypot(dx, dy))
  const angle = Math.fround(actorHeadingFromVector(dx, dy) + state.turnBlend * 10)
    * Math.PI / 180
  const goal = {
    x: Math.fround(target.x + distance * Math.sin(angle)),
    y: Math.fround(target.y - distance * Math.cos(angle)),
  }
  if (!request.pathIsClear(goal)) {
    return {
      delta: null,
      gaitAdvance: 0,
      state: { ...state, direction: 0, movementRamp: 0, turnBlend: 0 },
      strideAdvance: 0,
    }
  }
  const movementRamp = Math.fround(Math.min(1, state.movementRamp + Math.fround(0.01)))
  const movement = Math.fround(request.movementScalar * movementRamp)
  const difference = { x: Math.fround(goal.x - request.position.x), y: Math.fround(goal.y - request.position.y) }
  const length = Math.hypot(difference.x, difference.y)
  const delta = length === 0 ? { x: 0, y: 0 } : {
    x: Math.fround(difference.x / length * movement * 0.25),
    y: Math.fround(difference.y / length * movement * 0.25),
  }
  const turnBlend = state.direction > 0
    ? Math.min(state.direction, state.turnBlend + Math.fround(0.005))
    : Math.max(state.direction, state.turnBlend - Math.fround(0.005))
  return {
    delta,
    gaitAdvance: Math.fround(movement * movementRamp / 25),
    state: {
      ...state,
      limbHeadingDeg: actorHeadingFromVector(delta.x, delta.y),
      movementRamp,
      turnBlend: Math.fround(turnBlend),
    },
    strideAdvance: Math.fround(movement * 4),
  }
}
