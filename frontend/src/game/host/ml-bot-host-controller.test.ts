import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

import { WebSocket } from 'ws'

import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
  type ServerLuaResultMessage,
  type ServerPartyStateMessage,
  type ServerWelcomeMessage,
} from '../protocol/game-protocol.ts'
import { BoneyardHeadlessEnvironment } from '../headless/boneyard-headless-environment.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import {
  getPlayerEconomy,
  getPlayerProgression,
} from '../core-server/game-simulation.ts'
import { playerSkillBookAt } from '../core-server/player-entity-store.ts'
import { ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES } from '../core-server/ml-bot-policy/spec.ts'
import type { MlBotPolicyInference } from './ml-bot-host-controller.ts'
import {
  ML_BOT_CHARACTER,
  MlBotHostController,
  MlBotPolicyInferenceWorker,
} from './ml-bot-host-controller.ts'
import { startGameHost } from './game-host.ts'

const require = createRequire(import.meta.url)
const luaWasmPath = require.resolve('wasmoon/dist/glue.wasm')
const EMPTY_CONTENT = {
  assets: [],
  boneyards: [],
  compiledMods: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] },
  modSources: [],
  summary: { manifestSha256: '0'.repeat(64), mods: [] },
} as const
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Developer',
  element: 'ether',
} as const

const idlePolicy: MlBotPolicyInference = {
  choiceMode: 'scripted',
  async infer(_observation, plan) {
    const target = firstLegal(plan.target)
    const ability = firstLegal(plan.abilityByTarget[target]!)
    return {
      actions: {
        ability,
        aim: firstLegal(plan.aimByAbility[ability]!),
        movement: firstLegal(plan.movement),
        target,
      },
      logProbability: 0,
      value: 0,
    }
  },
  async inferChoice() {
    throw new Error('scripted test policy does not infer choices')
  },
}

test('the packaged selected checkpoint loads in the host worker and returns legal actions', async () => {
  const worker = await MlBotPolicyInferenceWorker.create(
    await readFile('server-assets/ml-bot-policy-v7-selected.sdml'),
  )
  try {
    const environment = new BoneyardHeadlessEnvironment({
      agent: ML_BOT_CHARACTER,
      seed: 0x5eed_0001,
    })
    const plan = environment.actionMaskPlan()
    const result = await worker.infer(environment.observe(), plan)
    assert.equal(plan.movement[result.actions.movement], 1)
    assert.equal(plan.target[result.actions.target], 1)
    assert.equal(plan.abilityByTarget[result.actions.target]![result.actions.ability], 1)
    assert.equal(plan.aimByAbility[result.actions.ability]![result.actions.aim], 1)
  } finally {
    await worker.close()
  }
})

test('learned checkpoints select live host skill offers through the choice head', async () => {
  const environment = new BoneyardHeadlessEnvironment({
    agent: ML_BOT_CHARACTER,
    seed: 0x1234_5678,
  })
  for (let decision = 0; environment.state().levelUpBarrier === null && decision < 2_000; decision += 1) {
    const action = environment.expertAction()
    environment.step(Float32Array.from([
      action.movement,
      action.target,
      action.ability,
      action.aim,
    ]), 10)
  }
  assert.notEqual(environment.state().levelUpBarrier, null)
  const intents: unknown[] = []
  let evaluatedOptions = 0
  const learnedPolicy: MlBotPolicyInference = {
    choiceMode: 'learned',
    async infer() {
      throw new Error('main inference is not expected while a skill offer is pending')
    },
    async inferChoice(_observation, optionDescriptors, optionMask) {
      evaluatedOptions = optionMask.length
      assert.equal(
        optionDescriptors.length,
        optionMask.length * ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length,
      )
      return {
        logProbability: -0.5,
        selectedOption: optionMask.length - 1,
        value: 1.25,
      }
    },
  }
  const controller = new MlBotHostController({
    context: () => ({
      activeInputs: {},
      controllers: { agent: 'bot' },
      state: environment.state(),
    }),
    dispatch: intent => intents.push(intent),
    fail: error => { throw error },
  }, ML_BOT_CHARACTER, learnedPolicy, 'agent')
  controller.tick()
  await waitFor(() => intents.length === 1)
  assert.ok(evaluatedOptions > 1)
  const offer = getPlayerProgression(environment.state(), 'agent').pendingOffer
  assert.ok(offer)
  assert.deepEqual(intents[0], {
    choiceIndex: evaluatedOptions - 1,
    kind: 'select-skill',
    offerSequence: offer.sequence,
    skillId: offer.options[evaluatedOptions - 1]?.skillId,
  })
  controller.tick()
  await delay(0)
  assert.equal(intents.length, 1)
})

