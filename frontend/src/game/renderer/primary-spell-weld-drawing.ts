import { Container, Graphics, GraphicsContext, Matrix, Mesh, MeshGeometry, Sprite } from 'pixi.js'

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

  update(plan: NativeWeldVisualPlan): void {
    this.lines.clear()
    for (const draw of plan.lines) {
      this.lines.moveTo(draw.start.x, draw.start.y)
        .lineTo(draw.end.x, draw.end.y)
        .stroke({ alpha: draw.alpha, color: draw.color, width: draw.width })
    }
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
        this.meshes.push(geometry)
      } else {
        updateFloatBuffer(geometry, 'aPosition', draw.vertices)
        updateFloatBuffer(geometry, 'aUV', draw.uvs)
        const indices = geometry.getIndex()
        if (indices.data.length === draw.indices.length) {
          indices.data.set(draw.indices)
          indices.update()
        } else indices.data = new Uint32Array(draw.indices)
      }
    }
  }

  destroy(): void {
    this.lines.destroy()
    for (const geometry of this.meshes) geometry.destroy(true)
    this.meshes.length = 0
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
      let mesh = this.meshes[index]
      if (!mesh) {
        mesh = new Mesh({ geometry: resources.meshes[index]!, texture: registered.texture })
        mesh.eventMode = 'none'
        this.meshes.push(mesh)
        this.meshRoot.addChild(mesh)
      }
      mesh.texture = registered.texture
      mesh.alpha = draw.alpha
      mesh.blendMode = draw.blend
      mesh.label = `${draw.role}:BadGuys:${draw.record}`
      mesh.tint = draw.tint
    }
  }
}

function applySprite(target: Sprite, registered: NativeWeldTexture, draw: NativeWeldSpriteDraw): void {
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
