import {
  NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
} from '../core-kernels/primary-spell-fire-native.ts'
import { waterFrostJetLifetimeTicks } from '../core-kernels/primary-spell-water.ts'
import {
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS } from '../core-kernels/native-ether-blast.ts'
import { isNativePlayerStaffTransient } from '../core-kernels/native-player-staff-action.ts'
import {
  copyPrimarySpellTransient,
  isStateDrivenWeldTransient,
} from './primary-spell-transient-copy.ts'
import { interpolatePrimarySpellTransient } from './primary-spell-transient-interpolation.ts'

export interface PrimarySpellPresentationTime {
  newerTick: number
  olderTick: number
  targetTick: number
}

interface FixedTransientTiming {
  ageZeroTick: number
  firstVisibleAge: 0 | 1
  lifetimeTicks: number
}

interface BracketedFixedTransient {
  newer?: PrimarySpellTransientState
  older?: PrimarySpellTransientState
  timing: FixedTransientTiming
}

export function interpolatePrimarySpellTransients(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
  time: PrimarySpellPresentationTime,
): PrimarySpellTransientState[] {
  const result = interpolateStateDrivenTransients(older, newer, blend)
  const fixed = new Map<number, BracketedFixedTransient>()

  for (const effect of older.transients) {
    const timing = fixedTransientTiming(effect, time.olderTick)
    if (timing) fixed.set(effect.id, { older: effect, timing })
  }
  for (const effect of newer.transients) {
    const timing = fixedTransientTiming(effect, time.newerTick)
    if (!timing) continue
    const bracket = fixed.get(effect.id)
    if (bracket) bracket.newer = effect
    else fixed.set(effect.id, { newer: effect, timing })
  }

  for (const bracket of fixed.values()) {
    const displayAge = time.targetTick - bracket.timing.ageZeroTick
    if (
      displayAge < bracket.timing.firstVisibleAge
      || displayAge >= bracket.timing.lifetimeTicks
    ) continue
    const source = bracket.older && bracket.newer
      ? interpolatePrimarySpellTransient(bracket.older, bracket.newer, blend)
      : copyPrimarySpellTransient(bracket.older ?? bracket.newer!)
    result.push({
      ...source,
      ageTicks: source.kind === 'air' ? Math.floor(displayAge) : displayAge,
    })
  }

  return result.sort((first, second) => first.id - second.id)
}

function interpolateStateDrivenTransients(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
): PrimarySpellTransientState[] {
  const newerById = new Map(newer.transients
    .filter(isStateDrivenTransient)
    .map((effect) => [effect.id, effect]))
  const result = older.transients
    .filter(isStateDrivenTransient)
    .map((effect) => {
      const next = newerById.get(effect.id)
      return next
        ? interpolatePrimarySpellTransient(effect, next, blend)
        : copyPrimarySpellTransient(effect)
    })
  if (blend < 1) return result

  const knownIds = new Set(result.map((effect) => effect.id))
  for (const effect of newerById.values()) {
    if (!knownIds.has(effect.id)) result.push(copyPrimarySpellTransient(effect))
  }
  return result.filter((effect) => newerById.has(effect.id))
}

function fixedTiming(
  ageZeroTick: number,
  lifetimeTicks: number,
  firstVisibleAge: 0 | 1 = 0,
): FixedTransientTiming {
  return { ageZeroTick, firstVisibleAge, lifetimeTicks }
}

function fixedTransientTiming(
  effect: PrimarySpellTransientState,
  snapshotTick: number,
): FixedTransientTiming | undefined {
  switch (effect.kind) {
    case 'air': return fixedTiming(
      effect.birthTick,
      effect.underpowered
        ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
        : PRIMARY_SPELL_AIR_LIFETIME_TICKS,
    )
    case 'earth-impact': return fixedTiming(effect.birthTick, effect.lifetimeTicks)
    case 'ether-impact': return fixedTiming(
      effect.birthTick,
      PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
    )
    case 'ether-blast': return fixedTiming(
      effect.birthTick,
      NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS,
    )
    case 'ether-pierce-streak': return fixedTiming(snapshotTick - effect.ageTicks, 10)
    case 'fire': return fixedTiming(
      snapshotTick - effect.ageTicks,
      nativeFireParticleLifetimeTicks(effect.id),
    )
    case 'fire-explosion': return fixedTiming(
      snapshotTick - effect.ageTicks,
      NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS,
    )
    case 'fire-impact': return fixedTiming(
      snapshotTick - effect.ageTicks,
      PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
    )
    case 'water': return fixedTiming(
      snapshotTick - effect.ageTicks,
      waterFrostJetLifetimeTicks(effect.id),
      1,
    )
    case 'water-aura': return fixedTiming(effect.birthTick, effect.durationTicks)
    case 'weld-blizzard-chain-frost': return fixedTiming(
      effect.birthTick,
      waterFrostJetLifetimeTicks(effect.id),
    )
    case 'weld-blizzard-glow': return fixedTiming(effect.birthTick, 1)
    case 'weld-frost-fade': return fixedTiming(
      effect.birthTick,
      effect.buildId === 1004 ? 3 : 20,
    )
  }
}

function isStateDrivenTransient(effect: PrimarySpellTransientState): boolean {
  return effect.kind === 'air-hurricane'
    || effect.kind === 'harden-burst'
    || effect.kind === 'harden-shard'
    || effect.kind === 'earth-boulder-bit'
    || effect.kind === 'earth-called-rock'
    || effect.kind === 'fire-ember'
    || effect.kind === 'fire-good-imp'
    || effect.kind === 'fire-patch'
    || effect.kind === 'water-hail'
    || isNativePlayerStaffTransient(effect)
    || isStateDrivenWeldTransient(effect)
}
