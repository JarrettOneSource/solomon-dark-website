import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('./dark-cloud.css', import.meta.url), 'utf8')
const source = await readFile(new URL('./DarkCloudScene.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const mismatch = await readFile(new URL('./GameSaveModMismatchDialog.tsx', import.meta.url), 'utf8')

test('Dark Cloud owns the complete requested content and account membership', () => {
  for (const label of [
    'THE DARK CLOUD',
    'RECENT',
    'MODS',
    'BONEYARDS',
    'MULTIPLAYER',
    'YOU ARE SIGNED IN AS A GUEST.',
    'HOW DARK ARE YOU TODAY?',
    'SUBSCRIBE',
    'ENABLE MOD',
    'DISABLE MOD',
    'UNSUBSCRIBE',
  ]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(menu, /action="explore"[\s\S]*?onClick=\{onExplore\}/)
  assert.match(menu, /<DarkCloudScene/)
  for (const label of [
    'THE MOD LIST HAS CHANGED',
    'ADDED',
    'MISSING',
    'CHANGED',
    'CANCEL',
    'CONTINUE',
  ]) assert.match(mismatch, new RegExp(label))
})

test('Dark Cloud keeps the recovered 1600 by 900 primary geometry', () => {
  assert.match(css, /\.dark-cloud-menu \{[\s\S]*?left: 5px;[\s\S]*?top: 5px;[\s\S]*?width: 50px;[\s\S]*?height: 50px;/)
  assert.match(css, /\.dark-cloud-tabs \{[\s\S]*?top: 128px;[\s\S]*?left: 460px;/)
  assert.match(css, /\.dark-cloud-tabs button\.selected \{ height: 69px;/)
  assert.match(css, /\.dark-cloud-list-frame \{[\s\S]*?left: 55px;[\s\S]*?top: 175px;[\s\S]*?width: 1490px;[\s\S]*?height: 620px;/)
  assert.match(css, /\.dark-cloud-columns > span:first-child \{ padding-left: 36px; \}/)
  assert.match(css, /\.dark-cloud-primary-button \{ position: absolute; left: 623px; top: 1px; width: 354px; height: 69px;/)
  assert.match(css, /\.dark-cloud-icon-button:nth-child\(1\) \{ left: 390px; \}/)
  assert.match(css, /\.dark-cloud-icon-button:nth-child\(2\) \{ left: 495px; \}/)
  assert.match(css, /\.dark-cloud-options-button \{ position: absolute; left: 1017px;/)
})
