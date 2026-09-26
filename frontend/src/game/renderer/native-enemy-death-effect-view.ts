import { Color, Container, FillGradient, Graphics, Matrix, Sprite, type ICanvas, type Texture } from 'pixi.js'

import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import type { PositionedNativeRegionPainterLayer } from '../region-painter-order.ts'
import { boneyardResidentIsVisible } from './boneyard-render-contract.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { NativeDeathEffectMeshRuns, type NativeDeathEffectMeshSample } from './native-death-effect-mesh-runs.ts'
import { nativePackedColor } from './native-material-batch.ts'
import {
  nativeEnemyDeathEffectIsBanish,
  nativeEnemyDeathEffectPainterLane,
  nativeEnemyDeathEffectPainterLayer,
  nativeEnemyDeathEffectVerticalScale,
  nativeEnemyDeathEffectViewResourcePlan,
  nativeEnemyDeathEffectVisualBounds,
} from './native-enemy-death-effect-presentation.ts'
import { nativeLootSpriteRecord } from './native-loot-assets.ts'

// Measured crossover for a large native Faculty population; small removals
// avoid rebuilding an otherwise unchanged parent's child list.
const MIN_BATCH_RETIREMENT = 512

// Used synchronously while packing one retained mesh quad.
const deathEffectMeshTransform = new Matrix()

export class NativeEnemyDeathEffectViews {
  private readonly directViews: NativeEnemyDeathEffectView[] = []
  private updateMark = false
  private readonly meshRuns: NativeDeathEffectMeshRuns
  private readonly root: Container
  private readonly preWorldRoot: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyDeathEffectView>()
  private readonly visibleWorldLayers: DynamicPainterLayer[] = []
  private readonly worldViews = new Map<string, NativeEnemyDeathEffectView>()
  private readonly worldSamples: NativeDeathEffectMeshSample[] = []
  private visibleCount = 0

  constructor(root: Container, textures: BoneyardWorldTextures, preWorldRoot: Container) {
    this.root = root
    this.preWorldRoot = preWorldRoot
    this.textures = textures
    this.meshRuns = new NativeDeathEffectMeshRuns(root)
  }

  update(
    effects: readonly BoneyardEnemyDeathEffectSnapshot[],
    visibleBounds: Readonly<BoneyardBounds>,
    viewHeight: number,
  ): void {
    this.updateMark = !this.updateMark
    this.directViews.length = 0
    this.visibleWorldLayers.length = 0
    this.visibleCount = 0
    for (const effect of effects) {
      let view = this.views.get(effect.id)
      if (!view) {
        view = new NativeEnemyDeathEffectView(
          (effect.presentationOwner === 'pre-world-queue' || effect.presentationOwner === 'background') ? this.preWorldRoot : this.root,
          this.textures,
          effect,
        )
        this.views.set(effect.id, view)
        if (effect.presentationOwner === 'world-sorted') {
          this.worldViews.set(`enemy-death-effect:${effect.id}`, view)
        }
      }
      view.updateMark = this.updateMark
      if (view.update(effect, visibleBounds, viewHeight)) {
        this.visibleCount += 1
        if (view.worldPainterLayer) this.visibleWorldLayers.push(view.worldPainterLayer)
        else this.directViews.push(view)
      }
    }
    const retired: NativeEnemyDeathEffectView[] = []
    for (const view of this.views.values()) {
      if (view.updateMark === this.updateMark) continue
      retired.push(view)
      this.views.delete(view.id)
      this.worldViews.delete(`enemy-death-effect:${view.id}`)
    }
    this.destroyViews(retired)
  }

  setDepth(id: number, depth: number): void {
    this.views.get(id)?.setDepth(depth)
  }

  /** Retained records consumed synchronously before the next update. */
  painterLayers(): readonly DynamicPainterLayer[] {
    return this.visibleWorldLayers
  }

