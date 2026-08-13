import type { Vector2 } from './core-kernels/vector.ts'

export type HubAstronomerMainBank = 'gesture' | 'idle' | 'transition'

export interface HubAstronomerMainActorFrame {
  bank: HubAstronomerMainBank
  frame: number
  position: Vector2
}

export interface HubAstronomerAssistantFrame {
  frame: number
  position: Vector2
}

export interface HubAstronomerFrame {
  assistants: {
    blue: HubAstronomerAssistantFrame
    brown: HubAstronomerAssistantFrame
    gray: HubAstronomerAssistantFrame
    purple: HubAstronomerAssistantFrame
  }
  green: HubAstronomerMainActorFrame
  red: HubAstronomerMainActorFrame
  telescopeFrame: number
}

export const HUB_ASTRONOMER_ROOT = { x: 1740, y: 911 } as const
export const HUB_ASTRONOMER_TELESCOPE_ORIGIN = { x: 1467, y: 642 } as const

const CHECKPOINT_TICKS = 512
const RNG_SEED = 0x5025f0
const TELESCOPE_FRAME_COUNT = 5
const TELESCOPE_POSITION_LIMIT = 5
const TELESCOPE_STEP = Math.fround(0.07999999821186066)
const TELESCOPE_OVERSHOOT_CORRECTION = Math.fround(0.03999999910593033)
const TRANSITION_STEP = Math.fround(0.014999999664723873)
const ASSISTANT_INWARD_STEP = Math.fround(0.20000000298023224)
const ASSISTANT_OUTWARD_STEP = Math.fround(0.10000000149011612)
const ASSISTANT_BLEND_LIMIT = 3
const BOB_STEP = Math.fround(0.04500000178813934)
const BOB_LIMIT = Math.fround(2.9000000953674316)
const MAIN_ROOT_RED = { x: 61, y: -120 } as const
const MAIN_ROOT_GREEN = { x: -102, y: -109 } as const
const RED_PATH = [
  { x: -45, y: -110 },
  { x: -16, y: -106 },
  { x: 14, y: -99 },
  { x: 48, y: -91 },
  { x: 74, y: -78 },
] as const
const GREEN_PATH = [
  { x: -105, y: -75 },
  { x: -88, y: -80 },
  { x: -65, y: -85 },
  { x: -36, y: -95 },
  { x: -6, y: -105 },
] as const

interface GesturePulseState {
  active: boolean
  phaseDegrees: number
  speedDegrees: number
}

interface AstronomerState {
  active: boolean
  bobDirection: -1 | 0 | 1
  bobPhase: number
  direction: -1 | 1
  gestureTicks: number
  greenFrame: number
  holdTicks: number
  leftBlend: number
  leftBounce: number
  pulses: readonly [
    GesturePulseState,
    GesturePulseState,
    GesturePulseState,
    GesturePulseState,
  ]
  redFrame: number
  rightBlend: number
  rightBounce: number
  rngState: number
  telescopePosition: number
  transition: number
}

interface RandomSample {
  state: number
  value: number
}

const INITIAL_PULSE: GesturePulseState = {
  active: false,
  phaseDegrees: 0,
  speedDegrees: 0,
}

const ASTRONOMER_CHECKPOINTS: AstronomerState[] = [{
  active: false,
  bobDirection: 0,
  bobPhase: 0,
  direction: 1,
  gestureTicks: 0,
  greenFrame: 0,
  holdTicks: 0,
  leftBlend: 0,
  leftBounce: 0,
  pulses: [INITIAL_PULSE, INITIAL_PULSE, INITIAL_PULSE, INITIAL_PULSE],
  redFrame: 0,
  rightBlend: 1,
  rightBounce: 0,
  rngState: RNG_SEED,
  telescopePosition: 0,
  transition: 0,
}]

export function hubAstronomerFrameAt(tick: number): HubAstronomerFrame {
  const fixedTick = Math.max(0, Math.floor(tick))
  const checkpointIndex = Math.floor(fixedTick / CHECKPOINT_TICKS)
  let state = astronomerCheckpoint(checkpointIndex)
  const remainder = fixedTick % CHECKPOINT_TICKS
  for (let update = 0; update < remainder; update += 1) {
    state = stepAstronomer(state)
  }
  return presentAstronomer(state)
}

function astronomerCheckpoint(index: number): AstronomerState {
  while (ASTRONOMER_CHECKPOINTS.length <= index) {
    let state = ASTRONOMER_CHECKPOINTS.at(-1)!
    for (let tick = 0; tick < CHECKPOINT_TICKS; tick += 1) {
      state = stepAstronomer(state)
    }
    ASTRONOMER_CHECKPOINTS.push(state)
  }
  return ASTRONOMER_CHECKPOINTS[index]
}

