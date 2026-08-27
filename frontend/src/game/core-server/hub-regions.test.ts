import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import {
  HUB_STOREROOM_STORY_BARRIER,
  circleOverlapsHubSegment,
  circleTouchesHubSegment,
  pathCapsuleOverlapsHubSegment,
} from '../core-kernels/hub-collision.ts'
import {
  HUB_PORTALS,
  HUB_REGION_DEFINITIONS,
  clipHubRegionSegment,
  createHubCollegeIntroParticipantState,
  firstHubRegionLineObstruction,
  hubIncomingPlacement,
  hubPortalAt,
  isHubRegionPathTraversable,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
  planHubScriptedMovement,
  type HubParticipantState,
  type HubRegionId,
} from '../core-kernels/hub-regions.ts'
import {
  NATIVE_COLLEGE_COURTYARD_PATH,
  NATIVE_COLLEGE_TITLE_CURSOR_STEP,
  nativeCollegePathHeadingIndex,
} from '../core-kernels/native-college-intro.ts'
import {
  HUB_PRIVATE_ROOM_IDS,
  HUB_PRIVATE_ROOM_LAYOUTS,
} from '../core-kernels/hub-private-room-layout.ts'
import {
  HUB_SPAWN,
  HUB_VIEW_HEIGHT,
  HUB_VIEW_WIDTH,
  hubRegionCameraOrigin,
} from '../core-kernels/hub-math.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  createPlayerCharacter,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'

import {
  HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  createHubWorld,
  stepHubWorldTick,
  type HubWorldState,
} from './hub-world.ts'

test('solid-spell capsules use the complete Hub segment path, not endpoint occupancy', () => {
  const wall = { x1: 100, y1: 0, x2: 100, y2: 200 }
  assert.equal(pathCapsuleOverlapsHubSegment(
    { x: 80, y: 100 },
    { x: 120, y: 100 },
    5,
    wall,
  ), true)
  assert.equal(pathCapsuleOverlapsHubSegment(
    { x: 80, y: 220 },
    { x: 120, y: 220 },
    20,
    wall,
  ), false, 'native strict tangency remains clear')

  const courtyardBoundary = HUB_REGION_DEFINITIONS.courtyard.segments[0]!
  const midpointX = (courtyardBoundary.x1 + courtyardBoundary.x2) / 2
  assert.equal(isHubRegionPathTraversable(
    'courtyard',
    { x: midpointX, y: 20 },
    { x: midpointX, y: -20 },
    5,
  ), false)
})

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const
const IDLE_INPUT = { local: { movement: { x: 0, y: 0 } } } as const

function midpoint(segment: { x1: number; x2: number; y1: number; y2: number }) {
  return {
    x: (segment.x1 + segment.x2) / 2,
    y: (segment.y1 + segment.y2) / 2,
  }
}

function step(
  world: HubWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  count = 1,
  collegeIntroReadyPlayerIds: ReadonlySet<string> | null = null,
  collegeIntroPendingPlayerIds: ReadonlySet<string> | null = null,
) {
  let currentWorld = world
  let currentPlayers = players
  for (let tick = 0; tick < count; tick += 1) {
    const result = stepHubWorldTick(
      currentWorld,
      currentPlayers,
      IDLE_INPUT,
      { local: 1 },
      collegeIntroReadyPlayerIds,
      collegeIntroPendingPlayerIds,
    )
    currentWorld = result.world
    currentPlayers = result.players
  }
  return { players: currentPlayers, world: currentWorld }
}

test('every shared Hub scripted plan declares movement-owned facing', () => {
  const player = createPlayerCharacter(CHARACTER, { x: 10, y: 20 })
  const plan = planHubScriptedMovement(player, { x: 40, y: 20 }, 1)
  assert.equal(plan.face, true)
  assert.equal(plan.movementActive, true)
})

