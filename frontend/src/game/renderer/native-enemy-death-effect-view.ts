import { Container, FillGradient, Graphics, Sprite, type Texture } from 'pixi.js'

import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { boneyardResidentIsVisible } from './boneyard-render-contract.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeEnemyDeathEffectPlan,
  nativeEnemyDeathEffectVisualBounds,
  nativeEnemyDeathEffectViewResourcePlan,
} from './native-enemy-death-effect-presentation.ts'
import { nativeLootSpriteRecord } from './native-loot-assets.ts'

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
  ): void {
    this.liveIds.clear()
    this.visibleCount = 0
    for (const effect of effects) {
      this.liveIds.add(effect.id)
      let view = this.views.get(effect.id)
      if (!view) {
        view = new NativeEnemyDeathEffectView(
          effect.presentationOwner === 'pre-world-queue' ? this.preWorldRoot : this.root,
          this.textures,
          effect,
        )
        this.views.set(effect.id, view)
      }
      if (view.update(effect, visibleBounds)) this.visibleCount += 1
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      view.destroy()
      this.views.delete(id)
    }
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
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
    this.visibleCount = 0
  }
}

class NativeEnemyDeathEffectView {
  private readonly banishGraphics: Graphics | null
  private readonly banishSprites: readonly Sprite[]
  private bounds: BoneyardBounds | null = null
  private boundsEntry = -1
  private boundsHeight = Number.NaN
  private boundsPositionX = Number.NaN
  private boundsPositionY = Number.NaN
  private boundsRotation = Number.NaN
  private boundsScale = Number.NaN
  private readonly container: Container
  private readonly effect: Sprite | null
  private readonly gradients: FillGradient[] = []
  private readonly kind: BoneyardEnemyDeathEffectSnapshot['kind']
  private readonly root: Container
  private readonly shadow: Sprite | null
  private readonly shadowed: boolean
  private readonly textures: BoneyardWorldTextures
  visible = false

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    initial: BoneyardEnemyDeathEffectSnapshot,
  ) {
    this.root = root
    this.textures = textures
    this.kind = initial.kind
    this.shadowed = initial.kind !== 'banish' && initial.shadow
    const resources = nativeEnemyDeathEffectViewResourcePlan(initial)
    this.container = new Container({ label: 'enemy-death-effect' })
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
    this.container.label = `enemy-death-effect:${initial.kind}:${initial.id}`
    root.addChild(this.container)
  }

  update(
    effect: BoneyardEnemyDeathEffectSnapshot,
    visibleBounds: Readonly<BoneyardBounds>,
  ): boolean {
    if (effect.kind !== this.kind || (effect.kind !== 'banish' && effect.shadow !== this.shadowed)) {
      throw new Error(`enemy death-effect ${effect.id} changed retained view resources`)
    }
    const visible = boneyardResidentIsVisible(
      this.visualBounds(effect),
      visibleBounds,
    )
    this.visible = visible
    this.container.renderable = visible
    if (!visible) return false
    const plan = nativeEnemyDeathEffectPlan(effect)
    if (effect.kind === 'banish') {
      this.updateBanish(effect)
    } else {
      applyLayer(this.effect!, plan.effect, this.textures)
      if (plan.shadow) {
        applyLayer(this.shadow!, plan.shadow, this.textures)
      }
    }
    this.container.position.set(plan.position.x, plan.position.y)
    return true
  }

  private visualBounds(effect: BoneyardEnemyDeathEffectSnapshot): BoneyardBounds {
    if (
      effect.kind !== 'banish'
      && this.bounds !== null
      && this.boundsEntry === effect.entry
      && this.boundsHeight === effect.height
      && this.boundsPositionX === effect.position.x
      && this.boundsPositionY === effect.position.y
      && this.boundsRotation === effect.rotationRadians
      && this.boundsScale === effect.scale
    ) return this.bounds
    const bounds = nativeEnemyDeathEffectVisualBounds(effect, deathEffectArtRecord)
    this.bounds = bounds
    this.boundsEntry = effect.entry
    this.boundsHeight = effect.height
    this.boundsPositionX = effect.position.x
    this.boundsPositionY = effect.position.y
    this.boundsRotation = effect.rotationRadians
    this.boundsScale = effect.scale
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
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }

  private updateBanish(effect: BoneyardEnemyDeathEffectSnapshot): void {
    this.clearGradients()
    this.banishGraphics!.clear()
    this.banishGraphics!.blendMode = 'add'

    const scale = effect.scale
    const progress = Math.max(0, 2 - effect.ageTicks * (0.02 / scale))
    const orangeAlpha = Math.min(1, progress * 0.5)
    const whiteAlpha = Math.min(1, progress * 0.75)
    const upperExtent = 450 * scale
    const lowerExtent = 50 * scale
    this.gradientRect(-10 * scale, -upperExtent, 20 * scale, upperExtent,
      'rgba(0,0,0,1)', `rgba(255,128,0,${orangeAlpha})`)
    this.gradientRect(-5 * progress * scale, -upperExtent,
      10 * progress * scale, upperExtent,
      'rgba(0,0,0,1)', `rgba(255,191,0,${orangeAlpha})`)
    this.gradientRect(-2 * progress * scale, -upperExtent * 0.75,
      4 * progress * scale, upperExtent * 0.75,
      'rgba(0,0,0,1)', `rgba(255,255,255,${whiteAlpha})`)
    this.gradientRect(-10 * scale, 0, 20 * scale, lowerExtent,
      `rgba(255,128,0,${orangeAlpha})`, 'rgba(0,0,0,1)')
    this.gradientRect(-5 * progress * scale, 0,
      10 * progress * scale, lowerExtent,
      `rgba(255,191,0,${orangeAlpha})`, 'rgba(0,0,0,1)')
    this.gradientRect(-2 * progress * scale, 0,
      4 * progress * scale, lowerExtent,
      `rgba(255,255,255,${whiteAlpha})`, 'rgba(0,0,0,1)')

    const alpha = Math.min(1, progress)
    const green = Math.min(255, Math.round(progress * 0.75 * 255))
    const tint = 0xff0000 | green << 8
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
        { x: 1, y: -40 * scale },
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
    const gradient = new FillGradient({
      colorStops: [
        { color: startColor, offset: 0 },
        { color: endColor, offset: 1 },
      ],
      end: { x: 0, y: 1 },
      start: { x: 0, y: 0 },
      textureSpace: 'local',
    })
    this.gradients.push(gradient)
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
  layer: ReturnType<typeof nativeEnemyDeathEffectPlan>['effect'],
  textures: BoneyardWorldTextures,
): void {
  const record = layer.atlas === 'BadGuys'
    && (
      layer.entry === 15
      || layer.entry === 52
      || layer.entry === 83
      || (layer.entry >= 377 && layer.entry <= 380)
    )
    ? nativeLootSpriteRecord('BadGuys', layer.entry)
    : nativeEnemySpriteRecord(layer.atlas, layer.entry)
  sprite.label = `${layer.atlas}:${layer.entry}`
  sprite.texture = requiredTexture(textures, record.source)
  sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
  sprite.position.set(layer.offset.x, layer.offset.y)
  sprite.scale.set(layer.scale.x, layer.scale.y)
  sprite.rotation = layer.rotationRadians
  sprite.alpha = layer.alpha
  sprite.blendMode = layer.blendMode
  sprite.tint = layer.tint
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
