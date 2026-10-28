import { Container, Graphics } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
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

export interface NativeFlameRegionView {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Retained 0x5E0275–0x5E0315: intersected initial Y, original padded loop
 * progress, full 25/50 bands. The draw mask separately preserves Region clip.
 */
export function buildNativeFlameLashSplitBands(
  ownerId: string,
  bounds: NativeFlameRegionView,
  enhancedEffects: boolean,
  regionView: NativeFlameRegionView | null = null,
): readonly NativeZAnimSplitBand[] {
  if (!ownerId || !Object.values(bounds).every(Number.isFinite) || bounds.width < 0 || bounds.height < 0
    || (regionView && (!Object.values(regionView).every(Number.isFinite) || regionView.width < 0 || regionView.height < 0))) {
    throw new RangeError('Flame split requires finite nonnegative bounds and Region view')
  }
  const height = enhancedEffects ? 25 : 50
  let y = Math.fround(regionView ? Math.max(bounds.y, regionView.y) : bounds.y)
  const bands: NativeZAnimSplitBand[] = []
  for (let progress = bounds.y; progress < bounds.y + bounds.height; progress = Math.fround(progress + height)) {
    if (Math.fround(progress + height) <= progress || bands.length >= 32_768) {
      throw new RangeError('Flame split exceeds its finite band progression budget')
    }
    bands.push({ id: `${ownerId}:band-${bands.length}`,
      clip: { x: 0, y, width: 10_000, height }, painterY: Math.fround(y + height) })
    y = Math.fround(y + height)
  }
  return bands
}

function regionClippedBand(band: NativeZAnimSplitBand, region: NativeFlameRegionView | null): NativeFlameRegionView {
  if (!region) return band.clip
  const x = Math.max(band.clip.x, region.x)
  const y = Math.max(band.clip.y, region.y)
  return { x, y,
    width: Math.max(0, Math.min(band.clip.x + band.clip.width, region.x + region.width) - x),
    height: Math.max(0, Math.min(band.clip.y + band.clip.height, region.y + region.height) - y) }
}

export class WeldPrimarySpellView {
  readonly container: Container
  readonly underlayContainer?: Container
  readonly containers: readonly Container[]
  private readonly buildId: NativeWeldPresentationState['buildId']
  private readonly bandContainers: readonly Container[]
  private readonly bandMasks: readonly Graphics[]
  private bands: readonly NativeZAnimSplitBand[]
  private enhancedEffects: boolean
  private regionView: NativeFlameRegionView | null = null
  private readonly retainedFlamePlan: ReturnType<typeof nativeWeldVisualPlan> | null
  private readonly boundsY: number
  private readonly initialKind: NativeWeldPresentationState['kind']
  private readonly drawing = new WeldDrawingResources()
  private readonly drawingViews: readonly WeldDrawingView[]
  private readonly underlayView: WeldDrawingView | null
  private puppetHit = false
  private plan: ReturnType<typeof nativeWeldVisualPlan>
  private readonly split: boolean
  private state: NativeWeldPresentationState

  constructor(
    state: NativeWeldPresentationState,
    textures: PlayerWorldTextures['primarySpells']['weldActors'],
    enhancedEffects = true,
  ) {
    this.state = state
    this.buildId = state.buildId
    this.initialKind = state.kind
    this.enhancedEffects = enhancedEffects
    this.container = new Container({ label: `weld:${state.buildId}:${state.kind}` })
    this.container.eventMode = 'none'
    this.plan = nativeWeldVisualPlan(state)
    this.retainedFlamePlan = state.kind === 'weld-channel' && state.buildId === 1003 ? this.plan : null
    this.split = state.kind === 'weld-channel'
      && (state.buildId === 1003 || state.buildId === 1004)
    const bounds = this.plan.splitBounds ?? weldPlanBounds(this.plan, textures)
    this.boundsY = bounds.y
    // Allocate the maximal Enhanced band pool once; live coarse/Enhanced
    // switches only change masks and painter insertions, never birth geometry.
    this.bands = this.retainedFlamePlan?.splitBounds
      ? buildNativeFlameLashSplitBands(`weld:${state.id}`, this.retainedFlamePlan.splitBounds, true)
      : this.split
      ? buildNativeZAnimSplitBands(
          `weld:${state.id}`,
          bounds,
          enhancedEffects,
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
    if (state.kind === 'weld-meteor'
      || (state.kind === 'weld-impact' && state.buildId === 1001 && state.vector[6]! > 0)) {
      this.underlayContainer = new Container({ label: 'weld-pre-world-pass', eventMode: 'none' })
    }
    this.underlayView = this.underlayContainer === undefined ? null
      : new WeldDrawingView(this.underlayContainer, this.drawing, textures, false)
    this.containers = Object.freeze([this.container, ...this.bandContainers])
    this.update(state)
  }

  get kind(): string {
    return `${this.initialKind}:${this.buildId}`
  }

  update(
    state: PrimarySpellProjectileState | PrimarySpellTransientState,
    presentationFrame?: number,
    _pointGain?: number,
    enhancedEffects = this.enhancedEffects,
  ): void {
    if (!isNativeWeldPresentationState(state)
      || state.kind !== this.initialKind
      || state.buildId !== this.buildId) return
    this.state = state
    this.enhancedEffects = enhancedEffects
    this.plan = this.retainedFlamePlan !== null
      ? state.kind === 'weld-channel' && state.flameVisual?.kind === 'native-birth-v1' && state.ageTicks < 1
        ? this.retainedFlamePlan
        : { ...this.retainedFlamePlan, meshes: [], sprites: [], lines: [] }
      : nativeWeldVisualPlan(state, presentationFrame, this.puppetHit)
    if (this.retainedFlamePlan?.splitBounds) {
      this.bands = buildNativeFlameLashSplitBands(
        `weld:${state.id}`, this.retainedFlamePlan.splitBounds, enhancedEffects, this.regionView,
      )
    }
    this.drawing.update(this.plan)
    this.container.position.set(this.plan.position.x, this.plan.position.y)
    if (this.underlayContainer) {
      this.underlayContainer.position.set(this.plan.position.x, this.plan.position.y)
      this.underlayView!.update({ ...this.plan, sprites: this.plan.underlays ?? [], lines: [], meshes: [] }, this.drawing)
    }
    if (this.split) {
      for (let index = 0; index < this.bandContainers.length; index += 1) {
        const root = this.bandContainers[index]!
        const band = this.bands[index]
        const clip = band && regionClippedBand(band, this.retainedFlamePlan ? this.regionView : null)
        root.renderable = !!clip && clip.width > 0 && clip.height > 0
        if (clip && this.retainedFlamePlan) {
          this.bandMasks[index]!.clear().rect(clip.x, clip.y, clip.width, clip.height).fill(0xffffff)
        }
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
          visible: this.bandContainers[index]!.renderable,
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

  setPuppetHit(active: boolean): void { this.puppetHit = active }

  setRegionView(regionView: NativeFlameRegionView | null): void {
    this.regionView = regionView
  }

  painterContainer(suffix: string): Container | null {
    if (!suffix.startsWith('band-')) return null
    const index = Number(suffix.slice('band-'.length))
    return Number.isSafeInteger(index) ? this.bandContainers[index] ?? null : null
  }

  destroy(): void {
    this.underlayContainer?.destroy({ children: true })
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
