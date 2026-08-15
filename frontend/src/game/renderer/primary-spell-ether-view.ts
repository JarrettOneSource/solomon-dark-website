import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellEtherImpactState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  ETHER_PRIMARY_ROOT_OFFSET,
  etherPrimaryFlightPlan,
  etherPrimaryImpactPlan,
  type EtherPrimaryDraw,
  type EtherPrimarySprite,
} from './primary-spell-ether-native.ts'

export type EtherPrimaryTextures = Readonly<Record<EtherPrimarySprite, Texture>>

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
    const plan = etherPrimaryFlightPlan(state.id, state.ageTicks, state.underpowered)
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
  private state: PrimarySpellEtherImpactState
  private readonly textures: EtherPrimaryTextures

  constructor(state: PrimarySpellEtherImpactState, textures: EtherPrimaryTextures) {
    this.state = state
    this.textures = textures
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'ether-impact') return
    this.state = state
    const plan = etherPrimaryImpactPlan(state)
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
    const plan = etherPrimaryImpactPlan(this.state)
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
