import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellFireParticleState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_FIREBALL_FRAME_FIRST,
  NATIVE_FIRE_PARTICLE_FRAME_FIRST,
  nativeFireballPlan,
  nativeFireParticlePlan,
  type NativeFireballDraw,
} from './primary-spell-fire-native.ts'

export interface PrimarySpellFireTextures {
  core: Texture
  frames: readonly Texture[]
  particles: readonly Texture[]
}

interface FirePainterRoot {
  container: Container
  regionLightPoint: null
  suffix: string
  worldY: number
}

export class FirePrimarySpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly additiveBody: Sprite
  private readonly body: Sprite
  private readonly core: Sprite
  readonly kind = 'fire'
  private state: PrimarySpellProjectileState
  private readonly textures: PrimarySpellFireTextures

  constructor(state: PrimarySpellProjectileState, textures: PrimarySpellFireTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: 'fire' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.core = fireSprite(textures.core, 'normal')
    this.additiveBody = fireSprite(textures.frames[0], 'add')
    this.body = fireSprite(textures.frames[0], 'normal')
    this.container.addChild(this.core, this.additiveBody, this.body)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('position' in state) || state.kind !== 'fire') return
    this.state = state
    const plan = nativeFireballPlan(state)
    this.container.position.set(plan.position.x, plan.position.y)
    this.apply(this.core, plan.draws[0])
    this.apply(this.additiveBody, plan.draws[1])
    this.apply(this.body, plan.draws[2])
  }

  painterRoots(): readonly FirePainterRoot[] {
    const plan = nativeFireballPlan(this.state)
    return [{
      container: this.container,
      regionLightPoint: plan.regionLightPoint,
      suffix: '',
      worldY: plan.worldY,
    }]
  }

  setTint(_tint: number): void {
    // Native Fireball bypasses the common Puppet Region-light dispatcher.
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }

  private apply(sprite: Sprite, draw: NativeFireballDraw): void {
    sprite.position.set(draw.x, draw.y)
    sprite.rotation = draw.rotation
    sprite.scale.set(draw.scaleX, draw.scaleY)
    sprite.alpha = draw.alpha
    sprite.tint = draw.tint
    if (draw.pass !== 'core') {
      sprite.texture = this.textures.frames[draw.frame - NATIVE_FIREBALL_FRAME_FIRST]
    }
  }
}

export class FireParticleSpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly kind = 'fire-particle'
  private readonly particle: Sprite
  private state: PrimarySpellFireParticleState
  private readonly textures: PrimarySpellFireTextures

  constructor(state: PrimarySpellFireParticleState, textures: PrimarySpellFireTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: 'fire-particle' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.particle = fireSprite(textures.particles[state.variant], 'add')
    this.container.addChild(this.particle)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'fire') return
    this.state = state
    const plan = nativeFireParticlePlan(state)
    this.container.position.set(plan.position.x, plan.position.y)
    this.particle.texture = this.textures.particles[
      plan.frame - NATIVE_FIRE_PARTICLE_FRAME_FIRST
    ]
    this.particle.rotation = plan.rotation
    this.particle.scale.set(plan.scale)
    this.particle.alpha = plan.alpha
    this.particle.tint = plan.tint
  }

  painterRoots(): readonly FirePainterRoot[] {
    const plan = nativeFireParticlePlan(this.state)
    return [{
      container: this.container,
      regionLightPoint: plan.regionLightPoint,
      suffix: '',
      worldY: plan.worldY,
    }]
  }

  setTint(_tint: number): void {
    // Ordinary ZAnim dispatches directly to the self-modulated child draw.
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

function fireSprite(texture: Texture, blend: 'add' | 'normal'): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.blendMode = blend
  sprite.eventMode = 'none'
  return sprite
}
