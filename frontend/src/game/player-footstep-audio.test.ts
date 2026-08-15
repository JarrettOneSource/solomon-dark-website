import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from './core-server/game-simulation.ts'
import type { GameAudioDirector, PlaySoundOptions } from './game-audio-director.ts'
import { nativeFootstepCue, type GameSoundCue } from './game-audio-native.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  PlayerFootstepAudioSynchronizer,
  type PlayerFootstepAudioEvent,
} from './player-footstep-audio.ts'
import type { GameSnapshot, ProtocolPlayerState } from './protocol/game-state.ts'

class RecordingAudio {
  readonly calls: Array<{
    cue: GameSoundCue
    options: PlaySoundOptions
  }> = []

  playSound(cue: GameSoundCue, options: PlaySoundOptions = {}): void {
    this.calls.push({ cue, options })
  }
}

test('plays local and remote authoritative footsteps once with listener-relative gain', () => {
  const initial = hubSnapshot()
  const audio = new RecordingAudio()
  const observed: PlayerFootstepAudioEvent[] = []
  const synchronizer = new PlayerFootstepAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    'local',
    initial,
    (event) => {
      assert.equal(audio.calls.length, observed.length)
      observed.push(event)
    },
  )
  const stepped = withPlayers(initial, {
    local: { footstepTick: 25, position: { x: 0, y: 0 } },
    remote: { footstepTick: 25, position: { x: 475, y: 0 } },
  })

  const events = synchronizer.update(stepped)
  assert.deepEqual(events, [
    {
      cue: nativeFootstepCue(25, 'local'),
      playerId: 'local',
      tick: 25,
      volume: 0.5,
    },
    {
      cue: nativeFootstepCue(25, 'remote'),
      playerId: 'remote',
      tick: 25,
      volume: 0.25,
    },
  ])
  assert.deepEqual(audio.calls, events.map((event) => ({
    cue: event.cue,
    options: { volume: event.volume },
  })))
  assert.deepEqual(observed, events)

  assert.deepEqual(synchronizer.update(stepped), [])
  assert.equal(audio.calls.length, 2)

  const sparse = withPlayers(stepped, {
    remote: { footstepTick: 75 },
  })
  assert.deepEqual(synchronizer.update(sparse).map((event) => event.tick), [75])
})

test('filters remote Hub regions while retaining local room footsteps', () => {
  const initial = hubSnapshot()
  const audio = new RecordingAudio()
  const synchronizer = new PlayerFootstepAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    'local',
    initial,
  )
  const separated = withHubRegions(withPlayers(initial, {
    local: { footstepTick: 25 },
    remote: { footstepTick: 25 },
  }), {
    local: 'library',
    remote: 'courtyard',
  })

  assert.deepEqual(
    synchronizer.update(separated).map((event) => event.playerId),
    ['local'],
  )
})

test('hears remote Boneyard footsteps in the same replicated run', () => {
  const hub = hubSnapshot()
  const initial = {
    ...hub,
    world: { kind: 'boneyard', runId: 'run-1' },
  } as unknown as GameSnapshot
  const audio = new RecordingAudio()
  const synchronizer = new PlayerFootstepAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    'local',
    initial,
  )
  const stepped = withPlayers(initial, {
    remote: { footstepTick: 25 },
  })

  assert.deepEqual(
    synchronizer.update(stepped).map((event) => event.playerId),
    ['remote'],
  )
})

test('does not replay an initial tick or a joining player history', () => {
  const base = withPlayers(hubSnapshot(), {
    local: { footstepTick: 25 },
    remote: { footstepTick: 25 },
  })
  const withoutRemote = {
    ...base,
    players: { local: base.players.local },
  }
  const audio = new RecordingAudio()
  const synchronizer = new PlayerFootstepAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    'local',
    withoutRemote,
  )

  assert.deepEqual(synchronizer.update(base), [])
  assert.deepEqual(audio.calls, [])
})

function hubSnapshot(): GameSnapshot {
  const simulation = createGameSimulation({
    local: {
      discipline: 'arcane',
      displayName: 'Local',
      element: 'earth',
    },
    remote: {
      discipline: 'arcane',
      displayName: 'Remote',
      element: 'fire',
    },
  })
  return withPlayers(createGameSnapshot(simulation, 'local'), {
    local: { position: { x: 0, y: 0 } },
    remote: { position: { x: 475, y: 0 } },
  })
}

function withPlayers(
  snapshot: GameSnapshot,
  changes: Readonly<Record<string, Partial<ProtocolPlayerState>>>,
): GameSnapshot {
  const players = { ...snapshot.players }
  for (const [playerId, change] of Object.entries(changes)) {
    const player = players[playerId]
    assert.ok(player, `missing player ${playerId}`)
    players[playerId] = { ...player, ...change }
  }
  return { ...snapshot, players }
}

function withHubRegions(
  snapshot: GameSnapshot,
  regions: Readonly<Record<string, 'courtyard' | 'library'>>,
): GameSnapshot {
  assert.equal(snapshot.world.kind, 'hub')
  if (snapshot.world.kind !== 'hub') return snapshot
  const participants = { ...snapshot.world.participants }
  for (const [playerId, region] of Object.entries(regions)) {
    const participant = participants[playerId]
    assert.ok(participant, `missing participant ${playerId}`)
    participants[playerId] = { ...participant, region }
  }
  return {
    ...snapshot,
    world: { ...snapshot.world, participants },
  }
}
