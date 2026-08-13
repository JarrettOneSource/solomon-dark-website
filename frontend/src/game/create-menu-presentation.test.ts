import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CREATE_HAND_CENTERS,
  CREATE_HAND_SIZE,
} from './renderer/create-menu-render-contract.ts'

const renderer = readFileSync(
  new URL('./renderer/create-menu-renderer.ts', import.meta.url),
  'utf8',
)

test('closed right hand keeps its recovered center and mirrored, unrotated registration', () => {
  assert.deepEqual(CREATE_HAND_CENTERS.right, { x: 1200, y: 560 })
  assert.deepEqual(CREATE_HAND_SIZE, { height: 703.5, width: 630 })
  assert.match(renderer, /handSprite\(texture\(createMenu\.handFist\), true\)/)
  assert.match(renderer, /\(flipped \? -1 : 1\)/)
  assert.doesNotMatch(renderer, /rightHand\.rotation/)
})
