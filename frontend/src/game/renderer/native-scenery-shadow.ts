import deadhawg from '../../editor/manifest/deadhawg.json' with { type: 'json' }
import type { Vec2 } from '../../editor/model.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import { nativeFenceStoredInset, nativeFenceStoredLength, nativeFenceStoredUnit,
  NATIVE_FENCE_TEXTURE_REPEAT } from '../../editor/native-fence-geometry.ts'
import { NATIVE_GROUND_PI } from '../core-kernels/native-ground-auxiliary.ts'
import { nativeEnemySpriteGeometry } from './native-enemy-assets.ts'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'
import type { BoneyardCombatAtlas } from './boneyard-combat-atlas.ts'

/** Scenery records share the original loaded pages but are not enemy preload selectors. */
export function nativeSceneryGlyphTexture(atlas: Pick<BoneyardCombatAtlas, 'single'>, entry: number) {
  nativeEnemySpriteGeometry('DeadHawg', entry)
  return atlas.single(boneyardCombatAtlasSource('DeadHawg', entry))
}

type Quad<T> = readonly [T, T, T, T]

export interface NativeSceneryShadowGlyph {
  readonly width: number
  readonly height: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface NativeSceneryShadowQuad {
  readonly alphas: Quad<number>
  readonly role: 'tree-root-mask' | 'scenery-flat-shadow' | 'fence-flat-shadow' | 'wall-base-shadow'
  readonly texture: number | 'fence-grate' | 'white'
  readonly tint: number
  readonly uvs: Quad<Readonly<Vec2>>
  readonly vertices: Quad<Readonly<Vec2>>
}

const FULL_UVS: Quad<Readonly<Vec2>> = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
]

function glyphVertices(glyph: NativeSceneryShadowGlyph): Quad<Readonly<Vec2>> {
  return [
    { x: -glyph.anchorX, y: -glyph.anchorY },
    { x: glyph.width - glyph.anchorX, y: -glyph.anchorY },
    { x: -glyph.anchorX, y: glyph.height - glyph.anchorY },
    { x: glyph.width - glyph.anchorX, y: glyph.height - glyph.anchorY },
  ]
}

/** Basic00417060: exact glyph UVs, top-corner offsets only; shared by all seven callers. */
export function nativeFlatGlyphShadowVertices(glyph: NativeSceneryShadowGlyph): Quad<Readonly<Vec2>> {
  const vertices = glyphVertices(glyph)
  const x = Math.fround(glyph.height * .25)
  const y = Math.fround(x * 1.25)
  return [
    { x: Math.fround(vertices[0].x + x), y: Math.fround(vertices[0].y + y) },
    { x: Math.fround(vertices[1].x + x), y: Math.fround(vertices[1].y + y) },
    vertices[2], vertices[3],
  ]
}

function glyphQuad(entry: number, position: Readonly<Vec2>, rootMask = false): readonly NativeSceneryShadowQuad[] {
  if (deadhawg.entries[entry]?.empty) return []
  const glyph = nativeEnemySpriteGeometry('DeadHawg', entry)
  const vertices = rootMask ? glyphVertices(glyph) : nativeFlatGlyphShadowVertices(glyph)
  return [{
    alphas: [1, 1, 1, 1], role: rootMask ? 'tree-root-mask' : 'scenery-flat-shadow',
    texture: entry, tint: rootMask ? 0xffffff : 0, uvs: FULL_UVS,
    vertices: vertices.map(point => ({
      x: Math.fround(point.x + position.x), y: Math.fround(point.y + position.y),
    })) as unknown as Quad<Readonly<Vec2>>,
  }]
}

export function nativeGoodieShadowPlan(
  goodie: { readonly position: Readonly<Vec2>; readonly subtype: number; readonly phase: 0 | 1 | 2 },
  complexShadows: boolean,
): readonly NativeSceneryShadowQuad[] {
  if (goodie.subtype !== 0) throw new RangeError(`Unsupported native Goodie shadow subtype ${goodie.subtype}.`)
  return complexShadows ? [] : glyphQuad(145 + goodie.phase, goodie.position)
}