function stepAstronomer(state: AstronomerState): AstronomerState {
  let rngState = state.rngState
  const pulses: GesturePulseState[] = []
  for (const pulse of state.pulses) {
    const stepped = stepGesturePulse(pulse, rngState)
    pulses.push(stepped.pulse)
    rngState = stepped.rngState
  }

  let active = state.active
  let direction = state.direction
  let transition = state.transition
  let holdTicks = state.holdTicks
  let gestureTicks = state.gestureTicks
  let redFrame = state.redFrame
  let greenFrame = state.greenFrame
  let telescopePosition = state.telescopePosition
  let rightBounce = Math.max(0, state.rightBounce - 10)
  let leftBounce = Math.max(0, state.leftBounce - 10)

  if (!active) {
    const trigger = randomInt(rngState, 50)
    rngState = trigger.state
    if (trigger.value === 8) {
      const hold = randomInt(rngState, 100)
      rngState = hold.state
      active = true
      direction = telescopePosition === 0 ? 1 : -1
      transition = 1
      holdTicks = hold.value + 200
      gestureTicks = 0
    }
  }

  if (active) {
    holdTicks -= 1
    if (holdTicks < 1) {
      redFrame = 0
      greenFrame = 0
      if (transition > 0) {
        const previous = transition
        transition = Math.fround(Math.max(0, transition - TRANSITION_STEP))
        if (previous > 0 && transition === 0) {
          if (direction > 0) leftBounce = 180
          else rightBounce = 180
        }
      }
      if (transition <= 0) {
        telescopePosition = Math.fround(
          telescopePosition + Math.fround(direction * TELESCOPE_STEP),
        )
        if (direction > 0 && telescopePosition > 4.25) {
          telescopePosition = Math.fround(
            telescopePosition - direction * TELESCOPE_OVERSHOOT_CORRECTION,
          )
        }
        if (telescopePosition <= 0) {
          telescopePosition = 0
          active = false
        }
        if (telescopePosition > TELESCOPE_POSITION_LIMIT) {
          telescopePosition = TELESCOPE_POSITION_LIMIT
          active = false
        }
      }
    } else {
      gestureTicks -= 1
      if (gestureTicks < 1) {
        const pose = randomInt(rngState, 4)
        rngState = pose.state
        if (direction > 0) redFrame = pose.value
        else greenFrame = pose.value
        const delay = randomInt(rngState, 15)
        rngState = delay.state
        gestureTicks = delay.value + 15
      }
    }
  }

  const bob = stepBob(state.bobPhase, state.bobDirection, rngState)
  rngState = bob.rngState
  const rightBlend = telescopePosition >= 4.5
    ? Math.fround(Math.max(0, state.rightBlend - ASSISTANT_OUTWARD_STEP))
    : Math.fround(Math.min(
        ASSISTANT_BLEND_LIMIT,
        state.rightBlend + ASSISTANT_INWARD_STEP,
      ))
  const leftBlend = telescopePosition <= 0.5
    ? Math.fround(Math.max(0, state.leftBlend - ASSISTANT_OUTWARD_STEP))
    : Math.fround(Math.min(
        ASSISTANT_BLEND_LIMIT,
        state.leftBlend + ASSISTANT_INWARD_STEP,
      ))

  return {
    active,
    bobDirection: bob.direction,
    bobPhase: bob.phase,
    direction,
    gestureTicks,
    greenFrame,
    holdTicks,
    leftBlend,
    leftBounce,
    pulses: [pulses[0], pulses[1], pulses[2], pulses[3]],
    redFrame,
    rightBlend,
    rightBounce,
    rngState,
    telescopePosition,
    transition,
  }
}

function stepGesturePulse(
  pulse: GesturePulseState,
  rngState: number,
): { pulse: GesturePulseState; rngState: number } {
  if (!pulse.active) {
    const trigger = randomInt(rngState, 200)
    if (trigger.value !== 2) return { pulse, rngState: trigger.state }
    const speed = nextRandom(trigger.state)
    return {
      pulse: {
        active: true,
        phaseDegrees: 0,
        speedDegrees: Math.fround((speed.value * 3 + 1) * 0.44999998807907104),
      },
      rngState: speed.state,
    }
  }

  const phaseDegrees = Math.fround(pulse.phaseDegrees + pulse.speedDegrees)
  if (phaseDegrees >= 180) {
    return {
      pulse: INITIAL_PULSE,
      rngState,
    }
  }
  return {
    pulse: { ...pulse, phaseDegrees },
    rngState,
  }
}

function stepBob(
  phase: number,
  direction: -1 | 0 | 1,
  rngState: number,
): { direction: -1 | 0 | 1; phase: number; rngState: number } {
  let nextDirection = direction
  let nextRngState = rngState
  if (nextDirection === 0) {
    const trigger = randomInt(nextRngState, 100)
    nextRngState = trigger.state
    if (trigger.value === 3) nextDirection = phase <= 2 ? 1 : -1
  }

  let nextPhase = phase
  if (nextDirection > 0) {
    nextPhase = Math.fround(phase + BOB_STEP)
    if (nextPhase > BOB_LIMIT) {
      nextPhase = BOB_LIMIT
      nextDirection = 0
    }
  } else if (nextDirection < 0) {
    nextPhase = Math.fround(phase - BOB_STEP)
    if (nextPhase < 0) {
      nextPhase = 0
      nextDirection = 0
    }
  }
  return { direction: nextDirection, phase: nextPhase, rngState: nextRngState }
}

