import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HUB_GAIT_DEGREES_PER_UNIT,
  HUB_INPUT_ACCELERATION,
  HUB_MAX_SPEED,
  HUB_MOVEMENT_LANE_CAP,
  HUB_MOVEMENT_RETENTION,
  HUB_MOVEMENT_TICK_SECONDS,
  HUB_SPAWN,
  HUB_VIEW_HEIGHT,
  HUB_VIEW_WIDTH,
  HUB_WALK_CYCLE_DISTANCE_PER_FRAME,
  HUB_WALK_CYCLE_WRAP,
  advanceHubPlayerWalkCycle,
  hubCameraOrigin,
  hubHeadingFromVector,
  hubHeadingIndex,
  hubPlayerFixedRobePose,
  hubMovementTick,
  hubPlayerFixedRobeOffset,
  hubPlayerFrontAttachmentOffset,
  hubPlayerHeadOffset,
  hubStaffIsFront,
  hubStaffOrbOffset,
  isHubTraversable,
  moveWithHubCollision,
  stepHubMotionTick,
} from './core-kernels/hub-math.ts'
import {
  HUB_SPAWN_ROOF_DEPTH,
  HUB_USEFUL_THYNGS_DEPTH,
  HUB_USEFUL_THYNGS_ROOT_Y,
  HUB_USEFUL_THYNGS_SHADOW_DEPTH,
  hubActorDepth,
} from './hub-depth.ts'
import {
  HUB_FOUNTAIN_ORIGIN,
  HUB_STATUE_ROOT,
  hubFountainParticleAlpha,
  hubMarkerAlpha,
  hubSealColors,
  hubStatueOffsets,
  hubStudentHeadOffset,
  hubStudentPropOffset,
} from './hub-presentation.ts'
import {
  createHubAmbientState,
  stepHubAmbient,
} from './core-server/hub-ambient.ts'
import { resolveHubActorMotion, type HubPhysicsBody } from './core-kernels/hub-physics.ts'
import {
  createHubSimulation,
  getHubPlayer,
  reconcileHubPlayer,
  stepHubSimulationTick,
  stepSinglePlayerHubSimulation,
} from './core-server/hub-simulation.ts'
import {
  commitHubStudentRoute,
  createHubStudentPopulation,
  createHubStudents,
  HUB_STUDENT_SPAWN_REQUEST_TICKS,
  HUB_STUDENT_STATIC_COLLISION_REFRESH_TICKS,
  hubStudentStaticCollisionEnabled,
  planHubStudentRoute,
  stepHubStudentPopulation,
  type HubStudentPopulationState,
} from './core-server/hub-students.ts'
import {
  COMPILED_HUB_STUDENT_SPLINES,
  evaluateHubStudentSpline,
} from './core-server/hub-student-splines.ts'
import {
  HUB_TEACHER_CAST_ORIGIN,
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
  HUB_TEACHER_RELEASE_SECONDS,
  HUB_TEACHER_RUNE_ALPHA,
  HUB_TEACHER_RUNE_CENTER,
  hubTeacherFrameAt,
  hubTeacherPhaseAt,
} from './hub-teacher.ts'

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

test('sorts actors through the stock spawn-roof painter boundary', () => {
  assert.equal(HUB_SPAWN_ROOF_DEPTH, 1320)
  assert.ok(hubActorDepth(209) < HUB_SPAWN_ROOF_DEPTH)
  assert.ok(hubActorDepth(356) > HUB_SPAWN_ROOF_DEPTH)
})

