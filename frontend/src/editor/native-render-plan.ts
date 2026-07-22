import type { EditorDoc, PlacedObject, Polyline, SelEntry, StaticSprite, Vec2 } from './model.ts'
import { NATIVE } from './model.ts'

export const NATIVE_PLACEMENT_PASSES = ['underlay', 'compact', 'shadow', 'main', 'foreground'] as const

interface NativePlacedObject extends PlacedObject {
  atlasEntry?: number
  secondaryAtlasEntry?: number
  secondaryVariant?: number
  secondaryVisible?: boolean
  overlayAtlasEntry?: number
  overlayVariant?: number
  atlasEntries?: number[]
}

interface NativeStaticSprite extends StaticSprite {
  deadHawgEntry?: number
}

export interface ObjectSpriteLayer {
  kind: 'object'
  sel: SelEntry
  object: PlacedObject
  atlas: string
  atlasEntry: number
  pos: Vec2
}

export interface CompactSpriteLayer {
  kind: 'sprite'
  sel: SelEntry
  sprite: StaticSprite
  atlas: string
  atlasEntry: number
  pos: Vec2
}

export interface ObjectMainLayer extends ObjectSpriteLayer {
  sortKey: number
  sourceOrder: number
}

export interface FenceMainLayer {
  kind: 'fence'
  sel: SelEntry
  fence: Polyline
  part: 'post' | 'body'
  pieceIndex: number
  pos: Vec2
  sortKey: number
  sourceOrder: number
}

export type MainLayer = ObjectMainLayer | FenceMainLayer

export interface NativeRenderPlan {
  underlays: ObjectSpriteLayer[]
  compact: CompactSpriteLayer[]
  shadows: MainLayer[]
  main: MainLayer[]
  foreground: ObjectSpriteLayer[]
}

function objectEntry(object: NativePlacedObject): number | undefined {
  if (object.atlasEntry !== undefined) return object.atlasEntry
  if (object.atlasEntries?.[0] !== undefined) return object.atlasEntries[0]
  const variant = object.variant ?? 0
  switch (object.typeId) {
    case NATIVE.tree: return 264 + variant
    case NATIVE.monument: return 156 + variant
    case NATIVE.gravestone: return 97 + variant
    case NATIVE.building: return 148 + variant
    case NATIVE.goodie: return 145 + variant
    default: return object.sprite?.atlas === 'DeadHawg' ? object.sprite.entry : undefined
  }
}

function objectLayer(object: NativePlacedObject, atlasEntry: number): ObjectSpriteLayer {
  return {
    kind: 'object',
    sel: { kind: 'object', eid: object.eid },
    object,
    atlas: 'DeadHawg',
    atlasEntry,
    pos: object.pos,
  }
}

function mainObjectLayer(object: NativePlacedObject, sourceOrder: number): ObjectMainLayer | null {
  const atlasEntry = objectEntry(object)
  if (atlasEntry === undefined) return null
  const sortBias = object.sortBias ?? (object.typeId === NATIVE.building ? -50 : 0)
  return {
    ...objectLayer(object, atlasEntry),
    sortKey: object.pos.y + sortBias,
    sourceOrder,
  }
}

function underlayFor(object: NativePlacedObject): ObjectSpriteLayer | null {
  if (object.typeId !== NATIVE.gravestone) return null
  return objectLayer(object, object.overlayAtlasEntry ?? 88 + (object.overlayVariant ?? 0))
}

function foregroundFor(object: NativePlacedObject): ObjectSpriteLayer | null {
  if (object.typeId === NATIVE.tree) {
    if (object.secondaryVisible === false || (object.variant ?? 0) >= 6) return null
    return objectLayer(object, object.secondaryAtlasEntry ?? 243 + (object.secondaryVariant ?? 0))
  }
  if (object.typeId === NATIVE.building) {
    return objectLayer(object, object.atlasEntries?.[1] ?? 152 + (object.variant ?? 0))
  }
  return null
}

function pointAlong(fence: Polyline, t: number): Vec2 {
  const start = fence.points[0] ?? { x: 0, y: 0 }
  const end = fence.points[1] ?? start
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

function fenceBodyPositions(fence: Polyline): Vec2[] {
  // The materializer creates two Puppet leaves for broken grates and gates.
  // Intact grates and rails create one body whose recovered base position is
  // the endpoint midpoint (FenceGrate/Rails builders +0x18). Walls also
  // materialize as one body, represented at their static midpoint here.
  switch (fence.segmentCode ?? fence.style ?? 0) {
    case 1: return [pointAlong(fence, 0.28), pointAlong(fence, 0.72)]
    case 2: return [pointAlong(fence, 0.26), pointAlong(fence, 0.74)]
    default: return [pointAlong(fence, 0.5)]
  }
}

function pointKey(point: Vec2): string {
  return `${point.x},${point.y}`
}

/**
 * Build the retail placement passes recovered from Arena::Render. Roads and
 * terrain are structural passes owned by the canvas; this plan starts with
 * Puppet +0x2c underlays and ends with Puppet +0x24 foreground art.
 */
export function buildNativeRenderPlan(doc: EditorDoc): NativeRenderPlan {
  const objects = doc.objects as NativePlacedObject[]
  const underlays = objects.flatMap((object) => {
    const layer = underlayFor(object)
    return layer ? [layer] : []
  })
  const compact = (doc.sprites as NativeStaticSprite[]).map((sprite): CompactSpriteLayer => ({
    kind: 'sprite',
    sel: { kind: 'sprite', eid: sprite.eid },
    sprite,
    atlas: 'DeadHawg',
    atlasEntry: sprite.deadHawgEntry ?? 114 + sprite.atlasEntry,
    pos: sprite.pos,
  }))
  const objectMain = objects.flatMap((object, sourceOrder) => {
    const layer = mainObjectLayer(object, sourceOrder)
    return layer ? [layer] : []
  })
  const uniquePosts = new Map<string, { fence: Polyline; pos: Vec2 }>()
  // 0x0064AC90 collects and deduplicates every non-wall endpoint before it
  // creates any fence bodies, so connected segments share one Puppet post.
  for (const fence of doc.fences) {
    if ((fence.segmentCode ?? fence.style ?? 0) === 3) continue
    for (const pos of fence.points.slice(0, 2)) {
      if (!uniquePosts.has(pointKey(pos))) uniquePosts.set(pointKey(pos), { fence, pos })
    }
  }
  const fencePosts = [...uniquePosts.values()].map(({ fence, pos }, index): FenceMainLayer => ({
    kind: 'fence',
    sel: { kind: 'fence', eid: fence.eid },
    fence,
    part: 'post',
    pieceIndex: index,
    pos,
    sortKey: pos.y,
    sourceOrder: objects.length + index,
  }))
  const bodySourceOrder = objects.length + fencePosts.length
  const fenceBodies = doc.fences.flatMap((fence, fenceIndex) => fenceBodyPositions(fence).map((pos, pieceIndex): FenceMainLayer => ({
    kind: 'fence',
    sel: { kind: 'fence', eid: fence.eid },
    fence,
    part: 'body',
    pieceIndex,
    pos,
    sortKey: pos.y,
    sourceOrder: bodySourceOrder + fenceIndex * 2 + pieceIndex,
  })))
  const shadows = [...objectMain, ...fencePosts, ...fenceBodies]
  const main = [...shadows].sort((left, right) => left.sortKey - right.sortKey || left.sourceOrder - right.sourceOrder)
  const foreground = objects.flatMap((object) => {
    const layer = foregroundFor(object)
    return layer ? [layer] : []
  })
  return { underlays, compact, shadows, main, foreground }
}
