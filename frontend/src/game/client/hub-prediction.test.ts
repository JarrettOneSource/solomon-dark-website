import assert from 'node:assert/strict'
import test from 'node:test'

import { hubCollegeIntroUnstarted } from '../core-kernels/hub-participant-movement.ts'
import {
  createHubCollegeIntroParticipantState,
  type HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import { NATIVE_COLLEGE_COURTYARD_PATH } from '../core-kernels/native-college-intro.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  createPlayerCharacter,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import { createHubWorld, stepHubWorldTick, type HubWorldState } from '../core-server/hub-world.ts'
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
