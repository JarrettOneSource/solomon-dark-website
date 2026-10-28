import assert from 'node:assert/strict'
import test from 'node:test'
import { startCreateLoadoutFinalization } from './create-loadout-finalization.ts'

const CONFIG = { displayName: 'KeepName', element: 'fire', discipline: 'water' } as const

function fixture(kind: 'manual' | 'randomize', start: () => Promise<boolean> = async () => true) {
  const frames = new Map<number, (time: number) => void>()
  const events: unknown[] = []
  let next = 0
  const cancel = startCreateLoadoutFinalization({
    config: CONFIG, kind, startedAtMs: 100,
    requestFrame: callback => { frames.set(++next, callback); return next },
    cancelFrame: handle => { frames.delete(handle) },
    onManualFinalize: () => events.push('catch-it'),
    onStart: async config => { events.push({ ...config }); return start() },
    onRelease: () => events.push('release'),
  })
  const tick = async (time: number) => {
    const callbacks = [...frames.values()]
    frames.clear()
    for (const callback of callbacks) callback(time)
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  return { cancel, events, frames, tick }
}

test('dice finalizes exactly once at 230ms without the manual catch cue', async () => {
  const f = fixture('randomize')
  await f.tick(329)
  assert.deepEqual(f.events, [])
  await f.tick(330)
  assert.deepEqual(f.events, [CONFIG])
  await f.tick(9000)
  assert.deepEqual(f.events, [CONFIG])
})

test('ordinary manual selection retains its 880ms catch cue and captured config', async () => {
  const f = fixture('manual')
  await f.tick(979)
  assert.deepEqual(f.events, [])
  await f.tick(980)
  assert.deepEqual(f.events, ['catch-it', CONFIG])
})

test('cancellation before completion prevents submission and clears the owned frame', async () => {
  const f = fixture('randomize')
  f.cancel()
  assert.equal(f.frames.size, 0)
  await f.tick(9000)
  assert.deepEqual(f.events, [])
})

test('false or rejected submission releases pending state for a retained-loadout retry', async () => {
  for (const submit of [async () => false, async () => { throw new Error('send failed') }]) {
    const f = fixture('randomize', submit)
    await f.tick(330)
    assert.deepEqual(f.events, [CONFIG, 'release'])
    assert.equal(f.frames.size, 0)
  }
})

test('late failure after unmount never writes state into the next Create instance', async () => {
  let reject!: (error: Error) => void
  const f = fixture('randomize', () => new Promise((_, fail) => { reject = fail }))
  await f.tick(330)
  f.cancel()
  reject(new Error('closed'))
  await f.tick(400)
  assert.deepEqual(f.events, [CONFIG])
})
