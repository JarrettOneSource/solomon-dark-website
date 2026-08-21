import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterInput,
  type WizardElement,
} from './core-kernels/player-character.ts'
import {
  PRIMARY_CAST_ETHER_EMISSION_TICK,
  type PrimarySpellFireGoodImpState,
} from './core-kernels/primary-spells.ts'
import type {
  NativeSecondaryActorKind,
  NativeSecondaryActorState,
  NativeSecondaryAudioCue,
  NativeSecondaryEventState,
} from './core-kernels/native-secondary-abilities.ts'
import {
  createGameSimulation,
  getPlayerCharacter,
  removePlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
} from './core-server/game-simulation.ts'
import type { GameAudioDirector, PlaySoundOptions } from './game-audio-director.ts'
import type {
  GameLoopCue,
  GameSoundCue,
  SecondaryStreamCue,
} from './game-audio-native.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { PrimarySpellAudioSynchronizer } from './primary-spell-audio.ts'
import type { NativeWeldBuildId } from './core-kernels/native-weld-primary-profile.ts'

const PLAYER_ID = 'caster'

class RecordingAudio {
  readonly sounds: GameSoundCue[] = []
  readonly soundOptions: PlaySoundOptions[] = []
  readonly starts: Array<[GameLoopCue, string]> = []
  readonly startOptions: PlaySoundOptions[] = []
  readonly stops: Array<[GameLoopCue, string]> = []
  readonly streams: SecondaryStreamCue[] = []
  readonly streamOptions: PlaySoundOptions[] = []

  playSound(cue: GameSoundCue, options: PlaySoundOptions = {}): void {
    this.sounds.push(cue)
    this.soundOptions.push(options)
  }

  playStream(cue: SecondaryStreamCue, options: PlaySoundOptions = {}): void {
    this.streams.push(cue)
    this.streamOptions.push(options)
  }

