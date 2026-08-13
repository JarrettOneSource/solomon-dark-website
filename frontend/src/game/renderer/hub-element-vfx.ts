import { Container, Sprite } from 'pixi.js'
import type { WizardElement } from '../core-kernels/player-character.ts'
import {
  nativeElementVfxPlan,
  type NativeElementVfxColor,
} from '../element-vfx-native.ts'
import type { HubWorldTextures } from './hub-textures.ts'

export class HubElementVfx {
  readonly container = new Container({ label: 'native-element-orb' })
  readonly sprites: Sprite[] = []
  private readonly element: WizardElement
  private readonly textures: HubWorldTextures['elementVfx']

  constructor(
    element: WizardElement,
    textures: HubWorldTextures['elementVfx'],
  ) {
    this.element = element
    this.textures = textures
    this.container.eventMode = 'none'
  }

  update(tick: number): void {
    const plan = nativeElementVfxPlan(this.element, tick, 1)
    while (this.sprites.length < plan.length) {
      const sprite = new Sprite()
      sprite.anchor.set(0.5)
      sprite.eventMode = 'none'
      this.container.addChild(sprite)
      this.sprites.push(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]
      const operation = plan[index]
      sprite.visible = Boolean(operation)
      if (!operation) continue
      const frames = this.textures[operation.sprite]
      if (!frames) throw new Error(`Missing ${operation.sprite} element VFX texture`)
      const frame = ((operation.frame % frames.length) + frames.length) % frames.length
      sprite.texture = frames[frame]
      sprite.alpha = Math.max(0, Math.min(1, operation.alpha))
      sprite.blendMode = operation.blend === 'lighter' ? 'add' : 'normal'
      sprite.position.set(operation.x, operation.y)
      sprite.rotation = operation.rotation * Math.PI / 180
      sprite.scale.set(operation.scale)
      sprite.tint = colorToTint(operation.color)
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

export function colorToTint(color: NativeElementVfxColor): number {
  const channel = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255)
  return (channel(color[0]) << 16) | (channel(color[1]) << 8) | channel(color[2])
}
