import assert from 'node:assert/strict'
import test from 'node:test'

import { gameSaveModMismatch } from './game-save-mods.ts'

const identity = (id: string, version: string, hash: string) => ({
  contentSha256: hash.repeat(64),
  id,
  version,
})

test('save mod comparison distinguishes added, removed, and changed identities', () => {
  const unchanged = identity('tests.same', '1.0.0', 'a')
  const removed = identity('tests.removed', '1.0.0', 'b')
  const changed = identity('tests.changed', '1.0.0', 'c')
  const activeChanged = identity('TESTS.CHANGED', '2.0.0', 'd')
  const added = identity('tests.added', '1.0.0', 'e')
  const mismatch = gameSaveModMismatch(
    [unchanged, removed, changed],
    [unchanged, activeChanged, added],
  )
  assert.deepEqual(mismatch, {
    added: [added],
    changed: [{ active: activeChanged, saved: changed }],
    removed: [removed],
  })
})

test('save mod comparison accepts reordered exact identities', () => {
  const first = identity('tests.first', '1.0.0', 'a')
  const second = identity('tests.second', '2.0.0', 'b')
  assert.equal(gameSaveModMismatch([first, second], [second, first]), null)
})
