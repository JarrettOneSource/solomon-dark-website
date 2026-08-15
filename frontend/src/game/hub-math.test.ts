import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HUB_SPAWN,
  HUB_VIEW_HEIGHT,
  HUB_VIEW_WIDTH,
  hubCameraOrigin,
  hubRegionCameraOrigin,
  isHubTraversable,
  moveWithHubCollision,
} from './core-kernels/hub-math.ts'
import {
  HUB_ASTRONOMER_DEPTH,
  HUB_ASTRONOMER_FRONT_DEPTH,
  HUB_ASTRONOMER_TELESCOPE_DEPTH,
  HUB_COURTYARD_FOREGROUND_DEPTH,
  HUB_SOUTHERN_FOREGROUND_DEPTH,
  HUB_USEFUL_THYNGS_BALLOON_DEPTH,
  HUB_USEFUL_THYNGS_COUNTER_DEPTH,
  HUB_USEFUL_THYNGS_FRONT_DEPTH,
  HUB_USEFUL_THYNGS_MARKER_DEPTH,
  HUB_USEFUL_THYNGS_SHADOW_DEPTH,
  hubActorDepth,
} from './hub-depth.ts'
import {
  createHubAstronomerClock,
  hubAstronomerFrameAt,
  hubAstronomerLocalTick,
} from './hub-astronomer.ts'
import {
  HUB_ASTRONOMER_ROOT,
  HUB_ASTRONOMER_TELESCOPE_ORIGIN,
  HUB_SOUTHERN_CAMERA_FACTOR,
  HUB_SOUTHERN_EAST_PLATFORM_ORIGIN,
  HUB_SOUTHERN_EXTENT,
  HUB_SOUTHERN_WEST_PLATFORM_ORIGIN,
  hubSouthernCameraTranslation,
} from './hub-camera-presentation.ts'
import {
  HUB_FOUNTAIN_ORIGIN,
  HUB_STATUE_ROOT,
  createHubCommonTraderClock,
  createHubHagathaClock,
  createHubPotionTraderClock,
  hubCommonTraderFrameAt,
  hubFountainParticleAlpha,
  hubHagathaFrameAt,
  hubMarkerAlpha,
  hubPotionTraderActorFrameAt,
  hubPotionTraderBalloonFrameAt,
  hubPotionTraderBalloonOffsetYAt,
  hubSealColors,
  hubStatueOffsets,
  hubStudentHeadOffset,
  hubStudentPropOffset,
} from './hub-presentation.ts'
import {
  createHubAmbientState,
  stepHubAmbient,
} from './core-server/hub-ambient.ts'
import {
  createGameSimulation,
  getPlayerCharacter,
  stepGameSimulationTick,
  stepSinglePlayerGameSimulation,
} from './core-server/game-simulation.ts'
import {
  commitHubStudentRoute,
  createHubStudentPopulation,
  createHubStudents,
  HUB_STUDENT_SPAWN_REQUEST_TICKS,
  HUB_STUDENT_STATIC_COLLISION_REFRESH_TICKS,
  hubStudentStaticCollisionEnabled,
  planHubStudentRoute,
  stepHubStudentPopulation,
  HubStudentPopulationState,
} from './core-server/hub-students.ts'
import {
  COMPILED_HUB_STUDENT_SPLINES,
  evaluateHubStudentSpline,
} from './core-server/hub-student-splines.ts'
import { createHubStudentFixture } from './core-server/hub-student-fixtures.ts'
import { HubStudentNeighborGrid } from './core-server/hub-student-grid.ts'
import {
  HUB_TEACHER_CAST_ORIGIN,
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
  HUB_TEACHER_RELEASE_SECONDS,
  HUB_TEACHER_RUNE_ALPHA,
  HUB_TEACHER_RUNE_CENTER,
  hubTeacherBurstAt,
  hubTeacherFrameAt,
  hubTeacherPhaseAt,
} from './hub-teacher.ts'

function gameplayInput(movement: { x: number; y: number }) {
  return {
    aim: null,
    cast: { primary: false, secondary: null },
    movement,
  }
}

