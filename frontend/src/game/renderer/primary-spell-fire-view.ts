import { Container, Sprite, Texture } from 'pixi.js'

import type {
  PrimarySpellFireEmberState,
  PrimarySpellFireExplosionState,
  PrimarySpellFireGoodImpState,
  PrimarySpellFireImpactState,
  PrimarySpellFirePatchState,
  PrimarySpellFireParticleState,
  PrimarySpellFireProjectileState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_FIREBALL_FRAME_FIRST,
  NATIVE_FIRE_IMPACT_FRAME_FIRST,
  NATIVE_FIRE_PARTICLE_FRAME_FIRST,
  nativeFireEmberPlan,
  nativeFireExplosionPlan,
  nativeFireGoodImpPlan,
  nativeFireballPlan,
  nativeFireImpactPlan,
  nativeFirePatchPlan,
  nativeFireGroundGlowPlan,
  nativeFireParticlePlan,
  type NativeFireballDraw,
  type NativeFireImpactDraw,
} from './primary-spell-fire-native.ts'
import { nativeEnemySpriteRegistration } from './native-enemy-sprite-registration.ts'
import type { NativeFireActorTextures } from './world-player-textures.ts'

export interface PrimarySpellFireTextures {
  core: Texture
  frames: readonly Texture[]
  impacts: readonly Texture[]
  particles: readonly Texture[]
}

interface FirePainterRoot {
  container: Container
  lane: 'world-sorted' | 'post-world-queue'
  queueFamily: 'ordinary-dynamic' | 'zanim' | null
  regionLightPoint: Readonly<{ x: number; y: number }> | null
  sortBias: number
  suffix: string
  worldY: number
}

type NativeFireActorState =
  | PrimarySpellFireEmberState
  | PrimarySpellFireGoodImpState
  | PrimarySpellFirePatchState

export class FireActorSpellView {
  readonly underlayContainer = new Container({ label: 'fire-ground-underlay' })
  private readonly fireGroundGlow = new Sprite()
  readonly container: Container
  readonly containers: readonly Container[]
  readonly kind: string
  private readonly emberGroundGlow: Sprite
  private regionLightPoint: Readonly<{ x: number; y: number }> | null = null
  private readonly sprites: Sprite[] = []
  private state: NativeFireActorState
  private readonly textures: NativeFireActorTextures
  private worldY: number

  constructor(state: NativeFireActorState, textures: NativeFireActorTextures) {
    this.state = state
    this.textures = textures
    this.kind = state.kind
    this.worldY = state.position.y
    this.container = new Container({ label: state.kind })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.underlayContainer.eventMode = 'none'
    this.underlayContainer.zIndex = 0.5
    this.fireGroundGlow.eventMode = 'none'
    this.fireGroundGlow.visible = false
    this.underlayContainer.addChild(this.fireGroundGlow)
    this.emberGroundGlow = new Sprite(Texture.WHITE)
    this.emberGroundGlow.anchor.set(0.5)
    this.emberGroundGlow.eventMode = 'none'
    this.emberGroundGlow.label = 'enhanced-airborne-ground-glow'
    this.emberGroundGlow.visible = false
    this.container.addChild(this.emberGroundGlow)
    this.update(state)
  }

