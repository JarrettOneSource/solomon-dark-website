import type { Vector2 } from './core-kernels/vector.ts'
import type {
  ProtocolAmbientState,
  ProtocolFountainParticleState,
  ProtocolStudentProp,
  ProtocolStudentState,
} from './protocol/game-state.ts'

export interface HubColor {
  alpha: number
  blue: number
  green: number
  red: number
}

export interface HubPotionTraderFrame {
  actorFrame: number
  balloonFrame: number
  balloonOffsetY: number
}

export interface HubPotionTraderClock {
  advanceTo(tick: number): HubPotionTraderFrame
}

const FOUNTAIN_ALPHA_LIMIT = 0.25
const POTION_TRADER_ACTOR_CHECKPOINT_TICKS = 512
const POTION_TRADER_ACTOR_RNG_SEED = 0x50b110
const POTION_TRADER_ACTOR_TRIGGER_RANGE = 200
const POTION_TRADER_ACTOR_TRIGGER_VALUE = 2
const POTION_TRADER_ACTOR_PHASE_LIMIT = 180
const POTION_TRADER_ACTOR_SPEED_BASE = 1
const POTION_TRADER_ACTOR_SPEED_RANGE = 3
const POTION_TRADER_ACTOR_SPEED_SCALE = Math.fround(0.44999998807907104)
const POTION_TRADER_ACTOR_FRAME_SCALE = 4 - 0.01
const POTION_TRADER_BALLOON_CHECKPOINT_TICKS = 398
const POTION_TRADER_BALLOON_FRAME_COUNT = 5
const POTION_TRADER_BALLOON_FRAME_STEP = Math.fround(0.05)
const POTION_TRADER_BALLOON_ENDPOINT_HOLD_TICKS = 100
const SEAL_CORE_TRACK: readonly HubColor[] = [
  { red: 1, green: 1, blue: 1, alpha: 1 },
  { red: 0, green: 1, blue: 1, alpha: 1 },
  { red: 1, green: 1, blue: 1, alpha: 1 },
]
const SEAL_GLYPH_TRACK: readonly HubColor[] = [
  { red: 0.5, green: 0.5, blue: 1, alpha: 1 },
  { red: 0.75, green: 1, blue: 1, alpha: 1 },
  { red: 1, green: 1, blue: 1, alpha: 1 },
]

interface PotionTraderActorState {
  active: boolean
  phaseDegrees: number
  rngState: number
  speedDegrees: number
}

interface PotionTraderBalloonState {
  direction: -1 | 1
  frame: number
  holdTicks: number
}

const POTION_TRADER_ACTOR_CHECKPOINTS: PotionTraderActorState[] = [{
  active: false,
  phaseDegrees: 0,
  rngState: POTION_TRADER_ACTOR_RNG_SEED,
  speedDegrees: 0,
}]

const POTION_TRADER_BALLOON_CHECKPOINTS: PotionTraderBalloonState[] = [{
  direction: 1,
  frame: 0,
  holdTicks: 0,
}]

function nextPotionTraderActorRandom(
  state: number,
): { state: number; value: number } {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  return { state: value || 0x6d2b79f5, value: value / 0x100000000 }
}

function stepPotionTraderActor(state: PotionTraderActorState): PotionTraderActorState {
  if (!state.active) {
    const trigger = nextPotionTraderActorRandom(state.rngState)
    if (Math.floor(trigger.value * POTION_TRADER_ACTOR_TRIGGER_RANGE)
      !== POTION_TRADER_ACTOR_TRIGGER_VALUE) {
      return { ...state, rngState: trigger.state }
    }
    const speed = nextPotionTraderActorRandom(trigger.state)
    return {
      active: true,
      phaseDegrees: 0,
      rngState: speed.state,
      speedDegrees: Math.fround(
        (speed.value * POTION_TRADER_ACTOR_SPEED_RANGE + POTION_TRADER_ACTOR_SPEED_BASE)
          * POTION_TRADER_ACTOR_SPEED_SCALE,
      ),
    }
  }

  const phaseDegrees = Math.fround(state.phaseDegrees + state.speedDegrees)
  if (phaseDegrees >= POTION_TRADER_ACTOR_PHASE_LIMIT) {
    return { ...state, active: false, phaseDegrees: 0, speedDegrees: 0 }
  }
  return { ...state, phaseDegrees }
}

function potionTraderActorCheckpoint(index: number): PotionTraderActorState {
  while (POTION_TRADER_ACTOR_CHECKPOINTS.length <= index) {
    let state = POTION_TRADER_ACTOR_CHECKPOINTS.at(-1)!
    for (let tick = 0; tick < POTION_TRADER_ACTOR_CHECKPOINT_TICKS; tick += 1) {
      state = stepPotionTraderActor(state)
    }
    POTION_TRADER_ACTOR_CHECKPOINTS.push(state)
  }
  return POTION_TRADER_ACTOR_CHECKPOINTS[index]
}

