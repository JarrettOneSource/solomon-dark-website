import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  ETHER_PRIMARY_ROOT_OFFSET,
  etherPrimaryFlightPlan,
  type EtherPrimarySprite,
} from './primary-spell-ether-native.ts'

export type EtherPrimaryTextures = Readonly<Record<EtherPrimarySprite, Texture>>

export class EtherPrimarySpellView {
  readonly container = new Container({ label: 'ether' })
  readonly containers: readonly Container[]
  private readonly compositor = new Container({ label: 'ether-flight-compositor' })
  readonly kind = 'ether'
  private readonly nativeTints: number[] = []
  private readonly sprites: Sprite[] = []
  private state: PrimarySpellProjectileState
  private readonly textures: EtherPrimaryTextures
  private worldTint = 0xffffff

  constructor(state: PrimarySpellProjectileState, textures: EtherPrimaryTextures) {
    if (state.kind !== 'ether') throw new Error('EtherPrimarySpellView requires an Ether actor')
    this.state = state
    this.textures = textures
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.compositor.eventMode = 'none'
    this.compositor.position.set(ETHER_PRIMARY_ROOT_OFFSET.x, ETHER_PRIMARY_ROOT_OFFSET.y)
    this.container.addChild(this.compositor)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('position' in state) || state.kind !== 'ether') return
    this.state = state
    this.container.position.set(state.position.x, state.position.y)
    const plan = etherPrimaryFlightPlan(state.id, state.ageTicks)
    while (this.sprites.length < plan.draws.length) {
      const sprite = new Sprite()
      sprite.anchor.set(0.5)
      sprite.eventMode = 'none'
      this.compositor.addChild(sprite)
      this.sprites.push(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]
      const operation = plan.draws[index]
      sprite.visible = operation !== undefined
      if (!operation) continue
      sprite.texture = this.textures[operation.sprite]
      sprite.blendMode = operation.blend
      sprite.position.set(operation.x, operation.y)
      sprite.rotation = operation.rotationDegrees * Math.PI / 180
      sprite.scale.set(operation.scale)
      sprite.alpha = operation.alpha
      this.nativeTints[index] = operation.tint
      sprite.tint = multiplyTints(operation.tint, this.worldTint)
    }
  }

  get worldY(): number {
    return this.state.position.y
  }

  painterRoots(): readonly EtherPainterRoot[] {
    return [{ container: this.container, suffix: '', worldY: this.worldY }]
  }

  setTint(tint: number): void {
    this.worldTint = tint
    for (let index = 0; index < this.sprites.length; index += 1) {
      this.sprites[index].tint = multiplyTints(this.nativeTints[index] ?? 0xffffff, tint)
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.nativeTints.length = 0
    this.sprites.length = 0
  }
}

interface EtherPainterRoot {
  container: Container
  suffix: string
  worldY: number
}

function multiplyTints(left: number, right: number): number {
  const channel = (shift: number): number => Math.round(
    ((left >> shift) & 0xff) * ((right >> shift) & 0xff) / 0xff,
  )
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
