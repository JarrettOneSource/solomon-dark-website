import { Container, FillGradient, Graphics, Sprite, type Texture } from 'pixi.js'

import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeEnemyDeathEffectBypassesWorldTint,
  nativeEnemyDeathEffectPlan,
} from './native-enemy-death-effect-presentation.ts'
import { nativeLootSpriteRecord } from './native-loot-assets.ts'

export class NativeEnemyDeathEffectViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyDeathEffectView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(effects: readonly BoneyardEnemyDeathEffectSnapshot[]): void {
    this.liveIds.clear()
    for (const effect of effects) {
      this.liveIds.add(effect.id)
      let view = this.views.get(effect.id)
      if (!view) {
        view = new NativeEnemyDeathEffectView(this.root, this.textures)
        this.views.set(effect.id, view)
      }
      view.update(effect)
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

  setWorldTint(id: number, tint: number): void {
    this.views.get(id)?.setWorldTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) view.setRenderable(renderable)
  }

  get size(): number {
    return this.views.size
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

class NativeEnemyDeathEffectView {
  private readonly banishGraphics = new Graphics({ label: 'enemy-banish-gradients' })
  private readonly banishSprites = Array.from({ length: 4 }, () => new Sprite())
  private bypassesWorldTint = false
  private readonly container: Container
  private readonly effect = new Sprite()
  private readonly gradients: FillGradient[] = []
  private readonly root: Container
  private readonly shadow = new Sprite()
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
    this.container = new Container({ label: 'enemy-death-effect' })
    this.container.eventMode = 'none'
    this.effect.eventMode = 'none'
    this.shadow.eventMode = 'none'
    this.banishGraphics.eventMode = 'none'
    for (const sprite of this.banishSprites) sprite.eventMode = 'none'
    this.container.addChild(
      this.shadow,
      this.effect,
      this.banishGraphics,
      ...this.banishSprites,
    )
    root.addChild(this.container)
  }

  update(effect: BoneyardEnemyDeathEffectSnapshot): void {
    const plan = nativeEnemyDeathEffectPlan(effect)
    if (effect.kind === 'banish') {
      this.effect.visible = false
      this.shadow.visible = false
      this.updateBanish(effect)
    } else {
      this.clearBanish()
      this.effect.visible = true
      applyLayer(this.effect, plan.effect, this.textures)
      if (plan.shadow) {
        applyLayer(this.shadow, plan.shadow, this.textures)
        this.shadow.visible = true
      } else {
        this.shadow.visible = false
      }
    }
    this.container.label = `enemy-death-effect:${effect.kind}:${effect.id}`
    this.container.position.set(plan.position.x, plan.position.y)
    this.bypassesWorldTint = nativeEnemyDeathEffectBypassesWorldTint(effect)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setWorldTint(tint: number): void {
    this.container.tint = this.bypassesWorldTint ? 0xffffff : tint
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
    this.banishGraphics.clear()
    this.banishGraphics.visible = true
    this.banishGraphics.blendMode = 'add'

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
    this.banishGraphics.rect(x, y, width, height).fill(gradient)
  }

  private clearBanish(): void {
    this.banishGraphics.visible = false
    for (const sprite of this.banishSprites) sprite.visible = false
    this.clearGradients()
    this.banishGraphics.clear()
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

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy death-effect texture was not loaded: ${source}`)
  return texture
}
