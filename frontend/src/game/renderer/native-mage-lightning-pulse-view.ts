import { Container } from 'pixi.js'

import type { BoneyardMageLightningPulseSnapshot } from '../protocol/game-state.ts'
import {
  nativeMageLightningPulsePlan,
  type NativeMageLightningPulseInput,
  type NativeMageLightningPulsePlan,
} from './native-mage-lightning-pulse-presentation.ts'
import {
  NativeAirCoronaView,
  NativeAirLightningBodyView,
  type NativeAirVfxTextures,
} from './primary-spell-air-view.ts'
import type { NativeAirPathLightPlan } from './primary-spell-air-native.ts'

export const NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET = 0.25
export const NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_SPAN = 0.125

export interface NativeMageLightningPainterRoot {
  readonly container: Container
  readonly lane: 'post-main-overlay' | 'world-sorted'
  readonly queueFamily: 'ordinary-dynamic' | null
  readonly regionLightPoint: null
  readonly sortBias: 0
  readonly suffix: 'body' | 'contact' | 'source'
  readonly worldY: number
}

export interface NativeMageLightningTargetAttachment {
  readonly container: Container
  readonly localOffset: Readonly<{ x: number; y: number }>
  readonly targetPlayerId: string
}

export interface NativeMageLightningPulsePainterLayer
  extends NativeMageLightningPainterRoot {
  readonly pulseId: number
  readonly pulseTick: number
  readonly id: string
  readonly targetPlayerId: string | null
}

export interface NativeMageLightningPathLightBatch {
  readonly birthTick: number
  readonly id: number
  readonly ownerActorId: number
  readonly sources: readonly NativeAirPathLightPlan[]
}

export function nativeMageLightningTargetContactDepths(
  layers: readonly NativeMageLightningPulsePainterLayer[],
  playerSlotIds: readonly string[],
  foregroundZIndex: number,
): ReadonlyMap<string, number> {
  const playerSlotOrder = new Map(
    playerSlotIds.map((playerId, index) => [playerId, index]),
  )
  const ordered = layers
    .filter((layer) => layer.lane === 'post-main-overlay')
    .toSorted((first, second) => (
      (playerSlotOrder.get(first.targetPlayerId ?? '') ?? Number.MAX_SAFE_INTEGER)
        - (playerSlotOrder.get(second.targetPlayerId ?? '') ?? Number.MAX_SAFE_INTEGER)
      || first.pulseTick - second.pulseTick
      || first.pulseId - second.pulseId
    ))
  const depths = new Map<string, number>()
  for (let index = 0; index < ordered.length; index += 1) {
    const laneOffset = NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET + (
      ordered.length === 1
        ? 0
        : (index / (ordered.length - 1))
          * NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_SPAN
    )
    depths.set(ordered[index]!.id, foregroundZIndex + laneOffset)
  }
  return depths
}

/**
 * The three native pulse owners stay separate. Target contact follows the
 * player in world coordinates but remains in its native post-main overlay lane.
 */
export class NativeMageLightningPulseView {
  readonly containers: readonly Container[]
  private readonly body: NativeAirLightningBodyView
  private readonly contact: NativeAirCoronaView
  private currentPlan: NativeMageLightningPulsePlan | null
  private readonly input: NativeMageLightningPulseInput
  private readonly source: NativeAirCoronaView
  readonly worldContainers: readonly Container[]

  constructor(
    input: NativeMageLightningPulseInput,
    textures: NativeAirVfxTextures,
    presentationTick = input.tick,
  ) {
    this.input = input
    const construction = nativeMageLightningPulsePlan(input, input.tick)
    if (!construction?.body) {
      throw new Error('Mage lightning pulse is missing its birth body')
    }
    this.body = new NativeAirLightningBodyView(
      `mage-lightning:${input.seed}:body`,
      construction.body,
      textures,
    )
    this.source = new NativeAirCoronaView(
      `mage-lightning:${input.seed}:source`,
      textures,
    )
    this.contact = new NativeAirCoronaView(
      `mage-lightning:${input.seed}:contact`,
      textures,
    )
    this.containers = [
      this.body.container,
      this.source.container,
      this.contact.container,
    ]
    this.worldContainers = this.containers
    this.currentPlan = construction
    this.update(presentationTick)
  }

  update(presentationTick: number): boolean {
    const plan = nativeMageLightningPulsePlan(this.input, presentationTick)
    this.currentPlan = plan
    if (!plan) {
      for (const container of this.containers) container.visible = false
      return false
    }
    this.body.container.position.set(plan.source.x, plan.source.y)
    this.body.update(plan.body)
    this.source.update(plan.sourceCorona, plan.source)
    const contactOrigin = { x: 0, y: 0 }
    this.contact.update(plan.contact.corona, contactOrigin)
    return true
  }

  painterRoots(): readonly NativeMageLightningPainterRoot[] {
    const plan = this.currentPlan
    if (!plan) return []
    const roots: NativeMageLightningPainterRoot[] = []
    if (plan.body) {
      roots.push(root(this.body.container, 'body', plan.midpoint.y))
    }
    if (plan.sourceCorona) {
      roots.push(root(this.source.container, 'source', plan.source.y))
    }
    if (plan.contact.kind === 'world') {
      roots.push(root(this.contact.container, 'contact', plan.contact.position.y))
    }
    return roots
  }