test('developer Lua summons repeatable inert participants that accept a real party invite after three seconds', async (context) => {
  const tickets = new Map([
    ['developer-ticket', {
      content: EMPTY_CONTENT,
      developerAccess: true,
      leaderboardUserId: 1,
    }],
  ])
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => tickets.get(credential) ?? null,
    },
    luaWasmPath,
    leaderboardReceiptSecret: 'developer-bot-leaderboard-secret-that-is-long-enough',
    mlBotPolicy: idlePolicy,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => closeSocket(socket))
  const welcome = await hello(socket, 'developer-ticket')
  assert.equal(welcome.developerAccess, true)
  assert.equal(host.humanPlayerCount(), 1)

  const first = await executeLua(socket, 1, 'return sd.bots.summon()')
  const second = await executeLua(
    socket,
    2,
    'return sd.bots.summon({ element = "air", discipline = "mind" })',
  )
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  await waitFor(() => host.botCount() === 2)
  assert.equal(host.humanPlayerCount(), 1)
  assert.equal(host.playerCount(), 3)
  assert.equal(host.hubPlayerCount(), 3)
  const botPlayerIds = host.botPlayerIds()
  assert.equal(new Set(botPlayerIds).size, 2)
  assert.deepEqual(first.values[0], {
    display_name: 'Policy Bot 1',
    player_id: botPlayerIds[0],
  })
  assert.deepEqual(second.values[0], {
    display_name: 'Policy Bot 2',
    player_id: botPlayerIds[1],
  })
  const invalid = await executeLua(
    socket,
    3,
    'return sd.bots.summon({ element = "void" })',
  )
  assert.equal(invalid.ok, false)
  assert.match(invalid.error ?? '', /unsupported bot element/)
  assert.equal(host.botCount(), 2)
  const grants = await executeLua(socket, 4, `
    sd.dev.grant_gold(250, '${botPlayerIds[0]}')
    sd.dev.grant_item('health-potion', 3, '${botPlayerIds[0]}')
    sd.dev.grant_item('equipment:0', 1, '${botPlayerIds[0]}')
    sd.dev.grant_skill(72, 2, '${botPlayerIds[0]}')
    sd.dev.grant_weld(1000, '${botPlayerIds[0]}')
    return true
  `)
  assert.equal(grants.ok, true, grants.error ?? 'developer grants failed')
  await waitFor(() => {
    const target = host.playerState(botPlayerIds[0]!)
    if (!target) return false
    const economy = getPlayerEconomy(target, botPlayerIds[0]!)
    const skills = playerSkillBookAt(target.playerEntities, botPlayerIds[0]!)
    return economy.gold === 750
      && economy.backpack.some(item => item.kind === 'health-potion' && item.quantity === 4)
      && economy.backpack.some(item => item.recipeIndex === 0)
      && skills?.permanentRanks[72] === 2
      && skills.primarySkillId === 52
      && skills.weldBuildId === 1000
  })
  const secondState = host.playerState(botPlayerIds[1]!)
  assert.ok(secondState)
  const secondIndex = secondState.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === botPlayerIds[1]
  ))
  assert.deepEqual(secondState.playerEntities.configs[secondIndex], {
    discipline: 'mind',
    displayName: 'Policy Bot 2',
    element: 'air',
  })

  const invitedState = nextPartyState(socket, message => (
    message.state.hubPlayers.some(player => player.playerId === botPlayerIds[0])
    && message.state.party.memberPlayerIds.length === 1
  ))
  const joinedState = nextPartyState(socket, message => (
    message.state.party.memberPlayerIds.includes(botPlayerIds[0]!)
  ), 5_000)
  socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: botPlayerIds[0]!,
  }))
  const invited = await invitedState
  assert.deepEqual(invited.state.party.memberPlayerIds, [welcome.playerId])
  const acceptedEarly = await Promise.race([
    joinedState.then(() => true),
    delay(2_500).then(() => false),
  ])
  assert.equal(acceptedEarly, false)
  const joined = await joinedState
  assert.deepEqual(joined.state.party.memberPlayerIds, [welcome.playerId, botPlayerIds[0]])

  const loaded = nextMessage(socket, message => message.type === 'server-boneyard-loaded')
  socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: welcome.boneyards[0]!.id,
  }))
  await loaded
  await waitFor(() => host.playerState(welcome.playerId)?.world.kind === 'boneyard')
  const carried = host.playerState(botPlayerIds[0]!)
  assert.ok(carried)
  assert.equal(getPlayerEconomy(carried, botPlayerIds[0]!).gold, 750)
  assert.equal(
    playerSkillBookAt(carried.playerEntities, botPlayerIds[0]!)?.weldBuildId,
    1000,
  )
  const inRunGrant = await executeLua(
    socket,
    5,
    `return sd.dev.grant_gold(1, '${botPlayerIds[0]}')`,
  )
  assert.equal(inRunGrant.ok, true, inRunGrant.error ?? 'in-run developer grant failed')
  await waitFor(() => {
    const target = host.playerState(botPlayerIds[0]!)
    return target !== null && getPlayerEconomy(target, botPlayerIds[0]!).gold === 751
  })
  const leaderboardReceipt = nextMessage(socket, message => (
    message.type === 'server-leaderboard-receipt'
  ))
  const active = host.playerState(welcome.playerId)
  assert.ok(active)
  Object.assign(active.run, {
    gameOverEventId: 1,
    gameOverTicks: NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick - 1,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
  const ranked = await leaderboardReceipt
  assert.equal(ranked.type, 'server-leaderboard-receipt')
  const [payloadPart] = ranked.receipt.split('.')
  assert.equal(JSON.parse(Buffer.from(payloadPart!, 'base64url').toString('utf8')).userId, 1)

  await closeSocket(socket)
  await waitFor(() => host.humanPlayerCount() === 0 && host.botCount() === 0)
  assert.equal(host.playerCount(), 0)
})