test('encodes the recovered College room graph, bounds, and ordinary portal constants', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(HUB_REGION_DEFINITIONS).map(
    ([region, definition]) => [region, [definition.nativeId, definition.width, definition.height]],
  )), {
    courtyard: [0, 2000, 1024],
    mortuary: [1, 1024, 1024],
    library: [2, 1024, 1024],
    storeroom: [3, 1075, 800],
    office: [4, 1024, 1024],
  })

  assert.deepEqual(HUB_PORTALS.map((portal) => [
    portal.source,
    portal.destination,
    portal.scriptedSpeed,
    portal.trigger,
    portal.scriptedTarget,
  ]), [
    ['courtyard', 'mortuary', 0.65, { x1: 179, y1: 394, x2: 33, y2: 529 }, { x: 32, y: 363 }],
    ['courtyard', 'library', 0.45, { x1: 1995.5, y1: 606.5, x2: 1915.5, y2: 443.5 }, { x: 2057.5, y: 460.5 }],
    ['courtyard', 'storeroom', 0.45, { x1: 679.5, y1: 146.5, x2: 576.5, y2: 146.5 }, { x: 627.5, y: -1000 }],
    ['courtyard', 'office', 0.45, { x1: 1024.5, y1: 115.5, x2: 881.5, y2: 115.5 }, { x: 881.5, y: -1000 }],
    ['mortuary', 'courtyard', 1, { x1: -488, y1: 964, x2: 1512, y2: 964 }, { x: 512, y: 2024 }],
    ['library', 'courtyard', 1, { x1: 412, y1: 924, x2: 612, y2: 924 }, { x: 512, y: 2024 }],
    ['storeroom', 'courtyard', 1, { x1: 437.5, y1: 700, x2: 637.5, y2: 700 }, { x: 537.5, y: 1800 }],
    ['office', 'courtyard', 1, { x1: 412, y1: 924, x2: 612, y2: 924 }, { x: 512, y: 2024 }],
  ])
  assert.deepEqual(HUB_STOREROOM_STORY_BARRIER, {
    x1: 573.5,
    y1: 180,
    x2: 681.5,
    y2: 180,
  })
})

test('clips Water prediction to the nearest authored Hub segment', () => {
  assert.deepEqual(
    firstHubRegionLineObstruction(
      'courtyard',
      { x: 100, y: 50 },
      { x: 100, y: -50 },
    ),
    { x: 100, y: 0 },
  )
  assert.equal(firstHubRegionLineObstruction(
    'courtyard',
    { x: 100, y: 50 },
    { x: 100, y: 75 },
  ), null)
})

test('neutral Hub input, including north-only input from spawn, reaches every portal', () => {
  const approaches = [
    ['mortuary', { x: 150, y: 540 }, { x: -1, y: -0.4 }],
    ['library', { x: 1900, y: 600 }, { x: 1, y: -0.2 }],
    ['storeroom', { x: 628, y: 230 }, { x: 0, y: -1 }],
    ['office', HUB_SPAWN, { x: 0, y: -1 }],
  ] as const

  for (const [destination, position, movement] of approaches) {
    let world = createHubWorld(['local'])
    let players = { local: createPlayerCharacter(CHARACTER, position) }
    for (let tick = 0; tick < 300 && !world.participants.local.transition; tick += 1) {
      const result = stepHubWorldTick(
        world,
        players,
        { local: { movement } },
        { local: 1 },
      )
      world = result.world
      players = result.players
    }
    assert.equal(
      world.participants.local.transition?.destination,
      destination,
      destination,
    )
  }
})

test('ordinary Hub authority consumes each player native movement multiplier', () => {
  const world = createHubWorld(['ordinary', 'boosted'])
  const players = {
    boosted: createPlayerCharacter(CHARACTER, { x: 1200, y: 800 }),
    ordinary: createPlayerCharacter(CHARACTER, { x: 500, y: 800 }),
  }
  const result = stepHubWorldTick(world, players, {
    boosted: { movement: { x: 1, y: 0 } },
    ordinary: { movement: { x: 1, y: 0 } },
  }, {
    boosted: 2.8125,
    ordinary: 1,
  })

  assert.equal(result.players.ordinary.velocity.x, 9)
  assert.equal(result.players.boosted.velocity.x, 25.3125)
})

test('private-room architecture and props own their native colliders', () => {
  const collisionOnlyProps: string[] = []
  for (const region of HUB_PRIVATE_ROOM_IDS) {
    const layout = HUB_PRIVATE_ROOM_LAYOUTS[region]
    assert.strictEqual(
      HUB_REGION_DEFINITIONS[region].segments,
      layout.architecture.collider.segments,
      region,
    )
    assert.equal(layout.architecture.visual.kind, 'background', region)
    for (const prop of layout.props) {
      assert.equal(prop.collider.kind, 'circle', `${region}:${prop.id}`)
      if (!prop.visual) collisionOnlyProps.push(`${region}:${prop.id}`)
    }
  }
  assert.deepEqual(collisionOnlyProps, ['library:library-prop-3'])
})

