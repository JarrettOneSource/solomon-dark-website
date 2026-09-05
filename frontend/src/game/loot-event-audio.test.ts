import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameSnapshot } from './protocol/game-state.ts'
import { BoneyardLootEventSynchronizer } from './loot-event-audio.ts'

test('loot events dispatch once, do not replay the initial retention window, and reset by run', () => {
  const initial = snapshot('run-1', [event('run-1', 1)])
  const synchronizer = new BoneyardLootEventSynchronizer(initial)
  const observed: number[] = []
  synchronizer.consume(initial, ({ eventId }) => observed.push(eventId))
  synchronizer.consume(snapshot('run-1', [event('run-1', 1), event('run-1', 2)]), ({ eventId }) => (
    observed.push(eventId)
  ))
  synchronizer.consume(snapshot('run-1', [event('run-1', 2)]), ({ eventId }) => (
    observed.push(eventId)
  ))
  synchronizer.consume(snapshot('run-2', [event('run-2', 1)]), ({ eventId }) => (
    observed.push(eventId)
  ))
  assert.deepEqual(observed, [2, 1])
})

function event(runId: string, eventId: number) {
  return {
    actorId: 7,
    eventId,
    playbackRate: 1,
    position: { x: 10, y: 20 },
    runId,
    sound: 'pickup-coin' as const,
    tick: eventId,
    type: 'loot-pickup' as const,
  } as GameSnapshot
}

function snapshot(
  runId: string,
  lootEvents: ReturnType<typeof event>[],
): GameSnapshot {
  return {
    hostPlayerId: 'host',
    levelUpBarrier: null,
    players: {},
    primarySpells: { nextId: 1, projectiles: [], transients: [] },
    run: {
      eligiblePlayerIds: [],
      gameOverEventId: 0,
      gameOverExitKind: null,
      gameOverExitTicks: null,
      gameOverTicks: 0,
      lastCompletedRunId: null,
      loadoutReadyPlayerIds: [],
      nextGameOverEventId: 1,
      phase: 'active',
      runId,
    },
    secondaryAbilities: {
      actors: [],
      miscLights: [],
      nextActorId: 1,
      nextEventId: 1,
      players: {},
      regionScreenFeedback: null,
      semanticEvents: [],
      sharedRng: { index: 0, words: Array(55).fill(0) },
    },
    tick: lootEvents.at(-1)?.tick ?? 0,
    world: {
      arenaTransition: null,
      deathEffects: [],
      encounter: null,
      enemies: [],
      enemyEvents: [],
      enemyProjectileEffects: [],
      enemyProjectiles: [],
      gateLeaves: [],
      goodies: [],
      kind: 'boneyard',
      lanternLightRegistration: null,
      lanternPosition: null,
      loot: [],
      lootEvents,
      mageLightningPulses: [],
      maggots: [],
      runId,
      waves: null,
    },
  }
}
