import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardEnemyProjectileEffectSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeEnemyProjectileEffectBypassesWorldTint,
  nativeEnemyProjectileEffectPlan,
} from './native-enemy-projectile-effect-presentation.ts'

export class NativeEnemyProjectileEffectViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyProjectileEffectView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(effects: readonly BoneyardEnemyProjectileEffectSnapshot[]): void {
    this.liveIds.clear()
    for (const effect of effects) {
      this.liveIds.add(effect.id)
      let view = this.views.get(effect.id)
      if (!view) {
        view = new NativeEnemyProjectileEffectView(this.root, this.textures)
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

  get size(): number {
    return this.views.size
  }

  get ids(): readonly number[] {
    return [...this.views.keys()].sort((left, right) => left - right)
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

class NativeEnemyProjectileEffectView {
  private bypassesWorldTint = false
  private readonly container: Container
  private readonly root: Container
  private readonly sprite = new Sprite()
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
    this.container = new Container({ label: 'enemy-projectile-effect' })
    this.container.eventMode = 'none'
    this.sprite.eventMode = 'none'
    this.container.addChild(this.sprite)
    root.addChild(this.container)
  }

  update(effect: BoneyardEnemyProjectileEffectSnapshot): void {
    const plan = nativeEnemyProjectileEffectPlan(effect)
    const record = nativeEnemySpriteRecord(plan.atlas, plan.entry)
    this.sprite.label = `${plan.atlas}:${plan.entry}`
    this.sprite.texture = requiredTexture(this.textures, record.source)
    this.sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
    this.sprite.alpha = plan.alpha
    this.sprite.blendMode = plan.blendMode
    this.sprite.rotation = plan.rotationRadians
    this.sprite.scale.set(plan.scale)
    this.sprite.tint = plan.tint
    this.container.label = `enemy-projectile-effect:${effect.kind}:${effect.id}`
    this.container.position.set(plan.position.x, plan.position.y)
    this.bypassesWorldTint = nativeEnemyProjectileEffectBypassesWorldTint(effect)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setWorldTint(tint: number): void {
    this.container.tint = this.bypassesWorldTint ? 0xffffff : tint
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) {
    throw new Error(`Native enemy projectile-effect texture was not loaded: ${source}`)
  }
  return texture
}
