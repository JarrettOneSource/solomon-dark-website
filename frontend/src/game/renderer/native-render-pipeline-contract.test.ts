import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const gameRoot = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const rendererRoot = fileURLToPath(new URL('./', import.meta.url)).replace(/\/$/, '')

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
})

test('all stock image pages use the shared unpremultiplied wrap sampling policies', () => {
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
  const boneyardTextures = source(`${rendererRoot}/boneyard-textures.ts`)
  const domBitmapText = source(`${gameRoot}/native-ui/NativeBitmapText.tsx`)
  const nativeUiPixi = source(`${gameRoot}/native-ui/native-ui-pixi.ts`)
  const quickbar = source(`${gameRoot}/SkillQuickbar.tsx`)
  assert.match(
    gameWebGl,
    /source === hub\.hud\.fontAtlas[\s\S]*?nativeStockPointTextureFromImage\(image\)[\s\S]*?: nativeStockTextureFromImage\(image\)/,
  )
  assert.match(boneyardTextures, /loadGameTextureEntries\(sources\)/)
  assert.match(nativeUiPixi, /source = nativeStockPointTextureFromImage\(image\)/)
  assert.match(nativeUiPixi, /for \(const item of pointFilteredAtlases\.values\(\)\) item\.destroy\(true\)/)
  assert.match(domBitmapText, /imageRendering: 'pixelated'/)
  assert.match(quickbar, /imageRendering: 'pixelated'/)
  for (const path of gameSources) {
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
