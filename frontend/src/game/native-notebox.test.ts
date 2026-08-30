import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const gameRoot = new URL('./', import.meta.url)

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, gameRoot), 'utf8')
}

test('Boast uses the transient native Notebox instead of a blocking acknowledgement', () => {
  assert.equal(existsSync(new URL('NativeNotebox.tsx', gameRoot)), true)
  assert.equal(existsSync(new URL('native-notebox.ts', gameRoot)), true)

  const inventoryUi = source('HubInventoryUi.tsx')
  const hub = source('HubScene.tsx')
  const boneyard = source('BoneyardScene.tsx')
  const css = source('hub-inventory.css')

  assert.match(inventoryUi, /<NativeNotebox/)
  assert.doesNotMatch(inventoryUi, /alertdialog|>OKAY<|NativeNpcNotebox|onBlockingOverlayChange/)
  assert.doesNotMatch(hub, /npcNoteboxOpen/)
  assert.doesNotMatch(boneyard, /npcNoteboxOpen/)
  assert.doesNotMatch(css, /hub-native-notebox-overlay|hub-native-notebox button/)
})

test('Boast failure owns the exact native buzzer stream', () => {
  const assets = source('game-audio-assets.ts')
  const contract = source('game-audio-native.ts')
  const extractor = readFileSync(
    new URL('../../../tools/extract-game-audio.sh', import.meta.url),
    'utf8',
  )

  assert.match(assets, /boastFailure/)
  assert.match(contract, /'boast-failure'/)
  assert.match(contract, /registryOffset: 0x133c/)
  assert.match(contract, /sounds\\\\buzzer__stream/)
  assert.match(contract, /19c010bb56690b3f7808a0f71ae639ab8d033e0ea1e31637ac688da957f3e844/)
  assert.match(extractor, /buzzer__stream\.wav buzzer\.wav 19c010bb56690b3f7808a0f71ae639ab8d033e0ea1e31637ac688da957f3e844/)
})
