import { createNativeRng, drawNativeFloat, drawNativeFloatRange, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { roundHalfToEven } from './native-rounding.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_DEMON_SKULL_SCREAM_TICKS = 275
export const NATIVE_DEMON_SKULL_DEATH_STREAM_TICKS = 600

export interface NativeDemonSkullEncounterState {
  readonly deathStreamTicksRemaining: number
  readonly screamStreamTicksRemaining: number
  readonly healthTriggersEnabled: boolean
  readonly healthTriggersFiredMask: number
  readonly pendingCapabilities: number
}

export function createNativeDemonSkullEncounter(): NativeDemonSkullEncounterState {
  return { deathStreamTicksRemaining: 0, screamStreamTicksRemaining: 0,
    healthTriggersEnabled: false, healthTriggersFiredMask: 0, pendingCapabilities: 0 }
}

export function queueNativeDemonSkullHealthTriggers(source: NativeDemonSkullEncounterState,
  beforeRatio: number, afterRatio: number): NativeDemonSkullEncounterState {
  if (!source.healthTriggersEnabled) return source
  const mask = nativeDemonSkullHealthTriggerMask(beforeRatio, afterRatio, source.healthTriggersFiredMask)
  return mask === 0 ? source : { ...source,
    healthTriggersFiredMask: source.healthTriggersFiredMask | mask,
    pendingCapabilities: source.pendingCapabilities | mask }
}
export type NativeDemonSkullRangedAttack = 'eyes' | 'mouth' | 'spit'
export type NativeDemonSkullActionKind = NativeDemonSkullRangedAttack | 'bite' | 'scream' | 'flair'

export type NativeDemonSkullAction = Readonly<{ retired: boolean }> & (
  | Readonly<{ kind: 'scream' }>
  | Readonly<{ kind: 'bite'; progress: number; rate: number; markerEmitted: boolean }>
  | Readonly<{ kind: 'eyes'; warmupTicks: number; shotsRemaining: number; recoveryTicks: number; attackSpeed: number }>
  | Readonly<{ kind: 'mouth'; warmupTicks: number; warmupJitter: number; warmupTurnSpeed: number;
      beamPower: number; trackingDelayTicks: number; trackingRamp: number; recoveryTicks: number }>
  | Readonly<{ kind: 'spit'; shotsRemaining: number; cooldownTicks: number; mouthTicks: number; targetHeadingDeg: number }>
  | Readonly<{ kind: 'flair'; remainingTicks: number; settlingTicks: number; glow: number; originalHeadingDeg: number }>
)

export function createNativeDemonSkullAction(kind: NativeDemonSkullActionKind,
  headingDeg: number, targetHeadingDeg: number | null, attackSpeed: number, actionSeed: number): NativeDemonSkullAction {
  switch (kind) {
    case 'scream': return { kind, retired: true }
    case 'bite': return { kind, retired: false, progress: 0, rate: Math.fround(attackSpeed * .125), markerEmitted: false }
    case 'eyes': return { kind, retired: false, warmupTicks: 50, shotsRemaining: 3, recoveryTicks: 50, attackSpeed }
    case 'mouth': return { kind, retired: false, warmupTicks: 300, warmupJitter: 0, warmupTurnSpeed: 1,
      beamPower: 10, trackingDelayTicks: 150, trackingRamp: 0, recoveryTicks: 80 }
    case 'flair': return { kind, retired: false, remainingTicks: 200, settlingTicks: 0, glow: 0, originalHeadingDeg: headingDeg }
    case 'spit': {
      const base = drawNativeInteger(createNativeRng(actionSeed), 3)
      const short = drawNativeInteger(base.state, 20)
      const extra = drawNativeInteger(short.state, 30)
      const count = short.value === 5 ? 2 : base.value + 3
      const shotsRemaining = count + (extra.value === 3 ? drawNativeInteger(extra.state, 5).value : 0)
      return { kind, retired: false, shotsRemaining, cooldownTicks: 0, mouthTicks: -1, targetHeadingDeg: targetHeadingDeg ?? headingDeg }
    }
  }
}

export interface NativeDemonSkullVisualState {
  readonly bodyHeadingDeg: number
  readonly bodyOffset: Vector2
  readonly bodyPhaseDeg: number
  readonly bodyPose: number
  readonly chargeGlow: number
  readonly eyeCharge: number
  readonly flairGlow: number
  readonly flickerPhaseDeg: number
  readonly jitter: Vector2
  readonly lightIntensity: number
  readonly spin: number
}

export interface NativeDemonSkullState extends NativeDemonSkullVisualState {
  readonly attackTicksRemaining: number
  readonly capabilities: number
  readonly headingDelayTicks: number
  readonly pendingAttack: NativeDemonSkullRangedAttack | null
  readonly recoil: Vector2
  readonly screamActive: boolean
  readonly seen: boolean
  readonly speed: number
  readonly targetSpeed: number
}

export function createNativeDemonSkull(rng: NativeRngState, movementScale: number,
  capabilities = 0): { rng: NativeRngState; state: NativeDemonSkullState } {
  const bodyPhase = drawNativeFloat(rng, 360)
  const flickerPhase = drawNativeFloat(bodyPhase.state, 360)
  return { rng: flickerPhase.state, state: {
    attackTicksRemaining: 500,
    bodyHeadingDeg: -1,
    bodyOffset: { x: 0, y: 25 },
    bodyPhaseDeg: bodyPhase.value,
    bodyPose: 0,
    capabilities,
    chargeGlow: 0,
    eyeCharge: 0,
    flairGlow: 0,
    flickerPhaseDeg: flickerPhase.value,
    headingDelayTicks: 0,
    jitter: { x: 0, y: 0 },
    lightIntensity: 0,
    pendingAttack: null,
    recoil: { x: 0, y: 0 },
    screamActive: false,
    seen: false,
    speed: Math.fround(movementScale * 4),
    spin: 0,
    targetSpeed: Math.fround(movementScale * 4),
  } }
}

/** Outer prefix before the inherited Badguy movement/action tick (0x004963C0). */
export function prepareNativeDemonSkullTick(source: NativeDemonSkullState, admitted: boolean): NativeDemonSkullState {
  const step = Math.fround(.025)
  return { ...source,
    flairGlow: Math.max(0, Math.fround(source.flairGlow - Math.fround(.05))),
    seen: source.seen || admitted,
    speed: source.speed > source.targetSpeed ? Math.max(source.targetSpeed, Math.fround(source.speed - step))
      : Math.min(source.targetSpeed, Math.fround(source.speed + step)),
  }
}

export function nativeDemonSkullAttackChoices(capabilities: number, distanceSquared: number,
  lineOfSight: boolean): readonly NativeDemonSkullRangedAttack[] {
  const choices: NativeDemonSkullRangedAttack[] = []
  if ((capabilities & 1) !== 0 && lineOfSight) choices.push('eyes')
  if ((capabilities & 2) !== 0 && lineOfSight) {
    choices.push('mouth')
    if (distanceSquared > 250 ** 2) choices.push('mouth', 'mouth')
  }
  if ((capabilities & 4) !== 0) {
    choices.push('spit')
    if (distanceSquared > 250 ** 2) choices.push('spit')
  }
  return choices
}

export function nativeDemonSkullHealthTriggerMask(beforeRatio: number, afterRatio: number,
  firedMask: number): number {
  let mask = 0
  for (const [index, threshold] of [.8, .6, .4, .2].entries()) {
    const bit = 1 << index
    if ((firedMask & bit) === 0 && beforeRatio > Math.fround(threshold) && afterRatio < Math.fround(threshold)) mask |= bit
  }
  return mask
}

export interface NativeDemonSkullControllerContext {
  readonly alternatePlayer: boolean
  readonly hasAction: boolean
  readonly headingDeg: number
  readonly healthRatio: number
  readonly lineOfSight: boolean
  readonly movementScale: number
  readonly screamPlaying: boolean
  readonly targetDistanceSquared: number | null
}

/** Runs after inherited movement/actions, including during inherited stasis. */
export function stepNativeDemonSkullController(source: NativeDemonSkullState, sourceRng: NativeRngState,
  context: NativeDemonSkullControllerContext) {
  const phase = drawNativeFloatRange(sourceRng, 3, 6)
  let rng = phase.state
  let bodyHeadingDeg = source.bodyHeadingDeg === -1 ? context.headingDeg : source.bodyHeadingDeg
  let headingDelayTicks = context.headingDeg === bodyHeadingDeg ? 0 : source.headingDelayTicks + 1
  if (headingDelayTicks > 10) {
    bodyHeadingDeg = context.headingDeg
    headingDelayTicks = 0
  }
  let state: NativeDemonSkullState = { ...source, bodyHeadingDeg, headingDelayTicks,
    bodyPhaseDeg: Math.fround(source.bodyPhaseDeg + 3),
    flickerPhaseDeg: Math.fround(source.flickerPhaseDeg + phase.value),
    lightIntensity: Math.min(1, Math.fround(source.lightIntensity + Math.fround(.005))),
  }
  const result = (beginAction: NativeDemonSkullActionKind | null = null,
    incrementAttackSeed = false, landing = false, screamShake = false) => ({
    beginAction, incrementAttackSeed, landing, rng, screamShake, state,
  })
  if (state.screamActive) {
    if (context.screamPlaying) {
      state = { ...state, bodyPose: 1, speed: Math.min(Math.fround(context.movementScale * 10),
        Math.fround(state.speed + Math.fround(.04))) }
      return result(null, false, false, true)
    }
    const landing = state.bodyPose === 1
    const speed = Math.fround(state.speed - Math.fround(.1))
    state = { ...state, bodyPose: 0,
      screamActive: speed >= context.movementScale,
      speed: Math.max(speed, context.movementScale),
    }
    return result(null, false, landing)
  }
  if (state.pendingAttack !== null) {
    state = { ...state, speed: Math.max(0, Math.fround(state.speed - Math.fround(.025))) }
    if (context.alternatePlayer || state.speed >= Math.fround(.005)) return result()
    const attack = state.pendingAttack
    state = { ...state, pendingAttack: null }
    return result(attack)
  }
  if (!context.hasAction && (state.capabilities & 32) !== 0) {
    state = { ...state, capabilities: state.capabilities & ~32 }
    return result('flair')
  }
  if (context.hasAction || context.alternatePlayer || !state.seen || context.targetDistanceSquared === null) return result()
  if (state.speed >= state.targetSpeed && context.targetDistanceSquared > 400 ** 2) {
    const scream = drawNativeInteger(rng, 100)
    rng = scream.state
    if (scream.value === 50) {
      state = { ...state, screamActive: true, bodyPose: 1 }
      return result('scream')
    }
  }
  state = { ...state, attackTicksRemaining: state.attackTicksRemaining - 1 }
  if (state.attackTicksRemaining > 0 || state.speed <= state.targetSpeed * .75) return result()
  const delay = drawNativeFloatRange(rng, 1.5, 3.75)
  rng = delay.state
  const divisor = context.healthRatio < .125 ? 4 : context.healthRatio < .25 ? 3 : context.healthRatio < .5 ? 2 : 1
  state = { ...state, attackTicksRemaining: Math.trunc(roundHalfToEven(Math.fround(delay.value * 100)) / divisor) }
  const choices = nativeDemonSkullAttackChoices(state.capabilities, context.targetDistanceSquared, context.lineOfSight)
  if (choices.length === 0) return result()
  const choice = drawNativeInteger(rng, choices.length)
  rng = choice.state
  state = { ...state, pendingAttack: choices[choice.value]!, targetSpeed: Math.fround(.0001) }
  return result(null, true)
}
