import type {
  PrimarySpellAirHurricaneState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  createNativeHurricanePresentation,
  stepNativeHurricanePresentation,
} from '../core-kernels/native-hurricane.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export interface AirWaterPlayerVisualOwner {
  readonly hurricaneContactCharge: number
  readonly hurricaneCharge: number
  readonly hurricaneDamageMaximum: number
  readonly hurricaneDamageMinimum: number
  readonly ownerId: string
  readonly position: Vector2
  readonly worldKey: string
}

export interface AirWaterPlayerVisualResult {
  readonly rng: NativeRngState
  readonly spells: PrimarySpellSimulationState
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
  sourceRng: NativeRngState,
): AirWaterPlayerVisualResult {
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
      || owner.hurricaneCharge > 1
      || !Number.isFinite(owner.hurricaneContactCharge)
      || owner.hurricaneContactCharge < 0
      || owner.hurricaneContactCharge > 1) {
      throw new RangeError('Hurricane charges must be within [0,1]')
    }
    if (owner.hurricaneContactCharge > owner.hurricaneCharge) {
      throw new RangeError('Hurricane contact charge must not exceed presentation charge')
    }
    if (!Number.isFinite(owner.hurricaneDamageMinimum)
      || !Number.isFinite(owner.hurricaneDamageMaximum)
      || owner.hurricaneDamageMinimum < 0
      || owner.hurricaneDamageMaximum < owner.hurricaneDamageMinimum) {
      throw new RangeError('Hurricane damage range is invalid')
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
  let rng = sourceRng
  for (const owner of owners) {
    if (owner.hurricaneCharge <= 0) continue
    const existing = hurricaneByOwner.get(owner.ownerId)
    if (
      existing
      && existing.worldKey === owner.worldKey
      && owner.hurricaneContactCharge > 0
    ) {
      const stepped = stepNativeHurricanePresentation({
        lanes: existing.lanes,
        phaseDegrees: existing.phaseDegrees,
      }, owner.hurricaneContactCharge, rng)
      rng = stepped.rng
      transients.push(Object.freeze({
          ...existing,
          ageTicks: existing.ageTicks + 1,
          charge: owner.hurricaneCharge,
          contactCharge: owner.hurricaneContactCharge,
          damageMaximum: owner.hurricaneDamageMaximum,
          damageMinimum: owner.hurricaneDamageMinimum,
          lanes: stepped.program.lanes,
          phaseDegrees: stepped.program.phaseDegrees,
          position: { ...owner.position },
      }))
      continue
    }
    const created = createNativeHurricanePresentation(rng)
    rng = created.rng
    transients.push(Object.freeze({
      ageTicks: 0,
      birthTick: tick,
      charge: owner.hurricaneCharge,
      contactCharge: owner.hurricaneContactCharge,
      damageMaximum: owner.hurricaneDamageMaximum,
      damageMinimum: owner.hurricaneDamageMinimum,
      enhancedEffects: true,
      id: nextId++,
      kind: 'air-hurricane',
      lanes: created.program.lanes,
      ownerId: owner.ownerId,
      phaseDegrees: created.program.phaseDegrees,
      position: { ...owner.position },
      worldKey: owner.worldKey,
    }))
  }

  return Object.freeze({
    rng,
    spells: Object.freeze({
      ...source,
      nextId,
      transients: Object.freeze(transients),
    }),
  })
}
