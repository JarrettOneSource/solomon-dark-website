import { MeshSimple, type Texture } from 'pixi.js'
import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'
import { setNativeVertexColors, updateNativeMeshVertexColors } from './native-material-batch.ts'
import { setNativeDiffuseColor } from './native-texture-color.ts'

export type NativeSceneryRgba = readonly [number, number, number, number]
const WHITE: NativeSceneryRgba = [1, 1, 1, 1]
const f32 = Math.fround
const multiply = (a: number, b: number): number => f32(f32(a) * f32(b))
const clamp = (value: number): number => Math.min(1, Math.max(0, value))

function packed(red: number, green: number, blue: number, alpha: number): number {
  const byte = (value: number): number => Math.trunc(f32(value * 255))
  return (byte(red) | byte(green) << 8 | byte(blue) << 16 | byte(alpha) << 24) >>> 0
}

/** Retail 608480/41eae0: only Tree's strict <.5 branch applies whole color twice. */
export function writeNativeSceneryGlyphColors(
  colors: Uint32Array,
  treeAlpha: number | null,
  callback: NativeSceneryRgba,
  whole: NativeSceneryRgba = WHITE,
): boolean {
  const gradient = treeAlpha !== null && treeAlpha < .5
  let red = multiply(whole[0], callback[0])
  let green = multiply(whole[1], callback[1])
  let blue = multiply(whole[2], callback[2])
  let bottomAlpha = multiply(whole[3], callback[3])
  let topAlpha = bottomAlpha
  if (gradient) {
    red = multiply(whole[0], red)
    green = multiply(whole[1], green)
    blue = multiply(whole[2], blue)
    topAlpha = multiply(whole[3], multiply(treeAlpha, .5))
    bottomAlpha = multiply(whole[3], bottomAlpha)
  }
  const top = packed(red, green, blue, topAlpha)
  const bottom = packed(red, green, blue, bottomAlpha)
  let changed = false
  for (let vertex = 0; vertex < 4; vertex += 1) {
    const value = vertex < 2 ? top : bottom
    if (colors[vertex] === value) continue
    colors[vertex] = value
    changed = true
  }
  return changed
}

export interface NativeSceneryGlyphRedraw {
  readonly display: MeshSimple
  readonly colors: Uint32Array
  update(hitAlpha: number, complexLighting: boolean): void
  destroy(): void
}

export interface NativeSceneryGlyphMaterial {
  readonly mesh: MeshSimple
  readonly colors: Uint32Array
  readonly tree: boolean
  readonly alpha: number
  readonly ordinaryLightScalar: number
  readonly hitRootLightScalar: number
  update(alpha: number, ordinaryLightScalar: number, hitRootLightScalar: number,
    objectColor?: readonly [number, number, number]): void
  createHitRedraw(): NativeSceneryGlyphRedraw
  destroy(): void
}

/** Original glyph quad; the Texture is borrowed and never regenerated or destroyed. */
function glyph(texture: Texture, width: number, height: number): {
  mesh: MeshSimple
  colors: Uint32Array
  destroy(): void
} {
  const mesh = new MeshSimple({
    texture,
    vertices: new Float32Array([0, 0, width, 0, width, height, 0, height]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    topology: 'triangle-list',
  })
  mesh.autoUpdate = false
  mesh.eventMode = 'none'
  const colors = new Uint32Array(4)
  setNativeVertexColors(mesh, colors)
  let destroyed = false
  return { mesh, colors, destroy() {
    if (destroyed) return
    destroyed = true
    const geometry = mesh.geometry
    mesh.destroy()
    destroyOwnedMeshGeometry({ geometry })
  } }
}

/** Identity group color lets each ordinary/hit draw own its native callback RGBA. */
export function createNativeSceneryGlyphMaterial(
  texture: Texture, width: number, height: number, tree: boolean,
): NativeSceneryGlyphMaterial {
  const main = glyph(texture, width, height)
  const hits = new Set<NativeSceneryGlyphRedraw>()
  let alpha = 1
  let ordinaryLightScalar = 1
  let hitRootLightScalar = 1
  let destroyed = false
  const material: NativeSceneryGlyphMaterial = {
    mesh: main.mesh,
    colors: main.colors,
    tree,
    get alpha() { return alpha },
    get ordinaryLightScalar() { return ordinaryLightScalar },
    get hitRootLightScalar() { return hitRootLightScalar },
    update(nextAlpha, nextOrdinaryLightScalar, nextHitRootLightScalar, objectColor = [1, 1, 1]) {
      alpha = f32(nextAlpha)
      ordinaryLightScalar = f32(nextOrdinaryLightScalar)
      hitRootLightScalar = f32(nextHitRootLightScalar)
      const callback: NativeSceneryRgba = [
        clamp(multiply(ordinaryLightScalar, objectColor[0])),
        clamp(multiply(ordinaryLightScalar, objectColor[1])),
        clamp(multiply(ordinaryLightScalar, objectColor[2])),
        1,
      ]
      if (writeNativeSceneryGlyphColors(main.colors, tree ? alpha : null, callback)) {
        updateNativeMeshVertexColors(main.mesh)
      }
    },
    createHitRedraw() {
      const hit = glyph(texture, width, height)
      setNativeDiffuseColor(hit.mesh, true)
      const redraw: NativeSceneryGlyphRedraw = {
        display: hit.mesh,
        colors: hit.colors,
        update(hitAlpha, complexLighting) {
          const light = complexLighting ? hitRootLightScalar : 1
          const callback: NativeSceneryRgba = [
            multiply(complexLighting ? f32(.65) : 1, light), 0, 0,
            multiply(hitAlpha, light),
          ]
          if (writeNativeSceneryGlyphColors(hit.colors, tree ? alpha : null, callback)) {
            updateNativeMeshVertexColors(hit.mesh)
          }
        },
        destroy() { hits.delete(redraw); hit.destroy() },
      }
      hits.add(redraw)
      return redraw
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const hit of hits) hit.destroy()
      main.destroy()
    },
  }
  material.update(1, 1, 1)
  return material
}
