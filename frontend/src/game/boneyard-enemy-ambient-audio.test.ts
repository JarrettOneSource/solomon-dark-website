import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeEnemyIdleAnimationSample } from './renderer/native-enemy-animation.ts'
import {
  BoneyardEnemyAmbientAudioSynchronizer,
  nativeBoneyardEnemyAmbientRequests,
  type BoneyardEnemyAmbientSnapshot,
} from './boneyard-enemy-ambient-audio.ts'
import type { GameLoopCue } from './game-audio-native.ts'

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
  enemyToken: 'COFFIN' | 'WRAITH' | 'ZOMBIE',
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
  ]), ({ x }) => x / 100)

  assert.deepEqual(requests, [
    { cue: 'flyblown-loop', gain: 0.8 },
    { cue: 'maggots-loop', gain: 0 },
    { cue: 'soul-loop', gain: 0.9 },
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
  ]), ({ x }) => x / 100)

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

  synchronizer.update(active, ({ x }) => x / 100)
  synchronizer.update(active, ({ x }) => x / 100)
  assert.deepEqual(synchronizer.activeRequests(), [
    { cue: 'flyblown-loop', gain: 0.75 },
    { cue: 'soul-loop', gain: 0.5 },
  ])
  assert.deepEqual(new Set(audio.starts.map(({ owner }) => owner)), new Set([
    'boneyard-enemy-ambient:flyblown-loop',
    'boneyard-enemy-ambient:soul-loop',
  ]))

  synchronizer.update(snapshot([]), () => 1)
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
  ], [{ ownerCoffinActorId: 3, state: 'crawl' }]), () => 1)

  synchronizer.destroy()
  assert.deepEqual(audio.stops.map(({ cue }) => cue), [
    'flyblown-loop',
    'maggots-loop',
    'soul-loop',
  ])
})
