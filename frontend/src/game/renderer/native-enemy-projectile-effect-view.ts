import { updateNativeProjectileSprites } from './native-enemy-projectile-view.ts'
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
  private readonly preWorldRoot: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyProjectileEffectView>()

  constructor(root: Container, textures: BoneyardWorldTextures, preWorldRoot: Container) {
    this.root = root
    this.preWorldRoot = preWorldRoot
    this.textures = textures
  }

  update(
    effects: readonly BoneyardEnemyProjectileEffectSnapshot[],
    pointGainAt: (position: Readonly<{ x: number; y: number }>) => number,
  ): void {
    this.liveIds.clear()
    for (const effect of effects) {
      this.liveIds.add(effect.id)
      let view = this.views.get(effect.id)
      if (!view) {
        view = new NativeEnemyProjectileEffectView(
          effect.kind === 'demon-explosion-array' || effect.kind === 'poison-bubble' ? this.preWorldRoot : this.root,
          this.textures, this.preWorldRoot,
        )
        this.views.set(effect.id, view)
      }
      view.update(effect, pointGainAt(effect.position))
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
  private readonly preWorldRoot: Container
  private readonly sprites: Sprite[] = []
  private readonly groundGlow = new Sprite()
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures, preWorldRoot: Container) {
    this.root = root
    this.preWorldRoot = preWorldRoot
    this.textures = textures
    this.container = new Container({ label: 'enemy-projectile-effect' })
    this.container.eventMode = 'none'
    root.addChild(this.container)
    this.groundGlow.eventMode = 'none'
    this.groundGlow.label = 'enemy-fire-ground-glow'
    this.groundGlow.zIndex = 0.5
    preWorldRoot.addChild(this.groundGlow)
  }

  update(effect: BoneyardEnemyProjectileEffectSnapshot, pointGain: number): void {
    const plan = nativeEnemyProjectileEffectPlan(effect, pointGain)
    updateNativeProjectileSprites(this.container, this.sprites, plan.layers, this.textures)
    this.container.label = `enemy-projectile-effect:${effect.kind}:${effect.id}`
    this.container.position.set(plan.position.x, plan.position.y)
    this.bypassesWorldTint = nativeEnemyProjectileEffectBypassesWorldTint(effect)
    this.groundGlow.visible = plan.groundGlow !== null
    if (plan.groundGlow) {
      const record = nativeEnemySpriteRecord('BadGuys', 15)
      this.groundGlow.texture = requiredTexture(this.textures, record.source)
      this.groundGlow.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      this.groundGlow.alpha = plan.groundGlow.alpha
      this.groundGlow.position.set(plan.groundGlow.position.x, plan.groundGlow.position.y)
      this.groundGlow.scale.set(plan.groundGlow.scale)
      this.groundGlow.tint = plan.groundGlow.tint
    }
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setWorldTint(tint: number): void {
    this.container.tint = this.bypassesWorldTint ? 0xffffff : tint
  }

  destroy(): void {
    this.preWorldRoot.removeChild(this.groundGlow)
    this.groundGlow.destroy()
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
