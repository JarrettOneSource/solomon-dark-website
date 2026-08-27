import { Container, Sprite } from 'pixi.js'

import type { WizardElement } from '../core-kernels/player-character.ts'
import {
  nativeElementVfxPlan,
  nativeSelectedPrimaryElementVfxPlan,
  type NativeElementVfxColor,
  type NativeElementVfxDraw,
  type NativeElementVfxSprite,
} from '../element-vfx-native.ts'

export type NativeElementVfxTextures = Readonly<
  Partial<Record<NativeElementVfxSprite, readonly import('pixi.js').Texture[]>>
>

export class NativeElementVfxView {
  readonly container = new Container({ label: 'native-element-vfx' })
  readonly sprites: Sprite[] = []
  private readonly element: WizardElement | null
  private readonly textures: NativeElementVfxTextures
  private currentSelectedPrimaryId: number | null = null
  private lastProgram = ''
  private lastScale = Number.NaN
  private lastTick = Number.NaN

  constructor(element: WizardElement | null, textures: NativeElementVfxTextures) {
    this.element = element
    this.textures = textures
    this.container.eventMode = 'none'
  }

  update(tick: number, scale = 1): void {
    const element = this.element
    if (element === null) {
      throw new Error('Selected-primary element VFX requires updateSelectedPrimary()')
    }
    this.currentSelectedPrimaryId = null
    this.updatePlan(
      `element:${element}`,
      tick,
      scale,
      () => nativeElementVfxPlan(element, Math.floor(tick), scale),
    )
  }

  updateSelectedPrimary(
    selectedPrimaryId: number,
    tick: number,
    scale = 1,
  ): void {
    this.currentSelectedPrimaryId = selectedPrimaryId
    this.updatePlan(
      `primary:${selectedPrimaryId}`,
      tick,
      scale,
      () => nativeSelectedPrimaryElementVfxPlan(selectedPrimaryId, tick, scale),
    )
  }

  get selectedPrimaryId(): number | null {
    return this.currentSelectedPrimaryId
  }

  private updatePlan(
    program: string,
    tick: number,
    scale: number,
    createPlan: () => readonly NativeElementVfxDraw[],
  ): void {
    if (!this.container.visible) return
    const integerTick = Math.floor(tick)
    if (
      program === this.lastProgram
      && integerTick === this.lastTick
      && scale === this.lastScale
    ) return
    this.lastProgram = program
    this.lastTick = integerTick
    this.lastScale = scale
    const plan = createPlan()
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
      sprite.anchor.set(operation.anchor?.[0] ?? 0.5, operation.anchor?.[1] ?? 0.5)
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
