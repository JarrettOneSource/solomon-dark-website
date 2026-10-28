import { Container, Sprite, type Texture } from 'pixi.js'
import { nativePlayerGroundLightTint } from '../core-kernels/native-skill-colors.ts'
import { nativeDirectEnvironmentLightAlpha, type BoneyardGroundLightPlayer } from './boneyard-environment-light-plan.ts'

/** Arena +0x110 draws each player's aperture before its optional compact mask. */
export class BoneyardEnvironmentLightView {
  private readonly sprites = new Map<string, Sprite>()
  private readonly root: Container
  private readonly texture: Texture

  constructor(root: Container, texture: Texture) {
    this.root = root
    this.texture = texture
  }

  update(players: Readonly<Record<string, BoneyardGroundLightPlayer>>, now: number): void {
    let slot = 0
    for (const [id, player] of Object.entries(players)) {
      let sprite = this.sprites.get(id)
      if (!sprite) {
        sprite = new Sprite(this.texture)
        sprite.label = `boneyard-environment-light:${id}`
        sprite.eventMode = 'none'
        sprite.blendMode = 'add'
        sprite.anchor.set(168 / this.texture.width, 153 / this.texture.height)
        this.root.addChild(sprite)
        this.sprites.set(id, sprite)
      }
      sprite.position.copyFrom(player.position)
      sprite.tint = nativePlayerGroundLightTint(player.progression.selectedPrimarySkillId, player.progression.weldBuildId)
      sprite.alpha = nativeDirectEnvironmentLightAlpha(now, slot)
      sprite.zIndex = slot * 2
      slot += 1
    }
    for (const [id, sprite] of this.sprites) {
      if (players[id]) continue
      sprite.destroy()
      this.sprites.delete(id)
    }
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) sprite.destroy()
    this.sprites.clear()
  }

  get diagnosticSamples(): readonly Readonly<{ playerId: string; alpha: number; x: number; y: number }>[] {
    return [...this.sprites].map(([playerId, sprite]) => ({
      playerId, alpha: sprite.alpha, x: sprite.x, y: sprite.y,
    }))
  }
}
