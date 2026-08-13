import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

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
