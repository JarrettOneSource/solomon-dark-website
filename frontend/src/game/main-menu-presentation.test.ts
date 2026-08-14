import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { gameAccountPresentation } from './game-account.ts'

const assetManifest = readFileSync(new URL('../lib/assets.ts', import.meta.url), 'utf8')
const scene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const renderer = readFileSync(
  new URL('./renderer/title-menu-renderer.ts', import.meta.url),
  'utf8',
)

test('contains the Solomon Darker artwork inside the native GPU title slot', () => {
  const mainMenuManifest = assetManifest.match(/export const mainMenu = \{([\s\S]*?)\n\}/)
  assert.ok(mainMenuManifest, 'missing main-menu asset manifest')
  assert.match(mainMenuManifest[1], /logo:\s*logoSolomonDark/)
  assert.match(renderer, /containedSprite\(texture\(mainMenu\.logo\), 435\.5, 0, 829, 395, 21\)/)
  assert.match(scene, /aria-label="Solomon Darker game menu"/)
  assert.match(scene, /TitleMenuPresentation/)
})

test('game account presentation is absent for anonymous play', () => {
  assert.equal(gameAccountPresentation(null), null)
})

test('game account presentation preserves the exact Website username', () => {
  assert.deepEqual(gameAccountPresentation('Account-Smoke_7'), {
    accessibleLabel: 'Signed in as Account-Smoke_7',
    username: 'Account-Smoke_7',
  })
})
