import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const assetManifest = readFileSync(new URL('../lib/assets.ts', import.meta.url), 'utf8')
const scene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const stylesheet = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')

test('contains the Solomon Darker artwork inside the native title slot', () => {
  const mainMenuManifest = assetManifest.match(/export const mainMenu = \{([\s\S]*?)\n\}/)
  assert.ok(mainMenuManifest, 'missing main-menu asset manifest')
  assert.match(mainMenuManifest[1], /logo:\s*logoSolomonDark/)

  const logoRule = stylesheet.match(/\.main-menu-logo\s*\{([^}]*)\}/)
  assert.ok(logoRule, 'missing main-menu logo rule')
  assert.match(logoRule[1], /width:\s*51\.8125%/)
  assert.match(logoRule[1], /height:\s*43\.888889%/)
  assert.match(logoRule[1], /object-fit:\s*contain/)

  assert.match(scene, /aria-label="Solomon Darker game menu"/)
  assert.match(scene, /alt="Solomon Darker" className="main-menu-logo"/)
})
