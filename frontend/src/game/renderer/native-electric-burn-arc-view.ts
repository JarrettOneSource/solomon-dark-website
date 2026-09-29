import type { Container } from 'pixi.js'
import { buildNativeAirLightningFactoryPlan, type NativeAirLightningFactoryPlan } from '../core-kernels/native-air-presentation.ts'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import { nativeWorldPainterRegistration } from '../core-kernels/native-world-manager-order.ts'
import type { NativeSecondaryPainterLayer } from './native-secondary-world-view.ts'
import { NativeAirLightningBodyView, type NativeAirVfxTextures } from './primary-spell-air-view.ts'

/** Mod_ElectricBurn calls the shared body factory with source glow disabled.
 * Its independently owned FadeLightning contact is not part of this wrapper. */
export class NativeElectricBurnArcView {
  private body: NativeAirLightningBodyView | null = null
  private factoryBody: NativeAirLightningFactoryPlan['body']
  private readonly bornEnhanced: boolean
  private readonly id: number
  private readonly root: Container
  private readonly textures: NativeAirVfxTextures
  private quality: boolean
  private state: NativeSecondaryActorState
  private readonly layers: NativeSecondaryPainterLayer[] = []

  constructor(state: NativeSecondaryActorState, root: Container, textures: NativeAirVfxTextures, enhancedEffects: boolean) {
    if (state.kind !== 'electric-burn-arc') throw new TypeError('Expected an ElectricBurn arc')
    this.state = state
    this.id = state.id
    this.bornEnhanced = state.enhanced
    this.root = root
    this.textures = textures
    this.quality = enhancedEffects
    this.factoryBody = buildNativeAirLightningFactoryPlan({
      ageTicks: state.ageTicks, birthTick: state.phase, id: state.id, enhancedEffects: state.enhanced,
      endpoint: { x: state.endpoint.x - state.position.x, y: state.endpoint.y - state.position.y },
      midpoint: { x: state.midpoint.x - state.position.x, y: state.midpoint.y - state.position.y },
    }).body
    this.update(state, enhancedEffects)
  }

  update(state: NativeSecondaryActorState, enhancedEffects: boolean): void {
    if (state.kind !== 'electric-burn-arc' || state.id !== this.id || state.enhanced !== this.bornEnhanced) {
      throw new TypeError('ElectricBurn body lost its immutable birth owner')
    }
    this.state = state
    if (state.ageTicks >= 2) {
      this.body?.destroy()
      this.body = null
      this.factoryBody = null
      return
    }
    if (this.factoryBody === null) throw new RangeError('Retired ElectricBurn body cannot re-enter its birth lifetime')
    if (this.body && this.quality !== enhancedEffects) {
      this.body.destroy()
      this.body = null
    }
    this.quality = enhancedEffects
    if (!this.body) {
      this.body = new NativeAirLightningBodyView(`electric-burn:${state.id}`, this.factoryBody,
        this.textures, true, enhancedEffects)
      this.root.addChild(...this.body.containers)
    }
    this.body.setOrigin(state.position)
  }

  painterLayers(sourceOrder: number): readonly NativeSecondaryPainterLayer[] {
    this.layers.length = 0
    const body = this.body
    if (!body) return this.layers
    const prefix = `secondary:${this.id}:`
    this.layers.push({
      id: `${prefix}body`, lane: 'world-sorted', queueFamily: 'ordinary-dynamic', regionLightPoint: null,
      registration: nativeWorldPainterRegistration(this.state), sourceOrder, sortBias: 0, visible: false,
      worldY: this.state.position.y + body.boundsY,
      insertions: body.painterInsertions.map((insertion, index) => ({
        id: `${prefix}${insertion.suffix}`, sortBias: 0, visible: true,
        worldY: this.state.position.y + body.bands[index]!.painterY,
      })),
    })
    return this.layers
  }

  setDepth(suffix: string, depth: number): void {
    const container = suffix === 'body' ? this.body?.container : this.body?.bandContainer(suffix)
    if (container) container.zIndex = depth
  }

  setTint(tint: number): void { for (const container of this.body?.containers ?? []) container.tint = tint }
  setRenderable(value: boolean): void { for (const container of this.body?.containers ?? []) container.renderable = value }
  get primitiveCount(): number { return this.body?.bands.length ?? 0 }

  destroy(): void {
    this.body?.destroy()
    this.body = null
    this.factoryBody = null
    this.layers.length = 0
  }
}