  applyPainterDepths(layers: readonly PositionedNativeRegionPainterLayer[], foregroundZIndex: number): void {
    this.worldSamples.length = 0
    for (const layer of layers) {
      const view = this.worldViews.get(layer.id)
      if (!view?.visible) continue
      view.setDepth(layer.zIndex)
      if (view.meshSample) this.worldSamples.push(view.meshSample)
    }
    for (const view of this.directViews) {
      view.setDepth(view.painterLane === 'background' ? 0
        : view.painterLane === 'pre-world-queue' ? .5
        : view.painterLane === 'late-world-overlay' ? foregroundZIndex + 1
        : foregroundZIndex + .25)
    }
    this.meshRuns.update(this.worldSamples)
  }

  isVisible(id: number): boolean {
    return this.views.get(id)?.visible ?? false
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) view.setRenderable(renderable)
    this.meshRuns.setRenderable(renderable)
  }

  get size(): number {
    return this.views.size
  }

  get visibleSize(): number {
    return this.visibleCount
  }

  destroy(): void {
    this.destroyViews([...this.views.values()])
    this.meshRuns.destroy()
    this.views.clear()
    this.directViews.length = 0
    this.visibleWorldLayers.length = 0
    this.worldViews.clear()
    this.worldSamples.length = 0
    this.visibleCount = 0
  }

  private destroyViews(views: readonly NativeEnemyDeathEffectView[]): void {
    if (views.length >= MIN_BATCH_RETIREMENT) {
      const byRoot = new Map<Container, Set<Container>>()
      for (const view of views) {
        const container = view.container
        const root = container?.parent
        if (!container || !root) continue
        let retired = byRoot.get(root)
        if (!retired) { retired = new Set(); byRoot.set(root, retired) }
        retired.add(container)
      }
      for (const [root, retired] of byRoot) {
        if (retired.size < MIN_BATCH_RETIREMENT) continue
        // Pixi removes individual siblings with indexOf/splice. Detach once,
        // then restore survivors in their exact order before rendering resumes.
        const survivors = root.children.filter(child => !retired.has(child))
        root.removeChildren()
        for (const child of survivors) root.addChild(child)
      }
    }
    for (const view of views) view.destroy()
  }
}

