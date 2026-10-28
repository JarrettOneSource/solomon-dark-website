import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellEtherBlastState,
  PrimarySpellEtherImpactState,
  PrimarySpellEtherPierceStreakState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  createNativeEtherBlastParticleProgram,
  nativeEtherBlastParticleFrame,
} from '../core-kernels/native-ether-blast.ts'
import {
  ETHER_PRIMARY_ROOT_OFFSET,
  etherPrimaryFlightPlan,
  etherPrimaryImpactPlan,
  etherPrimaryPierceStreakPlan,
  type EtherPrimaryDraw,
  type EtherPrimarySprite,
} from './primary-spell-ether-native.ts'

export type EtherPrimaryTextures = Readonly<Record<EtherPrimarySprite, Texture>>

export type EtherBlastTextures = Readonly<Record<11 | 45, Readonly<{
  anchorX: number
  anchorY: number
  height: number
  texture: Texture
  width: number
}>>>

export class EtherBlastPulseView {
  readonly containers: readonly Container[]
  readonly kind = 'ether-blast'
  private readonly particles: ReturnType<
    typeof createNativeEtherBlastParticleProgram
  >['particles']
  private readonly sprites: readonly Sprite[]

  constructor(
    state: PrimarySpellEtherBlastState,
    textures: EtherBlastTextures,
  ) {
    this.particles = createNativeEtherBlastParticleProgram(state.presentationRng).particles
    const containers: Container[] = []
    const sprites: Sprite[] = []
    for (const [index, particle] of this.particles.entries()) {
      const metrics = textures[particle.spriteRecord]
      const sprite = new Sprite(metrics.texture)
      sprite.anchor.set(metrics.anchorX / metrics.width, metrics.anchorY / metrics.height)
      sprite.blendMode = 'add'
      sprite.eventMode = 'none'
      const container = new Container({ label: `ether-blast-particle-${index}` })
      container.eventMode = 'none'
      container.addChild(sprite)
      containers.push(container)
      sprites.push(sprite)
    }
    this.containers = containers
    this.sprites = sprites
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (state.kind !== 'ether-blast') return
    for (let index = 0; index < this.particles.length; index += 1) {
      const frame = nativeEtherBlastParticleFrame(this.particles[index]!, state.ageTicks)
      const container = this.containers[index]!
      const sprite = this.sprites[index]!
      container.position.set(
        Math.fround(state.origin.x + frame.position.x),
        Math.fround(state.origin.y + frame.position.y),
      )
      sprite.alpha = frame.alpha
      sprite.visible = frame.alpha > 0
      sprite.rotation = frame.rotationDegrees * Math.PI / 180
      sprite.scale.set(frame.scale, Math.fround(frame.scale * Math.fround(0.800000012)))
      sprite.tint = packRgb(frame.red, frame.green, frame.blue)
    }
  }

  painterRoots(): readonly EtherBlastPainterRoot[] {
    return this.containers.map((container, index) => ({
      container,
      lane: 'world-sorted',
      queueFamily: 'zanim',
      regionLightPoint: null,
      sortBias: 0,
      suffix: `particle-${index}`,
      worldY: container.position.y,
    }))
  }

  setTint(_suffix: string, _tint: number): void {
    // Anim_FadeMoveAdditive_Perspective owns its unlit violet compositor color.
  }

  destroy(): void {
    for (const container of this.containers) container.destroy({ children: true })
  }
}

export class EtherPrimarySpellView {
  readonly container = new Container({ label: 'ether' })
  readonly containers: readonly Container[]
  private readonly compositor = new Container({ label: 'ether-flight-compositor' })
  readonly kind = 'ether'
  private readonly sprites: Sprite[] = []
  private state: PrimarySpellProjectileState
  private readonly textures: EtherPrimaryTextures

