export interface NativeDemonPoint {
  readonly x: number
  readonly y: number
}

export type NativeDemonExtremity = 'front' | 'rear'

export interface NativeDemonExtremityState {
  readonly current: NativeDemonPoint
  readonly liftY: number
  readonly phase: number
  readonly start: NativeDemonPoint
  readonly target: NativeDemonPoint
}

export interface NativeDemonArticulationState {
  readonly completedSteps: number
  readonly front: NativeDemonExtremityState
  readonly frontBaseRotationDeg: number
  readonly rear: NativeDemonExtremityState
  readonly rearBaseRotationDeg: number
  readonly stepIntervalTicks: number
}

export interface NativeDemonArticulationSample {
  readonly frontExtremityOffset: NativeDemonPoint
  readonly frontRotationRadians: number
  readonly rearExtremityOffset: NativeDemonPoint
  readonly rearRotationRadians: number
  readonly verticalOffset: number
}

export interface StepNativeDemonArticulationContext {
  readonly active: boolean
  readonly actorId: number
  readonly headingDeg: number
  readonly position: NativeDemonPoint
  readonly scale: number
  readonly spawnTick: number
  readonly tick: number
}

export const NATIVE_DEMON_BOMB_CONTROLLER_POSES = Object.freeze([
  0, 0, 0, 1, 1, 1, 1, 1, 0,
] as const)

export const NATIVE_DEMON_EXTREMITY_DRAW_SCALE = 0.8
export const NATIVE_DEMON_CONTROLLER_DRAW_SCALE = 1.2
export const NATIVE_DEMON_CONTROLLER_POINT_SCALE = 1.5
export const NATIVE_DEMON_STEP_INTERVAL_MINIMUM_TICKS = 76
export const NATIVE_DEMON_STEP_INTERVAL_MAXIMUM_TICKS = 150
export const NATIVE_DEMON_ROOT_SNAP_DISTANCE = 30

const NATIVE_DEMON_STEP_HORIZONTAL_OFFSET = 12
const NATIVE_DEMON_STEP_VERTICAL_OFFSET = -30
const NATIVE_DEMON_STEP_PHASE_ADD = 0.015
const NATIVE_DEMON_STEP_PHASE_MULTIPLIER = 1.06
const NATIVE_DEMON_STEP_LIFT = 6
const NATIVE_DEMON_BASE_ROTATION_MINIMUM_DEG = -20
const NATIVE_DEMON_BASE_ROTATION_RANGE_DEG = 30

export function createNativeDemonArticulationState(
  actorId: number,
  spawnTick: number,
  position: NativeDemonPoint,
  headingDeg: number,
  scale: number,
): NativeDemonArticulationState {
  requireActorId(actorId)
  requireTick(spawnTick, 'Demon spawn tick')
  requirePoint(position, 'Demon spawn position')
  requireHeadingAndScale(headingDeg, scale)
  const front = settledExtremity(nativeDemonExtremityTarget(
    position,
    headingDeg,
    scale,
    'front',
  ))
  const rear = settledExtremity(nativeDemonExtremityTarget(
    position,
    headingDeg,
    scale,
    'rear',
  ))
  const stepIntervalTicks = NATIVE_DEMON_STEP_INTERVAL_MAXIMUM_TICKS
    - Math.floor(deterministicUnit(actorId, spawnTick, 0) * 75)
  return Object.freeze({
    completedSteps: 0,
    front,
    frontBaseRotationDeg: 0,
    rear,
    rearBaseRotationDeg: 1,
    stepIntervalTicks,
  })
}

export function nativeDemonExtremityTarget(
  position: NativeDemonPoint,
  headingDeg: number,
  scale: number,
  extremity: NativeDemonExtremity,
): NativeDemonPoint {
  requirePoint(position, 'Demon extremity owner position')
  requireHeadingAndScale(headingDeg, scale)
  const facing = positiveModulo(Math.trunc((headingDeg + 9) / 20), 18)
  const radians = facing * 20 * Math.PI / 180
  const x = (extremity === 'front' ? 1 : -1)
    * NATIVE_DEMON_STEP_HORIZONTAL_OFFSET
    * scale
  const y = NATIVE_DEMON_STEP_VERTICAL_OFFSET * scale
  return Object.freeze({
    x: position.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: position.y + x * Math.sin(radians) + y * Math.cos(radians),
  })
}

