import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameAudioDirector,
  type GameAudioPlayback,
  type GameAudioPlaybackOptions,
  type GameMusicChannel,
} from './game-audio-director.ts'
import type { GameAudioSources } from './game-audio-native.ts'
import { NATIVE_TUTORIAL_CUES } from './core-kernels/native-tutorial.ts'
import './game-audio-web-playback.test.ts'
import './player-footstep-audio.test.ts'
import './primary-spell-audio.test.ts'

const SOURCES = {
  loops: {
    'comet-loop': 'comet-loop.wav',
    'electric-loop': 'electric-loop.wav',
    'earthquake-loop': 'earthquake-loop.wav',
    'fire-loop': 'fire-loop.wav',
    'flyblown-loop': 'flyblown-loop.wav',
    'gather-rocks-loop': 'gather.wav',
    'ice-beam-loop': 'ice-beam-loop.wav',
    'ice-loop': 'ice-loop.wav',
    'lightning-loop': 'lightning-loop.wav',
    'low-fire-loop': 'low-fire-loop.wav',
    'maggots-loop': 'maggots-loop.wav',
    'meteor-loop': 'meteor-loop.wav',
    'plane-cross-loop': 'plane-cross-loop.wav',
    'polisher-wipe': 'polisher-wipe-loop.wav',
    'rainfall-loop': 'rainfall-loop.wav',
    'rolling-stone-loop': 'rolling.wav',
    'soul-loop': 'soul-loop.wav',
    'steady-wind-loop': 'steady-wind-loop.wav',
    'steam-loop': 'steam-loop.wav',
  },
  music: {
    academy: 'academy.mp3',
    combat: 'combat.mp3',
    death: 'death.mp3',
    prelude: 'prelude.mp3',
    selection: 'selection.mp3',
    solomondarktheme: 'theme.mp3',
  },
  sounds: {
    'backpack-close': 'backpack-close.wav',
    'bad-action': 'bad-action.wav',
    'acid-sizzle': 'acid-sizzle.wav',
    'banshee-die': 'banshee.wav',
    'bone-crack': 'bone-crack.wav',
    'big-fire': 'big-fire.wav',
    'bite-1': 'bite-1.wav',
    'bite-2': 'bite-2.wav',
    'bite-3': 'bite-3.wav',
    click: 'click.wav',
    concentrate: 'concentrate.wav',
    'coffin-break': 'coffin.wav',
    'critical-hit': 'critical-hit.wav',
    'comet-whistle': 'comet-whistle.wav',
    'demon-die': 'demon.wav',
    'disable-enemy': 'disable-enemy.wav',
    drink: 'drink.wav',
    'distort-reality': 'distort-reality.wav',
    'drop-bag-1': 'drop-bag-1.wav',
    'drop-bag-2': 'drop-bag-2.wav',
    'drop-coins': 'drop-coins.wav',
    'drop-potion': 'drop-potion.wav',
    'explode-steam': 'explode-steam.wav',
    'fireball-hit': 'fireball-hit.wav',
    'firey-death': 'firey.wav',
    'flame-lash-start': 'flame-lash-start.wav',
    flash: 'flash.wav',
    'flash-spell': 'flash-spell.wav',
    fizzle: 'fizzle.wav',
    'frost-missile': 'frost-missile.wav',
    'hit-shield': 'hit-shield.wav',
    'goto-orb': 'goto-orb.wav',
    'hail-bounce-0': 'hail-0.wav',
    'hail-bounce-1': 'hail-1.wav',
    'hail-bounce-2': 'hail-2.wav',
    'hail-bounce-3': 'hail-3.wav',
    'hail-shot': 'hail-shot.wav',
    'ice-start': 'ice.wav',
    'imp-split': 'imp-split.wav',
    'imp-vocal-1': 'imp-1.wav',
    'imp-vocal-2': 'imp-2.wav',
    'imp-vocal-3': 'imp-3.wav',
    'imp-vocal-4': 'imp-4.wav',
    'imp-vocal-5': 'imp-5.wav',
    'imp-vocal-6': 'imp-6.wav',
    'imp-vocal-7': 'imp-7.wav',
    'imp-vocal-8': 'imp-8.wav',
    ignite: 'ignite.wav',
    'knockback-golem': 'knockback-golem.wav',
    knockback: 'knockback.wav',
    'lightning-start': 'lightning.wav',
    'level-up': 'level-up.wav',
    'magic-missile': 'magic.wav',
    'magic-missile-hit': 'magic-hit.wav',
    'magic-circle': 'magic-circle.wav',
    'magic-shield-explode': 'magic-shield-explode.wav',
    'magic-shield-up': 'magic-shield-up.wav',
    'magic-storm': 'magic-storm.wav',
    'maggot-squeak-1': 'maggot-squeak-1.wav',
    'maggot-squeak-2': 'maggot-squeak-2.wav',
    'maggot-squish-1': 'maggot-squish-1.wav',
    'maggot-squish-2': 'maggot-squish-2.wav',
    'maggot-squish-3': 'maggot-squish-3.wav',
    'open-panel': 'openpanel.wav',
    'pick-skill': 'pick.wav',
    poof: 'poof.wav',
    nuke: 'nuke.wav',
    phase: 'phase.wav',
    'pop-shield': 'pop-shield.wav',
    'pickup-bag': 'pickup-bag.wav',
    'pickup-coin': 'pickup-coin.wav',
    'rock-hit': 'rock.wav',
    'shovel-1': 'shovel-1.wav',
    'shovel-2': 'shovel-2.wav',
    'ring-of-ice': 'ring-of-ice.wav',
    'skeleton-die': 'skeleton.wav',
    'shock-1': 'shock-1.wav',
    'shock-2': 'shock-2.wav',
    'shock-3': 'shock-3.wav',
    'spin-attack': 'spin-attack.wav',
    'staff-swoosh': 'staff-swoosh.wav',
    'staff-hit-wood': 'staff-hit-wood.wav',
    'start-boulder': 'boulder.wav',
    'stone-break': 'stone-break.wav',
    'stone-step': 'stone-step.wav',
    stoneskin: 'stoneskin.wav',
    'step-1': 'step1.wav',
    'step-2': 'step2.wav',
    summon: 'summon.wav',
    swipe: 'swipe.wav',
    teleport: 'teleport.wav',
    'throw-dirt-1': 'throw-dirt-1.wav',
    'throw-dirt-2': 'throw-dirt-2.wav',
    'throw-fire': 'fire.wav',
    'throw-lightning-1': 'throw-lightning-1.wav',
    'throw-lightning-2': 'throw-lightning-2.wav',
    unforge: 'unforge.wav',
    'unlock-skill': 'unlockskill.wav',
    'wizard-ouch-1': 'wizard-ouch-1.wav',
    'wizard-ouch-2': 'wizard-ouch-2.wav',
    'wizard-ouch-3': 'wizard-ouch-3.wav',
    'zombie-die': 'zombie-die.wav',
    'zombie-die-groan': 'zombie-groan.wav',
    'zombie-ouch': 'zombie-ouch.wav',
    'zombie-poison-splat': 'zombie-splat.wav',
  },
  streams: {
    ...(Object.fromEntries(NATIVE_TUTORIAL_CUES.map(cue => [cue, `${cue}.wav`])) as Record<
      typeof NATIVE_TUTORIAL_CUES[number],
      string
    >),
    'arch-intro-0': 'arch-intro-0.wav',
    'catch-it': 'catch.wav',
    'choose-element': 'choose.wav',
    'death-guitar': 'death-guitar.wav',
    dampen: 'dampen.wav',
    dye: 'dye.wav',
    'golem-die': 'golem-die.wav',
    'golem-provoke': 'golem-provoke.wav',
    'leviathan-roar': 'leviathan-roar.wav',
    mindstar: 'mindstar.wav',
    'planewalker-off': 'planewalker-off.wav',
    'planewalker-on': 'planewalker-on.wav',
    'pike-break': 'pike-break.wav',
    'prismatic-shock': 'prismatic-shock.wav',
    'quake-crack-small': 'quake-crack-small.wav',
    'quake-cracks': 'quake-cracks.wav',
    'set-trap': 'set-trap.wav',
    'solomon-get-him-boys': 'get-him-boys.wav',
    'solomon-hello-1': 'hello-1.wav',
    'solomon-hello-2': 'hello-2.wav',
    'solomon-hello-3': 'hello-3.wav',
    'solomon-hello-4': 'hello-4.wav',
    'solomon-laugh-1': 'laugh-1.wav',
    'solomon-laugh-big': 'laugh-big.wav',
    'start-cast': 'start.wav',
    'stoneskin-on': 'stoneskin-on.wav',
    thunder: 'thunder.wav',
    trap: 'trap.wav',
  },
} as const satisfies GameAudioSources

