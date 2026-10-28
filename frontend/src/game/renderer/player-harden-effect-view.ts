import { Container, Sprite } from 'pixi.js'
import type { NativeHardenEffect } from '../core-kernels/native-harden-effects.ts'
import type { PrimarySpellProjectileState, PrimarySpellTransientState } from '../core-kernels/primary-spells.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export class PlayerHardenEffectView {
  readonly containers: readonly Container[]
  private readonly root: Container
  private readonly sprite: Sprite
  private readonly shadow: Sprite | null
  private state: NativeHardenEffect

  constructor(state: NativeHardenEffect, textures: PlayerWorldTextures['secondary']) {
    this.state = state
    this.root = new Container({ label: state.kind })
    this.root.eventMode = 'none'
    this.containers = [this.root]
    const entry = state.kind === 'harden-shard' ? state.record : 15
    this.sprite = new Sprite(textures[`BadGuys:${entry}`])
    // BadGuys 15 and 446..450 all have native origin (0,0).
    this.sprite.anchor.set(0.5)
    this.sprite.blendMode = state.kind === 'harden-burst' ? 'normal' : 'add'
    this.sprite.eventMode = 'none'
    this.shadow = state.kind === 'harden-shard'
      ? new Sprite({ texture: this.sprite.texture, label: 'harden-born-shadow', eventMode: 'none' }) : null
    if (this.shadow) {
      this.shadow.anchor.set(.5)
      this.shadow.tint = 0
      // AdditiveBouncer 0x00528D10 keeps additive blending around both
      // inherited draws. Its black shadow must not darken the world.
      this.shadow.blendMode = 'add'
      this.shadow.position.y = 2
      this.shadow.scale.y = .75
      this.root.addChild(this.shadow)
    }
    this.root.addChild(this.sprite)
    this.update(state)
  }

  get kind(): string { return this.state.kind }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (state.kind !== 'harden-shard' && state.kind !== 'harden-burst') {
      throw new TypeError('Harden view requires a Harden actor')
    }
    this.state = state
    this.root.position.set(state.position.x, state.position.y)
    if (state.kind === 'harden-burst') {
      this.sprite.alpha = state.alpha
      this.sprite.scale.set(3.5)
    } else {
      this.sprite.alpha = Math.min(1, state.life)
      this.sprite.position.y = state.height
      this.sprite.angle = state.rotationDegrees
      if (this.shadow) {
        this.shadow.visible = state.enhancedShadow
        this.shadow.alpha = Math.min(1, state.life)
        this.shadow.angle = state.rotationDegrees
      }
    }
  }

  painterRoots() {
    return [{
      container: this.root,
      lane: this.state.kind === 'harden-shard' ? 'post-world-queue' as const : 'world-sorted' as const,
      queueFamily: this.state.kind === 'harden-shard' ? null : 'ordinary-dynamic' as const,
      regionLightPoint: null,
      sortBias: this.state.kind === 'harden-burst' ? 10 : 0,
      suffix: '',
      worldY: this.state.position.y,
    }]
  }

  setTint(_suffix: string, tint: number): void { this.sprite.tint = tint }

  destroy(): void { this.root.destroy({ children: true }) }
}
