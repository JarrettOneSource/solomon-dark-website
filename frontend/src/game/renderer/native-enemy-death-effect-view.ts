import { Color, Container, FillGradient, Graphics, Sprite, type ICanvas, type Texture } from 'pixi.js'

import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import { boneyardResidentIsVisible } from './boneyard-render-contract.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeEnemyDeathEffectIsBanish,
  nativeEnemyDeathEffectVerticalScale,
  nativeEnemyDeathEffectViewResourcePlan,
  nativeEnemyDeathEffectVisualBounds,
} from './native-enemy-death-effect-presentation.ts'
import { nativeLootSpriteRecord } from './native-loot-assets.ts'

// Measured crossover for a large native Faculty population; small removals
// avoid rebuilding an otherwise unchanged parent's child list.
const MIN_BATCH_RETIREMENT = 512

export class NativeEnemyDeathEffectViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly preWorldRoot: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyDeathEffectView>()
  private visibleCount = 0

  constructor(root: Container, textures: BoneyardWorldTextures, preWorldRoot: Container) {
    this.root = root
    this.preWorldRoot = preWorldRoot
    this.textures = textures
  }

  update(
    effects: readonly BoneyardEnemyDeathEffectSnapshot[],
    visibleBounds: Readonly<BoneyardBounds>,
    viewHeight: number,
  ): void {
    this.liveIds.clear()
    this.visibleCount = 0
    for (const effect of effects) {
      this.liveIds.add(effect.id)
      let view = this.views.get(effect.id)
      if (!view) {
        view = new NativeEnemyDeathEffectView(
          (effect.presentationOwner === 'pre-world-queue' || effect.presentationOwner === 'background') ? this.preWorldRoot : this.root,
          this.textures,
          effect,
        )
        this.views.set(effect.id, view)
      }
      if (view.update(effect, visibleBounds, viewHeight)) this.visibleCount += 1
    }
    const retired: NativeEnemyDeathEffectView[] = []
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      retired.push(view)
      this.views.delete(id)
    }
    this.destroyViews(retired)
  }

  setDepth(id: number, depth: number): void {
    this.views.get(id)?.setDepth(depth)
  }

  isVisible(id: number): boolean {
    return this.views.get(id)?.visible ?? false
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) view.setRenderable(renderable)
  }

  get size(): number {
    return this.views.size
  }

  get visibleSize(): number {
    return this.visibleCount
  }

  destroy(): void {
    this.destroyViews([...this.views.values()])
    this.views.clear()
    this.liveIds.clear()
    this.visibleCount = 0
  }

  private destroyViews(views: readonly NativeEnemyDeathEffectView[]): void {
    if (views.length >= MIN_BATCH_RETIREMENT) {
      const byRoot = new Map<Container, Set<Container>>()
      for (const view of views) {
        const root = view.container.parent
        if (!root) continue
        let retired = byRoot.get(root)
        if (!retired) { retired = new Set(); byRoot.set(root, retired) }
        retired.add(view.container)
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
  readonly container: Container
  private effect: Sprite | null = null
  private gradientIndex = 0
  private readonly gradients: FillGradient[] = []
  private readonly kind: BoneyardEnemyDeathEffectSnapshot['kind']
  private readonly directSprite: boolean
  private resourcesCreated = false
  private shadow: Sprite | null = null
  private readonly shadowed: boolean
  private readonly textures: BoneyardWorldTextures
  visible = false

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    initial: BoneyardEnemyDeathEffectSnapshot,
  ) {
    this.textures = textures
    this.kind = initial.kind
    this.shadowed = !nativeEnemyDeathEffectIsBanish(initial.kind) && initial.shadow
    this.directSprite = !this.shadowed && !nativeEnemyDeathEffectIsBanish(initial.kind)
    // Keep native painter insertion order even for equal-depth background
    // effects that enter the camera in a different order than their birth.
    const label = `enemy-death-effect:${initial.kind}:${initial.id}`
    if (this.directSprite) {
      const sprite = new Sprite({ label })
      this.container = sprite
      this.effect = sprite
      this.resourcesCreated = true
    } else {
      this.container = new Container({ label })
    }
    this.container.eventMode = 'none'
    root.addChild(this.container)
  }

  private ensureResources(): Container {
    if (this.resourcesCreated) return this.container
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
    this.container.eventMode = 'none'
    if (this.effect) this.effect.eventMode = 'none'
    if (this.shadow) this.shadow.eventMode = 'none'
    if (this.banishGraphics) this.banishGraphics.eventMode = 'none'
    for (const sprite of this.banishSprites) sprite.eventMode = 'none'
    if (this.shadow) this.container.addChild(this.shadow)
    if (this.effect) this.container.addChild(this.effect)
    if (this.banishGraphics) this.container.addChild(this.banishGraphics)
    if (this.banishSprites.length > 0) this.container.addChild(...this.banishSprites)
    this.resourcesCreated = true
    return this.container
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
    this.container.renderable = visible
    if (!visible) return false
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
    this.container.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.clearGradients()
    this.container.destroy({ children: true })
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
  const record = effect.atlas === 'BadGuys'
    && (
      effect.entry === 15
      || effect.entry === 52
      || effect.entry === 83
      || (effect.entry >= 377 && effect.entry <= 380)
    )
    ? nativeLootSpriteRecord('BadGuys', effect.entry)
    : nativeEnemySpriteRecord(effect.atlas, effect.entry)
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
