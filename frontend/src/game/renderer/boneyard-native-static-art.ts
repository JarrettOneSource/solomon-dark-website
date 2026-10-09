import { Container, Graphics, MeshSimple, Sprite, type Texture } from 'pixi.js'
import deadhawg from '../../editor/manifest/deadhawg.json' with { type: 'json' }
import type { Polyline, Vec2 } from '../../editor/model.ts'
import { nativeFenceGrate } from '../../editor/native-fence-geometry.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import { createNativeLitSurfaceGrid } from './boneyard-building-surface-view.ts'
import { boneyardTransformedArtBounds } from './boneyard-off-camera-cleanup.ts'
import type { ResidentTexture } from './boneyard-renderer-model.ts'

export interface NativeStaticArtRecord {
  readonly entry: number
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface NativeStaticArtTextures {
  readonly fenceGrate: Texture
  glyph(entry: number): Texture
}

export interface NativeStaticArtOptions {
  readonly alpha?: number
  readonly cleanupSourceKey?: string | null
  readonly enhancedEffects?: boolean
  readonly mainLayerIndex?: number | null
  readonly rotationDegrees?: number
  readonly scaleX?: number
  readonly scaleY?: number
}

/** The complete record bank is authoritative, including explicit/custom selectors. */
export function nativeStaticArtRecord(entry: number): NativeStaticArtRecord | null {
  const source = deadhawg.entries[entry]
  if (!source || source.empty || !source.file) return null
  const anchor = nativeSpriteAnchor(source.rect.w, source.rect.h, source.origin)
  return { entry, w: source.rect.w, h: source.rect.h, anchorX: anchor.x, anchorY: anchor.y }
}

export function nativeStaticMainArtEntry(layer: MainLayer): number | null {
  if (layer.kind === 'object') {
    // Scrub's main and projected shadow use this glyph even with an explicit
    // editor selection. Preserve the existing native class owner.
    return layer.object.typeId === 2062 ? 264 + (layer.object.variant ?? 0) : layer.atlasEntry
  }
  return layer.part === 'post' ? (layer.postStyle === 1 ? 320 : 36) + (layer.postVariant ?? 0) : null
}

/** Borrow a record view; neither retirement nor a failed build owns its page. */
export function createNativeStaticArtResident(
  record: NativeStaticArtRecord,
  texture: Texture,
  position: Readonly<Vec2>,
  options: NativeStaticArtOptions = {},
): ResidentTexture {
  // These are glyph-sized views, not logical animation canvases or loose crops
  // passed to full-page UV math. Keep the custom mesh's normalized UV contract.
  if (texture.orig.width !== record.w || texture.orig.height !== record.h
    || texture.frame.width !== record.w || texture.frame.height !== record.h
    || (texture.trim && (texture.trim.x !== 0 || texture.trim.y !== 0
      || texture.trim.width !== record.w || texture.trim.height !== record.h))) {
    throw new RangeError(`Native static record ${record.entry} lost its glyph-sized texture view.`)
  }
  const rotation = options.rotationDegrees ?? 0
  const scaleX = options.scaleX ?? 1
  const scaleY = options.scaleY ?? 1
  const bounds = boneyardTransformedArtBounds(position, record, rotation, scaleX, scaleY)
  const x = position.x - record.anchorX
  const y = position.y - record.anchorY
  const surfaceMesh = options.enhancedEffects === undefined ? null
    : createNativeLitSurfaceGrid(texture, record.w, record.h, options.enhancedEffects)
  const sprite = surfaceMesh?.mesh ?? new Sprite(texture)
  sprite.position.set(x, y)
  if (rotation !== 0 || scaleX !== 1 || scaleY !== 1) {
    sprite.pivot.set(record.anchorX, record.anchorY)
    sprite.position.set(position.x, position.y)
    sprite.rotation = rotation * Math.PI / 180
    sprite.scale.set(scaleX, scaleY)
  }
  sprite.alpha = options.alpha ?? 1
  sprite.eventMode = 'none'
  sprite.label = `native-static-record:${record.entry}`
  return {
    ...bounds,
    cleanupSourceKey: options.cleanupSourceKey ?? null,
    mainLayerIndex: options.mainLayerIndex ?? null,
    ownsTexture: false,
    pixels: new Uint8ClampedArray(0),
    shadowCaster: null,
    sprite,
    surfaceMesh,
    texture,
  }
}

/** Preserve the existing rail-record count and placement, without baking it. */
export function nativeStaticRailPositions(fence: Polyline, width: number): readonly Vec2[] {
  const [start, end] = fence.points
  if (!start || !end) return []
  const dx = end.x - start.x, dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return []
  const count = Math.max(1, Math.round(length / width))
  return Array.from({ length: count }, (_, index) => {
    const amount = (index + 0.5) / count
    return { x: start.x + dx * amount, y: start.y + dy * amount }
  })
}

/** Multi-primitive fences retain one painter, lighting and shadow owner. */
export function createNativeStaticFenceResident(
  layer: Extract<MainLayer, { kind: 'fence' }>,
  mainLayerIndex: number,
  textures: NativeStaticArtTextures,
): ResidentTexture | null {
  const code = layer.fence.segmentCode ?? layer.fence.style ?? 0
  if (layer.part !== 'body' || (code !== 0 && code !== 4)) return null
  const sprite = new Container({ eventMode: 'none', label: `native-static-fence:${layer.fence.eid}` })
  if (code === 4) {
    const record = nativeStaticArtRecord(23)!
    const positions = nativeStaticRailPositions(layer.fence, record.w)
    if (positions.length === 0) { sprite.destroy(); return null }
    const texture = textures.glyph(23)
    const parts = positions.map(position => createNativeStaticArtResident(record, texture, position))
    for (const part of parts) sprite.addChild(part.sprite)
    const x = Math.min(...parts.map(part => part.x)), y = Math.min(...parts.map(part => part.y))
    return {
      cleanupSourceKey: null, mainLayerIndex, ownsTexture: false, pixels: new Uint8ClampedArray(0),
      shadowCaster: null, sprite, surfaceMesh: null, texture, x, y,
      w: Math.max(...parts.map(part => part.x + part.w)) - x,
      h: Math.max(...parts.map(part => part.y + part.h)) - y,
    }
  }
  const grate = nativeFenceGrate(layer.fence.points)
  if (!grate || grate.length === 0) { sprite.destroy(); return null }
  const points = [grate.topStart, grate.topEnd, grate.bottomStart, grate.bottomEnd]
  const mesh = new MeshSimple({
    texture: textures.fenceGrate,
    vertices: new Float32Array(points.flatMap(point => [point.x, point.y])),
    uvs: new Float32Array([0, 0, grate.uSpan, 0, 0, 1, grate.uSpan, 1]),
    indices: new Uint32Array([0, 1, 2, 2, 1, 3]),
    topology: 'triangle-list',
  })
  mesh.autoUpdate = false
  mesh.eventMode = 'none'
  const rules = new Graphics()
    .moveTo(grate.topStart.x, grate.topStart.y + 9)
    .lineTo(grate.topEnd.x, grate.topEnd.y + 9)
    .moveTo(grate.bottomStart.x, grate.bottomStart.y - 5)
    .lineTo(grate.bottomEnd.x, grate.bottomEnd.y - 5)
    .stroke({ color: 0, width: 3, cap: 'butt' })
  sprite.addChild(mesh, rules)
  const x = Math.min(...points.map(point => point.x)) - 1.5
  const y = Math.min(...points.map(point => point.y)) - 1.5
  return {
    cleanupSourceKey: null, mainLayerIndex, ownsTexture: false, pixels: new Uint8ClampedArray(0),
    ownedGeometries: [mesh.geometry], shadowCaster: null, sprite, surfaceMesh: null,
    texture: textures.fenceGrate, x, y,
    w: Math.max(...points.map(point => point.x)) + 1.5 - x,
    h: Math.max(...points.map(point => point.y)) + 1.5 - y,
  }
}
