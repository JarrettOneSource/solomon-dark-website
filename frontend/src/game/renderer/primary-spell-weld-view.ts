import { Container, Graphics } from 'pixi.js'

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
} from './primary-spell-weld-native.ts'
import { WeldDrawingResources, WeldDrawingView } from './primary-spell-weld-drawing.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

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
  private readonly bandMasks: readonly Graphics[]
  private readonly bands: readonly NativeZAnimSplitBand[]
  private readonly boundsY: number
  private readonly initialKind: NativeWeldPresentationState['kind']
  private readonly drawing = new WeldDrawingResources()
  private readonly drawingViews: readonly WeldDrawingView[]
  private plan: ReturnType<typeof nativeWeldVisualPlan>
  private readonly split: boolean
  private state: NativeWeldPresentationState

  constructor(
    state: NativeWeldPresentationState,
    textures: PlayerWorldTextures['primarySpells']['weldActors'],
  ) {
    this.state = state
    this.buildId = state.buildId
    this.initialKind = state.kind
    this.container = new Container({ label: `weld:${state.buildId}:${state.kind}` })
    this.container.eventMode = 'none'
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
    const bandContents = this.bands.map((_, index) => {
      const content = new Container({ label: `weld:split-content:${index}` })
      content.mask = this.bandMasks[index]!
      return content
    })
    this.bandContainers = this.bands.map((_, index) => {
      const root = new Container({ label: `weld:split-band:${index}` })
      root.eventMode = 'none'
      root.addChild(bandContents[index]!, this.bandMasks[index]!)
      return root
    })
    this.drawingViews = (this.split ? bandContents : [this.container]).map(
      root => new WeldDrawingView(root, this.drawing, textures, this.split),
    )
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
    this.drawing.update(this.plan)
    this.container.position.set(this.plan.position.x, this.plan.position.y)
    if (this.split) {
      for (let index = 0; index < this.bandContainers.length; index += 1) {
        const root = this.bandContainers[index]!
        root.position.set(this.plan.position.x, this.plan.position.y)
        this.bandMasks[index]!.position.x = -this.plan.position.x
        this.drawingViews[index]!.update(this.plan, this.drawing)
      }
      return
    }
    this.drawingViews[0]!.update(this.plan, this.drawing)
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
    this.drawing.destroy()
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
