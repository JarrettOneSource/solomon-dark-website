import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  multiplyWaterFrostTint,
  waterFrostJetPlan,
  type WaterFrostJetDraw,
} from '../core-kernels/primary-spell-water.ts'

export interface WaterPrimarySpellTextures {
  core: Texture
  glint: Texture
}

export class WaterPrimarySpellView {
  readonly container: Container
  private readonly additiveCore: Sprite
  private readonly core: Sprite
  private state: PrimarySpellTransientState
  private readonly glint: Sprite
  private worldTint = 0xffffff

  constructor(state: PrimarySpellTransientState, textures: WaterPrimarySpellTextures) {
    this.state = state
    this.container = new Container({ label: 'water' })
    this.container.eventMode = 'none'
    this.core = frostSprite(textures.core, 'normal')
    this.additiveCore = frostSprite(textures.core, 'add')
    this.glint = frostSprite(textures.glint, 'add')
    this.container.addChild(this.core, this.additiveCore, this.glint)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'water') return
    this.state = state
    const plan = waterFrostJetPlan(state)
    this.container.position.set(plan.position.x, plan.position.y)
    this.apply(this.core, plan.draws.find((draw) => draw.pass === 'core'), plan.position)
    this.apply(
      this.additiveCore,
      plan.draws.find((draw) => draw.pass === 'additive-core'),
      plan.position,
    )
    this.apply(this.glint, plan.draws.find((draw) => draw.pass === 'glint'), plan.position)
  }

  get worldY(): number {
    return waterFrostJetPlan(this.state).worldY
  }

  setTint(tint: number): void {
    this.worldTint = tint
    this.update(this.state)
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }

  private apply(sprite: Sprite, draw: WaterFrostJetDraw | undefined, origin: {
    x: number
    y: number
  }): void {
    sprite.visible = draw !== undefined
    if (!draw) return
    sprite.position.set(draw.position.x - origin.x, draw.position.y - origin.y)
    sprite.rotation = draw.rotation
    sprite.scale.set(draw.scale)
    sprite.alpha = draw.alpha
    sprite.tint = multiplyWaterFrostTint(this.worldTint, draw.tint)
  }
}

function frostSprite(texture: Texture, blend: 'add' | 'normal'): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.blendMode = blend
  sprite.eventMode = 'none'
  return sprite
}