test('ordinary shared-Hub admissions cannot invoke developer Lua or summon bots', async (context) => {
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'ordinary-ticket'
        ? { content: EMPTY_CONTENT, developerAccess: false, leaderboardUserId: null }
        : null,
    },
    luaWasmPath,
    mlBotPolicy: idlePolicy,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => closeSocket(socket))
  const welcome = await hello(socket, 'ordinary-ticket')
  assert.equal(welcome.developerAccess, false)
  const result = await executeLua(socket, 1, 'return sd.bots.summon()')
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /unavailable on the shared Hub/)
  assert.equal(host.botCount(), 0)
})

function firstLegal(mask: Uint8Array): number {
  const index = mask.findIndex(value => value === 1)
  if (index < 0) throw new Error('test policy received an empty mask')
  return index
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

async function hello(socket: WebSocket, credential: string): Promise<ServerWelcomeMessage> {
  const welcome = nextMessage(socket, message => message.type === 'server-welcome')
  socket.send(encodeGameMessage({
    character: CHARACTER,
    cheatsEnabled: false,
    credential,
    profile: { accountUsername: 'Generic', highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: 'client-hello',
  }))
  return await welcome as ServerWelcomeMessage
}

async function executeLua(
  socket: WebSocket,
  requestId: number,
  code: string,
): Promise<ServerLuaResultMessage> {
  const result = nextMessage(socket, message => (
    message.type === 'server-lua-result' && message.requestId === requestId
  ))
  socket.send(encodeGameMessage({ type: 'client-lua-execute', code, requestId }))
  return await result as ServerLuaResultMessage
}

function nextPartyState(
  socket: WebSocket,
  predicate: (message: ServerPartyStateMessage) => boolean,
  timeoutMs = 10_000,
): Promise<ServerPartyStateMessage> {
  return nextMessage(socket, message => (
    message.type === 'server-party-state' && predicate(message)
  ), timeoutMs) as Promise<ServerPartyStateMessage>
}

function nextMessage(
  socket: WebSocket,
  predicate: (message: ServerGameMessage) => boolean,
  timeoutMs = 10_000,
): Promise<ServerGameMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('timed out waiting for server message')), timeoutMs)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (predicate(message)) finish(message)
    }
    const fail = (error: Error) => finish(error)
    const finish = (result: Error | ServerGameMessage) => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise(resolve => {
    socket.once('close', resolve)
    socket.close(1_000, 'test complete')
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('timed out waiting for host state')
    await delay(10)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
