import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  HUB_COURTYARD_DEPTH_PROP_FRAME,
  HUB_COURTYARD_DEPTH_PROPS,
  HUB_DIAGNOSTIC_WINDOW_FRAMES,
  HUB_WORLD_DEPTH,
  HUB_WORLD_LAYER_BOUNDS,
  HUB_STUDENT_VISIBILITY_HALF_EXTENT,
  hubWorldDepthForActor,
  hubStudentIntersectsView,
  hubStudentVisibilityDiagnosticsDue,
  initialHubResolution,
  spriteFrameIndex,
} from './hub-render-contract.ts'

const hubWorldScene = readFileSync(new URL('./hub-world-scene.ts', import.meta.url), 'utf8')
const hubWorldRenderer = readFileSync(new URL('./hub-world-renderer.ts', import.meta.url), 'utf8')
const hubActors = readFileSync(new URL('./hub-actors.ts', import.meta.url), 'utf8')
const hubPrivateRoomScene = readFileSync(
  new URL('./hub-private-room-scene.ts', import.meta.url),
  'utf8',
)
const hubTextures = readFileSync(new URL('./hub-textures.ts', import.meta.url), 'utf8')
const hubVisualAtlas = readFileSync(new URL('./hub-visual-atlas.ts', import.meta.url), 'utf8')
const hubVisualAtlasGenerated = readFileSync(
  new URL('./hub-visual-atlas.generated.ts', import.meta.url),
  'utf8',
)
const hubVisualAtlasPacker = readFileSync(
  new URL('../../../../tools/pack-hub-visual-atlas.py', import.meta.url),
  'utf8',
)
const gameAssets = readFileSync(new URL('../game-assets.ts', import.meta.url), 'utf8')

test('Hub-world visuals share three bounded exact-pixel pages', () => {
  assert.match(hubVisualAtlasGenerated, /HUB_VISUAL_ATLAS_DECODED_BYTES = 42229760/)
  assert.match(hubVisualAtlasGenerated, /HUB_VISUAL_ATLAS_SOURCE_COUNT = 87/)
  assert.match(hubVisualAtlasGenerated, /HUB_VISUAL_ATLAS_FRAME_COUNT = 578/)
  assert.match(hubVisualAtlasGenerated, /HUB_VISUAL_ATLAS_EMPTY_FRAME_COUNT = 0/)
  assert.match(hubVisualAtlasGenerated, /HUB_VISUAL_ATLAS_PACKED_RECTANGLE_COUNT = 572/)
  assert.match(
    hubVisualAtlasGenerated,
    /HUB_VISUAL_ATLAS_PAGE_DIMENSIONS = \[\[2048,2041\],\[2048,2046\],\[2048,1068\]\]/,
  )
  assert.match(
    hubVisualAtlasGenerated,
    /HUB_VISUAL_ATLAS_SOURCES = \[page0, page1, page2\]/,
  )
  for (const [page, width, height] of [
    [0, 2048, 2041],
    [1, 2048, 2046],
    [2, 2048, 1068],
  ] as const) {
    const png = readFileSync(new URL(
      `../../assets/game/hub-visual-atlas-${page}.png`,
      import.meta.url,
    ))
    assert.equal(png.readUInt32BE(16), width)
    assert.equal(png.readUInt32BE(20), height)
  }
  assert.match(hubVisualAtlasPacker, /EXPECTED_SOURCE_COUNT = 87/)
  assert.match(hubVisualAtlasPacker, /exact_pixel_bounds\(cell\)/)
  assert.match(hubVisualAtlasPacker, /actual\.paste\(crop, \(frame\.trim_x, frame\.trim_y\)\)/)
  assert.match(hubVisualAtlasPacker, /if actual\.tobytes\(\) != expected\.tobytes\(\):/)
  assert.match(hubVisualAtlasPacker, /if len\(pages\) != 3:/)
})

