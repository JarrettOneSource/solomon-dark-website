import { Container, Sprite, type Texture } from 'pixi.js'
import type { NativeDeathWeaponActor } from '../core-kernels/native-death-animations.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export interface PlayerDeathWeaponPainterLayer {
  readonly id: string
  readonly weaponId: number
  readonly playerId: string
  readonly position: Readonly<Vector2>
  readonly registration: NativeWorldManagerRegistration
  readonly worldY: number
}

/** Independent world animations; a dead or absent owner does not retire a drop. */
export class PlayerDeathWeaponViews {
  private readonly active = new Map<number, PlayerDeathWeaponView>()
  private readonly root: Container
  private readonly textures: PlayerWorldTextures
  private runId: string
  constructor(root: Container, textures: PlayerWorldTextures, initialSnapshot: GameSnapshot) {
    if (initialSnapshot.world.kind !== 'boneyard') throw new Error('Player death-weapon views require a Boneyard snapshot')
    this.runId = initialSnapshot.world.runId
    this.root = root
    this.textures = textures
  }
  update(snapshot: GameSnapshot): void {
    if (snapshot.world.kind !== 'boneyard') throw new Error('Player death-weapon views require a Boneyard snapshot')
    if (snapshot.world.runId !== this.runId) { this.clear(); this.runId = snapshot.world.runId }
    const live = new Set<number>()
    for (const actor of snapshot.world.deathWeapons) {
      live.add(actor.id)
      if (!this.active.has(actor.id)) this.active.set(actor.id, new PlayerDeathWeaponView(this.root, this.textures, actor))
      this.active.get(actor.id)!.update(actor)
    }
    for (const [id, view] of this.active) if (!live.has(id)) { view.destroy(); this.active.delete(id) }
  }
  painterLayers(): readonly PlayerDeathWeaponPainterLayer[] {
    return [...this.active.entries()].map(([id, view]) => ({ id: `player-death-weapon:${id}`, weaponId: id,
      playerId: view.actor.ownerId, position: view.position, worldY: view.position.y, registration: view.actor.painterRegistration }))
  }
  setDepth(id: number, depth: number): void { this.active.get(id)?.setDepth(depth) }
  setRenderable(renderable: boolean): void { for (const view of this.active.values()) view.setRenderable(renderable) }
  setTint(id: number, tint: number): void { this.active.get(id)?.setTint(tint) }
  get size(): number { return this.active.size }
  destroy(): void { this.clear() }
  private clear(): void { for (const view of this.active.values()) view.destroy(); this.active.clear() }
}

class PlayerDeathWeaponView {
  private readonly container: Container
  private readonly root: Container
  private readonly shadow: Sprite
  private readonly sprite: Sprite
  actor: NativeDeathWeaponActor
  constructor(root: Container, textures: PlayerWorldTextures, actor: NativeDeathWeaponActor) {
    this.actor = actor
    this.root = root
    const source = actor.weapon.kind === 'staff' ? textures.death.weapon.staff[actor.weapon.selector] : textures.death.weapon.wand
    if (!source) throw new Error(`Missing native ${actor.weapon.kind} death texture`)
    this.container = new Container({ label: `player-death-weapon:${actor.id}` })
    this.container.eventMode = 'none'
    this.shadow = deathWeaponSprite(source, `player-death-weapon-shadow:${actor.id}`)
    this.shadow.position.set(0, 2)
    this.shadow.scale.set(1, .75)
    this.shadow.tint = 0
    this.sprite = deathWeaponSprite(source, `player-death-weapon:${actor.id}`)
    this.container.addChild(this.shadow, this.sprite)
    root.addChild(this.container)
  }
  update(actor: NativeDeathWeaponActor): void {
    this.actor = actor
    this.container.position.set(actor.motion.position.x, actor.motion.position.y)
    const rotation = actor.motion.rotationDegrees * Math.PI / 180
    this.shadow.rotation = rotation
    this.sprite.position.set(0, actor.motion.height)
    this.sprite.rotation = rotation
    this.shadow.alpha = this.sprite.alpha = Math.min(1, actor.life)
  }
  get position(): Readonly<Vector2> { return { x: this.container.x, y: this.container.y } }
  setDepth(depth: number): void { this.container.zIndex = depth }
  setRenderable(renderable: boolean): void { this.container.renderable = renderable }
  setTint(tint: number): void { this.sprite.tint = tint }
  destroy(): void { this.root.removeChild(this.container); this.container.destroy({ children: true }) }
}
function deathWeaponSprite(texture: Texture, label: string): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(.5)
  sprite.eventMode = 'none'
  sprite.label = label
  return sprite
}
