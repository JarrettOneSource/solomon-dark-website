import { gameRunWorldTick } from '../core-kernels/game-run.ts'
import type { GameSimulationState } from '../core-server/game-simulation.ts'
import { createFlamePresentationHistory, type FlamePresentationBaseline } from '../protocol/flame-presentation-history.ts'
import { flamePresentationBirth, type FlamePresentationRecipe } from '../protocol/flame-presentation.ts'
import { GAME_WEBSOCKET_MAX_PAYLOAD_BYTES } from '../protocol/game-protocol-contract.ts'
import { MAX_PRIMARY_SPELL_TRANSIENTS } from '../protocol/game-protocol-limits.ts'

/** Host-connection storage. A replaced state without a committed predecessor starts a new epoch. */
export function createHostFlamePresentationHistory() {
  let nextEpoch = 1
  type History = ReturnType<typeof createFlamePresentationHistory<FlamePresentationRecipe>>
  const histories = new WeakMap<GameSimulationState, History>()
  const tick = (state: GameSimulationState) => gameRunWorldTick(state.tick, state.run)
  const key = (state: GameSimulationState) => state.world.kind === 'hub' ? 'hub' : `boneyard:${state.world.runId}`
  const create = (state: GameSimulationState): History => {
    const history = createFlamePresentationHistory<FlamePresentationRecipe>({ worldKey: key(state), tick: tick(state),
      initialEpoch: nextEpoch++, maximumBirths: MAX_PRIMARY_SPELL_TRANSIENTS,
      maximumBytes: Math.floor(GAME_WEBSOCKET_MAX_PAYLOAD_BYTES / 4) })
    histories.set(state, history)
    return history
  }
  const ensure = (state: GameSimulationState): History => histories.get(state) ?? create(state)
  const liveBirths = (state: GameSimulationState) => JSON.stringify(state.primarySpells.transients
    .flatMap(actor => {
      const birth = flamePresentationBirth(actor)
      return birth && birth.birthTick <= tick(state) && birth.endTickExclusive > tick(state) ? [birth] : []
    }).sort((left, right) => left.id - right.id))
  return {
    resetFrame(state: GameSimulationState) { return ensure(state).frame(null, tick(state)) },
    frame(state: GameSimulationState, baseline: FlamePresentationBaseline | null) {
      return ensure(state).frame(baseline, tick(state))
    },
    advance(previous: GameSimulationState, current: GameSimulationState): void {
      const previousTick = tick(previous), currentTick = tick(current)
      if (key(previous) !== key(current) || currentTick < previousTick || currentTick > previousTick + 1) {
        create(current); return
      }
      // The existing ACK cursor contains only a stopped-world tick. It cannot
      // acknowledge a second presentation mutation at that same tick. Reuse
      // snapshot reset/recovery, whose complete actors preserve live survivors.
      if (currentTick === previousTick && previous.primarySpells !== current.primarySpells
        && liveBirths(previous) !== liveBirths(current)) {
        create(current); return
      }
      const history = ensure(previous)
      histories.set(current, history)
      const births = current.primarySpells.transients.flatMap(actor => {
        if (!('birthTick' in actor) || actor.birthTick !== currentTick || actor.ageTicks !== 0) return []
        const birth = flamePresentationBirth(actor)
        return birth ? [birth] : []
      })
      history.recordTick(currentTick, births)
      const live = new Set(current.primarySpells.transients.map(actor => `${actor.worldKey}:${actor.id}`))
      for (const actor of previous.primarySpells.transients) {
        if (live.has(`${actor.worldKey}:${actor.id}`)) continue
        const birth = flamePresentationBirth(actor)
        if (birth) history.retireBirth(birth, currentTick)
      }
    },
    discardThrough(state: GameSimulationState, worldTick: number) { ensure(state).discardThroughTick(worldTick) },
  }
}