test('portal contact includes the native circle boundary without weakening wall overlap', () => {
  const office = HUB_PORTALS.find((portal) => portal.destination === 'office')!
  const boundary = {
    x: (office.trigger.x1 + office.trigger.x2) / 2,
    y: office.trigger.y1 + PLAYER_CHARACTER_RADIUS,
  }
  assert.equal(circleTouchesHubSegment(boundary, PLAYER_CHARACTER_RADIUS, office.trigger), true)
  assert.equal(circleOverlapsHubSegment(boundary, PLAYER_CHARACTER_RADIUS, office.trigger), false)
  assert.equal(hubPortalAt('courtyard', boundary)?.destination, 'office')
})

test('materializes every recovered private-room contour in native Region world space', () => {
  const expected = {
    mortuary: [11, { x: 27, y: 57 }, 'fb65d761226e4e4d50a975a0b13d97da139b280f8136b1c7bdb48a4bc6953cde'],
    storeroom: [34, { x: 0, y: 72.5 }, 'e40b8e2c1d21de36cb1d396f43721f2446ff13454d352391e8199e611be16f64'],
    library: [27, { x: 16, y: 102.5 }, '65737c733d0a1542b9e8167bcaf77be663d9ce27243ac1e412251b5ee256293d'],
    office: [48, { x: 102.5, y: 102.5 }, '03d34eceef915814d1f8f76b33bf2b36acc43aac7a3daf21ffa9286270524f7d'],
  } as const

  for (const [region, [count, tableToWorldOffset, digest]] of Object.entries(expected)) {
    assert.deepEqual(
      HUB_PRIVATE_ROOM_LAYOUTS[region as keyof typeof HUB_PRIVATE_ROOM_LAYOUTS]
        .architecture.collider.tableToWorldOffset,
      tableToWorldOffset,
      region,
    )
    const segments = HUB_REGION_DEFINITIONS[region as HubRegionId].segments
    assert.equal(segments.length, count, region)
    assert.equal(
      createHash('sha256').update(JSON.stringify(segments)).digest('hex'),
      digest,
      region,
    )
    for (const segment of segments) {
      assert.equal(isHubRegionTraversable(region as HubRegionId, midpoint(segment)), false, region)
    }
  }

  assert.deepEqual(HUB_REGION_DEFINITIONS.office.segments[0], {
    x1: 600.5,
    y1: 972.5,
    x2: 598.5,
    y2: 921.5,
  })
  assert.deepEqual(HUB_REGION_DEFINITIONS.office.segments[38], {
    x1: 450.5,
    y1: 741.5,
    x2: 589.5,
    y2: 741.5,
  })
  assert.deepEqual(HUB_REGION_DEFINITIONS.office.segments[47], {
    x1: 416.5,
    y1: 733.5,
    x2: 451.5,
    y2: 741.5,
  })
})

test('Office movement stops at the registered inner contour, not its raw table Y', () => {
  const result = moveWithHubRegionCollisionState(
    'office',
    { x: 512, y: 874 },
    { x: 0, y: -200 },
    PLAYER_CHARACTER_RADIUS,
    0x51a7c011,
  )

  assert.equal(result.position.x, 512)
  assert.equal(result.position.y, 766.6)
})