class FakeAudio {
  currentTime = 0
  loop = false
  muted = false
  pauseCalls = 0
  paused = true
  playCalls = 0
  preload = ''
  rejectNextPlay = false
  src: string
  volume = 1

  constructor(source: string) {
    this.src = source
  }

  pause(): void {
    this.pauseCalls += 1
    this.paused = true
  }

  play(): Promise<void> {
    this.playCalls += 1
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false
      this.paused = true
      return Promise.reject(new Error('autoplay blocked'))
    }
    this.paused = false
    return Promise.resolve()
  }
}

interface PlaybackCall {
  key?: string
  options: GameAudioPlaybackOptions
  source: string
}

class FakePlayback implements GameAudioPlayback {
  destroyCalls = 0
  readonly masterVolumeUpdates: number[] = []
  readonly plays: PlaybackCall[] = []
  readonly restarts: PlaybackCall[] = []
  readonly volumeUpdates: Array<[string, number]> = []
  readonly stops: string[] = []
  unlockCalls = 0

  destroy(): void {
    this.destroyCalls += 1
  }

  play(source: string, options: GameAudioPlaybackOptions): void {
    this.plays.push({ options, source })
  }

  restart(
    key: string,
    source: string,
    options: GameAudioPlaybackOptions,
  ): void {
    this.restarts.push({ key, options, source })
  }

