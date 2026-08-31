import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const gameRoot = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const kitRoot = fileURLToPath(new URL('./', import.meta.url)).replace(/\/$/, '')
const PUBLIC_ENTRYPOINTS = new Set([
  'assets.ts',
  'core.ts',
  'pixi.ts',
  'react-raw.ts',
  'react.ts',
])

test('game callers cross only the supported native UI Kit interfaces', () => {
  const violations: string[] = []
  for (const path of sourceFiles(gameRoot)) {
    if (path.startsWith(`${kitRoot}/`)) continue
    const relative = path.slice(gameRoot.length + 1)
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(/(?:from\s+|import\s*\()['"]([^'"]*\/native-ui\/([^'"]+))['"]/g)) {
      const entrypoint = match[2]!
      if (!PUBLIC_ENTRYPOINTS.has(entrypoint)) {
        violations.push(`${relative}: ${match[1]}`)
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('the kit publishes separate pure, browser-asset, Pixi, raw React, and semantic React seams', () => {
  const source = (name: string) => readFileSync(`${kitRoot}/${name}`, 'utf8')
  assert.match(source('assets.ts'), /native-ui-assets\.ts/)
  assert.match(source('core.ts'), /native-ui-catalog\.ts/)
  assert.doesNotMatch(source('core.ts'), /native-ui-assets\.ts/)
  assert.match(source('core.ts'), /native-ui-plan\.ts/)
  assert.match(source('core.ts'), /native-ui-boast-menu\.ts/)
  assert.match(source('pixi.ts'), /native-ui-pixi\.ts/)
  assert.match(source('react-raw.ts'), /NativeUiSprite\.tsx/)
  assert.match(source('react.ts'), /NativeUiButton/)
  assert.match(source('react.ts'), /NativeUiBoastMenu/)
  assert.match(source('react.ts'), /NativeUiMessageBox/)
  assert.match(source('react.ts'), /NativeUiSimpleMenu/)
  assert.match(source('react.ts'), /NativeUiSettings/)
  assert.match(source('react.ts'), /NativeUiTabs/)
})

test('stock consumers keep behavior while delegating presentation to semantic kit modules', () => {
  const gameplayPause = readFileSync(`${gameRoot}/GameplayPauseMenu.tsx`, 'utf8')
  const settings = readFileSync(`${gameRoot}/GameSettingsDialog.tsx`, 'utf8')
  const inventory = readFileSync(`${gameRoot}/HubInventoryUi.tsx`, 'utf8')
  const inventoryRenderer = readFileSync(`${gameRoot}/renderer/hub-inventory-renderer.ts`, 'utf8')
  assert.match(gameplayPause, /<NativeUiSimpleMenu/)
  assert.doesNotMatch(gameplayPause, /createGameplayPauseRenderer|NativePausePressedRow/)
  assert.equal(existsSync(`${gameRoot}/renderer/gameplay-pause-renderer.ts`), false)
  for (const name of [
    'NativeUiSettingsAction',
    'NativeUiSettingsBinding',
    'NativeUiSettingsGroup',
    'NativeUiSettingsPanel',
    'NativeUiSettingsRange',
    'NativeUiSettingsToggle',
  ]) assert.match(settings, new RegExp(`<${name}`))
  assert.doesNotMatch(settings, /function Settings(?:Action|Group|Range|Toggle)/)
  assert.match(inventory, /<NativeUiNotebox/)
  assert.match(inventory, /planNativeUiBoastMenu/)
  assert.match(inventoryRenderer, /planNativeUiBoastMenu/)
  assert.match(inventoryRenderer, /buildBoastDialogue/)
  assert.equal(existsSync(`${gameRoot}/NativeNotebox.tsx`), false)
  assert.equal(existsSync(`${gameRoot}/native-notebox.ts`), false)
})

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = `${root}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}