test('locks recovered fixed collision bodies in every private room', () => {
  assert.deepEqual(
    HUB_FIXED_ACTOR_COLLISION_LAYOUT
      .filter(({ region }) => region !== 'courtyard')
      .map(({ id, position, radius, region }) => [id, region, position.x, position.y, radius]),
    [
      ['memorator', 'mortuary', 628, 770, 25],
      ['painting-0', 'mortuary', 512, 695, 40],
      ['painting-1', 'mortuary', 350, 681, 40],
      ['painting-2', 'mortuary', 673, 681, 40],
      ['painting-3', 'mortuary', 744, 538, 40],
      ['painting-4', 'mortuary', 590, 538, 40],
      ['painting-5', 'mortuary', 434, 538, 40],
      ['painting-6', 'mortuary', 279, 538, 40],
      ['painting-7', 'mortuary', 354, 398, 40],
      ['painting-8', 'mortuary', 512, 398, 40],
      ['painting-9', 'mortuary', 670, 398, 40],
      ['librarian', 'library', 512, 595, 55],
      ['dowser', 'library', 900, 642.5, 25],
      ['library-prop-0', 'library', 239.5, 788, 40],
      ['library-prop-1', 'library', 258.5, 678.5, 40],
      ['library-prop-2', 'library', 762, 732.5, 40],
      ['library-prop-3', 'library', 831, 620.5, 40],
      ['storeroom-prop-0', 'storeroom', 538, 324, 40],
      ['storeroom-prop-1', 'storeroom', 537.5, 434, 40],
      ['storeroom-prop-2', 'storeroom', 536, 542.5, 40],
      ['arch-chancellor', 'office', 514, 467, 55],
      ['office-prop-0', 'office', 517.5, 681, 40],
    ],
  )
})

test('private-room cameras center narrow rooms within the native 1600x900 view', () => {
  const mortuary = hubRegionCameraOrigin('mortuary', { x: 512, y: 512 })
  assert.equal(mortuary.x, (1024 - HUB_VIEW_WIDTH) / 2)
  assert.equal(mortuary.y, 512 - HUB_VIEW_HEIGHT / 2)

  const storeroom = hubRegionCameraOrigin('storeroom', { x: 537.5, y: 400 })
  assert.equal(storeroom.x, (1075 - HUB_VIEW_WIDTH) / 2)
  assert.equal(storeroom.y, 25)
})

test('clips an untargeted spell ray to the active Region geometry', () => {
  assert.deepEqual(
    clipHubRegionSegment('courtyard', { x: 100, y: 900 }, { x: -100, y: 900 }),
    { x: 0, y: 900 },
  )
})

test('each Courtyard door performs the recovered covered swap and private fade-in', () => {
  for (const portal of HUB_PORTALS.filter((candidate) => candidate.source === 'courtyard')) {
    let world = createHubWorld(['local'])
    let players = {
      local: createPlayerCharacter(CHARACTER, midpoint(portal.trigger)),
    }

    ;({ world, players } = step(world, players))
    assert.equal(world.participants.local.transition?.phase, 'outgoing', portal.destination)
    assert.equal(world.participants.local.transition?.alpha, 0, portal.destination)

    ;({ world, players } = step(world, players, 100))
    assert.equal(world.participants.local.region, 'courtyard', portal.destination)
    assert.equal(world.participants.local.transition?.alpha, 1, portal.destination)

    ;({ world, players } = step(world, players))
    assert.equal(world.participants.local.region, portal.destination, portal.destination)
    assert.equal(world.participants.local.transition?.phase, 'incoming', portal.destination)
    assert.equal(world.participants.local.transition?.alpha, 1, portal.destination)
    assert.deepEqual(
      players.local.position,
      hubIncomingPlacement('courtyard', portal.destination).position,
      portal.destination,
    )

    const fadeTicks = portal.destination === 'storeroom' ? 40 : 100
    ;({ world, players } = step(world, players, fadeTicks))
    assert.ok((world.participants.local.transition?.alpha ?? 1) < 1e-12, portal.destination)

    for (let ticks = 0; world.participants.local.transition && ticks < 100; ticks += 1) {
      ;({ world, players } = step(world, players))
    }
    assert.equal(world.participants.local.transition, null, portal.destination)
  }
})

