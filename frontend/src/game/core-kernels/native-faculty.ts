import type { NativeEnemyPathState } from './native-enemy-pathfinding.ts'
import { createNativeFacultyAction, stepNativeFacultyAction, type NativeFacultyAction } from './native-faculty-actions.ts'
import { drawNativeFloat, drawNativeFloatRange, drawNativeInteger, drawNativeSign, type NativeRngState } from './native-rng.ts'

export interface NativeFacultyAppearance {
  readonly bodyColor: readonly [number, number, number, number]
  readonly female: boolean
  readonly headColor: readonly [number, number, number, number]
}

export interface NativeFacultyVisualState extends NativeFacultyAppearance {
  readonly bodyHeadingDeg: number
  readonly handMask: number
  readonly lightningActive: boolean
  readonly lightIntensity: number
  readonly lightPhase: number
}

export function nativeFacultyColor(color: readonly [number, number, number, number], saturation: number):
  readonly [number, number, number, number] {
  const luminance = Math.fround(color[0] * .3086000084877014
    + color[1] * .6093999743461609 + color[2] * .0820000022649765)
  const base = luminance * (1 - saturation)
  const mix = (channel: number) => Math.min(1, Math.max(0, Math.fround(base + channel * saturation)))
  return [mix(color[0]), mix(color[1]), mix(color[2]), Math.min(1, Math.max(0, color[3]))]
}

export interface NativeFacultyState {
  readonly bodyHeadingDeg: number
  readonly action: NativeFacultyAction | null
  readonly attackRange: number
  readonly bodyPose: number
  readonly completedDispatches: number
  readonly disabledPrimaryTicks: number
  readonly gaitPhase: number
  readonly handMask: number
  readonly headingLocked: boolean
  readonly lightningActive: boolean
  readonly lightIntensity: number
  readonly lightPhase: number
  readonly orbitSign: number
  readonly primaryPoll: number
  readonly secondaryCooldown: number
}

export interface NativeFacultyContext {
  readonly advanceAction?: boolean
  readonly actorTimeScale: number
  readonly lineOfSight: boolean
  readonly targetDistanceSquared: number | null
  readonly tick: number
}

export function createNativeFaculty(rng: NativeRngState): { rng: NativeRngState; state: NativeFacultyState } {
  const sign = drawNativeSign(rng, 1)
  const light = drawNativeFloat(sign.state, 360)
  const gait = drawNativeFloat(light.state, 4)
  const cooldown = drawNativeInteger(gait.state, 300)
  return { rng: cooldown.state, state: {
    bodyHeadingDeg: 0,
    action: null, attackRange: 250, bodyPose: 0, completedDispatches: 0, disabledPrimaryTicks: 0,
    gaitPhase: gait.value, handMask: 0, headingLocked: false, lightningActive: false, lightIntensity: 0,
    lightPhase: light.value, orbitSign: sign.value, primaryPoll: 0, secondaryCooldown: cooldown.value + 500,
  } }
}

export function registerNativeFaculty(state: NativeFacultyState, rng: NativeRngState, memberCount: number): {
  rng: NativeRngState; state: NativeFacultyState
} {
  let primaryPoll = (memberCount + 1) * 100
  if (memberCount > 2) {
    const poll = drawNativeInteger(rng, 300)
    primaryPoll = poll.value
    rng = poll.state
  }
  const count = memberCount === 1 ? 301 : memberCount === 2 ? 401 : 201
  const delay = memberCount === 1 ? 100 : memberCount === 2 ? 400 : 800
  const stagger = drawNativeInteger(rng, count)
  return { rng: stagger.state, state: { ...state, primaryPoll,
    secondaryCooldown: state.secondaryCooldown + delay + stagger.value } }
}

export function advanceNativeFacultyOrbit(path: NativeEnemyPathState, orbitSign: number, rng: NativeRngState): {
  path: NativeEnemyPathState; rng: NativeRngState
} {
  const angle = drawNativeFloatRange(rng, 1, 2)
  const radius = drawNativeFloat(angle.state, 2, true)
  return { rng: radius.state, path: { ...path, flankTicksRemaining: 100,
    flankAngleDeg: Math.fround(path.flankAngleDeg + angle.value * orbitSign),
    flankRadius: Math.min(300, Math.max(200, Math.fround(path.flankRadius + radius.value))),
  } }
}

export function stepNativeFaculty(
  source: NativeFacultyState,
  rng: NativeRngState,
  primary: 0 | 1 | 2 | 3,
  context: NativeFacultyContext,
): { marker: boolean; dispatch: NativeFacultyAction['kind'] | null; rng: NativeRngState; state: NativeFacultyState } {
  let gaitPhase = Math.fround(source.gaitPhase + .25)
  if (gaitPhase >= 5) gaitPhase = Math.fround(gaitPhase - 5)
  let state: NativeFacultyState = { ...source, lightningActive: false,
    disabledPrimaryTicks: Math.max(0, source.disabledPrimaryTicks - 1),
    gaitPhase, lightPhase: Math.fround(source.lightPhase + 1),
    lightIntensity: Math.min(1, Math.fround(source.lightIntensity + .0010000000474974513)),
  }
  let marker = false
  let dispatch: NativeFacultyAction['kind'] | null = null
  if (source.action !== null && context.advanceAction !== false) {
    const stepped = stepNativeFacultyAction(source.action, context.actorTimeScale)
    marker = stepped.marker
    dispatch = stepped.dispatch ? source.action.kind : null
    state = { ...state,
      action: stepped.complete ? null : stepped.action,
      lightningActive: source.action.kind === 'lightning' && stepped.dispatch,
      bodyPose: stepped.bodyPose,
      completedDispatches: state.completedDispatches + (stepped.dispatch ? 1 : 0),
      handMask: stepped.complete || (stepped.dispatch && source.action.kind !== 'lightning') ? 0 : state.handMask,
      headingLocked: !stepped.complete && stepped.lockedFacing,
    }
  }
  const polled = pollPrimary(state, rng, primary, context)
  state = polled.state
  return { marker, dispatch, rng: polled.rng, state: { ...state,
    secondaryCooldown: state.secondaryCooldown - (state.completedDispatches > 0 ? 1 : 0),
  } }
}

function pollPrimary(state: NativeFacultyState, rng: NativeRngState, primary: 0 | 1 | 2 | 3,
  context: NativeFacultyContext): { rng: NativeRngState; state: NativeFacultyState } {
  if (context.tick % 2 !== 0 || context.targetDistanceSquared === null) return { rng, state }
  const primaryPoll = state.primaryPoll - 1
  state = { ...state, primaryPoll: primaryPoll < 0 ? 150 : primaryPoll }
  if (primaryPoll >= 0 || state.disabledPrimaryTicks > 0 || !context.lineOfSight
    || context.targetDistanceSquared <= 150 ** 2
    || context.targetDistanceSquared >= state.attackRange ** 2) return { rng, state }
  let kind: NativeFacultyAction['kind'] = primary === 1 ? 'lightning' : 'throw'
  if (state.secondaryCooldown < 0) {
    const selection = drawNativeInteger(rng, 2)
    rng = selection.state
    if (selection.value === 1) {
      kind = 'two-hand'
      const delay = drawNativeInteger(rng, 1001)
      rng = delay.state
      state = { ...state, secondaryCooldown: 1500 + delay.value }
    }
  }
  const created = createNativeFacultyAction(kind, rng)
  const range = drawNativeFloat(created.rng, 250)
  return { rng: range.state, state: { ...state, action: created.action,
    attackRange: Math.fround(350 + range.value), primaryPoll: 300, handMask: created.action.handMask,
  } }
}