/** Persistent class auxiliary painters, separate from their directional outline programs. */
export function nativeSceneryShadowPlan(layer: MainLayer, complexShadows: boolean): readonly NativeSceneryShadowQuad[] {
  if (layer.kind === 'fence') {
    if (complexShadows) return []
    const code = layer.fence.segmentCode ?? layer.fence.style ?? 0
    if (layer.part === 'post') {
      const selector = layer.postVariant ?? 0
      const alternate = (layer.postStyle ?? (code === 4 ? 1 : 0)) === 1
      if (selector < 0 || selector >= (alternate ? 28 : 7)) throw new RangeError('Unsupported native Fencepost glyph selector.')
      return glyphQuad((alternate ? 320 : 36) + selector, layer.pos)
    }
    if (code === 0) {
      const a = layer.fence.points[0], b = layer.fence.points[1]
      if (!a || !b || (a.x === b.x && a.y === b.y)) return []
      const [start, end] = nativeFenceStoredInset(a, b, 12)
      return [fenceQuad([
        { x: start.x, y: Math.fround(start.y - 52) }, { x: end.x, y: Math.fround(end.y - 52) }, start, end,
      ], nativeFenceStoredLength({ x: Math.fround(end.x - start.x), y: Math.fround(end.y - start.y) }))]
    }
    if (code === 4) return railsQuad(layer.fence.points)
    // Gate/Broken retain their constructor-zero UVs; loose fencegrate(0,0) is transparent.
    // Wall has an unconditional separately owned gradient skirt.
    return []
  }
  const { object, pos } = layer
  if (object.typeId === 2001) {
    const tree = object as typeof object & { secondaryVisible?: boolean; secondaryVariant?: number }
    const variant = object.variant ?? layer.atlasEntry - 264
    if (variant < 0 || variant >= 15) throw new RangeError('Tree shadow requires a materialized variant0..14.')
    const result = [...glyphQuad(228 + variant, pos, true)]
    if (!complexShadows) {
      result.push(...glyphQuad(264 + variant, pos))
      if (variant < 6 && tree.secondaryVisible !== false) {
        const secondary = tree.secondaryVariant ?? 0
        if (secondary < 0 || secondary >= 21) throw new RangeError('Unsupported native Tree secondary selector.')
        result.push(...glyphQuad(243 + secondary, { x: pos.x, y: Math.fround(pos.y + 25) }))
      }
    }
    return result
  }
  if (complexShadows) return []
  const bank = object.typeId === 2029 ? { first: 97, count: 17 }
    : object.typeId === 2009 ? { first: 156, count: 21 }
      : object.typeId === 2040 ? { first: 148, count: 4 } : null
  if (!bank) return []
  const variant = object.variant ?? layer.atlasEntry - bank.first
  if (variant < 0 || variant >= bank.count) throw new RangeError('Unsupported native scenery shadow selector.')
  return glyphQuad(bank.first + variant, pos)
}

export function nativeWallSkirtPlan(start: Readonly<Vec2>, end: Readonly<Vec2>): NativeSceneryShadowQuad {
  return {
    alphas: [1, 1, 0, 0], role: 'wall-base-shadow', texture: 'white', tint: 0, uvs: FULL_UVS,
    vertices: [start, end, { x: start.x, y: Math.fround(start.y + 20) }, { x: end.x, y: Math.fround(end.y + 20) }],
  }
}

function fenceQuad(vertices: Quad<Readonly<Vec2>>, length: number): NativeSceneryShadowQuad {
  const span = Math.fround(length / NATIVE_FENCE_TEXTURE_REPEAT)
  return {
    alphas: [.5, .5, .5, .5], role: 'fence-flat-shadow', texture: 'fence-grate', tint: 0,
    uvs: [{ x: 0, y: 0 }, { x: span, y: 0 }, { x: 0, y: 1 }, { x: span, y: 1 }],
    vertices: [
      { x: Math.fround(vertices[0].x + 10), y: Math.fround(vertices[0].y + 10) },
      { x: Math.fround(vertices[1].x + 10), y: Math.fround(vertices[1].y + 10) },
      vertices[2], vertices[3],
    ],
  }
}

function railsQuad(points: readonly Vec2[]): readonly NativeSceneryShadowQuad[] {
  const a = points[0], b = points[1]
  if (!a || !b) return []
  if (a.x === b.x && a.y === b.y) return []
  const [start, end] = nativeFenceStoredInset(a, b, 4)
  const delta = { x: Math.fround(end.x - start.x), y: Math.fround(end.y - start.y) }
  const { x: ux, y: uy } = nativeFenceStoredUnit(delta)
  let angle = Math.fround(Math.fround(Math.atan2(ux, -uy)) * 180 / NATIVE_GROUND_PI)
  if (angle < 0) angle = Math.fround(angle + 360)
  const radians = Math.fround(NATIVE_GROUND_PI * Math.fround(angle + 90) / 180)
  const nx = Math.fround(Math.fround(Math.sin(radians)) * 3)
  const ny = Math.fround(-Math.fround(Math.cos(radians)) * 3)
  const top = (p: Vec2) => ({ x: Math.fround(p.x - nx), y: Math.fround(Math.fround(p.y - 14) - ny) })
  const bottom = (p: Vec2) => ({ x: Math.fround(p.x + nx), y: Math.fround(p.y + ny) })
  const vertices: Quad<Readonly<Vec2>> = [top(start), top(end), bottom(start), bottom(end)]
  const ordered: Quad<Readonly<Vec2>> = vertices[2].y > vertices[0].y
    ? vertices : [vertices[2], vertices[3], vertices[0], vertices[1]]
  return [fenceQuad(ordered, nativeFenceStoredLength(delta))]
}
