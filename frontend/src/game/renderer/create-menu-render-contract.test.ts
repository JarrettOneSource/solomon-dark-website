import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CREATE_DISCIPLINE_SIZE,
  CREATE_HAND_CENTERS,
  CREATE_HAND_SIZE,
  CREATE_STARS,
  createEntryFlashAlpha,
  createSelectionFlashAlpha,
} from './create-menu-render-contract.ts'

const createMenuRenderer = readFileSync(
  new URL('./create-menu-renderer.ts', import.meta.url),
  'utf8',
)
const createMenuScene = readFileSync(
  new URL('../CreateMenuScene.tsx', import.meta.url),
  'utf8',
)

test('Create hands retain the recovered native centers without rotation offsets', () => {
  assert.deepEqual(CREATE_HAND_CENTERS.left, { x: 400, y: 560 })
  assert.deepEqual(CREATE_HAND_CENTERS.right, { x: 1200, y: 560 })
  assert.deepEqual(CREATE_HAND_SIZE, { height: 703.5, width: 630 })
})

test('Create discipline glyphs retain their authored dimensions', () => {
  assert.deepEqual(CREATE_DISCIPLINE_SIZE, {
    arcane: { height: 238, width: 218 },
    body: { height: 229, width: 238 },
    mind: { height: 241, width: 227 },
  })
})

test('Create flash and star presentation are finite at their boundaries', () => {
  assert.equal(createEntryFlashAlpha(0), 0)
  assert.ok(createEntryFlashAlpha(1340) > 0.8)
  assert.equal(createEntryFlashAlpha(1400), 0)
  assert.equal(createSelectionFlashAlpha(0), 0.78)
  assert.equal(createSelectionFlashAlpha(1680), 0)
  assert.equal(CREATE_STARS.length, 50)
})

test('Create element painters consume the free-running 100 Hz application tick', () => {
  assert.match(createMenuScene, /nativeApplicationTick\(now\)/)
  assert.match(createMenuScene, /applicationTick:\s*nativeApplicationTick\(now\)/)
  assert.match(
    createMenuRenderer,
    /const tick = frame\.reducedMotion \? 0 : frame\.applicationTick/,
  )
  assert.doesNotMatch(createMenuRenderer, /sceneElapsedMs \* 60 \/ 1000/)
  assert.match(createMenuRenderer, /diagnostics\.applicationTick = tick/)
})

test('Create separates composed menu art from exact native element records', () => {
  assert.match(
    createMenuRenderer,
    /loadGameTextureMap\(sources, \{[\s\S]*?compositedSources: CREATE_COMPOSITED_ASSET_SOURCES/,
  )
  assert.match(createMenuRenderer, /createBoneyardCombatAtlas\(texture\)/)
  assert.match(createMenuRenderer, /combatAtlas\.single\(source\)/)
  assert.match(createMenuRenderer, /combatAtlas\.destroy\(\)/)
  assert.doesNotMatch(createMenuRenderer, /createNativeElementVfxTextures\(texture\)/)
})
