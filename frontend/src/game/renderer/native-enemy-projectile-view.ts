import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { nativeEnemyProjectilePlan } from './native-enemy-projectile-presentation.ts'

export class NativeEnemyProjectileViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyProjectileView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(projectiles: readonly BoneyardEnemyProjectileSnapshot[], tick: number): void {
    this.liveIds.clear()
    for (const projectile of projectiles) {
      this.liveIds.add(projectile.id)
      let view = this.views.get(projectile.id)
      if (!view) {
        view = new NativeEnemyProjectileView(this.root, this.textures)
        this.views.set(projectile.id, view)
      }
      view.update(projectile, tick)
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

  setTint(id: number, tint: number): void {
    this.views.get(id)?.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) view.setRenderable(renderable)
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

class NativeEnemyProjectileView {
  private readonly container: Container
  private readonly root: Container
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
    this.container = new Container({ label: 'enemy-projectile' })
    this.container.eventMode = 'none'
    root.addChild(this.container)
  }

  update(projectile: BoneyardEnemyProjectileSnapshot, tick: number): void {
    const plan = nativeEnemyProjectilePlan(projectile, tick)
    while (this.sprites.length < plan.layers.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.sprites.push(sprite)
      this.container.addChild(sprite)
    }
    while (this.sprites.length > plan.layers.length) {
      const sprite = this.sprites.pop()!
      this.container.removeChild(sprite)
      sprite.destroy()
    }
    plan.layers.forEach((layer, index) => {
      const record = nativeEnemySpriteRecord(layer.atlas, layer.entry)
      const sprite = this.sprites[index]!
      sprite.label = `${layer.role}:${layer.atlas}:${layer.entry}`
      sprite.texture = requiredTexture(this.textures, record.source)
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.alpha = layer.alpha
      sprite.blendMode = layer.blendMode
      sprite.position.set(layer.offset.x, layer.offset.y)
      sprite.rotation = layer.rotationRadians
      sprite.scale.set(layer.scale, layer.scaleY)
      sprite.tint = layer.tint
    })
    this.container.label = `enemy-projectile:${projectile.kind}:${projectile.id}`
    this.container.position.set(plan.position.x, plan.position.y)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy projectile texture was not loaded: ${source}`)
  return texture
}
