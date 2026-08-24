import assert from 'node:assert/strict'
import test from 'node:test'

import { STOCK_TUTORIAL_BONEYARD } from './stock-tutorial-boneyard.ts'

test('locks the complete exact retail Tutorial geometry projection', () => {
  assert.equal(STOCK_TUTORIAL_BONEYARD.sourceSha256, '97802f2ca45d9bc6f90a497e7c12a55926298161e191fa70eee5e666b90106ed')
  assert.equal(STOCK_TUTORIAL_BONEYARD.geometrySha256, 'da995d7ed1ab8950380c048c1cd43db97314b065edfbbc78e950afe60ebb1a48')
  assert.equal(STOCK_TUTORIAL_BONEYARD.scene.name, 'Tutorial')
  assert.deepEqual(STOCK_TUTORIAL_BONEYARD.scene.bounds, { x: 0, y: 0, w: 2043, h: 2053 })
  assert.deepEqual(STOCK_TUTORIAL_BONEYARD.scene.spawn, {
    x: 1025,
    y: 2070.0703125,
    facingDeg: 0,
  })
  assert.equal(STOCK_TUTORIAL_BONEYARD.scene.objects.length, 92)
  assert.equal(STOCK_TUTORIAL_BONEYARD.scene.sprites.length, 90)
  assert.equal(STOCK_TUTORIAL_BONEYARD.scene.roads.length, 53)
  assert.equal(STOCK_TUTORIAL_BONEYARD.scene.fences.length, 28)
  assert.equal(STOCK_TUTORIAL_BONEYARD.scene.terrain.length, 4)
  assert.deepEqual(STOCK_TUTORIAL_BONEYARD.scene.solomonDig?.position, {
    x: 1021.53564453125,
    y: 1170.36669921875,
  })
})