export function stepNativeDemonArticulation(
  source: NativeDemonArticulationState,
  context: StepNativeDemonArticulationContext,
): NativeDemonArticulationState {
  validateState(source)
  requireActorId(context.actorId)
  requireTick(context.spawnTick, 'Demon spawn tick')
  requireTick(context.tick, 'Demon sample tick')
  if (context.tick < context.spawnTick) {
    throw new RangeError('Demon sample tick must not precede spawn')
  }
  requirePoint(context.position, 'Demon position')
  requireHeadingAndScale(context.headingDeg, context.scale)
  if (!context.active) return source

  const phaseTick = positiveModulo(context.tick, source.stepIntervalTicks)
  let front = phaseTick === 0
    ? replantExtremity(source.front, nativeDemonExtremityTarget(
        context.position,
        context.headingDeg,
        context.scale,
        'front',
      ))
    : source.front
  let rear = phaseTick === Math.floor(source.stepIntervalTicks / 2)
    ? replantExtremity(source.rear, nativeDemonExtremityTarget(
        context.position,
        context.headingDeg,
        context.scale,
        'rear',
      ))
    : source.rear

  const advancedFront = advanceExtremity(front)
  const advancedRear = advanceExtremity(rear)
  front = advancedFront.state
  rear = advancedRear.state

  let completedSteps = source.completedSteps
  let frontBaseRotationDeg = source.frontBaseRotationDeg
  let rearBaseRotationDeg = source.rearBaseRotationDeg
  for (const completed of [advancedFront.completed, advancedRear.completed]) {
    if (!completed) continue
    const channel = 1 + completedSteps * 2
    const selected = deterministicUnit(context.actorId, context.spawnTick, channel) < 0.5
      ? 'front'
      : 'rear'
    const baseRotationDeg = NATIVE_DEMON_BASE_ROTATION_MINIMUM_DEG
      + deterministicUnit(context.actorId, context.spawnTick, channel + 1)
        * NATIVE_DEMON_BASE_ROTATION_RANGE_DEG
    if (selected === 'front') frontBaseRotationDeg = baseRotationDeg
    else rearBaseRotationDeg = baseRotationDeg
    completedSteps += 1
  }

  return Object.freeze({
    completedSteps,
    front,
    frontBaseRotationDeg,
    rear,
    rearBaseRotationDeg,
    stepIntervalTicks: source.stepIntervalTicks,
  })
}

export function nativeDemonArticulationRoot(
  state: NativeDemonArticulationState,
): NativeDemonPoint {
  validateState(state)
  return Object.freeze({
    x: (state.front.current.x + state.rear.current.x) * 0.5,
    y: (
      state.front.current.y
      + state.front.liftY
      + state.rear.current.y
      + state.rear.liftY
    ) * 0.5,
  })
}

export function assertNativeDemonArticulationState(
  state: NativeDemonArticulationState,
): void {
  validateState(state)
}

/** Renderer 0x00498BA0 consumes fixed-tick endpoint and controller state. */
export function nativeDemonArticulationSample(
  state: NativeDemonArticulationState,
  tick: number,
  spawnTick: number,
  controllerPose: number,
  actorPosition: NativeDemonPoint,
  actorScale: number,
): NativeDemonArticulationSample {
  validateState(state)
  requireTick(tick, 'Demon sample tick')
  requireTick(spawnTick, 'Demon spawn tick')
  if (tick < spawnTick) throw new RangeError('Demon sample tick must not precede spawn')
  if (!Number.isSafeInteger(controllerPose) || controllerPose < 0 || controllerPose > 1) {
    throw new RangeError('Demon controller pose must be 0 or 1')
  }
  requirePoint(actorPosition, 'Demon actor position')
  requireHeadingAndScale(0, actorScale)
  const ageTicks = tick - spawnTick
  const wave = 2 * sinDegrees(tick)
  const frontRotationDeg = controllerPose === 1
    ? 40
    : wave + state.frontBaseRotationDeg
  const rearRotationDeg = controllerPose === 1
    ? -40
    : wave + state.rearBaseRotationDeg
  return Object.freeze({
    frontExtremityOffset: localExtremityOffset(state.front, actorPosition, actorScale),
    frontRotationRadians: degreesToRadians(frontRotationDeg),
    rearExtremityOffset: localExtremityOffset(state.rear, actorPosition, actorScale),
    rearRotationRadians: degreesToRadians(rearRotationDeg),
    verticalOffset: -Math.abs(sinDegrees(ageTicks * 0.25)) * 3,
  })
}

