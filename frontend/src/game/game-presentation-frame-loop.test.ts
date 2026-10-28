import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_PRESENTATION_FPS_CAP,
  GamePresentationFrameGate,
  GamePresentationFrameScheduler,
} from './game-presentation-frame-loop.ts'

class FakeFrames {
  private callbacks = new Map<number, FrameRequestCallback>()
  private timeouts = new Map<number, { callback: () => void; delayMs: number }>()
  private currentTime = 0
  private nextHandle = 1

  request = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle
    this.nextHandle += 1
    this.callbacks.set(handle, callback)
    return handle
  }

  cancel = (handle: number): void => {
    this.callbacks.delete(handle)
  }

  requestTimeout = (callback: () => void, delayMs: number): number => {
    const handle = this.nextHandle
    this.nextHandle += 1
    this.timeouts.set(handle, { callback, delayMs })
    return handle
  }

  cancelTimeout = (handle: number): void => {
    this.timeouts.delete(handle)
  }

  now = (): number => this.currentTime

  get pendingCount(): number {
    return this.callbacks.size
  }

  get pendingTimeoutCount(): number {
    return this.timeouts.size
  }

  get nextTimeoutDelay(): number | null {
    return this.timeouts.values().next().value?.delayMs ?? null
  }

  runAt(browserNow: number, wallNow = browserNow): void {
    this.currentTime = wallNow
    const callbacks = [...this.callbacks.values()]
    this.callbacks.clear()
    for (const callback of callbacks) callback(browserNow)
  }

  runTimeoutsAt(wallNow: number): void {
    this.currentTime = wallNow
    const timeouts = [...this.timeouts.values()]
    this.timeouts.clear()
    for (const { callback } of timeouts) callback()
  }
}

test('the game presentation cap is 400 FPS', () => {
  assert.equal(GAME_PRESENTATION_FPS_CAP, 400)
})

test('the capped gate accepts the first frame and enforces the 2.5 ms boundary', () => {
  const gate = new GamePresentationFrameGate()
  assert.equal(gate.accept(100, false), true)
  assert.equal(gate.millisecondsUntilNext(100, false), 2.5)
  assert.equal(gate.accept(102.499, false), false)
  assert.equal(gate.accept(102.5, false), true)
})

test('the capped gate never catches up after a delayed frame', () => {
  const gate = new GamePresentationFrameGate()
  assert.equal(gate.accept(0, false), true)
  assert.equal(gate.accept(10, false), true)
  assert.equal(gate.accept(11, false), false)
  assert.equal(gate.accept(12.5, false), true)
  gate.reset()
  assert.equal(gate.accept(12.6, false), true)
})

test('uncapped frames all pass and restoring the cap starts from the latest frame', () => {
  const gate = new GamePresentationFrameGate()
  assert.equal(gate.accept(0, false), true)
  assert.equal(gate.accept(0.5, true), true)
  assert.equal(gate.accept(0.75, true), true)
  assert.equal(gate.accept(1, false), false)
  assert.equal(gate.accept(3.25, false), true)
})

test('the shared scheduler publishes only accepted frames and cancels when idle', () => {
  const frames = new FakeFrames()
  let uncapped = false
  const renderedAt: number[] = []
  const publishedAt: number[] = []
  const scheduler = new GamePresentationFrameScheduler({
    cancelFrame: frames.cancel,
    isUncapped: () => uncapped,
    now: frames.now,
    requestFrame: frames.request,
    timer: {
      cancel: frames.cancelTimeout,
      request: frames.requestTimeout,
    },
  })
  const unsubscribe = scheduler.subscribe((now) => publishedAt.push(now))
  const stop = scheduler.start((now) => renderedAt.push(now))

  assert.equal(frames.pendingCount, 1)
  frames.runAt(0)
  frames.runAt(0, 1)
  assert.equal(frames.pendingCount, 1)
  assert.equal(frames.pendingTimeoutCount, 0)
  frames.runAt(0, 10)
  frames.runAt(0, 11)
  assert.equal(frames.pendingCount, 1)
  assert.equal(frames.pendingTimeoutCount, 0)
  frames.runAt(0, 20)
  frames.runAt(0, 21)
  assert.equal(frames.pendingCount, 0)
  assert.equal(frames.pendingTimeoutCount, 1)
  assert.equal(frames.nextTimeoutDelay, 1.5)
  frames.runTimeoutsAt(22.5)
  uncapped = true
  scheduler.presentationPolicyChanged()
  assert.equal(frames.pendingTimeoutCount, 0)
  assert.equal(frames.pendingCount, 1)
  frames.runAt(0, 23)

  assert.deepEqual(renderedAt, [0, 10, 20, 22.5, 23])
  assert.deepEqual(publishedAt, renderedAt)
  assert.equal(scheduler.acceptedFrameCount, 5)
  assert.equal(scheduler.lastAcceptedFrameAt, 23)
  assert.equal(frames.pendingCount, 1)

  unsubscribe()
  stop()
  assert.equal(frames.pendingCount, 0)
})
