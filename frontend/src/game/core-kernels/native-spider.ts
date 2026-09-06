import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardPoint } from './boneyard.ts'
import { directionFromHeading } from './primary-spell-targeting.ts'
import { drawNativeFloat, drawNativeFloatRange, drawNativeInteger, drawNativeSign, type NativeRngState } from './native-rng.ts'
import { createNativeSilk, type NativeSilkCreation } from './native-silk.ts'

export interface NativeSpiderState {
  readonly actionState: 0 | 1 | 2 | 3 | 4 | 5
  readonly preferredDistance: number
  readonly bodyHeadingDeg: number
  readonly moveTicksRemaining: number
  readonly strafeSign: number
  readonly strafeTicksRemaining: number
  readonly actionTicksRemaining: number
  readonly frame: number
  readonly spitTicksRemaining: number
  readonly attached: boolean
  readonly verticalOffset: number
  readonly attachmentAngleDeg: number
  readonly attachmentDistance: number
  readonly suckTicks: number
}

export interface NativeSpiderTarget {
  readonly position: Readonly<BoneyardPoint>
  readonly headingDeg: number
  readonly radius: number
  readonly isPlayer: boolean
  readonly webSeverity: number
  readonly velocityPerTick: Readonly<BoneyardPoint>
}

export interface NativeSpiderMovement {
  readonly routeGoal?: (goal: Readonly<BoneyardPoint>) => Readonly<{
    goal: Readonly<BoneyardPoint>; followingRoute: boolean; turnAround: boolean
  }>
  readonly headingDeg: number
  readonly position: Readonly<BoneyardPoint>
  readonly speed: number
  readonly statusFactor: number
  readonly light: number
  readonly target: NativeSpiderTarget | null
  readonly wanderHeadingDeg: number
  readonly spitWebs: boolean
  readonly cocoonHealth: number
  readonly liveSilkCount: number
  readonly sharedSpitTicksRemaining: number
}

export interface NativeSpiderMovementResult {
  readonly state: NativeSpiderState
  readonly headingDeg: number
  readonly position: Readonly<BoneyardPoint>
  readonly goal: Readonly<BoneyardPoint>
  readonly bite: boolean
  readonly suck: boolean
  readonly silk: NativeSilkCreation | null
  readonly biteSounds: readonly [number, number] | null
  readonly sharedSpitTicksRemaining: number
  readonly rngState: NativeRngState
}

interface MovementWork {
  state: { -readonly [Key in keyof NativeSpiderState]: NativeSpiderState[Key] }
  headingDeg: number
  position: BoneyardPoint
  goal: BoneyardPoint
  bite: boolean
  suck: boolean
  silk: NativeSilkCreation | null
  biteSounds: readonly [number, number] | null
  sharedSpitTicksRemaining: number
  rngState: NativeRngState
  request: NativeSpiderMovement
}

export function createNativeSpiderState(distanceUnit: number): NativeSpiderState {
  return {
    actionState: 0,
    preferredDistance: Math.fround((180 + Math.fround(distanceUnit * 100)) / Math.fround(1.1)),
    bodyHeadingDeg: -1,
    moveTicksRemaining: 0,
    strafeSign: 0,
    strafeTicksRemaining: 0,
    actionTicksRemaining: 0,
    frame: 0,
    spitTicksRemaining: 0,
    attached: false,
    verticalOffset: 0,
    attachmentAngleDeg: 0,
    attachmentDistance: 0,
    suckTicks: 0,
  }
}

/** One native +0x6C movement call; the shared actor owner supplies the cadence. */
export function moveNativeSpider(
  source: NativeSpiderState,
  request: NativeSpiderMovement,
  rngState: NativeRngState,
): NativeSpiderMovementResult {
  const work: MovementWork = {
    state: { ...source }, headingDeg: request.headingDeg,
    position: { ...request.position }, goal: { ...request.position },
    bite: false, suck: false, silk: null, biteSounds: null,
    sharedSpitTicksRemaining: request.sharedSpitTicksRemaining,
    rngState, request,
  }
  const target = request.target
  if (target === null) {
    work.state.frame = integer(work, 3)
    work.goal = offset(work.position, request.wanderHeadingDeg, 10_000)
  } else {
    switch (work.state.actionState) {
      case 0: approach(work, target); break
      case 1: closeMovement(work, target); break
      case 2: strafe(work, target); break
      case 3:
        work.state.frame = 3
        if (work.state.actionTicksRemaining < 1) {
          work.state.actionState = 1
          work.state.frame = integer(work, 3)
        }
        break
      case 4: retreat(work, target); break
      case 5: attach(work, target); break
    }
    if (work.state.actionState !== 5) work.state.attached = false
    if (!work.state.attached) work.state.verticalOffset = Math.min(0, work.state.verticalOffset + 2)
  }
  const routed = request.routeGoal?.(work.goal)
  if (routed) work.goal = { ...routed.goal }
  if (routed?.turnAround) work.headingDeg += 180
  let dx = work.goal.x - work.position.x
  let dy = work.goal.y - work.position.y
  const distance = Math.hypot(dx, dy)
  if (work.state.actionState !== 5 && distance > request.speed) {
    dx *= request.speed / distance
    dy *= request.speed / distance
    work.goal = { x: work.position.x + dx, y: work.position.y + dy }
  }
  if (routed?.followingRoute || target === null) {
    work.state.bodyHeadingDeg = work.headingDeg
    work.headingDeg = actorHeadingFromVector(dx, dy)
    if (target === null) {
      work.headingDeg += floating(work, 45, true)
      work.goal = offset(work.position, work.headingDeg, request.speed * 1.5)
    }
  }
  work.state.actionTicksRemaining -= 1
  return work
}

