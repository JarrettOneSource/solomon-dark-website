import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardPoint } from './boneyard.ts'
import { drawNativeFloat, type NativeRngState } from './native-rng.ts'
import { nativeHeadingTurnDirection } from './primary-spell-targeting.ts'

export interface NativeGuidedMissileState {
  readonly headingDeg: number
  readonly minimumSpeed: number
  readonly phaseDeg: number
  readonly position: Readonly<BoneyardPoint>
  readonly remainingTicks: number
  readonly speed: number
  readonly turnRate: number
  readonly visualScale: number
}

export function createNativeGuidedMissile(rng: NativeRngState, position: Readonly<BoneyardPoint>,
  headingDeg: number, speedScale: number): { rng: NativeRngState; state: NativeGuidedMissileState } {
  const phase = drawNativeFloat(rng, 360)
  const turn = drawNativeFloat(phase.state, .75)
  const floor = drawNativeFloat(turn.state, .44999998807907104)
  const scale = drawNativeFloat(floor.state, .20000004768371582)
  return { rng: scale.state, state: {
    headingDeg, minimumSpeed: Math.fround(Math.fround(.75 + floor.value) * speedScale),
    phaseDeg: phase.value, position: { ...position }, remainingTicks: 2000,
    speed: Math.fround(3 * speedScale), turnRate: Math.fround(.5 + turn.value),
    visualScale: Math.fround(.8999999761581421 + scale.value),
  } }
}

export function stepNativeGuidedMissile(source: NativeGuidedMissileState,
  target: Readonly<BoneyardPoint> | null, actorTimeScale: number): {
    state: NativeGuidedMissileState; terrainProbe: Readonly<BoneyardPoint>
  } {
  const radians = source.headingDeg * Math.PI / 180
  const delta = { x: Math.fround(Math.fround(Math.sin(radians)) * source.speed * actorTimeScale),
    y: Math.fround(Math.fround(-Math.cos(radians)) * source.speed * actorTimeScale) }
  const position = { x: Math.fround(source.position.x + delta.x), y: Math.fround(source.position.y + delta.y) }
  let headingDeg = source.headingDeg
  if (target !== null && actorTimeScale !== 0) {
    const aim = actorHeadingFromVector(target.x - position.x, target.y - position.y)
    const turn = nativeHeadingTurnDirection(source.headingDeg, aim)
    headingDeg = Math.fround(source.headingDeg + source.turnRate * actorTimeScale * turn)
  }
  return { state: { ...source, headingDeg, position,
    phaseDeg: Math.fround(source.phaseDeg + Math.fround(source.speed * actorTimeScale * 3) * 2),
    remainingTicks: Math.fround(source.remainingTicks - actorTimeScale),
    speed: Math.max(source.minimumSpeed, Math.fround(source.speed - actorTimeScale * .07500000298023224)),
  }, terrainProbe: { x: Math.fround(position.x + delta.x * 5), y: Math.fround(position.y + delta.y * 5) } }
}
