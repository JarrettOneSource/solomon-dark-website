import type {
  PrimarySpellAirHurricaneState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export interface AirWaterPlayerVisualOwner {
  readonly hurricaneCharge: number
  readonly ownerId: string
  readonly position: Vector2
  readonly worldKey: string
}

/**
 * Projects player-owned Air presentation lanes into the shared spell ECS.
 * Hurricane is a persistent owner aura; its lifetime is never reconstructed
 * in the renderer.
 */
export function synchronizeAirWaterPlayerVisualActors(
  source: PrimarySpellSimulationState,
  owners: readonly AirWaterPlayerVisualOwner[],
  tick: number,
): PrimarySpellSimulationState {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Air/Water visual actor tick must be a non-negative safe integer')
  }
  const ownerById = new Map<string, AirWaterPlayerVisualOwner>()
  for (const owner of owners) {
    if (ownerById.has(owner.ownerId)) {
      throw new Error(`Air/Water visual owner is duplicated: ${owner.ownerId}`)
    }
    if (!Number.isFinite(owner.hurricaneCharge)
      || owner.hurricaneCharge < 0
      || owner.hurricaneCharge > 1) {
      throw new RangeError('Hurricane charge must be within [0,1]')
    }
    if (!Number.isFinite(owner.position.x) || !Number.isFinite(owner.position.y)) {
      throw new RangeError('Air/Water visual owner position must be finite')
    }
    ownerById.set(owner.ownerId, owner)
  }

  const hurricaneByOwner = new Map<string, PrimarySpellAirHurricaneState>()
  const transients: PrimarySpellTransientState[] = []
  for (const effect of source.transients) {
    if (effect.kind === 'air-hurricane') {
      if (hurricaneByOwner.has(effect.ownerId)) {
        throw new Error(`Hurricane actor is duplicated for owner: ${effect.ownerId}`)
      }
      hurricaneByOwner.set(effect.ownerId, effect)
      continue
    }
    transients.push(effect)
  }

  let nextId = source.nextId
  for (const owner of owners) {
    if (owner.hurricaneCharge <= 0) continue
    const existing = hurricaneByOwner.get(owner.ownerId)
    transients.push(existing && existing.worldKey === owner.worldKey
      ? {
          ...existing,
          ageTicks: existing.ageTicks + 1,
          charge: owner.hurricaneCharge,
          position: { ...owner.position },
        }
      : {
          ageTicks: 0,
          birthTick: tick,
          charge: owner.hurricaneCharge,
          id: nextId++,
          kind: 'air-hurricane',
          ownerId: owner.ownerId,
          position: { ...owner.position },
          worldKey: owner.worldKey,
        })
  }

  return Object.freeze({
    ...source,
    nextId,
    transients: Object.freeze(transients),
  })
}
