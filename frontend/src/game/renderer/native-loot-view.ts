import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  BoneyardGoodieSnapshot,
  BoneyardLootSnapshot,
} from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeLootSpriteRecord } from './native-loot-assets.ts'
import {
  nativeGoodiePresentationPlan,
  nativeLootPresentationPlan,
  type NativeLootVisualLayer,
} from './native-loot-presentation.ts'

export class NativeLootViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeLootView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(actors: readonly BoneyardLootSnapshot[]): void {
    this.liveIds.clear()
    for (const actor of actors) {
      this.liveIds.add(actor.id)
      let view = this.views.get(actor.id)
      if (!view) {
        view = new NativeLootView(this.root, this.textures, actor)
        this.views.set(actor.id, view)
      } else {
        view.update(actor)
      }
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

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

export class NativeGoodieViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeGoodieView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(goodies: readonly BoneyardGoodieSnapshot[], tick: number): void {
    this.liveIds.clear()
    for (const goodie of goodies) {
      this.liveIds.add(goodie.id)
      let view = this.views.get(goodie.id)
      if (!view) {
        view = new NativeGoodieView(this.root, this.textures)
        this.views.set(goodie.id, view)
      }
      view.update(goodie, tick)
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

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

class NativeLootView {
  private readonly container: Container
  private initialScatterSeed: number
  private readonly root: Container
  private scatterSeed: number
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures, actor: BoneyardLootSnapshot) {
    this.root = root
    this.textures = textures
    this.initialScatterSeed = actor.scatterSeed
    this.scatterSeed = actor.scatterSeed
    this.container = new Container({ label: `loot:${actor.kind}:${actor.id}` })
    this.container.eventMode = 'none'
    root.addChild(this.container)
    this.update(actor)
  }

  update(actor: BoneyardLootSnapshot): void {
    if (actor.scatterSeed !== this.initialScatterSeed) {
      this.initialScatterSeed = actor.scatterSeed
      this.scatterSeed = actor.scatterSeed
    }
    const plan = nativeLootPresentationPlan(actor, this.scatterSeed)
    this.scatterSeed = plan.nextScatterSeed
    updateLayers(this.container, this.sprites, plan.layers, this.textures)
    this.container.label = `loot:${actor.kind}:${actor.id}`
    this.container.position.set(actor.position.x, actor.position.y)
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

class NativeGoodieView {
  private readonly container: Container
  private readonly root: Container
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
    this.container = new Container({ label: 'goodie' })
    this.container.eventMode = 'none'
    root.addChild(this.container)
  }

  update(goodie: BoneyardGoodieSnapshot, tick: number): void {
    updateLayers(
      this.container,
      this.sprites,
      nativeGoodiePresentationPlan(goodie, tick),
      this.textures,
    )
    this.container.label = `goodie:${goodie.id}`
    this.container.position.set(goodie.position.x, goodie.position.y)
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

function updateLayers(
  container: Container,
  sprites: Sprite[],
  layers: readonly NativeLootVisualLayer[],
  textures: BoneyardWorldTextures,
): void {
  while (sprites.length < layers.length) {
    const sprite = new Sprite()
    sprite.eventMode = 'none'
    sprites.push(sprite)
    container.addChild(sprite)
  }
  while (sprites.length > layers.length) {
    const sprite = sprites.pop()!
    container.removeChild(sprite)
    sprite.destroy()
  }
  layers.forEach((visual, index) => {
    const record = nativeLootSpriteRecord(visual.atlas, visual.entry)
    const sprite = sprites[index]!
    sprite.label = `${visual.role}:${visual.atlas}:${visual.entry}`
    sprite.texture = requiredTexture(textures, record.source)
    sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
    sprite.position.set(visual.offset.x, visual.offset.y)
    sprite.scale.set(visual.scale.x, visual.scale.y)
    sprite.rotation = visual.rotationRadians
    sprite.alpha = visual.alpha
    sprite.blendMode = visual.blendMode
    sprite.tint = visual.tint
  })
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native loot texture was not loaded: ${source}`)
  return texture
}
