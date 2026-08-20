import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { nativeEnemyDeathEffectPlan } from './native-enemy-death-effect-presentation.ts'
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
  private readonly container: Container
  private readonly effect = new Sprite()
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
    this.container.addChild(this.shadow, this.effect)
    root.addChild(this.container)
  }

  update(effect: BoneyardEnemyDeathEffectSnapshot): void {
    const plan = nativeEnemyDeathEffectPlan(effect)
    applyLayer(this.effect, plan.effect, this.textures)
    if (plan.shadow) {
      applyLayer(this.shadow, plan.shadow, this.textures)
      this.shadow.visible = true
    } else {
      this.shadow.visible = false
    }
    this.container.label = `enemy-death-effect:${effect.kind}:${effect.id}`
    this.container.position.set(plan.position.x, plan.position.y)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setWorldTint(tint: number): void {
    this.container.tint = tint
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
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
