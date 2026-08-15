import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardMaggotSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { nativeMaggotPresentationPlan } from './native-maggot-presentation.ts'

export class NativeMaggotViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeMaggotView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(maggots: readonly BoneyardMaggotSnapshot[]): void {
    this.liveIds.clear()
    for (const maggot of maggots) {
      this.liveIds.add(maggot.id)
      let view = this.views.get(maggot.id)
      if (!view) {
        view = new NativeMaggotView(this.root, this.textures)
        this.views.set(maggot.id, view)
      }
      view.update(maggot)
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

  get size(): number {
    return this.views.size
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

class NativeMaggotView {
  private readonly container: Container
  private readonly root: Container
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
    this.container = new Container()
    this.container.eventMode = 'none'
    root.addChild(this.container)
  }

  update(maggot: BoneyardMaggotSnapshot): void {
    const plan = nativeMaggotPresentationPlan(maggot)
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
      sprite.position.set(layer.offset.x, layer.offset.y)
      sprite.scale.set(layer.scale)
      sprite.rotation = layer.rotationRadians
      sprite.alpha = layer.alpha
      sprite.blendMode = layer.blendMode
      sprite.tint = layer.tint
    })
    this.container.label = `maggot:${maggot.id}:${maggot.state}`
    this.container.position.set(maggot.position.x, maggot.position.y)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native Maggot texture was not loaded: ${source}`)
  return texture
}
