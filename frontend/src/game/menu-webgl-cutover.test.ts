import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const createScene = readFileSync(new URL('./CreateMenuScene.tsx', import.meta.url), 'utf8')
const loaderScene = readFileSync(new URL('./NativeLoader.tsx', import.meta.url), 'utf8')
const loaderStyles = readFileSync(new URL('./native-loader.css', import.meta.url), 'utf8')
const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const menuStyles = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')
const loaderRenderer = readFileSync(
  new URL('./renderer/loader-renderer.ts', import.meta.url),
  'utf8',
)
const titleRenderer = readFileSync(
  new URL('./renderer/title-menu-renderer.ts', import.meta.url),
  'utf8',
)

test('game menu art is presented by the shared WebGL baseline', () => {
  assert.match(mainScene, /TitleMenuPresentation/)
  assert.doesNotMatch(mainScene, /MainMenuBackdrop|MenuSolomon/)
  assert.match(createScene, /createCreateMenuRenderer/)
  assert.doesNotMatch(createScene, /ElementVfx|<img/)
  assert.match(loaderScene, /createLoaderRenderer/)
  assert.doesNotMatch(loaderScene, /<img/)
})

test('fixed menu renderers share the full game viewport and persistent fullscreen control', () => {
  assert.match(mainScene, /fixedGameViewportLayout/)
  assert.match(mainScene, /GameFullscreenButton/)
  assert.match(mainScene, /game-orientation-hint/)
  assert.doesNotMatch(gamePage, /game-orientation-hint/)
  assert.match(createScene, /fixedGameStageBounds/)
  assert.doesNotMatch(menuStyles, /\.main-menu-stage\s*\{[^}]*aspect-ratio:/s)
})

test('startup loader exposes total readiness and the representative active item', () => {
  assert.match(gamePage, /loadGameStartupAssets/)
  assert.match(loaderScene, /currentItem/)
  assert.match(loaderScene, /items ready/)
  assert.match(loaderStyles, /\.native-loader-status/)
})

test('Hub and Boneyard renderer code follows the existing transition loading barriers', () => {
  assert.match(mainScene, /lazy\(\(\) => import\('\.\/HubScene\.tsx'\)\)/)
  assert.match(mainScene, /lazy\(\(\) => import\('\.\/BoneyardScene\.tsx'\)\)/)
  assert.match(mainScene, /const loadSkillPicker = \(\) => import\('\.\/SkillPicker\.tsx'\)/)
  assert.match(mainScene, /if \(runtimeSnapshot\?\.world\.kind === 'boneyard'\) void loadSkillPicker\(\)/)
  assert.match(mainScene, /<Suspense fallback=\{null\}>/)
  assert.doesNotMatch(mainScene, /import HubScene from/)
  assert.doesNotMatch(mainScene, /import BoneyardScene from/)
  assert.doesNotMatch(mainScene, /import SkillPicker from/)
})

test('edge chrome and the loader consume their recovered screen ownership', () => {
  assert.match(titleRenderer, /title-menu-solomon-stage/)
  assert.match(titleRenderer, /title-menu-version-stage/)
  assert.match(titleRenderer, /title-menu-quit-stage/)
  assert.match(createScene, /fixedGameStageBounds\(viewport, 'left', 'top'\)/)
  assert.match(loaderScene, /fixedGameViewportLayout/)
  assert.match(loaderRenderer, /LOADER_FRAME_BOUNDS/)
  assert.match(loaderRenderer, /LOADER_FILL_BOUNDS/)
  assert.doesNotMatch(loaderRenderer, /\.rotation\s*=\s*Math\.PI\s*\/\s*2/)
  assert.doesNotMatch(loaderStyles, /16\s*\/\s*9/)
})
