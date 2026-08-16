import { Container, Sprite, type Texture } from 'pixi.js'

import { playerDeathEquipmentAppearance } from '../player-character-presentation.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { GameSnapshot, ProtocolPlayerState } from '../protocol/game-state.ts'
import {
  playerDeathWeaponSample,
  type PlayerDeathWeaponTrigger,
} from './player-death-weapon-presentation.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

interface ActiveDeathWeapon {
  readonly deathEpoch: number
  readonly view: PlayerDeathWeaponView
}

export interface PlayerDeathWeaponPainterLayer {
  readonly id: string
  readonly playerId: string
  readonly position: Readonly<Vector2>
  readonly worldY: number
}

export class PlayerDeathWeaponViews {
  private readonly active = new Map<string, ActiveDeathWeapon>()
  private readonly root: Container
  private runId: string
  private readonly textures: PlayerWorldTextures

  constructor(
    root: Container,
    textures: PlayerWorldTextures,
    initialSnapshot: GameSnapshot,
  ) {
    if (initialSnapshot.world.kind !== 'boneyard') {
      throw new Error('Player death-weapon views require a Boneyard snapshot')
    }
    this.root = root
    this.runId = initialSnapshot.world.runId
    this.textures = textures
  }

  update(snapshot: GameSnapshot): void {
    if (snapshot.world.kind !== 'boneyard') {
      throw new Error('Player death-weapon views require a Boneyard snapshot')
    }
    if (snapshot.world.runId !== this.runId) {
      this.clear()
      this.runId = snapshot.world.runId
    }
    const liveIds = new Set<string>()
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      if (player.progression.lifeState !== 'dying'
        && player.progression.lifeState !== 'spectating') continue
      liveIds.add(playerId)
      const current = this.active.get(playerId)
      if (!current || current.deathEpoch !== player.progression.deathEpoch) {
        current?.view.destroy()
        const view = new PlayerDeathWeaponView(
          this.root,
          this.textures,
          this.runId,
          playerId,
          player,
        )
        this.active.set(playerId, {
          deathEpoch: player.progression.deathEpoch,
          view,
        })
      }
      this.active.get(playerId)!.view.update(player)
    }
    for (const [playerId, active] of this.active) {
      if (liveIds.has(playerId)) continue
      active.view.destroy()
      this.active.delete(playerId)
    }
  }

  painterLayers(): readonly PlayerDeathWeaponPainterLayer[] {
    return [...this.active.entries()].map(([playerId, active]) => ({
      id: `player-death-weapon:${playerId}`,
      playerId,
      position: active.view.position,
      worldY: active.view.position.y,
    }))
  }

  setDepth(playerId: string, depth: number): void {
    const active = this.active.get(playerId)
    if (active) active.view.setDepth(depth)
  }

  setRenderable(renderable: boolean): void {
    for (const active of this.active.values()) active.view.setRenderable(renderable)
  }

  setTint(playerId: string, tint: number): void {
    const active = this.active.get(playerId)
    if (active) active.view.setTint(tint)
  }

  get size(): number {
    return this.active.size
  }

  destroy(): void {
    this.clear()
  }

  private clear(): void {
    for (const active of this.active.values()) active.view.destroy()
    this.active.clear()
  }
}

class PlayerDeathWeaponView {
  private readonly container: Container
  private readonly origin: Readonly<Vector2>
  private readonly root: Container
  private readonly shadow: Sprite
  private readonly sprite: Sprite
  private readonly trigger: PlayerDeathWeaponTrigger

  constructor(
    root: Container,
    textures: PlayerWorldTextures,
    runId: string,
    playerId: string,
    player: ProtocolPlayerState,
  ) {
    const appearance = playerDeathEquipmentAppearance(
      player.config.element,
      player.economy.equipment,
    )
    const source = appearance.weapon.kind === 'staff'
      ? textures.death.weapon.staff[appearance.weapon.selector]
      : textures.death.weapon.wand
    if (!source) throw new Error(`Missing native ${appearance.weapon.kind} death texture`)
    this.root = root
    this.origin = { ...player.position }
    this.trigger = {
      deathEpoch: player.progression.deathEpoch,
      headingIndex: player.headingIndex,
      playerId,
      runId,
      weapon: appearance.weapon,
    }
    this.container = new Container({ label: `player-death-weapon:${playerId}` })
    this.container.eventMode = 'none'
    this.shadow = deathWeaponSprite(source, `player-death-weapon-shadow:${playerId}`)
    this.shadow.alpha = 1
    this.shadow.position.set(0, 2)
    this.shadow.scale.set(1, 0.75)
    this.shadow.tint = 0x000000
    this.sprite = deathWeaponSprite(source, `player-death-weapon:${playerId}`)
    this.container.addChild(this.shadow, this.sprite)
    root.addChild(this.container)
  }

  update(player: ProtocolPlayerState): void {
    const sample = playerDeathWeaponSample(this.trigger, player.progression.deathTick)
    this.container.position.set(
      this.origin.x + sample.offset.x,
      this.origin.y + sample.offset.y,
    )
    this.shadow.rotation = sample.rotationRadians
    this.sprite.position.set(0, sample.height)
    this.sprite.rotation = sample.rotationRadians
  }

  get position(): Readonly<Vector2> {
    return { x: this.container.x, y: this.container.y }
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  setTint(tint: number): void {
    this.sprite.tint = tint
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function deathWeaponSprite(texture: Texture, label: string): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.eventMode = 'none'
  sprite.label = label
  return sprite
}
