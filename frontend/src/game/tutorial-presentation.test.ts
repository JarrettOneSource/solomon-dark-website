import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const nativeUi = JSON.parse(source('../assets/game/native-ui-assets.json'))

test('keeps only the two native-visible control panels at their stock rectangles', () => {
  const picker = source('./TutorialControlPicker.tsx')
  const menu = source('./MainMenuScene.tsx')
  const css = source('./tutorial.css')
  assert.match(picker, /tutorial-control-choice-arrows/)
  assert.match(picker, /tutorial-control-choice-wasd/)
  assert.doesNotMatch(picker, /tutorial-control-choice-mouse/)
  assert.match(css, /tutorial-control-choice-arrows[\s\S]*left: 477\.5px;[\s\S]*top: 290px;[\s\S]*width: 245px;[\s\S]*height: 320px;/)
  assert.match(css, /tutorial-control-choice-wasd[\s\S]*left: 850\.5px;[\s\S]*top: 324px;[\s\S]*width: 299px;[\s\S]*height: 252px;/)
  assert.match(css, /tutorial-control-picker[\s\S]*pointer-events: auto;/)
  assert.deepEqual(nativeUi.atlases.Controls.records['0'], {
    frame: [0, 550, 245, 320], logicalSize: [245, 320], points: [], rotated: false, trimOrigin: [0, 0],
  })
  assert.deepEqual(nativeUi.atlases.Controls.records['2'], {
    frame: [0, 0, 299, 252], logicalSize: [299, 252], points: [], rotated: false, trimOrigin: [0, 0],
  })
  for (const binding of [
    "['openMenu', 'Escape']",
    "['openInventory', 'KeyI']",
    "['openSkills', 'KeyT']",
    "['belt1', 'Mouse2']",
    "['belt2', 'Delete']",
    "['belt3', 'End']",
    "['belt4', 'Backspace']",
    "['belt5', 'PageUp']",
    "['belt6', 'PageDown']",
    "['belt7', 'Insert']",
    "['belt8', 'Home']",
  ]) assert.ok(menu.includes(binding), binding)
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
  assert.match(menu, /screen === 'tutorial-controls' \|\| screen === 'tutorial-prelude'[\s\S]*?\? 'boneyard'/)
})

test('uses the stock heading and common-gold render family', () => {
  const picker = source('./TutorialControlPicker.tsx')
  const overlay = source('./TutorialOverlay.tsx')
  const css = source('./tutorial.css')
  assert.match(picker, /font="heading"[\s\S]*?tint=\{0xd9ba70\}/)
  assert.match(css, /tutorial-control-picker-heading[\s\S]*?top: 30px;/)
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
})
