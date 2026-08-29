import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const gameRoot = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const rendererRoot = fileURLToPath(new URL('./', import.meta.url)).replace(/\/$/, '')
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '')

test('every stock Pixi application installs the shared native fixed-function state', () => {
  const applicationOwners = sourceFiles(gameRoot).filter((path) => (
    !isTestSource(path) && source(path).includes('new Application()')
  ))
  assert.deepEqual(applicationOwners.map(relativeToGame).sort(), [
    'renderer/boneyard-world-renderer.ts',
    'renderer/game-webgl.ts',
    'renderer/hub-world-renderer.ts',
  ])
  for (const path of applicationOwners) {
    assert.match(
      source(path),
      /installNativeFixedFunctionRenderPipeline\(application\.renderer(?:,|\))/,
      relativeToGame(path),
    )
  }
  assert.match(
    source(`${rendererRoot}/game-webgl.ts`),
    /preserveBrowserCompositingAlpha: backgroundAlpha === 0/,
  )
  const fixedFunctionPipeline = source(
    `${rendererRoot}/native-fixed-function-render-pipeline.ts`,
  )
  const boneyardRenderer = source(`${rendererRoot}/boneyard-world-renderer.ts`)
  assert.match(fixedFunctionPipeline, /class NativeFixedFunctionBatcher extends DefaultBatcher/)
  assert.match(fixedFunctionPipeline, /const meshAdaptor[\s\S]*?if \(!meshAdaptor\) return/)
  assert.match(fixedFunctionPipeline, /executeNativeFixedFunctionMesh/)
  assert.match(fixedFunctionPipeline, /textureAlpha \* vertexAlpha/)
  assert.match(
    boneyardRenderer,
    /installNativeFixedFunctionRenderPipeline\(application\.renderer, \{[\s\S]*?installTextureAlphaShaders: false/,
  )
  assert.match(boneyardRenderer, /installNativeArenaRenderPipeline\(application\.renderer\)/)
})

test('every image source has one explicit stock, point, or composite policy', () => {
  const gameSources = sourceFiles(gameRoot).filter((path) => !isTestSource(path))
  const directImageSources = gameSources.filter((path) => (
    source(path).includes('new ImageSource(')
  ))
  assert.deepEqual(directImageSources.map(relativeToGame), [
    'renderer/native-fixed-function-render-pipeline.ts',
  ])

  const directTextureFrom = gameSources.filter((path) => (
    source(path).includes('Texture.from(')
  ))
  assert.deepEqual(directTextureFrom.map(relativeToGame).sort(), [
    'renderer/mod-consumable-effect-view.ts',
    'renderer/mod-presentation-assets.ts',
  ])

  const gameWebGl = source(`${rendererRoot}/game-webgl.ts`)
  const gameAssets = source(`${gameRoot}/game-assets.ts`)
  const sourcePolicy = source(`${rendererRoot}/game-texture-source-policy.ts`)
  const hubAtlasPacker = source(`${repoRoot}/tools/pack-hub-visual-atlas.py`)
  const playerAtlasPacker = source(`${repoRoot}/tools/pack-player-character-atlas.py`)
  const hubInventoryRenderer = source(`${rendererRoot}/hub-inventory-renderer.ts`)
  const titleRenderer = source(`${rendererRoot}/title-menu-renderer.ts`)
  const createRenderer = source(`${rendererRoot}/create-menu-renderer.ts`)
  const domBitmapText = source(`${gameRoot}/native-ui/NativeBitmapText.tsx`)
  const nativeUiPixi = source(`${gameRoot}/native-ui/native-ui-pixi.ts`)
  const quickbar = source(`${gameRoot}/SkillQuickbar.tsx`)
  assert.match(
    gameWebGl,
    /policy === 'stock-point'[\s\S]*?nativeStockPointTextureFromImage\(image\)[\s\S]*?policy === 'composited'[\s\S]*?nativeCompositedTextureFromImage\(image\)[\s\S]*?nativeStockTextureFromImage\(image\)/,
  )
  assert.match(sourcePolicy, /classified as both \$\{existing\} and \$\{policy\}/)
  assert.match(sourcePolicy, /add\('stock'[\s\S]*?add\('stock-point'[\s\S]*?add\('composited'/)
  for (const packer of [hubAtlasPacker, playerAtlasPacker]) {
    assert.match(packer, /rectangle\.x = shelf\.used_width \+ 1/)
    assert.match(packer, /rectangle\.x = 1/)
  }
  const textureLoadOwners = gameSources.filter((path) => (
    path !== `${rendererRoot}/game-webgl.ts`
    && /loadGameTexture(?:Map|Entries)\(/.test(source(path))
  ))
  assert.deepEqual(textureLoadOwners.map(relativeToGame).sort(), [
    'native-ui/native-ui-workbench.ts',
    'renderer/boneyard-textures.ts',
    'renderer/create-menu-renderer.ts',
    'renderer/gameplay-pause-renderer.ts',
    'renderer/hub-inventory-renderer.ts',
    'renderer/hub-textures.ts',
    'renderer/hud-skill-selector-renderer.ts',
    'renderer/loader-renderer.ts',
    'renderer/skill-book-renderer.ts',
    'renderer/skill-picker-renderer.ts',
    'renderer/title-menu-renderer.ts',
  ])
  for (const path of textureLoadOwners) {
    assert.match(source(path), /loadGameTexture(?:Map|Entries)\(\{/, relativeToGame(path))
    assert.doesNotMatch(
      source(path),
      /compositedSources|pointSources|loadGameTextureMap\(\[|loadGameTextureEntries\(sources/,
      relativeToGame(path),
    )
  }
  assert.match(gameAssets, /TITLE_STOCK_ASSET_SOURCES = \[[\s\S]*?NATIVE_UI_ATLAS_SOURCES\.Title/)
  assert.match(
    gameAssets,
    /TITLE_STOCK_POINT_ASSET_SOURCES = \[NATIVE_UI_ATLAS_SOURCES\.Fonts\]/,
  )
  assert.match(
    gameAssets,
    /CREATE_STOCK_POINT_ASSET_SOURCES = \[NATIVE_UI_ATLAS_SOURCES\.Fonts\]/,
  )
  assert.doesNotMatch(gameAssets, /menuSolomon/)
  assert.match(titleRenderer, /nativeUi\.slice\('Title', record, \[0, 0, 1, 1\]\)/)
  assert.doesNotMatch(titleRenderer, /menuSolomon/)
  assert.doesNotMatch(titleRenderer, /hub\.hud\.fontAtlas/)
  assert.match(createRenderer, /nativeUi\.texture\('Create', record\)/)
  assert.doesNotMatch(createRenderer, /createMenu\.hand(?:Cupped|Fist|Raised)/)
  assert.doesNotMatch(createRenderer, /hub\.hud\.fontAtlas/)
  assert.match(hubInventoryRenderer, /composited: PLAYER_CHARACTER_ATLAS_SOURCES/)
  assert.match(hubInventoryRenderer, /createBoneyardCombatAtlas\(texture\)/)
  assert.match(nativeUiPixi, /source = nativeStockPointTextureFromImage\(image\)/)
  assert.match(nativeUiPixi, /for \(const item of pointFilteredAtlases\.values\(\)\) item\.destroy\(true\)/)
  assert.match(domBitmapText, /imageRendering: 'pixelated'/)
  assert.match(quickbar, /imageRendering: 'pixelated'/)
  assert.match(
    source(`${rendererRoot}/native-fixed-function-render-pipeline.ts`),
    /NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS[\s\S]*?addressMode: 'clamp-to-edge'/,
  )
  for (const path of gameSources) {
    if (path === `${rendererRoot}/native-fixed-function-render-pipeline.ts`) continue
    assert.doesNotMatch(source(path), /clamp-to-edge/, relativeToGame(path))
  }
})

test('every stock render target preserves native unpremultiplied linear sampling', () => {
  const owners = sourceFiles(rendererRoot).filter((path) => (
    !isTestSource(path) && source(path).includes('RenderTexture.create(')
  ))
  assert.deepEqual(owners.map(relativeToGame).sort(), [
    'renderer/boneyard-region-light-field.ts',
    'renderer/native-secondary-world-view.ts',
  ])
  for (const path of owners) {
    const calls = [...source(path).matchAll(/RenderTexture\.create\(\{([\s\S]*?)\}\)/g)]
    assert.ok(calls.length > 0, relativeToGame(path))
    for (const call of calls) {
      assert.match(call[1]!, /alphaMode: 'no-premultiply-alpha'/, relativeToGame(path))
      assert.match(call[1]!, /scaleMode: 'linear'/, relativeToGame(path))
    }
  }
})

test('stock renderers expose only native normal, additive, and multiply selectors', () => {
  for (const path of sourceFiles(rendererRoot).filter((path) => !isTestSource(path))) {
    assert.doesNotMatch(
      source(path),
      /\.blendMode\s*=\s*['"](?:screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion)['"]/,
      relativeToGame(path),
    )
  }
})

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = `${root}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.isFile() && /\.tsx?$/.test(path) ? [path] : []
  })
}

function isTestSource(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

function relativeToGame(path: string): string {
  return path.slice(gameRoot.length + 1)
}
