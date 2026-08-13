import type { Vector2 } from './core-kernels/vector.ts'

export type HubAstronomerMainBank = 'gesture' | 'idle' | 'transition'

export interface HubAstronomerMainActorFrame {
  bank: HubAstronomerMainBank
  frame: number
  position: Vector2
  shadowPosition: Vector2
}

export interface HubAstronomerAssistantFrame {
  frame: number
  position: Vector2
  shadowPosition: Vector2
}

export interface HubAstronomerFrame {
  active: boolean
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
  direction: -1 | 1
  gestureTicks: number
  greenBounceDegrees: number
  greenIdleFrame: number
  greenIngress: number
  greenPathFrame: number
  holdTicks: number
  pulses: readonly [
    GesturePulseState,
    GesturePulseState,
    GesturePulseState,
    GesturePulseState,
  ]
  redBounceDegrees: number
  redIdleFrame: number
  redIngress: number
  redPathFrame: number
  rngState: number
  telescopePosition: number
  transition: number
  transitionFrameDirection: -1 | 0 | 1
  transitionFramePhase: number
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
  direction: 1,
  gestureTicks: 0,
  greenBounceDegrees: 0,
  greenIdleFrame: 0,
  greenIngress: 0,
  greenPathFrame: 0,
  holdTicks: 0,
  pulses: [INITIAL_PULSE, INITIAL_PULSE, INITIAL_PULSE, INITIAL_PULSE],
  redBounceDegrees: 0,
  redIdleFrame: 0,
  redIngress: 1,
  redPathFrame: 4,
  rngState: RNG_SEED,
  telescopePosition: 0,
  transition: 0,
  transitionFrameDirection: 0,
  transitionFramePhase: 0,
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

export function hubAstronomerLocalTick(tick: number, createdAtTick: number): number {
  return Math.max(0, Math.floor(tick - createdAtTick))
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
  let redIdleFrame = state.redIdleFrame
  let greenIdleFrame = state.greenIdleFrame
  let redPathFrame = state.redPathFrame
  let greenPathFrame = state.greenPathFrame
  let telescopePosition = state.telescopePosition
  let redBounceDegrees = Math.max(0, state.redBounceDegrees - 10)
  let greenBounceDegrees = Math.max(0, state.greenBounceDegrees - 10)

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
      redIdleFrame = 0
      greenIdleFrame = 0
      if (transition > 0) {
        const previous = transition
        transition = Math.fround(Math.max(0, transition - TRANSITION_STEP))
        if (previous > 0 && transition === 0) {
          if (direction > 0) greenBounceDegrees = 180
          else redBounceDegrees = 180
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
        if (direction > 0) {
          redPathFrame = clampInteger(telescopePosition, 0, 4)
        } else {
          greenPathFrame = clampInteger(telescopePosition, 0, 4)
        }
      }
    } else {
      gestureTicks -= 1
      if (gestureTicks < 1) {
        const pose = randomInt(rngState, 4)
        rngState = pose.state
        if (direction > 0) redIdleFrame = pose.value
        else greenIdleFrame = pose.value
        const delay = randomInt(rngState, 15)
        rngState = delay.state
        gestureTicks = delay.value + 15
      }
    }
  }

  const transitionFrame = stepTransitionFrame(
    state.transitionFramePhase,
    state.transitionFrameDirection,
    rngState,
  )
  rngState = transitionFrame.rngState
  const redIngress = telescopePosition >= 4.5
    ? Math.fround(Math.max(0, state.redIngress - ASSISTANT_OUTWARD_STEP))
    : Math.fround(Math.min(
        ASSISTANT_BLEND_LIMIT,
        state.redIngress + ASSISTANT_INWARD_STEP,
      ))
  const greenIngress = telescopePosition <= 0.5
    ? Math.fround(Math.max(0, state.greenIngress - ASSISTANT_OUTWARD_STEP))
    : Math.fround(Math.min(
        ASSISTANT_BLEND_LIMIT,
        state.greenIngress + ASSISTANT_INWARD_STEP,
      ))

