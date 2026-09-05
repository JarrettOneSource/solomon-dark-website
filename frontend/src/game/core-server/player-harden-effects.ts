import { NATIVE_HARDEN_FORMED_THRESHOLD } from '../core-kernels/native-harden.ts'
import {
  createNativeHardenBreakup,
  type NativeHardenChip,
  type NativeHardenEffect,
} from '../core-kernels/native-harden-effects.ts'
import { emitNativeSecondaryEvent, type NativeSecondarySimulationState } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import {
  nativePrimaryPainterRegistrationContract,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  registerNativeWorldPainterRoots,
  type RegisterNativeWorldPainter,
} from '../core-kernels/native-world-manager-order.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import { playerSkillRuntimeAt, type PlayerEntityStore } from './player-entity-store.ts'

export interface PendingPlayerHardenChip {
  readonly chip: NativeHardenChip
  readonly ownerId: string
  readonly position: Vector2
  readonly worldKey: string
}

export function synchronizePlayerHardenEffects(input: {
  readonly before: PlayerEntityStore
  readonly after: PlayerEntityStore
  readonly chips: readonly PendingPlayerHardenChip[]
  readonly spells: PrimarySpellSimulationState
  readonly secondary: NativeSecondarySimulationState
  readonly tick: number
  readonly rng: NativeRngState
  readonly register: RegisterNativeWorldPainter
  readonly worldKey: (playerId: string) => string
}): { spells: PrimarySpellSimulationState; secondary: NativeSecondarySimulationState; rng: NativeRngState } {
  let secondary = input.secondary
  let nextId = input.spells.nextId
  let rng = input.rng
  const births: PrimarySpellTransientState[] = []
  const enroll = (effect: NativeHardenEffect) => {
    const contract = nativePrimaryPainterRegistrationContract(effect)
    births.push({
      ...effect,
      painterRegistrations: registerNativeWorldPainterRoots(
        input.register, contract.managerLane, contract.count,
      ),
    })
  }
  const sound = (
    ownerId: string,
    position: Vector2,
    worldKey: string,
    cue: 'harden' | 'ice-shatter',
    pitch: number,
    gain = 1,
  ) => {
    secondary = emitNativeSecondaryEvent(secondary, {
      actorId: null, cue, gain, kind: 'impact', ownerId, pitch,
      position: { ...position }, skillId: 36, tick: input.tick, worldKey,
    })
  }
  for (const { chip, ownerId, position, worldKey } of input.chips) {
    enroll({
      ...chip.shard, ageTicks: 0, birthTick: input.tick, id: nextId++,
      kind: 'harden-shard', ownerId, worldKey,
    })
    sound(ownerId, position, worldKey, 'ice-shatter', chip.pitch)
  }
  for (const [index, { playerId }] of input.after.identities.entries()) {
    const before = playerSkillRuntimeAt(input.before, playerId)?.harden
    if (!before) continue
    const after = input.after.skillRuntimes[index]!.harden
    const position = input.after.locomotions[index]!.position
    const worldKey = input.worldKey(playerId)
    if (before.coating === 0 && after.coating > 0) {
      sound(playerId, position, worldKey, 'harden', Math.fround(0.8))
    }
    if (before.coating < NATIVE_HARDEN_FORMED_THRESHOLD
      && after.coating >= NATIVE_HARDEN_FORMED_THRESHOLD) {
      sound(playerId, position, worldKey, 'harden', 1)
      sound(playerId, position, worldKey, 'harden', 1)
    }
    if (before.coating > 0 && after.coating === 0) {
      const broken = createNativeHardenBreakup(
        before.coating, position, playerId, worldKey, input.tick, nextId, rng,
      )
      rng = broken.rng
      nextId = broken.nextId
      for (const effect of broken.effects) enroll(effect)
      sound(playerId, position, worldKey, 'ice-shatter', broken.pitch, before.coating)
    }
  }
  return {
    rng,
    secondary,
    spells: births.length === 0 ? input.spells : {
      ...input.spells, nextId, transients: [...input.spells.transients, ...births],
    },
  }
}
