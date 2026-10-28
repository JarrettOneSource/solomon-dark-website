import type { Vec2 } from '../../editor/model.ts'
import { NATIVE_GROUND_PI } from '../core-kernels/native-ground-auxiliary.ts'
import { createNativeRng, drawNativeInteger, type NativeRngState } from '../core-kernels/native-rng.ts'
import type { NativeBoneyardComplexShadowRecord } from './boneyard-complex-shadows.ts'
import { nativeEnemySpriteGeometry } from './native-enemy-assets.ts'
import { nativeFlatGlyphShadowVertices } from './native-scenery-shadow.ts'

type Quad<T> = readonly [T, T, T, T]

export interface NativeScrubShadowQuad {
  readonly alphas: Quad<number>
  readonly role: 'scrub-flat-shadow' | 'scrub-directional-shadow' | 'scrub-surface-reflection'
  readonly tint: number
  readonly uvs: Quad<Readonly<Vec2>>
  readonly vertices: Quad<Readonly<Vec2>>
}

export interface NativeScrubGlyph {
  readonly anchorX: number
  readonly anchorY: number
  readonly width: number
  readonly height: number
}

/** Scrub2062 shares the complete DeadHawg264 bank, including Tree replacements15..18. */
export function nativeScrubGlyph(variant: number): NativeScrubGlyph {
  return nativeEnemySpriteGeometry('DeadHawg', 264 + variant)
}

/** Constructor005E4040 and fixed tick005E40D0; presentation RNG never enters authority. */
export class NativeScrubShadowState {
  private rng: NativeRngState
  private lastTick: number
  phase: number
  uvInset = 0
  specialSurface = false

  constructor(seed: number, initialTick: number) {
    const draw = drawNativeInteger(createNativeRng(seed), 360)
    this.rng = draw.state
    this.phase = draw.value
    this.lastTick = initialTick
  }

  advanceTo(tick: number): void {
    for (; this.lastTick < tick; this.lastTick += 1) {
      const draw = drawNativeInteger(this.rng, 3)
      this.rng = draw.state
      this.phase = (this.phase + draw.value) | 0
    }
  }
}

const GLYPH_UVS: Quad<Readonly<Vec2>> = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
]

function glyphVertices(glyph: NativeScrubGlyph): Quad<Readonly<Vec2>> {
  return [
    { x: -glyph.anchorX, y: -glyph.anchorY },
    { x: glyph.width - glyph.anchorX, y: -glyph.anchorY },
    { x: -glyph.anchorX, y: glyph.height - glyph.anchorY },
    { x: glyph.width - glyph.anchorX, y: glyph.height - glyph.anchorY },
  ]
}

function flatShadow(glyph: NativeScrubGlyph): NativeScrubShadowQuad {
  return {
    alphas: [1, 1, 1, 1], role: 'scrub-flat-shadow', tint: 0, uvs: GLYPH_UVS,
    vertices: nativeFlatGlyphShadowVertices(glyph),
  }
}

function directionalShadow(glyph: NativeScrubGlyph, record: NativeBoneyardComplexShadowRecord,
  uvInset: number,
): NativeScrubShadowQuad {
  const { direction, distanceFraction, projectionDistance } = record
  const radians = Math.fround(Math.atan2(direction.x, -direction.y))
  let degrees = Math.fround(radians * 180 / NATIVE_GROUND_PI)
  if (degrees < 0) degrees = Math.fround(degrees + 360)
  const angle = Math.fround(-degrees * NATIVE_GROUND_PI / 180)
  const cosine = Math.fround(Math.cos(angle))
  const sine = -Math.fround(Math.sin(angle))
  const scaleX = Math.min(Math.fround(10 * distanceFraction), 1)
  const scaleY = Math.fround(.8)
  const xx = Math.fround(cosine * scaleX)
  const yx = Math.fround(scaleY * Math.fround(sine * scaleX))
  const yy = Math.fround(scaleY * cosine)
  const near = (point: Readonly<Vec2>): Readonly<Vec2> => ({
    x: Math.fround(Math.fround(point.x * xx - point.y * sine) + Math.fround(20 * direction.x)),
    y: Math.fround(Math.fround(point.x * yx + point.y * yy) + Math.fround(20 * direction.y)),
  })
  const length = Math.fround(distanceFraction * 10 * distanceFraction)
  const far = (point: Readonly<Vec2>): Readonly<Vec2> => ({
    x: Math.fround(point.x + Math.fround(length * Math.fround(projectionDistance * direction.x))),
    y: Math.fround(point.y + Math.fround(length * Math.fround(projectionDistance * direction.y))),
  })
  const corners = glyphVertices(glyph)
  const nearLeft = near(corners[2])
  const nearRight = near(corners[3])
  const bottom = Math.fround(1 - uvInset)
  return {
    alphas: [0, 0, 1, 1], role: 'scrub-directional-shadow', tint: 0,
    uvs: [GLYPH_UVS[0], GLYPH_UVS[1], { x: 0, y: bottom }, { x: 1, y: bottom }],
    vertices: [far(nearLeft), far(nearRight), nearLeft, nearRight],
  }
}


export const NATIVE_SCRUB_REFLECTION_ENTRY = 21

function surfaceReflection(state: NativeScrubShadowState): NativeScrubShadowQuad {
  const glyph = nativeEnemySpriteGeometry('DeadHawg', NATIVE_SCRUB_REFLECTION_ENTRY)
  const wave = Math.abs(Math.fround(Math.sin(Math.fround(state.phase / 3))))
  const scale = Math.fround(wave * .25 + Math.fround(.6))
  const alpha = Math.fround(.35)
  return {
    alphas: [alpha, alpha, alpha, alpha], role: 'scrub-surface-reflection', tint: 0xffffff,
    uvs: GLYPH_UVS,
    vertices: glyphVertices(glyph).map(point => ({
      x: Math.fround(point.x * scale), y: Math.fround(point.y * scale),
    })) as unknown as Quad<Readonly<Vec2>>,
  }
}

/** Complete Scrub::RenderShadow00620120, with lazy surface ownership. */
export function nativeScrubShadowPlan(
  glyph: NativeScrubGlyph, position: Readonly<Vec2>, state: NativeScrubShadowState,
  records: readonly NativeBoneyardComplexShadowRecord[], complexShadows: boolean,
  specialSurfaceAt: (point: Readonly<Vec2>) => boolean,
): readonly NativeScrubShadowQuad[] {
  if (!complexShadows) return [flatShadow(glyph)]
  if (state.uvInset === 0) {
    // Each resident owns the entire native glyph: its normalized UV height is1.
    state.uvInset = Math.fround(.2)
    const x = Math.fround(position.x)
    const y = Math.fround(position.y)
    const center = specialSurfaceAt({ x, y })
    const below = specialSurfaceAt({ x, y: Math.fround(y + 10) })
    const above = specialSurfaceAt({ x, y: Math.fround(y - 10) })
    state.specialSurface = center || below || above
  }
  const result: NativeScrubShadowQuad[] = []
  if (state.specialSurface) result.push(surfaceReflection(state))
  for (const record of records) result.push(directionalShadow(glyph, record, state.uvInset))
  return result
}
