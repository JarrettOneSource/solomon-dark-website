import { HAGATHA_PERKS } from './core-kernels/hub-economy.ts'
import { NATIVE_HAGATHA_SELECTORS } from './core-kernels/native-hagatha-effects.ts'
import type { GameSnapshot } from './protocol/game-state.ts'

export interface RunCharmStatus {
  readonly active: boolean
  readonly detail: string
  readonly name: string
  readonly record: number
  readonly selector: number
}

/** Read the owning participant's current authority state; never infer gameplay from HUD history. */
export function projectRunCharmStatus(snapshot: GameSnapshot, playerId: string): readonly RunCharmStatus[] {
  const player = snapshot.players[playerId]
  if (!player || snapshot.world.kind !== 'boneyard' || snapshot.run.phase !== 'active'
    || snapshot.run.runId !== snapshot.world.runId) return []
  return player.economy.ownedPerkSelectors.map(selector => {
    const perk = HAGATHA_PERKS[selector]!
    const runtime = player.progression.hagathaRuntime
    let inactiveReason: string | null = null
    switch (selector) {
      case NATIVE_HAGATHA_SELECTORS.cheatDeath:
        if (runtime.cheatDeathCharges === 0) inactiveReason = 'Used up'
        break
      case NATIVE_HAGATHA_SELECTORS.serendipity:
        if (!runtime.serendipityActive) inactiveReason = 'Lost after taking damage'
        break
      case NATIVE_HAGATHA_SELECTORS.reverie:
        if (!runtime.reverieActive) inactiveReason = 'Lost after taking damage'
        break
      case NATIVE_HAGATHA_SELECTORS.bareHands:
        if (player.economy.equipment.weapon !== null) inactiveReason = 'Weapon equipped'
        break
    }
    return {
      active: inactiveReason === null,
      detail: inactiveReason === null ? `Active. ${perk.description}` : `Inactive. ${inactiveReason}.`,
      name: perk.name,
      record: 127 + selector,
      selector,
    }
  })
}

export function sameRunCharmStatus(first: readonly RunCharmStatus[], second: readonly RunCharmStatus[]): boolean {
  return first.length === second.length && first.every((charm, index) => (
    charm.selector === second[index]!.selector && charm.active === second[index]!.active
  ))
}