class NativeEnemyDeathEffectView {
  private readonly batched: boolean
  private banishGraphics: Graphics | null = null
  private banishSprites: readonly Sprite[] = []
  private bounds: BoneyardBounds | null = null
  private boundsEntry = -1
  private boundsHeight = Number.NaN
  private boundsPositionX = Number.NaN
  private boundsPositionY = Number.NaN
  private boundsRotation = Number.NaN
  private boundsScale = Number.NaN
  private boundsScaleY = Number.NaN
  container: Container | null
  private effect: Sprite | null = null
  private gradientIndex = 0
  private readonly gradients: FillGradient[] = []
  private readonly kind: BoneyardEnemyDeathEffectSnapshot['kind']
  private readonly directSprite: boolean
  private meshTransformDirty = true
  private resourcesCreated = false
  private shadow: Sprite | null = null
  private readonly shadowed: boolean
  private readonly textures: BoneyardWorldTextures
  readonly id: number
  meshSample: NativeDeathEffectMeshSample | null = null
  readonly painterLane: ReturnType<typeof nativeEnemyDeathEffectPainterLane>
  updateMark = false
  worldPainterLayer: DynamicPainterLayer | null = null
  visible = false

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    initial: BoneyardEnemyDeathEffectSnapshot,
  ) {
    this.textures = textures
    this.id = initial.id
    this.painterLane = nativeEnemyDeathEffectPainterLane(initial)
    this.kind = initial.kind
    this.shadowed = !nativeEnemyDeathEffectIsBanish(initial.kind) && initial.shadow
    this.directSprite = !this.shadowed && !nativeEnemyDeathEffectIsBanish(initial.kind)
    this.batched = this.directSprite && initial.presentationOwner === 'world-sorted'
    // Keep native painter insertion order even for equal-depth background
    // effects that enter the camera in a different order than their birth.
    const label = `enemy-death-effect:${initial.kind}:${initial.id}`
    if (this.batched) {
      // World singles have planner-owned order, so unseen effects need no Pixi node.
      this.container = null
    } else if (this.directSprite) {
      const sprite = new Sprite({ label })
      this.container = sprite
      this.effect = sprite
      this.resourcesCreated = true
    } else {
      this.container = new Container({ label })
    }
    if (this.container) {
      this.container.eventMode = 'none'
      root.addChild(this.container)
    }
  }

  private ensureResources(): Container {
    if (this.resourcesCreated) return this.container!
    const resources = nativeEnemyDeathEffectViewResourcePlan({ kind: this.kind, shadow: this.shadowed })
    this.banishGraphics = resources.banishGraphics
      ? new Graphics({ label: 'enemy-banish-gradients' })
      : null
    this.banishSprites = Array.from(
      { length: resources.banishSprites },
      () => new Sprite(),
    )
    this.effect = resources.effectSprite ? new Sprite() : null
    this.shadow = resources.shadowSprite ? new Sprite() : null
    const container = this.container!
    if (this.effect) this.effect.eventMode = 'none'
    if (this.shadow) this.shadow.eventMode = 'none'
    if (this.banishGraphics) this.banishGraphics.eventMode = 'none'
    for (const sprite of this.banishSprites) sprite.eventMode = 'none'
    if (this.shadow) container.addChild(this.shadow)
    if (this.effect) container.addChild(this.effect)
    if (this.banishGraphics) container.addChild(this.banishGraphics)
    if (this.banishSprites.length > 0) container.addChild(...this.banishSprites)
    this.resourcesCreated = true
    return container
  }

  update(
    effect: BoneyardEnemyDeathEffectSnapshot,
    visibleBounds: Readonly<BoneyardBounds>,
    viewHeight: number,
  ): boolean {
    if (effect.kind !== this.kind || (!nativeEnemyDeathEffectIsBanish(effect.kind) && effect.shadow !== this.shadowed)) {
      throw new Error(`enemy death-effect ${effect.id} changed retained view resources`)
    }
    const visible = boneyardResidentIsVisible(
      this.visualBounds(effect, viewHeight),
      visibleBounds,
    )
    this.visible = visible
    if (this.container) this.container.renderable = visible
    if (!visible) return false
    if (this.painterLane === 'world-sorted') {
      if (this.worldPainterLayer === null) this.worldPainterLayer = nativeEnemyDeathEffectPainterLayer(effect)
      else {
        if (effect.painterRegistration === null) {
          throw new Error('world-sorted death effect lost its painter registration')
        }
        this.worldPainterLayer.registration = effect.painterRegistration
        this.worldPainterLayer.sortBias = effect.painterSortBias ?? 0
        this.worldPainterLayer.worldY = effect.position.y
      }
    }
    if (this.batched) {
      this.updateMeshSample(effect)
      return true
    }
    const container = this.ensureResources()
    if (nativeEnemyDeathEffectIsBanish(effect.kind)) {
      this.updateBanish(effect, viewHeight)
    } else {
      applyLayer(this.effect!, effect, this.textures, false, this.directSprite)
      if (this.shadow) applyLayer(this.shadow, effect, this.textures, true)
    }
    if (!this.directSprite) container.position.set(effect.position.x, effect.position.y)
    return true
  }

  private visualBounds(effect: BoneyardEnemyDeathEffectSnapshot, viewHeight: number): BoneyardBounds {
    if (
      !nativeEnemyDeathEffectIsBanish(effect.kind)
      && this.bounds !== null
      && this.boundsEntry === effect.entry
      && this.boundsHeight === effect.height
      && this.boundsPositionX === effect.position.x
      && this.boundsPositionY === effect.position.y
      && this.boundsRotation === effect.rotationRadians
      && this.boundsScale === effect.scale
      && this.boundsScaleY === effect.scaleY
    ) return this.bounds
    this.meshTransformDirty = true
    const bounds = nativeEnemyDeathEffectVisualBounds(effect, deathEffectArtRecord, viewHeight)
    this.bounds = bounds
    this.boundsEntry = effect.entry
    this.boundsHeight = effect.height
    this.boundsPositionX = effect.position.x
    this.boundsPositionY = effect.position.y
    this.boundsRotation = effect.rotationRadians
    this.boundsScale = effect.scale
    this.boundsScaleY = effect.scaleY
    return bounds
  }

  setDepth(depth: number): void {
    if (this.container) this.container.zIndex = depth
    if (this.meshSample) this.meshSample.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    if (this.container) this.container.renderable = renderable
  }

  destroy(): void {
    this.clearGradients()
    this.container?.destroy({ children: true })
    this.meshSample = null
  }

  private updateMeshSample(effect: BoneyardEnemyDeathEffectSnapshot): void {
    let sample = this.meshSample
    if (this.meshTransformDirty || sample === null) {
      const art = deathEffectArtRecord(effect.atlas, effect.entry)
      const texture = requiredTexture(this.textures, art.source)
      sample = this.meshSample ??= {
        blendMode: effect.blendMode, color: 0, texture, vertices: new Float32Array(8), zIndex: 0,
      }
      sample.texture = texture
      deathEffectMeshTransform.setTransform(effect.position.x, effect.position.y + effect.height,
        0, 0, effect.scale, nativeEnemyDeathEffectVerticalScale(effect), effect.rotationRadians, 0, 0)
      const { a, b, c, d, tx, ty } = deathEffectMeshTransform
      // Match Sprite bounds and native vertex packing, including fractional anchors.
      const { width, height } = texture.orig
      const minX = -(art.anchorX / art.width) * width
      const minY = -(art.anchorY / art.height) * height
      const maxX = minX + width, maxY = minY + height
      const vertices = sample.vertices
      vertices[0] = a * minX + c * minY + tx
      vertices[1] = d * minY + b * minX + ty
      vertices[2] = a * maxX + c * minY + tx
      vertices[3] = d * minY + b * maxX + ty
      vertices[4] = a * maxX + c * maxY + tx
      vertices[5] = d * maxY + b * maxX + ty
      vertices[6] = a * minX + c * maxY + tx
      vertices[7] = d * maxY + b * minX + ty
      this.meshTransformDirty = false
    }
    sample.blendMode = effect.blendMode
    sample.color = nativePackedColor(effect.tint, effect.alpha)
  }

  private updateBanish(effect: BoneyardEnemyDeathEffectSnapshot, viewHeight: number): void {
    this.gradientIndex = 0
    this.banishGraphics!.clear()
    this.banishGraphics!.blendMode = 'add'

    const black = effect.kind === 'banish-black'
    const scale = effect.scale
    const progress = Math.max(0, 2 - effect.ageTicks * (0.02 / scale))
    const orangeAlpha = Math.min(1, progress * 0.5)
    const whiteAlpha = Math.min(1, progress * 0.75)
    const upperExtent = viewHeight * .5 * scale
    const lowerExtent = 50 * scale
    const primary = black ? '64,0,0' : '255,128,0'
    const secondary = black ? primary : '255,191,0'
    this.gradientRect(-10 * scale, -upperExtent, 20 * scale, upperExtent,
      'rgba(0,0,0,1)', `rgba(${primary},${orangeAlpha})`)
    this.gradientRect(-5 * progress * scale, -upperExtent,
      10 * progress * scale, upperExtent,
      'rgba(0,0,0,1)', `rgba(${secondary},${orangeAlpha})`)
    this.gradientRect(-2 * progress * scale, -upperExtent * 0.75,
      4 * progress * scale, upperExtent * 0.75,
      'rgba(0,0,0,1)', `rgba(255,255,255,${whiteAlpha})`)
    this.gradientRect(-10 * scale, 0, 20 * scale, lowerExtent,
      `rgba(${primary},${orangeAlpha})`, 'rgba(0,0,0,1)')
    this.gradientRect(-5 * progress * scale, 0,
      10 * progress * scale, lowerExtent,
      `rgba(${secondary},${orangeAlpha})`, 'rgba(0,0,0,1)')
    this.gradientRect(-2 * progress * scale, 0,
      4 * progress * scale, lowerExtent,
      `rgba(255,255,255,${whiteAlpha})`, 'rgba(0,0,0,1)')

    const alpha = Math.min(1, progress)
    const green = Math.min(255, Math.round(progress * 0.75 * 255))
    const tint = black ? Math.round(Math.min(1, progress * .15000000596046448) * 255) << 16 : 0xff0000 | green << 8
    for (let index = 0; index < 2; index += 1) {
      applyBanishSprite(
        this.banishSprites[index]!,
        this.textures,
        15,
        { x: 0, y: 0 },
        { x: 2 * progress * scale, y: 2 * progress * scale },
        alpha,
        tint,
      )
    }
    const upperEntry = 333 + positiveModulo(
      Math.floor((effect.spawnTick + effect.ageTicks) / 4),
      4,
    )
    for (let index = 2; index < 4; index += 1) {
      applyBanishSprite(
        this.banishSprites[index]!,
        this.textures,
        upperEntry,
        { x: black ? 0 : 1, y: -40 * scale },
        { x: 2 * scale, y: 3 * scale },
        alpha,
        tint,
      )
    }
  }

  private gradientRect(
    x: number,
    y: number,
    width: number,
    height: number,
    startColor: string,
    endColor: string,
  ): void {
    if (width <= 0 || height <= 0) return
    let gradient = this.gradients[this.gradientIndex]
    this.gradientIndex += 1
    if (!gradient) {
      gradient = new FillGradient({
        colorStops: [
          { color: startColor, offset: 0 },
          { color: endColor, offset: 1 },
        ],
        end: { x: 0, y: 1 },
        start: { x: 0, y: 0 },
        textureSpace: 'local',
      })
      this.gradients.push(gradient)
    } else {
      const start = Color.shared.setValue(startColor).toHexa()
      const end = Color.shared.setValue(endColor).toHexa()
      if (gradient.colorStops[0]!.color !== start || gradient.colorStops[1]!.color !== end) {
        gradient.colorStops[0]!.color = start
        gradient.colorStops[1]!.color = end
        const canvas: ICanvas = gradient.texture.source.resource
        const context = canvas.getContext('2d')!
        const fill = context.createLinearGradient(0, 0, canvas.width, 0)
        fill.addColorStop(0, start)
        fill.addColorStop(1, end)
        // Match a newly built Pixi gradient without compositing over the previous alpha.
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = fill
        context.fillRect(0, 0, canvas.width, canvas.height)
        gradient.texture.source.update()
      }
    }
    this.banishGraphics!.rect(x, y, width, height).fill(gradient)
  }

  private clearGradients(): void {
    for (const gradient of this.gradients) gradient.destroy()
    this.gradients.length = 0
  }
}