test('the first College admission walks through both authored splines before exit-owned loadout', () => {
  let world: HubWorldState = {
    ...createHubWorld(['local']),
    participants: { local: createHubCollegeIntroParticipantState() },
  }
  let players = {
    local: createPlayerCharacter(CHARACTER, NATIVE_COLLEGE_COURTYARD_PATH[0]),
  }

  for (let ticks = 0; ticks < 5_000; ticks += 1) {
    if (world.participants.local.collegeIntro?.phase === 'arch-dialogue') break
    ;({ world, players } = step(world, players, 1, new Set(['local']), new Set(['local'])))
  }
  assert.equal(world.participants.local.region, 'office')
  assert.equal(world.participants.local.collegeIntro?.phase, 'arch-dialogue')
  assert.equal(world.participants.local.collegeIntro?.dialogueSequence, 1)
  world = {
    ...world,
    participants: {
      local: { ...world.participants.local, collegeIntro: null },
    },
  }

  const officeExit = HUB_PORTALS.find((portal) => portal.source === 'office')!
  players = {
    local: {
      ...players.local,
      position: midpoint(officeExit.trigger),
      velocity: { x: 0, y: 0 },
    },
  }
  ;({ world, players } = step(world, players, 1, null, new Set(['local'])))
  assert.equal(world.participants.local.transition?.phase, 'outgoing')
  assert.deepEqual(world.participants.local.transition?.scriptedTarget, { x: 512, y: 2024 })

  ;({ world, players } = step(world, players, 101, null, new Set(['local'])))
  assert.equal(world.participants.local.region, 'courtyard')
  assert.equal(world.participants.local.transition?.phase, 'college-loadout')
  assert.equal(world.participants.local.transition?.alpha, 1)
  assert.deepEqual(players.local.position, { x: 952.5, y: 67.5 })
})

test('every forced College movement tick owns facing even while a cast retains ordinary facing', () => {
  let world: HubWorldState = {
    ...createHubWorld(['local']),
    participants: { local: createHubCollegeIntroParticipantState() },
  }
  let players = {
    local: {
      ...createPlayerCharacter(CHARACTER, NATIVE_COLLEGE_COURTYARD_PATH[0]),
      headingIndex: 12,
      primaryCast: {
        ...createPlayerCharacter(CHARACTER, NATIVE_COLLEGE_COURTYARD_PATH[0]).primaryCast,
        actionTick: 0,
      },
    },
  }
  const observedPhases = new Set<string>()

  for (let ticks = 0; ticks < 5_000; ticks += 1) {
    const participant = world.participants.local
    const phase = participant.collegeIntro?.phase
    if (phase === 'arch-dialogue') break
    const expectedHeading = participant.collegeIntro
      && phase !== undefined
      && phase !== 'arch-dialogue'
      && participant.transition?.phase !== 'outgoing'
      ? nativeCollegePathHeadingIndex(
          phase,
          participant.collegeIntro.pathCursor,
          players.local.position,
        )
      : null
    const previous = { ...players.local.position }
    ;({ world, players } = step(world, players, 1, new Set(['local']), new Set(['local'])))
    const delta = {
      x: players.local.position.x - previous.x,
      y: players.local.position.y - previous.y,
    }
    if (expectedHeading === null || Math.hypot(delta.x, delta.y) <= 0.001) continue
    if (phase) observedPhases.add(phase)
    assert.equal(
      players.local.headingIndex,
      expectedHeading,
      `${phase} tick ${ticks}`,
    )
  }

  assert.deepEqual([...observedPhases], ['courtyard-walk', 'office-walk'])
  assert.equal(world.participants.local.collegeIntro?.phase, 'arch-dialogue')
})

test('the first College reveal stays at alpha one until its renderer is ready', () => {
  const world: HubWorldState = {
    ...createHubWorld(['local']),
    participants: { local: createHubCollegeIntroParticipantState() },
  }
  const players = {
    local: createPlayerCharacter(CHARACTER, NATIVE_COLLEGE_COURTYARD_PATH[0]),
  }
  const waiting = stepHubWorldTick(
    world,
    players,
    IDLE_INPUT,
    { local: 1 },
    new Set(),
  )
  assert.equal(waiting.world.participants.local.collegeIntro?.titleCursor, 0)
  assert.deepEqual(waiting.players.local.position, NATIVE_COLLEGE_COURTYARD_PATH[0])

  const started = stepHubWorldTick(
    waiting.world,
    waiting.players,
    IDLE_INPUT,
    { local: 1 },
    new Set(['local']),
  )
  assert.equal(
    started.world.participants.local.collegeIntro?.titleCursor,
    NATIVE_COLLEGE_TITLE_CURSOR_STEP,
  )
  assert.notDeepEqual(started.players.local.position, NATIVE_COLLEGE_COURTYARD_PATH[0])
})

