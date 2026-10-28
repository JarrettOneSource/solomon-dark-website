import assert from 'node:assert/strict'
import test from 'node:test'
import { PLAYER_CARD_FEEDBACK_MS, PlayerCardRequests } from './player-card-request.ts'
import type { GamePlayerCardProfile } from './protocol/game-chat.ts'

const PROFILE: GamePlayerCardProfile = {
  accountUsername: null, activity: 'boneyard', discipline: 'arcane', displayName: 'Synthetic Peer',
  element: 'fire', gold: 0, highestWave: 1, playerReference: 'peer', sessionKind: 'private-college', totalPlaytimeMs: 0,
}
const IDLE = { profile: null, pending: false, error: null }
function deferred() {
  let resolve!: (profile: GamePlayerCardProfile) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<GamePlayerCardProfile>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture() {
  const pending: ReturnType<typeof deferred>[] = [], references: string[] = []
  const requests = new PlayerCardRequests({ resolvePlayerCard(reference) {
    references.push(reference)
    const request = deferred(); pending.push(request); return request.promise
  } })
  return { requests, pending, references }
}

test('unavailable Player Card feedback expires after the bounded web UI lifetime', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { requests, pending } = fixture()
  const result = requests.open('gone')
  assert.deepEqual(requests.getSnapshot(), { ...IDLE, pending: true })
  pending[0]!.reject(new Error('That wizard is no longer available.')); await result
  assert.deepEqual(requests.getSnapshot(), { ...IDLE, error: 'That wizard is no longer available.' })
  context.mock.timers.tick(PLAYER_CARD_FEEDBACK_MS - 1)
  assert.notEqual(requests.getSnapshot().error, null)
  context.mock.timers.tick(1)
  assert.deepEqual(requests.getSnapshot(), IDLE)
})

test('dismissal immediately clears feedback and cancels its old expiry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { requests, pending } = fixture()
  const first = requests.open('gone'); pending[0]!.reject('unavailable'); await first
  assert.equal(requests.getSnapshot().error, 'That wizard is no longer available.')
  requests.dismiss(); assert.deepEqual(requests.getSnapshot(), IDLE)
  const second = requests.open('peer'); pending[1]!.resolve(PROFILE); await second
  context.mock.timers.tick(PLAYER_CARD_FEEDBACK_MS)
  assert.equal(requests.getSnapshot().profile, PROFILE)
})

for (const stale of ['success', 'failure'] as const) {
  test(`latest request wins when old ${stale} completes while the new request is pending`, async () => {
    const { requests, pending, references } = fixture()
    const first = requests.open('old'), second = requests.open('new')
    assert.deepEqual(references, ['old', 'new'])
    if (stale === 'success') pending[0]!.resolve({ ...PROFILE, displayName: 'Old' })
    else pending[0]!.reject(new Error('Old error'))
    await first
    assert.deepEqual(requests.getSnapshot(), { ...IDLE, pending: true })
    pending[1]!.resolve(PROFILE); await second
    assert.deepEqual(requests.getSnapshot(), { ...IDLE, profile: PROFILE })
  })
  test(`old ${stale} cannot replace an already resolved newer request`, async () => {
    const { requests, pending } = fixture()
    const first = requests.open('old'), second = requests.open('new')
    pending[1]!.resolve(PROFILE); await second
    if (stale === 'success') pending[0]!.resolve({ ...PROFILE, displayName: 'Old' })
    else pending[0]!.reject(new Error('Old error'))
    await first
    assert.deepEqual(requests.getSnapshot(), { ...IDLE, profile: PROFILE })
  })
  test(`dismissed request ignores a late ${stale}`, async () => {
    const { requests, pending } = fixture()
    const result = requests.open('old'); requests.dismiss()
    if (stale === 'success') pending[0]!.resolve(PROFILE)
    else pending[0]!.reject(new Error('Old error'))
    await result; assert.deepEqual(requests.getSnapshot(), IDLE)
  })
}

test('new request cancels old feedback expiry without clearing the new pending state', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { requests, pending } = fixture()
  const first = requests.open('gone'); pending[0]!.reject(new Error('Gone')); await first
  const second = requests.open('new')
  context.mock.timers.tick(PLAYER_CARD_FEEDBACK_MS)
  assert.deepEqual(requests.getSnapshot(), { ...IDLE, pending: true })
  pending[1]!.resolve(PROFILE); await second
})

test('destroy rejection queued before session clear cannot repopulate either session', async () => {
  const old = fixture(), next = fixture()
  const pendingOld = old.requests.open('old')
  // GameClientSession.destroy synchronously rejects; UI clear runs before the microtask.
  old.pending[0]!.reject(new Error('Game session destroyed.'))
  old.requests.dismiss()
  const pendingNew = next.requests.open('new')
  await pendingOld
  assert.deepEqual(old.requests.getSnapshot(), IDLE)
  assert.deepEqual(next.requests.getSnapshot(), { ...IDLE, pending: true })
  next.pending[0]!.resolve(PROFILE); await pendingNew
  assert.equal(next.requests.getSnapshot().profile, PROFILE)
})

test('session reset and re-entry leave no stale notice or expiry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const old = fixture(), next = fixture()
  const failed = old.requests.open('gone'); old.pending[0]!.reject(new Error('Gone')); await failed
  old.requests.dismiss()
  const current = next.requests.open('peer'); next.pending[0]!.resolve(PROFILE); await current
  context.mock.timers.tick(PLAYER_CARD_FEEDBACK_MS)
  assert.deepEqual(old.requests.getSnapshot(), IDLE)
  assert.equal(next.requests.getSnapshot().profile, PROFILE)
})

test('no session is inert and subscriptions observe request changes only while attached', async () => {
  const absent = new PlayerCardRequests(null); await absent.open('peer')
  assert.deepEqual(absent.getSnapshot(), IDLE)
  const { requests, pending } = fixture()
  let notifications = 0
  const unsubscribe = requests.subscribe(() => { notifications += 1 })
  const result = requests.open('peer'); pending[0]!.resolve(PROFILE); await result
  assert.equal(notifications, 2)
  unsubscribe(); requests.dismiss(); assert.equal(notifications, 2)
})