  constructor(state: PrimarySpellProjectileState, textures: EtherPrimaryTextures) {
    if (state.kind !== 'ether') throw new Error('EtherPrimarySpellView requires an Ether actor')
    this.state = state
    this.textures = textures
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.compositor.eventMode = 'none'
    this.compositor.position.set(ETHER_PRIMARY_ROOT_OFFSET.x, ETHER_PRIMARY_ROOT_OFFSET.y)
    this.container.addChild(this.compositor)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('position' in state) || state.kind !== 'ether') return
    this.state = state
    this.container.position.set(state.position.x, state.position.y)
    const plan = etherPrimaryFlightPlan(
      state.id,
      state.ageTicks,
      state.speed,
      state.visualScale,
      state.underpowered,
    )
    while (this.sprites.length < plan.draws.length) {
      const sprite = new Sprite()
      sprite.anchor.set(0.5)
      sprite.eventMode = 'none'
      this.compositor.addChild(sprite)
      this.sprites.push(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]
      const operation = plan.draws[index]
      sprite.visible = operation !== undefined
      if (!operation) continue
      applyEtherDraw(sprite, operation, this.textures)
    }
  }

  get worldY(): number {
    return this.state.position.y
  }

  painterRoots(): readonly EtherPainterRoot[] {
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: null,
      sortBias: 0,
      suffix: '',
      worldY: this.worldY,
    }]
  }

  setTint(_suffix: string, _tint: number): void {
    // MagicMissile's direct render slot installs its own compositor colors.
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

export class EtherPrimaryImpactView {
  readonly container = new Container({ label: 'ether-impact' })
  readonly containers: readonly Container[]
  readonly kind = 'ether-impact'
  private readonly sprites: Sprite[] = []
  private plan!: ReturnType<typeof etherPrimaryImpactPlan>
  private readonly textures: EtherPrimaryTextures

  constructor(state: PrimarySpellEtherImpactState, textures: EtherPrimaryTextures) {
    this.textures = textures
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'ether-impact') return
    const plan = etherPrimaryImpactPlan(state)
    this.plan = plan
    this.container.position.set(plan.position.x, plan.position.y)
    while (this.sprites.length < plan.draws.length) {
      const sprite = new Sprite()
      sprite.anchor.set(0.5)
      sprite.eventMode = 'none'
      this.container.addChild(sprite)
      this.sprites.push(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]
      const operation = plan.draws[index]
      sprite.visible = operation !== undefined
      if (operation) applyEtherDraw(sprite, operation, this.textures)
    }
  }

  painterRoots(): readonly EtherImpactPainterRoot[] {
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
    // FadeMM/ZAnimLit's child trampoline bypasses common Region-light tint.
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

export class EtherPrimaryPierceStreakView {
  readonly container = new Container({ label: 'ether-pierce-streak' })
  readonly containers = [this.container]
  readonly kind = 'ether-pierce-streak'
  private readonly sprite: Sprite
  private plan!: ReturnType<typeof etherPrimaryPierceStreakPlan>

  constructor(state: PrimarySpellEtherPierceStreakState, texture: Texture) {
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.sprite.blendMode = 'add'
    this.sprite.eventMode = 'none'
    this.container.eventMode = 'none'
    this.container.addChild(this.sprite)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (state.kind !== 'ether-pierce-streak') return
    const plan = etherPrimaryPierceStreakPlan(state)
    this.plan = plan
    this.container.position.set(plan.position.x, plan.position.y)
    this.sprite.rotation = plan.rotationDegrees * Math.PI / 180
    this.sprite.scale.set(plan.scale)
    this.sprite.alpha = plan.alpha
  }

  painterRoots(): readonly EtherPiercePainterRoot[] {
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'zanim',
      regionLightPoint: null,
      sortBias: 0,
      suffix: '',
      worldY: this.plan.worldY,
    }]
  }

  setTint(_suffix: string, _tint: number): void {
    // Anim_FadeAdditive owns a white self-lit draw.
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

interface EtherPainterRoot {
  container: Container
  lane: 'world-sorted'
  queueFamily: 'ordinary-dynamic'
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  suffix: string
  worldY: number
}

interface EtherImpactPainterRoot {
  container: Container
  lane: 'world-sorted'
  queueFamily: 'zanim'
  regionLightPoint: null
  sortBias: number
  suffix: string
  worldY: number
}

type EtherPiercePainterRoot = EtherImpactPainterRoot

type EtherBlastPainterRoot = EtherImpactPainterRoot

function applyEtherDraw(
  sprite: Sprite,
  operation: EtherPrimaryDraw,
  textures: EtherPrimaryTextures,
): void {
  sprite.texture = textures[operation.sprite]
  sprite.blendMode = operation.blend
  sprite.position.set(operation.x, operation.y)
  sprite.rotation = operation.rotationDegrees * Math.PI / 180
  sprite.scale.set(operation.scale)
  sprite.alpha = operation.alpha
  sprite.tint = operation.tint
}

function packRgb(red: number, green: number, blue: number): number {
  const channel = (value: number): number => Math.round(Math.min(1, Math.max(0, value)) * 255)
  return channel(red) << 16 | channel(green) << 8 | channel(blue)
}
