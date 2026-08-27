import type { Vector2 } from './core-kernels/vector.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './core-kernels/native-rng.ts'
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

export interface HubCommonTraderClock {
  advanceTo(tick: number): number
}

export interface HubPolisherClock {
  advanceTo(tick: number): number
}

export interface HubRunEntryPresentation {
  compassAlpha: number
  playAlpha: number
}

export interface HubHagathaFrame {
  bodyFrame: number
  particles: readonly HubHagathaParticle[]
}

export interface HubHagathaParticle {
  alpha: number
  frame: number
  id: number
  offset: Vector2
  scale: number
}

export interface HubHagathaClock {
  advanceTo(tick: number): HubHagathaFrame
}

const FOUNTAIN_ALPHA_LIMIT = 0.25
const HUB_RUN_ENTRY_DEGREE_DIVISOR = 180
const HUB_RUN_ENTRY_PI = Math.fround(Math.PI)
const POTION_TRADER_ACTOR_CHECKPOINT_TICKS = 512
const POTION_TRADER_ACTOR_RNG_SEED = 0x50b110
const POTION_TRADER_ACTOR_TRIGGER_RANGE = 200
const POTION_TRADER_ACTOR_TRIGGER_VALUE = 2
const POTION_TRADER_ACTOR_PHASE_LIMIT = 180
const POTION_TRADER_ACTOR_SPEED_BASE = 1
const POTION_TRADER_ACTOR_SPEED_RANGE = 3
const POTION_TRADER_ACTOR_SPEED_SCALE = Math.fround(0.44999998807907104)
const POTION_TRADER_ACTOR_FRAME_SCALE = 4 - 0.01
const HAGATHA_BODY_FRAME_COUNT = 8
const HAGATHA_CROSSFADE_FRAME_COUNT = 4
const HAGATHA_PHASE_SPEED_BASE = Math.fround(0.05)
const HAGATHA_PHASE_SPEED_RANGE = 0.25
const HAGATHA_DIRECTION_REVERSE_RANGE = 1500
const HAGATHA_DIRECTION_REVERSE_VALUE = 3
const HAGATHA_NATIVE_TICK_RATE = 100
const HAGATHA_PARTICLE_LIFETIME_BASE = 1.25
const HAGATHA_PARTICLE_LIFETIME_RANGE = 0.25
const HAGATHA_PARTICLE_SCALE_BASE = 0.15
const HAGATHA_PARTICLE_SCALE_RANGE = 0.1
const HAGATHA_PARTICLE_JITTER_RADIUS = 2
const HAGATHA_PARTICLE_Y_BIAS = 14
const POLISHER_FRAME_COUNT = 4
const POLISHER_PHASE_SPEED = Math.fround(0.05)
const POLISHER_PHASE_FLOAT_RANGE = 0.25
const POLISHER_DIRECTION_REVERSE_RANGE = 1500
const POLISHER_DIRECTION_REVERSE_VALUE = 3
const HAGATHA_BODY_HALF_EXTENT = 75
const HAGATHA_PARTICLE_ANCHORS: readonly Vector2[] = [
  { x: 79.5, y: 80.5 },
  { x: 81.5, y: 81.5 },
  { x: 83.5, y: 82.5 },
  { x: 86.5, y: 83.5 },
  { x: 90.5, y: 83.5 },
  { x: 103.5, y: 77.5 },
  { x: 104.5, y: 75.5 },
  { x: 84.5, y: 84.5 },
]
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
  rng: NativeRngState
  speedDegrees: number
}

interface PotionTraderBalloonState {
  direction: -1 | 1
  frame: number
  holdTicks: number
}

interface HagathaState {
  nextParticleId: number
  particles: readonly HagathaParticleState[]
  phase: number
  rng: NativeRngState
  velocity: number
}

interface PolisherState {
  phase: number
  rng: NativeRngState
  velocity: number
}

interface HagathaParticleState {
  frame: number
  id: number
  offset: Vector2
  opacity: number
  progress: number
  progressStep: number
  scale: number
}

const POTION_TRADER_ACTOR_CHECKPOINTS: PotionTraderActorState[] = [{
  active: false,
  phaseDegrees: 0,
  rng: createNativeRng(POTION_TRADER_ACTOR_RNG_SEED),
  speedDegrees: 0,
}]

