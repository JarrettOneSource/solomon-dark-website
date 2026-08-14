import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterInput,
  type WizardElement,
} from './core-kernels/player-character.ts'
import {
  PRIMARY_CAST_ETHER_EMISSION_TICK,
} from './core-kernels/primary-spells.ts'
import {
  createGameSimulation,
  getPlayerCharacter,
  removePlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
} from './core-server/game-simulation.ts'
import type { GameAudioDirector, PlaySoundOptions } from './game-audio-director.ts'
import type { GameLoopCue, GameSoundCue } from './game-audio-native.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { PrimarySpellAudioSynchronizer } from './primary-spell-audio.ts'

const PLAYER_ID = 'caster'

class RecordingAudio {
  readonly sounds: GameSoundCue[] = []
  readonly soundOptions: PlaySoundOptions[] = []
  readonly starts: Array<[GameLoopCue, string]> = []
  readonly stops: Array<[GameLoopCue, string]> = []

  playSound(cue: GameSoundCue, options: PlaySoundOptions = {}): void {
    this.sounds.push(cue)
    this.soundOptions.push(options)
  }

  startLoop(cue: GameLoopCue, owner: string): void {
    this.starts.push([cue, owner])
  }

  stopLoop(cue: GameLoopCue, owner: string): void {
    this.stops.push([cue, owner])
  }
}

function simulation(element: WizardElement): GameSimulationState {
  return createGameSimulation({
    [PLAYER_ID]: {
      discipline: 'arcane',
      displayName: 'Caster',
      element,
    },
  })
}

function castInput(state: GameSimulationState, primary: boolean): PlayerCharacterInput {
  const player = getPlayerCharacter(state, PLAYER_ID)
  return {
    ...createIdlePlayerCharacterInput(),
    aim: { x: player.position.x, y: player.position.y - 200 },
    cast: { primary, secondary: false },
  }
}

function step(state: GameSimulationState, primary: boolean, count = 1): GameSimulationState {
  let next = state
  for (let index = 0; index < count; index += 1) {
    next = stepGameSimulationTick(next, { [PLAYER_ID]: castInput(next, primary) })
  }
  return next
}

test('consumes Air start once and balances its held loop on release', () => {
  let state = simulation('air')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  const held = createGameSnapshot(state, PLAYER_ID)
  synchronizer.update(held)
  synchronizer.update(held)
  assert.deepEqual(audio.sounds, ['lightning-start'])
  assert.deepEqual(audio.starts, [['lightning-loop', 'primary-player:caster']])
  state = step(state, false)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.stops, [['lightning-loop', 'primary-player:caster']])
  synchronizer.destroy()
})

test('consumes the Ether one-shot only from its authoritative marker sequence', () => {
  let state = simulation('ether')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true, PRIMARY_CAST_ETHER_EMISSION_TICK)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.sounds, [])
  state = step(state, true)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.sounds, ['magic-missile'])
})

test('consumes the Fire release once from its authoritative marker sequence', () => {
  let state = simulation('fire')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true, 20)
  const emitted = createGameSnapshot(state, PLAYER_ID)
  synchronizer.update(emitted)
  synchronizer.update(emitted)
  assert.deepEqual(audio.sounds, ['throw-fire'])
})

test('plays each semantic Fire impact once without replaying an initial snapshot', () => {
  const initial = simulation('fire')
  const player = getPlayerCharacter(initial, PLAYER_ID)
  const impact = {
    ageTicks: 4,
    id: 1,
    kind: 'fire-impact',
    origin: { x: player.position.x, y: player.position.y - 50 },
    ownerId: PLAYER_ID,
    worldKey: 'hub:courtyard',
  } as const
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(initial, PLAYER_ID),
  )
  const impacted = createGameSnapshot({
    ...initial,
    primarySpells: { nextId: 2, projectiles: [], transients: [impact] },
  }, PLAYER_ID)
  synchronizer.update(impacted)
  synchronizer.update(impacted)
  assert.deepEqual(audio.sounds, ['fireball-hit'])
  assert.equal(audio.soundOptions[0].playbackRate! >= 0.9, true)
  assert.equal(audio.soundOptions[0].playbackRate! < 1.1, true)
  assert.equal(audio.soundOptions[0].volume! > 0, true)

  const reconnectAudio = new RecordingAudio()
  const reconnect = new PrimarySpellAudioSynchronizer(
    reconnectAudio as unknown as GameAudioDirector,
    PLAYER_ID,
    impacted,
  )
  reconnect.update(impacted)
  assert.deepEqual(reconnectAudio.sounds, [])
})

test('consumes Water start once and balances its held loop on release', () => {
  let state = simulation('water')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  const held = createGameSnapshot(state, PLAYER_ID)
  synchronizer.update(held)
  synchronizer.update(held)
  assert.deepEqual(audio.sounds, ['ice-start'])
  assert.deepEqual(audio.starts, [['ice-loop', 'primary-player:caster']])
  state = step(state, false)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.stops, [['ice-loop', 'primary-player:caster']])
})

test('plays Earth creation once, retains gathering through the charge latch, then rolls', () => {
  let state = simulation('earth')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.sounds, ['start-boulder'])
  assert.deepEqual(audio.starts, [['gather-rocks-loop', 'primary-player:caster']])
  state = step(state, false)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.sounds, ['start-boulder'])
  assert.equal(audio.starts.some(([cue]) => cue === 'rolling-stone-loop'), false)
  assert.equal(audio.stops.some(([cue]) => cue === 'gather-rocks-loop'), false)

  state = step(state, false, 95)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.equal(state.primarySpells.projectiles[0].ageTicks, 97)
  assert.equal(state.primarySpells.projectiles[0].phase, 'held')
  state = step(state, false)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  assert.deepEqual(audio.sounds, ['start-boulder'])
  assert.ok(audio.starts.some(([cue]) => cue === 'rolling-stone-loop'))
  assert.ok(audio.stops.some(([cue]) => cue === 'gather-rocks-loop'))

  state = removePlayerCharacter(state, PLAYER_ID)
  synchronizer.update(createGameSnapshot(state, null))
  assert.ok(audio.stops.some(([cue]) => cue === 'rolling-stone-loop'))
  synchronizer.destroy()
})

test('stops Earth gathering at full charge without ending the held cast', () => {
  let state = simulation('earth')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))
  state = step(state, true, 655)
  synchronizer.update(createGameSnapshot(state, PLAYER_ID))

  const boulder = state.primarySpells.projectiles[0]
  assert.equal(boulder.charge, 1)
  assert.equal(boulder.phase, 'held')
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.channelActive, true)
  assert.deepEqual(audio.sounds, ['start-boulder'])
  assert.deepEqual(audio.starts, [['gather-rocks-loop', 'primary-player:caster']])
  assert.deepEqual(audio.stops, [['gather-rocks-loop', 'primary-player:caster']])
  assert.equal(audio.starts.some(([cue]) => cue === 'rolling-stone-loop'), false)
  synchronizer.destroy()
})