test('sorts Useful Thyngs against its registered ground root', () => {
  assert.equal(HUB_USEFUL_THYNGS_ROOT_Y, 700)
  assert.equal(HUB_USEFUL_THYNGS_DEPTH, 1700)
  assert.equal(HUB_USEFUL_THYNGS_SHADOW_DEPTH, 900)
  assert.ok(hubActorDepth(699) < HUB_USEFUL_THYNGS_DEPTH)
  assert.ok(hubActorDepth(701) > HUB_USEFUL_THYNGS_DEPTH)
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

test('native headings cover cardinal movement and select the twenty-four-direction bank', () => {
  assert.equal(hubHeadingFromVector(0, -1), 0)
  assert.equal(hubHeadingFromVector(1, 0), 90)
  assert.equal(hubHeadingFromVector(0, 1), 180)
  assert.equal(hubHeadingFromVector(-1, 0), 270)
  assert.deepEqual([0, 90, 180, 270].map(hubHeadingIndex), [0, 6, 12, 18])
})

test('staff orb follows the native heading attachment point, not robe walk poses', () => {
  assert.deepEqual(hubStaffOrbOffset(0), { x: -32.5, y: -66.5 })
  assert.deepEqual(hubStaffOrbOffset(6), { x: 38.5, y: -61.5 })
  assert.deepEqual(hubStaffOrbOffset(12), { x: 32.5, y: -1.5 })
  assert.deepEqual(hubStaffOrbOffset(18), { x: -38.5, y: -6.5 })
  assert.deepEqual(hubStaffOrbOffset(30), hubStaffOrbOffset(6))
  assert.equal(hubStaffIsFront(4), false)
  assert.equal(hubStaffIsFront(5), true)
  assert.equal(hubStaffIsFront(16), true)
  assert.equal(hubStaffIsFront(17), false)
  assert.equal(hubStaffIsFront(30), true)
})

test('player presentation preserves the native painter-local gait transforms', () => {
  assert.equal(HUB_GAIT_DEGREES_PER_UNIT, 5)
  assert.equal(HUB_WALK_CYCLE_DISTANCE_PER_FRAME, 10)
  assert.equal(HUB_WALK_CYCLE_WRAP, 5)
  assert.equal(hubPlayerFixedRobePose(0), 0)
  assert.equal(hubPlayerFixedRobePose(0.999), 0)
  assert.equal(hubPlayerFixedRobePose(1), 1)
  assert.equal(hubPlayerFixedRobePose(4.999), 4)
  assert.equal(hubPlayerFixedRobePose(5), 5)
  closeTo(advanceHubPlayerWalkCycle(4.9, 1), 5)
  closeTo(advanceHubPlayerWalkCycle(5, 1), 0.1)
  closeTo(hubPlayerFixedRobeOffset(0).x, 0)
  closeTo(hubPlayerFixedRobeOffset(90).x, Math.SQRT1_2)
  closeTo(hubPlayerFixedRobeOffset(180).x, 1)
  closeTo(hubPlayerFixedRobeOffset(180, 2).x, 4)
  closeTo(hubPlayerFrontAttachmentOffset(90).x, Math.SQRT1_2)
  closeTo(hubPlayerFrontAttachmentOffset(90).y, 1)
  closeTo(hubPlayerHeadOffset(0, 0).x, -0.5)
  closeTo(hubPlayerHeadOffset(0, 0).y, 0)
  closeTo(hubPlayerHeadOffset(0, 90).x, 0)
  closeTo(hubPlayerHeadOffset(0, 90).y, -1.5)
  closeTo(hubPlayerHeadOffset(6, 0).x, 0)
  closeTo(hubPlayerHeadOffset(6, 0).y, -0.5)
})

test('collision displacement does not own player facing or gait', () => {
  const player = getHubPlayer(createHubSimulation())
  const pushed = reconcileHubPlayer(
    player,
    { x: player.position.x + 12, y: player.position.y },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  )
  assert.equal(pushed.headingIndex, player.headingIndex)
  assert.equal(pushed.gaitDegrees, player.gaitDegrees)
  assert.equal(pushed.walkCyclePrimary, player.walkCyclePrimary)
  assert.deepEqual(pushed.velocity, { x: 0, y: 0 })

  const blockedIntent = reconcileHubPlayer(
    pushed,
    pushed.position,
    { x: 100, y: 0 },
    { x: 10, y: 0 },
    { x: 90, y: 0 },
  )
  assert.equal(blockedIntent.headingIndex, 6)
  assert.equal(blockedIntent.gaitDegrees, 50)
  assert.equal(blockedIntent.walkCyclePrimary, 1)
  assert.deepEqual(blockedIntent.velocity, { x: 90, y: 0 })
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

test('movement replays the native fixed-tick accumulator and retention lane', () => {
  assert.equal(HUB_MAX_SPEED, 100)
  assert.equal(HUB_MOVEMENT_TICK_SECONDS, 0.01)
  assert.equal(HUB_INPUT_ACCELERATION, 10)
  assert.equal(HUB_MOVEMENT_LANE_CAP, 118.75)
  assert.equal(HUB_MOVEMENT_RETENTION, 0.9)

  const first = hubMovementTick({ x: 0, y: 0 }, { x: 1, y: 0 })
  assert.deepEqual(first.requestedVelocity, { x: 10, y: 0 })
  closeTo(first.delta.x, 0.1)
  assert.equal(first.delta.y, 0)
  assert.deepEqual(first.retainedVelocity, { x: 9, y: 0 })

  let motion = { position: { x: 225, y: 225 }, velocity: { x: 0, y: 0 } }
  for (let tick = 0; tick < 200; tick += 1) {
    motion = stepHubMotionTick(motion, { x: 1, y: 0 })
  }
  closeTo(motion.velocity.x, 90, 0.001)
  const steadyStart = motion.position.x
  for (let tick = 0; tick < 10; tick += 1) {
    motion = stepHubMotionTick(motion, { x: 1, y: 0 })
  }
  closeTo(motion.position.x - steadyStart, 10, 0.001)

  const retainedBeforeRelease = motion.velocity.x
  motion = stepHubMotionTick(motion, { x: 0, y: 0 })
  closeTo(motion.velocity.x, retainedBeforeRelease * 0.9, 0.001)
})

test('continuous movement follows the fountain rail without crossing through it', () => {
  let motion = {
    position: { x: 905, y: HUB_SPAWN.y },
    velocity: { x: 0, y: 0 },
  }
  for (let tick = 0; tick < 500; tick += 1) {
    motion = stepHubMotionTick(motion, { x: 0, y: 1 })
  }
  for (let tick = 0; tick < 100; tick += 1) {
    motion = stepHubMotionTick(motion, { x: 0, y: 0 })
  }

  assert.ok(motion.position.y >= HUB_SPAWN.y)
  assert.ok(motion.position.y < 250)
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
  let simulation = createHubSimulation()
  const initialIds = new Set(simulation.students.map((student) => student.id))
  let highestId = Math.max(...initialIds)
  for (let frame = 0; frame < 2400; frame += 1) {
    simulation = stepSinglePlayerHubSimulation(simulation, { x: 0, y: 0 }, 1 / 100)
    highestId = Math.max(highestId, ...simulation.students.map((student) => student.id))
    for (const student of simulation.students) {
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

  let coldPopulation: HubStudentPopulationState = {
    accumulatorSeconds: 0,
    nextId: 0,
    rarePathDenominator: 20,
    rngState: 0x51d07e57,
    spawnRequestPending: false,
    spawnTickerCounter: 0,
    students: [],
  }
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

const freePhysicsWorld = {
  canPlace: () => true,
  move: (_bodyId: string, position: { x: number; y: number }, delta: { x: number; y: number }) => ({
    x: position.x + delta.x,
    y: position.y + delta.y,
  }),
}
const allBodiesCollide = () => true

test('native strength thresholds produce yielding, pushing, and player dominance', () => {
  const heavyObstacle: HubPhysicsBody[] = [
    { id: 'mover', position: { x: 0, y: 0 }, delta: { x: 20, y: 0 }, radius: 15, pushStrength: 5, pushResistance: 5 },
    { id: 'heavy', position: { x: 38, y: 0 }, delta: { x: 0, y: 0 }, radius: 15, pushStrength: 5, pushResistance: 10 },
  ]
  const yielded = resolveHubActorMotion(heavyObstacle, freePhysicsWorld, allBodiesCollide)
  assert.ok(yielded[0].position.x < 20)
  assert.equal(yielded[1].position.x, 38)

  let bodies: HubPhysicsBody[] = [
    { id: 'student', position: { x: 0, y: 0 }, delta: { x: 1.2, y: 0 }, radius: 15, pushStrength: 11, pushResistance: 6 },
    { id: 'player', position: { x: 39, y: 0 }, delta: { x: 0, y: 0 }, radius: 25, pushStrength: 12, pushResistance: 10 },
  ]
  bodies = resolveHubActorMotion(bodies, freePhysicsWorld, allBodiesCollide)
  assert.ok(bodies[1].position.x > 39, 'the moving Student should push the idle player')
  const afterStudentPush = bodies[1].position.x

  for (let frame = 0; frame < 90; frame += 1) {
    bodies = resolveHubActorMotion([
      { ...bodies[0], delta: { x: 0, y: 0 } },
      { ...bodies[1], delta: { x: -1, y: 0 } },
    ], freePhysicsWorld, allBodiesCollide)
  }
  assert.ok(bodies[0].position.x < 0, 'sustained player movement should overpower the Student')
  assert.ok(bodies[1].position.x < afterStudentPush)
})

test('the integrated hub simulation is deterministic and keeps every actor distinct', () => {
  let first = createHubSimulation()
  let second = createHubSimulation()
  for (let frame = 0; frame < 240; frame += 1) {
    const input = frame < 120 ? { x: -1, y: 1 } : { x: 0, y: 0 }
    first = stepSinglePlayerHubSimulation(first, input, 1 / 60)
    second = stepSinglePlayerHubSimulation(second, input, 1 / 60)
  }
  assert.deepEqual(first, second)
  for (let index = 0; index < first.students.length; index += 1) {
    const student = first.students[index]
    const playerDistance = Math.hypot(
      student.position.x - getHubPlayer(first).position.x,
      student.position.y - getHubPlayer(first).position.y,
    )
    assert.ok(playerDistance + 0.11 >= student.profile.radius + 25)
  }
})

test('a tick-indexed multi-player input recording replays exactly on one pinned build', () => {
  let first = createHubSimulation(['player-1', 'player-2'])
  let second = createHubSimulation(['player-1', 'player-2'])
  for (let tick = 0; tick < 600; tick += 1) {
    const inputs = {
      'player-1': tick < 180
        ? { x: 1, y: 0 }
        : tick < 360
          ? { x: 0, y: 1 }
          : { x: 0, y: 0 },
      'player-2': tick < 240
        ? { x: -1, y: 1 }
        : tick < 480
          ? { x: 1, y: -1 }
          : { x: 0, y: 0 },
    }
    first = stepHubSimulationTick(first, inputs)
    second = stepHubSimulationTick(second, inputs)
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
})