  return {
    active,
    direction,
    gestureTicks,
    greenBounceDegrees,
    greenIdleFrame,
    greenIngress,
    greenPathFrame,
    holdTicks,
    pulses: [pulses[0], pulses[1], pulses[2], pulses[3]],
    redBounceDegrees,
    redIdleFrame,
    redIngress,
    redPathFrame,
    rngState,
    telescopePosition,
    transition,
    transitionFrameDirection: transitionFrame.direction,
    transitionFramePhase: transitionFrame.phase,
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

function stepTransitionFrame(
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
  const redIngress = ASSISTANT_BLEND_LIMIT - state.redIngress
  const greenIngress = ASSISTANT_BLEND_LIMIT - state.greenIngress
  const grayBob = state.redBounceDegrees > 0
    ? -sinDegrees(Math.max(0, state.redBounceDegrees - 15)) * 9
    : -Math.abs(sinDegrees(state.redIngress * 90)) * 2
  const blueBob = state.redBounceDegrees > 0
    ? -sinDegrees(Math.min(180, state.redBounceDegrees + 15)) * 12
    : -Math.abs(sinDegrees(state.redIngress * 120)) * 2
  const greenBob = state.greenBounceDegrees > 0
    ? -sinDegrees(Math.min(180, state.greenBounceDegrees + 15)) * 12
    : -Math.abs(sinDegrees(state.greenIngress * 120)) * 4
  const grayPosition = point(
    MAIN_ROOT_RED.x + 65,
    MAIN_ROOT_RED.y + 35 - 4 * redIngress,
  )
  const bluePosition = point(
    MAIN_ROOT_RED.x + 20 - 4 * redIngress,
    MAIN_ROOT_RED.y + 75 - 10 * redIngress,
  )
  const purplePosition = point(
    MAIN_ROOT_GREEN.x - 55 + 6 * greenIngress,
    MAIN_ROOT_GREEN.y + 40 - 2 * greenIngress,
  )
  const brownPosition = point(
    MAIN_ROOT_GREEN.x - 10 + 4 * greenIngress,
    MAIN_ROOT_GREEN.y + 80 - 10 * greenIngress,
  )

  return {
    active: state.active,
    assistants: {
      blue: {
        frame: pulseFrame(state.pulses[1]),
        position: offsetY(bluePosition, blueBob),
        shadowPosition: bluePosition,
      },
      brown: {
        frame: pulseFrame(state.pulses[3]),
        position: offsetY(brownPosition, greenBob),
        shadowPosition: brownPosition,
      },
      gray: {
        frame: pulseFrame(state.pulses[0]),
        position: offsetY(grayPosition, grayBob),
        shadowPosition: grayPosition,
      },
      purple: {
        frame: pulseFrame(state.pulses[2]),
        position: offsetY(purplePosition, greenBob),
        shadowPosition: purplePosition,
      },
    },
    green: presentGreenAstronomer(state),
    red: presentRedAstronomer(state),
    telescopeFrame,
  }
}

function presentGreenAstronomer(state: AstronomerState): HubAstronomerMainActorFrame {
  const transitionFrame = clampInteger(state.transitionFramePhase, 0, 2)
  if (!state.active) {
    if (state.telescopePosition <= 0) {
      return mainFrame('transition', transitionFrame, MAIN_ROOT_GREEN)
    }
    return idleMainFrame(
      state.greenIdleFrame,
      MAIN_ROOT_GREEN,
      state.greenBounceDegrees,
    )
  }

  if (state.transition <= 0 || state.direction >= 0) {
    if (
      (state.telescopePosition <= 0.75 && state.direction < 0)
      || (state.transition > 0 && state.direction > 0)
    ) {
      const position = offsetY(
        MAIN_ROOT_GREEN,
        state.telescopePosition / 0.75 * 15,
      )
      return state.telescopePosition > 0.75
        ? mainFrame('gesture', state.greenPathFrame, position)
        : mainFrame('transition', transitionFrame, position)
    }
    if (state.direction >= 0) {
      return idleMainFrame(
        state.greenIdleFrame,
        MAIN_ROOT_GREEN,
        state.greenBounceDegrees,
      )
    }
    return mainFrame('gesture', state.greenPathFrame, GREEN_PATH[state.greenPathFrame])
  }

  return movingIdleMainFrame(
    state.greenIdleFrame,
    MAIN_ROOT_GREEN,
    GREEN_PATH[4],
    state.transition,
    state.greenBounceDegrees,
  )
}

function presentRedAstronomer(state: AstronomerState): HubAstronomerMainActorFrame {
  const transitionFrame = clampInteger(state.transitionFramePhase, 0, 2)
  if (!state.active) {
    if (state.telescopePosition < TELESCOPE_POSITION_LIMIT) {
      return mainFrame('transition', transitionFrame, MAIN_ROOT_RED)
    }
    return idleMainFrame(
      state.redIdleFrame,
      MAIN_ROOT_RED,
      state.redBounceDegrees,
    )
  }

  if (state.transition <= 0 || state.direction <= 0) {
    if (
      (state.telescopePosition < 4.25 || state.direction <= 0)
      && (state.transition <= 0 || state.direction >= 0)
    ) {
      return state.direction <= 0
        ? idleMainFrame(
            state.redIdleFrame,
            MAIN_ROOT_RED,
            state.redBounceDegrees,
          )
        : mainFrame('gesture', state.redPathFrame, RED_PATH[state.redPathFrame])
    }
    const position = offsetY(
      MAIN_ROOT_RED,
      (1 - (state.telescopePosition - 4.25) / 0.75) * 10,
    )
    return state.telescopePosition < 4.65
      ? mainFrame('gesture', state.redPathFrame, position)
      : mainFrame('transition', transitionFrame, position)
  }

  return movingIdleMainFrame(
    state.redIdleFrame,
    MAIN_ROOT_RED,
    RED_PATH[0],
    state.transition,
    state.redBounceDegrees,
  )
}

function idleMainFrame(
  frame: number,
  root: Vector2,
  bounceDegrees: number,
): HubAstronomerMainActorFrame {
  return {
    bank: 'idle',
    frame,
    position: offsetY(root, -sinDegrees(bounceDegrees) * 12),
    shadowPosition: point(root.x, root.y),
  }
}

function movingIdleMainFrame(
  frame: number,
  root: Vector2,
  target: Vector2,
  transition: number,
  bounceDegrees: number,
): HubAstronomerMainActorFrame {
  const progress = 1 - transition
  const shadowPosition = point(
    root.x + (target.x - root.x) * progress * progress,
    root.y + (target.y - root.y) * progress * progress,
  )
  return {
    bank: 'idle',
    frame,
    position: offsetY(
      shadowPosition,
      -sinDegrees(transition * 540) * 4 - sinDegrees(bounceDegrees) * 12,
    ),
    shadowPosition,
  }
}

function mainFrame(
  bank: HubAstronomerMainBank,
  frame: number,
  position: Vector2,
): HubAstronomerMainActorFrame {
  return {
    bank,
    frame,
    position: point(position.x, position.y),
    shadowPosition: point(position.x, position.y),
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

function point(x: number, y: number): Vector2 {
  return { x, y }
}

function offsetY(position: Vector2, amount: number): Vector2 {
  return point(position.x, position.y + amount)
}

function sinDegrees(value: number): number {
  return Math.sin(value * Math.PI / 180)
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
