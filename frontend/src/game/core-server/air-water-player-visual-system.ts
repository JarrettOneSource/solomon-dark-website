import type {
  PrimarySpellChannelEmission,
  PrimarySpellAirHurricaneState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  createNativeWaterAuraActor,
  createNativeWaterHailActor,
  stepNativeWaterHailActor,
} from '../core-kernels/air-water-spell-actors.ts'
import {
  createNativeHurricanePresentation,
  stepNativeHurricanePresentation,
} from '../core-kernels/native-hurricane.ts'
import {
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import {
  waterFrostJetKind,
  waterFrostJetParticleCount,
} from '../core-kernels/primary-spell-water.ts'
import {
  createNativeWorldManagerOrder,
  registerNativeWorldPainterRoots,
  type RegisterNativeWorldPainter,
} from '../core-kernels/native-world-manager-order.ts'
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
 * Projects player-owned Air/Water presentation actors into the shared spell
 * ECS. Hurricane and Cold Aura follow live owners. Hail allocation occurs in
 * the native Water-handler order before Boneyard gameplay contact.
 */
export function synchronizeAirWaterPlayerVisualActors(
  source: PrimarySpellSimulationState,
  owners: readonly AirWaterPlayerVisualOwner[],
  tick: number,
  sourceRng: NativeRngState,
  channelEmissions: readonly PrimarySpellChannelEmission[] = [],
  registerWorldPainter?: RegisterNativeWorldPainter,
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
    if (effect.kind === 'water-aura') {
      const owner = ownerById.get(effect.ownerId)
      if (owner === undefined || owner.worldKey !== effect.worldKey) continue
      transients.push(Object.freeze({
        ...effect,
        origin: Object.freeze({ ...owner.position }),
      }))
      continue
    }
    transients.push(effect)
  }

  let nextId = source.nextId
  let rng = sourceRng
  const standaloneOrder = createNativeWorldManagerOrder({
    nextRegistrationOrdinal: { actor: nextId, transient: nextId },
  })
  const register = registerWorldPainter ?? standaloneOrder.register
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
      painterRegistrations: registerNativeWorldPainterRoots(register, 'actor'),
      phaseDegrees: created.program.phaseDegrees,
      position: { ...owner.position },
      worldKey: owner.worldKey,
    }))
  }

  for (const emission of channelEmissions) {
    if (
      emission.kind !== 'water'
      || emission.primarySkill.kind !== 'water'
      || emission.underpowered
      || emission.primarySkill.hailThreshold <= 0
    ) continue
    const particleCount = waterFrostJetParticleCount(
      emission.primarySkill.widenHalfDegrees,
    )
    for (const frost of waterEmissionTransients(source, emission, particleCount)) {
      if (waterFrostJetKind(frost.id, frost.underpowered) !== 'normal') continue
      const visualGate = drawNativeInteger(rng, 250)
      rng = visualGate.state
      if (visualGate.value >= emission.primarySkill.hailThreshold) continue
      const hail = createNativeWaterHailActor(
        nextId,
        emission.ownerId,
        emission.worldKey,
        tick,
        emission.origin,
        frost.direction,
        rng,
      )
      rng = hail.rng
      transients.push(Object.freeze({
        ...hail.actor,
        painterRegistrations: registerNativeWorldPainterRoots(register, 'actor'),
      }))
      nextId += 1
    }
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

/**
 * Completes the Water-handler presentation order after gameplay contact: Aura
 * births first, then previously registered Hail actors receive their update.
 */
export function finalizeAirWaterPlayerVisualActors(
  source: PrimarySpellSimulationState,
  channelEmissions: readonly PrimarySpellChannelEmission[],
  tick: number,
  sourceRng: NativeRngState,
  registerWorldPainter: RegisterNativeWorldPainter,
): AirWaterPlayerVisualResult {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Air/Water visual actor tick must be a non-negative safe integer')
  }
  let nextId = source.nextId
  let rng = sourceRng
  const withAura: PrimarySpellTransientState[] = [...source.transients]
  if (tick % 6 === 0) {
    for (const emission of channelEmissions) {
      if (
        emission.kind !== 'water'
        || emission.primarySkill.kind !== 'water'
        || emission.underpowered
        || emission.primarySkill.auraRadius <= 0
      ) continue
      const aura = createNativeWaterAuraActor(
        nextId,
        emission.ownerId,
        emission.worldKey,
        tick,
        emission.queryOrigin,
        emission.primarySkill.auraRadius,
        rng,
      )
      rng = aura.rng
      withAura.push(Object.freeze({
        ...aura.actor,
        painterRegistrations: registerNativeWorldPainterRoots(
          registerWorldPainter,
          'actor',
        ),
      }))
      nextId += 1
    }
  }

  const transients: PrimarySpellTransientState[] = []
  for (const effect of withAura) {
    if (effect.kind !== 'water-hail' || effect.birthTick === tick) {
      transients.push(effect)
      continue
    }
    const stepped = stepNativeWaterHailActor(effect, rng)
    rng = stepped.rng
    if (stepped.actor !== null) transients.push(Object.freeze(stepped.actor))
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

function waterEmissionTransients(
  source: PrimarySpellSimulationState,
  emission: PrimarySpellChannelEmission,
  particleCount: number,
): readonly Extract<PrimarySpellTransientState, { kind: 'water' }>[] {
  return source.transients.filter((effect): effect is Extract<
    PrimarySpellTransientState,
    { kind: 'water' }
  > => (
    effect.kind === 'water'
    && effect.ownerId === emission.ownerId
    && effect.worldKey === emission.worldKey
    && effect.id >= emission.id
    && effect.id < emission.id + particleCount
  )).sort((left, right) => left.id - right.id)
}
