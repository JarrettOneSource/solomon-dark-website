import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const createScene = readFileSync(new URL('./CreateMenuScene.tsx', import.meta.url), 'utf8')
const loaderScene = readFileSync(new URL('./NativeLoader.tsx', import.meta.url), 'utf8')
const loaderStyles = readFileSync(new URL('./native-loader.css', import.meta.url), 'utf8')
const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const menuStyles = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')
const assetManifest = readFileSync(new URL('../lib/assets.ts', import.meta.url), 'utf8')
const buildRevision = readFileSync(
  new URL('./title-build-revision.ts', import.meta.url),
  'utf8',
)
const viteConfig = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
const deployMain = readFileSync(
  new URL('../../../ops/local-ci/deploy-main.sh', import.meta.url),
  'utf8',
)
const loaderRenderer = readFileSync(
  new URL('./renderer/loader-renderer.ts', import.meta.url),
  'utf8',
)
const titleRenderer = readFileSync(
  new URL('./renderer/title-menu-renderer.ts', import.meta.url),
  'utf8',
)
const createRenderer = readFileSync(
  new URL('./renderer/create-menu-renderer.ts', import.meta.url),
  'utf8',
)
const gameAssets = readFileSync(new URL('./game-assets.ts', import.meta.url), 'utf8')
const gameWebgl = readFileSync(new URL('./renderer/game-webgl.ts', import.meta.url), 'utf8')
const hubTextures = readFileSync(new URL('./renderer/hub-textures.ts', import.meta.url), 'utf8')
const boneyardTextures = readFileSync(
  new URL('./renderer/boneyard-textures.ts', import.meta.url),
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

test('startup owns only Loader, Title, and global audio while scenes own visual residency', () => {
  assert.match(gameAssets, /GAME_STARTUP_IMAGE_SOURCES/)
  assert.match(gameAssets, /sources:\s*TITLE_GAME_ASSET_SOURCES/)
  assert.match(gameAssets, /sources:\s*GAME_RESIDENT_AUDIO_SOURCES/)
  assert.doesNotMatch(gameAssets, /GAME_RESIDENT_IMAGE_SOURCES/)
  assert.doesNotMatch(gameAssets, /BONEYARD_RESIDENT_IMAGE_SOURCES/)
  assert.match(loaderRenderer, /LOADER_ASSET_SOURCES/)
  assert.match(titleRenderer, /TITLE_GAME_ASSET_SOURCES/)
  assert.match(createRenderer, /CREATE_GAME_ASSET_SOURCES/)
  assert.match(gameWebgl, /releaseGameImages\(sources\)/)
  assert.match(hubTextures, /loadGameTextureEntries\(sources\)/)
  assert.match(boneyardTextures, /loadGameTextureEntries\(sources/)
  assert.doesNotMatch(hubTextures, /Promise\.all\(sources\.map/)
  assert.doesNotMatch(boneyardTextures, /Promise\.all\(sources\.map/)
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

test('the title version lane reports the exact deployed build revision', () => {
  assert.match(titleRenderer, /layoutTitleBuildRevisionLabel/)
  assert.match(titleRenderer, /texture\(hub\.hud\.fontAtlas\)/)
  assert.match(titleRenderer, /canvas\.dataset\.buildRevision/)
  assert.match(titleRenderer, /canvas\.dataset\.buildLabel/)
  assert.doesNotMatch(titleRenderer, /mainMenu\.text\.version/)
  assert.doesNotMatch(assetManifest, /mainMenuTextVersion/)
  assert.match(buildRevision, /BUILD \$\{short\}/)
  assert.match(viteConfig, /\['rev-parse', '--verify', 'HEAD'\]/)
  assert.match(viteConfig, /__SDR_BUILD_REVISION__/)
  assert.match(viteConfig, /fileName: 'deployment\.json'/)
  assert.match(viteConfig, /revision: buildRevision/)
  assert.match(viteConfig, /requestedRevision !== checkoutRevision/)
  assert.match(
    deployMain,
    /SDR_BUILD_REVISION="\$target_sha" \.\/scripts\/validate\.sh/,
  )
})
