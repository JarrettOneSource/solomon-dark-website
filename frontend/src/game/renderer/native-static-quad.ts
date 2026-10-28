import { MeshSimple, type Texture } from 'pixi.js'
import type { NativeTexturedQuad } from '../../editor/native-fence-geometry.ts'

/** Retain the native indexed quad; Canvas clips would antialias its internal diagonal. */
export function createNativeStaticQuad(texture: Texture, quad: NativeTexturedQuad): MeshSimple {
  const mesh = new MeshSimple({ texture,
    vertices: new Float32Array([quad.p0.x, quad.p0.y, quad.p1.x, quad.p1.y,
      quad.p2.x, quad.p2.y, quad.p3.x, quad.p3.y]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    indices: new Uint32Array([0, 1, 2, 2, 1, 3]), topology: 'triangle-list',
  })
  mesh.autoUpdate = false
  mesh.eventMode = 'none'
  return mesh
}
