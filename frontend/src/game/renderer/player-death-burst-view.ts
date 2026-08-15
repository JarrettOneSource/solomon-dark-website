import { Container, Sprite, type Texture } from 'pixi.js'

import type { GameSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  PlayerDeathBurstCrossingTracker,
  playerDeathBurstLayers,
  type PlayerDeathBurstTrigger,
} from './player-death-burst-presentation.ts'

interface ActivePlayerDeathBurst {
  readonly startedPresentationTick: number
  readonly view: PlayerDeathBurstView
}

export class PlayerDeathBurstViews {
  private readonly active = new Map<string, ActivePlayerDeathBurst>()
  private readonly depths = new Map<string, number>()
  private readonly root: Container
  private runId: string
  private readonly textures: BoneyardWorldTextures
  private readonly tracker: PlayerDeathBurstCrossingTracker

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    initialSnapshot: GameSnapshot,
  ) {
    if (initialSnapshot.world.kind !== 'boneyard') {
      throw new Error('Player death-burst views require a Boneyard snapshot')
    }
    this.root = root
    this.runId = initialSnapshot.world.runId
    this.textures = textures
    this.tracker = new PlayerDeathBurstCrossingTracker(initialSnapshot)
  }

  update(snapshot: GameSnapshot): void {
    if (snapshot.world.kind !== 'boneyard') {
      throw new Error('Player death-burst views require a Boneyard snapshot')
    }
    if (snapshot.world.runId !== this.runId) {
      this.clearActive()
      this.runId = snapshot.world.runId
    }
    for (const trigger of this.tracker.update(snapshot)) {
      const view = new PlayerDeathBurstView(this.root, this.textures, trigger)
      view.setDepth(this.depths.get(trigger.playerId) ?? 1)
      this.active.set(trigger.key, {
        startedPresentationTick: snapshot.tick,
        view,
      })
    }
    for (const [key, active] of this.active) {
      if (active.view.update(snapshot.tick - active.startedPresentationTick)) continue
      active.view.destroy()
      this.active.delete(key)
    }
  }

  setDepth(playerId: string, depth: number): void {
    this.depths.set(playerId, depth)
    for (const active of this.active.values()) {
      if (active.view.playerId === playerId) active.view.setDepth(depth)
    }
  }

  get size(): number {
    return this.active.size
  }

  destroy(): void {
    this.tracker.destroy()
    this.clearActive()
    this.depths.clear()
  }

  private clearActive(): void {
    for (const active of this.active.values()) active.view.destroy()
    this.active.clear()
  }
}

class PlayerDeathBurstView {
  readonly playerId: string
  private readonly container: Container
  private readonly root: Container
  private readonly sprites: readonly Sprite[]
  private readonly trigger: PlayerDeathBurstTrigger

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    trigger: PlayerDeathBurstTrigger,
  ) {
    this.playerId = trigger.playerId
    this.root = root
    this.trigger = trigger
    this.container = new Container({ label: `player-death-burst:${trigger.key}` })
    this.container.eventMode = 'none'
    this.container.position.set(trigger.position.x, trigger.position.y)
    const record = nativeEnemySpriteRecord('BadGuys', 10)
    const texture = requiredTexture(textures, record.source)
    this.sprites = playerDeathBurstLayers(trigger, 0).map(() => {
      const sprite = new Sprite(texture)
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.blendMode = 'add'
      sprite.eventMode = 'none'
      this.container.addChild(sprite)
      return sprite
    })
    root.addChild(this.container)
    this.update(0)
  }

  update(ageTicks: number): boolean {
    const layers = playerDeathBurstLayers(this.trigger, ageTicks)
    if (layers.length === 0) return false
    layers.forEach((layer, index) => {
      const sprite = this.sprites[index]!
      sprite.alpha = layer.alpha
      sprite.label = `player-death-burst:BadGuys:${layer.entry}`
      sprite.position.set(layer.offset.x, layer.offset.y)
      sprite.rotation = layer.rotationRadians
      sprite.scale.set(layer.scale)
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

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Player death-burst texture was not loaded: ${source}`)
  return texture
}
