import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardPoint } from './boneyard.ts'
import {
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  drawNativeSign,
  type NativeRngState,
} from './native-rng.ts'
import { nativeHeadingTurnDirection } from './primary-spell-targeting.ts'

export interface NativeCrowState {
  readonly age: number
  readonly diveSpeed: number
  readonly flapCycles: number
  readonly flapPhase: number
  readonly glideTicks: number
  readonly headingDeg: number
  readonly height: number
  readonly heightPerDistance: number
  readonly id: number
  readonly lightIntensity: number
  readonly maximumSpeed: number
  readonly orbitPhaseDeg: number
  readonly orbitRadius: number
  readonly phase: 'orbit' | 'dive'
  readonly position: Readonly<BoneyardPoint> | null
  readonly speed: number
  readonly targetId: string | null
}

export interface NativeCrowTarget {
  readonly id: string
  readonly position: Readonly<BoneyardPoint>
}

export interface NativeCrowStep {
  readonly crow: NativeCrowState | null
  readonly parentCooldownTicks: number | null
  readonly returnPitch: number | null
  readonly rng: NativeRngState
  readonly struckTargetId: string | null
}

type MutableCrow = { -readonly [K in keyof NativeCrowState]: NativeCrowState[K] }

interface CrowFlight {
  crow: MutableCrow
  parentCooldownTicks: number | null
  returnPitch: number | null
  rng: NativeRngState
  struckTargetId: string | null
}

export function createNativeCrow(id: number, sourceRng: NativeRngState): {
  crow: NativeCrowState
  rng: NativeRngState
} {
  const phase = drawNativeFloat(sourceRng, 360)
  const radius = drawNativeFloat(phase.state, 40)
  const speed = drawNativeFloat(radius.state, 0.15000003576278687)
  const glide = drawNativeInteger(speed.state, 201)
  const height = drawNativeFloat(glide.state, 50)
  const age = drawNativeInteger(height.state, 10_000)
  const maximumSpeed = Math.fround(speed.value + 0.949999988079071)
  return {
    crow: {
      age: age.value,
      diveSpeed: 0,
      flapCycles: 0,
      flapPhase: 5,
      glideTicks: glide.value + 100,
      headingDeg: Math.fround(phase.value + 90),
      height: Math.fround(height.value + 100),
      heightPerDistance: 0,
      id,
      lightIntensity: 1,
      maximumSpeed,
      orbitPhaseDeg: phase.value,
      orbitRadius: Math.fround(radius.value + 40),
      phase: 'orbit',
      position: null,
      speed: maximumSpeed,
      targetId: null,
    },
    rng: age.state,
  }
}

/** Parent-owned updates run in flock order; detached birds use the Arena effect list. */
export function stepNativeCrow(
  source: NativeCrowState,
  rng: NativeRngState,
  parentPosition: Readonly<BoneyardPoint> | null,
  mayAttack: boolean,
  targets: readonly NativeCrowTarget[],
  isVisible: (position: Readonly<BoneyardPoint>) => boolean,
): NativeCrowStep {
  const flight: CrowFlight = {
    crow: { ...source, age: source.age + 1 },
    parentCooldownTicks: null,
    returnPitch: null,
    rng,
    struckTargetId: null,
  }
  const crow = flight.crow
  if (parentPosition === null) {
    if (crow.position === null) return { ...flight, crow: null }
    stepDetachedCrow(crow)
    if (!isVisible({ x: crow.position.x, y: crow.position.y - crow.height })) {
      return { ...flight, crow: null }
    }
    return flight
  }
  if (crow.phase === 'orbit') {
    stepOrbit(crow, parentPosition)
    if (mayAttack && crow.speed >= crow.maximumSpeed && crow.age % 5 === 0) {
      acquireDiveTarget(flight, targets)
    }
    crow.speed = Math.min(crow.maximumSpeed, Math.fround(crow.speed + 0.02500000037252903))
    stepOrbitWings(flight)
  }
  if (crow.phase === 'dive') stepDive(flight)
  return flight
}

function stepOrbit(crow: MutableCrow, parent: Readonly<BoneyardPoint>): void {
  if (crow.position === null) {
    const initial = crowDirection(crow.orbitPhaseDeg)
    crow.position = {
      x: Math.fround(parent.x + initial.x * crow.orbitRadius),
      y: Math.fround(parent.y + initial.y * crow.orbitRadius),
    }
    crow.orbitPhaseDeg = Math.fround(crow.orbitPhaseDeg + 5)
  }
  const radial = crowDirection(crow.orbitPhaseDeg)
  const goal = {
    x: Math.fround(parent.x + radial.x * crow.orbitRadius),
    y: Math.fround(parent.y + radial.y * crow.orbitRadius),
  }
  const desired = actorHeadingFromVector(goal.x - crow.position.x, goal.y - crow.position.y)
  crow.headingDeg = normalize(Math.fround(crow.headingDeg
    + nativeHeadingTurnDirection(crow.headingDeg, desired) * 1.25))
  moveCrow(crow, Math.fround(crow.speed * 2.5))
  if ((goal.x - crow.position!.x) ** 2 + (goal.y - crow.position!.y) ** 2 < 100) {
    crow.orbitPhaseDeg = Math.fround(crow.orbitPhaseDeg + 2)
  }
}