  update(
    state: PrimarySpellProjectileState | PrimarySpellTransientState,
    presentationFrame = state.ageTicks,
  ): void {
    if (
      state.kind !== 'fire-ember'
      && state.kind !== 'fire-good-imp'
      && state.kind !== 'fire-patch'
    ) return
    this.state = state
    this.underlayContainer.visible = state.kind === 'fire-patch'
    if (state.kind === 'fire-patch') {
      const glow = nativeFireGroundGlowPlan(state, presentationFrame)
      const record = nativeEnemySpriteRegistration('BadGuys', 15)
      const texture = this.textures.badGuys[15]
      if (!texture) throw new Error('Missing native Fire ground glow texture')
      this.fireGroundGlow.texture = texture
      this.fireGroundGlow.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      this.fireGroundGlow.visible = true
      this.fireGroundGlow.alpha = glow.alpha
      this.fireGroundGlow.scale.set(glow.scale)
      this.fireGroundGlow.tint = glow.tint
      this.underlayContainer.position.set(glow.position.x, glow.position.y)
    }
    const plan = state.kind === 'fire-ember'
      ? nativeFireEmberPlan(state, presentationFrame)
      : state.kind === 'fire-good-imp'
        ? nativeFireGoodImpPlan(state)
        : (() => {
            const patch = nativeFirePatchPlan(state)
            return {
              draws: [{
                alpha: patch.alpha,
                atlas: patch.atlas,
                blend: patch.blend,
                entry: patch.entry,
                offset: { x: 0, y: 0 },
                role: 'fire-patch',
                rotation: 0,
                scale: 1,
                scaleX: patch.scaleX,
                scaleY: patch.scaleY,
                tint: patch.tint,
              }],
              position: patch.position,
              regionLightPoint: patch.regionLightPoint,
              worldY: patch.worldY,
            }
          })()
    const groundGlow = 'groundGlow' in plan ? plan.groundGlow : null
    this.emberGroundGlow.visible = groundGlow !== null
    if (groundGlow) {
      this.emberGroundGlow.alpha = groundGlow.alpha
      this.emberGroundGlow.blendMode = groundGlow.blend
      this.emberGroundGlow.height = groundGlow.height
      this.emberGroundGlow.tint = groundGlow.tint
      this.emberGroundGlow.width = groundGlow.width
    }
    while (this.sprites.length < plan.draws.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.sprites.push(sprite)
      this.container.addChild(sprite)
    }
    while (this.sprites.length > plan.draws.length) {
      const sprite = this.sprites.pop()!
      this.container.removeChild(sprite)
      sprite.destroy()
    }
    for (const [index, draw] of plan.draws.entries()) {
      const record = nativeEnemySpriteRegistration(draw.atlas, draw.entry)
      const texture = draw.atlas === 'BadGuys'
        ? this.textures.badGuys[draw.entry]
        : this.textures.deadHawg[draw.entry]
      if (!texture) throw new Error(`Missing native Fire texture ${draw.atlas}:${draw.entry}`)
      const sprite = this.sprites[index]!
      sprite.label = `${draw.role}:${draw.atlas}:${draw.entry}`
      sprite.texture = texture
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.position.set(draw.offset.x, draw.offset.y)
      sprite.rotation = draw.rotation
      sprite.scale.set(draw.scaleX ?? draw.scale, draw.scaleY ?? draw.scale)
      sprite.alpha = draw.alpha
      sprite.blendMode = draw.blend
      sprite.tint = draw.tint
    }
    this.container.position.set(plan.position.x, plan.position.y)
    this.regionLightPoint = plan.regionLightPoint
    this.worldY = plan.worldY
  }