const POTION_TRADER_BALLOON_CHECKPOINTS: PotionTraderBalloonState[] = [{
  direction: 1,
  frame: 0,
  holdTicks: 0,
}]
const COMMON_TRADER_CHECKPOINTS = new Map<number, PotionTraderActorState[]>()
const HAGATHA_CHECKPOINTS = new Map<number, HagathaState[]>()
const POLISHER_CHECKPOINTS = new Map<number, PolisherState[]>()

function stepPotionTraderActor(state: PotionTraderActorState): PotionTraderActorState {
  if (!state.active) {
    const trigger = drawNativeInteger(state.rng, POTION_TRADER_ACTOR_TRIGGER_RANGE)
    if (trigger.value !== POTION_TRADER_ACTOR_TRIGGER_VALUE) {
      return { ...state, rng: trigger.state }
    }
    const speed = drawNativeFloat(trigger.state, POTION_TRADER_ACTOR_SPEED_RANGE)
    return {
      active: true,
      phaseDegrees: 0,
      rng: speed.state,
      speedDegrees: Math.fround(
        (speed.value + POTION_TRADER_ACTOR_SPEED_BASE)
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

function initialCommonTraderState(seed: number): PotionTraderActorState {
  return {
    active: false,
    phaseDegrees: 0,
    rng: createNativeRng(seed >>> 0),
    speedDegrees: 0,
  }
}

function commonTraderCheckpoints(seed: number): PotionTraderActorState[] {
  const normalized = seed >>> 0
  let checkpoints = COMMON_TRADER_CHECKPOINTS.get(normalized)
  if (!checkpoints) {
    checkpoints = [initialCommonTraderState(normalized)]
    COMMON_TRADER_CHECKPOINTS.set(normalized, checkpoints)
  }
  return checkpoints
}

function commonTraderStateAt(tick: number, seed: number): PotionTraderActorState {
  const checkpoints = commonTraderCheckpoints(seed)
  const checkpointIndex = Math.floor(tick / POTION_TRADER_ACTOR_CHECKPOINT_TICKS)
  while (checkpoints.length <= checkpointIndex) {
    let state = checkpoints.at(-1)!
    for (let update = 0; update < POTION_TRADER_ACTOR_CHECKPOINT_TICKS; update += 1) {
      state = stepPotionTraderActor(state)
    }
    checkpoints.push(state)
  }
  let state = checkpoints[checkpointIndex]!
  const remainder = tick % POTION_TRADER_ACTOR_CHECKPOINT_TICKS
  for (let update = 0; update < remainder; update += 1) {
    state = stepPotionTraderActor(state)
  }
  return state
}

function initialHagathaState(seed: number): HagathaState {
  return {
    nextParticleId: 0,
    particles: [],
    phase: 0,
    rng: createNativeRng(seed >>> 0),
    velocity: HAGATHA_PHASE_SPEED_BASE,
  }
}

function stepHagatha(state: HagathaState): HagathaState {
  const particles = state.particles
    .map((particle) => ({
      ...particle,
      progress: Math.fround(particle.progress + particle.progressStep),
    }))
    .filter(({ progress }) => progress <= 1)

  const phaseDraw = drawNativeFloat(state.rng, HAGATHA_PHASE_SPEED_RANGE)
  let phase = Math.fround(
    state.phase + Math.fround((phaseDraw.value + 1) * state.velocity),
  )
  if (phase >= HAGATHA_BODY_FRAME_COUNT) phase = Math.fround(phase - HAGATHA_BODY_FRAME_COUNT)
  if (phase < 0) phase = Math.fround(phase + HAGATHA_BODY_FRAME_COUNT)

  const frameDraw = drawNativeInteger(phaseDraw.state, HAGATHA_CROSSFADE_FRAME_COUNT)
  const opacityDraw = drawNativeFloat(frameDraw.state, 1)
  const lifetimeDraw = drawNativeFloat(opacityDraw.state, HAGATHA_PARTICLE_LIFETIME_RANGE)
  const scaleDraw = drawNativeFloat(lifetimeDraw.state, HAGATHA_PARTICLE_SCALE_RANGE, true)
  const anchorDraw = drawNativeInteger(scaleDraw.state, HAGATHA_PARTICLE_ANCHORS.length)
  const radiusDraw = drawNativeFloat(anchorDraw.state, HAGATHA_PARTICLE_JITTER_RADIUS)
  const angleDraw = drawNativeFloat(radiusDraw.state, 360)
  const radians = Math.fround(angleDraw.value * Math.fround(Math.PI) / 180)
  const anchor = HAGATHA_PARTICLE_ANCHORS[anchorDraw.value]!
  const particle: HagathaParticleState = {
    frame: frameDraw.value,
    id: state.nextParticleId,
    offset: {
      x: Math.fround(
        anchor.x - HAGATHA_BODY_HALF_EXTENT
          + Math.fround(radiusDraw.value * Math.cos(radians)),
      ),
      y: Math.fround(
        anchor.y + HAGATHA_PARTICLE_Y_BIAS - HAGATHA_BODY_HALF_EXTENT
          - Math.fround(radiusDraw.value * Math.sin(radians)),
      ),
    },
    opacity: opacityDraw.value,
    progress: 0,
    progressStep: Math.fround(1 / (
      Math.fround(lifetimeDraw.value + HAGATHA_PARTICLE_LIFETIME_BASE)
        * HAGATHA_NATIVE_TICK_RATE
    )),
    scale: Math.fround(scaleDraw.value + HAGATHA_PARTICLE_SCALE_BASE),
  }
  const reverseDraw = drawNativeInteger(angleDraw.state, HAGATHA_DIRECTION_REVERSE_RANGE)
  const velocity = reverseDraw.value === HAGATHA_DIRECTION_REVERSE_VALUE
    ? Math.fround(-state.velocity)
    : state.velocity
  return {
    nextParticleId: state.nextParticleId + 1,
    particles: [...particles, particle],
    phase,
    rng: reverseDraw.state,
    velocity,
  }
}

function hagathaStateAt(tick: number, seed: number): HagathaState {
  const normalized = seed >>> 0
  let checkpoints = HAGATHA_CHECKPOINTS.get(normalized)
  if (!checkpoints) {
    checkpoints = [initialHagathaState(normalized)]
    HAGATHA_CHECKPOINTS.set(normalized, checkpoints)
  }
  const checkpointIndex = Math.floor(tick / POTION_TRADER_ACTOR_CHECKPOINT_TICKS)
  while (checkpoints.length <= checkpointIndex) {
    let state = checkpoints.at(-1)!
    for (let update = 0; update < POTION_TRADER_ACTOR_CHECKPOINT_TICKS; update += 1) {
      state = stepHagatha(state)
    }
    checkpoints.push(state)
  }
  let state = checkpoints[checkpointIndex]!
  const remainder = tick % POTION_TRADER_ACTOR_CHECKPOINT_TICKS
  for (let update = 0; update < remainder; update += 1) state = stepHagatha(state)
  return state
}

function initialPolisherState(seed: number): PolisherState {
  return {
    phase: 0,
    rng: createNativeRng(seed >>> 0),
    velocity: POLISHER_PHASE_SPEED,
  }
}

function stepPolisher(state: PolisherState): PolisherState {
  const phaseDraw = drawNativeFloat(state.rng, POLISHER_PHASE_FLOAT_RANGE)
  let phase = Math.fround(
    state.phase + Math.fround((phaseDraw.value + 1) * state.velocity),
  )
  if (phase >= POLISHER_FRAME_COUNT) phase = Math.fround(phase - POLISHER_FRAME_COUNT)
  if (phase < 0) phase = Math.fround(phase + POLISHER_FRAME_COUNT)
  const reverseDraw = drawNativeInteger(
    phaseDraw.state,
    POLISHER_DIRECTION_REVERSE_RANGE,
  )
  return {
    phase,
    rng: reverseDraw.state,
    velocity: reverseDraw.value === POLISHER_DIRECTION_REVERSE_VALUE
      ? Math.fround(-state.velocity)
      : state.velocity,
  }
}

function polisherStateAt(tick: number, seed: number): PolisherState {
  const normalized = seed >>> 0
  let checkpoints = POLISHER_CHECKPOINTS.get(normalized)
  if (!checkpoints) {
    checkpoints = [initialPolisherState(normalized)]
    POLISHER_CHECKPOINTS.set(normalized, checkpoints)
  }
  const checkpointIndex = Math.floor(tick / POTION_TRADER_ACTOR_CHECKPOINT_TICKS)
  while (checkpoints.length <= checkpointIndex) {
    let state = checkpoints.at(-1)!
    for (let update = 0; update < POTION_TRADER_ACTOR_CHECKPOINT_TICKS; update += 1) {
      state = stepPolisher(state)
    }
    checkpoints.push(state)
  }
  let state = checkpoints[checkpointIndex]!
  const remainder = tick % POTION_TRADER_ACTOR_CHECKPOINT_TICKS
  for (let update = 0; update < remainder; update += 1) state = stepPolisher(state)
  return state
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

export function hubRunEntryPresentation(
  tick: number,
  transitioning: boolean,
): HubRunEntryPresentation {
  if (transitioning) return { compassAlpha: 1, playAlpha: 0 }
  const radians = Math.fround(
    Math.fround(tick) * HUB_RUN_ENTRY_PI / HUB_RUN_ENTRY_DEGREE_DIVISOR,
  )
  const sine = Math.fround(Math.sin(radians))
  const compassAlpha = Math.fround(0.5 + sine * 0.5)
  return {
    compassAlpha,
    playAlpha: Math.fround(1 - compassAlpha),
  }
}

export function hubColorCss(color: HubColor): string {
  return `rgba(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(color.blue * 255)}, ${color.alpha})`
}

export function hubFountainParticleAlpha(particle: ProtocolFountainParticleState): number {
  return Math.min(particle.remaining, FOUNTAIN_ALPHA_LIMIT)
}

/** PotionGuy's inherited stochastic NPC gesture pulse. */
export function hubPotionTraderActorFrameAt(tick: number): number {
  const fixedTick = Math.max(0, Math.floor(tick))
  return potionTraderActorFrame(potionTraderActorStateAt(fixedTick))
}

/** Luthacus and Shlorio's shared 1-in-200, four-frame native idle gesture. */
export function hubCommonTraderFrameAt(tick: number, seed: number): number {
  const fixedTick = Math.max(0, Math.floor(tick))
  return potionTraderActorFrame(commonTraderStateAt(fixedTick, seed))
}

export function createHubCommonTraderClock(seed: number): HubCommonTraderClock {
  let currentTick = 0
  let state = initialCommonTraderState(seed)
  let frame = 0
  return {
    advanceTo(tick) {
      const fixedTick = Math.max(0, Math.floor(tick))
      if (fixedTick < currentTick || fixedTick - currentTick >= POTION_TRADER_ACTOR_CHECKPOINT_TICKS) {
        state = commonTraderStateAt(fixedTick, seed)
        currentTick = fixedTick
      } else {
        while (currentTick < fixedTick) {
          state = stepPotionTraderActor(state)
          currentTick += 1
        }
      }
      frame = potionTraderActorFrame(state)
      return frame
    },
  }
}

export function createHubPolisherClock(seed: number): HubPolisherClock {
  let currentTick = 0
  let state = initialPolisherState(seed)
  let frame = 0
  return {
    advanceTo(tick) {
      const fixedTick = Math.max(0, Math.floor(tick))
      if (
        fixedTick < currentTick
        || fixedTick - currentTick >= POTION_TRADER_ACTOR_CHECKPOINT_TICKS
      ) {
        state = polisherStateAt(fixedTick, seed)
        currentTick = fixedTick
      } else {
        while (currentTick < fixedTick) {
          state = stepPolisher(state)
          currentTick += 1
        }
      }
      frame = Math.floor(state.phase) % POLISHER_FRAME_COUNT
      return frame
    },
  }
}

/** Hagatha's eight-frame loop and per-tick native cross-fade particle field. */
export function hubHagathaFrameAt(tick: number, seed: number): HubHagathaFrame {
  const fixedTick = Math.max(0, Math.floor(tick))
  return presentHagatha(hagathaStateAt(fixedTick, seed))
}

export function createHubHagathaClock(seed: number): HubHagathaClock {
  let currentTick = 0
  let state = initialHagathaState(seed)
  let frame = hubHagathaFrameAt(0, seed)
  return {
    advanceTo(tick) {
      const fixedTick = Math.max(0, Math.floor(tick))
      if (fixedTick < currentTick || fixedTick - currentTick >= POTION_TRADER_ACTOR_CHECKPOINT_TICKS) {
        state = hagathaStateAt(fixedTick, seed)
        currentTick = fixedTick
      } else {
        while (currentTick < fixedTick) {
          state = stepHagatha(state)
          currentTick += 1
        }
      }
      frame = presentHagatha(state)
      return frame
    },
  }
}

function presentHagatha(state: HagathaState): HubHagathaFrame {
  return {
    bodyFrame: Math.floor(state.phase) % HAGATHA_BODY_FRAME_COUNT,
    particles: state.particles.map((particle) => ({
      alpha: Math.max(0, Math.min(
        1,
        Math.cos(particle.progress * Math.PI) * particle.opacity,
      )),
      frame: particle.frame,
      id: particle.id,
      offset: particle.offset,
      scale: particle.scale,
    })),
  }
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