function stepPotionTraderBalloon(
  state: PotionTraderBalloonState,
): PotionTraderBalloonState {
  if (state.holdTicks > 0) {
    return { ...state, holdTicks: state.holdTicks - 1 }
  }

  let direction = state.direction
  let frame = Math.fround(
    state.frame + Math.fround(direction * POTION_TRADER_BALLOON_FRAME_STEP),
  )
  let holdTicks = 0
  if (frame >= POTION_TRADER_BALLOON_FRAME_COUNT) {
    direction = -1
    holdTicks = POTION_TRADER_BALLOON_ENDPOINT_HOLD_TICKS
    frame = Math.fround(
      frame - POTION_TRADER_BALLOON_FRAME_STEP - POTION_TRADER_BALLOON_FRAME_STEP,
    )
  }
  if (frame < 0) {
    direction = 1
    holdTicks = POTION_TRADER_BALLOON_ENDPOINT_HOLD_TICKS
    frame = Math.fround(
      POTION_TRADER_BALLOON_FRAME_STEP + frame + POTION_TRADER_BALLOON_FRAME_STEP,
    )
  }
  return { direction, frame, holdTicks }
}

function potionTraderBalloonCheckpoint(index: number): PotionTraderBalloonState {
  while (POTION_TRADER_BALLOON_CHECKPOINTS.length <= index) {
    let state = POTION_TRADER_BALLOON_CHECKPOINTS.at(-1)!
    for (let tick = 0; tick < POTION_TRADER_BALLOON_CHECKPOINT_TICKS; tick += 1) {
      state = stepPotionTraderBalloon(state)
    }
    POTION_TRADER_BALLOON_CHECKPOINTS.push(state)
  }
  return POTION_TRADER_BALLOON_CHECKPOINTS[index]
}

function interpolateColor(track: readonly HubColor[], phase: number): HubColor {
  const wrapped = ((phase % track.length) + track.length) % track.length
  const first = Math.floor(wrapped)
  const second = (first + 1) % track.length
  const blend = wrapped - first
  return {
    red: track[first].red + (track[second].red - track[first].red) * blend,
    green: track[first].green + (track[second].green - track[first].green) * blend,
    blue: track[first].blue + (track[second].blue - track[first].blue) * blend,
    alpha: track[first].alpha + (track[second].alpha - track[first].alpha) * blend,
  }
}

function saturate(color: HubColor, factor: number): HubColor {
  const luminance = color.red * 0.30860000848770142
    + color.green * 0.6093999743461609
    + color.blue * 0.0820000022649765
  const retained = 1 - factor
  return {
    red: luminance * factor + color.red * retained,
    green: luminance * factor + color.green * retained,
    blue: luminance * factor + color.blue * retained,
    alpha: color.alpha,
  }
}

export function hubSealColors(state: ProtocolAmbientState): {
  core: HubColor
  glyphs: HubColor
} {
  return {
    core: interpolateColor(SEAL_CORE_TRACK, state.sealCorePhase),
    glyphs: saturate(interpolateColor(SEAL_GLYPH_TRACK, state.sealGlyphPhase), 0.5),
  }
}

export function hubColorCss(color: HubColor): string {
  return `rgba(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(color.blue * 255)}, ${color.alpha})`
}

export function hubFountainParticleAlpha(particle: ProtocolFountainParticleState): number {
  return Math.min(particle.remaining, FOUNTAIN_ALPHA_LIMIT)
}

export function hubMarkerAlpha(state: ProtocolAmbientState): number {
  return Math.sin(state.markerPhaseDegrees * Math.PI / 180) * 0.25 + 0.75
}

/** PotionGuy's inherited stochastic NPC gesture pulse. */
export function hubPotionTraderActorFrameAt(tick: number): number {
  const fixedTick = Math.max(0, Math.floor(tick))
  return potionTraderActorFrame(potionTraderActorStateAt(fixedTick))
}

/** PotionGuy's native five-frame balloon clock with endpoint holds. */
export function hubPotionTraderBalloonFrameAt(tick: number): number {
  const fixedTick = Math.max(0, Math.floor(tick))
  return potionTraderBalloonFrame(potionTraderBalloonStateAt(fixedTick))
}

/** Registered balloon bank's two-pixel, half-degree native presentation drift. */
export function hubPotionTraderBalloonOffsetYAt(tick: number): number {
  return Math.sin(Math.max(0, Math.floor(tick)) * 0.5 * Math.PI / 180) * 2
}

