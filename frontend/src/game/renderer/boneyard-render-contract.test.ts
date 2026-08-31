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
  boneyardSpectatorStatusesEqual,
  boneyardStaticTiles,
  boneyardVisibleWorldBounds,
  boneyardWorldPosition,
  type BoneyardSpectatorCameraSnapshot,
  type BoneyardSpectatorCameraState,
  type BoneyardSpectatorStatusSnapshot,
} from './boneyard-render-contract.ts'
import {
  NATIVE_ENEMY_WORLD_FEEDBACK,
  NativeEnemyWorldFeedbackPresentation,
  nativeEnemyWorldFeedbackTransform,
} from './native-enemy-world-feedback.ts'
import {
  WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE,
  nativeDirectEnvironmentLightAlpha,
} from './boneyard-environment-light-plan.ts'
import {
  NATIVE_SPECTATOR_HUD_CONTRACT,
  nativeSpectatorHudLayout,
} from '../native-spectator-hud.ts'
import {
  boneyardCleanupBoundsOverlap,
  boneyardOffCameraCleanupPlan,
} from './boneyard-off-camera-cleanup.ts'

const deathHatAnchors = JSON.parse(readFileSync(
  new URL('../../assets/game/player-character-death-hat-anchors.json', import.meta.url),
  'utf8',
))

