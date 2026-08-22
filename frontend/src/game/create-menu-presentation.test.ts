import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CREATE_HAND_CENTERS,
  CREATE_HAND_SIZE,
} from './renderer/create-menu-render-contract.ts'
import {
  CREATE_WIZARD_NAME_FONT,
  CREATE_WIZARD_NAME_MAX_WIDTH,
  CREATE_WIZARD_NAME_VALUE_BOUNDS,
  STOCK_WIZARD_NAMES,
  initialCreateWizardName,
  initialCreateWizardNameForSession,
  layoutCreateWizardName,
  measureCreateWizardName,
  randomStockWizardName,
  validateCreateWizardName,
} from './create-wizard-name.ts'

const renderer = readFileSync(
  new URL('./renderer/create-menu-renderer.ts', import.meta.url),
  'utf8',
)
const createScene = readFileSync(new URL('./CreateMenuScene.tsx', import.meta.url), 'utf8')
const mainScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const mainMenuCss = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')

test('closed right hand keeps its recovered center and mirrored, unrotated registration', () => {
  assert.deepEqual(CREATE_HAND_CENTERS.right, { x: 1200, y: 560 })
  assert.deepEqual(CREATE_HAND_SIZE, { height: 703.5, width: 630 })
  assert.match(renderer, /handSprite\(texture\(createMenu\.handFist\), true\)/)
  assert.match(renderer, /\(flipped \? -1 : 1\)/)
  assert.doesNotMatch(renderer, /rightHand\.rotation/)
})

test('wizard-name editing keeps native bitmap pixels and reaches the first player configuration', () => {
  assert.match(createScene, /<input/)
  assert.match(createScene, /onDisplayNameChange/)
  assert.match(renderer, /layoutCreateWizardName/)
  assert.match(renderer, /texture\(hub\.hud\.fontAtlas\)/)
  assert.doesNotMatch(renderer, /texture\(createMenu\.textName\)/)
  assert.match(mainScene, /displayName: selectedDisplayName/)
  assert.match(createScene, /readOnly=\{Boolean\(retainedLoadout\)\}/)
})

test('wizard-name controls own clear and stock randomization without a live rename path', () => {
  assert.match(createScene, /create-menu-name-clear/)
  assert.match(createScene, /Clear wizard name/)
  assert.match(createScene, /create-menu-name-randomize/)
  assert.match(createScene, /Randomize wizard name/)
  assert.match(createScene, /readOnly=\{Boolean\(retainedLoadout\)\}/)
  assert.match(gamePage, /const displayName = accountUsername \?\? ''/)
  assert.match(gamePage, /admitBrowserGame\(admission, getToken\(\)\)/)
})

test('wizard-name controls own only their logical bounds and a fresh Create owns its draft', () => {
  assert.doesNotMatch(mainMenuCss, /\.create-menu-native-name-stage\s*\{[^}]*pointer-events:\s*auto/s)
  assert.match(mainMenuCss, /\.create-menu-name-input\s*\{[^}]*pointer-events:\s*auto/s)
  assert.match(mainMenuCss, /\.create-menu-name-randomize\s*\{[^}]*background-color:\s*transparent/s)
  assert.doesNotMatch(mainMenuCss, /\.create-menu-name-randomize\s*\{[^}]*(?:border-radius|box-shadow):/s)
  assert.doesNotMatch(mainScene, /wizardNameTouchedRef/)
  const beginNewGame = mainScene.slice(
    mainScene.indexOf('const beginNewGame ='),
    mainScene.indexOf('const leaveCreate ='),
  )
  const beginCreate = mainScene.slice(
    mainScene.indexOf('const beginCreate ='),
    mainScene.indexOf('const beginNewGame ='),
  )
  const startHub = mainScene.slice(
    mainScene.indexOf('const startHub ='),
    mainScene.indexOf('const startBoneyard ='),
  )
  assert.doesNotMatch(beginNewGame, /prepareGame/)
  assert.match(
    beginCreate,
    /setWizardName\([\s\S]*initialCreateWizardNameForSession\(displayName\)[\s\S]*transitionTo\('create'\)/,
  )
  assert.match(startHub, /await prepareGame\(pendingAdmission\)[\s\S]*await connectSession\(/)
})

test('wizard-name layout drains the native group-4 glyph and kerning membership', () => {
  assert.equal(CREATE_WIZARD_NAME_FONT.group, 4)
  assert.equal(CREATE_WIZARD_NAME_FONT.glyphCount, 42)
  assert.equal(CREATE_WIZARD_NAME_FONT.kerningCount, 132)
  assert.deepEqual(Object.keys(CREATE_WIZARD_NAME_FONT.glyphs).join(''), '0123456789!,./:?ABCDEFGHIJKLMNOPQRSTUVWXYZ')

  const layout = layoutCreateWizardName('helvidius')
  assert.equal(layout.value, 'HELVIDIUS')
  assert.equal(layout.width, 240)
  assert.equal(layout.height, 31)
  assert.equal(layout.left, 122)
  assert.equal(layout.top, 19)
  assert.equal(layout.right, 362)
  assert.equal(layout.glyphs.map((glyph) => glyph.char).join(''), 'HELVIDIUS')
  assert.deepEqual(CREATE_WIZARD_NAME_VALUE_BOUNDS, {
    height: 49,
    left: 50,
    top: 12,
    width: 384,
  })
  assert.deepEqual(validateCreateWizardName('SolonSolus'), {
    ok: true,
    value: 'SolonSolus',
  })
  assert.deepEqual(validateCreateWizardName('Solon-Solus'), {
    ok: false,
    reason: 'Use letters, numbers, or ! , . / : ? only.',
  })
  assert.equal(initialCreateWizardName('Account-Smoke_7'), 'AccountSmok')
  assert.equal(initialCreateWizardName('___'), 'Helvidius')
})

test('wizard-name input uses the native measured-width boundary', () => {
  assert.equal(CREATE_WIZARD_NAME_MAX_WIDTH, 372)
  assert.equal(measureCreateWizardName('HELVIDIUS'), 243)
  assert.equal(measureCreateWizardName('A'.repeat(11)), 363)
  assert.equal(measureCreateWizardName('A'.repeat(12)), 396)
  assert.deepEqual(validateCreateWizardName('A'.repeat(11)), {
    ok: true,
    value: 'A'.repeat(11),
  })
  assert.deepEqual(validateCreateWizardName('A'.repeat(12)), {
    ok: false,
    reason: 'Wizard name is too wide.',
  })
  assert.equal(initialCreateWizardName('A'.repeat(64)), 'A'.repeat(11))
  assert.ok(STOCK_WIZARD_NAMES.every((name) => validateCreateWizardName(name).ok))
})

test('stock wizard-name membership is complete and random selection is bounded', () => {
  assert.equal(STOCK_WIZARD_NAMES.length, 273)
  assert.equal(STOCK_WIZARD_NAMES[0], 'Abodius')
  assert.equal(STOCK_WIZARD_NAMES.at(-1), 'Magnificus')
  assert.equal(STOCK_WIZARD_NAMES.includes('Reaper'), false)
  assert.equal(randomStockWizardName(() => 0), 'Abodius')
  assert.equal(randomStockWizardName(() => 0.999999), 'Magnificus')
  assert.equal(initialCreateWizardNameForSession('', () => 0.5), STOCK_WIZARD_NAMES[136])
  assert.equal(initialCreateWizardNameForSession('Account-Smoke_7', () => 0), 'AccountSmok')
})