test('Hub renderer loads compact pages and releases derived frames before page owners', () => {
  assert.match(hubTextures, /\.\.\.HUB_VISUAL_ATLAS_SOURCES/)
  assert.match(hubTextures, /createHubVisualAtlas\(texture\)/)
  assert.match(hubTextures, /hubVisualAtlasSourceIsSingle\(source\)/)
  assert.doesNotMatch(hubTextures, /hubGameAssetSources/)
  assert.doesNotMatch(gameAssets, /function hubGameAssetSources/)
  assert.ok(
    hubTextures.indexOf('textures.visualAtlas.destroy()')
      < hubTextures.indexOf('for (const source of textures.assetSources)'),
  )
  assert.doesNotMatch(hubTextures, /Object\.values\(textures\.base\)/)
  assert.match(hubVisualAtlas, /orig: origin/)
  assert.match(hubVisualAtlas, /trim: new Rectangle\(trimX, trimY, width, height\)/)
  assert.match(hubVisualAtlas, /function packedSubframeTexture/)
  assert.match(hubVisualAtlas, /packedX \+ left - trimX/)
  assert.match(
    hubTextures,
    /requestedSources\.filter\(\(source\) => !boneyardCombatAtlasSourceIsPacked\(source\)\)/,
  )
  assert.match(hubTextures, /\.\.\.BONEYARD_COMBAT_ATLAS_SOURCES/)
  assert.match(hubTextures, /createBoneyardCombatAtlas\(texture\)/)
  assert.ok(
    hubTextures.indexOf('textures.combatAtlas.destroy()')
      < hubTextures.indexOf('for (const source of textures.assetSources)'),
  )
})

test('scripted Hub presentation locks rendered facing to visible travel', () => {
  assert.match(hubActors, /movementFacing && this\.positioned && \(dx \|\| dy\)/)
  assert.match(hubActors, /actorHeadingIndex\(actorHeadingFromVector\(dx, dy\)\)/)
  assert.match(hubWorldScene, /participant\.transition !== null \|\| participant\.collegeIntro !== null/)
  assert.match(
    hubPrivateRoomScene,
    /participant\.transition !== null \|\| participant\.collegeIntro !== null/,
  )
  assert.match(hubWorldRenderer, /playerHeadingIndex = playerView\.headingIndex/)
})

