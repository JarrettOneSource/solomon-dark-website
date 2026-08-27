import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./Account.tsx', import.meta.url), 'utf8')
const gameSource = readFileSync(new URL('./Game.tsx', import.meta.url), 'utf8')
const mainMenuSource = readFileSync(new URL('../game/MainMenuScene.tsx', import.meta.url), 'utf8')
const transferSource = readFileSync(
  new URL('../game/NativeSaveTransferSettings.tsx', import.meta.url),
  'utf8',
)

test('Account exposes explicit previewed stock import and conditional slot replacement', () => {
  assert.match(source, /import stock save/i)
  assert.match(source, /readNativeSaveFileSelection/)
  assert.match(source, /createWebGameSaveFromPortableProfile/)
  assert.match(source, /expectedRevision: save\?\.revision \?\? 0/)
  assert.match(source, /replace slot I/)
  assert.match(source, /pendingImport\.portable\.wizard\.permanentRanks/)
  assert.match(source, /pendingImport\.imported\.warnings\.map/)
})

test('Account exports only through the strict stock archive bridge', () => {
  assert.match(source, /export for stock/i)
  assert.match(source, /exportWebGameSaveToNativeArchive\(save\.document\)/)
  assert.match(source, /application\/zip/)
  assert.match(source, /exported\.warnings\.join/)
})

test('title Settings exposes the same strict bridge for cloud and anonymous local slots', () => {
  assert.match(gameSource, /readNativeSaveFileSelection\(files\)/)
  assert.match(gameSource, /createWebGameSaveFromPortableProfile\(portable\)/)
  assert.match(gameSource, /coordinator\.replace\(document\)/)
  assert.match(gameSource, /exportWebGameSaveToNativeArchive\(current\.document\)/)
  assert.match(mainMenuSource, /saveTransfer=\{settingsContext === 'title' \? saveTransfer : undefined\}/)
  assert.match(transferSource, /CHOOSE STOCK SAVE FILES/)
  assert.match(transferSource, /REPLACE BROWSER SLOT/)
  assert.match(transferSource, /DOWNLOAD STOCK SAVE ARCHIVE/)
  assert.match(transferSource, /exported\.warnings\.join/)
})