function acquireDiveTarget(flight: CrowFlight, targets: readonly NativeCrowTarget[]): void {
  const crow = flight.crow
  const position = crow.position!
  for (const target of targets) {
    const dx = target.position.x - position.x
    const dy = target.position.y - position.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared <= 10_000 || distanceSquared >= 22_500) continue
    const heading = actorHeadingFromVector(dx, dy)
    const gap = Math.abs(normalize(crow.headingDeg) - normalize(heading))
    if (Math.min(gap, 360 - gap) >= 20) continue
    crow.targetId = target.id
    crow.heightPerDistance = Math.fround((crow.height - 15) / Math.sqrt(distanceSquared))
    crow.diveSpeed = Math.fround(crow.maximumSpeed * 2.5)
    crow.headingDeg = Math.fround(heading)
    crow.phase = 'dive'
    crow.glideTicks = 2
    const delay = drawNativeInteger(flight.rng, 76)
    flight.rng = delay.state
    flight.parentCooldownTicks = delay.value + 50
    return
  }
}

function stepOrbitWings(flight: CrowFlight): void {
  const crow = flight.crow
  if (crow.glideTicks > 0 && crow.height > 100) {
    crow.glideTicks -= 1
    crow.height = Math.max(100, Math.fround(crow.height - .25))
    crow.flapPhase = 5
    if (crow.glideTicks === 0) {
      crow.flapPhase = Math.fround(5.9)
      const cycles = drawNativeInteger(flight.rng, 4)
      flight.rng = cycles.state
      crow.flapCycles = cycles.value + 2
    }
    return
  }
  if (crow.height >= 100 && crow.flapPhase <= 5
    && Math.fround(crow.flapPhase + .15000000596046448) >= 5) {
    crow.flapCycles -= 1
    if (crow.flapCycles < 1) {
      const glide = drawNativeInteger(flight.rng, 201)
      flight.rng = glide.state
      crow.glideTicks = glide.value + 100
    }
  }
  crow.height = Math.min(150, Math.fround(crow.height + .3499999940395355))
  if (crow.speed < 0) crow.height = Math.min(175, Math.fround(crow.height + .5))
  if (crow.flapCycles > 0) advanceWings(crow)
}

function stepDive(flight: CrowFlight): void {
  const crow = flight.crow
  crow.flapPhase = 3
  moveCrow(crow, crow.diveSpeed)
  crow.height = Math.fround(crow.height - crow.heightPerDistance * crow.diveSpeed)
  crow.diveSpeed = Math.fround(Math.fround(crow.diveSpeed + .10000000149011612)
    * 1.0099999904632568)
  crow.speed = -1
  if (crow.height > 15) return
  flight.struckTargetId = crow.targetId
  crow.glideTicks = 0
  crow.flapCycles = 5
  const perturb = drawNativeFloatRange(flight.rng, 20, 30)
  const sign = drawNativeSign(perturb.state, perturb.value)
  crow.headingDeg = Math.fround(crow.headingDeg + sign.value)
  const pitch = drawNativeFloatRange(sign.state, .949999988079071, 1.0499999523162842)
  flight.returnPitch = pitch.value
  const radius = drawNativeFloatRange(pitch.state, 40, 120)
  const phase = drawNativeFloat(radius.state, 360)
  flight.rng = phase.state
  crow.phase = 'orbit'
  crow.orbitRadius = radius.value
  crow.orbitPhaseDeg = phase.value
}

function stepDetachedCrow(crow: MutableCrow): void {
  moveCrow(crow, Math.fround(crow.speed * 2.5))
  crow.headingDeg = normalize(Math.fround(crow.headingDeg + (crow.id % 2 === 0 ? -1 : 1)))
  crow.speed = Math.fround(crow.speed + .019999999552965164)
  crow.height = Math.min(150, Math.fround(crow.height + .5))
  if (crow.speed < 0) crow.height = Math.min(175, Math.fround(crow.height + .5))
  advanceWings(crow)
}

function advanceWings(crow: MutableCrow): void {
  crow.flapPhase = Math.fround(crow.flapPhase + .15000000596046448)
  if (crow.height < 100) crow.flapPhase = Math.fround(crow.flapPhase + .15000000596046448)
  if (crow.flapPhase >= 6) crow.flapPhase = Math.fround(crow.flapPhase - 6)
}

function moveCrow(crow: MutableCrow, distance: number): void {
  const heading = crowDirection(crow.headingDeg)
  const position = crow.position!
  crow.position = {
    x: Math.fround(position.x + heading.x * distance),
    y: Math.fround(position.y + heading.y * distance),
  }
}

function normalize(heading: number): number {
  if (heading < 0) return heading + 360
  return heading >= 360 ? heading - 360 : heading
}

function crowDirection(heading: number): Readonly<BoneyardPoint> {
  const radians = Math.fround(Math.fround(Math.PI) * heading / 180)
  return { x: Math.fround(Math.sin(radians)), y: Math.fround(-Math.cos(radians)) }
}
