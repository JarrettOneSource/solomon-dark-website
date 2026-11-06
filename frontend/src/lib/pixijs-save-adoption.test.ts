import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adoptPixiJsSave } from './pixijs-save-adoption.ts'

const save = (revision: number, document: string) => ({ slot: 0, revision, document })

test('a player continues the save they kept playing, PixiJS winning a tie', () => {
  assert.equal(adoptPixiJsSave(undefined, undefined), 'empty')
  assert.equal(adoptPixiJsSave(undefined, save(9, 'rust')), 'empty')
  assert.equal(adoptPixiJsSave(save(4, 'pixi'), undefined), 'adopted')
  assert.equal(adoptPixiJsSave(save(4, 'same'), save(9, 'same')), 'same')
  // Both copies count revisions from the parallel-launch fork.
  assert.equal(adoptPixiJsSave(save(30, 'kept playing PixiJS'), save(17, 'forked copy')), 'replaced')
  assert.equal(adoptPixiJsSave(save(17, 'forked copy'), save(40, 'kept playing Rust')), 'kept')
  assert.equal(adoptPixiJsSave(save(20, 'pixi'), save(20, 'rust')), 'replaced')
})
