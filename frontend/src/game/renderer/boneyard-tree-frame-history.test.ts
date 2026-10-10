import assert from 'node:assert/strict'
import test from 'node:test'
import type { BoneyardSceneryActorPoses } from '../client/boneyard-presentation-timeline.ts'
import { BoneyardTreeFrameHistory, type BoneyardTreeFrameSource } from './boneyard-tree-frame-history.ts'

const poses = (tick: number): BoneyardSceneryActorPoses => ({
  players: [{ id: 'player', position: { x: tick, y: -100 } }],
  enemies: [], maggots: [], encounter: null,
})
const source = (tick: number, epoch = 'same'): BoneyardTreeFrameSource => ({
  tick, epoch, focusPlayerId: 'player',
  currentFrame: { actorPositions: [{ x: -1, y: -1 }], cameraBounds: { x: -2, y: -2, w: 4, h: 4 } },
  sampleActors: at => poses(at), sampleFocus: at => ({ x: at, y: at / 2 }),
  actorPositions: value => value.players.map(player => player.position),
  cameraBounds: focus => ({ x: focus.x - 50, y: focus.y - 50, w: 100, h: 100 }),
})

test('uses the integer-tick recorded pose and derives its own camera from the same tick', () => {
  const history = new BoneyardTreeFrameHistory()
  history.frame(source(100))
  const result = history.frame(source(105.75))
  assert.equal(result.history!.fromTick, 101)
  assert.deepEqual(result.current.actorPositions, [{ x: 105, y: -100 }])
  assert.deepEqual(result.current.cameraBounds, { x: 55, y: 2.5, w: 100, h: 100 })
  assert.deepEqual(result.history!.sample(103)!.actorPositions, [{ x: 103, y: -100 }])
})

test('bounds large unknown gaps by logarithmic retained-history lookup', () => {
  const history = new BoneyardTreeFrameHistory()
  history.frame(source(0))
  let reads = 0
  const value = source(1_000_000_000)
  value.sampleActors = at => { reads += 1; return at < 999_999_980 ? null : poses(at) }
  value.sampleFocus = at => at < 999_999_980 ? null : { x: at, y: 0 }
  const result = history.frame(value)
  assert.equal(result.history!.fromTick, 999_999_980)
  assert.ok(reads <= 32)
})

test('invalidates earlier camera history after focus, viewport, bounds or FOV epoch changes', () => {
  const history = new BoneyardTreeFrameHistory()
  history.frame(source(100))
  assert.equal(history.frame(source(150, 'resized')).history!.fromTick, 150)
  assert.equal(history.frame(source(155, 'resized')).history!.fromTick, 151)
  assert.equal(history.frame(source(160, 'spectator')).history!.fromTick, 160)
  assert.equal(history.frame(source(90, 'spectator')).history!.fromTick, 90)
})

test('retains the current observed frame if historical actor or focus inputs are missing', () => {
  for (const missing of ['sampleActors', 'sampleFocus', 'focusPlayerId'] as const) {
    const history = new BoneyardTreeFrameHistory()
    const value = source(100)
    if (missing === 'focusPlayerId') value.focusPlayerId = null
    else value[missing] = undefined
    assert.deepEqual(history.frame(value), { current: value.currentFrame })
  }
  const value = source(101)
  value.sampleActors = () => null
  assert.deepEqual(new BoneyardTreeFrameHistory().frame(value), { current: value.currentFrame })
})

test('memoizes pure samples without mutating delivered positions', () => {
  const history = new BoneyardTreeFrameHistory()
  history.frame(source(100))
  const original = poses(101)
  const before = structuredClone(original)
  let reads = 0
  const value = source(105)
  value.sampleActors = () => { reads += 1; return original }
  const result = history.frame(value)
  const first = result.history!.sample(103)
  const count = reads
  assert.equal(result.history!.sample(103), first)
  assert.equal(reads, count)
  assert.deepEqual(original, before)
})
