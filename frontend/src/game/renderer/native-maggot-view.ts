import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { BoneyardMaggotSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeMaggotIsVisible,
  nativeMaggotPresentationPlan,
  type NativeMaggotArtRecord,
} from './native-maggot-presentation.ts'

export class NativeMaggotViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly visibleMaggots: BoneyardMaggotSnapshot[] = []
  private readonly views = new Map<number, NativeMaggotView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(
    maggots: readonly BoneyardMaggotSnapshot[],
    visibleBounds: Readonly<BoneyardBounds>,
  ): void {
    this.liveIds.clear()
    this.visibleMaggots.length = 0
    for (const maggot of maggots) {
      this.liveIds.add(maggot.id)
      let view = this.views.get(maggot.id)
      if (!view) {
        view = new NativeMaggotView(this.root, this.textures)
        this.views.set(maggot.id, view)
      }
      if (view.update(maggot, visibleBounds)) this.visibleMaggots.push(maggot)
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

  get visibleSize(): number {
    return this.visibleMaggots.length
  }

  get visibleSnapshots(): readonly BoneyardMaggotSnapshot[] {
    return this.visibleMaggots
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
    this.visibleMaggots.length = 0
  }
}

class NativeMaggotView {
  private readonly container: Container
  private readonly root: Container
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures
  visible = false

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
    this.container = new Container()
    this.container.eventMode = 'none'
    root.addChild(this.container)
  }

  update(
    maggot: BoneyardMaggotSnapshot,
    visibleBounds: Readonly<BoneyardBounds>,
  ): boolean {
    const plan = nativeMaggotPresentationPlan(maggot)
    const visible = nativeMaggotIsVisible(
      maggot,
      visibleBounds,
      maggotArtRecord,
      plan,
    )
    this.visible = visible
    this.container.renderable = visible
    if (!visible) return false
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
      const record = maggotSpriteRecord(layer.atlas, layer.entry)
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
    return true
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable && this.visible
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

const maggotSpriteRecords = new Map<
  string,
  ReturnType<typeof nativeEnemySpriteRecord>
>()

function maggotSpriteRecord(
  atlas: Parameters<typeof nativeEnemySpriteRecord>[0],
  entry: number,
): ReturnType<typeof nativeEnemySpriteRecord> {
  const key = `${atlas}:${entry}`
  let record = maggotSpriteRecords.get(key)
  if (!record) {
    record = nativeEnemySpriteRecord(atlas, entry)
    maggotSpriteRecords.set(key, record)
  }
  return record
}

function maggotArtRecord(
  atlas: Parameters<typeof nativeEnemySpriteRecord>[0],
  entry: number,
): NativeMaggotArtRecord {
  const record = maggotSpriteRecord(atlas, entry)
  return {
    anchorX: record.anchorX,
    anchorY: record.anchorY,
    height: record.height,
    width: record.width,
  }
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native Maggot texture was not loaded: ${source}`)
  return texture
}
