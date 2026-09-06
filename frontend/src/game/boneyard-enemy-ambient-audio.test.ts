import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeDarkFireballs, createNativeRainOfBones } from './core-kernels/native-faculty-spells.ts'
import { createNativeGuidedMissile } from './core-kernels/native-guided-missile.ts'
import { createNativeRng } from './core-kernels/native-rng.ts'

import {
  BoneyardEnemyAmbientAudioSynchronizer,
  nativeBoneyardEnemyAmbientRequests,
  type BoneyardEnemyAmbientSnapshot,
} from './boneyard-enemy-ambient-audio.ts'
import type { GameLoopCue } from './game-audio-native.ts'
import { nativeEnemyIdleAnimationSample } from './renderer/native-enemy-animation.ts'

interface LoopCall {
  cue: GameLoopCue
  owner: string
  volume?: number
}

class RecordingAudio {
  readonly starts: LoopCall[] = []
  readonly stops: LoopCall[] = []

  startLoop(cue: GameLoopCue, owner: string, options: { volume?: number } = {}): void {
    this.starts.push({ cue, owner, volume: options.volume })
  }

  stopLoop(cue: GameLoopCue, owner: string): void {
    this.stops.push({ cue, owner })
  }
}

function enemy(
  id: number,
  enemyToken: 'DEMONSKULL' | 'COFFIN' | 'WRAITH' | 'ZOMBIE' | 'DIREFACULTY',
  x: number,
  options: Readonly<{ death?: boolean; rotten?: boolean }> = {},
) {
  return {
    animation: nativeEnemyIdleAnimationSample({
      state: options.death ? 'death' : 'idle',
    }),
    enemyToken,
    flags: options.rotten ? ['FLAG_ROTTEN'] : [],
    id,
    position: { x, y: 0 },
  } as const
}

function snapshot(
  enemies: BoneyardEnemyAmbientSnapshot['world']['enemies'],
  maggots: BoneyardEnemyAmbientSnapshot['world']['maggots'] = [],
): BoneyardEnemyAmbientSnapshot {
  return { world: { enemies, maggots } }
}

test('enemy ambient requests take the native maximum across live producers', () => {
  const requests = nativeBoneyardEnemyAmbientRequests(snapshot([
    enemy(1, 'ZOMBIE', 20, { rotten: true }),
    enemy(2, 'ZOMBIE', 80, { rotten: true }),
    enemy(3, 'ZOMBIE', 100),
    enemy(4, 'ZOMBIE', 100, { death: true, rotten: true }),
    enemy(5, 'WRAITH', 60),
    enemy(6, 'WRAITH', 90),
  ]), { point: ({ x }) => x / 100, hit: ({ x }) => x / 200 })

  assert.deepEqual(requests, [
    { cue: 'earthquake-loop', gain: 0 },
    { cue: 'rolling-stone-loop', gain: 0 },
    { cue: 'flyblown-loop', gain: 0.8 },
    { cue: 'maggots-loop', gain: 0 },
    { cue: 'soul-loop', gain: 0.9 },
    { cue: 'steady-wind-loop', gain: 0 },
    { cue: 'ice-beam-loop', gain: 0 },
    { cue: 'electric-loop', gain: 0 },
    { cue: 'eerie-loop', gain: 0 },
    { cue: 'low-fire-loop', gain: 0 },
  ])
})

test('Coffin Maggots loop uses live owned count divided by 200 and half gain', () => {
  const requests = nativeBoneyardEnemyAmbientRequests(snapshot([
    enemy(10, 'COFFIN', 80),
    enemy(11, 'COFFIN', 50),
  ], [
    { ownerCoffinActorId: 10, state: 'crawl' },
    { ownerCoffinActorId: 10, state: 'bite' },
    { ownerCoffinActorId: 10, state: 'emerging' },
    { ownerCoffinActorId: 10, state: 'death' },
    { ownerCoffinActorId: 11, state: 'crawl' },
  ]), { point: ({ x }) => x / 100, hit: ({ x }) => x / 200 })

  assert.equal(
    requests.find(({ cue }) => cue === 'maggots-loop')?.gain,
    0.8 * (3 / 200) * 0.5,
  )
})

test('ambient synchronizer keeps one stable owner and balances every stop edge', () => {
  const audio = new RecordingAudio()
  const synchronizer = new BoneyardEnemyAmbientAudioSynchronizer(audio)
  const active = snapshot([
    enemy(1, 'ZOMBIE', 75, { rotten: true }),
    enemy(2, 'WRAITH', 50),
  ])

  synchronizer.update(active, { point: ({ x }) => x / 100, hit: ({ x }) => x / 200 })
  synchronizer.update(active, { point: ({ x }) => x / 100, hit: ({ x }) => x / 200 })
  assert.deepEqual(synchronizer.activeRequests(), [
    { cue: 'flyblown-loop', gain: 0.75 },
    { cue: 'soul-loop', gain: 0.5 },
  ])
  assert.deepEqual(new Set(audio.starts.map(({ owner }) => owner)), new Set([
    'boneyard-enemy-ambient:flyblown-loop',
    'boneyard-enemy-ambient:soul-loop',
  ]))

  synchronizer.update(snapshot([]), { point: () => 1, hit: () => 1 })
  assert.deepEqual(audio.stops, [
    { cue: 'flyblown-loop', owner: 'boneyard-enemy-ambient:flyblown-loop' },
    { cue: 'soul-loop', owner: 'boneyard-enemy-ambient:soul-loop' },
  ])
  synchronizer.destroy()
  assert.equal(audio.stops.length, 2)
})