function closeTo(actual: number, expected: number, epsilon = 0.001): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`)
}

test('matches the native 1600x900 camera view and spawn origin', () => {
  closeTo(HUB_VIEW_WIDTH, 1333.333333)
  closeTo(HUB_VIEW_HEIGHT, 750)
  const spawn = hubCameraOrigin(HUB_SPAWN)
  closeTo(spawn.x, 283.973333)
  closeTo(spawn.y, 0)
})

test('camera view dimensions follow the logical browser viewport without changing world scale', () => {
  const viewport = { width: 1600, height: 1000 }
  const camera = hubRegionCameraOrigin('courtyard', { x: 1000, y: 512 }, viewport)

  closeTo(camera.x, 333.333333)
  closeTo(camera.y, 95.333333)
  const narrowRoom = hubRegionCameraOrigin('library', { x: 512, y: 512 }, viewport)
  closeTo(narrowRoom.x, -154.666667)
  closeTo(narrowRoom.y, 95.333333)
})

test('sorts each Useful Thyngs painter around PotionGuy', () => {
  assert.equal(HUB_USEFUL_THYNGS_COUNTER_DEPTH, 1663)
  assert.equal(hubActorDepth(664), 1664)
  assert.equal(HUB_USEFUL_THYNGS_FRONT_DEPTH, 1700)
  assert.equal(HUB_USEFUL_THYNGS_BALLOON_DEPTH, 1701)
  assert.equal(HUB_USEFUL_THYNGS_MARKER_DEPTH, 1702)
  assert.equal(HUB_USEFUL_THYNGS_SHADOW_DEPTH, 900)
  assert.ok(HUB_USEFUL_THYNGS_COUNTER_DEPTH < hubActorDepth(664))
  assert.ok(hubActorDepth(664) < HUB_USEFUL_THYNGS_FRONT_DEPTH)
  assert.ok(HUB_USEFUL_THYNGS_FRONT_DEPTH < HUB_USEFUL_THYNGS_BALLOON_DEPTH)
  assert.ok(HUB_USEFUL_THYNGS_BALLOON_DEPTH < HUB_USEFUL_THYNGS_MARKER_DEPTH)
})

test('submits the recovered southern Courtyard stack after every actor', () => {
  assert.equal(HUB_COURTYARD_FOREGROUND_DEPTH, 4000)
  assert.equal(HUB_SOUTHERN_FOREGROUND_DEPTH, 4001)
  assert.equal(HUB_ASTRONOMER_DEPTH, 4002)
  assert.equal(HUB_ASTRONOMER_TELESCOPE_DEPTH, 4003)
  assert.equal(HUB_ASTRONOMER_FRONT_DEPTH, 4004)
  assert.ok(HUB_COURTYARD_FOREGROUND_DEPTH > hubActorDepth(1024))
  assert.ok(HUB_COURTYARD_FOREGROUND_DEPTH < HUB_SOUTHERN_FOREGROUND_DEPTH)
  assert.ok(HUB_SOUTHERN_FOREGROUND_DEPTH < HUB_ASTRONOMER_DEPTH)
  assert.ok(HUB_ASTRONOMER_DEPTH < HUB_ASTRONOMER_TELESCOPE_DEPTH)
  assert.ok(HUB_ASTRONOMER_TELESCOPE_DEPTH < HUB_ASTRONOMER_FRONT_DEPTH)
})

test('Astronomer reconstructs the native roots, crew, and telescope cycle', () => {
  assert.deepEqual(HUB_ASTRONOMER_ROOT, { x: 2150, y: 996.25 })
  assert.deepEqual(HUB_ASTRONOMER_TELESCOPE_ORIGIN, { x: 2017, y: 828.25 })
  const initial = hubAstronomerFrameAt(0)
  assert.equal(initial.telescopeFrame, 0)
  assert.deepEqual(initial.red.position, { x: 61, y: -120 })
  assert.deepEqual(initial.green.position, { x: -102, y: -109 })
  assert.deepEqual(initial.assistants.gray.shadowPosition, { x: 126, y: -93 })
  assert.deepEqual(initial.assistants.blue.shadowPosition, { x: 73, y: -65 })
  assert.deepEqual(initial.assistants.purple.shadowPosition, { x: -139, y: -75 })
  assert.deepEqual(initial.assistants.brown.shadowPosition, { x: -100, y: -59 })

  const telescopeFrames = new Set<number>()
  const redBanks = new Set<string>()
  const greenBanks = new Set<string>()
  const assistantFrames = new Set<number>()
  for (let tick = 0; tick < 5_000; tick += 1) {
    const frame = hubAstronomerFrameAt(tick)
    telescopeFrames.add(frame.telescopeFrame)
    redBanks.add(frame.red.bank)
    greenBanks.add(frame.green.bank)
    assistantFrames.add(frame.assistants.gray.frame)
    assistantFrames.add(frame.assistants.blue.frame)
    assistantFrames.add(frame.assistants.purple.frame)
    assistantFrames.add(frame.assistants.brown.frame)
  }
  assert.deepEqual([...telescopeFrames].sort(), [0, 1, 2, 3, 4])
  assert.deepEqual([...redBanks].sort(), ['gesture', 'idle', 'transition'])
  assert.deepEqual([...greenBanks].sort(), ['gesture', 'idle', 'transition'])
  assert.deepEqual([...assistantFrames].sort(), [0, 1, 2])
  assert.deepEqual(hubAstronomerFrameAt(2048), hubAstronomerFrameAt(2048))
})

test('Astronomer starts from its local Courtyard construction tick', () => {
  const createdAtTick = 17_000
  assert.equal(hubAstronomerLocalTick(createdAtTick - 1, createdAtTick), 0)
  assert.equal(hubAstronomerLocalTick(createdAtTick, createdAtTick), 0)
  assert.equal(hubAstronomerLocalTick(createdAtTick + 381.9, createdAtTick), 381)
  assert.deepEqual(
    hubAstronomerFrameAt(hubAstronomerLocalTick(createdAtTick, createdAtTick)),
    hubAstronomerFrameAt(0),
  )
})

test('Astronomer clock advances native state instead of replaying it on each draw', () => {
  const clock = createHubAstronomerClock()
  let frame = clock.advanceTo(0)
  assert.deepEqual(frame, hubAstronomerFrameAt(0))
  assert.equal(clock.advanceTo(0.99), frame)

  for (let tick = 1; tick <= 1_025; tick += 1) {
    frame = clock.advanceTo(tick)
    assert.deepEqual(frame, hubAstronomerFrameAt(tick))
  }
  assert.equal(clock.advanceTo(1_025.99), frame)

  assert.deepEqual(clock.advanceTo(8_193), hubAstronomerFrameAt(8_193))
  assert.deepEqual(clock.advanceTo(37), hubAstronomerFrameAt(37))
  assert.deepEqual(clock.advanceTo(2_049), hubAstronomerFrameAt(2_049))
})

test('southern Courtyard bank uses the recovered 1.25 camera scope', () => {
  assert.equal(HUB_SOUTHERN_CAMERA_FACTOR, 1.25)
  closeTo(HUB_SOUTHERN_EXTENT.x, 2333.333333)
  closeTo(HUB_SOUTHERN_EXTENT.y, 1186.25)
  closeTo(HUB_SOUTHERN_WEST_PLATFORM_ORIGIN.x, 106.666667)
  closeTo(HUB_SOUTHERN_WEST_PLATFORM_ORIGIN.y, 779.25)
  assert.deepEqual(HUB_SOUTHERN_EAST_PLATFORM_ORIGIN, { x: 1843, y: 771.25 })

  const northWest = hubSouthernCameraTranslation({ x: 0, y: 0 })
  closeTo(northWest.x, -166.666667)
  closeTo(northWest.y, -93.75)
  const moved = hubSouthernCameraTranslation({ x: 100, y: 40 })
  closeTo(moved.x - northWest.x, -125)
  closeTo(moved.y - northWest.y, -50)

  const southEast = hubSouthernCameraTranslation({ x: 666.666667, y: 274 })
  closeTo(southEast.x, -1000)
  closeTo(southEast.y, -436.25)
})

test('southern Courtyard translation consumes the dynamic primary-view center', () => {
  const viewport = { width: 1600 / 1.2, height: 1000 / 1.2 }
  const translation = hubSouthernCameraTranslation({ x: 100, y: 40 }, viewport)

  closeTo(translation.x, -291.666667)
  closeTo(translation.y, -154.166667)
})

test('PotionGuy keeps the inherited stochastic actor pulse separate', () => {
  assert.equal(hubPotionTraderActorFrameAt(-10), 0)
  assert.equal(hubPotionTraderActorFrameAt(0), 0)
  const frames = new Set(
    Array.from({ length: 1_000 }, (_, tick) => hubPotionTraderActorFrameAt(tick)),
  )
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3])
})

test('Luthacus and Shlorio common animation reaches every recovered frame from the session seed', () => {
  const luthacusSeed = 0x5eedc0de ^ 5005
  const shlorioSeed = 0x5eedc0de ^ 5016
  for (const seed of [luthacusSeed, shlorioSeed]) {
    const frames = new Set(Array.from(
      { length: 5_000 },
      (_, tick) => hubCommonTraderFrameAt(tick, seed),
    ))
    assert.deepEqual([...frames].sort(), [0, 1, 2, 3])
    const clock = createHubCommonTraderClock(seed)
    for (const tick of [0, 1, 511, 512, 2_049, 37]) {
      assert.equal(clock.advanceTo(tick), hubCommonTraderFrameAt(tick, seed))
    }
  }
})

test('Hagatha reaches all body frames and emits every cross-fade member once per tick', () => {
  const seed = 0x5eedc0de ^ 5001
  const bodyFrames = new Set<number>()
  const crossfadeFrames = new Set<number>()
  const scanClock = createHubHagathaClock(seed)
  for (let tick = 0; tick < 20_000; tick += 1) {
    const frame = scanClock.advanceTo(tick)
    bodyFrames.add(frame.bodyFrame)
    for (const particle of frame.particles) crossfadeFrames.add(particle.frame)
  }
  assert.deepEqual([...bodyFrames].sort(), [0, 1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual([...crossfadeFrames].sort(), [0, 1, 2, 3])
  assert.equal(hubHagathaFrameAt(0, seed).particles.length, 0)
  assert.equal(hubHagathaFrameAt(1, seed).particles.length, 1)
  assert.ok(hubHagathaFrameAt(150, seed).particles.length >= 125)
  assert.ok(hubHagathaFrameAt(150, seed).particles.length <= 150)

  const clock = createHubHagathaClock(seed)
  for (const tick of [0, 1, 511, 512, 8_193, 77]) {
    assert.deepEqual(clock.advanceTo(tick), hubHagathaFrameAt(tick, seed))
  }
})

test('PotionGuy balloons replay their five-frame clock and vertical drift', () => {
  assert.equal(hubPotionTraderBalloonFrameAt(-10), 0)
  assert.equal(hubPotionTraderBalloonFrameAt(0), 0)
  assert.equal(hubPotionTraderBalloonFrameAt(20), 1)
  assert.equal(hubPotionTraderBalloonFrameAt(40), 1)
  assert.equal(hubPotionTraderBalloonFrameAt(60), 2)
  assert.equal(hubPotionTraderBalloonFrameAt(80), 3)
  assert.equal(hubPotionTraderBalloonFrameAt(99), 4)
  assert.equal(hubPotionTraderBalloonFrameAt(100), 4)
  assert.equal(hubPotionTraderBalloonFrameAt(200), 4)
  assert.equal(hubPotionTraderBalloonFrameAt(219), 3)
  assert.equal(hubPotionTraderBalloonFrameAt(239), 2)
  assert.equal(hubPotionTraderBalloonFrameAt(259), 1)
  assert.equal(hubPotionTraderBalloonFrameAt(299), 0)
  assert.equal(hubPotionTraderBalloonFrameAt(399), 0)
  assert.equal(hubPotionTraderBalloonOffsetYAt(0), 0)
  assert.ok(Math.abs(hubPotionTraderBalloonOffsetYAt(180) - 2) < 1e-12)
  assert.ok(Math.abs(hubPotionTraderBalloonOffsetYAt(540) + 2) < 1e-12)
})

test('PotionGuy clock advances both native states once per fixed tick', () => {
  const clock = createHubPotionTraderClock()
  let frame = clock.advanceTo(0)
  assert.deepEqual(frame, {
    actorFrame: hubPotionTraderActorFrameAt(0),
    balloonFrame: hubPotionTraderBalloonFrameAt(0),
    balloonOffsetY: hubPotionTraderBalloonOffsetYAt(0),
  })
  assert.equal(clock.advanceTo(0.99), frame)

  for (let tick = 1; tick <= 1_025; tick += 1) {
    frame = clock.advanceTo(tick)
    assert.deepEqual(frame, {
      actorFrame: hubPotionTraderActorFrameAt(tick),
      balloonFrame: hubPotionTraderBalloonFrameAt(tick),
      balloonOffsetY: hubPotionTraderBalloonOffsetYAt(tick),
    })
  }
  assert.equal(clock.advanceTo(1_025.99), frame)

  for (const tick of [8_193, 37, 2_049]) {
    assert.deepEqual(clock.advanceTo(tick), {
      actorFrame: hubPotionTraderActorFrameAt(tick),
      balloonFrame: hubPotionTraderBalloonFrameAt(tick),
      balloonOffsetY: hubPotionTraderBalloonOffsetYAt(tick),
    })
  }
})

test('camera follows the player and clamps at every Courtyard edge', () => {
  assert.deepEqual(hubCameraOrigin({ x: 0, y: 0 }), { x: 0, y: 0 })
  const center = hubCameraOrigin({ x: 1000, y: 512 })
  closeTo(center.x, 333.333333)
  closeTo(center.y, 137)
  const farEdge = hubCameraOrigin({ x: 2000, y: 1024 })
  closeTo(farEdge.x, 666.666667)
  closeTo(farEdge.y, 274)
})

test('places the Teacher cast and local rune from their native actor offsets', () => {
  assert.deepEqual(HUB_TEACHER_CAST_ORIGIN, { x: -38, y: 15 })
  assert.deepEqual(HUB_TEACHER_RUNE_CENTER, { x: -40, y: 30 })
  assert.equal(HUB_TEACHER_RUNE_ALPHA, 0.25)
})

test('Courtyard ambient painters share the recovered native fixed update', () => {
  let ambient = createHubAmbientState()
  assert.deepEqual(HUB_FOUNTAIN_ORIGIN, { x: 957, y: 333 })
  assert.deepEqual(HUB_STATUE_ROOT, { x: 961, y: 834 })
  closeTo(hubMarkerAlpha(ambient), 0.75)
  const initialStatue = hubStatueOffsets(ambient)
  closeTo(initialStatue.aura.x, 0)
  closeTo(initialStatue.aura.y, 0)
  closeTo(initialStatue.body.x, 0)
  closeTo(initialStatue.body.y, -15)
  const initialSeals = hubSealColors(ambient)
  closeTo(initialSeals.core.red, 1)
  closeTo(initialSeals.core.green, 1)
  closeTo(initialSeals.core.blue, 1)
  closeTo(initialSeals.glyphs.red, 0.5205)
  closeTo(initialSeals.glyphs.green, 0.5205)
  closeTo(initialSeals.glyphs.blue, 0.7705)

  for (let tick = 0; tick < 180; tick += 1) ambient = stepHubAmbient(ambient)
  closeTo(ambient.markerPhaseDegrees, 180)
  closeTo(ambient.statuePhaseDegrees, 90)
  closeTo(hubMarkerAlpha(ambient), 0.75)
  const statue = hubStatueOffsets(ambient)
  closeTo(statue.body.y, -17)
  closeTo(statue.aura.x, -1)
  closeTo(statue.aura.y, Math.sqrt(3) * 0.8)
  assert.ok(ambient.sealCorePhase > 0 && ambient.sealCorePhase < 3)
  assert.ok(ambient.sealGlyphPhase > 0 && ambient.sealGlyphPhase < 3)
})

test('fountain particles are finite native sprite transients', () => {
  let ambient = createHubAmbientState()
  for (let tick = 0; tick < 1000 && ambient.fountainParticles.length === 0; tick += 1) {
    ambient = stepHubAmbient(ambient)
  }
  assert.ok(ambient.fountainParticles.length > 0)
  const created = ambient.fountainParticles[0]
  assert.equal(created.scale, 0.02)
  closeTo(hubFountainParticleAlpha(created), 0.25)

  const particleId = created.id
  for (let tick = 0; tick < 400; tick += 1) ambient = stepHubAmbient(ambient)
  assert.equal(
    ambient.fountainParticles.some((particle) => particle.id === particleId),
    false,
  )
})

test('uses the recovered native segment field and swept sliding', () => {
  assert.equal(isHubTraversable({ x: 225, y: 225 }), true)
  assert.equal(isHubTraversable({ x: 4, y: 225 }), false)
  assert.equal(isHubTraversable(HUB_SPAWN), true)
  const outerWall = moveWithHubCollision({ x: 25, y: 225 }, { x: -10, y: 0 })
  closeTo(outerWall.x, 25.1)
  closeTo(outerWall.y, 225)

  const landingFront = { x: 950.64, y: 220 }
  assert.equal(isHubTraversable(landingFront), true)
  const blocked = moveWithHubCollision(landingFront, { x: 0, y: 8 })
  assert.ok(blocked.y < landingFront.y + 8)
  assert.equal(isHubTraversable(blocked), true)
})

test('matches the stock raised landing, staircase, and statue segment collision', () => {
  const landingLeft = moveWithHubCollision(HUB_SPAWN, { x: -200, y: 0 })
  const landingRight = moveWithHubCollision(HUB_SPAWN, { x: 200, y: 0 })
  assert.ok(landingLeft.x < HUB_SPAWN.x)
  assert.ok(landingRight.x > HUB_SPAWN.x)
  assert.ok(landingLeft.y > HUB_SPAWN.y)
  assert.ok(landingRight.y > HUB_SPAWN.y)
  assert.equal(isHubTraversable(landingLeft), true)
  assert.equal(isHubTraversable(landingRight), true)

  const leftStairBottom = moveWithHubCollision(
    { x: 837.05, y: 188.22 },
    { x: 0, y: 300 },
  )
  assert.ok(leftStairBottom.x >= 755 && leftStairBottom.x <= 780)
  assert.ok(leftStairBottom.y >= 395 && leftStairBottom.y <= 410)
  assert.equal(isHubTraversable(leftStairBottom), true)

  const statueApproach = { x: 950, y: 700 }
  const statueBlocked = moveWithHubCollision(statueApproach, { x: 0, y: 100 })
  assert.ok(statueBlocked.y < statueApproach.y + 100)
  assert.ok(statueBlocked.y >= 750 && statueBlocked.y <= 760)
  assert.equal(isHubTraversable(statueBlocked), true)
})

test('Students follow the recovered deterministic Courtyard splines', () => {
  const firstRun = createHubStudents()
  const secondRun = createHubStudents()
  assert.ok(firstRun.length >= 5)
  assert.equal(COMPILED_HUB_STUDENT_SPLINES.length, 18)
  assert.deepEqual(evaluateHubStudentSpline(0, 0), { x: 1577, y: -29 })
  assert.deepEqual(evaluateHubStudentSpline(0, 13), { x: 456, y: 77 })

  const firstIndex = firstRun.reduce((selected, student, index, students) => (
    student.pathCursor < students[selected].pathCursor ? index : selected
  ), 0)
  const firstStudent = firstRun[firstIndex]
  const secondIndex = secondRun.findIndex((student) => student.id === firstStudent.id)
  assert.ok(secondIndex >= 0)
  const origin = { ...firstStudent.position }
  const originCursor = firstStudent.pathCursor
  for (let frame = 0; frame < 300; frame += 1) {
    const firstPlan = planHubStudentRoute(firstRun[firstIndex], firstRun, 0.01)
    const secondPlan = planHubStudentRoute(secondRun[secondIndex], secondRun, 0.01)
    firstRun[firstIndex] = commitHubStudentRoute(firstPlan.state, {
      x: firstPlan.state.position.x + firstPlan.delta.x,
      y: firstPlan.state.position.y + firstPlan.delta.y,
    })
    secondRun[secondIndex] = commitHubStudentRoute(secondPlan.state, {
      x: secondPlan.state.position.x + secondPlan.delta.x,
      y: secondPlan.state.position.y + secondPlan.delta.y,
    })
  }

  assert.deepEqual(firstRun[firstIndex], secondRun[secondIndex])
  assert.ok(firstRun[firstIndex].pathCursor > originCursor)
  assert.ok(Math.hypot(
    firstRun[firstIndex].position.x - origin.x,
    firstRun[firstIndex].position.y - origin.y,
  ) > 100)
  assert.ok(firstRun[firstIndex].framePhase >= 0 && firstRun[firstIndex].framePhase < 5)
  assert.ok(firstRun[firstIndex].headingIndex >= 0 && firstRun[firstIndex].headingIndex < 24)
})

test('Student neighbor grid preserves all-pairs route planning exactly', () => {
  const students = createHubStudentFixture({ count: 256, seed: 0x12345678 })
  const neighbors = new HubStudentNeighborGrid()
  neighbors.rebuild(students)
  for (const student of students) {
    assert.deepEqual(
      planHubStudentRoute(student, students, 0.01, neighbors),
      planHubStudentRoute(student, students, 0.01),
    )
  }
})

test('benchmark Students reverse at route ends while stock Students retire', () => {
  const spline = COMPILED_HUB_STUDENT_SPLINES[0]
  const pathCursor = spline.points.length - 1.05
  const source = {
    ...createHubStudentFixture({ count: 1, seed: 0x12345678 })[0],
    pathCursor,
    pathId: 0,
    pathStep: 1 as const,
    position: evaluateHubStudentSpline(0, pathCursor),
    wander: { x: 0, y: 0 },
  }
  const retired = planHubStudentRoute(source, [source], 0.01).state
  const reversed = planHubStudentRoute(
    source,
    [source],
    0.01,
    undefined,
    'reverse',
  ).state

  assert.equal(retired.retired, true)
  assert.equal(reversed.retired, false)
  assert.equal(reversed.pathStep, -1)
  assert.ok(reversed.pathCursor < source.pathCursor)
})

test('Student static collision follows the native Courtyard doorway field', () => {
  assert.equal(HUB_STUDENT_STATIC_COLLISION_REFRESH_TICKS, 15)
  assert.equal(hubStudentStaticCollisionEnabled({ x: 1577, y: -29 }), false)
  assert.equal(hubStudentStaticCollisionEnabled({ x: 760, y: 150 }), false)
  assert.equal(hubStudentStaticCollisionEnabled({ x: 600, y: 50 }), false)
  assert.equal(hubStudentStaticCollisionEnabled({ x: 1300, y: 100 }), false)
  assert.equal(hubStudentStaticCollisionEnabled({ x: 1800, y: 100 }), false)
  assert.equal(hubStudentStaticCollisionEnabled({ x: 800, y: 200 }), true)
})

test('Student static collision refreshes on the recovered fifteen-tick cadence', () => {
  const source = {
    ...createHubStudents()[0],
    position: { x: 760, y: 150 },
    staticCollisionEnabled: true,
    tick: 0,
  }
  const doorway = planHubStudentRoute(source, [source], 0.01).state
  assert.equal(doorway.staticCollisionEnabled, false)

  const betweenRefreshes = {
    ...doorway,
    position: { x: 800, y: 200 },
    tick: 1,
  }
  assert.equal(
    planHubStudentRoute(betweenRefreshes, [betweenRefreshes], 0.01).state.staticCollisionEnabled,
    false,
  )

  const refresh = { ...betweenRefreshes, tick: 15 }
  assert.equal(
    planHubStudentRoute(refresh, [refresh], 0.01).state.staticCollisionEnabled,
    true,
  )
})

test('Student population retires and spawns without visible-route teleports', () => {
  let simulation = createGameSimulation()
  if (simulation.world.kind !== 'hub') throw new Error('expected Hub world')
  const initialIds = new Set(
    simulation.world.studentPopulation.students.map((student) => student.id),
  )
  let highestId = Math.max(...initialIds)
  for (let frame = 0; frame < 2400; frame += 1) {
    simulation = stepSinglePlayerGameSimulation(simulation, { x: 0, y: 0 }, 1 / 100)
    if (simulation.world.kind !== 'hub') throw new Error('expected Hub world')
    highestId = Math.max(
      highestId,
      ...simulation.world.studentPopulation.students.map((student) => student.id),
    )
    for (const student of simulation.world.studentPopulation.students) {
      assert.ok(student.pathCursor >= 0)
      assert.ok(student.pathCursor < COMPILED_HUB_STUDENT_SPLINES[student.pathId].points.length - 1)
    }
  }
  assert.ok(highestId >= Math.max(...initialIds))
})

test('Student admission uses the native Courtyard ticker and transient bootstrap', () => {
  const visiblePopulation = createHubStudentPopulation()
  assert.equal(HUB_STUDENT_SPAWN_REQUEST_TICKS, 35)
  assert.equal(visiblePopulation.students.length, 13)
  assert.equal(visiblePopulation.nextId, 14)
  assert.equal(visiblePopulation.rarePathDenominator, 20)
  assert.ok(visiblePopulation.students.every((student) => (
    student.desiredSpeed === 2
    || student.desiredSpeed >= 0.6 && student.desiredSpeed <= 0.9
  )))
  assert.ok(new Set(visiblePopulation.students.map((student) => student.tick)).size > 5)
  assert.ok(visiblePopulation.students.every((student) => (
    student.scale >= 0.75 && student.scale < 1.1
  )))

  let coldPopulation = new HubStudentPopulationState({
    nextId: 0,
    rarePathDenominator: 20,
    rngState: 0x51d07e57,
    spawningEnabled: true,
    spawnRequestPending: false,
    spawnTickerCounter: 0,
  })
  for (let tick = 0; tick < 34; tick += 1) {
    coldPopulation = stepHubStudentPopulation(
      coldPopulation,
      coldPopulation.students,
    )
  }
  assert.equal(coldPopulation.students.length, 0)
  assert.equal(coldPopulation.spawnTickerCounter, 34)
  coldPopulation = stepHubStudentPopulation(
    coldPopulation,
    coldPopulation.students,
  )
  assert.equal(coldPopulation.students.length, 1)
  assert.equal(coldPopulation.spawnTickerCounter, 0)
})

test('static Courtyard placement accounts for each actor circle radius', () => {
  assert.equal(isHubTraversable({ x: 225, y: 225 }, 12), true)
  assert.equal(isHubTraversable({ x: 225, y: 225 }, 226), false)

  const studentMove = moveWithHubCollision({ x: 25, y: 225 }, { x: -20, y: 0 }, 12)
  assert.ok(studentMove.x >= 12)
  const playerMove = moveWithHubCollision({ x: 25, y: 225 }, { x: -20, y: 0 }, 25)
  closeTo(playerMove.x, 25.1)
})

test('the integrated Hub world is deterministic and keeps every actor distinct', () => {
  let first = createGameSimulation()
  let second = createGameSimulation()
  for (let frame = 0; frame < 240; frame += 1) {
    const input = frame < 120 ? { x: -1, y: 1 } : { x: 0, y: 0 }
    first = stepSinglePlayerGameSimulation(first, input, 1 / 60)
    second = stepSinglePlayerGameSimulation(second, input, 1 / 60)
  }
  assert.deepEqual(first, second)
  if (first.world.kind !== 'hub') throw new Error('expected Hub world')
  for (
    let index = 0;
    index < first.world.studentPopulation.students.length;
    index += 1
  ) {
    const student = first.world.studentPopulation.students[index]
    const playerDistance = Math.hypot(
      student.position.x - getPlayerCharacter(first).position.x,
      student.position.y - getPlayerCharacter(first).position.y,
    )
    assert.ok(playerDistance + 0.11 >= student.profile.radius + 25)
  }
})

test('a tick-indexed multi-player input recording replays exactly on one pinned build', () => {
  const characters = {
    'player-1': { discipline: 'arcane', displayName: 'One', element: 'ether' },
    'player-2': { discipline: 'body', displayName: 'Two', element: 'fire' },
  } as const
  let first = createGameSimulation(characters)
  let second = createGameSimulation(characters)
  for (let tick = 0; tick < 600; tick += 1) {
    const inputs = {
      'player-1': gameplayInput(tick < 180
        ? { x: 1, y: 0 }
        : tick < 360
          ? { x: 0, y: 1 }
          : { x: 0, y: 0 }),
      'player-2': gameplayInput(tick < 240
        ? { x: -1, y: 1 }
        : tick < 480
          ? { x: 1, y: -1 }
          : { x: 0, y: 0 }),
    }
    first = stepGameSimulationTick(first, inputs)
    second = stepGameSimulationTick(second, inputs)
  }
  assert.deepEqual(first, second)
  assert.equal(first.tick, 600)
})

test('Student props retain native independent counts, continuous heading, palette, and stack offset', () => {
  const students = createHubStudents()
  for (const student of students) {
    assert.ok(student.props.length >= 2 && student.props.length <= 4)
    for (const prop of student.props) {
      assert.ok(prop.radius >= -2 && prop.radius <= 2)
      assert.ok(prop.angle >= 45 && prop.angle <= 90)
      assert.ok(prop.paletteIndex >= 0 && prop.paletteIndex < 5)
    }
  }
  const north = hubStudentPropOffset(0, { angle: 45, paletteIndex: 0, radius: 1.5 }, 2)
  closeTo(north.x, Math.SQRT1_2 * 1.5)
  closeTo(north.y, -Math.SQRT1_2 * 3 - 6)
  const turning = hubStudentPropOffset(7.5, { angle: 45, paletteIndex: 0, radius: 1.5 }, 2)
  assert.notDeepEqual(turning, north)
  closeTo(turning.x, Math.sin(52.5 * Math.PI / 180) * 1.5)
  closeTo(turning.y, -Math.cos(52.5 * Math.PI / 180) * 3 - 6)
})

test('Student final head pass keeps native gait and small-scale registration', () => {
  const small = hubStudentHeadOffset({ gaitDegrees: 0, heading: 0, scale: 0.75 })
  closeTo(small.x, -0.375)
  closeTo(small.y, 5)

  const ordinary = hubStudentHeadOffset({ gaitDegrees: 90, heading: 90, scale: 1 })
  closeTo(ordinary.x, 0)
  closeTo(ordinary.y, -1.5)

  const large = hubStudentHeadOffset({ gaitDegrees: 0, heading: 0, scale: 1.1 })
  closeTo(large.x, -0.55)
  closeTo(large.y, 0)
})

test('Teacher presentation follows the recovered fixed-tick cast, release, and idle cycle', () => {
  closeTo(HUB_TEACHER_CAST_SECONDS, 4.45)
  closeTo(HUB_TEACHER_RELEASE_SECONDS, 1.333333)
  closeTo(HUB_TEACHER_CYCLE_SECONDS, 14.116667)
  assert.equal(hubTeacherPhaseAt(0), 'cast')
  assert.equal(hubTeacherPhaseAt(HUB_TEACHER_CAST_SECONDS + 0.01), 'release')
  assert.equal(
    hubTeacherPhaseAt(HUB_TEACHER_CAST_SECONDS + HUB_TEACHER_RELEASE_SECONDS + 0.01),
    'idle',
  )
  assert.equal(hubTeacherPhaseAt(HUB_TEACHER_CYCLE_SECONDS), 'cast')
  assert.equal(hubTeacherFrameAt(0), 0)
  assert.equal(hubTeacherFrameAt(14 / 60), 1)
  assert.equal(hubTeacherFrameAt(27 / 60), 0)
  assert.equal(hubTeacherFrameAt(HUB_TEACHER_CAST_SECONDS + 0.01), 2)
  assert.equal(
    hubTeacherFrameAt(HUB_TEACHER_CAST_SECONDS + HUB_TEACHER_RELEASE_SECONDS + 0.01),
    3,
  )
  assert.equal(hubTeacherBurstAt(0).visible, false)
  const burst = hubTeacherBurstAt(HUB_TEACHER_CYCLE_SECONDS * 0.33)
  assert.equal(burst.visible, true)
  assert.ok(burst.frame >= 0 && burst.frame <= 10)
  assert.equal(hubTeacherBurstAt(HUB_TEACHER_CYCLE_SECONDS * 0.5).visible, false)
})
