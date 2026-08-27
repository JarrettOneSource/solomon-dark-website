import { actorHeadingFromVector, actorHeadingIndex } from './actor-heading.ts'
import type { Vector2 } from './vector.ts'

export const WIZARD_ELEMENTS = ['air', 'earth', 'ether', 'fire', 'water'] as const
export const WIZARD_DISCIPLINES = ['arcane', 'body', 'mind'] as const

export type WizardElement = typeof WIZARD_ELEMENTS[number]
export type WizardDiscipline = typeof WIZARD_DISCIPLINES[number]

export interface PlayerCharacterConfig {
  discipline: WizardDiscipline
  displayName: string
  element: WizardElement
}

export interface PlayerCharacterInput {
  aim: Vector2 | null
  cast: {
    primary: boolean
    quickbar: number | null
  }
  movement: Vector2
  viewportHeight: number
  viewportWidth: number
}

export interface PlayerPrimaryCastState {
  actionTick: number
  aimDirection: Vector2
  castSequence: number
  channelActive: boolean
  emissionSequence: number
  etherBlastCharge: number
  etherBlastChargeCueSequence: number
  fizzleSequence: number
  held: boolean
  lastWeldPlaybackRate: number | null
  lastWeldSoundVariant: number | null
  oneShotAttackPoseHeld: boolean
  selectedPrimaryAgeTicks: number
  selectedPrimaryId: number
  targetId: string | null
  underpowered: boolean
  weaponPulse: number
}

export interface PlayerCharacterState {
  config: PlayerCharacterConfig
  footstepTick: number
  gaitDegrees: number
  headingIndex: number
  position: Vector2
  primaryCast: PlayerPrimaryCastState
  velocity: Vector2
  walkCyclePrimary: number
}

export interface PlayerCharacterMovementPlan {
  delta: Vector2
  /** Movement, rather than an action pose, owns heading for this plan. */
  face?: true
  movementActive: boolean
  requestedVelocity: Vector2
  retainedVelocity: Vector2
}

export const PLAYER_CHARACTER_RADIUS = 25
export const PLAYER_CHARACTER_PHYSICS = {
  pushResistance: 10,
  pushStrength: 12,
  radius: PLAYER_CHARACTER_RADIUS,
} as const
export const PLAYER_CHARACTER_STEADY_SPEED = 100
export const PLAYER_CHARACTER_GAIT_DEGREES_PER_UNIT = 5
export const PLAYER_CHARACTER_WALK_CYCLE_DISTANCE_PER_FRAME = 10
export const PLAYER_CHARACTER_WALK_CYCLE_WRAP = 5
export const PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS = 0.01
export const PLAYER_CHARACTER_INPUT_ACCELERATION = 10
export const PLAYER_CHARACTER_MOVEMENT_LANE_CAP = 118.75
export const PLAYER_CHARACTER_MOVEMENT_RETENTION = 0.9
export const PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED = Math.fround(0.01)
export const PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL = 25
export const NATIVE_GAMEPLAY_VIEWPORT_WIDTH = 1_600
export const NATIVE_GAMEPLAY_VIEWPORT_HEIGHT = 900