  setMasterVolume(volume: number): void {
    this.masterVolumeUpdates.push(volume)
  }

  setVolume(key: string, volume: number): void {
    this.volumeUpdates.push([key, volume])
  }

  stop(key: string): void {
    this.stops.push(key)
  }

  unlock(): void {
    this.unlockCalls += 1
  }
}

class FakeFrames {
  currentTime = 0
  private callbacks = new Map<number, FrameRequestCallback>()
  private nextHandle = 1

  now = () => this.currentTime

  request = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle
    this.nextHandle += 1
    this.callbacks.set(handle, callback)
    return handle
  }

  cancel = (handle: number): void => {
    this.callbacks.delete(handle)
  }

  runAt(time: number): void {
    this.currentTime = time
    const callbacks = [...this.callbacks.values()]
    this.callbacks.clear()
    for (const callback of callbacks) callback(time)
  }
}

function fixture(options: {
  rejectSources?: ReadonlySet<string>
} = {}) {
  const created: FakeAudio[] = []
  const frames = new FakeFrames()
  const playback = new FakePlayback()
  const director = new GameAudioDirector(SOURCES, {
    cancelFrame: frames.cancel,
    createMusicChannel: (source) => {
      const audio = new FakeAudio(source)
      audio.rejectNextPlay = options.rejectSources?.has(source) ?? false
      created.push(audio)
      return audio as unknown as GameMusicChannel
    },
    now: frames.now,
    playback,
    requestFrame: frames.request,
  })
  return { created, director, frames, playback }
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test('crossfades the recovered scene tracks at their native tick durations', async () => {
  const { created, director, frames } = fixture()
  director.setScene('title')
  await flushPromises()

  const title = created[0]
  assert.equal(title.src, 'theme.mp3')
  assert.equal(title.loop, true)
  frames.runAt(500)
  assert.equal(title.volume, 0.5)
  frames.runAt(1_000)
  assert.equal(title.volume, 1)

  director.setScene('create')
  await flushPromises()
  const selection = created[1]
  assert.equal(selection.src, 'selection.mp3')
  frames.runAt(1_500)
  assert.equal(selection.volume, 0.5)
  assert.equal(title.volume, 0.5)
  frames.runAt(2_000)
  assert.equal(selection.volume, 1)
  assert.equal(title.paused, true)

  director.setScene('hub')
  await flushPromises()
  const academy = created[2]
  frames.runAt(2_010)
  assert.equal(academy.volume, 0.5)
  frames.runAt(2_020)
  assert.equal(academy.volume, 1)
  assert.equal(selection.paused, true)

  director.setScene('boneyard')
  await flushPromises()
  const prelude = created[3]
  assert.equal(prelude.src, 'prelude.mp3')
  frames.runAt(2_520)
  assert.equal(prelude.volume, 0.5)
  assert.equal(academy.volume, 0.5)
  frames.runAt(3_020)
  assert.equal(prelude.volume, 1)
  assert.equal(academy.paused, true)

  director.setScene('boneyard-combat')
  await flushPromises()
  const combat = created[4]
  assert.equal(combat.src, 'combat.mp3')
  frames.runAt(3_520)
  assert.equal(combat.volume, 0.5)
  frames.runAt(4_020)
  assert.equal(combat.volume, 1)

  director.setScene('game-over')
  await flushPromises()
  const death = created[5]
  assert.equal(death.src, 'death.mp3')
  frames.runAt(4_020)
  assert.equal(death.volume, 1)
})

test('applies independent live sound and music user gains over native envelopes', async () => {
  const { created, director, frames, playback } = fixture()
  director.setVolumes(0.35, 0.4)
  assert.deepEqual(playback.masterVolumeUpdates, [0.35])
  director.setScene('title')
  await flushPromises()
  frames.runAt(500)
  assert.equal(created[0].volume, 0.2)

  director.setVolumes(0.7, 0.25)
  assert.deepEqual(playback.masterVolumeUpdates, [0.35, 0.7])
  assert.equal(created[0].volume, 0.125)
  frames.runAt(1_000)
  assert.equal(created[0].volume, 0.25)

  director.setScene('create')
  await flushPromises()
  frames.runAt(1_500)
  assert.equal(created[0].volume, 0.125)
  assert.equal(created[1].volume, 0.125)
  director.setVolumes(0, 0)
  assert.equal(created[0].volume, 0)
  assert.equal(created[1].volume, 0)
})

test('temporarily mutes every non-music class without pausing music or losing the current user gain', async () => {
  const { created, director, frames, playback } = fixture()
  director.setVolumes(0.4, 0.6)
  director.setScene('title')
  await flushPromises()
  frames.runAt(1_000)
  const music = created[0]!
  assert.equal(music.volume, 0.6)
  assert.equal(music.paused, false)

  director.setSoundMuted(true)
  assert.deepEqual(playback.masterVolumeUpdates, [0.4, 0])
  assert.equal(music.volume, 0.6)
  assert.equal(music.paused, false)

  director.playSound('click')
  director.playStream('start-cast')
  director.startLoop('lightning-loop', 'muted-owner')
  assert.equal(playback.plays.length, 1)
  assert.equal(playback.restarts.length, 2)

  director.setVolumes(0.75, 0.25)
  assert.equal(playback.masterVolumeUpdates.at(-1), 0)
  assert.equal(music.volume, 0.25)
  director.setSoundMuted(false)
  assert.equal(playback.masterVolumeUpdates.at(-1), 0.75)
  assert.equal(music.paused, false)
})

test('holds a blocked scene at its beginning and retries on unlock', async () => {
  const { created, director, frames } = fixture({ rejectSources: new Set(['theme.mp3']) })
  director.setScene('title')
  await flushPromises()
  assert.equal(created[0].paused, true)
  assert.equal(created[0].currentTime, 0)

  director.unlock()
  await flushPromises()
  assert.equal(created[0].playCalls, 2)
  frames.runAt(1_000)
  assert.equal(created[0].volume, 1)
})

test('overlaps Sound instances and reuses restartable SoundStream channels', async () => {
  const { created, director, playback } = fixture()
  director.playSound('click', { playbackRate: 1.05, volume: 0.5 })
  director.playSound('click')
  assert.equal(created.length, 0)
  assert.deepEqual(playback.plays, [
    {
      options: { playbackRate: 1.05, volume: 0.5 },
      source: 'click.wav',
    },
    {
      options: { playbackRate: 1, volume: 1 },
      source: 'click.wav',
    },
  ])

  director.playStream('start-cast')
  director.playStream('start-cast')
  assert.deepEqual(playback.restarts.slice(0, 2), [
    {
      key: 'stream:start-cast',
      options: { playbackRate: 1, volume: 1 },
      source: 'start.wav',
    },
    {
      key: 'stream:start-cast',
      options: { playbackRate: 1, volume: 1 },
      source: 'start.wav',
    },
  ])
  director.playStream('tutorial-show-yourself', { offsetSeconds: 1.25 })
  assert.deepEqual(playback.restarts.at(-1), {
    key: 'stream:tutorial-show-yourself',
    options: { offsetSeconds: 1.25, playbackRate: 1, volume: 1 },
    source: 'tutorial-show-yourself.wav',
  })
  director.pauseStream('start-cast')
  director.stopStream('start-cast')
  assert.deepEqual(playback.stops, ['stream:start-cast', 'stream:start-cast'])

  director.playStream('solomon-hello-1')
  director.playStream('solomon-laugh-1')
  director.stopStreams(['solomon-hello-1', 'solomon-laugh-1'])
  assert.deepEqual(playback.stops.slice(-2), [
    'stream:solomon-hello-1',
    'stream:solomon-laugh-1',
  ])

  director.destroy()
  assert.equal(playback.destroyCalls, 1)
  assert.equal(created.length, 0)
  await flushPromises()
})

test('owns independent native loop channels and updates gain without restarting', async () => {
  const { created, director, playback } = fixture()
  director.startLoop('lightning-loop', 'player:a')
  director.startLoop('lightning-loop', 'player:a')
  director.startLoop('lightning-loop', 'player:b')
  assert.equal(created.length, 0)
  assert.deepEqual(playback.restarts, [
    {
      key: 'loop:lightning-loop:player:a',
      options: { loop: true, playbackRate: 1, volume: 1 },
      source: 'lightning-loop.wav',
    },
    {
      key: 'loop:lightning-loop:player:b',
      options: { loop: true, playbackRate: 1, volume: 1 },
      source: 'lightning-loop.wav',
    },
  ])

  director.startLoop('lightning-loop', 'player:a', { volume: 0.75 })
  assert.deepEqual(playback.volumeUpdates, [[
    'loop:lightning-loop:player:a',
    0.75,
  ]])
  assert.equal(playback.restarts.length, 2)

  director.stopLoop('lightning-loop', 'player:a')
  assert.deepEqual(playback.stops, ['loop:lightning-loop:player:a'])
  director.stopLoop('lightning-loop', 'player:b')
  assert.deepEqual(playback.stops, [
    'loop:lightning-loop:player:a',
    'loop:lightning-loop:player:b',
  ])
  await flushPromises()
})