/** BadGuy::Tick 0x004835F0 keeps the four movement clocks on the actor UID phase. */
export function nativeSpiderMovementClock(
  actorId: number, tick: number, visible: boolean, illuminated: boolean, enhanced = true,
): Readonly<{ due: boolean; cadence: number; full: boolean }> {
  const cadence = !visible ? 15 : !illuminated ? 10 : enhanced ? 2 : 5
  return { due: actorId % cadence === tick % cadence, cadence, full: visible && illuminated }
}

export function reactNativeSpiderToDamage(
  source: NativeSpiderState,
  magic: boolean,
  rngState: NativeRngState,
): Readonly<{ state: NativeSpiderState; rngState: NativeRngState }> {
  if (magic || (source.strafeTicksRemaining > 0 && source.actionState === 3)) return { state: source, rngState }
  const sign = drawNativeSign(rngState, 1)
  const duration = drawNativeInteger(sign.state, 21)
  return {
    state: { ...source, actionState: 2, strafeSign: sign.value, strafeTicksRemaining: duration.value * 2 + 40 },
    rngState: duration.state,
  }
}

function approach(work: MovementWork, target: NativeSpiderTarget): void {
  const near = distanceSquared(work.position, target.position) <= (work.state.preferredDistance * Math.fround(0.9)) ** 2
  const eligible = canSpit(work, target)
  const wantsSpit = near ? eligible && integer(work, 2) === 1
    : eligible && work.state.spitTicksRemaining < 1 && work.request.light === 0
  if (wantsSpit && target.webSeverity <= 2 && work.request.liveSilkCount < 4 && work.sharedSpitTicksRemaining < 1) {
    spit(work, target)
    work.state.actionTicksRemaining *= 3
    work.sharedSpitTicksRemaining = 5 + integer(work, 46)
    work.state.spitTicksRemaining = 200 + integer(work, 401)
    return
  }
  if (near) { enterClose(work); return }
  turn(work, bearing(work.position, target.position) + floating(work, 10, true))
  work.goal = offset(work.position, work.headingDeg, work.request.speed * work.request.statusFactor)
  work.state.frame = integer(work, 3)
}

function enterClose(work: MovementWork): void {
  work.state.actionState = 1
  work.state.moveTicksRemaining = 10 + integer(work, 41)
  work.headingDeg += range(work, -10, 10)
  work.state.actionTicksRemaining = 50 + integer(work, 51)
}

function closeMovement(work: MovementWork, target: NativeSpiderTarget): void {
  if (distanceSquared(work.position, target.position) < ((target.radius + 15) * 1.25) ** 2) {
    work.state.actionState = 5
    return
  }
  work.state.moveTicksRemaining -= 1
  if (work.state.moveTicksRemaining < 1) {
    work.state.moveTicksRemaining = 50 + integer(work, 151)
    work.headingDeg = bearing(work.position, target.position)
    const distance = range(work, 5, 15)
    const heading = floating(work, 360)
    work.goal = offset(work.position, heading, distance)
    work.state.bodyHeadingDeg = heading
    work.state.frame = integer(work, 3)
    limitBodyTurn(work)
    if (work.state.actionTicksRemaining < 1) chooseCloseAction(work, target)
  }
  if (work.request.light < Math.fround(0.05)) {
    work.state.actionState = 0
    if (work.state.preferredDistance > 150) work.state.preferredDistance = Math.fround(work.state.preferredDistance * Math.fround(0.8))
  }
}

function chooseCloseAction(work: MovementWork, target: NativeSpiderTarget): void {
  const severity = target.isPlayer ? target.webSeverity : 5
  const far = distanceSquared(work.position, target.position) >= work.state.preferredDistance ** 2
  if (integer(work, 4) === 1) {
    if (canSpit(work, target) && severity <= 2 && work.request.liveSilkCount < 4) spit(work, target)
    else if (far) startStrafe(work)
    else work.state.actionState = 5
    return
  }
  if (severity < 3) {
    if (integer(work, 3) === 1) startStrafe(work)
    return
  }
  if ((integer(work, 5) === 1 && far) || work.request.light <= Math.fround(0.1)) startStrafe(work)
  else work.state.actionState = 5
}

function startStrafe(work: MovementWork): void {
  const sign = drawNativeSign(work.rngState, 1)
  work.rngState = sign.state
  work.state.actionState = 2
  work.state.strafeSign = sign.value
  work.state.strafeTicksRemaining = 20 + integer(work, 21)
}

