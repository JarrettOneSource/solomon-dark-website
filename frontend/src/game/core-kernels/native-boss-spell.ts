import type { BoneyardPoint } from './boneyard.ts'
import type { NativeDarkFireballState, NativeRainOfBonesState } from './native-faculty-spells.ts'
import type { NativeGuidedMissileState } from './native-guided-missile.ts'
import { drawNativeFloat, drawNativeSign, type NativeRngState } from './native-rng.ts'
import type { NativeWorldManagerRegistration } from './native-world-manager-order.ts'
import type { NativeFirePatchState } from './primary-spell-fire-effects.ts'

interface NativeBossSpellOwner {
  readonly ageTicks: number
  readonly damage: number
  readonly id: number
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly ownerActorId: number
  readonly position: Readonly<BoneyardPoint>
  readonly spawnTick: number
}

export interface NativeDireFireState {
  readonly alpha: number
  readonly glow: boolean
  readonly phase: number
  readonly ramp: number
  readonly rotationPhases: readonly [number, number]
  readonly rotationRates: readonly [number, number]
  readonly rotationSigns: readonly [number, number]
  readonly scale: number
  readonly scaleSign: number
}

export type NativeBossSpell = NativeBossSpellOwner & (
  | Readonly<{ kind: 'ultra-banish'; remainingTicks: number; alpha: number; flashAlpha: number; lightRadius: number; megaDeath: boolean }>
  | Readonly<{ kind: 'unholy-soul'; origin: Readonly<BoneyardPoint>; angleDeg: number; angularSpeed: number; scale: number;
      height: number; verticalSpeed: number; life: number; fast: boolean }>
  | Readonly<{ kind: 'eye-laser'; headingDeg: number; phaseDeg: number; velocity: Readonly<BoneyardPoint> }>
  | Readonly<{ kind: 'unholy-spit'; origin: Readonly<BoneyardPoint>; travel: Readonly<BoneyardPoint>;
      spreadDirection: Readonly<BoneyardPoint>; progress: number; progressPerTick: number; height: number;
      spawnFire: boolean; spawnImps: boolean }>
  | Readonly<{ kind: 'green-fire'; fire: NativeFirePatchState; glow: boolean }>
  | Readonly<{ kind: 'unholy-burst'; framePhase: number; frameVelocity: number; offsetY: number; offsetStepY: number; lightIntensity: number }>
  | Readonly<{ kind: 'mouth-beam-segment'; vertices: readonly Readonly<BoneyardPoint>[]; uvOffset: number;
      startAlpha: number; endAlpha: number }>
  | Readonly<{ kind: 'heartmonger-flicker'; phaseDeg: number }>
  | Readonly<{ kind: 'heartmonger-soul'; lifePhaseDeg: number; bobPhaseDeg: number }>
  | Readonly<{ kind: 'blightning'; endpoint: Readonly<BoneyardPoint>; midpoint: Readonly<BoneyardPoint> }>
  | Readonly<{ kind: 'death-magic'; scale: number; alpha: number; alphaLossPerTick: number; painterSortBias: number;
      light: Readonly<{ radius: number; intensity: number; lossPerTick: number }> | null }>
  | Readonly<{ kind: 'falling-bone'; entry: number; height: number; colorRamp: number; rotationDeg: number }>
  | NativeGuidedMissileState & Readonly<{ kind: 'skull-missile'; targetPlayerId: string | null }>
  | NativeDarkFireballState & Readonly<{ kind: 'dark-fireball'; groundFireDamage: number }>
  | NativeRainOfBonesState & Readonly<{ kind: 'rain-of-bones' }>
  | Readonly<{ kind: 'tragic-circle'; remainingTicks: number }>
  | NativeDireFireState & Readonly<{ kind: 'dire-fire' }>
)

export const NATIVE_BOSS_SPELL_MANAGER_LANES = {
  'ultra-banish': 'transient',
  'unholy-soul': 'transient',
  'eye-laser': 'transient',
  'unholy-spit': 'actor',
  'green-fire': 'actor',
  'unholy-burst': 'transient',
  'mouth-beam-segment': 'transient',
  'heartmonger-flicker': 'transient',
  'heartmonger-soul': 'transient',
  blightning: 'transient',
  'death-magic': 'transient',
  'falling-bone': 'transient',
  'skull-missile': 'actor',
  'dark-fireball': 'actor',
  'rain-of-bones': 'actor',
  'tragic-circle': 'actor',
  'dire-fire': 'actor',
} as const satisfies Readonly<Record<NativeBossSpell['kind'], NativeWorldManagerRegistration['managerLane']>>

export function createNativeDireFire(rng: NativeRngState): { rng: NativeRngState; state: NativeDireFireState } {
  const phase = drawNativeFloat(rng, 32)
  const scaleSign = drawNativeSign(phase.state, 1)
  const firstPhase = drawNativeFloat(scaleSign.state, 360)
  const secondPhase = drawNativeFloat(firstPhase.state, 360)
  const firstRate = drawNativeFloat(secondPhase.state, .5)
  const secondRate = drawNativeFloat(firstRate.state, .5)
  const firstSign = drawNativeSign(secondRate.state, 1)
  const secondSign = drawNativeSign(firstSign.state, 1)
  return { rng: secondSign.state, state: {
    alpha: 2, glow: true, phase: phase.value, ramp: 0,
    rotationPhases: [firstPhase.value, secondPhase.value],
    rotationRates: [Math.fround(.5 + firstRate.value), Math.fround(.5 + secondRate.value)],
    rotationSigns: [firstSign.value, secondSign.value], scale: 1, scaleSign: scaleSign.value,
  } }
}

export function stepNativeDireFire(source: NativeDireFireState, rng: NativeRngState): {
  rng: NativeRngState; state: NativeDireFireState
} {
  const first = drawNativeFloat(rng, .20000000298023224)
  const second = drawNativeFloat(first.state, .20000000298023224)
  const rate = (current: number, draw: number) => Math.min(1, Math.max(-1,
    Math.fround(current + Math.fround(draw - .10000000149011612))))
  let phase = Math.fround(source.phase + .25)
  if (phase >= 32) phase = Math.fround(phase - 32)
  return { rng: second.state, state: { ...source,
    alpha: Math.fround(source.alpha - .009999999776482582), phase,
    ramp: Math.min(1, Math.fround(source.ramp + .05000000074505806)),
    rotationPhases: [Math.fround(source.rotationPhases[0] + source.rotationRates[0]),
      Math.fround(source.rotationPhases[1] + source.rotationRates[1])],
    rotationRates: [rate(source.rotationRates[0], first.value), rate(source.rotationRates[1], second.value)],
  } }
}
