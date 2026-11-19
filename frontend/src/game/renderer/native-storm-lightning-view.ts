import type { Container } from 'pixi.js'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import { nativeStormLightningPlan } from '../core-kernels/native-secondary-storm.ts'
import { nativeWorldPainterRegistration } from '../core-kernels/native-world-manager-order.ts'
import type { NativeSecondaryPainterLayer } from './native-secondary-world-view.ts'
import { NativeAirLightningBodyView, NativeAirCoronaView, type NativeAirVfxTextures } from './primary-spell-air-view.ts'

/** The body/source are direct Region+1E0 painters; only the contact is row sorted. */
export class NativeStormLightningView {
  private body: NativeAirLightningBodyView | null = null
  private readonly source: NativeAirCoronaView
  private readonly contact: NativeAirCoronaView
  private state: NativeSecondaryActorState
  private readonly root: Container
  private readonly textures: NativeAirVfxTextures

  constructor(state: NativeSecondaryActorState, root: Container, textures: NativeAirVfxTextures) {
    this.state = state
    this.root = root
    this.textures = textures
    this.source = new NativeAirCoronaView(`storm-source:${state.id}`, textures)
    this.contact = new NativeAirCoronaView(`storm-contact:${state.id}`, textures)
    root.addChild(this.source.container, this.contact.container)
    this.update(state)
  }

  update(state: NativeSecondaryActorState): void {
    this.state = state
    const plan = nativeStormLightningPlan(state, state.ageTicks)
    if (this.body && !plan.body) {
      this.body.destroy()
      this.body = null
    }
    if (!this.body && plan.body) {
      this.body = new NativeAirLightningBodyView(`storm-body:${state.id}`, plan.body, this.textures, false, state.enhanced)
      this.root.addChildAt(this.body.container, this.root.getChildIndex(this.source.container))
    }
    this.body?.setOrigin(state.position)
    this.source.update(plan.sourceCorona, state.position)
    this.contact.update(plan.contactCorona, state.position)
  }

  painterLayers(sourceOrder: number): NativeSecondaryPainterLayer[] {
    const prefix = `secondary:${this.state.id}:`
    const layers: NativeSecondaryPainterLayer[] = [{
      id: `${prefix}storm-contact`, lane: 'world-sorted', queueFamily: 'ordinary-dynamic',
      regionLightPoint: null, registration: nativeWorldPainterRegistration(this.state),
      sortBias: 50, sourceOrder, worldY: this.contact.container.y,
    }]
    for (const suffix of ['storm-body', 'storm-source'] as const) {
      if (suffix === 'storm-body' ? !this.body : !this.source.container.visible) continue
      layers.push({ id: `${prefix}${suffix}`, lane: 'post-world-queue', queueFamily: null,
        regionLightPoint: null, registration: null, sortBias: 0,
        sourceOrder: sourceOrder + layers.length, worldY: this.state.position.y })
    }
    return layers
  }

  setDepth(suffix: string, depth: number): void {
    const container = suffix === 'storm-body' ? this.body?.container
      : suffix === 'storm-source' ? this.source.container : this.contact.container
    if (container) container.zIndex = depth
  }

  setRenderable(value: boolean): void {
    if (this.body) this.body.container.renderable = value
    this.source.container.renderable = value
    this.contact.container.renderable = value
  }

  destroy(): void {
    this.body?.destroy()
    this.body = null
    this.source.destroy()
    this.contact.destroy()
  }
}