test('environment player-light plan applies the requested web brightness scale', () => {
  assert.equal(WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE, 0.14)
  for (let frame = 0; frame < 360; frame += 1) {
    const direct = nativeDirectEnvironmentLightAlpha(frame, frame % 4)
    assert.ok(direct >= 0.03325 && direct <= 0.035)
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

test('Boneyard FOV zoom is shared by clamp and world projection', () => {
  const bounds = { h: 2000, w: 2400, x: 0, y: 0 }
  const viewport = { width: 1600, height: 900 }
  const camera = boneyardCamera({ x: 1200, y: 1000 }, bounds, viewport, 1.08)
  assert.deepEqual(camera, { x: 1200, y: 1000, zoom: 1.08 })
  assert.deepEqual(boneyardWorldPosition(camera, viewport), {
    x: 800 - 1200 * 1.08,
    y: 450 - 1000 * 1.08,
  })
  const edge = boneyardCamera({ x: 0, y: 0 }, bounds, viewport, 1.8)
  assert.deepEqual(edge, {
    x: 1600 / 2 / 1.8,
    y: 900 / 2 / 1.8,
    zoom: 1.8,
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

test('late join seeds authoritative feedback without replaying retained terminal events', () => {
  const feedback = new NativeEnemyWorldFeedbackPresentation(
    50,
    { accumulator: 0.7, magnitude: 0.12 },
    9,
  )
  assert.deepEqual(feedback.sample(50), {
    accumulator: 0.7,
    lastTick: 50,
    magnitude: 0.12,
  })
  const event = {
    actorId: 7,
    eventId: 9,
    output: 'zombie-collapse' as const,
    runId: 'run-1',
    tick: 50,
    type: 'enemy-terminal-output' as const,
  }
  assert.equal(feedback.consume(event), false)
  assert.equal(feedback.consume({ ...event, eventId: 10 }), true)
  assert.deepEqual(feedback.sample(50), {
    accumulator: Math.fround(0.7 + NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorImpulse),
    lastTick: 50,
    magnitude: Math.fround(0.7 * NATIVE_ENEMY_WORLD_FEEDBACK.zombieIntensity),
  })
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
    accessibleLabel: 'Spectating Alpha. Left or right click to select the next player. Respawn at the next wave. Wave 7 has 3 active enemies and 4 incoming enemies.',
    activeEnemyCount: 3,
    displayText: 'Spectating Alpha  |  Left / Right click: next player',
    incomingEnemyCount: 4,
    instruction: 'Left / Right click: next player',
    respawnText: 'RESPAWN NEXT WAVE  |  WAVE 7  |  3 ACTIVE + 4 INCOMING',
    runId: 'run-1',
    targetPlayerId: 'alpha',
    title: 'Spectating Alpha',
    waveOrdinal: 7,
    wavePhase: 'spawning',
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
    accessibleLabel: 'Spectating - waiting for an alive player. Respawn at the next wave. Wave 7 has 3 active enemies and 4 incoming enemies.',
    activeEnemyCount: 3,
    displayText: 'Spectating - waiting for an alive player',
    incomingEnemyCount: 4,
    instruction: null,
    respawnText: 'RESPAWN NEXT WAVE  |  WAVE 7  |  3 ACTIVE + 4 INCOMING',
    runId: 'run-1',
    targetPlayerId: null,
    title: 'Spectating - waiting for an alive player',
    waveOrdinal: 7,
    wavePhase: 'spawning',
  })
})

test('spectator respawn progress uses active actors, Maggots, and scheduled spawns', () => {
  const state: BoneyardSpectatorCameraState = {
    runId: 'run-1',
    targetPlayerId: 'alpha',
  }
  const opening = spectatorSnapshot({
    alpha: spectatorPlayer('Alpha', 'alive', 420, 430),
    local: spectatorPlayer('Local', 'spectating', 120, 130),
  }, ['alpha', 'local'], {
    activeEnemies: 0,
    incomingEnemies: 1,
    maggots: 0,
    waveOrdinal: 0,
  })
  const openingStatus = boneyardSpectatorStatus(opening, 'local', state)
  assert.equal(
    openingStatus?.respawnText,
    'RESPAWN NEXT WAVE  |  OPENING  |  0 ACTIVE + 1 INCOMING',
  )
  assert.equal(openingStatus?.waveOrdinal, 0)

  const active = spectatorSnapshot({
    alpha: spectatorPlayer('Alpha', 'alive', 420, 430),
    local: spectatorPlayer('Local', 'spectating', 120, 130),
  }, ['alpha', 'local'], {
    activeEnemies: 2,
    incomingEnemies: 0,
    maggots: 1,
    waveOrdinal: 8,
  })
  const activeStatus = boneyardSpectatorStatus(active, 'local', state)
  assert.equal(activeStatus?.activeEnemyCount, 3)
  assert.equal(activeStatus?.incomingEnemyCount, 0)
  assert.equal(
    activeStatus?.respawnText,
    'RESPAWN NEXT WAVE  |  WAVE 8  |  3 ACTIVE + 0 INCOMING',
  )
  assert.equal(boneyardSpectatorStatusesEqual(openingStatus, activeStatus), false)

  const noWave = spectatorSnapshot({
    alpha: spectatorPlayer('Alpha', 'alive', 420, 430),
    local: spectatorPlayer('Local', 'spectating', 120, 130),
  }, ['alpha', 'local'], {
    activeEnemies: 1,
    maggots: 0,
    waves: false,
  })
  const noWaveStatus = boneyardSpectatorStatus(noWave, 'local', state)
  assert.equal(noWaveStatus?.waveOrdinal, null)
  assert.equal(noWaveStatus?.wavePhase, null)
  assert.equal(
    noWaveStatus?.respawnText,
    'RESPAWN: WAITING FOR NEXT WAVE  |  1 ACTIVE',
  )
})


test('spectator status uses the MP product panel, font, tint, and normalized geometry', () => {
  assert.deepEqual(
    NATIVE_SPECTATOR_HUD_CONTRACT.panelRecords,
    [10, 79, 107, 108, 109, 110],
  )
  assert.equal(NATIVE_SPECTATOR_HUD_CONTRACT.font, 'medium')
  assert.equal(NATIVE_SPECTATOR_HUD_CONTRACT.tint, 0xffe68c)
  assert.equal(NATIVE_SPECTATOR_HUD_CONTRACT.respawnPanelGap, 8)
  assert.deepEqual(NATIVE_SPECTATOR_HUD_CONTRACT.textOffset, { x: 18, y: 20 })

  const layout = nativeSpectatorHudLayout({ height: 900, width: 1_600 })
  assert.deepEqual(layout.surface, {
    height: 67.5,
    width: 960,
    x: 320,
    y: 49.5,
  })
  assert.deepEqual(layout.horizontalRails.map(({ record, width, x, y }) => ({
    record,
    width,
    x,
    y,
  })), [
    { record: 10, width: 940, x: 10, y: -2 },
    { record: 10, width: 940, x: 10, y: 52.5 },
  ])
  assert.deepEqual(layout.verticalRails.map(({ height, record, x, y }) => ({
    height,
    record,
    x,
    y,
  })), [
    { height: 47.5, record: 79, x: 0, y: 10 },
    { height: 47.5, record: 79, x: 943, y: 10 },
  ])
  assert.deepEqual(layout.corners.map(({ record }) => record), [107, 108, 109, 110])

  const wide = nativeSpectatorHudLayout({ height: 1_080, width: 1_920 })
  assert.equal(wide.surface.height, 81)
  assert.equal(wide.surface.width, 1_152)
  assert.equal(wide.surface.x, 384)
  assert.ok(Math.abs(wide.surface.y - 59.4) < 1e-10)
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

test('player death hat anchors retain every native facing', () => {
  assert.deepEqual(deathHatAnchors.offsets.map((frame: unknown[]) => frame.length), [6, 6, 6, 6])
  assert.deepEqual(deathHatAnchors.offsets[0][0], [0.5, -3.5])
  assert.deepEqual(deathHatAnchors.offsets[3][3], [-0.5, 70.5])
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

test('off-camera cleanup uses strict visual overlap and never retires Fence records', () => {
  const target = { x: 0, y: 0, w: 100, h: 100 }
  assert.equal(boneyardCleanupBoundsOverlap(
    { x: 10, y: 100, w: 20, h: 30 },
    target,
  ), false, 'edge-only contact is outside in native action 1066')
  assert.equal(boneyardCleanupBoundsOverlap(
    { x: 10, y: 99.999, w: 20, h: 30 },
    target,
  ), true)

  const plan = boneyardOffCameraCleanupPlan({
    bounds: { x: 0, y: 0, w: 500, h: 500 },
    environmentMode: 0,
    fences: [{
      eid: 'outside-gate',
      points: [{ x: 20, y: 300 }, { x: 80, y: 300 }],
      segmentCode: 2,
      typeId: 3005,
    }],
    name: 'Cleanup membership fixture',
    objects: [
      { eid: 'overlap-tree', pos: { x: 50, y: 120 }, typeId: 2001, variant: 0 },
      { eid: 'far-tree', pos: { x: 50, y: 500 }, typeId: 2001, variant: 0 },
    ],
    roads: [
      {
        eid: 'crossing-road',
        linkMask: 0,
        points: [{ x: -10, y: 110 }, { x: 110, y: 110 }],
        quad: [
          { x: -10, y: 90 }, { x: 110, y: 90 },
          { x: -10, y: 130 }, { x: 110, y: 130 },
        ],
        typeId: 3004,
      },
      {
        eid: 'edge-road',
        linkMask: 0,
        points: [{ x: 10, y: 110 }, { x: 90, y: 110 }],
        quad: [
          { x: 10, y: 100 }, { x: 90, y: 100 },
          { x: 10, y: 120 }, { x: 90, y: 120 },
        ],
        typeId: 3004,
      },
    ],
    solomonDig: null,
    spawn: { facingDeg: 0, x: 50, y: 450 },
    sprites: [
      { atlasEntry: 7, eid: 'overlap-decor', flags: 0, pos: { x: 50, y: 120 }, s0: 0, s1: 1, s2: 1 },
      { atlasEntry: 7, eid: 'far-decor', flags: 0, pos: { x: 50, y: 400 }, s0: 0, s1: 1, s2: 1 },
    ],
    terrain: [
      { eid: 'crossing-river', points: [{ x: 30, y: 90 }, { x: 30, y: 130 }], pos: { x: 30, y: 110 }, style: 0 },
      { eid: 'far-river', points: [{ x: 30, y: 200 }, { x: 30, y: 240 }], pos: { x: 30, y: 220 }, style: 0 },
    ],
  }, target, new Map([
    ['object:overlap-tree', { x: -40, y: -130, w: 180, h: 270 }],
    ['object:far-tree', { x: -40, y: 250, w: 180, h: 270 }],
    ['sprite:overlap-decor', { x: 5, y: 75, w: 90, h: 90 }],
    ['sprite:far-decor', { x: 5, y: 355, w: 90, h: 90 }],
  ]))

  assert.deepEqual([...plan.retiredSourceKeys].sort(), [
    'object:far-tree',
    'road:edge-road',
    'sprite:far-decor',
    'terrain:far-river',
  ])
  assert.equal(plan.retiredSourceKeys.has('fence:outside-gate'), false)
  assert.deepEqual(plan.retainedCounts, {
    objects: 1,
    roads: 1,
    sprites: 1,
    terrain: 1,
  })
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
  progress: Readonly<{
    activeEnemies?: number
    incomingEnemies?: number
    maggots?: number
    waveOrdinal?: number
    waves?: boolean
  }> = {},
): BoneyardSpectatorStatusSnapshot {
  const activeEnemies = progress.activeEnemies ?? 2
  const incomingEnemies = progress.incomingEnemies ?? 4
  const maggots = progress.maggots ?? 1
  const waveOrdinal = progress.waveOrdinal ?? 7
  return {
    players,
    run: {
      eligiblePlayerIds,
      phase: 'active',
      runId: 'run-1',
    },
    world: {
      enemies: Array.from({ length: activeEnemies }, () => ({})),
      kind: 'boneyard',
      maggots: Array.from({ length: maggots }, () => ({})),
      waves: progress.waves === false ? null : {
        pendingSpawnBudget: incomingEnemies,
        phase: 'spawning',
        waveOrdinal,
      },
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
