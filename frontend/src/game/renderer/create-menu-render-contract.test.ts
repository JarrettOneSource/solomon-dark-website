import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CREATE_ATLAS_RECORDS,
  CREATE_DISCIPLINE_SIZE,
  CREATE_HAND_CENTERS,
  CREATE_HAND_LOGICAL_SIZE,
  CREATE_HAND_SIZE,
  CREATE_STARS,
  CREATE_UI_ATLAS_RECORDS,
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
  assert.deepEqual(CREATE_HAND_LOGICAL_SIZE, { height: 469, width: 420 })
  assert.deepEqual(CREATE_ATLAS_RECORDS.hands, {
    cupped: [16, 17, 18, 19],
    fist: [14, 15],
    raised: [20, 21, 22, 23],
  })
})

test('Create owns every native page record and both UI chrome records', () => {
  assert.deepEqual(CREATE_ATLAS_RECORDS, {
    arcaneWheel: 7,
    chooseDiscipline: 2,
    chooseElement: 3,
    dice: 6,
    disciplines: { arcane: 0, body: 1, mind: 5 },
    elements: { air: 11, earth: 13, ether: 9, fire: 10, water: 12 },
    hands: {
      cupped: [16, 17, 18, 19],
      fist: [14, 15],
      raised: [20, 21, 22, 23],
    },
    stars: { large: 4, small: 8 },
  })
  assert.deepEqual(CREATE_UI_ATLAS_RECORDS, { backSkull: 42, nameEnd: 80 })
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

test('Create separates true composites from exact native page records', () => {
  assert.match(
    createMenuRenderer,
    /loadGameTextureMap\(\{[\s\S]*?composited: CREATE_COMPOSITED_ASSET_SOURCES[\s\S]*?stock: \[[\s\S]*?CREATE_STOCK_ASSET_SOURCES/,
  )
  assert.match(createMenuRenderer, /nativeUi\.texture\('Create', record\)/)
  assert.match(createMenuRenderer, /nativeUi\.slice\('Create', record, \[0, 0, 1, 1\]\)/)
  assert.doesNotMatch(createMenuRenderer, /createMenu\.hand(?:Cupped|Fist|Raised)/)
  assert.match(createMenuRenderer, /createBoneyardCombatAtlas\(texture\)/)
  assert.match(createMenuRenderer, /combatAtlas\.single\(source\)/)
  assert.match(createMenuRenderer, /combatAtlas\.destroy\(\)/)
  assert.doesNotMatch(createMenuRenderer, /createNativeElementVfxTextures\(texture\)/)
})
