import { setNativeDiffuseColor } from './native-texture-color.ts'
import { Container, Graphics, GraphicsContext, Matrix, Mesh, MeshGeometry, Sprite, Texture } from 'pixi.js'
import { setNativeVertexColors } from './native-material-batch.ts'

import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'
import type {
  NativeWeldSpriteDraw,
  NativeWeldVisualPlan,
} from './primary-spell-weld-native.ts'
import type { NativeWeldTexture, PlayerWorldTextures } from './world-player-textures.ts'

type WeldTextures = PlayerWorldTextures['primarySpells']['weldActors']

/** One semantic drawing, shared by its clipped views until the actor retires. */
export class WeldDrawingResources {
  readonly lines = new GraphicsContext()
  readonly meshes: MeshGeometry[] = []
  readonly colors: (Uint32Array | undefined)[] = []
  private readonly atlasPages = new Map<Texture['source'], Texture>()
  private lastMeshPlan: NativeWeldVisualPlan['meshes'] | null = null

  update(plan: NativeWeldVisualPlan): void {
    this.lines.clear()
    for (const draw of plan.lines) {
      this.lines.moveTo(draw.start.x, draw.start.y)
        .lineTo(draw.end.x, draw.end.y)
        .stroke({ alpha: draw.alpha, color: draw.color, width: draw.width })
    }
    if (this.lastMeshPlan === plan.meshes) return
    this.lastMeshPlan = plan.meshes
    for (let index = 0; index < plan.meshes.length; index += 1) {
      const draw = plan.meshes[index]!
      let geometry = this.meshes[index]
      if (!geometry) {
        geometry = new MeshGeometry({
          indices: new Uint32Array(draw.indices),
          positions: new Float32Array(draw.vertices),
          topology: 'triangle-list',
          uvs: new Float32Array(draw.uvs),
        })
        if (draw.colors) geometry.getIndex().data = new Uint16Array(draw.indices)
        this.meshes.push(geometry)
      } else {
        updateFloatBuffer(geometry, 'aPosition', draw.vertices)
        updateFloatBuffer(geometry, 'aUV', draw.uvs)
        const indices = geometry.getIndex()
        if (indices.data.length === draw.indices.length) {
          indices.data.set(draw.indices)
          indices.update()
        } else indices.data = draw.colors ? new Uint16Array(draw.indices) : new Uint32Array(draw.indices)
      }
      const previous = this.colors[index]
      if (draw.colors) {
        if (previous?.length === draw.colors.length) previous.set(draw.colors)
        else this.colors[index] = new Uint32Array(draw.colors)
      } else if (previous) {
        this.colors[index] = new Uint32Array(draw.vertices.length / 2).fill(0xffffffff)
      }
    }
  }

  /** Absolute record-25 UVs must bypass the framed glyph's second UV mapping. */
  atlasPage(registered: Texture): Texture {
    const source = registered.source
    if (source.width !== 2048 || source.height !== 2048) {
      throw new RangeError('Native Flame ribbon requires the original 2048-square BadGuys atlas page')
    }
    let page = this.atlasPages.get(source)
    if (!page) {
      page = new Texture({ source })
      this.atlasPages.set(source, page)
    }
    return page
  }

  destroy(): void {
    this.lines.destroy()
    for (const geometry of this.meshes) destroyOwnedMeshGeometry({ geometry })
    this.meshes.length = 0
    this.colors.length = 0
    for (const page of this.atlasPages.values()) page.destroy(false)
    this.atlasPages.clear()
  }
}

function updateFloatBuffer(
  geometry: MeshGeometry,
  name: 'aPosition' | 'aUV',
  values: readonly number[],
): void {
  const buffer = geometry.getBuffer(name)
  if (buffer.data.length === values.length) {
    buffer.data.set(values)
    buffer.update()
  } else buffer.data = new Float32Array(values)
}

/** Owns only display objects; geometry and line context belong to the drawing. */
export class WeldDrawingView {
  private readonly graphics: Graphics
  private readonly meshes: Mesh[] = []
  private readonly meshRoot: Container
  private readonly root: Container
  private readonly split: boolean
  private readonly sprites: Sprite[] = []
  private readonly textures: WeldTextures

  constructor(root: Container, resources: WeldDrawingResources, textures: WeldTextures, split: boolean) {
    this.root = root
    this.textures = textures
    this.split = split
    this.graphics = new Graphics({
      context: resources.lines,
      label: split ? 'weld:split-lines' : 'weld:lines',
    })
    this.graphics.eventMode = 'none'
    this.meshRoot = split ? root : new Container({ label: 'weld:meshes' })
    this.meshRoot.eventMode = 'none'
    root.addChild(this.graphics)
    if (!split) root.addChild(this.meshRoot)
  }

  update(plan: NativeWeldVisualPlan, resources: WeldDrawingResources): void {
    while (this.sprites.length > plan.sprites.length) this.sprites.pop()!.destroy()
    for (let index = 0; index < plan.sprites.length; index += 1) {
      const draw = plan.sprites[index]!
      const registered = this.textures[draw.atlas][draw.record]
      if (!registered) throw new Error(`Missing native Weld texture ${draw.atlas}:${draw.record}`)
      let sprite = this.sprites[index]
      if (!sprite) {
        sprite = new Sprite()
        sprite.eventMode = 'none'
        this.sprites.push(sprite)
        if (this.split) this.root.addChildAt(sprite, index)
        else this.root.addChild(sprite)
      }
      applySprite(sprite, registered, draw)
    }
    this.graphics.visible = plan.lines.length > 0
    while (this.meshes.length > plan.meshes.length) this.meshes.pop()!.destroy()
    for (let index = 0; index < plan.meshes.length; index += 1) {
      const draw = plan.meshes[index]!
      const registered = this.textures.BadGuys[draw.record]
      if (!registered) throw new Error(`Missing native Weld mesh texture BadGuys:${draw.record}`)
      const texture = draw.uvSpace === 'badguys-atlas' ? resources.atlasPage(registered.texture) : registered.texture
      let mesh = this.meshes[index]
      if (!mesh) {
        mesh = new Mesh({ geometry: resources.meshes[index]!, texture })
        mesh.eventMode = 'none'
        this.meshes.push(mesh)
        this.meshRoot.addChild(mesh)
      }
      mesh.texture = texture
      const colors = resources.colors[index]
      if (colors) setNativeVertexColors(mesh, colors)
      mesh.alpha = draw.alpha
      mesh.blendMode = draw.blend
      mesh.label = `${draw.role}:BadGuys:${draw.record}`
      mesh.tint = draw.tint
    }
  }
}

function applySprite(target: Sprite, registered: NativeWeldTexture, draw: NativeWeldSpriteDraw): void {
  setNativeDiffuseColor(target, draw.textureColor === 'diffuse')
  target.label = `${draw.role}:${draw.atlas}:${draw.record}`
  target.texture = registered.texture
  target.anchor.set(registered.anchorX / registered.width, registered.anchorY / registered.height)
  target.alpha = draw.alpha
  target.blendMode = draw.blend
  if (draw.matrix) {
    target.setFromMatrix(new Matrix(
      draw.matrix.a, draw.matrix.b, draw.matrix.c, draw.matrix.d, draw.matrix.tx, draw.matrix.ty,
    ))
  } else {
    target.position.set(draw.offset.x, draw.offset.y)
    target.pivot.set(0)
    target.rotation = draw.rotationRadians
    target.scale.set(draw.scaleX, draw.scaleY)
    target.skew.set(0)
  }
  target.tint = draw.tint
}
