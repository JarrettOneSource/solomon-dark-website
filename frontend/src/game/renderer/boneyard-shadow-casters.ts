import type { MainLayer } from '../../editor/native-render-plan.ts'
import { NATIVE, type EditorDoc, type Vec2 } from '../../editor/model.ts'
import {
  nativeBoneyardTreeComplexShadowOutline,
  type NativeBoneyardComplexShadowCaster,
} from './boneyard-complex-shadows.ts'
import {
  nativeBuildingShadowOutline,
  nativeFencepostShadowOutline,
  nativeGoodieShadowOutline,
  nativeGravestoneShadowOutline,
  nativeMonumentShadowOutline,
} from './boneyard-native-shadow-shapes.ts'

export function nativeBoneyardMainLayerShadowCaster(
  document: EditorDoc,
  layer: MainLayer,
  layerIndex: number,
): NativeBoneyardComplexShadowCaster | null {
  const family = layer.kind === 'object'
    ? ({ 2001: 'Tree', 2029: 'Gravestone', 2009: 'Monument', 2040: 'Building', 2061: 'Goodie' } as Record<number, string>)[layer.object.typeId]
    : layer.part === 'post' ? 'Fencepost'
      : ['FenceGrate', 'Broken', 'Gate', 'Wall', 'Rails'][layer.fence.segmentCode ?? layer.fence.style ?? 0]
  if (layer.kind === 'fence' && layer.part === 'body') {
    const code = layer.fence.segmentCode ?? layer.fence.style ?? 0
    const start = layer.fence.points[0]
    const end = layer.fence.points[1]
    if (!start || !end) return null
    if (code === 1) {
      const half = layer.brokenHalf
      if (!half) throw new Error(`Broken fence ${layer.fence.eid} requires its native constructor state.`)
      return { id: `main:${layerIndex}`, family, outline: [], position: { ...half.root },
        program: { kind: 'fence-grate', construction: 'broken', start: half.shadowStart,
          end: half.shadowEnd, step: half.shadowStep, count: half.shadowCount } }
    }
    if (code === 0) {
      return {
        id: `main:${layerIndex}`,
        outline: [],
        position: { ...layer.pos },
        program: {
          construction: 'intact',
          end: { ...end },
          kind: 'fence-grate',
          start: { ...start },
        },
        family,
      }
    }
    if (code === 4) {
      return {
        id: `main:${layerIndex}`,
        outline: [],
        position: { ...layer.pos },
        program: { end: { ...end }, kind: 'rails', start: { ...start } },
        family,
      }
    }
    if (code === 3) {
      const direction = normalizedSegment(start, end)
      const otherWalls = document.fences.filter((fence) => (
        (fence.segmentCode ?? fence.style ?? 0) === 3
        && fence.eid !== layer.fence.eid
      ))
      const connected = (point: Vec2) => otherWalls.some((fence) => (
        fence.points.slice(0, 2).some((candidate) => samePoint(candidate, point))
      ))
      return {
        id: `main:${layerIndex}`,
        outline: [],
        position: { ...layer.pos },
        program: {
          end: connected(end)
            ? { ...end }
            : { x: end.x + direction.x * 15, y: end.y + direction.y * 15 },
          kind: 'wall',
          start: connected(start)
            ? { ...start }
            : { x: start.x - direction.x * 15, y: start.y - direction.y * 15 },
        },
        family,
      }
    }
  }

  let outline: Vec2[]
  if (layer.kind === 'fence' && layer.part === 'post') {
    outline = nativeFencepostShadowOutline(
      layer.postVariant ?? 0,
      layer.postStyle ?? ((layer.fence.segmentCode ?? layer.fence.style ?? 0) === 4 ? 1 : 0),
    )
  } else if (layer.kind !== 'object') {
    return null
  } else {
    const variant = layer.object.variant ?? (
      layer.object.typeId === NATIVE.gravestone ? layer.atlasEntry - 97
        : layer.object.typeId === NATIVE.monument ? layer.atlasEntry - 156
          : layer.object.typeId === NATIVE.building ? layer.atlasEntry - 148
            : 0
    )
    switch (layer.object.typeId) {
      case NATIVE.tree:
        outline = nativeBoneyardTreeComplexShadowOutline(
          layer.object.variant ?? layer.atlasEntry - 264,
        )
        break
      case NATIVE.gravestone:
        outline = nativeGravestoneShadowOutline(variant)
        break
      case NATIVE.monument:
        outline = nativeMonumentShadowOutline(variant)
        break
      case NATIVE.building:
        outline = nativeBuildingShadowOutline(variant)
        break
      case NATIVE.goodie:
        outline = nativeGoodieShadowOutline(layer.object.subtype ?? 0)
        break
      default:
        return null
    }
  }
  return outline.length < 3
    ? null
    : { id: `main:${layerIndex}`, family, outline, position: { ...layer.pos } }
}

function normalizedSegment(start: Vec2, end: Vec2): Vec2 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length }
}

function samePoint(left: Vec2, right: Vec2): boolean {
  return left.x === right.x && left.y === right.y
}
