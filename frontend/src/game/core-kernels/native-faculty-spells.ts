import type { BoneyardPoint } from './boneyard.ts'
import { advanceNativeRngWords, drawNativeFloat, drawNativeInteger, drawNativeSign, type NativeRngState } from './native-rng.ts'
import { nativePointInPolygon } from './primary-spell-targeting.ts'

export interface NativeDarkFireballState {
  readonly ageTicks: number
  readonly arcPhase: number
  readonly arcPhaseStep: number
  readonly headingDeg: number
  readonly position: Readonly<BoneyardPoint>
  readonly remainingTicks: number
  readonly velocity: Readonly<BoneyardPoint>
}

export interface NativeRainOfBonesState {
  readonly alpha: number
  readonly phase: number
  readonly position: Readonly<BoneyardPoint>
  readonly remainingTicks: number
  readonly rotationSign: number
  readonly scale: number
}

export interface NativeRainBone {
  readonly entry: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
}

export interface NativeRainCloudBillow {
  readonly phaseStepDeg: number
  readonly entry: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
  readonly scale: number
  readonly tint: number
}

export function nativeBlightningContains(origin: Readonly<BoneyardPoint>, heading: number,
  point: Readonly<BoneyardPoint>): boolean {
  const direction = headingVector(heading)
  const corner = (forward: number, across: number) => ({
    x: Math.fround(origin.x + direction.x * forward + direction.y * across),
    y: Math.fround(origin.y + direction.y * forward - direction.x * across),
  })
  return nativePointInPolygon(point, [corner(0, 20), corner(0, -20), corner(1000, -30), corner(1000, 30)])
}

export function nativeTragicCircleContains(origin: Readonly<BoneyardPoint>, point: Readonly<BoneyardPoint>): boolean {
  const x = (origin.x - point.x) / 212
  const y = (origin.y - point.y) / (Math.fround(210 * .800000011920929) + 2)
  return x * x + y * y < 1
}

export function createNativeDarkFireballs(origin: Readonly<BoneyardPoint>, heading: number,
  ring: boolean, targetDistance: number | null, rng: NativeRngState): {
    spells: readonly NativeDarkFireballState[]; rng: NativeRngState
  } {
  if (!ring) {
    const direction = headingVector(heading)
    return { rng, spells: [{ ageTicks: 0, arcPhase: 0, arcPhaseStep: 0, headingDeg: heading,
      position: { x: Math.fround(origin.x + direction.x * 55), y: Math.fround(origin.y + direction.y * 55 - 30) },
      remainingTicks: 400, velocity: { x: Math.fround(direction.x * 5), y: Math.fround(direction.y * 5) },
    }] }
  }
  const phase = drawNativeFloat(rng, 360)
  rng = phase.state
  const spells: NativeDarkFireballState[] = []
  for (let offset = 0; offset < 360; offset += 27) {
    const perturbation = drawNativeFloat(rng, 10, true)
    rng = perturbation.state
    const headingDeg = Math.fround(offset + phase.value + perturbation.value)
    const direction = headingVector(headingDeg)
    let arcPhaseStep = 0
    if (targetDistance !== null) {
      const trial = drawNativeFloat(rng, 100, true)
      rng = trial.state
      let distance = 200
      // Retail's repeated expression draws a second perturbation on this branch.
      if (targetDistance + trial.value >= 200) {
        const accepted = drawNativeFloat(rng, 100, true)
        rng = accepted.state
        distance = targetDistance + accepted.value
      }
      arcPhaseStep = Math.fround(180 / (distance / 3))
    }
    spells.push({ ageTicks: 0, arcPhase: 0, arcPhaseStep, headingDeg,
      position: { x: Math.fround(origin.x + direction.x * 50), y: Math.fround(origin.y + direction.y * 50 - 30) },
      remainingTicks: 400, velocity: { x: Math.fround(direction.x * 3), y: Math.fround(direction.y * 3) },
    })
  }
  return { rng, spells }
}

export function stepNativeDarkFireball(source: NativeDarkFireballState, actorTimeScale: number): {
  impact: boolean; spell: NativeDarkFireballState
} {
  const arcPhase = Math.fround(source.arcPhase + source.arcPhaseStep)
  return { impact: source.arcPhaseStep > 0 && arcPhase >= 180, spell: { ...source,
    ageTicks: source.ageTicks + 1, arcPhase,
    position: { x: Math.fround(source.position.x + Math.fround(source.velocity.x * actorTimeScale)),
      y: Math.fround(source.position.y + Math.fround(source.velocity.y * actorTimeScale)) },
    remainingTicks: Math.fround(source.remainingTicks - actorTimeScale),
  } }
}

