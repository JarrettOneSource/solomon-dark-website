import { Container, Sprite, type Texture } from 'pixi.js'

import {
  nativeSecondarySpriteRecord,
} from './native-secondary-assets.ts'

export const DAMAGE_X4_VFX_TINT = 0xd8ba70

export interface NativeDamageX4VfxLayer {
  readonly alpha: number
  readonly rotationDegrees: number
  readonly scale: number
}

export function nativeDamageX4VfxPlan(
  remainingTicks: number,
  tick: number,
  emitterScale: number,
): readonly NativeDamageX4VfxLayer[] {
  if (remainingTicks <= 0) return []
  const alpha = Math.min(remainingTicks, 100) / 100
  const fixedTick = Math.floor(tick)
  return Object.freeze([
    Object.freeze({
      alpha,
      rotationDegrees: fixedTick,
      scale: 2.5 * emitterScale,
    }),
    Object.freeze({
      alpha,
      rotationDegrees: -0.5 * fixedTick,
      scale: 2 * emitterScale,
    }),
  ])
}

export class PlayerDamageX4VfxView {
  readonly container = new Container({ label: 'player-damage-x4-vfx' })
  readonly sprites: Sprite[]

  constructor(texture: Texture) {
    const record = nativeSecondarySpriteRecord('BadGuys', 7)
    this.container.eventMode = 'none'
    this.sprites = [0, 1].map(() => {
      const sprite = new Sprite(texture)
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.blendMode = 'add'
      sprite.eventMode = 'none'
      sprite.tint = DAMAGE_X4_VFX_TINT
      sprite.visible = false
      this.container.addChild(sprite)
      return sprite
    })
  }

  update(remainingTicks: number, tick: number, emitterScale: number): void {
    if (!this.container.visible) return
    const plan = nativeDamageX4VfxPlan(remainingTicks, tick, emitterScale)
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!
      const layer = plan[index]
      sprite.visible = layer !== undefined
      if (!layer) continue
      sprite.alpha = layer.alpha
      sprite.rotation = layer.rotationDegrees * Math.PI / 180
      sprite.scale.set(layer.scale)
    }
  }

  get visibleSpriteCount(): number {
    return this.container.visible
      ? this.sprites.filter(({ visible }) => visible).length
      : 0
  }

  get alpha(): number {
    return this.container.visible
      ? this.sprites.find(({ visible }) => visible)?.alpha ?? 0
      : 0
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}
