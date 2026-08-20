import { Container, Sprite } from 'pixi.js'

import type {
  NativePlayerStaffPikeBreakVfx,
  NativePlayerStaffVfx,
} from '../core-kernels/native-player-staff-action.ts'
import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  nativePlayerStaffPikeBreakDraws,
  nativePlayerStaffVfxRenderPlan,
} from './player-staff-vfx-presentation.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export class PlayerStaffVfxView {
  readonly containers: readonly Container[]
  readonly kind = 'player-staff-vfx'
  private readonly root = new Container({ label: 'player-staff-vfx' })
  private readonly sprite: Sprite
  private state: NativePlayerStaffVfx

  constructor(state: NativePlayerStaffVfx, textures: PlayerWorldTextures) {
    this.state = state
    this.sprite = new Sprite(textures.secondary[`BadGuys:${state.entry}`])
    // All four recovered Staff records have native origin (0,0), so the
    // registration anchor is exactly the logical-canvas center.
    this.sprite.anchor.set(0.5)
    this.sprite.eventMode = 'none'
    this.root.eventMode = 'none'
    this.root.addChild(this.sprite)
    this.containers = [this.root]
    this.updateState(state)
  }

  update(
    state: PrimarySpellProjectileState | PrimarySpellTransientState,
  ): void {
    if (
      state.kind !== 'player-staff-smoke'
      && state.kind !== 'player-staff-move-fade'
      && state.kind !== 'player-staff-perspective-fade'
    ) throw new Error('PlayerStaffVfxView received a non-Staff effect')
    this.updateState(state)
  }

  painterRoots() {
    return [{
      container: this.root,
      lane: 'world-sorted' as const,
      queueFamily: 'ordinary-dynamic' as const,
      regionLightPoint: null,
      sortBias: 0,
      suffix: '',
      worldY: this.state.position.y,
    }]
  }

  setTint(_suffix: string, tint: number): void {
    if (this.state.kind === 'player-staff-smoke') this.sprite.tint = tint
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }

  private updateState(state: NativePlayerStaffVfx): void {
    this.state = state
    const plan = nativePlayerStaffVfxRenderPlan(state)
    this.root.position.set(plan.position.x, plan.position.y)
    this.sprite.alpha = plan.alpha
    this.sprite.blendMode = plan.blendMode
    this.sprite.rotation = plan.rotationRadians
    this.sprite.scale.set(plan.scale)
    if (plan.tint !== null) this.sprite.tint = plan.tint
  }
}

export class PlayerStaffPikeBreakView {
  readonly containers: readonly Container[]
  readonly kind = 'player-staff-pike-break'
  private readonly root = new Container({ label: 'player-staff-pike-break' })
  private readonly sprites: Sprite[] = []
  private state: NativePlayerStaffPikeBreakVfx
  private readonly textures: PlayerWorldTextures
  private worldTint = 0xffffff

  constructor(state: NativePlayerStaffPikeBreakVfx, textures: PlayerWorldTextures) {
    this.state = state
    this.textures = textures
    this.root.eventMode = 'none'
    this.containers = [this.root]
    this.updateState(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (state.kind !== 'player-staff-pike-break') {
      throw new Error('PlayerStaffPikeBreakView received a non-PikeBreak effect')
    }
    this.updateState(state)
  }

  painterRoots() {
    return [{
      container: this.root,
      lane: 'world-sorted' as const,
      queueFamily: 'ordinary-dynamic' as const,
      regionLightPoint: null,
      sortBias: 0,
      suffix: '',
      worldY: this.state.position.y,
    }]
  }

  setTint(_suffix: string, tint: number): void {
    this.worldTint = tint
    this.updateTints()
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }

  private updateState(state: NativePlayerStaffPikeBreakVfx): void {
    this.state = state
    this.root.position.set(state.position.x, state.position.y)
    const draws = nativePlayerStaffPikeBreakDraws(state)
    while (this.sprites.length < draws.length) {
      const sprite = new Sprite()
      sprite.anchor.set(0.5)
      sprite.eventMode = 'none'
      this.sprites.push(sprite)
      this.root.addChild(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!
      const draw = draws[index]
      sprite.visible = draw !== undefined
      if (draw === undefined) continue
      sprite.texture = this.textures.secondary[`BadGuys:${draw.entry}`]
      sprite.alpha = draw.alpha
      sprite.blendMode = draw.blendMode
      sprite.position.set(draw.offset.x, draw.offset.y)
      sprite.rotation = draw.rotationRadians
      sprite.scale.set(draw.scaleX, draw.scaleY)
      sprite.tint = draw.tint ?? this.worldTint
    }
  }

  private updateTints(): void {
    const draws = nativePlayerStaffPikeBreakDraws(this.state)
    for (let index = 0; index < draws.length; index += 1) {
      this.sprites[index]!.tint = draws[index]!.tint ?? this.worldTint
    }
  }
}
