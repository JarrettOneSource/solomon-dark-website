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

const FOUNTAIN_ALPHA_LIMIT = 0.25
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