function presentAstronomer(state: AstronomerState): HubAstronomerFrame {
  const telescopeFrame = clampInteger(state.telescopePosition, 0, TELESCOPE_FRAME_COUNT - 1)
  const pathFrame = clampInteger(state.telescopePosition, 0, 4)
  const mainBob = -Math.sin(state.bobPhase) * 12
  const preparing = state.active && state.holdTicks < 1 && state.transition > 0
  const moving = state.active && state.holdTicks < 1 && state.transition <= 0
  const red = mainActorFrame(
    'red',
    state,
    pathFrame,
    mainBob,
    preparing,
    moving,
  )
  const green = mainActorFrame(
    'green',
    state,
    pathFrame,
    mainBob,
    preparing,
    moving,
  )
  const rightDelta = ASSISTANT_BLEND_LIMIT - state.rightBlend
  const leftDelta = ASSISTANT_BLEND_LIMIT - state.leftBlend
  const wave = Math.sin(state.bobPhase)
  const grayBob = state.rightBounce > 0 ? -wave * 9 : -Math.abs(wave) * 2
  const blueBob = state.rightBounce > 0 ? -wave * 12 : -Math.abs(wave) * 2
  const leftBob = state.leftBounce > 0 ? -wave * 12 : -Math.abs(wave) * 4

  return {
    assistants: {
      blue: {
        frame: pulseFrame(state.pulses[1]),
        position: worldPosition(
          MAIN_ROOT_RED.x + 20 - 4 * rightDelta,
          MAIN_ROOT_RED.y + 75 - 10 * rightDelta + blueBob,
        ),
      },
      brown: {
        frame: pulseFrame(state.pulses[3]),
        position: worldPosition(
          MAIN_ROOT_GREEN.x - 10 + 4 * leftDelta,
          MAIN_ROOT_GREEN.y + 80 - 10 * leftDelta + leftBob,
        ),
      },
      gray: {
        frame: pulseFrame(state.pulses[0]),
        position: worldPosition(
          MAIN_ROOT_RED.x + 65 - 5 * rightDelta,
          MAIN_ROOT_RED.y + 35 - 4 * rightDelta + grayBob,
        ),
      },
      purple: {
        frame: pulseFrame(state.pulses[2]),
        position: worldPosition(
          MAIN_ROOT_GREEN.x - 55 + 6 * leftDelta,
          MAIN_ROOT_GREEN.y + 40 - 2 * leftDelta + leftBob,
        ),
      },
    },
    green,
    red,
    telescopeFrame,
  }
}

function mainActorFrame(
  color: 'green' | 'red',
  state: AstronomerState,
  pathFrame: number,
  bob: number,
  preparing: boolean,
  moving: boolean,
): HubAstronomerMainActorFrame {
  const travels = color === 'red' ? state.direction > 0 : state.direction < 0
  const root = color === 'red' ? MAIN_ROOT_RED : MAIN_ROOT_GREEN
  const path = color === 'red' ? RED_PATH : GREEN_PATH
  const idleFrame = color === 'red' ? state.redFrame : state.greenFrame
  let bank: HubAstronomerMainBank = 'idle'
  let frame = idleFrame
  let position: Vector2 = root

  if (travels && preparing) {
    const progress = 1 - state.transition
    const target = color === 'red' ? path[0] : path[4]
    position = {
      x: root.x + (target.x - root.x) * progress * progress,
      y: root.y + (target.y - root.y) * progress * progress,
    }
    bank = 'transition'
    frame = clampInteger(progress * 3, 0, 2)
  } else if (travels && moving) {
    position = path[pathFrame]
    bank = 'gesture'
    frame = pathFrame
  }

  return {
    bank,
    frame,
    position: worldPosition(position.x, position.y + bob),
  }
}

function pulseFrame(pulse: GesturePulseState): number {
  if (!pulse.active) return 0
  return clampInteger(
    2.99 * Math.sin(pulse.phaseDegrees * Math.PI / 180),
    0,
    2,
  )
}

function worldPosition(x: number, y: number): Vector2 {
  return {
    x: HUB_ASTRONOMER_ROOT.x + x,
    y: HUB_ASTRONOMER_ROOT.y + y,
  }
}

function randomInt(state: number, range: number): RandomSample {
  const sample = nextRandom(state)
  return { state: sample.state, value: Math.floor(sample.value * range) }
}

function nextRandom(state: number): RandomSample {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  return { state: value || 0x6d2b79f5, value: value / 0x100000000 }
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.trunc(Math.min(maximum, Math.max(minimum, value)))
}
