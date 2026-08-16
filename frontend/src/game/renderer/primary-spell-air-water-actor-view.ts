import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { buildNativeAirLightningPlan } from './primary-spell-air-native.ts'
import {
  NATIVE_AIR_WATER_SPRITES,
  nativeHailVisualPlan,
  nativeWaterAuraVisualPlan,
} from './primary-spell-air-water-native.ts'
import type { NativeEnemySpriteRegistration } from './native-enemy-sprite-registration.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export const NATIVE_AIR_WATER_ACTOR_KINDS = Object.freeze([
  'air-hurricane',
  'water-aura',
  'water-hail',
] as const)

export type NativeAirWaterActorState = Extract<PrimarySpellTransientState, {
  kind: typeof NATIVE_AIR_WATER_ACTOR_KINDS[number]
}>

type AirWaterActorTextures = PlayerWorldTextures['primarySpells']

interface AirWaterPainterRoot {
  container: Container
  lane: 'world-sorted'
  overlayOwnerId?: string
  queueFamily: 'ordinary-dynamic'
  regionLightPoint: null
  sortBias: number
  suffix: string
  worldY: number
}

interface SpritePlan {
  readonly alpha: number
  readonly blend: 'add' | 'normal'
  readonly position?: Readonly<{ x: number; y: number }>
  readonly rotation?: number
  readonly scale: number | Readonly<{ x: number; y: number }>
  readonly tint: number
}

/** Pure presentation for the three primary-owned Air/Water actor families. */
export class AirWaterActorSpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly sprites: readonly Sprite[]
  private state: NativeAirWaterActorState
  private readonly textures: AirWaterActorTextures

  constructor(state: NativeAirWaterActorState, textures: AirWaterActorTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: state.kind })
    this.container.eventMode = 'none'
    this.containers = [this.container]
    this.sprites = Array.from({ length: 3 }, (_, index) => {
      const sprite = new Sprite({
        label: `${state.kind}:sprite:${index}`,
        texture: textures.airWaterActors.coldAura,
      })
      sprite.eventMode = 'none'
      this.container.addChild(sprite)
      return sprite
    })
    this.update(state)
  }

  get kind(): string {
    return this.state.kind
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!isNativeAirWaterActorState(state) || state.kind !== this.state.kind) return
    this.state = state
    this.sprites.forEach(resetSprite)
    if (state.kind === 'air-hurricane') {
      this.container.position.set(state.position.x, state.position.y)
      const corona = buildNativeAirLightningPlan({
        ageTicks: 0,
        birthTick: state.birthTick,
        endpoint: { x: 0, y: 0 },
        id: state.id,
        midpoint: { x: 0, y: 0 },
      }).sourceCorona
      corona?.circles.forEach((circle, index) => this.showSprite(
        index,
        this.textures.air.circle,
        NATIVE_AIR_WATER_SPRITES.prismaticSpark0,
        {
          alpha: circle.alpha * state.charge,
          blend: 'add',
          scale: circle.scale * state.charge,
          tint: circle.tint,
        },
      ))
      return
    }
    if (state.kind === 'water-aura') {
      this.container.position.set(state.origin.x, state.origin.y)
      const plan = nativeWaterAuraVisualPlan(state)
      this.showSprite(
        0,
        this.textures.airWaterActors.coldAura,
        NATIVE_AIR_WATER_SPRITES.coldAura,
        {
          alpha: plan.alpha,
          blend: 'add',
          rotation: plan.rotationRadians,
          scale: plan.scale,
          tint: plan.tint,
        },
      )
      return
    }
    this.container.position.set(state.position.x, state.position.y)
    const plan = nativeHailVisualPlan(state)
    this.showSprite(
      0,
      this.textures.airWaterActors.hail,
      NATIVE_AIR_WATER_SPRITES.hail,
      {
        alpha: plan.alpha,
        blend: 'normal',
        position: { x: 0, y: plan.offsetY },
        rotation: plan.rotationRadians,
        scale: plan.scale,
        tint: 0xffffff,
      },
    )
  }

  painterRoots(): readonly AirWaterPainterRoot[] {
    const position = this.state.kind === 'air-hurricane'
      ? this.state.position
      : this.state.kind === 'water-hail'
        ? this.state.position
        : this.state.origin
    return [{
      container: this.container,
      lane: 'world-sorted',
      ...(this.state.kind === 'air-hurricane'
        ? { overlayOwnerId: this.state.ownerId }
        : {}),
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: null,
      sortBias: 0,
      suffix: '',
      worldY: position.y,
    }]
  }

  setTint(_suffix: string, tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }

  private showSprite(
    index: number,
    texture: Texture,
    registration: NativeEnemySpriteRegistration,
    plan: SpritePlan,
  ): void {
    const sprite = this.sprites[index]
    if (!sprite) return
    sprite.visible = true
    sprite.label = `${registration.atlas}:${registration.entry}`
    sprite.texture = texture
    sprite.anchor.set(
      registration.anchorX / registration.width,
      registration.anchorY / registration.height,
    )
    sprite.alpha = plan.alpha
    sprite.blendMode = plan.blend
    sprite.position.set(plan.position?.x ?? 0, plan.position?.y ?? 0)
    sprite.rotation = plan.rotation ?? 0
    if (typeof plan.scale === 'number') sprite.scale.set(plan.scale)
    else sprite.scale.set(plan.scale.x, plan.scale.y)
    sprite.tint = plan.tint
  }
}

export function isNativeAirWaterActorState(
  state: PrimarySpellProjectileState | PrimarySpellTransientState,
): state is NativeAirWaterActorState {
  return (NATIVE_AIR_WATER_ACTOR_KINDS as readonly string[]).includes(state.kind)
}

function resetSprite(sprite: Sprite): void {
  sprite.visible = false
  sprite.alpha = 1
  sprite.blendMode = 'normal'
  sprite.position.set(0, 0)
  sprite.rotation = 0
  sprite.scale.set(1)
  sprite.tint = 0xffffff
}
