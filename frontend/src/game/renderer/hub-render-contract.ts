import {
  HUB_ASTRONOMER_DEPTH,
  HUB_ASTRONOMER_FRONT_DEPTH,
  HUB_ASTRONOMER_TELESCOPE_DEPTH,
  HUB_COURTYARD_FOREGROUND_DEPTH,
  HUB_SOUTHERN_FOREGROUND_DEPTH,
  HUB_USEFUL_THYNGS_BALLOON_DEPTH,
  HUB_USEFUL_THYNGS_COUNTER_DEPTH,
  HUB_USEFUL_THYNGS_FRONT_DEPTH,
  HUB_USEFUL_THYNGS_MARKER_DEPTH,
  HUB_USEFUL_THYNGS_SHADOW_DEPTH,
  hubActorDepth,
} from '../hub-depth.ts'
import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
} from './game-viewport.ts'

export const HUB_RENDER_WIDTH = GAME_VIEWPORT_MIN_WIDTH
export const HUB_RENDER_HEIGHT = GAME_VIEWPORT_MIN_HEIGHT
export const HUB_RENDER_MIN_RESOLUTION = 0.5
export const HUB_RENDER_MAX_RESOLUTION = 1.5

export const HUB_WORLD_DEPTH = {
  astronomer: HUB_ASTRONOMER_DEPTH,
  astronomerFront: HUB_ASTRONOMER_FRONT_DEPTH,
  astronomerTelescope: HUB_ASTRONOMER_TELESCOPE_DEPTH,
  courtyard: 0,
  sealGlyphs: 10,
  sealCore: 11,
  usefulThyngsShadow: HUB_USEFUL_THYNGS_SHADOW_DEPTH,
  fountain: 980,
  statueAura: hubActorDepth(834) - 1,
  statue: hubActorDepth(834),
  southernForeground: HUB_SOUTHERN_FOREGROUND_DEPTH,
  usefulThyngsBack: HUB_USEFUL_THYNGS_COUNTER_DEPTH,
  usefulThyngsFront: HUB_USEFUL_THYNGS_FRONT_DEPTH,
  usefulThyngsBalloons: HUB_USEFUL_THYNGS_BALLOON_DEPTH,
  usefulThyngsMarker: HUB_USEFUL_THYNGS_MARKER_DEPTH,
  courtyardForeground: HUB_COURTYARD_FOREGROUND_DEPTH,
} as const

export const HUB_WORLD_LAYER_BOUNDS = {
  courtyardForeground: { x: 0, y: 0, width: 2000, height: 583 },
  sealCore: { x: 1889, y: 234, width: 111, height: 270 },
  sealGlyphs: { x: 675, y: 672, width: 582, height: 302 },
  usefulThyngsBack: { x: 1361, y: 646, width: 63, height: 56 },
  usefulThyngsFront: { x: 1343, y: 479, width: 141, height: 220 },
  usefulThyngsShadow: { x: 1327, y: 507, width: 209, height: 206 },
} as const

export const HUB_COURTYARD_DEPTH_PROP_FRAME = {
  height: 263,
  width: 508,
  x: 582,
  y: 0,
} as const

export const HUB_COURTYARD_DEPTH_PROPS = [
  { actorY: 162.5, record: 23 },
  { actorY: 169, record: 24 },
  { actorY: 215, record: 20 },
  { actorY: 239.5, record: 25 },
] as const

export interface HubResolutionInputs {
  devicePixelRatio: number
  displayScale: number
  maxResolution?: number
}

export function initialHubResolution({
  devicePixelRatio,
  displayScale,
  maxResolution = HUB_RENDER_MAX_RESOLUTION,
}: HubResolutionInputs): number {
  const requested = finiteOr(devicePixelRatio, 1) * finiteOr(displayScale, 1)
  return quantizeResolution(clamp(
    requested,
    HUB_RENDER_MIN_RESOLUTION,
    clamp(maxResolution, HUB_RENDER_MIN_RESOLUTION, HUB_RENDER_MAX_RESOLUTION),
  ))
}

export function hubWorldDepthForActor(y: number): number {
  return hubActorDepth(y)
}

export function spriteFrameIndex(value: number, count: number): number {
  if (!Number.isFinite(value) || count <= 0) return 0
  const integer = Math.floor(value) % count
  return integer < 0 ? integer + count : integer
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function quantizeResolution(value: number): number {
  return Math.round(value * 4) / 4
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
