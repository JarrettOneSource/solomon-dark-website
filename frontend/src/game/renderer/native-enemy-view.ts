import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeEnemyPresentationPlan,
  type NativeEnemyFamily,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

interface ManagedEnemyView {
  family: NativeEnemyFamily
  view: NativeEnemyView
}

export class NativeEnemyViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, ManagedEnemyView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(enemies: readonly NativeEnemyVisualSnapshot[], tick: number): void {
    const liveIds = this.liveIds
    liveIds.clear()
    for (const enemy of enemies) {
      liveIds.add(enemy.id)
      let managed = this.views.get(enemy.id)
      if (managed && managed.family !== enemy.enemyToken) {
        managed.view.destroy()
        this.views.delete(enemy.id)
        managed = undefined
      }
      if (!managed) {
        const view = new NativeEnemyView(this.root, this.textures, enemy, tick)
        managed = { family: enemy.enemyToken, view }
        this.views.set(enemy.id, managed)
      } else {
        managed.view.update(enemy, tick)
      }
    }
    for (const [id, managed] of this.views) {
      if (liveIds.has(id)) continue
      managed.view.destroy()
      this.views.delete(id)
    }
  }

  setDepth(id: number, depth: number): void {
    this.views.get(id)?.view.setDepth(depth)
  }

  setTint(id: number, tint: number): void {
    this.views.get(id)?.view.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const managed of this.views.values()) managed.view.setRenderable(renderable)
  }

  get size(): number {
    return this.views.size
  }

  destroy(): void {
    for (const managed of this.views.values()) managed.view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

class NativeEnemyView {
  private readonly container: Container
  private readonly root: Container
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    enemy: NativeEnemyVisualSnapshot,
    tick: number,
  ) {
    this.root = root
    this.textures = textures
    this.container = new Container({
      label: `enemy:${enemy.enemyToken}:${enemy.id}`,
    })
    this.container.eventMode = 'none'
    root.addChild(this.container)
    this.update(enemy, tick)
  }

  update(enemy: NativeEnemyVisualSnapshot, tick: number): void {
    const plan = nativeEnemyPresentationPlan(enemy, tick)
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
      const sprite = this.sprites[index]
      sprite.label = `${layer.role}:${layer.atlas}:${layer.entry}`
      sprite.texture = requiredTexture(this.textures, record.source)
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.position.set(layer.offset.x, layer.offset.y)
      sprite.scale.set(layer.scale)
      sprite.rotation = layer.rotationRadians
      sprite.alpha = layer.alpha
      sprite.blendMode = layer.blendMode
      sprite.tint = layer.tint
    })
    this.container.position.set(enemy.position.x, enemy.position.y)
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

function requiredTexture(
  textures: BoneyardWorldTextures,
  source: string,
): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy texture was not loaded: ${source}`)
  return texture
}