function strafe(work: MovementWork, target: NativeSpiderTarget): void {
  const heading = bearing(work.position, target.position) + (10 + floating(work, 10)) * work.state.strafeSign
  const direction = directionFromHeading(heading)
  const jitter = floating(work, 5)
  const jitterHeading = floating(work, 360)
  const jitterVector = offset({ x: 0, y: 0 }, jitterHeading, jitter)
  const speed = range(work, work.request.speed * 0.5, work.request.speed * 2)
  work.goal = {
    x: work.position.x + (direction.y * work.state.strafeSign * speed + jitterVector.x) * work.request.statusFactor,
    y: work.position.y + (-direction.x * work.state.strafeSign * speed + jitterVector.y) * work.request.statusFactor,
  }
  turn(work, heading + floating(work, 25, true))
  work.state.frame = integer(work, 3)
  work.state.strafeTicksRemaining -= 1
  if (work.state.strafeTicksRemaining < 1) {
    work.state.actionState = 1
    work.state.moveTicksRemaining = 0
    work.state.actionTicksRemaining = 100 + integer(work, 201)
  }
}

function retreat(work: MovementWork, target: NativeSpiderTarget): void {
  if (distanceSquared(work.position, target.position) >= (work.state.preferredDistance * Math.fround(0.9)) ** 2) {
    enterClose(work)
    return
  }
  turn(work, work.headingDeg + floating(work, 10, true))
  work.goal = offset(work.position, work.headingDeg, -work.request.speed * work.request.statusFactor)
  work.state.frame = integer(work, 3)
}

function attach(work: MovementWork, target: NativeSpiderTarget): void {
  work.state.frame = 3
  const distance = Math.sqrt(distanceSquared(work.position, target.position))
  if (distance > (target.radius + (work.state.attached ? 5 : 15)) * 1.5) {
    work.headingDeg = bearing(work.position, target.position)
    work.state.bodyHeadingDeg = work.headingDeg
    work.goal = offset(work.position, work.headingDeg, work.request.speed * work.request.statusFactor * 3)
    if (target.isPlayer && target.webSeverity < 3) detach(work, false)
    return
  }
  if (!work.state.attached) {
    work.bite = true
    work.biteSounds = [integer(work, 2), integer(work, 2)]
    work.state.verticalOffset = -range(work, 10, 20)
    work.state.attachmentAngleDeg = bearing(target.position, work.position) - target.headingDeg
    work.state.attachmentDistance = Math.min(distance, target.radius + 15)
    work.state.suckTicks = 0
  }
  work.state.attached = target.isPlayer && target.webSeverity >= 3
  if (!work.state.attached) { detach(work, true); return }
  work.position = offset(target.position, target.headingDeg + work.state.attachmentAngleDeg, work.state.attachmentDistance)
  work.goal = { ...work.position }
  work.headingDeg = bearing(work.position, target.position)
  work.state.bodyHeadingDeg = work.headingDeg + floating(work, 10, true)
  work.state.suckTicks += 1
  if (work.state.suckTicks > 25) {
    work.state.suckTicks = 0
    work.suck = true
  }
}

function detach(work: MovementWork, contacted: boolean): void {
  work.state.actionState = 4
  work.headingDeg += floating(work, 25, true)
  if (contacted) work.state.verticalOffset = -35
}

function spit(work: MovementWork, target: NativeSpiderTarget): void {
  const position = offset(work.position, work.headingDeg, 20)
  position.y += 10
  const silk = createNativeSilk(position, target, work.request.cocoonHealth, work.rngState)
  work.rngState = silk.rngState
  work.state.actionState = 3
  work.state.actionTicksRemaining = 50
  work.silk = silk
}

function canSpit(work: MovementWork, target: NativeSpiderTarget): boolean {
  return work.request.spitWebs && target.isPlayer
}

function turn(work: MovementWork, heading: number): void {
  work.state.bodyHeadingDeg = work.headingDeg
  work.headingDeg = heading
  limitBodyTurn(work)
}

function limitBodyTurn(work: MovementWork): void {
  const delta = ((work.state.bodyHeadingDeg - work.headingDeg + 540) % 360 + 360) % 360 - 180
  if (Math.abs(delta) > 40) work.state.bodyHeadingDeg = work.headingDeg
}

function integer(work: MovementWork, bound: number): number {
  const draw = drawNativeInteger(work.rngState, bound)
  work.rngState = draw.state
  return draw.value
}

function floating(work: MovementWork, maximum: number, signed = false): number {
  const draw = drawNativeFloat(work.rngState, maximum, signed)
  work.rngState = draw.state
  return draw.value
}

function range(work: MovementWork, low: number, high: number): number {
  const draw = drawNativeFloatRange(work.rngState, low, high)
  work.rngState = draw.state
  return draw.value
}

function bearing(from: Readonly<BoneyardPoint>, to: Readonly<BoneyardPoint>): number {
  return actorHeadingFromVector(to.x - from.x, to.y - from.y)
}

function offset(point: Readonly<BoneyardPoint>, heading: number, distance: number): BoneyardPoint {
  const direction = directionFromHeading(heading)
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }
}

function distanceSquared(a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}
