import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gameHud = readFileSync(new URL('./GameHud.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')
const interaction = readFileSync(new URL('./ContextualInteractButton.tsx', import.meta.url), 'utf8')
const interactionCss = readFileSync(new URL('./hub-inventory.css', import.meta.url), 'utf8')

test('the Hub rail exposes five semantic native-record buttons in stock order', () => {
  assert.match(gameHud, /HUB_HUD_SHORTCUTS\.map/)
  assert.match(gameHud, /data-hub-shortcut=/)
  assert.match(gameHud, /onHubShortcutClick\?\./)
  assert.match(hubScene, /mode === 'service'/)
  assert.match(hubScene, /source: 'shortcut'/)
})

test('contextual interaction is a visible labelled button in Hub and Boneyard', () => {
  assert.match(interaction, /className="game-interact-prompt"/)
  assert.match(interaction, /game-interact-key/)
  assert.match(interaction, />INTERACT</)
  assert.match(interactionCss, /\.game-interact-prompt\s*\{[^}]*opacity:\s*1/)
  assert.doesNotMatch(interactionCss, /\.game-interact-prompt\s*\{[^}]*opacity:\s*0/)
  assert.match(hubScene, /hubInteractionAtPoint/)
  assert.match(boneyardScene, /type: 'interact-goodie'/)
})