  targetAttachment(): NativeMageLightningTargetAttachment | null {
    const contact = this.currentPlan?.contact
    return contact?.kind === 'target-attached'
      ? {
          container: this.contact.container,
          localOffset: contact.localOffset,
          targetPlayerId: contact.targetPlayerId,
        }
      : null
  }

  get birthTick(): number {
    return this.input.tick
  }

  get pathLights(): readonly NativeAirPathLightPlan[] {
    return this.currentPlan?.pathLights ?? []
  }

  destroy(): void {
    for (const container of this.containers) {
      container.removeFromParent()
      container.destroy({ children: true })
    }
    this.currentPlan = null
  }
}

/** Owns the replicated pulse set without folding its three native painters. */
export class NativeMageLightningPulseViews {
  private readonly activePathLightBatches: NativeMageLightningPathLightBatch[] = []
  private readonly liveIds = new Set<number>()
  private readonly orderedIds: number[] = []
  private readonly root: Container
  private readonly targetWorldY = new Map<number, number>()
  private readonly textures: NativeAirVfxTextures
  private readonly views = new Map<number, NativeMageLightningPulseView>()

  constructor(root: Container, textures: NativeAirVfxTextures) {
    this.root = root
    this.textures = textures
  }

  update(
    pulses: readonly BoneyardMageLightningPulseSnapshot[],
    presentationTick: number,
    playerPosition: (
      playerId: string,
    ) => Readonly<{ x: number; y: number }> | null,
  ): void {
    this.activePathLightBatches.length = 0
    this.liveIds.clear()
    this.orderedIds.length = 0
    for (const pulse of pulses) {
      if (pulse.tick > presentationTick) continue
      let view = this.views.get(pulse.id)
      if (!view) {
        view = new NativeMageLightningPulseView(
          pulse,
          this.textures,
          presentationTick,
        )
        for (const container of view.worldContainers) this.root.addChild(container)
        this.views.set(pulse.id, view)
      }
      if (!view.update(presentationTick)) {
        view.destroy()
        this.views.delete(pulse.id)
        this.targetWorldY.delete(pulse.id)
        continue
      }
      const attachment = view.targetAttachment()
      if (attachment) {
        const target = playerPosition(attachment.targetPlayerId)
        if (target) {
          attachment.container.visible = true
          attachment.container.position.set(
            target.x + attachment.localOffset.x,
            target.y + attachment.localOffset.y,
          )
          this.targetWorldY.set(
            pulse.id,
            target.y + attachment.localOffset.y,
          )
        } else {
          attachment.container.visible = false
          this.targetWorldY.delete(pulse.id)
        }
      }
      this.liveIds.add(pulse.id)
      this.orderedIds.push(pulse.id)
      const sources = view.pathLights
      if (sources.length > 0) {
        this.activePathLightBatches.push({
          birthTick: pulse.tick,
          id: pulse.id,
          ownerActorId: pulse.ownerActorId,
          sources,
        })
      }
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      view.destroy()
      this.views.delete(id)
      this.targetWorldY.delete(id)
    }
  }

  painterLayers(): readonly NativeMageLightningPulsePainterLayer[] {
    return this.orderedIds.flatMap((id) => {
      const view = this.views.get(id)
      if (!view) return []
      const layers: NativeMageLightningPulsePainterLayer[] = view.painterRoots().map(
        (painter) => ({
          ...painter,
          id: `mage-lightning:${id}:${painter.suffix}`,
          pulseId: id,
          pulseTick: view.birthTick,
          targetPlayerId: null,
        }),
      )
      const attachment = view.targetAttachment()
      const worldY = this.targetWorldY.get(id)
      if (attachment && worldY !== undefined) {
        layers.push({
          container: attachment.container,
          id: `mage-lightning:${id}:contact`,
          lane: 'post-main-overlay',
          pulseId: id,
          pulseTick: view.birthTick,
          queueFamily: null,
          regionLightPoint: null,
          sortBias: 0,
          suffix: 'contact',
          targetPlayerId: attachment.targetPlayerId,
          worldY,
        })
      }
      return layers
    })
  }

  get pathLights(): readonly NativeAirPathLightPlan[] {
    return this.activePathLightBatches.flatMap(({ sources }) => sources)
  }

  get pathLightBatches(): readonly NativeMageLightningPathLightBatch[] {
    return this.activePathLightBatches
  }

  get size(): number {
    return this.views.size
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) {
      for (const container of view.containers) container.renderable = renderable
    }
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
    this.orderedIds.length = 0
    this.activePathLightBatches.length = 0
    this.targetWorldY.clear()
  }
}

function root(
  container: Container,
  suffix: NativeMageLightningPainterRoot['suffix'],
  worldY: number,
): NativeMageLightningPainterRoot {
  return {
    container,
    lane: 'world-sorted',
    queueFamily: 'ordinary-dynamic',
    regionLightPoint: null,
    sortBias: 0,
    suffix,
    worldY,
  }
}