  startLoop(cue: GameLoopCue, owner: string, options: PlaySoundOptions = {}): void {
    this.starts.push([cue, owner])
    this.startOptions.push(options)
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

function secondaryActor(
  kind: NativeSecondaryActorKind,
  id: number,
  ownerId: string,
  initial: ReturnType<typeof createGameSnapshot>,
): NativeSecondaryActorState {
  return {
    ageTicks: 1,
    alpha: 1,
    damage: 1,
    enhanced: false,
    endpoint: { x: 0, y: 0 },
    frame: 0,
    freezeTicks: 0,
    golem: null,
    hitTargetIds: [],
    id,
    kind,
    lifetimeTicks: 100,
    lightRegistration: null,
    midpoint: { x: 0, y: 0 },
    miscLightAppendOrdinal: null,
    ownerId,
    phase: 0,
    position: initial.players[PLAYER_ID].position,
    presentationRng: null,
    quantity: 0,
    radius: 1,
    rank: 1,
    rotationRadians: 0,
    scale: 1,
    skillId: kind.startsWith('mindblast-')
      ? null
      : kind === 'acid-rain'
        ? 72
        : kind === 'comet'
          ? 76
          : 11,
    slowFactor: 0,
    targetId: null,
    variant: 0,
    velocity: { x: 0, y: 0 },
    worldKey: 'hub:courtyard',
  }
}

function castInput(state: GameSimulationState, primary: boolean): PlayerCharacterInput {
  const player = getPlayerCharacter(state, PLAYER_ID)
  return {
    ...createIdlePlayerCharacterInput(),
    aim: { x: player.position.x, y: player.position.y - 200 },
    cast: { primary, secondary: null },
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

test('plays the authoritative welded one-shot sound variant without relying on actor survival', () => {
  const initial = weldedSnapshot(
    createGameSnapshot(simulation('air'), PLAYER_ID),
    1002,
  )
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initial,
  )
  const emitted = weldedSnapshot(initial, 1002, {
    emissionSequence: 1,
    lastWeldPlaybackRate: 1.125,
    lastWeldSoundVariant: 0,
  })
  synchronizer.update(emitted)
  synchronizer.update(emitted)
  assert.deepEqual(audio.sounds, ['throw-lightning-1'])
  assert.deepEqual(audio.soundOptions, [{ playbackRate: 1.125, volume: 1 }])
  synchronizer.destroy()
})

test('balances every welded channel loop and plays only its start cue', () => {
  const initial = weldedSnapshot(
    createGameSnapshot(simulation('fire'), PLAYER_ID),
    1003,
  )
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initial,
  )
  const active = weldedSnapshot(initial, 1003, {
    castSequence: 1,
    channelActive: true,
  })
  synchronizer.update(active)
  synchronizer.update(active)
  assert.deepEqual(audio.sounds, ['flame-lash-start'])
  assert.deepEqual(audio.starts, [['fire-loop', 'primary-player:caster']])

  const released = weldedSnapshot(active, 1003, { channelActive: false })
  synchronizer.update(released)
  assert.deepEqual(audio.stops, [['fire-loop', 'primary-player:caster']])
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

test('consumes GoodImp landing and Bite banks only from replicated actor counters', () => {
  const state = simulation('fire')
  const initial = createGameSnapshot(state, PLAYER_ID)
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initial,
  )
  const imp = {
    ageTicks: 2,
    bodyRotationDeg: 0,
    bodyScale: 0.98,
    bodyVariant: 1,
    bounceSoundIndex: 3,
    bounceSoundPitch: 1.05,
    bounceSoundSequence: 1,
    burnDamage: 3,
    collisionRadius: 1,
    contactAgeTicks: 0,
    contactOrigin: { x: initial.players[PLAYER_ID].position.x + 10, y: initial.players[PLAYER_ID].position.y },
    contactScale: 0.55,
    contactSoundIndex: 2,
    contactSoundPitch: 1.125,
    contactSoundSequence: 1,
    damage: 5,
    effectAlpha: 1,
    effectPhase: 2,
    flightSpeed: 4.5,
    headingDegrees: 0,
    id: 700,
    kind: 'fire-good-imp',
    lightGlow: 0.02,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 9 },
    ownerId: PLAYER_ID,
    position: { ...initial.players[PLAYER_ID].position },
    remainingTicks: 298,
    targetId: 'enemy:1',
    verticalOffset: 0,
    verticalVelocity: -4,
    worldKey: 'hub:courtyard',
  } satisfies PrimarySpellFireGoodImpState
  const landed = {
    ...initial,
    primarySpells: { ...initial.primarySpells, transients: [imp] },
    tick: initial.tick + 1,
  }
  synchronizer.update(landed)
  synchronizer.update(landed)
  assert.deepEqual(audio.sounds, ['imp-vocal-4', 'bite-3'])
  assert.deepEqual(audio.soundOptions.map(({ playbackRate }) => playbackRate), [1.05, 1.125])

  synchronizer.update({
    ...landed,
    primarySpells: {
      ...landed.primarySpells,
      transients: [{
        ...imp,
        bounceSoundIndex: 0,
        bounceSoundPitch: 1.01,
        bounceSoundSequence: 2,
        contactAgeTicks: null,
        contactOrigin: null,
      }],
    },
    tick: landed.tick + 1,
  })
  assert.deepEqual(audio.sounds, ['imp-vocal-4', 'bite-3', 'imp-vocal-1'])
})

test('orders low-mana fizzle before both pitch-reduced one-shot launches', () => {
  for (const [element, cue] of [
    ['ether', 'magic-missile'],
    ['fire', 'throw-fire'],
  ] as const) {
    const state = simulation(element)
    const initial = createGameSnapshot(state, PLAYER_ID)
    const audio = new RecordingAudio()
    const synchronizer = new PrimarySpellAudioSynchronizer(
      audio as unknown as GameAudioDirector,
      PLAYER_ID,
      initial,
    )
    const emitted = {
      ...initial,
      players: {
        ...initial.players,
        [PLAYER_ID]: {
          ...initial.players[PLAYER_ID],
          primaryCast: {
            ...initial.players[PLAYER_ID].primaryCast,
            emissionSequence: 1,
            fizzleSequence: 1,
            underpowered: true,
          },
        },
      },
      tick: initial.tick + 1,
    }
    synchronizer.update(emitted)
    assert.deepEqual(audio.sounds, ['fizzle', cue])
    assert.deepEqual(audio.soundOptions, [
      { playbackRate: 1, volume: 1 },
      { playbackRate: 0.75, volume: 1 },
    ])
  }
})

test('updates weak Air loop gain without replaying its start cue', () => {
  let state = simulation('air')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  const normal = createGameSnapshot(state, PLAYER_ID)
  synchronizer.update(normal)
  synchronizer.update({
    ...normal,
    players: {
      ...normal.players,
      [PLAYER_ID]: {
        ...normal.players[PLAYER_ID],
        primaryCast: {
          ...normal.players[PLAYER_ID].primaryCast,
          underpowered: true,
        },
      },
    },
    tick: normal.tick + 1,
  })
  assert.deepEqual(audio.sounds, ['lightning-start'])
  assert.deepEqual(audio.starts, [
    ['lightning-loop', 'primary-player:caster'],
    ['lightning-loop', 'primary-player:caster'],
  ])
  assert.deepEqual(audio.startOptions, [{ volume: 1 }, { volume: 0.75 }])
})

test('updates weak Water loop to half gain without another ice-start edge', () => {
  let state = simulation('water')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  const normal = createGameSnapshot(state, PLAYER_ID)
  synchronizer.update(normal)
  synchronizer.update({
    ...normal,
    players: {
      ...normal.players,
      [PLAYER_ID]: {
        ...normal.players[PLAYER_ID],
        primaryCast: {
          ...normal.players[PLAYER_ID].primaryCast,
          underpowered: true,
        },
      },
    },
    tick: normal.tick + 1,
  })
  assert.deepEqual(audio.sounds, ['ice-start'])
  assert.deepEqual(audio.startOptions, [{ volume: 1 }, { volume: 0.5 }])
})

test('plays Earth periodic weak fizzle at pitch and point gain one half', () => {
  let state = simulation('earth')
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    createGameSnapshot(state, PLAYER_ID),
  )
  state = step(state, true)
  const held = createGameSnapshot(state, PLAYER_ID)
  synchronizer.update(held)
  synchronizer.update({
    ...held,
    players: {
      ...held.players,
      [PLAYER_ID]: {
        ...held.players[PLAYER_ID],
        primaryCast: {
          ...held.players[PLAYER_ID].primaryCast,
          fizzleSequence: 1,
          underpowered: true,
        },
      },
    },
    tick: held.tick + 1,
  })
  assert.deepEqual(audio.sounds, ['start-boulder', 'fizzle'])
  assert.deepEqual(audio.soundOptions[1], { playbackRate: 0.5, volume: 0.5 })
})

test('plays each semantic Fire impact once without replaying an initial snapshot', () => {
  const initial = simulation('fire')
  const player = getPlayerCharacter(initial, PLAYER_ID)
  const impact = {
    ageTicks: 4,
    id: 1,
    kind: 'fire-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 0 },
    origin: { x: player.position.x, y: player.position.y - 50 },
    ownerId: PLAYER_ID,
    visualScale: 1,
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

test('plays each semantic Ether impact once with its native pitch interval', () => {
  const initial = simulation('ether')
  const player = getPlayerCharacter(initial, PLAYER_ID)
  const impact = {
    ageTicks: 0,
    birthTick: 40,
    id: 1,
    kind: 'ether-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 0 },
    origin: { x: player.position.x, y: player.position.y - 50 },
    ownerId: PLAYER_ID,
    visualScale: 1,
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
  assert.deepEqual(audio.sounds, ['magic-missile-hit'])
  assert.equal(audio.soundOptions[0].playbackRate! >= 1, true)
  assert.equal(audio.soundOptions[0].playbackRate! < 1.1, true)
  assert.equal(audio.soundOptions[0].volume! > 0, true)
})

test('plays each retained Staff contact once in native swoosh, world-impact, then proc order', () => {
  const initial = simulation('air')
  const player = getPlayerCharacter(initial, PLAYER_ID)
  const contact = {
    ageTicks: 0,
    id: 1,
    impactSoundPitches: [0.95],
    kind: 'player-staff-contact',
    origin: { x: player.position.x, y: player.position.y - 20 },
    outcome: 'whirl',
    ownerId: PLAYER_ID,
    procSound: 'spin-attack',
    procSoundPitches: [1, Math.fround(0.9), Math.fround(1.1)],
    pikeBreakSoundIndexes: [0],
    swooshPitch: 1.1,
    targetIds: ['enemy:1'],
    worldKey: 'hub:courtyard',
  } as const
  const initialSnapshot = createGameSnapshot(initial, PLAYER_ID)
  const contacted = createGameSnapshot({
    ...initial,
    primarySpells: { nextId: 2, projectiles: [], transients: [contact] },
  }, PLAYER_ID)
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initialSnapshot,
  )
  synchronizer.update(contacted)
  synchronizer.update(contacted)
  assert.deepEqual(audio.sounds, [
    'staff-swoosh',
    'staff-hit-wood',
    'spin-attack',
    'spin-attack',
    'spin-attack',
  ])
  assert.deepEqual(
    audio.soundOptions.map(({ playbackRate }) => playbackRate),
    [1.1, 0.95, 1, Math.fround(0.9), Math.fround(1.1)],
  )
  assert.ok(audio.soundOptions.every(({ volume }) => (volume ?? 0) > 0))
  assert.deepEqual(audio.streams, ['pike-break'])
  assert.deepEqual(audio.streamOptions, [{ playbackRate: 1, volume: 1 }])

  const reconnectAudio = new RecordingAudio()
  const reconnect = new PrimarySpellAudioSynchronizer(
    reconnectAudio as unknown as GameAudioDirector,
    PLAYER_ID,
    contacted,
  )
  reconnect.update(contacted)
  assert.deepEqual(reconnectAudio.sounds, [])
  assert.deepEqual(reconnectAudio.streams, [])
})

test('plays Mindblast birth once in magic-shield then two-pitch big-fire order', () => {
  const state = simulation('ether')
  const initial = createGameSnapshot(state, PLAYER_ID)
  const burst = {
    ...secondaryActor('mindblast-burst', 17, PLAYER_ID, initial),
    ageTicks: 0,
    lifetimeTicks: 230,
    presentationRng: state.secondaryAbilities.rng,
    rank: 4,
    scale: 9,
    skillId: null,
  }
  const snapshot = createGameSnapshot({
    ...state,
    secondaryAbilities: {
      ...state.secondaryAbilities,
      actors: [burst],
      nextActorId: 18,
    },
  }, PLAYER_ID)
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initial,
  )
  synchronizer.update(snapshot)
  synchronizer.update(snapshot)
  assert.deepEqual(audio.sounds, [
    'magic-shield-explode',
    'big-fire',
    'big-fire',
  ])
  assert.deepEqual(audio.soundOptions.map(({ playbackRate }) => playbackRate), [1, 1, 0.8])
  assert.ok(audio.soundOptions.every(({ volume }) => volume === 1))

  const hydratedAudio = new RecordingAudio()
  const hydrated = new PrimarySpellAudioSynchronizer(
    hydratedAudio as unknown as GameAudioDirector,
    PLAYER_ID,
    snapshot,
  )
  hydrated.update(snapshot)
  assert.deepEqual(hydratedAudio.sounds, [])
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

test('Magic Trap ElectricBurn starts only after its first native update and stops on retirement', () => {
  const state = simulation('air')
  const initial = createGameSnapshot(state, PLAYER_ID)
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initial,
  )
  const actor: NativeSecondaryActorState = {
    ageTicks: 0,
    alpha: 0,
    damage: 1,
    enhanced: false,
    endpoint: { x: 0, y: 0 },
    frame: 0,
    freezeTicks: 0,
    golem: null,
    hitTargetIds: [],
    id: 1,
    kind: 'electric-burn',
    lifetimeTicks: 100,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    midpoint: { x: 0, y: 0 },
    miscLightAppendOrdinal: 0,
    ownerId: PLAYER_ID,
    phase: 0,
    position: initial.players[PLAYER_ID].position,
    presentationRng: null,
    quantity: 0,
    radius: 1,
    rank: 1,
    rotationRadians: 0,
    scale: 1,
    skillId: 50,
    slowFactor: 0,
    targetId: 33,
    variant: 2,
    velocity: { x: 0, y: 0 },
    worldKey: 'hub:courtyard',
  }
  const born = {
    ...initial,
    secondaryAbilities: {
      ...initial.secondaryAbilities,
      actors: [actor],
    },
    tick: initial.tick + 1,
  }
  synchronizer.update(born)
  assert.deepEqual(audio.starts, [])

  const live = {
    ...born,
    secondaryAbilities: {
      ...born.secondaryAbilities,
      actors: [{ ...actor, ageTicks: 1, alpha: 0.5 }],
    },
    tick: born.tick + 1,
  }
  synchronizer.update(live)
  assert.deepEqual(audio.starts, [[
    'electric-loop',
    'secondary-player:caster',
  ]])

  synchronizer.update({
    ...live,
    secondaryAbilities: { ...live.secondaryAbilities, actors: [] },
    tick: live.tick + 1,
  })
  assert.deepEqual(audio.stops, [[
    'electric-loop',
    'secondary-player:caster',
  ]])
  synchronizer.destroy()
})

test('secondary one-shots and streams consume new authoritative events once with pitch and attenuation', () => {
  const state = simulation('air')
  const initial = createGameSnapshot(state, PLAYER_ID)
  const previous = {
    ...initial,
    secondaryAbilities: { ...initial.secondaryAbilities, nextEventId: 20 },
  }
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    previous,
  )
  const event = (
    eventId: number,
    cue: NativeSecondaryAudioCue,
    pitch: number,
    worldKey = 'hub:courtyard',
  ): NativeSecondaryEventState => ({
    actorId: null,
    cameraDisplacement: null,
    cameraMagnitude: 0,
    cue,
    eventId,
    kind: 'pulse',
    ownerId: PLAYER_ID,
    pitch,
    position: initial.players[PLAYER_ID].position,
    screenFlash: null,
    skillId: 48,
    tick: initial.tick + 1,
    worldKey,
  })
  const snapshot = {
    ...previous,
    secondaryAbilities: {
      ...previous.secondaryAbilities,
      events: [
        event(19, 'teleport', 0.5),
        event(20, 'teleport', 0.75),
        event(21, 'planewalker-on', 1.25),
        event(22, 'rainfall-loop', 1),
        event(23, 'magic-circle', 1, 'hub:library'),
        {
          ...event(24, 'flash-spell', 1.125),
          kind: 'impact',
          screenFlash: {
            alpha: 1,
            blue: 1,
            decayPerTick: 0.05,
            green: 1,
            pointAttenuated: true,
            red: 1,
          },
          skillId: 53,
        } satisfies NativeSecondaryEventState,
      ],
      nextEventId: 25,
    },
    tick: previous.tick + 1,
  }

  synchronizer.update(snapshot)
  synchronizer.update(snapshot)
  assert.deepEqual(audio.sounds, ['teleport', 'flash-spell'])
  assert.deepEqual(audio.soundOptions, [
    { playbackRate: 0.75, volume: 1 },
    { playbackRate: 1.125, volume: 1 },
  ])
  assert.deepEqual(audio.streams, ['planewalker-on'])
  assert.deepEqual(audio.streamOptions, [{ playbackRate: 1.25, volume: 1 }])
  synchronizer.destroy()
})

test('every persistent secondary audio owner starts and retires its exact native loop', () => {
  const state = simulation('air')
  const initial = createGameSnapshot(state, PLAYER_ID)
  const audio = new RecordingAudio()
  const synchronizer = new PrimarySpellAudioSynchronizer(
    audio as unknown as GameAudioDirector,
    PLAYER_ID,
    initial,
  )
  const kinds = [
    ['leviathan', 'leviathan'],
    ['ether-drain', 'drain'],
    ['moving-fire', 'moving-fire'],
    ['fire-patch', 'fire-patch'],
    ['storm-cloud', 'storm'],
    ['acid-rain', 'acid'],
    ['earthquake', 'earthquake'],
    ['comet', 'comet'],
    ['electric-burn', 'electric'],
  ] as const satisfies readonly (readonly [NativeSecondaryActorKind, string])[]
  const live = {
    ...initial,
    secondaryAbilities: {
      ...initial.secondaryAbilities,
      actors: kinds.map(([kind, ownerId], index) => (
        secondaryActor(kind, index + 1, ownerId, initial)
      )),
      players: {
        ...initial.secondaryAbilities.players,
        [PLAYER_ID]: {
          ...initial.secondaryAbilities.players[PLAYER_ID],
          planewalkerTicksRemaining: 1,
        },
      },
    },
    tick: initial.tick + 1,
  }
  synchronizer.update(live)

  const expected = [
    'comet-loop:secondary-player:comet',
    'earthquake-loop:secondary-player:earthquake',
    'electric-loop:secondary-player:electric',
    'low-fire-loop:secondary-player:fire-patch',
    'low-fire-loop:secondary-player:moving-fire',
    'plane-cross-loop:secondary-player:caster',
    'plane-cross-loop:secondary-player:drain',
    'plane-cross-loop:secondary-player:leviathan',
    'rainfall-loop:secondary-player:acid',
    'rainfall-loop:secondary-player:storm',
    'steady-wind-loop:secondary-player:drain',
    'steady-wind-loop:secondary-player:storm',
  ].sort()
  assert.deepEqual(
    audio.starts.map(([cue, owner]) => `${cue}:${owner}`).sort(),
    expected,
  )

  synchronizer.update({
    ...live,
    secondaryAbilities: {
      ...live.secondaryAbilities,
      actors: [],
      players: {
        ...live.secondaryAbilities.players,
        [PLAYER_ID]: {
          ...live.secondaryAbilities.players[PLAYER_ID],
          planewalkerTicksRemaining: 0,
        },
      },
    },
    tick: live.tick + 1,
  })
  assert.deepEqual(
    audio.stops.map(([cue, owner]) => `${cue}:${owner}`).sort(),
    expected,
  )
  synchronizer.destroy()
})

type Snapshot = ReturnType<typeof createGameSnapshot>

function weldedSnapshot(
  source: Snapshot,
  buildId: NativeWeldBuildId,
  primaryCast: Partial<{
    castSequence: number
    channelActive: boolean
    emissionSequence: number
    lastWeldPlaybackRate: number | null
    lastWeldSoundVariant: number | null
  }> = {},
): Snapshot {
  const player = source.players[PLAYER_ID]!
  return {
    ...source,
    players: {
      ...source.players,
      [PLAYER_ID]: {
        ...player,
        primaryCast: { ...player.primaryCast, ...primaryCast },
        progression: {
          ...player.progression,
          activeWeldBuildId: buildId,
        },
      },
    },
  }
}
