import { Container, Sprite, type Texture } from 'pixi.js'

import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeMageLightningPlan,
  sampledMageLightningEventIds,
  shouldRenderSemanticMageLightning,
} from './native-mage-lightning-presentation.ts'
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
  private readonly lightningDepths = new Map<number, number>()
  private readonly lightningViews = new Map<number, NativeMageLightningView>()
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly seenLightningEventIds = new Set<number>()
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, ManagedEnemyView>()
  private lastTick: number

  constructor(root: Container, textures: BoneyardWorldTextures, startTick = 0) {
    this.root = root
    this.textures = textures
    this.lastTick = startTick
  }

  consumeEvent(event: BoneyardEnemyEventSnapshot): void {
    if (event.type !== 'mage-lightning') return
    if (this.seenLightningEventIds.has(event.eventId)) return
    this.seenLightningEventIds.add(event.eventId)
    const view = new NativeMageLightningView(
      this.root,
      this.textures,
      event,
      this.lastTick,
    )
    view.setDepth(this.lightningDepths.get(event.actorId) ?? 1)
    this.lightningViews.set(event.eventId, view)
  }

  update(enemies: readonly NativeEnemyVisualSnapshot[], tick: number): void {
    this.lastTick = tick
    const liveIds = this.liveIds
    const sampledLightningEventIds = sampledMageLightningEventIds(enemies)
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
    for (const [eventId, view] of this.lightningViews) {
      if (view.update(
        tick,
        shouldRenderSemanticMageLightning(eventId, sampledLightningEventIds),
      )) continue
      view.destroy()
      this.lightningViews.delete(eventId)
    }
  }

  setDepth(id: number, depth: number): void {
    this.lightningDepths.set(id, depth)
    this.views.get(id)?.view.setDepth(depth)
    for (const view of this.lightningViews.values()) {
      if (view.actorId === id) view.setDepth(depth)
    }
  }

  setTint(id: number, tint: number): void {
    this.views.get(id)?.view.setTint(tint)
  }

  get size(): number {
    return this.views.size
  }

  get lightningSize(): number {
    return this.lightningViews.size
  }

  destroy(): void {
    for (const managed of this.views.values()) managed.view.destroy()
    for (const view of this.lightningViews.values()) view.destroy()
    this.views.clear()
    this.lightningViews.clear()
    this.lightningDepths.clear()
    this.liveIds.clear()
    this.seenLightningEventIds.clear()
  }
}

class NativeMageLightningView {
  readonly actorId: number
  private readonly container: Container
  private readonly event: BoneyardEnemyEventSnapshot
  private readonly root: Container
  private readonly sprites: readonly Sprite[]
  private readonly startedPresentationTick: number

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    event: BoneyardEnemyEventSnapshot,
    startedPresentationTick: number,
  ) {
    this.actorId = event.actorId
    this.event = event
    this.root = root
    this.startedPresentationTick = startedPresentationTick
    this.container = new Container({ label: `mage-lightning:${event.eventId}` })
    this.container.eventMode = 'none'
    this.sprites = [381, 382].map((entry) => {
      const record = nativeEnemySpriteRecord('BadGuys', entry)
      const sprite = new Sprite(requiredTexture(textures, record.source))
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.blendMode = 'add'
      sprite.eventMode = 'none'
      this.container.addChild(sprite)
      return sprite
    })
    root.addChild(this.container)
    this.update(startedPresentationTick, true)
  }

  update(tick: number, visible: boolean): boolean {
    const plan = nativeMageLightningPlan(
      this.event,
      Math.max(0, tick - this.startedPresentationTick),
    )
    if (!plan) return false
    this.container.visible = visible
    plan.layers.forEach((layer, index) => {
      const sprite = this.sprites[index]!
      sprite.alpha = layer.alpha
      sprite.label = `${layer.role}:BadGuys:${layer.entry}`
      sprite.position.set(layer.position.x, layer.position.y)
    })
    return true
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
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
    })
    this.container.position.set(enemy.position.x, enemy.position.y)
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

function requiredTexture(
  textures: BoneyardWorldTextures,
  source: string,
): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy texture was not loaded: ${source}`)
  return texture
}