export function createIdlePlayerCharacterInput(
  viewportWidth = NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
  viewportHeight = NATIVE_GAMEPLAY_VIEWPORT_HEIGHT,
): PlayerCharacterInput {
  return {
    aim: null,
    cast: { primary: false, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportHeight,
    viewportWidth,
  }
}

export function createPlayerCharacter(
  config: PlayerCharacterConfig,
  position: Vector2,
): PlayerCharacterState {
  return {
    config: { ...config },
    footstepTick: 0,
    gaitDegrees: 0,
    headingIndex: actorHeadingIndex(180),
    position: { ...position },
    primaryCast: createIdlePlayerPrimaryCast(),
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
}

export function createIdlePlayerPrimaryCast(): PlayerPrimaryCastState {
  return {
    actionTick: -1,
    aimDirection: { x: 0, y: 1 },
    castSequence: 0,
    channelActive: false,
    emissionSequence: 0,
    etherBlastCharge: 0,
    etherBlastChargeCueSequence: 0,
    fizzleSequence: 0,
    held: false,
    lastWeldPlaybackRate: null,
    lastWeldSoundVariant: null,
    oneShotAttackPoseHeld: false,
    selectedPrimaryAgeTicks: 0,
    selectedPrimaryId: -1,
    targetId: null,
    underpowered: false,
    weaponPulse: 0,
  }
}

export function resetPlayerPrimaryCast(
  player: PlayerCharacterState,
): PlayerCharacterState {
  const idle = createIdlePlayerPrimaryCast()
  return {
    ...player,
    primaryCast: {
      ...idle,
      etherBlastCharge: player.primaryCast.etherBlastCharge,
      etherBlastChargeCueSequence: player.primaryCast.etherBlastChargeCueSequence,
      weaponPulse: player.primaryCast.weaponPulse,
    },
  }
}

export function playerPrimaryCastOwnsFacing(
  cast: PlayerPrimaryCastState,
): boolean {
  return cast.actionTick >= 0 || cast.channelActive
}

export function planPlayerCharacterTick(
  previous: Pick<PlayerCharacterState, 'velocity'>,
  input: Pick<PlayerCharacterInput, 'movement'>,
  movementScale: number,
): PlayerCharacterMovementPlan {
  if (!Number.isFinite(movementScale) || movementScale < 0) {
    throw new RangeError('player movement scale must be finite and non-negative')
  }
  const inputLength = Math.hypot(input.movement.x, input.movement.y)
  const direction = inputLength > 0
    ? {
        x: input.movement.x / inputLength,
        y: input.movement.y / inputLength,
      }
    : { x: 0, y: 0 }
  const accumulated = {
    x: Math.fround(
      previous.velocity.x + direction.x * PLAYER_CHARACTER_INPUT_ACCELERATION * movementScale,
    ),
    y: Math.fround(
      previous.velocity.y + direction.y * PLAYER_CHARACTER_INPUT_ACCELERATION * movementScale,
    ),
  }
  const accumulatedLength = Math.hypot(accumulated.x, accumulated.y)
  const movementLaneCap = PLAYER_CHARACTER_MOVEMENT_LANE_CAP * movementScale
  const capScale = accumulatedLength > movementLaneCap
    ? movementLaneCap / accumulatedLength
    : 1
  const requestedVelocity = {
    x: Math.fround(accumulated.x * capScale),
    y: Math.fround(accumulated.y * capScale),
  }
  const requestedDelta = {
    x: Math.fround(requestedVelocity.x * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS),
    y: Math.fround(requestedVelocity.y * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS),
  }
  const movementActive = (
    requestedDelta.x * requestedDelta.x
    + requestedDelta.y * requestedDelta.y
  ) > PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED
  return {
    delta: movementActive ? requestedDelta : { x: 0, y: 0 },
    movementActive,
    requestedVelocity,
    retainedVelocity: {
      x: Math.fround(requestedVelocity.x * PLAYER_CHARACTER_MOVEMENT_RETENTION),
      y: Math.fround(requestedVelocity.y * PLAYER_CHARACTER_MOVEMENT_RETENTION),
    },
  }
}

export function commitPlayerCharacterTick(
  previous: PlayerCharacterState,
  plan: PlayerCharacterMovementPlan,
  resolvedPosition: Vector2,
): PlayerCharacterState {
  const requestedSpeed = Math.hypot(
    plan.requestedVelocity.x,
    plan.requestedVelocity.y,
  )
  const requestedDistance = Math.hypot(plan.delta.x, plan.delta.y)
  return {
    ...previous,
    gaitDegrees: (
      previous.gaitDegrees
      + requestedDistance * PLAYER_CHARACTER_GAIT_DEGREES_PER_UNIT
    ) % 360,
    headingIndex: plan.movementActive
      && requestedSpeed > 0.01
      && (plan.face || !playerPrimaryCastOwnsFacing(previous.primaryCast))
      ? actorHeadingIndex(actorHeadingFromVector(
          plan.requestedVelocity.x,
          plan.requestedVelocity.y,
        ))
      : previous.headingIndex,
    position: { ...resolvedPosition },
    velocity: { ...plan.retainedVelocity },
    walkCyclePrimary: advancePlayerCharacterWalkCycle(
      previous.walkCyclePrimary,
      requestedDistance,
    ),
  }
}

/** Advance the stock actor +0x220 fixed-robe selector from requested travel. */
export function advancePlayerCharacterWalkCycle(
  walkCyclePrimary: number,
  requestedDistance: number,
): number {
  const advanced = Math.fround(
    walkCyclePrimary
      + requestedDistance / PLAYER_CHARACTER_WALK_CYCLE_DISTANCE_PER_FRAME,
  )
  return advanced > PLAYER_CHARACTER_WALK_CYCLE_WRAP
    ? Math.fround(advanced - PLAYER_CHARACTER_WALK_CYCLE_WRAP)
    : advanced
}

export function isWizardElement(value: string): value is WizardElement {
  return (WIZARD_ELEMENTS as readonly string[]).includes(value)
}

export function isWizardDiscipline(value: string): value is WizardDiscipline {
  return (WIZARD_DISCIPLINES as readonly string[]).includes(value)
}
