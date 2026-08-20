import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  BONEYARD_CAMERA_ZOOM,
  BONEYARD_RENDER_HEIGHT,
  BONEYARD_RENDER_WIDTH,
  BONEYARD_RESIDENT_CULL_PADDING,
  INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE,
  NATIVE_PLAYER_DEATH_SORT_BIAS,
  boneyardCamera,
  boneyardCameraFocus,
  boneyardPlayerSortBias,
  boneyardResidentIsVisible,
  boneyardSpectatorCameraState,
  boneyardSpectatorStatus,
  boneyardStaticTiles,
  boneyardVisibleWorldBounds,
  boneyardWorldPosition,
  type BoneyardSpectatorCameraSnapshot,
  type BoneyardSpectatorCameraState,
} from './boneyard-render-contract.ts'
import {
  NATIVE_ENEMY_WORLD_FEEDBACK,
  NativeEnemyWorldFeedbackPresentation,
  nativeEnemyWorldFeedbackTransform,
} from './native-enemy-world-feedback.ts'
import {
  nativeDirectEnvironmentLightAlpha,
} from './boneyard-environment-light-plan.ts'

const boneyardRenderer = readFileSync(new URL('./boneyard-world-renderer.ts', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('../BoneyardScene.tsx', import.meta.url), 'utf8')
const boneyardStyles = readFileSync(new URL('../boneyard.css', import.meta.url), 'utf8')
const environmentLight = readFileSync(
  new URL('./boneyard-environment-light.ts', import.meta.url),
  'utf8',
)
const editorRenderer = readFileSync(new URL('../../editor/render.ts', import.meta.url), 'utf8')
const hubActors = readFileSync(new URL('./hub-actors.ts', import.meta.url), 'utf8')
const deathWeaponView = readFileSync(
  new URL('./player-death-weapon-view.ts', import.meta.url),
  'utf8',
)
const hubExtractor = readFileSync(
  new URL('../../../../tools/extract-hub-assets.py', import.meta.url),
  'utf8',
)
const deathHatAnchors = JSON.parse(readFileSync(
  new URL('../../assets/game/player-character-death-hat-anchors.json', import.meta.url),
  'utf8',
))

test('Gate record 7 uses the recovered four-corner consumer in game and editor', () => {
  assert.match(boneyardRenderer, /private readonly gateLeaf: MeshSimple/)
  assert.match(boneyardRenderer, /nativeGateArtVertices\(leaf, this\.gateVertices\)/)
  assert.doesNotMatch(boneyardRenderer, /this\.gateLeaf\.position\.set\(leaf\.p0/)
  assert.match(editorRenderer, /drawGateLeafArt\(ctx, FENCE_ART\.gateLeaf, leaf, cam, w, h\)/)
  assert.doesNotMatch(editorRenderer, /plantArt\(ctx, FENCE_ART\.gateLeaf, leaf\.p0/)
})

test('Tree foreground stays per-object and shares native alpha and root tint', () => {
  assert.match(editorRenderer, /export function nativeBoneyardForegroundLayers/)
  assert.match(editorRenderer, /export function drawNativeBoneyardForegroundBand/)
  assert.doesNotMatch(boneyardRenderer, /drawNativeBoneyardForeground\(context/)
  assert.match(boneyardRenderer, /tree\.main\.sprite\.alpha = presentation\.alpha/)
  assert.match(boneyardRenderer, /tree\.foreground\.sprite\.alpha = presentation\.alpha/)
  assert.match(boneyardRenderer, /tree\.main\.sprite\.tint = tint/)
  assert.match(boneyardRenderer, /tree\.foreground\.sprite\.tint = tint/)
})

test('Boneyard readiness includes the complete initial environment-lighting frame', () => {
  const initialEnvironmentLightPaint = boneyardScene.indexOf(
    'paintBoneyardEnvironmentLight(\n          environmentLight,\n          boneyardInitialSnapshot.players,',
  )
  const readyPublication = boneyardScene.indexOf("setRendererState('ready')")

  assert.ok(initialEnvironmentLightPaint >= 0, 'expected an initial environment-light paint')
  assert.ok(readyPublication >= 0, 'expected renderer readiness publication')
  assert.ok(
    initialEnvironmentLightPaint < readyPublication,
    'environment light must paint before the Boneyard becomes ready',
  )
  assert.match(boneyardScene, /loadGameImage/)
  assert.doesNotMatch(boneyardScene, /spriteImage/)
  assert.match(boneyardScene, /const rendererPromise = createBoneyardWorldRenderer/)
  assert.match(
    boneyardScene,
    /\.catch\(\(error: unknown\) => \{[\s\S]*?rendererPromise\.then[\s\S]*?renderer\.destroy\(\)/,
  )
})

test('mode one and two add bounded player light without masking later Region sources', () => {
  assert.match(boneyardScene, /className="boneyard-environment-light"/)
  assert.match(boneyardScene, /data-composite="plus-lighter"/)
  assert.match(environmentLight, /globalCompositeOperation = 'lighter'/)
  assert.doesNotMatch(environmentLight, /globalCompositeOperation = 'source-out'/)
  assert.doesNotMatch(environmentLight, /fillRect\(0, 0, viewport\.width, viewport\.height\)/)
  assert.doesNotMatch(environmentLight, /images\.radial/)
  assert.match(
    boneyardStyles,
    /\.boneyard-environment-light \{[\s\S]*?mix-blend-mode: plus-lighter;/,
  )
})

test('environment player-light plan keeps the recovered direct alpha lane', () => {
  for (let frame = 0; frame < 360; frame += 1) {
    const direct = nativeDirectEnvironmentLightAlpha(frame, frame % 4)
    assert.ok(direct >= 0.2375 && direct <= 0.25)
  }
})

test('Boneyard camera keeps the native zoom and clamps to the arena bounds', () => {
  const bounds = { x: -200, y: 100, w: 3200, h: 2400 }

  assert.deepEqual(boneyardCamera({ x: 1200, y: 900 }, bounds), {
    x: 1200,
    y: 900,
    zoom: BONEYARD_CAMERA_ZOOM,
  })
  assert.deepEqual(boneyardCamera({ x: -999, y: -999 }, bounds), {
    x: bounds.x + BONEYARD_RENDER_WIDTH / 2 / BONEYARD_CAMERA_ZOOM,
    y: bounds.y + BONEYARD_RENDER_HEIGHT / 2 / BONEYARD_CAMERA_ZOOM,
    zoom: BONEYARD_CAMERA_ZOOM,
  })
})

test('Boneyard camera clamp and centering follow the logical browser viewport', () => {
  const bounds = { x: -200, y: 100, w: 3200, h: 2400 }
  const viewport = { width: 1947.6923076923076, height: 900 }
  const camera = boneyardCamera({ x: -999, y: -999 }, bounds, viewport)

  assert.deepEqual(camera, {
    x: bounds.x + viewport.width / 2 / BONEYARD_CAMERA_ZOOM,
    y: bounds.y + viewport.height / 2 / BONEYARD_CAMERA_ZOOM,
    zoom: BONEYARD_CAMERA_ZOOM,
  })
  assert.deepEqual(boneyardWorldPosition(camera, viewport), {
    x: viewport.width / 2 - camera.x * camera.zoom,
    y: viewport.height / 2 - camera.y * camera.zoom,
  })
})

test('enemy terminal output drives the exact native feedback accumulator and decay', () => {
  const feedback = new NativeEnemyWorldFeedbackPresentation(0)
  assert.deepEqual(feedback.sample(1), {
    accumulator: Math.fround(NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorFloor),
    lastTick: 1,
    magnitude: 0,
  })

  const skeleton = {
    actorId: 7,
    eventId: 1,
    output: 'skeleton-shatter' as const,
    runId: 'run-1',
    tick: 1,
    type: 'enemy-terminal-output' as const,
  }
  assert.equal(feedback.consume(skeleton), true)
  assert.deepEqual(feedback.sample(1), {
    accumulator: Math.fround(0.1 + 0.20000000298023224),
    lastTick: 1,
    magnitude: Math.fround(0.1 * 0.1),
  })
  assert.equal(feedback.consume(skeleton), false)

  const tickTwo = feedback.sample(2)
  assert.equal(tickTwo.accumulator, Math.fround(
    Math.fround(0.1 + 0.20000000298023224) - 0.0025,
  ))
  assert.equal(tickTwo.magnitude, Math.fround(Math.fround(0.1 * 0.1) * 0.94))
  assert.equal(feedback.consume({
    ...skeleton,
    actorId: 8,
    eventId: 2,
    output: 'coffin-break',
    tick: 2,
  }), true)
  assert.equal(feedback.sample(2).magnitude, Math.fround(tickTwo.accumulator * 0.2))
  assert.equal(feedback.sample(1_000).magnitude, 0)
})

test('enemy feedback scales the world around the local Player without moving its screen point', () => {
  const camera = { x: 1_000, y: 700, zoom: BONEYARD_CAMERA_ZOOM }
  const viewport = { height: 900, width: 1_600 }
  const localPlayer = { x: 1_100, y: 760 }
  const basePosition = boneyardWorldPosition(camera, viewport)
  const baseScreen = {
    x: basePosition.x + localPlayer.x * camera.zoom,
    y: basePosition.y + localPlayer.y * camera.zoom,
  }
  const transform = nativeEnemyWorldFeedbackTransform(
    camera,
    viewport,
    localPlayer,
    0.03,
  )

  assert.equal(transform.scale, camera.zoom * 1.03)
  assert.deepEqual({
    x: transform.position.x + localPlayer.x * transform.scale,
    y: transform.position.y + localPlayer.y * transform.scale,
  }, baseScreen)
})

test('Boneyard renderer consumes terminal feedback once and applies it after semantic camera placement', () => {
  assert.match(boneyardRenderer, /worldFeedback\.consume\(event\)/)
  assert.match(boneyardRenderer, /worldFeedback\.sample\(snapshot\.tick\)/)
  assert.match(boneyardRenderer, /nativeEnemyWorldFeedbackTransform\(/)
  assert.match(boneyardRenderer, /worldFeedbackMagnitude/)
  assert.match(boneyardRenderer, /enemyDeathEffectSamples/)
  assert.match(boneyardRenderer, /hitFlash: enemy\.animation\.hitFlash/)
})

test('spectator follow starts after local death presentation and uses the first semantic ID', () => {
  const dying = spectatorSnapshot({
    alpha: spectatorPlayer('Alpha', 'alive', 420, 430),
    local: spectatorPlayer('Local', 'dying', 120, 130),
    zeta: spectatorPlayer('Zeta', 'alive', 620, 630),
  }, ['zeta', 'local', 'alpha'])
  const inactive = boneyardSpectatorCameraState(
    dying,
    'local',
    INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE,
  )

  assert.deepEqual(inactive, { runId: 'run-1', targetPlayerId: null })
  assert.deepEqual(
    boneyardCameraFocus(dying, 'local', inactive, { x: 0, y: 0 }),
    { playerId: 'local', position: { x: 120, y: 130 } },
  )
  assert.equal(boneyardSpectatorStatus(dying, 'local', inactive), null)

  const spectating = withLifeState(dying, 'local', 'spectating')
  const following = boneyardSpectatorCameraState(spectating, 'local', inactive)
  assert.deepEqual(following, { runId: 'run-1', targetPlayerId: 'alpha' })
  assert.deepEqual(
    boneyardCameraFocus(spectating, 'local', following, { x: 0, y: 0 }),
    { playerId: 'alpha', position: { x: 420, y: 430 } },
  )
  assert.deepEqual(boneyardSpectatorStatus(spectating, 'local', following), {
    accessibleLabel: 'Spectating Alpha. Left or right click to select the next player.',
    instruction: 'Left / Right click: next player',
    runId: 'run-1',
    targetPlayerId: 'alpha',
    title: 'Spectating Alpha',
  })
})

test('selected spectator target stays through lethal and dying presentation before retarget', () => {
  let snapshot = spectatorSnapshot({
    alpha: spectatorPlayer('Alpha', 'alive', 420, 430),
    local: spectatorPlayer('Local', 'spectating', 120, 130),
    zeta: spectatorPlayer('Zeta', 'alive', 620, 630),
  }, ['alpha', 'local', 'zeta'])
  let state: BoneyardSpectatorCameraState = {
    runId: 'run-1',
    targetPlayerId: 'zeta',
  }

  snapshot = withLifeState(snapshot, 'zeta', 'lethal-pending')
  state = boneyardSpectatorCameraState(snapshot, 'local', state)
  assert.equal(state.targetPlayerId, 'zeta')

  snapshot = withLifeState(snapshot, 'zeta', 'dying')
  state = boneyardSpectatorCameraState(snapshot, 'local', state)
  assert.equal(state.targetPlayerId, 'zeta')
  assert.deepEqual(
    boneyardCameraFocus(snapshot, 'local', state, { x: 0, y: 0 }).position,
    { x: 620, y: 630 },
  )

  state = boneyardSpectatorCameraState(snapshot, 'local', state, true)
  assert.equal(state.targetPlayerId, 'alpha')

  state = { runId: 'run-1', targetPlayerId: 'zeta' }
  snapshot = withLifeState(snapshot, 'zeta', 'spectating')
  assert.equal(
    boneyardSpectatorCameraState(snapshot, 'local', state).targetPlayerId,
    'alpha',
  )
})

test('spectator cycling wraps living peers and lifecycle barriers clear camera and status', () => {
  const active = spectatorSnapshot({
    alpha: spectatorPlayer('Alpha', 'alive', 420, 430),
    bravo: spectatorPlayer('Bravo', 'alive', 520, 530),
    local: spectatorPlayer('Local', 'spectating', 120, 130),
  }, ['bravo', 'local', 'alpha'])
  let state = boneyardSpectatorCameraState(
    active,
    'local',
    INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE,
  )
  assert.equal(state.targetPlayerId, 'alpha')
  state = boneyardSpectatorCameraState(active, 'local', state, true)
  assert.equal(state.targetPlayerId, 'bravo')
  state = boneyardSpectatorCameraState(active, 'local', state, true)
  assert.equal(state.targetPlayerId, 'alpha')

  const gameOver = {
    ...active,
    run: { ...active.run, phase: 'game-over' as const },
  }
  state = boneyardSpectatorCameraState(gameOver, 'local', state)
  assert.deepEqual(state, { runId: 'run-1', targetPlayerId: null })
  assert.equal(boneyardSpectatorStatus(gameOver, 'local', state), null)

  const nextRun = {
    ...withLifeState(active, 'local', 'alive'),
    run: { ...active.run, runId: 'run-2' },
  }
  state = boneyardSpectatorCameraState(nextRun, 'local', state)
  assert.deepEqual(state, { runId: 'run-2', targetPlayerId: null })

  const waiting = spectatorSnapshot({
    local: spectatorPlayer('Local', 'spectating', 120, 130),
  }, ['local'])
  state = boneyardSpectatorCameraState(waiting, 'local', state)
  assert.deepEqual(boneyardSpectatorStatus(waiting, 'local', state), {
    accessibleLabel: 'Spectating - waiting for an alive player.',
    instruction: null,
    runId: 'run-1',
    targetPlayerId: null,
    title: 'Spectating - waiting for an alive player',
  })
})

test('spectator status is an atomic accessible product surface', () => {
  assert.match(boneyardRenderer, /boneyardSpectatorCameraState/)
  assert.match(boneyardRenderer, /boneyardCameraFocus/)
  assert.match(boneyardScene, /className="boneyard-spectator-status"/)
  assert.match(boneyardScene, /role="status"/)
  assert.match(boneyardScene, /aria-live="polite"/)
  assert.match(boneyardScene, /aria-label=\{spectatorStatus\.accessibleLabel\}/)
})

test('native death tick 159 moves the corpse to the recovered back render bias', () => {
  const player = (lifeState: 'alive' | 'lethal-pending' | 'dying' | 'spectating', deathTick: number) => ({
    progression: { deathTick, lifeState },
  })

  assert.equal(boneyardPlayerSortBias(player('alive', 159)), 0)
  assert.equal(boneyardPlayerSortBias(player('lethal-pending', 159)), 0)
  assert.equal(boneyardPlayerSortBias(player('dying', 158)), 0)
  assert.equal(
    boneyardPlayerSortBias(player('dying', 159)),
    NATIVE_PLAYER_DEATH_SORT_BIAS,
  )
  assert.equal(
    boneyardPlayerSortBias(player('spectating', 500)),
    NATIVE_PLAYER_DEATH_SORT_BIAS,
  )
})

test('player corpse restores every item-owned layer, hat branch, and terminal shadow pass', () => {
  assert.match(hubExtractor, /PLAYER_DEATH_ROBE_PRIMARY_BASES = \(76, 100, 124\)/)
  assert.match(hubExtractor, /PLAYER_DEATH_ROBE_SECONDARY_BASES = \(148, 172, 196\)/)
  assert.match(hubExtractor, /"primary-a": 220/)
  assert.match(hubExtractor, /"secondary-b": 292/)
  assert.match(hubExtractor, /PLAYER_DEATH_HAT_PRIMARY_BASES = \(316, 340, 364, 388\)/)
  assert.match(hubExtractor, /PLAYER_DEATH_HAT_SECONDARY_BASES = \(412, 412, 412, 436\)/)
  assert.doesNotMatch(hubExtractor, /build_player_death_attachment_sheet/)

  assert.equal(deathHatAnchors.schema, 'solomon-dark-player-death-hat-anchors-v1')
  assert.deepEqual(deathHatAnchors.offsets.map((frame: unknown[]) => frame.length), [6, 6, 6, 6])
  assert.deepEqual(deathHatAnchors.offsets[0][0], [0.5, -3.5])
  assert.deepEqual(deathHatAnchors.offsets[3][3], [-0.5, 70.5])

  assert.match(hubActors, /const PLAYER_DEATH_LAYER_COUNT = 9/)
  assert.match(hubActors, /appearance\.hat\.selector === 3 && frame === 3/)
  assert.match(hubActors, /playerDeathHatAnchor\(frame, facing\)/)
  assert.match(hubActors, /shadow\.position\.set\(x, y \+ 4\)/)
  assert.match(hubActors, /this\.deathShadowLayers\[index\]!\.tint = 0x000000/)
})

test('held staff or wand is an independent death-epoch bouncer and painter layer', () => {
  assert.match(boneyardRenderer, /private readonly playerDeathWeapons: PlayerDeathWeaponViews/)
  assert.match(boneyardRenderer, /this\.playerDeathWeapons\.update\(snapshot\)/)
  assert.match(deathWeaponView, /id: `player-death-weapon:\$\{playerId\}`/)
  assert.match(deathWeaponView, /this\.origin = \{ \.\.\.player\.position \}/)
  assert.match(deathWeaponView, /this\.shadow\.position\.set\(0, 2\)/)
  assert.match(boneyardRenderer, /this\.playerDeathWeapons\.setDepth/)
})

test('static Boneyard tiles cover art overhang without exceeding the GPU tile size', () => {
  const bounds = { x: 17, y: -31, w: 3420, h: 3956 }
  const tiles = boneyardStaticTiles(bounds)

  assert.ok(tiles.length > 1)
  assert.ok(tiles.every((tile) => tile.w > 0 && tile.w <= 1024))
  assert.ok(tiles.every((tile) => tile.h > 0 && tile.h <= 1024))
  assert.equal(Math.min(...tiles.map((tile) => tile.x)), bounds.x - 256)
  assert.equal(Math.min(...tiles.map((tile) => tile.y)), bounds.y - 256)
  assert.equal(Math.max(...tiles.map((tile) => tile.x + tile.w)), bounds.x + bounds.w + 256)
  assert.equal(Math.max(...tiles.map((tile) => tile.y + tile.h)), bounds.y + bounds.h + 256)
})

test('world transform presents the clamped camera in the native 1600 by 900 frame', () => {
  const camera = { x: 1250, y: 860, zoom: BONEYARD_CAMERA_ZOOM }

  assert.deepEqual(boneyardWorldPosition(camera), {
    x: BONEYARD_RENDER_WIDTH / 2 - camera.x * camera.zoom,
    y: BONEYARD_RENDER_HEIGHT / 2 - camera.y * camera.zoom,
  })
})

test('resident visibility uses the complete oversized art rectangle', () => {
  const view = { x: 0, y: 0, w: 1000, h: 600 }

  assert.equal(boneyardResidentIsVisible({ x: -4000, y: 100, w: 4050, h: 200 }, view), true)
  assert.equal(boneyardResidentIsVisible({ x: 400, y: -3000, w: 200, h: 3050 }, view), true)
  assert.equal(boneyardResidentIsVisible({ x: -4000, y: 601, w: 5000, h: 200 }, view), false)
})

test('resident visibility keeps exact camera-edge contact renderable', () => {
  const view = { x: 100, y: 200, w: 800, h: 450 }

  assert.equal(boneyardResidentIsVisible({ x: -100, y: 300, w: 200, h: 80 }, view), true)
  assert.equal(boneyardResidentIsVisible({ x: 900, y: 300, w: 200, h: 80 }, view), true)
  assert.equal(boneyardResidentIsVisible({ x: 300, y: 120, w: 80, h: 80 }, view), true)
  assert.equal(boneyardResidentIsVisible({ x: 300, y: 650, w: 80, h: 80 }, view), true)
  assert.equal(boneyardResidentIsVisible({ x: -100.001, y: 300, w: 200, h: 80 }, view), false)
})

test('visible world bounds include a conservative guard band at responsive sizes', () => {
  const camera = { x: 1200, y: 900, zoom: BONEYARD_CAMERA_ZOOM }
  const viewport = { width: 1947.6923076923076, height: 900 }
  const bounds = boneyardVisibleWorldBounds(camera, viewport)
  const worldWidth = viewport.width / camera.zoom
  const worldHeight = viewport.height / camera.zoom

  assert.deepEqual(bounds, {
    x: camera.x - worldWidth / 2 - BONEYARD_RESIDENT_CULL_PADDING,
    y: camera.y - worldHeight / 2 - BONEYARD_RESIDENT_CULL_PADDING,
    w: worldWidth + BONEYARD_RESIDENT_CULL_PADDING * 2,
    h: worldHeight + BONEYARD_RESIDENT_CULL_PADDING * 2,
  })
  assert.equal(boneyardResidentIsVisible({
    x: bounds.x - 300,
    y: camera.y,
    w: 300,
    h: 1,
  }, bounds), true)
  assert.equal(boneyardResidentIsVisible({
    x: bounds.x - 300.001,
    y: camera.y,
    w: 300,
    h: 1,
  }, bounds), false)
})

function spectatorPlayer(
  displayName: string,
  lifeState: 'alive' | 'lethal-pending' | 'dying' | 'spectating',
  x: number,
  y: number,
): BoneyardSpectatorCameraSnapshot['players'][string] {
  return {
    config: { displayName },
    position: { x, y },
    progression: { lifeState },
  }
}

function spectatorSnapshot(
  players: BoneyardSpectatorCameraSnapshot['players'],
  eligiblePlayerIds: readonly string[],
): BoneyardSpectatorCameraSnapshot {
  return {
    players,
    run: {
      eligiblePlayerIds,
      phase: 'active',
      runId: 'run-1',
    },
  }
}

function withLifeState(
  snapshot: BoneyardSpectatorCameraSnapshot,
  playerId: string,
  lifeState: 'alive' | 'lethal-pending' | 'dying' | 'spectating',
): BoneyardSpectatorCameraSnapshot {
  const player = snapshot.players[playerId]
  assert.ok(player)
  return {
    ...snapshot,
    players: {
      ...snapshot.players,
      [playerId]: {
        ...player,
        progression: { lifeState },
      },
    },
  }
}
