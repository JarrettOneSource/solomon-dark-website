import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const dialog = read('./GameSettingsDialog.tsx')
const editor = read('./MobileUiEditor.tsx')
const editorCss = read('./mobile-ui-editor.css')
const settingsSharing = read('./MobileUiLayoutSettingsAction.tsx')
const sharing = read('./mobile-ui-sharing.ts')
const gameHud = read('./GameHud.tsx')
const quickbar = read('./SkillQuickbar.tsx')
const skull = read('./GameMenuSkull.tsx')
const joystick = read('./input/TouchJoystick.tsx')
const hub = read('./HubScene.tsx')
const boneyard = read('./BoneyardScene.tsx')
const hubCss = read('./hub.css')
const joystickCss = read('./input/touch-joystick.css')
const mainMenuCss = read('./main-menu.css')

test('Settings owns a windowed desktop editor and full-stage touch editor in every entry context', () => {
  assert.match(dialog, /type SettingsPage = 'controls' \| 'mobile-ui' \| 'performance' \| 'root'/)
  assert.match(dialog, /<SettingsAction label="CUSTOMIZE MOBILE UI" onClick=\{\(\) => onOpen\('mobile-ui'\)\} \/>/)
  assert.match(dialog, /if \(page === 'mobile-ui'\) commitMobileUi\(\)/)
  assert.match(dialog, /mobileUiRestoringDefault\) resetMobileUiLayout\(\)[\s\S]*else setMobileUiLayout\(mobileUiDraft\)/)
  assert.match(dialog, /page === 'mobile-ui' \? 'SAVE'/)
  assert.match(dialog, /if \(page === 'mobile-ui'\) return 'MOBILE UI EDITOR'/)
  assert.match(editorCss, /\.game-settings-dialog\[data-settings-page='mobile-ui'\] \{\s*width: min\(1080px, 100%\);/)
  assert.match(dialog, /setMobileUiFullscreen\(coarsePointer\)/)
  assert.match(dialog, /page === 'mobile-ui' && mobileUiFullscreen/)
  assert.match(dialog, /className="game-settings-backdrop game-settings-mobile-ui-fullscreen"/)
  assert.match(dialog, /presentation=\{mobileUiFullscreen \? 'fullscreen' : 'windowed'\}/)
  assert.match(editorCss, /\.mobile-ui-editor\[data-editor-presentation='fullscreen'\] \{[\s\S]*position: absolute;[\s\S]*inset: 0;/)
  assert.match(editorCss, /\.mobile-ui-editor\[data-editor-presentation='fullscreen'\] \.mobile-ui-editor-page \{[\s\S]*top: 0;[\s\S]*left: 0;/)
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
  assert.match(editor, /onWheel=\{presentation === 'windowed' \? wheel : undefined\}/)
  assert.match(editor, /Pinch empty silver to zoom/)
})

test('touch authoring has a draggable adjacent Save and Reset dock without persisted dock state', () => {
  assert.match(editor, /className="mobile-ui-editor-dock"/)
  assert.match(editor, /aria-label="Move editor actions"/)
  assert.match(editor, /setPointerCapture\(event\.pointerId\)/)
  assert.match(editor, /constrainDockPosition/)
  assert.match(editor, /className="mobile-ui-editor-dock-save"[\s\S]*?data-mobile-ui-save[\s\S]*?onClick=\{onSave\}/)
  assert.match(editor, /<button data-mobile-ui-reset onClick=\{onReset\} type="button">RESET<\/button>/)
  assert.doesNotMatch(sharing, /dockPosition|editor-dock/)
})

test('Settings publishes only a committed account layout and exposes the returned code', () => {
  assert.match(dialog, /<MobileUiLayoutSettingsAction accountUsername=\{accountUsername\} \/>/)
  assert.match(settingsSharing, /SUBMIT TO DARK CLOUD/)
  assert.match(settingsSharing, /accountUsername === null \|\| !customized/)
  assert.match(settingsSharing, /publishCurrentMobileUiLayout\(\)/)
  assert.match(settingsSharing, /<output>\{shared\.code\}<\/output>/)
  assert.match(sharing, /if \(!current\.customized\)/)
  assert.match(sharing, /api\.mobileUiLayouts\.publish\(mobileUiLayoutDocument\(current\.layout\)\)/)
})

test('all requested runtime owners consume their transform without replacing semantic actions', () => {
  for (const id of ['diagnostics', 'meters', 'inventory', 'xp', 'skillbook']) {
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
  assert.match(hubCustom, /\.hub-hud-meters\[data-mobile-ui-custom='true'\]/)
  assert.match(hubCustom, /left: var\(--mobile-ui-x\);[\s\S]*rotate\(var\(--mobile-ui-rotation\)\)/)
  assert.match(joystickCss.slice(joystickCss.lastIndexOf('@media')), /\.game-touch-joystick\[data-mobile-ui-custom='true'\]/)
  assert.match(mainMenuCss.slice(mainMenuCss.lastIndexOf('@media')), /\.game-menu-skull\[data-mobile-ui-custom='true'\]/)
  assert.equal(hub.match(/lane="movement"/g)?.length, 1)
  assert.equal(hub.match(/lane="primary"/g)?.length ?? 0, 0)
  assert.equal(boneyard.match(/lane="movement"/g)?.length, 1)
  assert.equal(boneyard.match(/lane="primary"/g)?.length, 1)
})

test('editor previews use the live diagnostics, paired meter, and dock-art proportions', () => {
  assert.match(editor, /<span>60 FPS<\/span>[\s\S]*<span>0 ms<\/span>/)
  assert.match(editor, /className="mobile-ui-editor-meters"/)
  assert.match(editor, /src=\{hub\.hud\.barRed\}/)
  assert.match(editor, /src=\{hub\.hud\.barBlue\}/)
  assert.match(editor, /className="mobile-ui-editor-pause"/)
  assert.match(editor, /className="mobile-ui-editor-dock-art"/)
  assert.match(editorCss, /\.mobile-ui-editor-pause \{[\s\S]*width: 81\.818%/)
  assert.match(editorCss, /\.mobile-ui-editor-dock-art \{[\s\S]*width: 89\.231%/)
  assert.doesNotMatch(editorCss.slice(editorCss.indexOf('.mobile-ui-editor-diagnostics'), editorCss.indexOf('.mobile-ui-editor-pause')), /background:/)
})

test('rotated joysticks keep screen-relative input and lifecycle release ownership', () => {
  assert.match(joystick, /rotatedSquareExpansion = Math\.abs\(Math\.cos\(radians\)\) \+ Math\.abs\(Math\.sin\(radians\)\)/)
  assert.match(joystick, /x: \(movement\.x \* cosine - movement\.y \* sine\) \* renderRadius/)
  assert.match(joystick, /inputSinkRef\.current\(movement\)/)
  for (const owner of ['pointerup', 'pointercancel', 'blur', 'pagehide', 'visibilitychange']) {
    assert.match(joystick, new RegExp(owner), owner)
  }
})
