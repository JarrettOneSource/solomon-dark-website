import type { Vec2 } from '../../editor/model.ts'
import {
  nativeBoneyardPackedShadowAlpha,
  type NativeBoneyardProjectedShadowEdge,
} from './boneyard-complex-shadows.ts'

export interface NativeBoneyardShadowMesh {
  alphas: Float32Array
  indices: Uint32Array
  positions: Float32Array
}

interface NativeBoneyardShadowLine {
  alpha: number
  end: Vec2
  start: Vec2
  width: number
}

export function buildNativeBoneyardShadowMesh(
  projectedEdges: readonly NativeBoneyardProjectedShadowEdge[],
  lineQuads: readonly NativeBoneyardProjectedShadowEdge[],
): NativeBoneyardShadowMesh {
  const quadCount = projectedEdges.length + lineQuads.length
  const positions = new Float32Array(quadCount * 8)
  const alphas = new Float32Array(quadCount * 4)
  const indices = new Uint32Array(quadCount * 6)
  let quadIndex = 0
  for (const edge of projectedEdges) writeQuad(edge, quadIndex++)
  for (const edge of lineQuads) writeQuad(edge, quadIndex++)
  return { alphas, indices, positions }

  function writeQuad(edge: NativeBoneyardProjectedShadowEdge, index: number): void {
    const vertex = index * 4
    positions.set([
      edge.baseStart.x, edge.baseStart.y,
      edge.baseEnd.x, edge.baseEnd.y,
      edge.tipStart.x, edge.tipStart.y,
      edge.tipEnd.x, edge.tipEnd.y,
    ], vertex * 2)
    alphas.set([
      nativeBoneyardPackedShadowAlpha(edge.baseAlpha),
      nativeBoneyardPackedShadowAlpha(edge.baseAlpha),
      nativeBoneyardPackedShadowAlpha(edge.tipAlpha),
      nativeBoneyardPackedShadowAlpha(edge.tipAlpha),
    ], vertex)
    indices.set([
      vertex,
      vertex + 1,
      vertex + 2,
      vertex + 1,
      vertex + 3,
      vertex + 2,
    ], index * 6)
  }
}

export function nativeBoneyardShadowLineQuad(
  line: NativeBoneyardShadowLine,
): NativeBoneyardProjectedShadowEdge {
  const perpendicular = linePerpendicular(line.start, line.end, line.width / 2)
  return {
    baseAlpha: line.alpha,
    baseEnd: subtract(line.end, perpendicular),
    baseStart: subtract(line.start, perpendicular),
    tipAlpha: line.alpha,
    tipEnd: add(line.end, perpendicular),
    tipStart: add(line.start, perpendicular),
  }
}

function linePerpendicular(start: Vec2, end: Vec2, halfWidth: number): Vec2 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  return length === 0
    ? { x: 0, y: 0 }
    : { x: -dy / length * halfWidth, y: dx / length * halfWidth }
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y }
}

function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y }
}