function settledExtremity(point: NativeDemonPoint): NativeDemonExtremityState {
  return Object.freeze({
    current: point,
    liftY: 0,
    phase: 1,
    start: point,
    target: point,
  })
}

function replantExtremity(
  source: NativeDemonExtremityState,
  target: NativeDemonPoint,
): NativeDemonExtremityState {
  return Object.freeze({
    current: source.current,
    liftY: 0,
    phase: 0,
    start: source.current,
    target,
  })
}

function advanceExtremity(
  source: NativeDemonExtremityState,
): Readonly<{ completed: boolean; state: NativeDemonExtremityState }> {
  if (source.phase >= 1) return Object.freeze({ completed: false, state: source })
  const rawPhase = (source.phase + NATIVE_DEMON_STEP_PHASE_ADD)
    * NATIVE_DEMON_STEP_PHASE_MULTIPLIER
  const phase = Math.min(1, rawPhase)
  return Object.freeze({
    completed: rawPhase > 1,
    state: Object.freeze({
      current: Object.freeze({
        x: source.start.x + phase * (source.target.x - source.start.x),
        y: source.start.y + phase * (source.target.y - source.start.y),
      }),
      liftY: -Math.sin(phase * Math.PI) * NATIVE_DEMON_STEP_LIFT,
      phase,
      start: source.start,
      target: source.target,
    }),
  })
}

function localExtremityOffset(
  extremity: NativeDemonExtremityState,
  actorPosition: NativeDemonPoint,
  actorScale: number,
): NativeDemonPoint {
  return Object.freeze({
    x: (extremity.current.x - actorPosition.x) / actorScale,
    y: (extremity.current.y + extremity.liftY - actorPosition.y) / actorScale,
  })
}

function deterministicUnit(actorId: number, spawnTick: number, channel: number): number {
  let value = (
    (actorId >>> 0)
    ^ Math.imul((spawnTick + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul(channel + 1, 0x85ebca6b)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}

function validateState(state: NativeDemonArticulationState): void {
  if (
    !Number.isSafeInteger(state.completedSteps)
    || state.completedSteps < 0
    || !Number.isSafeInteger(state.stepIntervalTicks)
    || state.stepIntervalTicks < NATIVE_DEMON_STEP_INTERVAL_MINIMUM_TICKS
    || state.stepIntervalTicks > NATIVE_DEMON_STEP_INTERVAL_MAXIMUM_TICKS
    || !Number.isFinite(state.frontBaseRotationDeg)
    || !Number.isFinite(state.rearBaseRotationDeg)
  ) throw new RangeError('Demon articulation state is invalid')
  validateExtremity(state.front)
  validateExtremity(state.rear)
}

function validateExtremity(state: NativeDemonExtremityState): void {
  requirePoint(state.current, 'Demon extremity current point')
  requirePoint(state.start, 'Demon extremity start point')
  requirePoint(state.target, 'Demon extremity target point')
  if (!Number.isFinite(state.phase) || state.phase < 0 || state.phase > 1) {
    throw new RangeError('Demon extremity phase must be within [0,1]')
  }
  if (!Number.isFinite(state.liftY) || state.liftY > 0) {
    throw new RangeError('Demon extremity lift must be finite and non-positive')
  }
}

function requireActorId(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError('Demon actor id must be a positive safe integer')
  }
}

function requireHeadingAndScale(headingDeg: number, scale: number): void {
  if (!Number.isFinite(headingDeg)) throw new RangeError('Demon heading must be finite')
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('Demon actor scale must be finite and positive')
  }
}

function requirePoint(point: NativeDemonPoint, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must contain finite coordinates`)
  }
}

function sinDegrees(value: number): number {
  return Math.sin(degreesToRadians(value))
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function requireTick(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
}
