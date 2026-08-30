import type {
  NativeWorldManagerOrder,
  NativeWorldManagerRegistration,
} from './core-kernels/native-world-manager-order.ts'
import {
  buildNativeRegionPainterOrder,
  type NativeRegionPainterInsertion,
  type NativeRegionPainterRegistration,
} from './region-painter-order.ts'
import {
  NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS,
  type NativeHubFixedActorPainterId,
} from './core-kernels/native-hub-world-membership.ts'

export {
  NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS,
  type NativeHubFixedActorPainterId,
} from './core-kernels/native-hub-world-membership.ts'

const FIXED_ACTOR_REGISTRATIONS = new Map(
  NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.map((id, registrationOrdinal) => [
    id,
    Object.freeze({
      managerLane: 'actor' as const,
      registrationOrdinal,
    }),
  ]),
)

export function nativeHubFixedActorPainterRegistration(
  id: NativeHubFixedActorPainterId,
): NativeWorldManagerRegistration {
  const registration = FIXED_ACTOR_REGISTRATIONS.get(id)
  if (!registration) throw new Error(`unknown native Hub painter ${id}`)
  return registration
}

export function reserveNativeHubFixedActorPainters(
  order: NativeWorldManagerOrder,
): void {
  for (const id of NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS) {
    const expected = nativeHubFixedActorPainterRegistration(id)
    const actual = order.register('actor')
    if (actual.registrationOrdinal !== expected.registrationOrdinal) {
      throw new Error('native Hub fixed actor painter reservation is not first')
    }
  }
}

export interface NativeHubPainterLayer {
  readonly id: string
  readonly insertionTargets?: Readonly<Record<string, { zIndex: number }>>
  readonly insertions?: readonly NativeRegionPainterInsertion[]
  readonly registration: NativeRegionPainterRegistration
  readonly sortBias: number
  readonly target: { zIndex: number }
  readonly visible?: boolean
  readonly worldY: number
}

export function applyNativeHubPainterOrder(
  layers: readonly NativeHubPainterLayer[],
  referenceY: number,
  depthBase = 1_000,
): readonly Readonly<{ id: string; row: number; zIndex: number }>[] {
  const targets = new Map(layers.map((layer) => [layer.id, layer.target]))
  for (const layer of layers) {
    for (const [id, target] of Object.entries(layer.insertionTargets ?? {})) {
      if (targets.has(id)) throw new Error(`duplicate native Hub painter target ${id}`)
      targets.set(id, target)
    }
  }
  const order = buildNativeRegionPainterOrder({
    entries: layers.map((layer) => ({
      id: layer.id,
      insertions: layer.insertions,
      registration: layer.registration,
      sortBias: layer.sortBias,
      visible: layer.visible ?? true,
      worldY: layer.worldY,
    })),
    referenceY,
  })
  for (const positioned of order.orderedLayers) {
    const target = targets.get(positioned.id)
    if (!target) throw new Error(`native Hub painter ${positioned.id} lost its target`)
    target.zIndex = depthBase + positioned.zIndex
  }
  return order.orderedLayers
}
