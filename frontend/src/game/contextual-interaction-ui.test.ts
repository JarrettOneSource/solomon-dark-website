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

test('the persistent Hub run-entry control keeps both stock layers and no current-room gate', () => {
  assert.match(gameHud, /hubRunEntryPresentation/)
  assert.match(gameHud, /src=\{hub\.hud\.mapCompass\}/)
  assert.match(gameHud, /src=\{hub\.hud\.mapPlay\}/)
  assert.match(
    gameHud,
    /hub-hud-map-compass[\s\S]*hub-hud-map-play/,
  )
  assert.match(hubScene, /mapTransitionActive=\{transitionActive\}/)
  assert.doesNotMatch(hubScene, /!isHost \|\| currentRegion !== 'courtyard'/)
  assert.doesNotMatch(
    hubScene,
    /snapshot\.hostPlayerId !== playerId \|\| participant\.region !== 'courtyard'/,
  )
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

test('Skorcha interaction follows current population snapshots instead of the initial Hub frame', () => {
  assert.match(hubScene, /const \[skorchaInteraction, setSkorchaInteraction\] = useState/)
  assert.match(hubScene, /const next = snapshot\.world\.skorcha/)
  assert.match(hubScene, /skorchaDismissalIndex=\{skorchaInteraction\?\.dismissalIndex \?\? 0\}/)
  assert.match(hubScene, /skorchaPosition=\{skorchaInteraction\?\.position \?\? null\}/)
  assert.doesNotMatch(
    hubScene,
    /skorchaPosition=\{hubInitialSnapshot\.world\.skorcha\?\.position/,
  )
})