  painterRoots(): readonly FirePainterRoot[] {
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: this.regionLightPoint,
      sortBias: 0,
      suffix: '',
      worldY: this.worldY,
    }]
  }

  setTint(_suffix: string, tint: number): void {
    if (this.state.kind === 'fire-good-imp') this.container.tint = tint
  }

  destroy(): void {
    this.underlayContainer.destroy({ children: true })
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

export class FireExplosionSpellView {
  readonly container = new Container({ label: 'fire-explosion-lit-array' })
  readonly underlayContainer = new Container({ label: 'fire-explosion-pre-world' })
  private readonly flash = new Container({ label: 'fire-explosion-post-world' })
  readonly containers = [this.container, this.flash]
  readonly kind = 'fire-explosion'
  private readonly pointGain: number
  private readonly sprites = new Map<string, Sprite>()
  private state: PrimarySpellFireExplosionState
  private readonly textures: NativeFireActorTextures

  constructor(state: PrimarySpellFireExplosionState, textures: NativeFireActorTextures, pointGain = 1) {
    this.state = state
    this.textures = textures
    this.pointGain = pointGain
    for (const container of [...this.containers, this.underlayContainer]) container.eventMode = 'none'
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (state.kind !== 'fire-explosion') return
    this.state = state
    const plan = nativeFireExplosionPlan(state, this.pointGain)
    for (const container of [...this.containers, this.underlayContainer]) {
      container.position.set(plan.position.x, plan.position.y)
    }
    for (const sprite of this.sprites.values()) sprite.visible = false
    for (const draw of plan.draws) {
      let sprite = this.sprites.get(draw.role)
      if (!sprite) {
        sprite = new Sprite()
        sprite.eventMode = 'none'
        const container = draw.role === 'explosion-core' ? this.flash
          : draw.role === 'explosion-array' ? this.underlayContainer : this.container
        container.addChild(sprite)
        this.sprites.set(draw.role, sprite)
      }
      const record = nativeEnemySpriteRegistration(draw.atlas, draw.entry)
      const texture = this.textures.badGuys[draw.entry]
      if (!texture) throw new Error(`Missing native Explosion texture ${draw.entry}`)
      sprite.visible = true
      sprite.label = `${draw.role}:BadGuys:${draw.entry}`
      sprite.texture = texture
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.position.set(draw.offset.x, draw.offset.y)
      sprite.rotation = draw.rotation
      sprite.scale.set(draw.scale)
      sprite.alpha = draw.alpha
      sprite.blendMode = draw.blend
      sprite.tint = draw.tint
    }
  }

  painterRoots(): readonly FirePainterRoot[] {
    return [{
      container: this.container, lane: 'world-sorted', queueFamily: 'zanim',
      regionLightPoint: null, sortBias: 0, suffix: '', worldY: this.state.origin.y,
    }, {
      container: this.flash, lane: 'post-world-queue', queueFamily: null,
      regionLightPoint: null, sortBias: 0, suffix: 'flash', worldY: this.state.origin.y,
    }]
  }

  setTint(_suffix: string, _tint: number): void {
    // All three native children own their color and blending.
  }

  get sampledPointGain(): number { return this.pointGain }

  destroy(): void {
    for (const container of [...this.containers, this.underlayContainer]) container.destroy({ children: true })
    this.sprites.clear()
  }
}

export class FirePrimarySpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly additiveBody: Sprite
  private readonly body: Sprite
  private readonly core: Sprite
  readonly kind = 'fire'
  private plan!: ReturnType<typeof nativeFireballPlan>
  private readonly textures: PrimarySpellFireTextures

  constructor(state: PrimarySpellFireProjectileState, textures: PrimarySpellFireTextures) {
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

  update(
    state: PrimarySpellProjectileState | PrimarySpellTransientState,
    presentationFrame?: number,
  ): void {
    if (!('position' in state) || state.kind !== 'fire') return
    const plan = nativeFireballPlan(state, presentationFrame)
    this.plan = plan
    this.container.position.set(plan.position.x, plan.position.y)
    this.apply(this.core, plan.draws[0])
    this.apply(this.additiveBody, plan.draws[1])
    this.apply(this.body, plan.draws[2])
  }

  painterRoots(): readonly FirePainterRoot[] {
    const plan = this.plan
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: plan.regionLightPoint,
      sortBias: 0,
      suffix: '',
      worldY: plan.worldY,
    }]
  }

  setTint(_suffix: string, _tint: number): void {
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
  private plan!: ReturnType<typeof nativeFireParticlePlan>
  private readonly textures: PrimarySpellFireTextures

  constructor(state: PrimarySpellFireParticleState, textures: PrimarySpellFireTextures) {
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
    const plan = nativeFireParticlePlan(state)
    this.plan = plan
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
    const plan = this.plan
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: plan.regionLightPoint,
      sortBias: 0,
      suffix: '',
      worldY: plan.worldY,
    }]
  }

  setTint(_suffix: string, _tint: number): void {
    // Ordinary ZAnim dispatches directly to the self-modulated child draw.
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

export class FireImpactSpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly burst: Sprite
  private readonly core: Sprite
  readonly kind = 'fire-impact'
  private plan!: ReturnType<typeof nativeFireImpactPlan>
  private readonly textures: PrimarySpellFireTextures

  constructor(state: PrimarySpellFireImpactState, textures: PrimarySpellFireTextures) {
    this.textures = textures
    this.container = new Container({ label: 'fire-impact' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.core = fireSprite(textures.core, 'normal')
    this.burst = fireSprite(textures.impacts[0], 'add')
    this.container.addChild(this.core, this.burst)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'fire-impact') return
    const plan = nativeFireImpactPlan(state)
    this.plan = plan
    this.container.position.set(plan.position.x, plan.position.y)
    this.apply(this.core, plan.draws[0])
    this.apply(this.burst, plan.draws[1])
    this.burst.texture = this.textures.impacts[
      plan.draws[1].frame - NATIVE_FIRE_IMPACT_FRAME_FIRST
    ]
  }

  painterRoots(): readonly FirePainterRoot[] {
    const plan = this.plan
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'zanim',
      regionLightPoint: plan.regionLightPoint,
      sortBias: 0,
      suffix: '',
      worldY: plan.worldY,
    }]
  }

  setTint(_suffix: string, _tint: number): void {
    // ZAnimLit's direct child trampoline bypasses common Region-light tint.
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }

  private apply(sprite: Sprite, draw: NativeFireImpactDraw): void {
    sprite.position.set(draw.x, draw.y)
    sprite.rotation = draw.rotation
    sprite.scale.set(draw.scaleX, draw.scaleY)
    sprite.alpha = draw.alpha
    sprite.tint = draw.tint
  }
}

function fireSprite(texture: Texture, blend: 'add' | 'normal'): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.blendMode = blend
  sprite.eventMode = 'none'
  return sprite
}