function applyBanishSprite(
  sprite: Sprite,
  textures: BoneyardWorldTextures,
  entry: number,
  position: Readonly<{ x: number; y: number }>,
  scale: Readonly<{ x: number; y: number }>,
  alpha: number,
  tint: number,
): void {
  const record = nativeEnemySpriteRecord('BadGuys', entry)
  sprite.visible = true
  sprite.label = `banish:BadGuys:${entry}`
  sprite.texture = requiredTexture(textures, record.source)
  sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
  sprite.position.set(position.x, position.y)
  sprite.scale.set(scale.x, scale.y)
  sprite.rotation = 0
  sprite.alpha = alpha
  sprite.blendMode = 'add'
  sprite.tint = tint
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function applyLayer(
  sprite: Sprite,
  effect: BoneyardEnemyDeathEffectSnapshot,
  textures: BoneyardWorldTextures,
  shadow = false,
  absolutePosition = false,
): void {
  const record = deathEffectArtRecord(effect.atlas, effect.entry)
  if (!absolutePosition) sprite.label = `${effect.atlas}:${effect.entry}`
  sprite.texture = requiredTexture(textures, record.source)
  sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
  sprite.position.set(
    absolutePosition ? effect.position.x : 0,
    absolutePosition ? effect.position.y + effect.height : shadow ? 2 : effect.height,
  )
  sprite.scale.set(effect.scale, nativeEnemyDeathEffectVerticalScale(effect, shadow))
  sprite.rotation = effect.rotationRadians
  sprite.alpha = effect.alpha
  sprite.blendMode = shadow ? 'normal' : effect.blendMode
  sprite.tint = shadow ? 0x000000 : effect.tint
}

function deathEffectArtRecord(
  atlas: BoneyardEnemyDeathEffectSnapshot['atlas'],
  entry: number,
) {
  const record = atlas === 'BadGuys'
    && (
      entry === 15
      || entry === 52
      || entry === 83
      || (entry >= 377 && entry <= 380)
    )
    ? nativeLootSpriteRecord('BadGuys', entry)
    : nativeEnemySpriteRecord(atlas, entry)
  return record
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy death-effect texture was not loaded: ${source}`)
  return texture
}