/** Advances both PotionGuy-owned native states once per elapsed fixed tick. */
export function createHubPotionTraderClock(): HubPotionTraderClock {
  let currentTick = 0
  let actorState = POTION_TRADER_ACTOR_CHECKPOINTS[0]
  let balloonState = POTION_TRADER_BALLOON_CHECKPOINTS[0]
  let frame = presentPotionTrader(actorState, balloonState, currentTick)

  return {
    advanceTo(tick) {
      const fixedTick = Math.max(0, Math.floor(tick))
      if (fixedTick === currentTick) return frame
      if (
        fixedTick < currentTick
        || fixedTick - currentTick >= POTION_TRADER_BALLOON_CHECKPOINT_TICKS
      ) {
        actorState = potionTraderActorStateAt(fixedTick)
        balloonState = potionTraderBalloonStateAt(fixedTick)
        currentTick = fixedTick
      } else {
        while (currentTick < fixedTick) {
          actorState = stepPotionTraderActor(actorState)
          balloonState = stepPotionTraderBalloon(balloonState)
          currentTick += 1
        }
      }
      frame = presentPotionTrader(actorState, balloonState, currentTick)
      return frame
    },
  }
}

function potionTraderActorStateAt(fixedTick: number): PotionTraderActorState {
  const checkpointIndex = Math.floor(fixedTick / POTION_TRADER_ACTOR_CHECKPOINT_TICKS)
  let state = potionTraderActorCheckpoint(checkpointIndex)
  const remainder = fixedTick % POTION_TRADER_ACTOR_CHECKPOINT_TICKS
  for (let update = 0; update < remainder; update += 1) {
    state = stepPotionTraderActor(state)
  }
  return state
}

function potionTraderActorFrame(state: PotionTraderActorState): number {
  if (!state.active) return 0
  return Math.trunc(
    POTION_TRADER_ACTOR_FRAME_SCALE
      * Math.sin(state.phaseDegrees * Math.PI / 180),
  )
}

function potionTraderBalloonStateAt(fixedTick: number): PotionTraderBalloonState {
  const checkpointIndex = Math.floor(fixedTick / POTION_TRADER_BALLOON_CHECKPOINT_TICKS)
  let state = potionTraderBalloonCheckpoint(checkpointIndex)
  const remainder = fixedTick % POTION_TRADER_BALLOON_CHECKPOINT_TICKS
  for (let update = 0; update < remainder; update += 1) {
    state = stepPotionTraderBalloon(state)
  }
  return state
}

function potionTraderBalloonFrame(state: PotionTraderBalloonState): number {
  return Math.max(
    0,
    Math.min(POTION_TRADER_BALLOON_FRAME_COUNT - 1, Math.trunc(state.frame)),
  )
}

function presentPotionTrader(
  actorState: PotionTraderActorState,
  balloonState: PotionTraderBalloonState,
  tick: number,
): HubPotionTraderFrame {
  return {
    actorFrame: potionTraderActorFrame(actorState),
    balloonFrame: potionTraderBalloonFrame(balloonState),
    balloonOffsetY: hubPotionTraderBalloonOffsetYAt(tick),
  }
}

export function hubStatueOffsets(state: ProtocolAmbientState): {
  aura: Vector2
  body: Vector2
} {
  const wave = -2 * Math.sin(state.statuePhaseDegrees * Math.PI / 180)
  return {
    aura: {
      x: Math.cos(Math.PI / 3) * wave,
      y: -Math.sin(Math.PI / 3) * wave * 0.8,
    },
    body: { x: 0, y: wave - 15 },
  }
}

export function hubStudentPropOffset(
  heading: number,
  prop: ProtocolStudentProp,
  propIndex: number,
): Vector2 {
  const angle = (heading + prop.angle) * Math.PI / 180
  return {
    x: prop.radius * Math.sin(angle),
    y: -prop.radius * Math.cos(angle) * 2 - propIndex * 3,
  }
}

export function hubStudentHeadOffset(student: Pick<
  ProtocolStudentState,
  'gaitDegrees' | 'heading' | 'scale'
>): Vector2 {
  const gaitRadians = student.gaitDegrees * Math.PI / 180
  const perpendicularRadians = (student.heading + 90) * Math.PI / 180
  const lateral = -Math.cos(gaitRadians) * 0.5 * student.scale
  const registration = student.scale < 1
    ? (1 - (student.scale - 0.75) * 4) * 5
    : 0
  return {
    x: Math.sin(perpendicularRadians) * lateral,
    y: -Math.cos(perpendicularRadians) * lateral
      - Math.abs(Math.sin(gaitRadians)) * 1.5
      + registration,
  }
}

export const HUB_FOUNTAIN_ORIGIN = { x: 957, y: 333 } as const
export const HUB_STATUE_ROOT = { x: 961, y: 834 } as const