export function createNativeRainOfBones(position: Readonly<BoneyardPoint>, rng: NativeRngState): {
  rng: NativeRngState; state: NativeRainOfBonesState
} {
  const sign = drawNativeSign(rng, 1)
  return { rng: sign.state, state: { alpha: 0, phase: 0,
    position: { ...position }, remainingTicks: 1200, rotationSign: sign.value, scale: Math.fround(.01) } }
}

export function stepNativeRainOfBones(source: NativeRainOfBonesState, rng: NativeRngState): {
  bone: NativeRainBone | null; rng: NativeRngState; state: NativeRainOfBonesState
} {
  const remainingTicks = source.remainingTicks - 1
  const alpha = remainingTicks > 0 ? Math.min(1, Math.fround(source.alpha + .05000000074505806))
    : Math.fround(source.alpha - .009999999776482582)
  const state: NativeRainOfBonesState = { ...source, alpha, remainingTicks,
    phase: Math.fround(source.phase + 1),
    scale: remainingTicks > 0 ? Math.min(1, Math.fround(source.scale * 1.2000000476837158)) : source.scale,
  }
  let bone: NativeRainBone | null = null
  if (remainingTicks > 0) {
    const drop = rollRainDrop(alpha, rng)
    rng = drop.rng
    if (drop.admitted) {
      const skull = drawNativeInteger(rng, 30)
      const entry = drawNativeInteger(skull.state, skull.value === 3 ? 4 : 9)
      const radius = drawNativeFloat(entry.state, 200)
      const angle = drawNativeFloat(radius.state, 360)
      const rotation = drawNativeFloat(angle.state, 360)
      rng = rotation.state
      const direction = headingVector(angle.value)
      bone = { entry: (skull.value === 3 ? 1819 : 113) + entry.value,
        position: { x: Math.fround(source.position.x + Math.fround(radius.value * direction.x)),
          y: Math.fround(source.position.y + Math.fround(Math.fround(radius.value * direction.y) * .800000011920929)) },
        rotationDeg: rotation.value }
    }
  }
  // The private render manager owns these billows; their constructors still consume eight words each.
  if (alpha >= 1) rng = advanceNativeRngWords(rng, 16)
  return { bone, rng, state }
}

function rollRainDrop(alpha: number, rng: NativeRngState): { admitted: boolean; rng: NativeRngState } {
  let admitted = false
  if (alpha > .75) {
    const draw = drawNativeInteger(rng, 2)
    admitted = draw.value === 1
    rng = draw.state
  }
  if (alpha >= 1) admitted = true
  if (alpha > .5) {
    const draw = drawNativeInteger(rng, 4)
    admitted = draw.value === 3
    rng = draw.state
  }
  return { admitted, rng }
}

export function createNativeRainCloudBillow(position: Readonly<BoneyardPoint>, rng: NativeRngState): { rng: NativeRngState; billow: NativeRainCloudBillow } {
  const entry = drawNativeInteger(rng, 2)
  const radius = drawNativeFloat(entry.state, 200)
  const angle = drawNativeFloat(radius.state, 360)
  const rise = drawNativeFloat(angle.state, 3)
  const rotation = drawNativeFloat(rise.state, 360)
  const scale = drawNativeFloat(rotation.state, .8500000238418579)
  const loss = drawNativeFloat(scale.state, .019999999552965164)
  const red = drawNativeFloat(loss.state, .15000000596046448)
  const direction = headingVector(angle.value)
  return { rng: red.state, billow: {
    entry: 10 + entry.value,
    position: { x: Math.fround(position.x + Math.fround(radius.value * direction.x)),
      y: Math.fround(position.y + Math.fround(Math.fround(radius.value * direction.y) * .800000011920929)) },
    phaseStepDeg: Math.fround(2 + rise.value), rotationDeg: rotation.value,
    scale: Math.fround(.8999999761581421 + scale.value), tint: Math.round(red.value * 255) << 16,
  } }
}

function headingVector(heading: number): BoneyardPoint {
  const angle = heading * Math.PI / 180
  return { x: Math.fround(Math.sin(angle)), y: Math.fround(-Math.cos(angle)) }
}
