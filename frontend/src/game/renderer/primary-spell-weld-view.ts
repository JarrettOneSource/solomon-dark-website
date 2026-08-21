import { Container, Graphics, MeshSimple, Sprite } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  isNativeWeldPresentationState,
  nativeWeldVisualPlan,
  type NativeWeldPresentationState,
  type NativeWeldSpriteDraw,
} from './primary-spell-weld-native.ts'
import type {
  NativeWeldTexture,
  PlayerWorldTextures,
} from './world-player-textures.ts'

interface WeldPainterRoot {
  readonly container: Container
  readonly lane: 'world-sorted'
  readonly overlayOwnerId: string
  readonly queueFamily: 'ordinary-dynamic'
  readonly regionLightPoint: Readonly<{ x: number; y: number }> | null
  readonly sortBias: number
  readonly suffix: string
  readonly worldY: number
}

export class WeldPrimarySpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly buildId: NativeWeldPresentationState['buildId']
  private readonly initialKind: NativeWeldPresentationState['kind']
  private readonly lineGraphics: Graphics
  private readonly meshContainer: Container
  private readonly meshes: MeshSimple[] = []
  private plan: ReturnType<typeof nativeWeldVisualPlan>
  private readonly sprites: Sprite[] = []
  private state: NativeWeldPresentationState
  private readonly textures: PlayerWorldTextures['primarySpells']['weldActors']

  constructor(
    state: NativeWeldPresentationState,
    textures: PlayerWorldTextures['primarySpells']['weldActors'],
  ) {
    this.state = state
    this.textures = textures
    this.buildId = state.buildId
    this.initialKind = state.kind
    this.container = new Container({ label: `weld:${state.buildId}:${state.kind}` })
    this.container.eventMode = 'none'
    this.lineGraphics = new Graphics({ label: 'weld:lines' })
    this.lineGraphics.eventMode = 'none'
    this.meshContainer = new Container({ label: 'weld:meshes' })
    this.meshContainer.eventMode = 'none'
    this.container.addChild(this.lineGraphics)
    this.container.addChild(this.meshContainer)
    this.containers = [this.container]
    this.plan = nativeWeldVisualPlan(state)
    this.update(state)
  }

  get kind(): string {
    return `${this.initialKind}:${this.buildId}`
  }

  update(
    state: PrimarySpellProjectileState | PrimarySpellTransientState,
    presentationFrame?: number,
  ): void {
    if (!isNativeWeldPresentationState(state)
      || state.kind !== this.initialKind
      || state.buildId !== this.buildId) return
    this.state = state
    this.plan = nativeWeldVisualPlan(state, presentationFrame)
    this.container.position.set(this.plan.position.x, this.plan.position.y)
    syncSprites(this.container, this.sprites, this.plan.sprites.length)
    for (let index = 0; index < this.plan.sprites.length; index += 1) {
      const draw = this.plan.sprites[index]!
      const registered = this.textures[draw.record]
      if (!registered) throw new Error(`Missing native Weld texture BadGuys:${draw.record}`)
      applySprite(this.sprites[index]!, registered, draw)
    }
    this.lineGraphics.clear()
    for (const draw of this.plan.lines) {
      this.lineGraphics
        .moveTo(draw.start.x, draw.start.y)
        .lineTo(draw.end.x, draw.end.y)
        .stroke({ alpha: draw.alpha, color: draw.color, width: draw.width })
    }
    this.rebuildMeshes()
  }

  painterRoots(): readonly WeldPainterRoot[] {
    if (
      this.plan.sprites.length === 0
      && this.plan.meshes.length === 0
      && this.plan.lines.length === 0
    ) return []
    return [{
      container: this.container,
      lane: 'world-sorted',
      overlayOwnerId: this.state.ownerId,
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: this.plan.regionLightPoint,
      sortBias: this.plan.sortBias,
      suffix: '',
      worldY: this.plan.worldY,
    }]
  }

  setTint(_suffix: string, tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.sprites.length = 0
    this.meshes.length = 0
  }

  private rebuildMeshes(): void {
    for (const mesh of this.meshes) {
      this.meshContainer.removeChild(mesh)
      mesh.destroy()
    }
    this.meshes.length = 0
    for (const draw of this.plan.meshes) {
      const registered = this.textures[draw.record]
      if (!registered) throw new Error(`Missing native Weld mesh texture BadGuys:${draw.record}`)
      const mesh = new MeshSimple({
        indices: new Uint32Array(draw.indices),
        texture: registered.texture,
        topology: 'triangle-list',
        uvs: new Float32Array(draw.uvs),
        vertices: new Float32Array(draw.vertices),
      })
      mesh.alpha = draw.alpha
      mesh.autoUpdate = false
      mesh.blendMode = draw.blend
      mesh.eventMode = 'none'
      mesh.label = `${draw.role}:BadGuys:${draw.record}`
      mesh.tint = draw.tint
      this.meshes.push(mesh)
      this.meshContainer.addChild(mesh)
    }
  }
}

function syncSprites(container: Container, sprites: Sprite[], count: number): void {
  while (sprites.length < count) {
    const sprite = new Sprite()
    sprite.eventMode = 'none'
    sprites.push(sprite)
    container.addChild(sprite)
  }
  while (sprites.length > count) {
    const sprite = sprites.pop()!
    container.removeChild(sprite)
    sprite.destroy()
  }
}

function applySprite(
  target: Sprite,
  registered: NativeWeldTexture,
  draw: NativeWeldSpriteDraw,
): void {
  target.label = `${draw.role}:BadGuys:${draw.record}`
  target.texture = registered.texture
  target.anchor.set(
    registered.anchorX / registered.width,
    registered.anchorY / registered.height,
  )
  target.alpha = draw.alpha
  target.blendMode = draw.blend
  target.position.set(draw.offset.x, draw.offset.y)
  target.rotation = draw.rotationRadians
  target.scale.set(draw.scaleX, draw.scaleY)
  target.tint = draw.tint
}
