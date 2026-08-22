import type { SpriteRef, Vec2 } from '../../editor/model.ts'

export const NATIVE_BUILDING_BASE_ENTRIES = Object.freeze([148, 149, 150, 151])
export const NATIVE_BUILDING_ROOF_ENTRIES = Object.freeze([152, 153, 154, 155])
export const NATIVE_MONUMENT_ENTRIES = Object.freeze(
  Array.from({ length: 21 }, (_, index) => 156 + index),
)

export interface NativeBuildingMeshGrid {
  indices: Uint32Array
  positions: Float32Array
  uvs: Float32Array
}

interface NativeBuildingLightGridInput {
  enhancedEffects: boolean
  position: Vec2
  sprite: Pick<SpriteRef, 'anchorX' | 'anchorY' | 'h' | 'w'>
  variant: number
}

const NATIVE_BUILDING_SAMPLE_Y_OFFSETS = Object.freeze([135, 100, 0, 0])

export function nativeBuildingLightGrid(
  input: NativeBuildingLightGridInput,
): readonly Vec2[] {
  const side = input.enhancedEffects ? 3 : 2
  const yOffset = NATIVE_BUILDING_SAMPLE_Y_OFFSETS[input.variant]
  if (yOffset === undefined) throw new Error(`Unknown native Building selector ${input.variant}`)
  const points: Vec2[] = []
  for (let row = 0; row < side; row += 1) {
    const y = input.position.y - input.sprite.anchorY
      + input.sprite.h * row / (side - 1)
      + (row < side - 1 ? yOffset : 0)
    for (let column = 0; column < side; column += 1) {
      points.push({
        x: input.position.x - input.sprite.anchorX
          + input.sprite.w * column / (side - 1),
        y,
      })
    }
  }
  return points
}

export function nativeBuildingMeshGrid(
  width: number,
  height: number,
  enhancedEffects: boolean,
): NativeBuildingMeshGrid {
  const side = enhancedEffects ? 3 : 2
  const positions = new Float32Array(side * side * 2)
  const uvs = new Float32Array(side * side * 2)
  const indices = new Uint32Array((side - 1) * (side - 1) * 6)
  let vertexOffset = 0
  for (let row = 0; row < side; row += 1) {
    const v = row / (side - 1)
    for (let column = 0; column < side; column += 1) {
      const u = column / (side - 1)
      positions[vertexOffset] = width * u
      positions[vertexOffset + 1] = height * v
      uvs[vertexOffset] = u
      uvs[vertexOffset + 1] = v
      vertexOffset += 2
    }
  }
  let indexOffset = 0
  for (let row = 0; row < side - 1; row += 1) {
    for (let column = 0; column < side - 1; column += 1) {
      const vertex = row * side + column
      indices.set([
        vertex,
        vertex + 1,
        vertex + side,
        vertex + 1,
        vertex + side,
        vertex + side + 1,
      ], indexOffset)
      indexOffset += 6
    }
  }
  return { indices, positions, uvs }
}

export function writeNativeBuildingVertexColors(
  colors: Uint8Array,
  scalars: ArrayLike<number>,
): void {
  if (colors.length !== scalars.length * 4) {
    throw new Error('Native Building color buffer does not match its lighting grid.')
  }
  for (let index = 0; index < scalars.length; index += 1) {
    const lane = Math.trunc(Math.max(0, Math.min(1, scalars[index]!)) * 255)
    const offset = index * 4
    colors[offset] = lane
    colors[offset + 1] = lane
    colors[offset + 2] = lane
    colors[offset + 3] = 255
  }
}
