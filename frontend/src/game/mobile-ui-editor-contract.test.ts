import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const dialog = read('./GameSettingsDialog.tsx')
const editor = read('./MobileUiEditor.tsx')
const editorCss = read('./mobile-ui-editor.css')
const gameHud = read('./GameHud.tsx')
const quickbar = read('./SkillQuickbar.tsx')
const skull = read('./GameMenuSkull.tsx')
const joystick = read('./input/TouchJoystick.tsx')
const hub = read('./HubScene.tsx')
const boneyard = read('./BoneyardScene.tsx')
const hubCss = read('./hub.css')
const joystickCss = read('./input/touch-joystick.css')
const mainMenuCss = read('./main-menu.css')

test('Settings owns one save/reset Mobile UI page in every existing entry context', () => {
  assert.match(dialog, /type SettingsPage = 'controls' \| 'mobile-ui' \| 'performance' \| 'root'/)
  assert.match(dialog, /<SettingsAction label="CUSTOMIZE MOBILE UI" onClick=\{\(\) => onOpen\('mobile-ui'\)\} \/>/)
  assert.match(dialog, /if \(page === 'mobile-ui'\) commitMobileUi\(\)/)
  assert.match(dialog, /mobileUiRestoringDefault\) resetMobileUiLayout\(\)[\s\S]*else setMobileUiLayout\(mobileUiDraft\)/)
  assert.match(dialog, /page === 'mobile-ui' \? 'SAVE'/)
  assert.match(dialog, /if \(page === 'mobile-ui'\) return 'MOBILE UI EDITOR'/)
  assert.match(editorCss, /\.game-settings-dialog\[data-settings-page='mobile-ui'\] \{\s*width: min\(1080px, 100%\);/)
})

test('the silver authoring page separates member transforms from page pan and deep zoom', () => {
  assert.match(editorCss, /\.mobile-ui-editor-page \{[\s\S]*background-color: #b8bdc1;/)
  assert.match(editorCss, /background-size:[\s\S]*var\(--mobile-ui-editor-grid\)/)
  assert.match(editor, /const RESIZE_HANDLES = Object\.freeze\(\[[\s\S]*'north-west'[\s\S]*'west'/)
  assert.match(editor, /className="mobile-ui-editor-rotate-handle"/)
  assert.match(editor, /elementPointers\.current\.size === 2[\s\S]*kind: 'pinch'/)
  assert.match(editor, /elementPointers\.current\.size > 0 && elementPointerOwner\.current !== id\) return/)
  assert.match(editor, /mobileUiElementPinchScale\([\s\S]*interaction\.initialScale/)
  assert.match(editor, /if \(event\.target instanceof Element && event\.target\.closest\('\.mobile-ui-editor-element'\)\) return/)
  assert.match(editor, /pagePointers\.current\.size === 2[\s\S]*initialZoom: zoom[\s\S]*kind: 'pinch'/)
  assert.match(editor, /mobileUiPagePinchZoom\(/)
  assert.match(editor, /onWheel=\{wheel\}/)
  assert.match(editor, /Pinch empty silver to zoom/)
})

test('all requested runtime owners consume their transform without replacing semantic actions', () => {
  for (const id of ['diagnostics', 'inventory', 'xp', 'skillbook']) {
    assert.match(gameHud, new RegExp(`data-mobile-ui-element="${id}"`), id)
    assert.match(gameHud, new RegExp(`mobileUiElementStyle\\(mobileUi, '${id}'\\)`), id)
  }
  assert.match(quickbar, /entry\?\.kind === 'health-potion'\s*\? 'healthPotion'/)
  assert.match(quickbar, /entry\?\.kind === 'mana-potion'\s*\? 'manaPotion'/)
  assert.match(quickbar, /`slot\$\{slot \+ 1\}` as MobileUiElementId/)
  assert.match(quickbar, /data-mobile-ui-element=\{mobileUiId\}/)
  assert.match(quickbar, /mobileUiElementStyle\(mobileUi, mobileUiId\)/)
  assert.match(skull, /data-mobile-ui-element="pause"/)
  assert.match(joystick, /lane === 'movement' \? 'leftJoystick' : 'rightJoystick'/)
  assert.match(joystick, /data-mobile-ui-element=\{mobileUiId\}/)

  assert.match(gameHud, /onClick=\{onInventoryClick\}/)
  assert.match(gameHud, /onClick=\{onSkillsClick\}/)
  assert.match(quickbar, /onInput\?\.\(slot, true\)[\s\S]*onInput\?\.\(slot, false\)/)
  assert.match(skull, /if \(activateMenuBack\(root\) !== 'no-modal'\) return/)
})

test('custom runtime geometry is coarse-only and scene membership remains unchanged', () => {
  const hubCustom = hubCss.slice(hubCss.indexOf('A saved Mobile UI profile'))
  assert.match(hubCustom, /@media \(hover: none\) and \(pointer: coarse\)/)
  assert.match(hubCustom, /\.hub-hud-quickbar-slot\[data-mobile-ui-custom='true'\]/)
  assert.match(hubCustom, /left: var\(--mobile-ui-x\);[\s\S]*rotate\(var\(--mobile-ui-rotation\)\)/)
  assert.match(joystickCss.slice(joystickCss.lastIndexOf('@media')), /\.game-touch-joystick\[data-mobile-ui-custom='true'\]/)
  assert.match(mainMenuCss.slice(mainMenuCss.lastIndexOf('@media')), /\.game-menu-skull\[data-mobile-ui-custom='true'\]/)
  assert.equal(hub.match(/lane="movement"/g)?.length, 1)
  assert.equal(hub.match(/lane="primary"/g)?.length ?? 0, 0)
  assert.equal(boneyard.match(/lane="movement"/g)?.length, 1)
  assert.equal(boneyard.match(/lane="primary"/g)?.length, 1)
})

test('rotated joysticks keep screen-relative input and lifecycle release ownership', () => {
  assert.match(joystick, /rotatedSquareExpansion = Math\.abs\(Math\.cos\(radians\)\) \+ Math\.abs\(Math\.sin\(radians\)\)/)
  assert.match(joystick, /x: \(movement\.x \* cosine - movement\.y \* sine\) \* renderRadius/)
  assert.match(joystick, /inputSinkRef\.current\(movement\)/)
  for (const owner of ['pointerup', 'pointercancel', 'blur', 'pagehide', 'visibilitychange']) {
    assert.match(joystick, new RegExp(owner), owner)
  }
})