test('destroy stops every still-active native enemy ambient loop', () => {
  const audio = new RecordingAudio()
  const synchronizer = new BoneyardEnemyAmbientAudioSynchronizer(audio)
  synchronizer.update(snapshot([
    enemy(1, 'ZOMBIE', 1, { rotten: true }),
    enemy(2, 'WRAITH', 1),
    enemy(3, 'COFFIN', 1),
  ], [{ ownerCoffinActorId: 3, state: 'crawl' }]), { point: () => 1, hit: () => 1 })

  synchronizer.destroy()
  assert.deepEqual(audio.stops.map(({ cue }) => cue), [
    'flyblown-loop',
    'maggots-loop',
    'soul-loop',
  ])
})

test('Faculty loops retain squared gain, hand and lightning admission, and the detached rain cloud', () => {
  const faculty = { ...enemy(1, 'DIREFACULTY', 80), faculty: {
    bodyColor: [1, 1, 1, 1] as const, bodyHeadingDeg: 0, female: false, handMask: 1,
    headColor: [1, 1, 1, 1] as const, lightningActive: true, lightIntensity: 1, lightPhase: 0,
  } }
  const rain = { ...createNativeRainOfBones({ x: 60, y: 0 }, createNativeRng(1)).state,
    alpha: .4, ageTicks: 8, damage: 1, id: 1, kind: 'rain-of-bones' as const,
    painterRegistration: { managerLane: 'actor' as const, registrationOrdinal: 0 }, ownerActorId: 1, spawnTick: 0 }
  const requests = nativeBoneyardEnemyAmbientRequests({ world: { enemies: [faculty], maggots: [], bossSpells: [rain] } }, { point: ({ x }) => x / 100, hit: ({ x }) => x / 200 })
  const gain = (cue: GameLoopCue) => requests.find(request => request.cue === cue)?.gain
  assert.equal(gain('soul-loop'), .4 ** 2)
  assert.equal(gain('steady-wind-loop'), .4 ** 2)
  assert.equal(gain('ice-beam-loop'), .4)
  assert.equal(gain('electric-loop'), .8)
  assert.equal(gain('eerie-loop'), .3 * .4 * .5)
  const after = nativeBoneyardEnemyAmbientRequests({ world: { enemies: [], maggots: [], bossSpells: [rain] } }, { point: () => 1, hit: () => 1 })
  assert.equal(after.find(({ cue }) => cue === 'eerie-loop')!.gain, .2)
  assert.equal(after.find(({ cue }) => cue === 'soul-loop')!.gain, 0)
})

test('Skull and Dark projectiles keep the shared Eerie and LowFire loops after the Faculty dies', () => {
  const owner = { ageTicks: 0, damage: 1, id: 1,
    painterRegistration: { managerLane: 'actor' as const, registrationOrdinal: 0 }, ownerActorId: 1, spawnTick: 0 }
  const skull = { ...owner, ...createNativeGuidedMissile(createNativeRng(1), { x: 80, y: 0 }, 0, 1.5).state,
    kind: 'skull-missile' as const, targetPlayerId: null }
  const fire = { ...owner, ...createNativeDarkFireballs({ x: 60, y: 55 }, 0, false, null, createNativeRng(2)).spells[0]!,
    id: 2, groundFireDamage: 1, kind: 'dark-fireball' as const }
  for (const [bossSpells, eerie, lowFire] of [[[skull], .4, 0], [[fire], .6, .6], [[skull, fire], .6, .6], [[], 0, 0]] as const) {
    const requests = nativeBoneyardEnemyAmbientRequests({ world: { enemies: [], maggots: [], bossSpells } }, { point: ({ x }) => x / 100, hit: ({ x }) => x / 200 })
    assert.equal(requests.find(({ cue }) => cue === 'eerie-loop')!.gain, eerie)
    assert.equal(requests.find(({ cue }) => cue === 'low-fire-loop')!.gain, lowFire)
  }
})

test('Discorporeal death and its detached UltraBanish share and release the native loop maxima', () => {
  const spell = { kind: 'ultra-banish' as const, ownerActorId: 1, id: 1, ageTicks: 100, spawnTick: 0, damage: 0,
    painterRegistration: { managerLane: 'transient' as const, registrationOrdinal: 1 }, position: { x: 0, y: 0 },
    alpha: .8, flashAlpha: 0, lightRadius: 1, megaDeath: false, remainingTicks: 50 }
  const pointGains = { point: () => .1, hit: () => .1 }
  const initial = snapshot([enemy(1, 'DEMONSKULL', 0, { death: true })])
  const combined = nativeBoneyardEnemyAmbientRequests({ world: { ...initial.world, bossSpells: [spell] } }, pointGains)
  assert.equal(combined.find(value => value.cue === 'earthquake-loop')?.gain, 1)
  for (const cue of ['rolling-stone-loop', 'soul-loop', 'steady-wind-loop', 'low-fire-loop', 'ice-beam-loop']) {
    assert.equal(combined.find(value => value.cue === cue)?.gain, .8)
  }
  const detached = nativeBoneyardEnemyAmbientRequests({ world: { enemies: [], maggots: [], bossSpells: [spell] } }, pointGains)
  assert.equal(detached.find(value => value.cue === 'earthquake-loop')?.gain, .8)
  assert.ok(nativeBoneyardEnemyAmbientRequests(snapshot([]), pointGains).every(value => value.gain === 0))
})
