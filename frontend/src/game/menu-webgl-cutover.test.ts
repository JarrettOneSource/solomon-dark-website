import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const createScene = readFileSync(new URL('./CreateMenuScene.tsx', import.meta.url), 'utf8')
const loaderScene = readFileSync(new URL('./NativeLoader.tsx', import.meta.url), 'utf8')
const loaderStyles = readFileSync(new URL('./native-loader.css', import.meta.url), 'utf8')
const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const menuStyles = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')

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
  assert.match(createScene, /fixedGameBottomStageBounds/)
  assert.doesNotMatch(menuStyles, /\.main-menu-stage\s*\{[^}]*aspect-ratio:/s)
})

test('startup loader exposes total readiness and the representative active item', () => {
  assert.match(gamePage, /loadGameStartupAssets/)
  assert.match(loaderScene, /currentItem/)
  assert.match(loaderScene, /items ready/)
  assert.match(loaderStyles, /\.native-loader-status/)
})
