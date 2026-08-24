import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const nativeUi = JSON.parse(source('../assets/game/native-ui-assets.json'))

test('accepting the offer enters the tutorial prelude without a control picker', () => {
  const menu = source('./MainMenuScene.tsx')
  const css = source('./tutorial.css')
  assert.match(menu, /titlePrompt === 'kill-wizard'[\s\S]*?else \{[\s\S]*?setTutorialOfferOpen\(false\)[\s\S]*?setScreen\('tutorial-prelude'\)/)
  assert.doesNotMatch(menu, /tutorial-controls|TutorialControlPicker|tutorialControlSelection|chooseTutorialControls/)
  assert.doesNotMatch(css, /tutorial-control-picker|tutorial-control-choice/)
  assert.equal(existsSync(new URL('./TutorialControlPicker.tsx', import.meta.url)), false)
})

test('renders exact stock UI records for the prelude and blinking lesson pointer', () => {
  const prelude = source('./TutorialPrelude.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  const menu = source('./MainMenuScene.tsx')
  assert.match(prelude, /atlas="UI"[\s\S]*?className="tutorial-prelude-record"[\s\S]*?record=\{43\}/)
  assert.match(prelude, /className="tutorial-prelude-skull"[\s\S]*?record=\{68\}/)
  assert.match(prelude, /maskTint=\{TUTORIAL_GOLD\}/)
  assert.match(overlay, /<NativeUiSprite atlas="UI" record=\{28\} \/>/)
  assert.match(overlay, /<NativeUiNineSlice[\s\S]*?atlas="UI"[\s\S]*?record=\{4\}/)
  assert.deepEqual(nativeUi.atlases.UI.records['28'], {
    frame: [202, 656, 58, 61], logicalSize: [58, 61], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.deepEqual(nativeUi.atlases.UI.records['43'], {
    frame: [266, 62, 340, 66], logicalSize: [443, 171], points: [], rotated: false, trimOrigin: [50, 50],
  })
  assert.deepEqual(nativeUi.atlases.UI.records['68'], {
    frame: [753, 335, 93, 99], logicalSize: [93, 99], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.deepEqual(nativeUi.atlases.UI.records['4'], {
    frame: [241, 720, 20, 20], logicalSize: [20, 20], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.match(overlay, /state\.stageTicks % 50 > 19/)
  assert.match(overlay, /durationTicks[\s\S]*?- state\.narration\.ticksRemaining[\s\S]*?\/ 100/)
  assert.match(menu, /screen === 'tutorial-prelude'[\s\S]*?\? 'boneyard'/)
})

test('uses the stock MsgBox offer and common-gold teaching family', () => {
  const css = source('./tutorial.css')
  const overlay = source('./TutorialOverlay.tsx')
  const prompt = source('./title-menu-prompt.ts')
  const renderer = source('./renderer/title-menu-renderer.ts')
  assert.match(prompt, /title: 'PLAY THE TUTORIAL\?'/)
  assert.match(prompt, /Learn the controls and confront/)
  assert.match(prompt, /planNativeUiMessage/)
  assert.match(renderer, /nativeUi\.render\(planTitleMenuPrompt/)
  assert.match(overlay, /baseline=\{instructionBaselines!\.heading\}[\s\S]*?font="heading"/)
  assert.match(overlay, /const TUTORIAL_GOLD = 0xd9ba70/)
  assert.match(overlay, /left: 'calc\(50% \+ 2\.25px\)'/)
  assert.match(overlay, /style=\{\{ left: 10, top: 11\.75 \}\}/)
  assert.doesNotMatch(css, /tutorial-instruction[^{]*\{[^}]*drop-shadow/)
})

test('keeps every recovered modal teaching literal in the Tutorial overlay', () => {
  const overlay = source('./TutorialOverlay.tsx')
  for (const literal of [
    'again to resume playing',
    'Put items here',
    'Put equippable items',
    'Found items go in your backpack',
    'Drag skills here',
    'You are CONCENTRATING on',
    'limited to one skill at a time',
    'skill icon for more information',
    'primary attack or concentration',
  ]) assert.match(overlay, new RegExp(literal))
  assert.match(overlay, /state\.stage === 8 \|\| state\.stage === 17/)
  assert.doesNotMatch(overlay, /equip (?:the )?Sorceror's Amulet/i)
})

test('mounts modal callouts from the live Boneyard Tutorial owner', () => {
  const boneyard = source('./BoneyardScene.tsx')
  const menu = source('./MainMenuScene.tsx')
  assert.match(
    boneyard,
    /tutorial && \(tutorial\.stage === 10 \|\| tutorial\.stage === 13\)[\s\S]*?<TutorialModalCallouts controls=\{settings\.controls\} stage=\{tutorial\.stage\} \/>/,
  )
  assert.doesNotMatch(menu, /TutorialModalCallouts/)
})
