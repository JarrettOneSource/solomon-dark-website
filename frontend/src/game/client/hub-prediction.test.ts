import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  HUB_STORY_OFFICE_POLISHER_ACTOR,
  hubCollegeIntroUnstarted,
  hubFixedActor,
  type HubRegionPhysicsBody,
} from '../core-kernels/hub-participant-movement.ts'
import {
  createHubCollegeIntroParticipantState,
  isHubRegionTraversable,
  type HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import { NATIVE_COLLEGE_COURTYARD_PATH } from '../core-kernels/native-college-intro.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  createIdlePlayerCharacterInput,
  createPlayerCharacter,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import { createHubWorld, stepHubWorldTick, type HubWorldState } from '../core-server/hub-world.ts'
import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import { createHubSkorchaAtVariant, type HubSkorchaState } from '../core-server/hub-skorcha.ts'
import { predictPlayerCharacterInHub } from './hub-prediction.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const
const IDLE_INPUT = { movement: { x: 0, y: 0 } } as const
const PENDING = new Set(['local'])

function serverStep(
  world: HubWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  collegeIntroReadyPlayerIds: ReadonlySet<string>,
) {
  return stepHubWorldTick(
    world,
    players,
    { local: IDLE_INPUT },
    { local: 1 },
    collegeIntroReadyPlayerIds,
    PENDING,
  )
}

function predict(
  player: PlayerCharacterState,
  participant: HubParticipantState,
  collisionRngState: number,
) {
  return predictPlayerCharacterInHub(player, IDLE_INPUT, collisionRngState, 1, participant, {
    collegeIntroPending: true,
    collegeIntroWaiting: hubCollegeIntroUnstarted(participant),
  })
}

function collegeWorld(): { players: Record<string, PlayerCharacterState>; world: HubWorldState } {
  return {
    players: { local: createPlayerCharacter(CHARACTER, NATIVE_COLLEGE_COURTYARD_PATH[0]) },
    world: {
      ...createHubWorld(['local'], { skorcha: null, skorchaHiddenTicks: 1_000_000 }),
      participants: { local: createHubCollegeIntroParticipantState() },
    },
  }
}

test('client prediction reproduces the server tick for tick through the College admission', () => {
  let { players, world } = collegeWorld()

  for (let tick = 0; tick < 3; tick += 1) {
    assert.equal(hubCollegeIntroUnstarted(world.participants.local), true)
    const predicted = predict(players.local, world.participants.local, world.collisionRngState)
    ;({ players, world } = serverStep(world, players, new Set()))
    assert.deepEqual(predicted.player, players.local, `held tick ${tick}`)
    assert.deepEqual(predicted.participant, world.participants.local, `held tick ${tick}`)
  }

  // The ready report lands between two snapshots, so the client trails the
  // first walking tick and catches up from the next snapshot onwards.
  ;({ players, world } = serverStep(world, players, PENDING))
  assert.equal(hubCollegeIntroUnstarted(world.participants.local), false)

  const stages = new Set<string>()
  let ticks = 0
  for (; ticks < 5_000; ticks += 1) {
    const participant = world.participants.local
    if (participant.collegeIntro?.phase === 'arch-dialogue') break
    stages.add(`${participant.collegeIntro?.phase}:${participant.transition?.phase ?? 'none'}`)
    const predicted = predict(players.local, participant, world.collisionRngState)
    ;({ players, world } = serverStep(world, players, PENDING))
    assert.deepEqual(predicted.player, players.local, `tick ${ticks}`)
    assert.deepEqual(predicted.participant, world.participants.local, `tick ${ticks}`)
    assert.equal(predicted.collisionRngState, world.collisionRngState, `tick ${ticks}`)
  }
  assert.equal(world.participants.local.collegeIntro?.phase, 'arch-dialogue')
  assert.deepEqual([...stages], [
    'courtyard-walk:none',
    'courtyard-walk:outgoing',
    'office-walk:incoming',
    'office-walk:none',
  ])

  for (let tick = 0; tick < 5; tick += 1) {
    const predicted = predict(players.local, world.participants.local, world.collisionRngState)
    ;({ players, world } = serverStep(world, players, PENDING))
    assert.deepEqual(predicted.player, players.local, `dialogue tick ${tick}`)
    assert.deepEqual(predicted.participant, world.participants.local, `dialogue tick ${tick}`)
  }
})

test('client prediction blocks on the Archchancellor like the server before the dialogue', () => {
  let { players, world } = collegeWorld()
  let blockedTicks = 0
  for (let tick = 0; tick < 5_000; tick += 1) {
    const participant = world.participants.local
    if (participant.collegeIntro?.phase === 'arch-dialogue') break
    const predicted = predict(players.local, participant, world.collisionRngState)
    const before = players.local.position
    ;({ players, world } = serverStep(world, players, PENDING))
    if (
      participant.collegeIntro?.phase === 'office-walk'
      && participant.transition === null
      && Math.hypot(players.local.position.x - before.x, players.local.position.y - before.y) < 0.2
    ) {
      blockedTicks += 1
      assert.deepEqual(predicted.player.position, players.local.position, `blocked tick ${tick}`)
    }
  }
  assert.ok(blockedTicks > 0, 'the desk never blocked the walker')
})

test('client prediction begins a portal transition where the server would', () => {
  // One tick of northbound travel brings the player onto the Office door trigger.
  const player = createPlayerCharacter(CHARACTER, { x: 952.5, y: 115.5 + PLAYER_CHARACTER_RADIUS + 0.5 })
  const world = { ...createHubWorld(['local'], { skorcha: null, skorchaHiddenTicks: 1_000_000 }) }
  const players = { local: { ...player, velocity: { x: 0, y: -90 } } }
  const stepped = stepHubWorldTick(
    world,
    players,
    { local: { movement: { x: 0, y: -1 } } },
    { local: 1 },
    null,
    null,
  )
  const predicted = predictPlayerCharacterInHub(
    players.local,
    { movement: { x: 0, y: -1 } },
    world.collisionRngState,
    1,
    world.participants.local,
  )
  assert.equal(stepped.world.participants.local.transition?.phase, 'outgoing')
  assert.deepEqual(predicted.participant, stepped.world.participants.local)
  assert.deepEqual(predicted.player.position, stepped.players.local.position)
})

test('ordinary Hub prediction respects the annalist and bench contact before reversing out', () => {
  const start = { x: 874, y: 500 }
  let world = createHubWorld(['local'], {
    skorcha: null,
    skorchaHiddenTicks: 1_000_000,
    studentPopulation: createHubStudentFixturePopulation({ count: 0 }),
  })
  let players = { local: createPlayerCharacter(CHARACTER, start) }
  let contactedAnnalist = false
  const phases = [
    { name: 'approach', ticks: 180, movement: { x: 0, y: -1 } },
    { name: 'release', ticks: 40, movement: { x: 0, y: 0 } },
    { name: 'reverse', ticks: 180, movement: { x: 0, y: 1 } },
    { name: 'release after reversing', ticks: 40, movement: { x: 0, y: 0 } },
  ]

  for (const phase of phases) {
    for (let tick = 0; tick < phase.ticks; tick += 1) {
      const input = { ...createIdlePlayerCharacterInput(), movement: phase.movement }
      const predicted = predictPlayerCharacterInHub(
        players.local,
        input,
        world.collisionRngState,
        1,
        world.participants.local,
      )
      const stepped = stepHubWorldTick(world, players, { local: input }, { local: 1 })
      const authority = stepped.players.local
      const annalistDistance = Math.hypot(
        authority.position.x - 895.5,
        authority.position.y - 455.5,
      )
      assert.ok(annalistDistance >= PLAYER_CHARACTER_RADIUS + 8, `${phase.name} tick ${tick}`)
      contactedAnnalist ||= annalistDistance <= PLAYER_CHARACTER_RADIUS + 8.11
      assert.deepEqual(predicted.player, authority, `${phase.name} tick ${tick}`)
      assert.deepEqual(predicted.participant, stepped.world.participants.local)
      assert.equal(predicted.collisionRngState, stepped.world.collisionRngState)
      players = { local: authority }
      world = stepped.world
    }
  }

  assert.equal(contactedAnnalist, true, 'the approach must exercise the fixed NPC contact')
  assert.ok(players.local.position.y > start.y, 'reverse input must move back out of the contact')
})

function assertFixedBodyPrediction(
  actor: Pick<HubRegionPhysicsBody, 'id' | 'position' | 'radius' | 'region'>,
  collegeIntroPending = false,
  skorcha: HubSkorchaState | null = null,
): void {
  let exercisedStarts = 0
  let contacted = false
  // Library shelf1 has a narrow valid approach between its expanded contour
  // and the outer wall; the authored330-degree approach is missed by22.5-degree steps.
  for (let direction = 0; direction < 24; direction += 1) {
    const angle = direction * Math.PI / 12
    const radius = PLAYER_CHARACTER_RADIUS + actor.radius + 4
    const start = {
      x: actor.position.x + Math.cos(angle) * radius,
      y: actor.position.y + Math.sin(angle) * radius,
    }
    if (!isHubRegionTraversable(actor.region, start)) continue
    if (HUB_FIXED_ACTOR_COLLISION_LAYOUT.some(other => (
      other.region === actor.region && other.id !== actor.id
      && Math.hypot(start.x - other.position.x, start.y - other.position.y)
        < PLAYER_CHARACTER_RADIUS + other.radius
    ))) continue
    exercisedStarts += 1
    let world = createHubWorld(['local'], {
      skorcha,
      skorchaHiddenTicks: 1_000_000,
      skorchaVisibleTicks: 1_000_000,
      studentPopulation: createHubStudentFixturePopulation({ count: 0 }),
    })
    world = { ...world, participants: {
      local: { ...world.participants.local, region: actor.region },
    } }
    let players = { local: createPlayerCharacter(CHARACTER, start) }
    const input = { ...createIdlePlayerCharacterInput(),
      movement: { x: -Math.cos(angle), y: -Math.sin(angle) } }
    for (let tick = 0; tick < 70; tick += 1) {
      const predicted = predictPlayerCharacterInHub(
        players.local, input, world.collisionRngState, 1, world.participants.local,
        { collegeIntroPending, skorchaPosition: world.skorcha?.position ?? null },
      )
      const stepped = stepHubWorldTick(
        world, players, { local: input }, { local: 1 }, null,
        collegeIntroPending ? new Set(['local']) : null,
      )
      assert.deepEqual(predicted.player, stepped.players.local, `${actor.id} approach ${direction} tick ${tick}`)
      assert.deepEqual(predicted.participant, stepped.world.participants.local)
      assert.equal(predicted.collisionRngState, stepped.world.collisionRngState)
      const position = stepped.players.local.position
      contacted ||= Math.hypot(position.x - actor.position.x, position.y - actor.position.y)
        <= PLAYER_CHARACTER_RADIUS + actor.radius + 0.11
      players = { local: stepped.players.local }
      world = stepped.world
    }
  }
  assert.ok(exercisedStarts > 0, `${actor.id} has no valid authored approach fixture`)
  assert.ok(contacted, `${actor.id} approaches did not exercise the fixed circle`)
}

for (const actor of HUB_FIXED_ACTOR_COLLISION_LAYOUT) {
  test(`ordinary prediction matches fixed ${actor.region} body ${actor.id}`, () => {
    assertFixedBodyPrediction(actor)
  })
}

test('ordinary Office prediction includes its polisher only during pending admission', () => {
  assertFixedBodyPrediction(HUB_STORY_OFFICE_POLISHER_ACTOR, true)
  assertFixedBodyPrediction(HUB_STORY_OFFICE_POLISHER_ACTOR, false)
})

for (const variant of [0, 1, 2] as const) {
  test(`ordinary prediction matches present Skorcha placement ${variant}`, () => {
    const skorcha = createHubSkorchaAtVariant(createNativeRng(123), variant)
    assertFixedBodyPrediction(hubFixedActor('skorcha', 'courtyard', skorcha.position.x, skorcha.position.y, 10), false, skorcha)
  })
}
