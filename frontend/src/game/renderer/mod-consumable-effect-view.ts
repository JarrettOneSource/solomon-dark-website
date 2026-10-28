import { Container, Sprite, Texture } from 'pixi.js'

import type { GameSnapshot, ProtocolModEffect } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeLootSpriteRecord } from './native-loot-assets.ts'
import {
  MOD_CONSUMABLE_TEXTURE_SIZE,
  modConsumableEffectId,
  modConsumableEffectPlan,
  modConsumableRingAlpha,
} from './mod-consumable-effect-presentation.ts'

export class ModConsumableEffectViews {
  readonly #live = new Set<string>()
  readonly #root: Container
  readonly #ringTexture: Texture
  readonly #textures: BoneyardWorldTextures
  readonly #views = new Map<string, ModConsumableEffectView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.#root = root
    this.#textures = textures
    this.#ringTexture = createRingTexture()
  }

  update(snapshot: GameSnapshot): void {
    this.#live.clear()
    for (const effect of snapshot.modEffects) {
      const player = snapshot.players[effect.playerId]
      if (!player) continue
      const id = modConsumableEffectId(effect)
      this.#live.add(id)
      let view = this.#views.get(id)
      if (!view) {
        view = new ModConsumableEffectView(
          this.#root,
          this.#textures,
          this.#ringTexture,
          effect,
        )
        this.#views.set(id, view)
      }
      view.update(effect, player.position, snapshot.tick)
    }
    for (const [id, view] of this.#views) {
      if (this.#live.has(id)) continue
      view.destroy()
      this.#views.delete(id)
    }
  }

  setDepth(id: string, depth: number): void {
    this.#views.get(id)?.setDepth(depth)
  }

  setTint(id: string, tint: number): void {
    this.#views.get(id)?.setTint(tint)
  }

  get size(): number {
    return this.#views.size
  }

  destroy(): void {
    for (const view of this.#views.values()) view.destroy()
    this.#views.clear()
    this.#live.clear()
    this.#ringTexture.destroy(true)
  }
}

class ModConsumableEffectView {
  readonly #container: Container
  readonly #flash: readonly Sprite[]
  readonly #ring: Sprite
  readonly #root: Container

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    ringTexture: Texture,
    effect: ProtocolModEffect,
  ) {
    this.#root = root
    this.#container = new Container({ label: modConsumableEffectId(effect) })
    this.#container.eventMode = 'none'
    this.#ring = new Sprite(ringTexture)
    this.#ring.anchor.set(0.5)
    this.#ring.blendMode = 'normal'
    const glow = nativeLootSpriteRecord('BadGuys', 110)
    const glowTexture = textures.base[glow.source]
    if (!glowTexture) throw new Error('BadGuys record 110 is unavailable for consumable VFX')
    this.#flash = Array.from({ length: 4 }, (_, index) => {
      const sprite = new Sprite(glowTexture)
      sprite.anchor.set(glow.anchorX / glow.width, glow.anchorY / glow.height)
      sprite.blendMode = 'add'
      sprite.label = `mod-consumable-activation-${index}`
      return sprite
    })
    this.#container.addChild(this.#ring, ...this.#flash)
    root.addChild(this.#container)
  }

  update(
    effect: ProtocolModEffect,
    position: Readonly<{ x: number; y: number }>,
    tick: number,
  ): void {
    this.#container.position.set(position.x, position.y)
    const plan = modConsumableEffectPlan(effect, tick)
    this.#ring.scale.set(plan.radius * 2 / MOD_CONSUMABLE_TEXTURE_SIZE)
    this.#ring.tint = plan.tint
    this.#ring.alpha = plan.alpha
    this.#flash.forEach((sprite, index) => {
      sprite.visible = plan.flashVisible
      sprite.scale.set(plan.flashScales[index]!)
      sprite.rotation = plan.flashRotations[index]!
      sprite.tint = plan.tint
      sprite.alpha = plan.flashAlphas[index]!
    })
  }

  setDepth(depth: number): void {
    this.#container.zIndex = depth
  }

  setTint(tint: number): void {
    this.#container.tint = tint
  }

  destroy(): void {
    this.#root.removeChild(this.#container)
    this.#container.destroy({ children: true })
  }
}

function createRingTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = MOD_CONSUMABLE_TEXTURE_SIZE
  canvas.height = MOD_CONSUMABLE_TEXTURE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: false })
  if (!context) throw new Error('mod consumable VFX canvas is unavailable')
  const image = context.createImageData(MOD_CONSUMABLE_TEXTURE_SIZE, MOD_CONSUMABLE_TEXTURE_SIZE)
  for (let y = 0; y < MOD_CONSUMABLE_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < MOD_CONSUMABLE_TEXTURE_SIZE; x += 1) {
      const alpha = modConsumableRingAlpha(x, y)
      const offset = (y * MOD_CONSUMABLE_TEXTURE_SIZE + x) * 4
      image.data[offset] = 255
      image.data[offset + 1] = 255
      image.data[offset + 2] = 255
      image.data[offset + 3] = Math.round(alpha * 210)
    }
  }
  context.putImageData(image, 0, 0)
  return Texture.from(canvas, true)
}