test('each private doorway returns to its own recovered Courtyard placement', () => {
  const expected = {
    mortuary: { position: { x: 63, y: 413 }, target: { x: 123, y: 488 } },
    library: { position: { x: 1990.5, y: 504.5 }, target: { x: 1917.5, y: 563.5 } },
    storeroom: { position: { x: 627.5, y: 98.5 }, target: { x: 627.5, y: 198.5 } },
    office: { position: { x: 952.5, y: 67.5 }, target: { x: 952.5, y: 157.5 } },
  } as const

  for (const source of Object.keys(expected) as Exclude<HubRegionId, 'courtyard'>[]) {
    const portal = HUB_PORTALS.find((candidate) => candidate.source === source)!
    let world = {
      ...createHubWorld(['local']),
      participants: {
        local: { collegeIntro: null, region: source, transition: null } satisfies HubParticipantState,
      },
    }
    let players = {
      local: createPlayerCharacter(CHARACTER, midpoint(portal.trigger)),
    }

    ;({ world, players } = step(world, players))
    ;({ world, players } = step(world, players, 101))
    assert.equal(world.participants.local.region, 'courtyard', source)
    assert.equal(world.participants.local.transition?.phase, 'incoming', source)
    assert.deepEqual(players.local.position, expected[source].position, source)
    assert.deepEqual(world.participants.local.transition?.scriptedTarget, expected[source].target, source)

    ;({ world, players } = step(world, players, 100))
    assert.equal(world.participants.local.transition?.alpha, 0, source)
  }
})

test('Mortuary return preserves contact X and does not retrigger after incoming attach', () => {
  const portal = HUB_PORTALS.find((candidate) => candidate.source === 'mortuary')!
  let world: HubWorldState = {
    ...createHubWorld(['local']),
    participants: {
      local: { collegeIntro: null, region: 'mortuary', transition: null },
    },
  }
  let players = {
    local: createPlayerCharacter(CHARACTER, { x: 300, y: portal.trigger.y1 }),
  }

  ;({ world, players } = step(world, players))
  assert.deepEqual(world.participants.local.transition?.scriptedTarget, {
    x: 300,
    y: 2024,
  })

  world = {
    ...createHubWorld(['local']),
    participants: {
      local: {
        collegeIntro: null,
        region: 'mortuary',
        transition: {
          alpha: 0,
          destination: 'mortuary',
          phase: 'incoming',
          scriptedSpeed: 1,
          scriptedTarget: { x: 512, y: 904 },
          sourceRegion: 'courtyard',
        },
      },
    },
  }
  players = {
    local: createPlayerCharacter(CHARACTER, { x: 512, y: 904 }),
  }

  ;({ world, players } = step(world, players, 2))
  assert.equal(world.participants.local.region, 'mortuary')
  assert.equal(world.participants.local.transition, null)
})

test('room ownership is per participant while the shared Courtyard simulation keeps ticking', () => {
  const initialWorld = createHubWorld(['private', 'courtyard'])
  const initialStudentTick = initialWorld.studentPopulation.students[0].tick
  const world: HubWorldState = {
    ...initialWorld,
    participants: {
      private: { collegeIntro: null, region: 'library', transition: null },
      courtyard: { collegeIntro: null, region: 'courtyard', transition: null },
    },
  }
  const sharedPosition = { x: 500, y: 700 }
  const players = {
    private: createPlayerCharacter(CHARACTER, sharedPosition),
    courtyard: createPlayerCharacter(CHARACTER, sharedPosition),
  }

  const result = stepHubWorldTick(world, players, {}, { courtyard: 1, private: 1 })
  assert.deepEqual(result.players.private.position, sharedPosition)
  assert.deepEqual(result.players.courtyard.position, sharedPosition)
  assert.equal(result.world.participants.private.region, 'library')
  assert.equal(result.world.participants.courtyard.region, 'courtyard')
  assert.equal(result.world.studentPopulation.students[0].tick, initialStudentTick + 1)
})

test('portal lookup is local to the participant region', () => {
  const courtyardPortal = HUB_PORTALS[0]
  const triggerPoint = midpoint(courtyardPortal.trigger)
  assert.equal(hubPortalAt('courtyard', triggerPoint)?.destination, 'mortuary')
  assert.equal(hubPortalAt('library', triggerPoint), undefined)
})
