import { Container, Graphics, Matrix, MeshSimple, Sprite } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { NATIVE_BROWSER_ENHANCED_EFFECTS } from '../game-settings.ts'
import {
  buildNativeZAnimSplitBands,
  type NativeZAnimSplitBand,
} from '../native-zanim-split.ts'
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
  readonly insertions?: readonly Readonly<{
    sortBias: number
    suffix: string
    visible: boolean
    worldY: number
  }>[]
  readonly lane: 'world-sorted'
  readonly overlayOwnerId: string
  readonly queueFamily: 'ordinary-dynamic'
  readonly regionLightPoint: Readonly<{ x: number; y: number }> | null
  readonly sortBias: number
  readonly suffix: string
  readonly visible?: boolean
  readonly worldY: number
}

export class WeldPrimarySpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly buildId: NativeWeldPresentationState['buildId']
  private readonly bandContainers: readonly Container[]
  private readonly bandContents: readonly Container[]
  private readonly bandMasks: readonly Graphics[]
  private readonly bands: readonly NativeZAnimSplitBand[]
  private readonly boundsY: number
  private readonly initialKind: NativeWeldPresentationState['kind']
  private readonly lineGraphics: Graphics
  private readonly meshContainer: Container
  private readonly meshes: MeshSimple[] = []
  private plan: ReturnType<typeof nativeWeldVisualPlan>
  private readonly sprites: Sprite[] = []
  private readonly split: boolean
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
    this.plan = nativeWeldVisualPlan(state)
    this.split = state.kind === 'weld-channel'
      && (state.buildId === 1003 || state.buildId === 1004)
    const bounds = weldPlanBounds(this.plan, textures)
    this.boundsY = bounds.y
    this.bands = this.split
      ? buildNativeZAnimSplitBands(
          `weld:${state.id}`,
          bounds,
          NATIVE_BROWSER_ENHANCED_EFFECTS,
        )
      : Object.freeze([])
    this.bandMasks = this.bands.map((band) => new Graphics()
      .rect(0, band.clip.y, band.clip.width, band.clip.height)
      .fill(0xffffff))
    this.bandContents = this.bands.map((_, index) => {
      const content = new Container({ label: `weld:split-content:${index}` })
      content.mask = this.bandMasks[index]!
      return content
    })
    this.bandContainers = this.bands.map((_, index) => {
      const root = new Container({ label: `weld:split-band:${index}` })
      root.eventMode = 'none'
      root.addChild(this.bandContents[index]!, this.bandMasks[index]!)
      return root
    })
    if (!this.split) {
      this.container.addChild(this.lineGraphics)
      this.container.addChild(this.meshContainer)
    }
    this.containers = Object.freeze([this.container, ...this.bandContainers])
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
    if (this.split) {
      this.container.position.set(this.plan.position.x, this.plan.position.y)
      for (let index = 0; index < this.bandContainers.length; index += 1) {
        const root = this.bandContainers[index]!
        root.position.set(this.plan.position.x, this.plan.position.y)
        this.bandMasks[index]!.position.x = -this.plan.position.x
        renderWeldPlan(
          this.bandContents[index]!,
          this.plan,
          this.textures,
        )
      }
      return
    }
    this.container.position.set(this.plan.position.x, this.plan.position.y)
    syncSprites(this.container, this.sprites, this.plan.sprites.length)
    for (let index = 0; index < this.plan.sprites.length; index += 1) {
      const draw = this.plan.sprites[index]!
      const registered = this.textures[draw.atlas][draw.record]
      if (!registered) {
        throw new Error(`Missing native Weld texture ${draw.atlas}:${draw.record}`)
      }
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
    if (this.split) {
      return [{
        container: this.container,
        insertions: this.bands.map((band, index) => ({
          sortBias: 0,
          suffix: `band-${index}`,
          visible: true,
          worldY: this.plan.position.y + band.painterY,
        })),
        lane: 'world-sorted',
        overlayOwnerId: this.state.ownerId,
        queueFamily: 'ordinary-dynamic',
        regionLightPoint: this.plan.regionLightPoint,
        sortBias: 0,
        suffix: '',
        visible: false,
        worldY: this.plan.position.y + this.boundsY,
      }]
    }
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
    const band = this.painterContainer(_suffix)
    if (band) {
      band.tint = tint
      return
    }
    this.container.tint = tint
  }

  painterContainer(suffix: string): Container | null {
    if (!suffix.startsWith('band-')) return null
    const index = Number(suffix.slice('band-'.length))
    return Number.isSafeInteger(index) ? this.bandContainers[index] ?? null : null
  }

  destroy(): void {
    for (const container of this.containers) container.destroy({ children: true })
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
      const registered = this.textures.BadGuys[draw.record]
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

function renderWeldPlan(
  container: Container,
  plan: ReturnType<typeof nativeWeldVisualPlan>,
  textures: PlayerWorldTextures['primarySpells']['weldActors'],
): void {
  for (const child of container.removeChildren()) child.destroy()
  for (const draw of plan.sprites) {
    const registered = textures[draw.atlas][draw.record]
    if (!registered) throw new Error(`Missing native Weld texture ${draw.atlas}:${draw.record}`)
    const sprite = new Sprite()
    sprite.eventMode = 'none'
    applySprite(sprite, registered, draw)
    container.addChild(sprite)
  }
  if (plan.lines.length > 0) {
    const graphics = new Graphics({ label: 'weld:split-lines' })
    graphics.eventMode = 'none'
    for (const draw of plan.lines) {
      graphics
        .moveTo(draw.start.x, draw.start.y)
        .lineTo(draw.end.x, draw.end.y)
        .stroke({ alpha: draw.alpha, color: draw.color, width: draw.width })
    }
    container.addChild(graphics)
  }
  for (const draw of plan.meshes) {
    const registered = textures.BadGuys[draw.record]
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
    container.addChild(mesh)
  }
}

function weldPlanBounds(
  plan: ReturnType<typeof nativeWeldVisualPlan>,
  textures: PlayerWorldTextures['primarySpells']['weldActors'],
): { height: number; y: number } {
  const ys: number[] = []
  for (const draw of plan.meshes) {
    for (let index = 1; index < draw.vertices.length; index += 2) {
      ys.push(draw.vertices[index]!)
    }
  }
  for (const draw of plan.lines) {
    const halfWidth = draw.width / 2
    ys.push(draw.start.y - halfWidth, draw.start.y + halfWidth)
    ys.push(draw.end.y - halfWidth, draw.end.y + halfWidth)
  }
  for (const draw of plan.sprites) {
    const registered = textures[draw.atlas][draw.record]
    if (!registered) continue
    const corners = [
      { x: -registered.anchorX, y: -registered.anchorY },
      { x: registered.width - registered.anchorX, y: -registered.anchorY },
      { x: -registered.anchorX, y: registered.height - registered.anchorY },
      {
        x: registered.width - registered.anchorX,
        y: registered.height - registered.anchorY,
      },
    ]
    for (const corner of corners) {
      if (draw.matrix) {
        ys.push(
          draw.matrix.b * corner.x
          + draw.matrix.d * corner.y
          + draw.matrix.ty,
        )
        continue
      }
      const x = corner.x * draw.scaleX
      const y = corner.y * draw.scaleY
      ys.push(
        draw.offset.y
        + Math.sin(draw.rotationRadians) * x
        + Math.cos(draw.rotationRadians) * y,
      )
    }
  }
  if (ys.length === 0) return { height: 0, y: 0 }
  const minimum = Math.min(...ys)
  const maximum = Math.max(...ys)
  return { height: maximum - minimum, y: minimum }
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
  target.label = `${draw.role}:${draw.atlas}:${draw.record}`
  target.texture = registered.texture
  target.anchor.set(
    registered.anchorX / registered.width,
    registered.anchorY / registered.height,
  )
  target.alpha = draw.alpha
  target.blendMode = draw.blend
  if (draw.matrix) {
    target.setFromMatrix(new Matrix(
      draw.matrix.a,
      draw.matrix.b,
      draw.matrix.c,
      draw.matrix.d,
      draw.matrix.tx,
      draw.matrix.ty,
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