test('every Hub sheet and logical crop is owned by the compact atlas', () => {
  assert.match(hubPrivateRoomScene, /this\.textures\.visualAtlas\.strip\(/)
  assert.match(hubPrivateRoomScene, /this\.textures\.visualAtlas\.frame\(/)
  assert.doesNotMatch(hubPrivateRoomScene, /new Texture\(/)
  assert.match(hubWorldScene, /this\.textures\.visualAtlas\.frame\(/)
  assert.match(hubWorldScene, /this\.textures\.visualAtlas\.subframe\(/)
  assert.doesNotMatch(hubWorldScene, /new Texture\(/)
  assert.doesNotMatch(hubWorldScene, /layerFrameTextures/)
})

test('native painter boundaries sort actors around Courtyard props and tent faces', () => {
  assert.deepEqual(HUB_COURTYARD_DEPTH_PROP_FRAME, {
    height: 263, width: 508, x: 582, y: 0,
  })
  assert.deepEqual(HUB_COURTYARD_DEPTH_PROPS, [
    { actorY: 162.5, record: 23 },
    { actorY: 169, record: 24 },
    { actorY: 215, record: 20 },
    { actorY: 239.5, record: 25 },
  ])
  assert.ok(hubWorldDepthForActor(215) < hubWorldDepthForActor(243.011703))
  assert.ok(hubWorldDepthForActor(239.5) < hubWorldDepthForActor(243.011703))
  assert.ok(hubWorldDepthForActor(699) < HUB_WORLD_DEPTH.usefulThyngsFront)
  assert.ok(hubWorldDepthForActor(701) > HUB_WORLD_DEPTH.usefulThyngsFront)
  assert.ok(HUB_WORLD_DEPTH.usefulThyngsShadow < HUB_WORLD_DEPTH.courtyard + 1000)
})

test('Courtyard fountain transients keep the shared additive FadeScale painter', () => {
  assert.match(
    hubWorldScene,
    /new Sprite\(this\.textures\.base\[hub\.fountainParticle\]\)[\s\S]*?sprite\.blendMode = 'add'/,
  )
})

test('Teacher release keeps native 100 Hz child programs and per-child blend ownership', () => {
  assert.doesNotMatch(hubWorldScene, /this\.burst\.blendMode = 'screen'/)
  assert.match(hubWorldScene, /this\.frames\.blendMode = 'add'/)
  assert.match(hubWorldScene, /this\.column\.visible = burst\.column\.visible/)
  assert.match(hubWorldScene, /this\.core\.scale\.set\(burst\.core\.scaleX, burst\.core\.scaleY\)/)
  assert.match(hubWorldScene, /this\.frames\.scale\.set\(burst\.frames\.scaleX, burst\.frames\.scaleY\)/)
})

test('world overlays submit only their authored alpha bounds', () => {
  const fullArea = 2000 * 1024
  for (const [name, bounds] of Object.entries(HUB_WORLD_LAYER_BOUNDS)) {
    if (name === 'courtyardForeground') continue
    assert.ok(bounds.width * bounds.height < fullArea * 0.2)
  }
  assert.deepEqual(HUB_WORLD_LAYER_BOUNDS.sealCore, {
    x: 1889, y: 234, width: 111, height: 270,
  })
})

test('resolution follows displayed device pixels without a frame-rate quality fallback', () => {
  assert.equal(initialHubResolution({ devicePixelRatio: 1, displayScale: 1 }), 1)
  assert.equal(initialHubResolution({ devicePixelRatio: 3, displayScale: 0.5 }), 1.5)
  assert.equal(initialHubResolution({ devicePixelRatio: 1, displayScale: 0.3 }), 0.5)
  assert.equal(initialHubResolution({ devicePixelRatio: Number.NaN, displayScale: 1 }), 1)
})

test('sprite frame indices wrap in both directions', () => {
  assert.equal(spriteFrameIndex(5.9, 5), 0)
  assert.equal(spriteFrameIndex(-1, 5), 4)
  assert.equal(spriteFrameIndex(Number.NaN, 5), 0)
})

test('Student visibility instrumentation uses conservative actor bounds without culling art', () => {
  const camera = { x: 100, y: 200 }
  const view = { width: 800, height: 450 }
  assert.equal(HUB_STUDENT_VISIBILITY_HALF_EXTENT, 120)
  assert.equal(hubStudentIntersectsView({
    position: { x: -20, y: 300 },
    scale: 1,
  }, camera, view), true)
  assert.equal(hubStudentIntersectsView({
    position: { x: -21, y: 300 },
    scale: 1,
  }, camera, view), false)
  assert.equal(hubStudentIntersectsView({
    position: { x: 950, y: 300 },
    scale: 1.5,
  }, camera, view), true)
  assert.equal(hubStudentIntersectsView({
    position: { x: Number.NaN, y: 300 },
    scale: 1,
  }, camera, view), false)
})

test('Student visibility diagnostics retain their low-rate window but refresh on population edges', () => {
  assert.equal(HUB_DIAGNOSTIC_WINDOW_FRAMES, 120)
  assert.equal(hubStudentVisibilityDiagnosticsDue(1, 14, -1), true)
  assert.equal(hubStudentVisibilityDiagnosticsDue(2, 14, 14), false)
  assert.equal(hubStudentVisibilityDiagnosticsDue(119, 14, 14), false)
  assert.equal(hubStudentVisibilityDiagnosticsDue(120, 14, 14), true)
  assert.equal(hubStudentVisibilityDiagnosticsDue(121, 15, 14), true)
  assert.equal(hubStudentVisibilityDiagnosticsDue(122, 14, 15), true)
})
