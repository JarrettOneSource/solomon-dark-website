import assert from 'node:assert/strict'
import test from 'node:test'

import {
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  stepGameSimulationTick,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import { earthImpactLifetimeTicks } from '../core-kernels/primary-spell-earth.ts'
import { EARTH_BOULDER_IDENTITY_ORIENTATION } from '../core-kernels/primary-spell-earth-orientation.ts'
import {
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import { ETHER_PRIMARY_INITIAL_TURN } from '../core-kernels/primary-spell-targeting.ts'
import { nativeInitialGolemArticulation } from '../core-kernels/native-secondary-golem.ts'
import {
  createNativeSecondaryPlayerState,
  createNativeSecondarySimulation,
  triggerNativePlayerMindblast,
} from '../core-kernels/native-secondary-abilities.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeEnemyPathState } from '../core-kernels/native-enemy-pathfinding.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import type { BoneyardEnemySemanticEvent } from '../core-server/boneyard-enemy-store.ts'
import { spawnBoneyardLootSpecs } from '../core-server/boneyard-loot-store.ts'
import {
  coldSlowPlayerEntity,
  dazzlePlayerEntity,
} from '../core-server/player-entity-store.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_CHAT_MAX_TEXT_CODE_UNITS,
  GAME_PROTOCOL_VERSION,
  MAX_LUA_CONSOLE_CODE_LENGTH,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  decodeServerGameMessage,
  encodeGameMessage,
  type LoadedBoneyard,
  type ServerWelcomeMessage,
} from './game-protocol.ts'
import { createGameSnapshotFrame } from './entity-replication.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const
const ACTOR_LIGHT_REGISTRATION = {
  managerLane: 'actor' as const,
  registrationOrdinal: 1,
}
const TRANSIENT_LIGHT_REGISTRATION = {
  managerLane: 'transient' as const,
  registrationOrdinal: 0,
}

function loadedBoneyardFixture(runId: string): LoadedBoneyard {
  return {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    geometrySha256: '2'.repeat(64),
    runId,
    scene: {
      bounds: { h: 1_200, w: 1_600, x: 0, y: 0 },
      environmentMode: 2,
      fences: [],
      name: 'Lifecycle Arena',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 200, y: 150 },
      sprites: [],
      terrain: [],
    },
    seed: '0123456789abcdef',
    sourceSha256: '1'.repeat(64),
  }
}

test('client protocol validates character, input, lifecycle, Lua, and ping messages', () => {
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-observer-hello',
    credential: 'observer-secret',
    protocolVersion: GAME_PROTOCOL_VERSION,
  })), {
    type: 'client-observer-hello',
    credential: 'observer-secret',
    protocolVersion: GAME_PROTOCOL_VERSION,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-cheat-mode',
    enabled: true,
  })), {
    type: 'client-cheat-mode',
    enabled: true,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: 8,
    slot: 7,
  })), { type: 'client-skill-quickbar-bind', skillId: 8, slot: 7 })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-select-primary-skill',
    skillId: 8,
  })), { type: 'client-select-primary-skill', skillId: 8 })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-select-concentration',
    skillId: 57,
  })), { type: 'client-select-concentration', skillId: 57 })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-select-concentration-slot',
    skillId: 57,
    slot: 1,
  })), { type: 'client-select-concentration-slot', skillId: 57, slot: 1 })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'return sd.runtime.get_frame_state()',
    requestId: 9,
  })), {
    type: 'client-lua-execute',
    code: 'return sd.runtime.get_frame_state()',
    requestId: 9,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    resumeToken: 'reserved-token',
  })), {
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    resumeToken: 'reserved-token',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-input',
    input: {
      aim: { x: 800, y: 450 },
      cast: { primary: true, quickbar: 7 },
      movement: { x: 1, y: 0 },
      viewportWidth: 1_600,
    },
    sequence: 4,
    targetTick: 19,
  })), {
    type: 'client-input',
    input: {
      aim: { x: 800, y: 450 },
      cast: { primary: true, quickbar: 7 },
      movement: { x: 1, y: 0 },
      viewportWidth: 1_600,
    },
    sequence: 4,
    targetTick: 19,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  })), {
    type: 'client-start-match',
    boneyardId: 'default-random',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-start-tutorial',
  })), { type: 'client-start-tutorial' })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-tutorial-action',
    action: 'inventory-opened',
  })), {
    type: 'client-tutorial-action',
    action: 'inventory-opened',
  })
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-tutorial-action',
    action: 'skip-stage',
  })), /action/)
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-continue-game-over',
    eventId: 7,
    runId: 'run-7',
  })), {
    type: 'client-continue-game-over',
    eventId: 7,
    runId: 'run-7',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-confirm-loadout',
    discipline: 'mind',
    element: 'water',
  })), {
    type: 'client-confirm-loadout',
    discipline: 'mind',
    element: 'water',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'inventory',
  })), {
    type: 'client-gameplay-pause',
    paused: true,
    source: 'inventory',
  })
  for (const activity of ['paused', 'occupied', null] as const) {
    assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
      type: 'client-hub-activity',
      activity,
    })), {
      type: 'client-hub-activity',
      activity,
    })
  }
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex: 2,
    offerSequence: 7,
    skillId: 48,
  })), {
    type: 'client-select-skill',
    choiceIndex: 2,
    offerSequence: 7,
    skillId: 48,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-level-up-action',
    action: 'reroll',
    offerSequence: 8,
  })), {
    type: 'client-level-up-action',
    action: 'reroll',
    offerSequence: 8,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: 12,
  })), {
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: 12,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-ping',
    nonce: 41,
  })), {
    type: 'client-ping',
    nonce: 41,
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-lua-result',
    error: null,
    ok: true,
    output: ['tick\t42'],
    requestId: 9,
    values: [42, true, null, { phase: 'hub', players: ['player-1'] }],
  })), {
    type: 'server-lua-result',
    error: null,
    ok: true,
    output: ['tick\t42'],
    requestId: 9,
    values: [42, true, null, { phase: 'hub', players: ['player-1'] }],
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-pong',
    nonce: 41,
  })), {
    type: 'server-pong',
    nonce: 41,
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-gameplay-pause',
    pause: {
      ownerDisplayName: 'Helvidius',
      ownerPlayerId: 'player-1',
      source: 'skill-book',
    },
  })), {
    type: 'server-gameplay-pause',
    pause: {
      ownerDisplayName: 'Helvidius',
      ownerPlayerId: 'player-1',
      source: 'skill-book',
    },
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-gameplay-pause',
    pause: {
      ownerDisplayName: 'Helvidius',
      ownerPlayerId: 'player-1',
      source: 'skill-selector',
    },
  })), {
    type: 'server-gameplay-pause',
    pause: {
      ownerDisplayName: 'Helvidius',
      ownerPlayerId: 'player-1',
      source: 'skill-selector',
    },
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-gameplay-pause',
    pause: null,
  })), {
    type: 'server-gameplay-pause',
    pause: null,
  })
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-gameplay-pause',
    pause: { ownerDisplayName: '', ownerPlayerId: 'player-1', source: 'pause-menu' },
  })), /ownerDisplayName/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-gameplay-pause',
    paused: true,
  })), /source/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'dialogue',
  })), /source/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hub-activity',
    activity: 'inventory',
  })), /activity/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hub-activity',
  })), /activity/)
})

test('protocol 70 retains exact A or B slots for HUD concentration replacement', () => {
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-select-concentration-slot',
    skillId: 57,
  })), /slot/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-select-concentration-slot',
    skillId: 57,
    slot: 2,
  })), /out of range/)
  assert.deepEqual(decodeClientGameMessage(JSON.stringify({
    type: 'client-select-concentration',
    skillId: 57,
  })), { type: 'client-select-concentration', skillId: 57 })
})

test('server protocol carries only one bounded opaque leaderboard receipt', () => {
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-leaderboard-receipt',
    receipt: 'payload.signature',
  })), {
    type: 'server-leaderboard-receipt',
    receipt: 'payload.signature',
  })
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-leaderboard-receipt',
    receipt: 'x'.repeat(4_097),
  })), /receipt/)
})

test('protocol v42 bounds Lua requests and structured results by wire bytes and shape', () => {
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-lua-execute',
    code: '😀'.repeat(MAX_LUA_CONSOLE_CODE_LENGTH / 4 + 1),
    requestId: 1,
  })), GameProtocolError)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-lua-execute',
    code: '\\'.repeat(MAX_LUA_CONSOLE_CODE_LENGTH / 2),
    requestId: 1,
  })), GameProtocolError)
  for (const requestId of [0, -1, 0x8000_0000]) {
    assert.throws(() => decodeClientGameMessage(JSON.stringify({
      type: 'client-lua-execute',
      code: 'return true',
      requestId,
    })), GameProtocolError)
  }

  assert.deepEqual(decodeServerGameMessage(JSON.stringify({
    type: 'server-lua-result',
    error: null,
    ok: true,
    output: [''],
    requestId: 1,
    values: ['', null],
  })), {
    type: 'server-lua-result',
    error: null,
    ok: true,
    output: [''],
    requestId: 1,
    values: ['', null],
  })

  const deep: Record<string, unknown> = {}
  let cursor = deep
  for (let depth = 0; depth < 18; depth += 1) {
    cursor.next = {}
    cursor = cursor.next as Record<string, unknown>
  }
  const tooManyNodes = Array.from(
    { length: 128 },
    () => Array.from({ length: 16 }, () => 1),
  )
  for (const [label, malformed] of [
    ['success with error', { error: 'failed', ok: true, output: [], values: [] }],
    ['failure without error', { error: null, ok: false, output: [], values: [] }],
    ['aggregate output', { error: null, ok: true, output: ['x'.repeat(4_096), 'x'.repeat(4_096), 'x'.repeat(4_096), 'x'.repeat(4_096), 'x'], values: [] }],
    ['aggregate returns', { error: null, ok: true, output: [], values: ['x'.repeat(12_288), 'x'.repeat(12_288)] }],
    ['value depth', { error: null, ok: true, output: [], values: [deep] }],
    ['value nodes', { error: null, ok: true, output: [], values: [tooManyNodes] }],
  ] as const) {
    assert.throws(() => decodeServerGameMessage(JSON.stringify({
      type: 'server-lua-result',
      requestId: 1,
      ...malformed,
    })), GameProtocolError, label)
  }
})

test('protocol v69 accepts every authoritative inventory and contextual action and rejects malformed variants', () => {
  const actions = [
    { type: 'buy-dowsing', offerId: 1 },
    { type: 'buy-fomentius', itemId: 2 },
    { type: 'buy-hagatha', selector: -1 },
    { type: 'close-dowsing' },
    { type: 'consume', itemId: 5 },
    { type: 'dye', dyeItemId: 7, layer: 'cloth', swatchRows: [1, 9, 5], targetItemId: 8 },
    { type: 'dowse' },
    { type: 'equip', itemId: 3, slot: 'ring-2' },
    { type: 'interact-goodie' },
    { type: 'move-inventory-item', destinationSackId: 10, itemId: 9 },
    { type: 'move-inventory-item', destinationSackId: null, itemId: 9 },
    { type: 'transfer', direction: 'to-storage', gesture: 'drag', itemId: 4 },
    { type: 'transfer', direction: 'to-backpack', gesture: 'double-activation', itemId: 4 },
    { type: 'unforge', itemId: 6 },
    { type: 'unequip', slot: 'weapon' },
  ] as const
  for (const action of actions) {
    assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
      type: 'client-hub-action',
      action,
    })), { type: 'client-hub-action', action })
  }

  for (const action of [
    { type: 'buy-hagatha', selector: 8 },
    { type: 'dye', dyeItemId: 1, layer: 'lining', swatchRows: [1], targetItemId: 2 },
    { type: 'dye', dyeItemId: 1, layer: 'trim', swatchRows: [], targetItemId: 2 },
    { type: 'dye', dyeItemId: 1, layer: 'trim', swatchRows: [18], targetItemId: 2 },
    { type: 'equip', itemId: 1, slot: 'boots' },
    { type: 'move-inventory-item', destinationSackId: 0, itemId: 1 },
    { type: 'transfer', direction: 'sell', gesture: 'drag', itemId: 1 },
    { type: 'transfer', direction: 'to-storage', gesture: 'double-activation', itemId: 1 },
    { type: 'dowse', offerId: 1 },
    { type: 'sell-fomentius', itemId: 1 },
  ]) {
    assert.throws(() => decodeClientGameMessage(JSON.stringify({
      type: 'client-hub-action',
      action,
    })), GameProtocolError)
  }
})

test('server welcome round-trips content, kernel, character, and world ownership', () => {
  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    developerAccess: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    sessionKind: 'standalone',
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: {
      manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256,
      mods: [],
    },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(
      createGameSimulation({ 'player-1': CHARACTER }),
      'player-1',
    ),
    snapshotSequence: 1,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)
  const observerWelcome: ServerWelcomeMessage = { ...welcome, observer: true }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(observerWelcome)),
    observerWelcome,
  )
  const assetWelcome: ServerWelcomeMessage = {
    ...welcome,
    modAssets: [{
      byteLength: 68,
      modId: 'tests.content',
      path: 'sprites/item.png',
      sha256: 'a'.repeat(64),
    }],
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(assetWelcome)), assetWelcome)
  assert.throws(() => decodeServerGameMessage(encodeGameMessage({
    ...assetWelcome,
    modAssets: [{ ...assetWelcome.modAssets[0]!, sha256: 'not-a-hash' }],
  })), /SHA-256/)
  assert.deepEqual(welcome.snapshot.players['player-1'].config, CHARACTER)
  assert.equal(welcome.snapshot.players['player-1'].economy.gold, 500)
  assert.equal(welcome.snapshot.players['player-1'].economy.fomentiusStock.length > 0, true)
  const player = welcome.snapshot.players['player-1']
  const feedbackWelcome = {
    ...welcome,
    snapshot: {
      ...welcome.snapshot,
      players: {
        ...welcome.snapshot.players,
        'player-1': {
          ...player,
          economy: {
            ...player.economy,
            actionFeedback: {
              accepted: true,
              action: 'dowse',
              dowsingPitch: 0.875,
              reason: null,
              sequence: 1,
              transferDirection: null,
              transferGesture: null,
              unforgeOutcome: null,
            },
          },
        },
      },
    },
  } as const
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(feedbackWelcome)), feedbackWelcome)
  const robeRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'robe')!
  const dyedRobe = {
    equipmentType: 'robe' as const,
    iconRecords: robeRecipe.iconRecords,
    iconTints: [0x6d363e, robeRecipe.iconTints[1]] as const,
    id: 900_002,
    kind: 'equipment' as const,
    name: robeRecipe.name,
    nativeSubtype: null,
    nativeTypeId: robeRecipe.nativeTypeId,
    quantity: 1,
    rarity: robeRecipe.rarity,
    recipeIndex: robeRecipe.sourceIndex,
  }
  const dyeFeedbackWelcome = {
    ...welcome,
    snapshot: {
      ...welcome.snapshot,
      players: {
        ...welcome.snapshot.players,
        'player-1': {
          ...player,
          economy: {
            ...player.economy,
            actionFeedback: {
              accepted: true,
              action: 'dye',
              dowsingPitch: null,
              reason: null,
              sequence: 2,
              transferDirection: null,
              transferGesture: null,
              unforgeOutcome: null,
            },
            backpack: [...player.economy.backpack, {
              contents: [dyedRobe],
              equipmentType: null,
              iconRecords: [70],
              id: 900_001,
              kind: 'sack',
              name: 'Sack',
              nativeSubtype: 0,
              nativeTypeId: 7008,
              quantity: 1,
              rarity: null,
              recipeIndex: null,
            }],
          },
        },
      },
    },
  } as const
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(dyeFeedbackWelcome)),
    dyeFeedbackWelcome,
  )
  const sackChain = (deepestDepth: number): HubInventoryItem => {
    let item: HubInventoryItem | null = null
    for (let depth = deepestDepth; depth >= 0; depth -= 1) {
      item = {
        contents: item === null ? [] : [item],
        equipmentType: null,
        iconRecords: [70],
        id: 910_000 + depth,
        kind: 'sack',
        name: `Sack ${depth}`,
        nativeSubtype: 0,
        nativeTypeId: 7008,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      }
    }
    return item!
  }
  const nestedWelcome = (deepestDepth: number) => ({
    ...welcome,
    snapshot: {
      ...welcome.snapshot,
      players: {
        ...welcome.snapshot.players,
        'player-1': {
          ...player,
          economy: { ...player.economy, backpack: [sackChain(deepestDepth)] },
        },
      },
    },
  })
  const maximumDepthWelcome = nestedWelcome(HUB_SACK_REPLICATION_DEPTH_LIMIT)
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(maximumDepthWelcome)),
    maximumDepthWelcome,
  )
  assert.throws(() => decodeServerGameMessage(encodeGameMessage(
    nestedWelcome(HUB_SACK_REPLICATION_DEPTH_LIMIT + 1),
  )), /bounded native Sack depth/)
  assert.throws(() => decodeServerGameMessage(encodeGameMessage({
    ...dyeFeedbackWelcome,
    snapshot: {
      ...dyeFeedbackWelcome.snapshot,
      players: {
        ...dyeFeedbackWelcome.snapshot.players,
        'player-1': {
          ...dyeFeedbackWelcome.snapshot.players['player-1'],
          economy: {
            ...dyeFeedbackWelcome.snapshot.players['player-1'].economy,
            backpack: [{
              ...dyeFeedbackWelcome.snapshot.players['player-1'].economy.backpack.at(-1)!,
              contents: [{ ...dyedRobe, iconTints: [null, robeRecipe.iconTints[1]] }],
            }],
          },
        },
      },
    },
  })), GameProtocolError)
  const unforgeWelcome = {
    ...welcome,
    snapshot: {
      ...welcome.snapshot,
      players: {
        ...welcome.snapshot.players,
        'player-1': {
          ...player,
          economy: {
            ...player.economy,
            actionFeedback: {
              accepted: true,
              action: 'unforge',
              dowsingPitch: null,
              reason: null,
              sequence: 2,
              transferDirection: null,
              transferGesture: null,
              unforgeOutcome: {
                amount: 10,
                itemName: 'Pentaclostic Ring',
                kind: 'maximum-health',
              },
            },
            unforgeBonuses: {
              ...player.economy.unforgeBonuses,
              maximumHealth: 10,
              recipeAttemptCount: 1,
            },
          },
        },
      },
    },
  } as const
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(unforgeWelcome)), unforgeWelcome)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    ...unforgeWelcome,
    snapshot: {
      ...unforgeWelcome.snapshot,
      players: {
        ...unforgeWelcome.snapshot.players,
        'player-1': {
          ...unforgeWelcome.snapshot.players['player-1'],
          economy: {
            ...unforgeWelcome.snapshot.players['player-1'].economy,
            actionFeedback: {
              ...unforgeWelcome.snapshot.players['player-1'].economy.actionFeedback,
              unforgeOutcome: { amount: null, itemName: 'Ring', kind: 'gold' },
            },
          },
        },
      },
    },
  })), GameProtocolError)
  assert.deepEqual(welcome.snapshot.players['player-1'].lighting, {
    driveActive: false,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    overlayEffectPhase: 0,
  })
  assert.deepEqual(welcome.snapshot.players['player-1'].progression, {
    weldBuildId: null,
    weldComponentRanks: null,
    concentrationSkillIds: [null, null],
    currentHealth: 50,
    currentMana: 100,
    coldSlowTicksRemaining: 0,
    deferredSkillChoices: 0,
    dazzleTicksRemaining: 0,
    deathEpoch: 0,
    deathTick: 0,
    experience: 0,
    hagathaRuntime: {
      cheatDeathCharges: 0,
      reverieActive: false,
      serendipityActive: false,
    },
    learnedSkills: [[0, 1, 1], [7, 1, 1], [8, 1, 1], [11, 1, 1]],
    learnedSkillOrder: [8, 11],
    level: 1,
    lifeState: 'alive',
    lastDamageTick: null,
    maximumHealth: 50,
    maximumMana: 100,
    mindChugTicksRemaining: 0,
    nextThreshold: 90,
    pendingOffer: null,
    poisonDamagePerTick: 0,
    poisonTicksRemaining: 0,
    previousThreshold: 0,
    revision: 0,
    selectedPrimarySkillId: 8,
    sorcerorsCharmAvailable: false,
    splitMind: false,
    skillQuickbar: [11, null, null, null, null, null, null, null],
  })
  assert.deepEqual(welcome.snapshot.run, {
    eligiblePlayerIds: [],
    gameOverEventId: 0,
    gameOverExitKind: null,
    gameOverExitTicks: null,
    gameOverTicks: 0,
    lastCompletedRunId: null,
    loadoutReadyPlayerIds: [],
    nextGameOverEventId: 1,
    phase: 'hub',
    runId: null,
  })
  assert.equal(welcome.snapshot.world.kind, 'hub')

  const resumedSnapshot = createGameSnapshot(
    enterBoneyardWorld(
      createGameSimulation({ 'player-1': CHARACTER }),
      loadedBoneyardFixture('maggot-resume'),
    ),
    'player-1',
  )
  if (resumedSnapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  resumedSnapshot.world.maggots = [{
    alpha: 1,
    currentHealth: 1,
    deathEpoch: 0,
    deathTick: 0,
    emergenceOrientation: 0,
    headingDeg: 90,
    hitFlash: 0.6,
    id: 2,
    emergenceTick: 24,
    launchTrajectory: 'edge',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    maximumHealth: 2,
    ownerCoffinActorId: 1,
    pose: 0.5,
    position: { x: 200, y: 300 },
    spawnTick: 10,
    state: 'crawl',
    verticalOffset: 0,
  }]
  const resumedWelcome = {
    ...welcome,
    snapshot: resumedSnapshot,
    snapshotSequence: 2,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(resumedWelcome)),
    resumedWelcome,
  )

  const missingHitFlash = JSON.parse(encodeGameMessage(resumedWelcome))
  delete missingHitFlash.snapshot.world.maggots[0].hitFlash
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingHitFlash)),
    /hitFlash/,
  )
})

test('protocol v42 strictly round-trips projected statuses, lighting, shields, payloads, and effects', () => {
  const loaded = loadedBoneyardFixture('modifier-protocol-run')
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loaded,
  )
  const affected = {
    ...active,
    playerEntities: dazzlePlayerEntity(
      coldSlowPlayerEntity(active.playerEntities, 'player-1', 300),
      'player-1',
      50,
    ),
  }
  const snapshot = createGameSnapshot(affected, 'player-1')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshot.players['player-1']?.progression.coldSlowTicksRemaining, 300)
  assert.equal(snapshot.players['player-1']?.progression.dazzleTicksRemaining, 50)
  snapshot.world.enemies = [{
    animation: {
      action: 'skeleton-claw-a',
      actionProgress: 4,
      alpha: 1,
      bodyPose: 0,
      coffinPose: 0,
      coffinSecondaryPose: null,
      coffinState: 'closed',
      deathEpoch: 0,
      deathTick: 0,
      demonFrontJointRotationRadians: 0,
      demonFrontLimbRotationRadians: 0,
      demonRearJointRotationRadians: 0,
      demonRearLimbRotationRadians: 0,
      effects: [{
        alpha: 1.25,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 49,
        id: 44,
        offset: { x: 0, y: -30 },
        role: 'magic-shield',
        rotationRadians: 0,
        scale: 1.599609375,
      }],
      gaitPose: 0,
      headFacingOffset: -1,
      hitFlash: 0,
      impBodyRotationRadians: 0,
      impEffectAlpha: 0,
      impEffectFrame: -1,
      maggots: [],
      state: 'action',
      verticalOffset: 0,
      zombieAngularOffsetDeg: 0,
      zombieAttackSide: 0,
      zombieBodyRotationRadians: 0,
      zombieBodyType: -1,
      zombieFlyblownSide: -1,
      zombieFrontArmPose: 0,
      zombieFrontArmRotationRadians: 0,
      zombieHeadType: -1,
      zombieHeadRotationRadians: 0,
      zombieRearArmPose: 0,
      zombieRearArmRotationRadians: 0,
    },
    armored: true,
    currentHealth: 5,
    enemyToken: 'SKELETON',
    flags: ['FLAG_ARMOR'],
    headingDeg: 90,
    id: 1,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    maximumHealth: 5,
    nativeTypeId: 1001,
    position: { x: 100, y: 100 },
    lighting: { charge: 0, glow: 0.75, providerCopies: 1 },
    mageCloak: false,
    shieldHealth: 25,
    shieldMaximumHealth: 50,
    spawnTick: 0,
  }]
  snapshot.world.mageLightningPulses = [{
    contact: {
      kind: 'target-attached',
      localOffset: { x: -4, y: 6 },
      targetPlayerId: 'player-1',
    },
    endpoint: { x: 151, y: 2 },
    id: 1,
    midpoint: { x: 75, y: 0 },
    ownerActorId: 1,
    seed: 0x1234_5678,
    source: { x: 23, y: -16 },
    tick: snapshot.tick,
  }]
  snapshot.world.enemyProjectiles = [{
    ageTicks: 3,
    contactRadius: 8,
    headingDeg: 90,
    homing: false,
    id: 2,
    kind: 'arrow',
    lightRegistration: null,
    lifetimeTicks: 300,
    nativeTypeId: 0x7da,
    ownerActorId: 1,
    payload: 'poison',
    position: { x: 110, y: 100 },
    speed: 5,
    spawnTick: 1,
    verticalOffset: -25,
    visualPhaseDeg: 540,
    visualScale: 1,
  }]
  snapshot.world.enemyProjectileEffects = [{
    ageTicks: 1,
    alpha: 2,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 110,
    id: 5,
    kind: 'guided-impact-main',
    lightRegistration: null,
    lifetimeTicks: 4,
    ownerActorId: 1,
    ownerProjectileId: 2,
    phaseOriginTicks: 3,
    position: { x: 115, y: 100 },
    rotationRadians: 0.25,
    scale: 1,
    spawnTick: 3,
    tint: 0xff4949,
  }]
  snapshot.world.maggots = [{
    alpha: 1,
    currentHealth: 2,
    deathEpoch: 0,
    deathTick: 0,
    emergenceTick: 12,
    emergenceOrientation: 4,
    headingDeg: 90,
    hitFlash: 0,
    id: 3,
    launchTrajectory: 'lid',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    maximumHealth: 2,
    ownerCoffinActorId: 1,
    pose: 0.5,
    position: { x: 120, y: 100 },
    spawnTick: 1,
    state: 'emerging',
    verticalOffset: -20,
  }]
  snapshot.world.deathEffects = [{
    ageTicks: 7,
    alpha: 1.25,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 69,
    height: 0,
    id: 4,
    kind: 'fade',
    ownerActorId: 1,
    presentationOwner: 'world-sorted',
    position: { x: 130, y: 100 },
    rotationRadians: 0.5,
    scale: 1.7,
    shadow: false,
    spawnTick: 1,
    tint: 0xffaa88,
  }]
  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    developerAccess: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    sessionKind: 'standalone',
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [loaded.choice],
    gameplayPause: null,
    snapshot,
    snapshotSequence: 1,
  }

  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)
  const fullEffectFrame = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.equal(
    fullEffectFrame.frame.world.entities.samples[0]?.length,
    54,
  )
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(fullEffectFrame)),
    fullEffectFrame,
  )

  const replicatedFrame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  if (replicatedFrame.world.kind !== 'boneyard') {
    throw new Error('expected replicated Boneyard frame')
  }
  assert.equal(replicatedFrame.world.entities.samples[0]?.length, 54)
  const replicatedMessage = {
    type: 'server-snapshot' as const,
    acknowledgedInputSequence: 0,
    frame: replicatedFrame,
    sequence: 2,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(replicatedMessage)),
    replicatedMessage,
  )
  assert.equal(replicatedFrame.world.entities.samples[0]?.[43], -1)
  const oversizedReplicatedSample = JSON.parse(encodeGameMessage(replicatedMessage))
  oversizedReplicatedSample.frame.world.entities.samples[0].push(...Array(20).fill(0))
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(oversizedReplicatedSample)),
    /may contain at most 72 entries/,
  )

  const missingCold = JSON.parse(encodeGameMessage(welcome))
  delete missingCold.snapshot.players['player-1'].progression.coldSlowTicksRemaining
  assert.throws(() => decodeServerGameMessage(JSON.stringify(missingCold)), /coldSlowTicksRemaining/)

  assert.equal(welcome.snapshot.players['player-1']!.movementScale, 0.01)
  const negativeMovementScale = JSON.parse(encodeGameMessage(welcome))
  negativeMovementScale.snapshot.players['player-1'].movementScale = -0.01
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(negativeMovementScale)),
    /movementScale/,
  )

  const oversizedDazzle = JSON.parse(encodeGameMessage(welcome))
  oversizedDazzle.snapshot.players['player-1'].progression.dazzleTicksRemaining = 51
  assert.throws(() => decodeServerGameMessage(JSON.stringify(oversizedDazzle)), /dazzleTicksRemaining/)

  const missingPlayerLighting = JSON.parse(encodeGameMessage(welcome))
  delete missingPlayerLighting.snapshot.players['player-1'].lighting
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingPlayerLighting)),
    /players\.player-1\.lighting/,
  )

  const missingPlayerLightRegistration = JSON.parse(encodeGameMessage(welcome))
  delete missingPlayerLightRegistration.snapshot.players['player-1'].lighting.lightRegistration
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingPlayerLightRegistration)),
    /lighting\.lightRegistration/,
  )

  const wrongPlayerLightLane = JSON.parse(encodeGameMessage(welcome))
  wrongPlayerLightLane.snapshot.players['player-1'].lighting.lightRegistration.managerLane = 'transient'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongPlayerLightLane)),
    /managerLane must be actor/,
  )

  const invalidOverlayLighting = JSON.parse(encodeGameMessage(welcome))
  invalidOverlayLighting.snapshot.players['player-1'].lighting.overlayEffectPhase = 0.46
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidOverlayLighting)),
    /overlayEffectPhase/,
  )

  const inconsistentDriveLighting = JSON.parse(encodeGameMessage(welcome))
  inconsistentDriveLighting.snapshot.players['player-1'].lighting.driveActive = true
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(inconsistentDriveLighting)),
    /driveActive is inconsistent/,
  )

  const incompatiblePayload = JSON.parse(encodeGameMessage(welcome))
  incompatiblePayload.snapshot.world.enemyProjectiles[0].payload = 'cold'
  assert.throws(() => decodeServerGameMessage(JSON.stringify(incompatiblePayload)), /payload/)

  const invalidShield = JSON.parse(encodeGameMessage(welcome))
  invalidShield.snapshot.world.enemies[0].shieldHealth = 51
  assert.throws(() => decodeServerGameMessage(JSON.stringify(invalidShield)), /shieldHealth/)

  const invalidMagicShield = JSON.parse(encodeGameMessage(welcome))
  invalidMagicShield.snapshot.world.enemies[0].animation.effects[0].entry = 382
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidMagicShield)),
    /fields do not match role/,
  )

  const missingHeadFacing = JSON.parse(encodeGameMessage(welcome))
  delete missingHeadFacing.snapshot.world.enemies[0].animation.headFacingOffset
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingHeadFacing)),
    /headFacingOffset/,
  )

  const inactiveHeadFacing = JSON.parse(encodeGameMessage(welcome))
  inactiveHeadFacing.snapshot.world.enemies[0].animation.action = null
  inactiveHeadFacing.snapshot.world.enemies[0].animation.state = 'idle'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(inactiveHeadFacing)),
    /headFacingOffset requires an active Skeleton or Mage action/,
  )

  const invalidHeadFacing = JSON.parse(encodeGameMessage(replicatedMessage))
  invalidHeadFacing.frame.world.entities.samples[0][43] = 2
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidHeadFacing)),
    /invalid registered sample shape/,
  )

  const missingLighting = JSON.parse(encodeGameMessage(welcome))
  delete missingLighting.snapshot.world.enemies[0].lighting
  assert.throws(() => decodeServerGameMessage(JSON.stringify(missingLighting)), /lighting/)

  const missingEnemyLightRegistration = JSON.parse(encodeGameMessage(welcome))
  delete missingEnemyLightRegistration.snapshot.world.enemies[0].lightRegistration
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingEnemyLightRegistration)),
    /enemies\[0\]\.lightRegistration/,
  )

  const wrongEnemyLightLane = JSON.parse(encodeGameMessage(welcome))
  wrongEnemyLightLane.snapshot.world.enemies[0].lightRegistration.managerLane = 'transient'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongEnemyLightLane)),
    /managerLane must be actor/,
  )

  const unexpectedProjectileLightRegistration = JSON.parse(encodeGameMessage(welcome))
  unexpectedProjectileLightRegistration.snapshot.world.enemyProjectiles[0].lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 9,
  }
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unexpectedProjectileLightRegistration)),
    /enemyProjectiles\[0\]\.lightRegistration must be null/,
  )

  const missingLanternLightRegistration = JSON.parse(encodeGameMessage(welcome))
  delete missingLanternLightRegistration.snapshot.world.lanternLightRegistration
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingLanternLightRegistration)),
    /lanternLightRegistration/,
  )

  const invalidGlow = JSON.parse(encodeGameMessage(welcome))
  invalidGlow.snapshot.world.enemies[0].lighting.glow = 1.01
  assert.throws(() => decodeServerGameMessage(JSON.stringify(invalidGlow)), /lighting\.glow/)

  const invalidProviderCopies = JSON.parse(encodeGameMessage(welcome))
  invalidProviderCopies.snapshot.world.enemies[0].lighting.providerCopies = 3
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidProviderCopies)),
    /lighting\.providerCopies/,
  )

  const invalidBurning = JSON.parse(encodeGameMessage(welcome))
  invalidBurning.snapshot.world.enemies[0].animation.effects[0].entry = 382
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidBurning)),
    /fields do not match role/,
  )

  const invalidMagicShieldAlpha = JSON.parse(encodeGameMessage(welcome))
  invalidMagicShieldAlpha.snapshot.world.enemies[0].animation.effects[0].alpha = 1.251
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidMagicShieldAlpha)),
    /animation\.effects\[0\]\.alpha/,
  )

  const extraPulseField = JSON.parse(encodeGameMessage(welcome))
  extraPulseField.snapshot.world.mageLightningPulses[0].contact.position = { x: 0, y: 0 }
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(extraPulseField)),
    /position is not allowed/,
  )

  const stalePulse = JSON.parse(encodeGameMessage(welcome))
  stalePulse.snapshot.tick = 5
  stalePulse.snapshot.world.mageLightningPulses[0].tick = 0
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(stalePulse)),
    /live pulse age limit/,
  )

  const invalidEmergence = JSON.parse(encodeGameMessage(welcome))
  invalidEmergence.snapshot.world.maggots[0].state = 'crawl'
  assert.throws(() => decodeServerGameMessage(JSON.stringify(invalidEmergence)), /emergenceTick/)

  const invalidDeathEffect = JSON.parse(encodeGameMessage(welcome))
  invalidDeathEffect.snapshot.world.deathEffects[0].alpha = 1.251
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDeathEffect)),
    /deathEffects\[0\]\.alpha/,
  )

  const invalidDeathEffectOwner = JSON.parse(encodeGameMessage(welcome))
  invalidDeathEffectOwner.snapshot.world.deathEffects[0].presentationOwner = 'actor'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDeathEffectOwner)),
    /deathEffects\[0\]\.presentationOwner/,
  )

  const invalidBrightDeathEffectShape = JSON.parse(encodeGameMessage(welcome))
  invalidBrightDeathEffectShape.snapshot.world.deathEffects[0].entry = 70
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidBrightDeathEffectShape)),
    /deathEffects\[0\]\.alpha/,
  )

  const duplicateDeathEffect = JSON.parse(encodeGameMessage(welcome))
  duplicateDeathEffect.snapshot.world.deathEffects.push(
    duplicateDeathEffect.snapshot.world.deathEffects[0],
  )
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateDeathEffect)),
    /deathEffects duplicates id/,
  )

  const invalidProjectileEffect = JSON.parse(encodeGameMessage(welcome))
  invalidProjectileEffect.snapshot.world.enemyProjectileEffects[0].blendMode = 'screen'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidProjectileEffect)),
    /enemyProjectileEffects\[0\]\.blendMode/,
  )

  const duplicateProjectileEffect = JSON.parse(encodeGameMessage(welcome))
  duplicateProjectileEffect.snapshot.world.enemyProjectileEffects.push(
    duplicateProjectileEffect.snapshot.world.enemyProjectileEffects[0],
  )
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateProjectileEffect)),
    /enemyProjectileEffects duplicates id/,
  )
})

test('protocol v70 carries observer mode, Hub activity, Goodie actions, tutorial fields/state, Hagatha runtime, Imp effects, save intent, selected skills, sacks, dyes, and gameplay state', () => {
  assert.equal(GAME_PROTOCOL_VERSION, 70)
  const loaded = loadedBoneyardFixture('run-v16')
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loaded,
  )
  const gameOverState = {
    ...active,
    run: {
      ...active.run,
      gameOverEventId: 1,
      gameOverTicks: GAME_OVER_AUTOMATIC_ACCEPT_TICK - 1,
      nextGameOverEventId: 2,
      phase: 'game-over' as const,
    },
    world: active.world.kind === 'boneyard'
      ? {
          ...active.world,
          hallOfFameRuns: Object.fromEntries(Object.entries(
            active.world.hallOfFameRuns,
          ).map(([playerId, hallRun]) => [playerId, {
            ...hallRun,
            elapsedTicks: 0,
            portraitHeadingIndex: 12,
            portraitScale: 0.925,
          }])),
        }
      : active.world,
  }
  const gameOverSnapshot = createGameSnapshot(gameOverState, 'player-1')
  const dyingPlayer = gameOverSnapshot.players['player-1']!
  const snapshotWithDeath = {
    ...gameOverSnapshot,
    players: {
      ...gameOverSnapshot.players,
      'player-1': {
        ...dyingPlayer,
        lighting: { ...dyingPlayer.lighting, driveActive: true },
        progression: {
          ...dyingPlayer.progression,
          currentHealth: 0,
          deathEpoch: 1,
          deathTick: 159,
          lifeState: 'spectating' as const,
        },
      },
    },
  }
  const terminalMessage = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshotWithDeath, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(terminalMessage)),
    terminalMessage,
  )

  const excessiveCommonCooldown = JSON.parse(encodeGameMessage(terminalMessage))
  excessiveCommonCooldown.frame.secondaryAbilities.players['player-1'] = {
    ...createNativeSecondaryPlayerState(),
    globalCooldownTicks: 151,
  }
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(excessiveCommonCooldown)),
    /globalCooldownTicks exceeds its native capacity/,
  )

  const missingAutomaticFade = JSON.parse(encodeGameMessage(terminalMessage))
  missingAutomaticFade.frame.run.gameOverTicks = GAME_OVER_AUTOMATIC_ACCEPT_TICK
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingAutomaticFade)),
    /gameOverExitTicks misses the native automatic fade/,
  )
  const zeroExit = JSON.parse(encodeGameMessage(terminalMessage))
  zeroExit.frame.run.gameOverExitKind = 'automatic'
  zeroExit.frame.run.gameOverExitTicks = 0
  zeroExit.frame.run.gameOverTicks = GAME_OVER_AUTOMATIC_ACCEPT_TICK
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(zeroExit)),
    /gameOverExitTicks must begin at one/,
  )
  const outOfStepExit = JSON.parse(encodeGameMessage(terminalMessage))
  outOfStepExit.frame.run.gameOverExitKind = 'automatic'
  outOfStepExit.frame.run.gameOverExitTicks = 2
  outOfStepExit.frame.run.gameOverTicks = GAME_OVER_AUTOMATIC_ACCEPT_TICK
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(outOfStepExit)),
    /automatic Game Over exit is out of step/,
  )
  const overlongExit = JSON.parse(encodeGameMessage(terminalMessage))
  overlongExit.frame.run.gameOverExitKind = 'automatic'
  overlongExit.frame.run.gameOverExitTicks = GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS + 1
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(overlongExit)),
    /gameOverExitTicks exceeds its native fade/,
  )

  let loadoutState: GameSimulationState = gameOverState
  for (let tick = 0; tick <= GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS; tick += 1) {
    loadoutState = stepGameSimulationTick(loadoutState, {})
  }
  const loadoutSnapshot = createGameSnapshot(loadoutState, 'player-1')
  const loadoutMessage = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(loadoutSnapshot, 0, undefined, true),
    sequence: 3,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(loadoutMessage)),
    loadoutMessage,
  )
  assert.equal(loadoutSnapshot.run.phase, 'loadout')
  assert.equal(loadoutSnapshot.run.lastCompletedRunId, 'run-v16')
  assert.equal(loadoutSnapshot.world.kind, 'hub')

  const hubState = confirmGameSimulationLoadout(loadoutState, 'player-1', {
    discipline: 'body',
    element: 'air',
  })
  assert.ok(hubState)
  const hubSnapshot = createGameSnapshot(hubState, 'player-1')
  assert.equal(hubSnapshot.run.phase, 'hub')
  assert.equal(hubSnapshot.run.gameOverEventId, 0)
  assert.equal(hubSnapshot.run.lastCompletedRunId, 'run-v16')

  const missingRun = JSON.parse(encodeGameMessage(terminalMessage))
  delete missingRun.frame.run
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingRun)),
    /frame\.run/,
  )

  const mismatchedWorld = JSON.parse(encodeGameMessage(loadoutMessage))
  mismatchedWorld.frame.run = terminalMessage.frame.run
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(mismatchedWorld)),
    /run does not match its Boneyard world/,
  )

  const unsupportedLifeState = JSON.parse(encodeGameMessage(terminalMessage))
  unsupportedLifeState.frame.players['player-1'].progression.lifeState = 'ghost'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unsupportedLifeState)),
    /lifeState is not supported/,
  )
})

test('protocol v42 strictly owns the generated-arena transition', () => {
  const loaded = loadedBoneyardFixture('arena-transition-run')
  loaded.scene.solomonDig = {
    frameProgram: [0, 1],
    gravePosition: { x: 780, y: 300 },
    lanternPosition: { x: 740, y: 320 },
    position: { x: 800, y: 400 },
    ticksPerFrame: 5,
  }
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loaded,
  )
  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(
      createGameSnapshot(active, 'player-1'),
      0,
      undefined,
      true,
    ),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  const decoded = decodeServerGameMessage(encodeGameMessage(message))
  assert.deepEqual(decoded, message)
  if (decoded.type !== 'server-snapshot' || decoded.frame.world.kind !== 'boneyard') {
    throw new Error('expected Boneyard frame')
  }
  assert.deepEqual(decoded.frame.world.arenaTransition, {
    blendFactor: 0,
    cameraBounds: { h: 1200, w: 1600, x: 0, y: 0 },
    combatBounds: { h: 800, w: 1600, x: 0, y: 375 },
    entrySide: 'north',
    fullBounds: { h: 1200, w: 1600, x: 0, y: 0 },
    phase: 'open',
    sealTicksRemaining: 0,
  })
  assert.deepEqual(decoded.frame.world.hallOfFameRuns, {
    'player-1': {
      awesomeness: 0,
      awesomestKill: null,
      elapsedTicks: null,
      monstersKilled: 0,
      portraitHeadingIndex: null,
      portraitScale: null,
    },
  })

  const missingHallOwner = JSON.parse(encodeGameMessage(message))
  missingHallOwner.frame.world.hallOfFameRuns = {}
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingHallOwner)),
    /hallOfFameRuns must match/,
  )

  const invalidHallScore = JSON.parse(encodeGameMessage(message))
  invalidHallScore.frame.world.hallOfFameRuns['player-1'].awesomeness = -1
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidHallScore)),
    /awesomeness/,
  )

  const invalidEnemyFeedback = JSON.parse(encodeGameMessage(message))
  invalidEnemyFeedback.frame.world.enemyWorldFeedback.accumulator = 4
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidEnemyFeedback)),
    /enemy-feedback bounds/,
  )

  const prematureHallArchive = JSON.parse(encodeGameMessage(message))
  prematureHallArchive.frame.world.hallOfFameRuns['player-1'].elapsedTicks = 0
  prematureHallArchive.frame.world.hallOfFameRuns['player-1'].portraitHeadingIndex = 12
  prematureHallArchive.frame.world.hallOfFameRuns['player-1'].portraitScale = 0.925
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(prematureHallArchive)),
    /Hall archive timing/,
  )

  const invalidGeometry = JSON.parse(encodeGameMessage(message))
  invalidGeometry.frame.world.arenaTransition.combatBounds.y = 0
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidGeometry)),
    /combatBounds do not match the entry side/,
  )

  const missingOwnership = JSON.parse(encodeGameMessage(message))
  missingOwnership.frame.world.arenaTransition = null
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingOwnership)),
    /must share ownership/,
  )
})

test('protocol v42 preserves the bounded run-scoped enemy semantic-event lane', () => {
  const runId = 'enemy-event-protocol-run'
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loadedBoneyardFixture(runId),
  )
  if (active.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const enemyEvents: BoneyardEnemySemanticEvent[] = [
    {
      actorId: 3,
      eventId: 1,
      targetPlayerId: 'player-1',
      tick: 10,
      type: 'enemy-spawned',
    },
    {
      actorId: 3,
      deflectPitch: 1.125,
      eventId: 2,
      targetPlayerId: 'player-1',
      tick: 11,
      type: 'attack-marker',
    },
    {
      actorId: 3,
      eventId: 4,
      projectileId: 9,
      targetPlayerId: 'player-1',
      tick: 11,
      type: 'projectile-spawned',
    },
    {
      actorId: 3,
      eventId: 5,
      projectileId: 9,
      targetPlayerId: 'player-1',
      tick: 12,
      type: 'projectile-impact',
    },
    {
      actorId: 3,
      eventId: 6,
      projectileId: 9,
      targetPlayerId: 'player-1',
      tick: 12,
      type: 'projectile-retired',
    },
    { actorId: 3, eventId: 7, tick: 13, type: 'enemy-death' },
    {
      actorId: 3,
      count: 2,
      eventId: 8,
      output: 'demon-split',
      tick: 13,
      type: 'enemy-terminal-output',
    },
    {
      actorId: 3,
      eventId: 9,
      gainScale: 1,
      pitch: 0.875,
      sound: 'skeleton-die',
      sourcePosition: { x: 120, y: 240 },
      tick: 13,
      type: 'enemy-death-sound',
    },
    {
      actorId: 3,
      eventId: 10,
      targetPlayerId: 'player-1',
      tick: 13,
      type: 'reward',
    },
    { actorId: 3, eventId: 11, tick: 20, type: 'enemy-retired' },
    {
      actorId: 4,
      count: 20,
      eventId: 12,
      tick: 20,
      type: 'coffin-maggot-release',
    },
    {
      actorId: 4,
      eventId: 13,
      gainScale: 1,
      pitch: 0.825,
      sound: 'hit-shield',
      sourcePosition: { x: 130, y: 250 },
      tick: 20,
      type: 'enemy-damage-sound',
    },
    {
      actorId: 4,
      eventId: 14,
      gainScale: 0.625,
      pitch: 1,
      sound: 'wizard-ouch-2',
      sourcePosition: { x: 140, y: 260 },
      targetPlayerId: 'player-1',
      tick: 20,
      type: 'player-damage-sound',
    },
  ]
  const state = {
    ...active,
    tick: 20,
    world: { ...active.world, enemyEvents },
  }
  const snapshot = createGameSnapshot(state, 'player-1')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.ok(snapshot.world.enemyEvents.every((event) => event.runId === runId))
  snapshot.world.mageLightningPulses = [{
    contact: {
      kind: 'target-attached',
      localOffset: { x: -5, y: 7 },
      targetPlayerId: 'player-1',
    },
    endpoint: { x: 302, y: 261 },
    id: 1,
    midpoint: { x: 210, y: 250 },
    ownerActorId: 3,
    seed: 0x1020_3040,
    source: { x: 120, y: 240 },
    tick: 20,
  }]

  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    developerAccess: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    sessionKind: 'standalone',
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [loadedBoneyardFixture(runId).choice],
    gameplayPause: null,
    snapshot,
    snapshotSequence: 1,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)

  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)

  const wrongRun = JSON.parse(encodeGameMessage(message))
  wrongRun.frame.world.enemyEvents[0].runId = 'another-run'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongRun)),
    /runId does not match/,
  )

  const missingProjectile = JSON.parse(encodeGameMessage(message))
  delete missingProjectile.frame.world.enemyEvents[2].projectileId
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingProjectile)),
    /projectileId/,
  )

  const malformedCompactPulse = JSON.parse(encodeGameMessage(message))
  malformedCompactPulse.frame.world.mageLightningPulses[0][13] = null
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(malformedCompactPulse)),
    /valid compact pulse/,
  )

  const reservedCompactTarget = JSON.parse(encodeGameMessage(message))
  reservedCompactTarget.frame.world.mageLightningPulses[0][13] = '__proto__'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(reservedCompactTarget)),
    /valid compact pulse/,
  )

  const futureCompactPulse = JSON.parse(encodeGameMessage(message))
  futureCompactPulse.frame.world.mageLightningPulses[0][2] = 21
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(futureCompactPulse)),
    /exceeds its snapshot tick/,
  )

  const missingDeathSoundPitch = JSON.parse(encodeGameMessage(message))
  delete missingDeathSoundPitch.frame.world.enemyEvents[7].pitch
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingDeathSoundPitch)),
    /pitch/,
  )

  const unsupportedDeathSound = JSON.parse(encodeGameMessage(message))
  unsupportedDeathSound.frame.world.enemyEvents[7].sound = 'skeleton-ish'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unsupportedDeathSound)),
    /sound is not supported/,
  )

  const unsupportedDamageSound = JSON.parse(encodeGameMessage(message))
  unsupportedDamageSound.frame.world.enemyEvents[11].sound = 'shield-ish'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unsupportedDamageSound)),
    /sound is not supported/,
  )

  const unsupportedPlayerDamageSound = JSON.parse(encodeGameMessage(message))
  unsupportedPlayerDamageSound.frame.world.enemyEvents[12].sound = 'wizard-ish'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unsupportedPlayerDamageSound)),
    /sound is not supported/,
  )

  const missingPlayerDamageTarget = JSON.parse(encodeGameMessage(message))
  delete missingPlayerDamageTarget.frame.world.enemyEvents[12].targetPlayerId
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingPlayerDamageTarget)),
    /targetPlayerId/,
  )

  const excessDeathSoundGain = JSON.parse(encodeGameMessage(message))
  excessDeathSoundGain.frame.world.enemyEvents[7].gainScale = 1.01
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(excessDeathSoundGain)),
    /gainScale must be within/,
  )
})

test('progression snapshots carry the next rank needed by the stock picker label', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': {
      discipline: 'arcane',
      displayName: 'Helvidius',
      element: 'fire',
    } }, { initialPlayerExperience: 100 }),
    'player-1',
  )
  const pendingOffer = snapshot.players['player-1']!.progression.pendingOffer
  assert.ok(pendingOffer)
  assert.deepEqual(snapshot.levelUpBarrier, {
    barrierId: 1,
    milestoneExperience: 100,
    milestoneLevel: 2,
    participantIds: ['player-1'],
    pendingPlayerIds: ['player-1'],
    runId: null,
    sourcePlayerId: 'player-1',
  })
  assert.ok(pendingOffer.options.every(({ skillId, targetRank }) => {
    const learned = snapshot.players['player-1']!.progression.learnedSkills
      .find(([learnedSkillId]) => learnedSkillId === skillId)
    return targetRank === (learned?.[1] ?? 0) + 1
  }))

  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const fractional = JSON.parse(JSON.stringify(frame))
  fractional.players['player-1'].progression.experience = 90.85
  fractional.levelUpBarrier.milestoneExperience = 90.85
  const fractionalMessage = decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: fractional,
    sequence: 2,
  }))
  assert.equal(fractionalMessage.type, 'server-snapshot')
  assert.equal(fractionalMessage.frame.players['player-1']!.progression.experience, 90.85)

  const missingBarrierOffer = JSON.parse(JSON.stringify(frame))
  missingBarrierOffer.players['player-1'].progression.pendingOffer = null
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: missingBarrierOffer,
    sequence: 2,
  })), /pending player has no skill offer/)

  const duplicateBarrierParticipant = JSON.parse(JSON.stringify(frame))
  duplicateBarrierParticipant.levelUpBarrier.participantIds.push('player-1')
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: duplicateBarrierParticipant,
    sequence: 2,
  })), /sorted, unique/)
  const malformed = JSON.parse(JSON.stringify(frame))
  delete malformed.players['player-1'].progression.pendingOffer.options[0].targetRank
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformed,
    sequence: 2,
  })), /targetRank/)

  const missingWeldBuild = JSON.parse(JSON.stringify(frame))
  missingWeldBuild.players['player-1'].progression.pendingOffer.options[0] = {
    skillId: 52,
    targetRank: 1,
  }
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: missingWeldBuild,
    sequence: 2,
  })), /Spell Welding/)

  const invalidWeldBuild = JSON.parse(JSON.stringify(frame))
  invalidWeldBuild.players['player-1'].progression.pendingOffer.options[0] = {
    skillId: 52,
    targetRank: 1,
    weldBuildId: 1010,
  }
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: invalidWeldBuild,
    sequence: 2,
  })), /weldBuildId/)

  const misplacedWeldBuild = JSON.parse(JSON.stringify(frame))
  misplacedWeldBuild.players['player-1'].progression.pendingOffer.options[0].weldBuildId = 1000
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: misplacedWeldBuild,
    sequence: 2,
  })), /requires Spell Welding/)
})

test('protocol rejects legacy, malformed, and unsupported discriminated payloads', () => {
  assert.throws(() => decodeClientGameMessage('{'), GameProtocolError)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    displayName: 'legacy',
  })), /displayName|character/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: { ...CHARACTER, element: 'void' },
  })), /element/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
  })), /profile/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: 0, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
  })), /highestWave/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: null,
      cast: { primary: false, quickbar: null },
      movement: { x: 2, y: 0 },
      viewportWidth: 1_600,
    },
    sequence: 1,
    targetTick: 1,
  })), /magnitude/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: { x: 1, y: Number.POSITIVE_INFINITY },
      cast: { primary: false, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    },
    sequence: 1,
    targetTick: 1,
  })), /aim/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: null,
      cast: { primary: 1, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    },
    sequence: 1,
    targetTick: 1,
  })), /primary/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: { movement: { x: 0, y: 0 } },
    sequence: 1,
    targetTick: 1,
  })), /aim|cast/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: null,
      cast: { primary: false, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 0,
    },
    sequence: 1,
    targetTick: 1,
  })), /viewportWidth/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-ping',
    nonce: -1,
  })), /nonce/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-select-skill',
    choiceIndex: 4,
    offerSequence: 1,
    skillId: 48,
  })), /choiceIndex/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-select-skill',
    choiceIndex: 0,
    offerSequence: 1,
    skillId: 80,
  })), /skillId/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-level-up-action',
    action: 'hover',
    offerSequence: 1,
  })), /not supported/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-acknowledge-game-over',
    eventId: 0,
    runId: 'run-one',
  })), /unknown client message type/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-confirm-loadout',
    runId: 'run-one',
  })), /message\.runId is not allowed/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-pong',
    nonce: 4.5,
  })), /nonce/)

  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: { ...frame, world: { ...frame.world, kind: 'unknown' } },
    sequence: 2,
  })), /kind/)
  const malformed = JSON.parse(JSON.stringify(frame))
  delete malformed.players['player-1'].config
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformed,
    sequence: 2,
  })), /config/)
  if (frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  const malformedSample = JSON.parse(JSON.stringify(frame))
  malformedSample.world.entities.samples[0].pop()
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformedSample,
    sequence: 2,
  })), /invalid registered sample shape/)
  const malformedDescriptor = JSON.parse(JSON.stringify(frame))
  malformedDescriptor.world.entities.spawned[0][3] = 2
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformedDescriptor,
    sequence: 2,
  })), /invalid registered descriptor shape/)
})

test('protocol rejects malformed cast programs and primary-spell ownership', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const decodeFrame = (candidate: unknown) => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: candidate,
    sequence: 2,
  }))
  const missile = {
    ageTicks: 1,
    charge: 1,
    damage: 4,
    damageRetention: 1,
    direction: { x: 0, y: -1 },
    flightTicks: 1,
    headingDegrees: 0,
    id: 1,
    kind: 'ether',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: 'player-1',
    phase: 'flight',
    piercesRemaining: 0,
    position: { x: 800, y: 400 },
    reacquiresTarget: false,
    speed: 3,
    targetId: null,
    turnInput: 2,
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
    underpowered: false,
    velocity: { x: 0, y: -3 },
    visualScale: 1,
    worldKey: 'hub:courtyard',
  }
  const boulder = {
    ageTicks: missile.ageTicks,
    assemblyCharge: Math.fround(0.18),
    charge: 0.19,
    damage: missile.damage,
    direction: missile.direction,
    flightTicks: 0,
    hitTargetIds: [],
    id: missile.id,
    kind: 'earth',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    maximumCharge: 1,
    orientation: EARTH_BOULDER_IDENTITY_ORIENTATION,
    ownerId: missile.ownerId,
    phase: 'held',
    position: missile.position,
    remainingDamage: missile.damage,
    shellCharge: Math.fround(0.18),
    toughness: 1,
    velocity: { x: 0, y: 0 },
    worldKey: missile.worldKey,
  }
  const earthImpactSeed = {
    ageTicks: 3,
    birthTick: 40,
    charge: 0.5,
    id: 1,
    kind: 'earth-impact',
    lightRegistration: null,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    worldKey: 'hub:courtyard',
  }
  const earthImpact = {
    ...earthImpactSeed,
    lifetimeTicks: earthImpactLifetimeTicks(earthImpactSeed),
  }
  const earthBoulderBit = {
    ageTicks: 0,
    birthTick: 40,
    debris: {
      alpha: 10,
      bounceVelocity: -2,
      colorGreen: 0.25,
      enhancedShadow: true,
      height: -10,
      index: 0,
      position: { x: 3, y: 4 },
      record: 2008,
      rotationDegrees: 90,
      rotationStepDegrees: 4,
      scale: 0.5,
      velocity: { x: 1, y: 0 },
      verticalVelocity: -2,
    },
    id: 2,
    kind: 'earth-boulder-bit',
    lightRegistration: null,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    position: { x: 800, y: 400 },
    worldKey: 'hub:courtyard',
  }
  const calledRock = {
    ageTicks: 8,
    falling: true,
    fallVelocity: 2,
    height: -12.5,
    id: 2,
    kind: 'earth-called-rock',
    lightRegistration: null,
    lateralMagnitude: 3.25,
    ownerId: 'player-1',
    parentId: 1,
    position: { x: 760, y: 390 },
    rotation: 125,
    rotationStep: -12,
    scale: 0.2,
    speed: 0.5,
    targetHeight: -48,
    variant: 2,
    worldKey: 'hub:courtyard',
  }

  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [missile], transients: [] },
  }))

  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, lightRegistration: undefined }],
      transients: [],
    },
  }), /projectiles\[0\]\.lightRegistration/)

  const decodedImpact = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [], transients: [earthImpact] },
  })
  assert.equal(decodedImpact.type, 'server-snapshot')
  assert.deepEqual(decodedImpact.frame.primarySpells.transients, [earthImpact])
  const decodedBoulderBit = decodeFrame({
    ...frame,
    primarySpells: { nextId: 3, projectiles: [], transients: [earthBoulderBit] },
  })
  assert.equal(decodedBoulderBit.type, 'server-snapshot')
  assert.deepEqual(decodedBoulderBit.frame.primarySpells.transients, [earthBoulderBit])
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 3,
      projectiles: [],
      transients: [{ ...earthBoulderBit, debris: { ...earthBoulderBit.debris, alpha: NaN } }],
    },
  }), /alpha must be finite/)
  const etherBlast = {
    ageTicks: 0,
    birthTick: 40,
    charges: 4,
    id: 1,
    kind: 'ether-blast',
    origin: { x: 800, y: 300 },
    ownerId: 'player-1',
    presentationRng: createNativeRng(14),
    worldKey: 'hub:courtyard',
  }
  const decodedEtherBlast = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [], transients: [etherBlast] },
  })
  assert.equal(decodedEtherBlast.type, 'server-snapshot')
  assert.deepEqual(decodedEtherBlast.frame.primarySpells.transients, [etherBlast])
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...etherBlast, charges: 0 }],
    },
  }), /charges/)
  const fireParticle = {
    ageTicks: 7,
    direction: { x: 0, y: -1 },
    id: 1,
    kind: 'fire',
    lightRegistration: null,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    variant: nativeFireParticleVariant(1),
    worldKey: 'hub:courtyard',
  }
  const fireImpact = {
    ageTicks: 8,
    id: 1,
    kind: 'fire-impact',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    worldKey: 'hub:courtyard',
  }
  const fireball = {
    ageTicks: 1,
    burnDamage: 10,
    charge: 1,
    damage: 30,
    direction: { x: 0, y: -1 },
    emberDamage: 8,
    emberFragments: 4,
    explodeDamage: 12,
    explodeRadius: 15,
    flightTicks: 1,
    id: 1,
    kind: 'fire',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: 'player-1',
    phase: 'flight',
    position: { x: 800, y: 400 },
    privateSeed: 123_456,
    spentEmber: { damage: 20, kind: 'imp', lifetimeTicks: 300 },
    underpowered: false,
    velocity: { x: 0, y: -4.5 },
    worldKey: 'hub:courtyard',
  }
  const fireEmber = {
    ageTicks: 10,
    burnDamage: 10,
    contactCadence: 2,
    contactDue: false,
    damage: 8,
    height: -5,
    horizontalVelocity: { x: 1, y: 0 },
    id: 1,
    kind: 'fire-ember',
    life: 3,
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: 'player-1',
    phase: 2.5,
    position: { x: 800, y: 400 },
    spentEmber: { damage: 20, kind: 'immolate' },
    verticalVelocity: -1,
    worldKey: 'hub:courtyard',
  }
  const fireExplosion = {
    ageTicks: 0,
    burnDamage: 10,
    damage: 6,
    footprintDimension: 209,
    id: 1,
    kind: 'fire-explosion',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    soundPitch: 1.05,
    visualScale: 1.9,
    worldKey: 'hub:courtyard',
  }
  const goodImp = {
    ageTicks: 1,
    bodyRotationDeg: 15,
    bodyScale: 0.98,
    bodyVariant: 2,
    bounceSoundIndex: 0,
    bounceSoundPitch: 1,
    bounceSoundSequence: 0,
    burnDamage: 10,
    collisionRadius: 1.5,
    contactAgeTicks: null,
    contactOrigin: null,
    contactScale: 1,
    contactSoundIndex: 0,
    contactSoundPitch: 1,
    contactSoundSequence: 0,
    damage: 10,
    effectAlpha: 0,
    effectPhase: 2.5,
    flightSpeed: 4.5,
    headingDegrees: 0,
    id: 1,
    kind: 'fire-good-imp',
    lightGlow: 0.01,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 3 },
    nextTargetRefreshTick: 300,
    ownerId: 'player-1',
    path: createNativeEnemyPathState(createNativeRng(13)).state,
    position: { x: 800, y: 400 },
    remainingTicks: 299,
    targetId: null,
    verticalOffset: 0,
    verticalVelocity: 0.4,
    worldKey: 'hub:courtyard',
  }
  const firePatch = {
    ageTicks: 1,
    atlasPhase: 2.25,
    atlasPhaseStep: 0.25,
    burnDamage: 10,
    damage: 20,
    drawAlpha: 1,
    fadeAlpha: 0.05,
    id: 1,
    kind: 'fire-patch',
    life: 1.99,
    nativeType: 'fire',
    ownerId: 'player-1',
    position: { x: 800, y: 400 },
    scale: 1,
    shapeSample: 0.75,
    supplementalContact: false,
    velocity: { x: 0, y: 0 },
    velocityMultiplier: { x: 1, y: 1 },
    worldKey: 'hub:courtyard',
  }
  const etherImpact = {
    ageTicks: 8,
    birthTick: 91,
    id: 1,
    kind: 'ether-impact',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    visualScale: 1,
    worldKey: 'hub:courtyard',
  }
  const airBolt = {
    ageTicks: 0,
    birthTick: 91,
    direction: { x: 0, y: -1 },
    endpoint: { x: 820, y: 180 },
    hurricaneCharge: 0,
    id: 1,
    kind: 'air',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    midpoint: { x: 800, y: 290 },
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    targetId: 'scenery:grave-7',
    underpowered: true,
    variant: 1,
    worldKey: 'hub:courtyard',
  }
  const staffTransients = [{
    actionTimingFactor: 1,
    ageTicks: 1,
    baseProgressPerTick: Math.fround(0.12),
    contactSequence: 0,
    headingDegrees: 0,
    id: 1,
    kind: 'player-staff-melee',
    lane: 'primary',
    origin: { x: 800, y: 400 },
    outcome: 'normal',
    ownerId: 'player-1',
    progress: 2.5,
    swooshPitch: Math.fround(
      (Math.fround(0.12) - 0.10000000149011612) + 1,
    ),
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 2,
    contactSequence: 0,
    countdown: 320,
    headingDegrees: 40,
    id: 2,
    kind: 'player-staff-spin',
    origin: { x: 800, y: 400 },
    outcome: 'whirl',
    ownerId: 'player-1',
    swooshPitch: 1,
    turnSign: -1,
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 3,
    id: 3,
    impactSoundPitches: [1],
    kind: 'player-staff-contact',
    origin: { x: 800, y: 380 },
    outcome: 'critical-hit',
    ownerId: 'player-1',
    pikeBreakSoundIndexes: [0],
    procSound: 'critical-hit',
    procSoundPitches: [1.03],
    swooshPitch: 1.07,
    targetIds: ['enemy:1'],
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 4,
    arcDegrees: 80,
    id: 4,
    kind: 'player-staff-knockback',
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    remainingDistance: 110,
    targetIds: ['enemy:1'],
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 0,
    alpha: 1,
    alphaLoss: Math.fround(0.05),
    angularVelocityDegrees: 1,
    entry: 15,
    id: 5,
    kind: 'player-staff-smoke',
    ownerId: 'player-1',
    position: { x: 800, y: 375 },
    rotationDegrees: 5,
    scale: 8,
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 0,
    alpha: Math.fround(1.5),
    alphaLoss: Math.fround(0.05),
    entry: 45,
    id: 6,
    kind: 'player-staff-move-fade',
    ownerId: 'player-1',
    position: { x: 800, y: 375 },
    rotationDegrees: 10,
    scale: 0.5,
    tint: 0xa0c3c3,
    velocity: { x: 1, y: -3 },
    velocityFactor: Math.fround(0.92),
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 0,
    alpha: Math.fround(1.25),
    alphaLoss: Math.fround(0.1),
    entry: 88,
    id: 7,
    kind: 'player-staff-perspective-fade',
    ownerId: 'player-1',
    position: { x: 800, y: 400 },
    rotationDegrees: 270,
    scale: 3,
    tint: 0xa0c3c3,
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 2,
    delta: { x: 6, y: 0 },
    id: 8,
    kind: 'player-staff-contact-knockback',
    ownerId: 'player-1',
    remainingTicks: 3,
    targetId: 'enemy:1',
    worldKey: 'hub:courtyard',
  }, {
    ageTicks: 5,
    headingDegrees: 180,
    id: 9,
    kind: 'player-staff-pike-break',
    ownerId: 'player-1',
    position: { x: 800, y: 400 },
    presentationRng: createNativeRng(5),
    targetId: 'enemy:1',
    worldKey: 'hub:courtyard',
  }] as const

  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [fireParticle],
    },
  }))
  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [fireball], transients: [] },
  }))
  for (const effect of [fireEmber, fireExplosion, goodImp, firePatch]) {
    const decoded = decodeFrame({
      ...frame,
      primarySpells: { nextId: 2, projectiles: [], transients: [effect] },
    })
    assert.equal(decoded.type, 'server-snapshot')
    assert.deepEqual(decoded.frame.primarySpells.transients, [effect])
  }
  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ...fireEmber,
        life: Math.fround(0.5),
        spentEmber: { kind: 'none' },
        verticalVelocity: 0,
      }],
    },
  }))
  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...fireExplosion, ageTicks: 36 }],
    },
  }))
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...fireEmber, life: 0, spentEmber: { kind: 'none' } }],
    },
  }), /life/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...fireParticle, lightRegistration: TRANSIENT_LIGHT_REGISTRATION }],
    },
  }), /lightRegistration must be null/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...fireEmber, contactCadence: 4 }],
    },
  }), /contactCadence/)
  const decodedFireImpact = decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [fireImpact],
    },
  })
  assert.equal(decodedFireImpact.type, 'server-snapshot')
  assert.deepEqual(decodedFireImpact.frame.primarySpells.transients, [fireImpact])
  const decodedEtherImpact = decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [etherImpact],
    },
  })
  assert.equal(decodedEtherImpact.type, 'server-snapshot')
  assert.deepEqual(decodedEtherImpact.frame.primarySpells.transients, [etherImpact])
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...etherImpact, birthTick: undefined }],
    },
  }), /birthTick/)
  const decodedAir = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [], transients: [airBolt] },
  })
  assert.equal(decodedAir.type, 'server-snapshot')
  assert.deepEqual(decodedAir.frame.primarySpells.transients, [airBolt])
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...airBolt, ageTicks: 3 }],
    },
  }), /Air contact lifetime/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...airBolt, midpoint: undefined }],
    },
  }), /midpoint/)
  const decodedStaff = decodeFrame({
    ...frame,
    primarySpells: { nextId: 10, projectiles: [], transients: staffTransients },
  })
  assert.equal(decodedStaff.type, 'server-snapshot')
  assert.deepEqual(decodedStaff.frame.primarySpells.transients, staffTransients)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[0], ageTicks: 0.5 }],
    },
  }), /ageTicks/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[0], swooshPitch: 1.1 }],
    },
  }), /StaffMelee program/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[1], countdown: 319 }],
    },
  }), /StaffSpin program/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[2], procSound: 'knockback' }],
    },
  }), /proc sound/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[3], targetIds: ['enemy:1', 'enemy:1'] }],
    },
  }), /duplicate target/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[3], targetIds: ['scenery:1'] }],
    },
  }), /non-enemy Staff target/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[5], alpha: 1 }],
    },
  }), /Staff MoveFade/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 8,
      projectiles: [],
      transients: [{ ...staffTransients[6], tint: 0xffffff }],
    },
  }), /Whirl fade/)
  const decodedCalledRock = decodeFrame({
    ...frame,
    primarySpells: { nextId: 3, projectiles: [], transients: [calledRock] },
  })
  assert.equal(decodedCalledRock.type, 'server-snapshot')
  assert.deepEqual(decodedCalledRock.frame.primarySpells.transients, [calledRock])
  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [boulder], transients: [] },
  }))
  const depletedBoulder = decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, damage: 0, remainingDamage: 0 }],
      transients: [],
    },
  })
  assert.equal(depletedBoulder.type, 'server-snapshot')
  assert.equal(depletedBoulder.frame.primarySpells.projectiles[0]!.damage, 0)
  assert.equal(
    depletedBoulder.frame.primarySpells.projectiles[0]!.kind === 'earth'
      ? depletedBoulder.frame.primarySpells.projectiles[0]!.remainingDamage
      : null,
    0,
  )
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, remainingDamage: -1 }],
      transients: [],
    },
  }), /remainingDamage must be nonnegative/)
  const decodedMissile = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [missile], transients: [] },
  })
  assert.equal(decodedMissile.type, 'server-snapshot')
  assert.equal(decodedMissile.frame.primarySpells.projectiles[0]!.damage, 4)
  assert.equal(decodedMissile.frame.primarySpells.projectiles[0]!.kind, 'ether')
  if (decodedMissile.frame.primarySpells.projectiles[0]!.kind !== 'ether') {
    throw new Error('expected an Ether projectile')
  }
  assert.equal(decodedMissile.frame.primarySpells.projectiles[0]!.underpowered, false)

  const weakFrame = decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          fizzleSequence: 1,
          underpowered: true,
        },
      },
    },
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, damage: 2, underpowered: true }],
      transients: [],
    },
  })
  assert.equal(weakFrame.type, 'server-snapshot')
  assert.equal(weakFrame.frame.players['player-1'].primaryCast.fizzleSequence, 1)
  assert.equal(weakFrame.frame.players['player-1'].primaryCast.underpowered, true)
  assert.equal(weakFrame.frame.primarySpells.projectiles[0]!.kind, 'ether')
  if (weakFrame.frame.primarySpells.projectiles[0]!.kind !== 'ether') {
    throw new Error('expected an Ether projectile')
  }
  assert.equal(weakFrame.frame.primarySpells.projectiles[0]!.underpowered, true)

  const poseHeldFrame = decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        lighting: { ...frame.players['player-1'].lighting, driveActive: true },
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          actionTick: 0,
          castSequence: 2,
          emissionSequence: 1,
          held: true,
          oneShotAttackPoseHeld: true,
          selectedPrimaryId: 8,
        },
      },
    },
  })
  assert.equal(poseHeldFrame.type, 'server-snapshot')
  assert.equal(
    poseHeldFrame.frame.players['player-1'].primaryCast.oneShotAttackPoseHeld,
    true,
  )
  const missingPoseLatch = JSON.parse(JSON.stringify(frame))
  delete missingPoseLatch.players['player-1'].primaryCast.oneShotAttackPoseHeld
  assert.throws(() => decodeFrame(missingPoseLatch), /oneShotAttackPoseHeld/)
  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        lighting: { ...frame.players['player-1'].lighting, driveActive: true },
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          actionTick: 1,
          channelActive: true,
          emissionSequence: 1,
          held: true,
          oneShotAttackPoseHeld: true,
          selectedPrimaryId: 8,
        },
      },
    },
  }), /oneShotAttackPoseHeld is outside a one-shot burst/)

  const missingDamage = JSON.parse(JSON.stringify(missile))
  delete missingDamage.damage
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [missingDamage], transients: [] },
  }), /damage must be finite/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, assemblyCharge: undefined }],
      transients: [],
    },
  }), /assemblyCharge/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, shellCharge: undefined }],
      transients: [],
    },
  }), /shellCharge/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, hitTargetIds: undefined }],
      transients: [],
    },
  }), /hitTargetIds/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, hitTargetIds: ['enemy:1', 'enemy:1'] }],
      transients: [],
    },
  }), /duplicate target/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, orientation: undefined }],
      transients: [],
    },
  }), /orientation/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, orientation: [1, 0, 0] }],
      transients: [],
    },
  }), /nine float32 values/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{
        ...boulder,
        orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION.slice(0, 8), 1 / 3],
      }],
      transients: [],
    },
  }), /must be float32/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, assemblyCharge: 1 }],
      transients: [],
    },
  }), /assemblyCharge is not allowed/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, assemblyCharge: 0.21 }],
      transients: [],
    },
  }), /assemblyCharge/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, damage: 0 }],
      transients: [],
    },
  }), /damage must be positive/)

  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: { ...frame.players['player-1'].primaryCast, actionTick: 56 },
      },
    },
  }), /outside the Staff Cast 1 program/)
  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          targetId: 'scenery:grave-7',
        },
      },
    },
  }), /targetId is only valid for Air/)
  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          actionTick: 2,
          channelActive: true,
        },
      },
    },
  }), /outside the Staff Constant program/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, ownerId: 'missing-player' }],
      transients: [],
    },
  }), /owner missing-player is not present/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, phase: 'held' }],
      transients: [],
    },
  }), /only permits held Earth actors/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{
        ...boulder,
        flightTicks: 1,
      }],
      transients: [],
    },
  }), /flightTicks must be zero while held/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, flightTicks: 0 }],
      transients: [],
    },
  }), /flightTicks is outside the actor age/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [missile],
      transients: [{
        ageTicks: 1,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        lightRegistration: null,
        obstructionDistance: null,
        obstructionPoint: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
        variant: 0,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /duplicate id 1/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ageTicks: 1,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        lightRegistration: null,
        obstructionDistance: null,
        obstructionPoint: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
        variant: 4,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /variant exceeds the native family/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ageTicks: 1,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        lightRegistration: null,
        obstructionDistance: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
        variant: 0,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /obstructionPoint must be an object/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 3,
      projectiles: [],
      transients: [{
        ageTicks: 1,
        direction: { x: 1, y: 0 },
        id: 2,
        kind: 'water',
        lightRegistration: null,
        obstructionDistance: 0,
        obstructionPoint: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
        variant: 0,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /must be present together/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...earthImpact, direction: { x: 0, y: -1 } }],
    },
  }), /direction is not allowed/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...fireParticle, variant: (fireParticle.variant + 1) % 4 }],
    },
  }), /variant does not match its Fire particle id/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...earthImpact, charge: 1.1 }],
    },
  }), /charge must be within/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ...fireParticle,
        ageTicks: nativeFireParticleLifetimeTicks(fireParticle.id),
      }],
    },
  }), /ageTicks exceeds its Fire particle lifetime/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ...fireImpact,
        ageTicks: NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
      }],
    },
  }), /ageTicks exceeds the Fire impact lifetime/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 3,
      projectiles: [],
      transients: [{ ...calledRock, lateralMagnitude: 5 }],
    },
  }), /lateralMagnitude is outside/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...earthImpact, lifetimeTicks: earthImpact.lifetimeTicks + 1 }],
    },
  }), /lifetimeTicks does not match/)
})

test('protocol strictly carries primary Hurricane, Cold Aura, and Hail lifecycles', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const effects = [
    {
      ageTicks: 20,
      birthTick: 3,
      charge: 0.5,
      contactCharge: 0.4,
      damageMaximum: 20,
      damageMinimum: 10,
      enhancedEffects: true,
      id: 1,
      kind: 'air-hurricane',
      lanes: Array.from({ length: 8 }, (_, index) => ({
        angleDegrees: index * 10,
        angularVelocityDegrees: 10 * 0.75 ** index,
        radius: 1.5 * 1.2 ** index,
        verticalOffset: index,
      })),
      ownerId: 'player-1',
      phaseDegrees: 15,
      position: { x: 10, y: 20 },
      worldKey: 'hub:courtyard',
    },
    {
      ageTicks: 2,
      alphaDecay: Math.fround(0.15 / 720),
      birthTick: 3,
      durationTicks: 2_400,
      id: 2,
      initialRotationDegrees: 90,
      kind: 'water-aura',
      origin: { x: 10, y: 20 },
      ownerId: 'player-1',
      rotationStepDegrees: 0.5,
      worldKey: 'hub:courtyard',
    },
    {
      ageTicks: 20,
      birthTick: 3,
      bounceProgress: 0.4,
      bounceSoundIndex: 2,
      bounceSoundPitch: 1.1,
      bounceSoundSequence: 1,
      height: -4,
      horizontalVelocity: { x: 3, y: -4 },
      id: 3,
      kind: 'water-hail',
      life: Math.fround(1.7),
      ownerId: 'player-1',
      position: { x: 10, y: 20 },
      rotationDegrees: 200,
      rotationStepDegrees: 4,
      savedBounceVelocity: -2,
      scale: 1.5,
      verticalVelocity: 1,
      worldKey: 'hub:courtyard',
    },
  ]
  const decodeEffects = (transients: unknown) => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      primarySpells: { nextId: 4, projectiles: [], transients },
    },
    sequence: 2,
  }))
  const decoded = decodeEffects(effects)
  assert.equal(decoded.type, 'server-snapshot')
  assert.deepEqual(decoded.frame.primarySpells.transients, effects)
  assert.throws(() => decodeEffects([{ ...effects[0], charge: 0 }]), /charge must be within/)
  assert.throws(() => decodeEffects([{ ...effects[1], ageTicks: 2_400 }]), /native lifetime/)
  assert.throws(() => decodeEffects([{ ...effects[2], ageTicks: 134 }]), /Hail lifecycle/)
})

test('protocol strictly validates nested native Region screen-feedback events', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const event = {
    actorId: null,
    cameraDisplacement: null,
    cameraMagnitude: 0,
    cue: 'teleport',
    eventId: 1,
    kind: 'pulse',
    ownerId: 'player-1',
    pitch: 1,
    position: { x: 800, y: 400 },
    screenFlash: {
      alpha: 1,
      blue: 1,
      decayPerTick: 0.025,
      green: 1,
      pointAttenuated: true,
      red: 1,
    },
    skillId: 48,
    tick: 0,
    worldKey: 'hub:courtyard',
  }
  const message = {
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      secondaryAbilities: {
        ...frame.secondaryAbilities,
        events: [event],
        nextEventId: 2,
      },
    },
    sequence: 2,
  }
  const decoded = decodeServerGameMessage(JSON.stringify(message))
  assert.equal(decoded.type, 'server-snapshot')
  assert.deepEqual(decoded.frame.secondaryAbilities.events, [event])

  const flashFeedback = JSON.parse(JSON.stringify(message))
  Object.assign(flashFeedback.frame.secondaryAbilities.events[0], {
    cameraDisplacement: { x: 1.8, y: -2.4 },
    cue: 'flash-spell',
    kind: 'impact',
    skillId: 53,
  })
  const flashDecoded = decodeServerGameMessage(JSON.stringify(flashFeedback))
  assert.equal(flashDecoded.type, 'server-snapshot')
  assert.deepEqual(
    flashDecoded.frame.secondaryAbilities.events[0]!.cameraDisplacement,
    { x: 1.8, y: -2.4 },
  )
  const wrongFlashCue = JSON.parse(JSON.stringify(flashFeedback))
  wrongFlashCue.frame.secondaryAbilities.events[0].cue = 'teleport'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongFlashCue)),
    /skill 53 is reserved for Flash response feedback/,
  )

  const externalFeedback = JSON.parse(JSON.stringify(message))
  Object.assign(externalFeedback.frame.secondaryAbilities.events[0], {
    cue: null,
    kind: 'impact',
    skillId: null,
  })
  externalFeedback.frame.secondaryAbilities.events[0].screenFlash.pointAttenuated = false
  const externalDecoded = decodeServerGameMessage(JSON.stringify(externalFeedback))
  assert.equal(externalDecoded.type, 'server-snapshot')
  assert.equal(externalDecoded.frame.secondaryAbilities.events[0]!.skillId, null)

  const invalidExternal = JSON.parse(JSON.stringify(externalFeedback))
  invalidExternal.frame.secondaryAbilities.events[0].cue = 'teleport'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidExternal)),
    /null skillId is reserved for player-effect feedback/,
  )

  const missing = JSON.parse(JSON.stringify(message))
  delete missing.frame.secondaryAbilities.events[0].screenFlash
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missing)),
    /screenFlash must be an object/,
  )

  const extra = JSON.parse(JSON.stringify(message))
  extra.frame.secondaryAbilities.events[0].screenFlash.mode = 'additive'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(extra)),
    /screenFlash\.mode is not allowed/,
  )

  const invalidAlpha = JSON.parse(JSON.stringify(message))
  invalidAlpha.frame.secondaryAbilities.events[0].screenFlash.alpha = 1.01
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidAlpha)),
    /screenFlash\.alpha must be between zero and one/,
  )

  const invalidDecay = JSON.parse(JSON.stringify(message))
  invalidDecay.frame.secondaryAbilities.events[0].screenFlash.decayPerTick = 0
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDecay)),
    /screenFlash\.decayPerTick must be positive/,
  )

  const invalidCamera = JSON.parse(JSON.stringify(message))
  invalidCamera.frame.secondaryAbilities.events[0].cameraMagnitude = -0.01
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidCamera)),
    /cameraMagnitude must be nonnegative/,
  )
})

test('protocol v42 round-trips Frozen and FrostBurn target ownership without client inference', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const effect = {
    circleSlowFactor: 1,
    circleSlowTicks: 0,
    coldSlowFactor: 1,
    coldSlowMaterial: false,
    coldSlowTicks: 0,
    dazzleMaximumTicks: 0,
    dazzleTicks: 0,
    disruptedTicks: 0,
    electricBurn: null,
    fleeTicks: 0,
    frostBurnDamagePerTick: Math.fround(0.01),
    frostBurnOwnerId: 'player-1',
    frostBurnSkillId: 35,
    frostBurnSourceActorId: 44,
    frostBurnTicks: 50_000,
    frozenTicks: 500,
    frozenTimeScale: 0,
    movementModifierOrder: ['frozen'],
    prismaticTicks: 0,
    stunFactor: 1,
    stunTicks: 0,
    steamed: null,
    targetId: 7,
    timeScale: 0,
    weakenFactor: 1,
    worldKey: 'hub:courtyard',
  }
  const message = {
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      secondaryAbilities: {
        ...frame.secondaryAbilities,
        targetEffects: [effect],
      },
    },
    sequence: 2,
  }
  const decoded = decodeServerGameMessage(JSON.stringify(message))
  assert.equal(decoded.type, 'server-snapshot')
  assert.deepEqual(decoded.frame.secondaryAbilities.targetEffects, [effect])

  const invalid = JSON.parse(JSON.stringify(message))
  invalid.frame.secondaryAbilities.targetEffects[0].frostBurnSkillId = 21
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalid)),
    /frostBurnSkillId must be 35 or 76/,
  )

  const duplicateModifier = JSON.parse(JSON.stringify(message))
  duplicateModifier.frame.secondaryAbilities.targetEffects[0]
    .movementModifierOrder.push('frozen')
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateModifier)),
    /movementModifierOrder contains duplicates/,
  )

  const missingModifier = JSON.parse(JSON.stringify(message))
  missingModifier.frame.secondaryAbilities.targetEffects[0].movementModifierOrder = []
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingModifier)),
    /movementModifierOrder does not match active clocks/,
  )

  const wrongScale = JSON.parse(JSON.stringify(message))
  wrongScale.frame.secondaryAbilities.targetEffects[0].timeScale = 1
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongScale)),
    /timeScale does not match modifier order/,
  )
})

test('protocol preserves Earthquake pointer-list order while retaining unique-target validation', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const actor = {
    ageTicks: 0,
    alpha: 1,
    damage: 0,
    enhanced: false,
    endpoint: { x: 0, y: 0 },
    frame: 0,
    freezeTicks: 0,
    golem: null,
    hitTargetIds: [9, 3, 7],
    id: 1,
    kind: 'earthquake',
    lifetimeTicks: 100,
    lightRegistration: null,
    midpoint: { x: 0, y: 0 },
    miscLightAppendOrdinal: null,
    ownerId: 'player-1',
    phase: 0,
    position: { x: 800, y: 400 },
    presentationRng: null,
    quantity: 0,
    radius: 512,
    rank: 1,
    rotationRadians: 0,
    scale: 1,
    skillId: 41,
    slowFactor: 1,
    targetId: null,
    variant: 0,
    velocity: { x: 0, y: 0 },
    worldKey: 'hub:courtyard',
  }
  const message = {
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      secondaryAbilities: {
        ...frame.secondaryAbilities,
        actors: [actor],
        nextActorId: 2,
      },
    },
    sequence: 2,
  }

  const decoded = decodeServerGameMessage(JSON.stringify(message))
  assert.equal(decoded.type, 'server-snapshot')
  assert.deepEqual(decoded.frame.secondaryAbilities.actors[0]!.hitTargetIds, [9, 3, 7])

  const continuousFrame = JSON.parse(JSON.stringify(message))
  continuousFrame.frame.secondaryAbilities.actors[0]!.frame = 0.25
  continuousFrame.frame.secondaryAbilities.actors[0]!.hitTargetIds = []
  continuousFrame.frame.secondaryAbilities.actors[0]!.kind = 'magic-trap'
  continuousFrame.frame.secondaryAbilities.actors[0]!.lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 0,
  }
  continuousFrame.frame.secondaryAbilities.actors[0]!.skillId = 50
  continuousFrame.frame.secondaryAbilities.actors[0]!.slowFactor = -1
  const continuousDecoded = decodeServerGameMessage(JSON.stringify(continuousFrame))
  assert.equal(continuousDecoded.type, 'server-snapshot')
  assert.equal(continuousDecoded.frame.secondaryAbilities.actors[0]!.frame, 0.25)
  assert.equal(continuousDecoded.frame.secondaryAbilities.actors[0]!.slowFactor, -1)

  const flashFrame = JSON.parse(JSON.stringify(message))
  const flashActor = flashFrame.frame.secondaryAbilities.actors[0]!
  flashActor.ageTicks = 1
  flashActor.hitTargetIds = []
  flashActor.kind = 'flash-response-grow'
  flashActor.lifetimeTicks = 20
  flashActor.scale = 1.5
  flashActor.skillId = 53
  const flashDecoded = decodeServerGameMessage(JSON.stringify(flashFrame))
  assert.equal(flashDecoded.type, 'server-snapshot')
  assert.equal(flashDecoded.frame.secondaryAbilities.actors[0]!.skillId, 53)

  const wrongFlashActor = JSON.parse(JSON.stringify(flashFrame))
  wrongFlashActor.frame.secondaryAbilities.actors[0]!.kind = 'earthquake'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongFlashActor)),
    /not a native secondary ability/,
  )

  const golemFrame = JSON.parse(JSON.stringify(message))
  const golemActor = golemFrame.frame.secondaryAbilities.actors[0]!
  golemActor.hitTargetIds = []
  golemActor.kind = 'golem'
  golemActor.lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 0,
  }
  golemActor.skillId = 45
  golemActor.golem = {
    ...nativeInitialGolemArticulation(golemActor.position, 0),
    actionDurationTicks: 0,
    actionTick: 0,
    currentHealth: 100,
    damageMaximum: 10,
    iron: false,
    maximumHealth: 100,
    orbitDirection: 0,
    orbitHeadingRadians: null,
    phase: 'assembly',
    poseVariant: 0,
    provokeRollBound: 0,
    reflectFactor: 0,
    targetPollTicksRemaining: 50,
  }
  const golemDecoded = decodeServerGameMessage(JSON.stringify(golemFrame))
  assert.equal(golemDecoded.type, 'server-snapshot')
  assert.deepEqual(
    golemDecoded.frame.secondaryAbilities.actors[0]!.golem?.leftFoot,
    golemActor.golem.leftFoot,
  )

  const miscFrame = JSON.parse(JSON.stringify(message))
  miscFrame.frame.secondaryAbilities.actors[0]!.hitTargetIds = []
  miscFrame.frame.secondaryAbilities.actors[0]!.kind = 'magic-circle'
  miscFrame.frame.secondaryAbilities.actors[0]!.lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 4,
  }
  miscFrame.frame.secondaryAbilities.actors[0]!.miscLightAppendOrdinal = 0
  miscFrame.frame.secondaryAbilities.actors[0]!.skillId = 49
  const miscDecoded = decodeServerGameMessage(JSON.stringify(miscFrame))
  assert.equal(miscDecoded.type, 'server-snapshot')
  assert.equal(
    miscDecoded.frame.secondaryAbilities.actors[0]!.miscLightAppendOrdinal,
    0,
  )

  const etherBurnFrame = JSON.parse(JSON.stringify(message))
  const etherBurn = etherBurnFrame.frame.secondaryAbilities.actors[0]!
  etherBurn.hitTargetIds = []
  etherBurn.kind = 'ether-burn'
  etherBurn.lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 5,
  }
  etherBurn.miscLightAppendOrdinal = 0
  etherBurn.skillId = 14
  etherBurn.targetId = 7
  const etherBurnDecoded = decodeServerGameMessage(JSON.stringify(etherBurnFrame))
  assert.equal(etherBurnDecoded.type, 'server-snapshot')
  assert.equal(etherBurnDecoded.frame.secondaryAbilities.actors[0]!.skillId, 14)

  const etherFlareFrame = JSON.parse(JSON.stringify(etherBurnFrame))
  const etherFlare = etherFlareFrame.frame.secondaryAbilities.actors[0]!
  etherFlare.kind = 'ether-burn-flare'
  etherFlare.lightRegistration = null
  etherFlare.miscLightAppendOrdinal = null
  const etherFlareDecoded = decodeServerGameMessage(JSON.stringify(etherFlareFrame))
  assert.equal(etherFlareDecoded.type, 'server-snapshot')
  assert.equal(etherFlareDecoded.frame.secondaryAbilities.actors[0]!.kind, 'ether-burn-flare')

  const wrongMiscLane = JSON.parse(JSON.stringify(miscFrame))
  wrongMiscLane.frame.secondaryAbilities.actors[0]!.lightRegistration!.managerLane = 'transient'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongMiscLane)),
    /lightRegistration\.managerLane must be actor/,
  )

  const missingMiscOrder = JSON.parse(JSON.stringify(miscFrame))
  missingMiscOrder.frame.secondaryAbilities.actors[0]!.miscLightAppendOrdinal = null
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingMiscOrder)),
    /miscLightAppendOrdinal must be finite/,
  )

  const providerWithMiscOrder = JSON.parse(JSON.stringify(continuousFrame))
  providerWithMiscOrder.frame.secondaryAbilities.actors[0]!.miscLightAppendOrdinal = 0
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(providerWithMiscOrder)),
    /miscLightAppendOrdinal must be null/,
  )

  const nonOwnerWithRegistration = JSON.parse(JSON.stringify(message))
  nonOwnerWithRegistration.frame.secondaryAbilities.actors[0]!.lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 0,
  }
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(nonOwnerWithRegistration)),
    /lightRegistration must be null/,
  )

  const duplicate = structuredClone(message)
  duplicate.frame.secondaryAbilities.actors[0]!.hitTargetIds = [9, 3, 9]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicate)),
    /hitTargetIds must be unique/,
  )

  const sortedOwner = structuredClone(message)
  sortedOwner.frame.secondaryAbilities.actors[0]!.kind = 'shockwave'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(sortedOwner)),
    /only Earthquake preserves pointer-list order/,
  )
})

test('protocol strictly reserves nullable skill ownership for the two Mindblast actors', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const mindblast = triggerNativePlayerMindblast(createNativeSecondarySimulation(9), {
    element: 'ether',
    level: 3,
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: 'player-1',
    position: { x: 800, y: 400 },
    worldKey: 'hub:courtyard',
  }).state
  const message = {
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      secondaryAbilities: {
        ...frame.secondaryAbilities,
        actors: mindblast.actors,
        nextActorId: mindblast.nextActorId,
      },
    },
    sequence: 2,
  }
  const decoded = decodeServerGameMessage(JSON.stringify(message))
  assert.equal(decoded.type, 'server-snapshot')
  assert.deepEqual(decoded.frame.secondaryAbilities.actors, mindblast.actors)

  const lastWord = triggerNativePlayerMindblast(createNativeSecondarySimulation(10), {
    directDamage: 5_000,
    element: 'fire',
    level: 10_000,
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: 'player-1',
    position: { x: 800, y: 400 },
    presentationScale: 15,
    worldKey: 'hub:courtyard',
  }).state
  const lastWordMessage = structuredClone(message)
  lastWordMessage.frame.secondaryAbilities.actors = lastWord.actors
  lastWordMessage.frame.secondaryAbilities.nextActorId = lastWord.nextActorId
  const decodedLastWord = decodeServerGameMessage(JSON.stringify(lastWordMessage))
  assert.equal(decodedLastWord.type, 'server-snapshot')
  if (decodedLastWord.type !== 'server-snapshot') throw new Error('expected snapshot')
  assert.deepEqual(decodedLastWord.frame.secondaryAbilities.actors, lastWord.actors)

  const ownedMindblast = JSON.parse(JSON.stringify(message))
  ownedMindblast.frame.secondaryAbilities.actors[0]!.skillId = 11
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(ownedMindblast)),
    /skillId must be null exactly for Mindblast actors/,
  )

  const nullOrdinary = JSON.parse(JSON.stringify(message))
  nullOrdinary.frame.secondaryAbilities.actors[0]!.kind = 'phase-burst'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(nullOrdinary)),
    /skillId must be null exactly for Mindblast actors/,
  )

  const missingRng = JSON.parse(JSON.stringify(message))
  missingRng.frame.secondaryAbilities.actors[0]!.presentationRng = null
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingRng)),
    /native Mindblast burst contract/,
  )

  const wrongGrowth = JSON.parse(JSON.stringify(message))
  wrongGrowth.frame.secondaryAbilities.actors[1]!.quantity = 6
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongGrowth)),
    /native Mindblast Shockwave contract/,
  )
})

test('protocol rejects player ids reserved by ordinary JavaScript records', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      players: { ['__proto__']: frame.players['player-1'] },
    },
    sequence: 2,
  })), /player id.*reserved/)
})

test('protocol validates participant ownership and the recovered Hub room graph', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  if (frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  assert.equal(frame.world.participants['player-1']?.activity, null)
  const message = (world: unknown) => JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: { ...frame, world },
    sequence: 2,
  })

  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: {},
  })), /participants must match frame.players exactly/)

  const withPausedActivity = decodeServerGameMessage(message({
    ...frame.world,
    participants: {
      'player-1': { ...frame.world.participants['player-1'], activity: 'paused' },
    },
  }))
  assert.equal(withPausedActivity.type, 'server-snapshot')
  if (withPausedActivity.type !== 'server-snapshot'
    || withPausedActivity.frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  assert.equal(withPausedActivity.frame.world.participants['player-1']?.activity, 'paused')

  const missingActivity: Record<string, unknown> = {
    ...structuredClone(frame.world.participants['player-1']!),
  }
  delete missingActivity.activity
  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: { 'player-1': missingActivity },
  })), /activity/)

  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: {
      'player-1': {
        activity: null,
        region: 'mortuary',
        transition: {
          alpha: 0.5,
          destination: 'library',
          phase: 'outgoing',
          scriptedSpeed: 1,
          scriptedTarget: { x: 512, y: 2024 },
          sourceRegion: 'mortuary',
        },
      },
    },
  })), /transition is inconsistent/)

  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: {
      'player-1': {
        activity: null,
        region: 'courtyard',
        transition: {
          alpha: 1.1,
          destination: 'office',
          phase: 'outgoing',
          scriptedSpeed: 0.45,
          scriptedTarget: { x: 881.5, y: -1000 },
          sourceRegion: 'courtyard',
        },
      },
    },
  })), /alpha must be within/)
})

test('protocol bounds server-controlled world collections', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  assert.equal(snapshot.world.kind, 'hub')
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const hubWorld = snapshot.world
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-welcome',
    developerAccess: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    sessionKind: 'standalone',
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: {
      ...snapshot,
      world: {
        ...hubWorld,
        students: Array.from({ length: 257 }, () => hubWorld.students[0]),
      },
    },
    snapshotSequence: 1,
  })), /at most 256/)
})

test('loaded Boneyard round-trips scene identity, geometry, and Solomon Dig', () => {
  const message = {
    type: 'server-boneyard-loaded' as const,
    boneyard: {
      choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' as const },
      runId: 'run-one',
      seed: '0123456789abcdef',
      sourceSha256: '1'.repeat(64),
      geometrySha256: '2'.repeat(64),
      scene: {
        name: 'Random Level',
        environmentMode: 2,
        bounds: { x: 0, y: 0, w: 1600, h: 1200 },
        spawn: { x: 200, y: 150, facingDeg: 180 },
        objects: [],
        sprites: [],
        roads: [],
        fences: [{
          eid: 'entry-gate',
          points: [{ x: 100, y: 300 }, { x: 300, y: 300 }],
          segmentCode: 2,
          startPostVariant: 4,
          endPostVariant: 1,
          typeId: 3005,
        }],
        terrain: [],
        solomonDig: {
          gravePosition: { x: 190, y: 277 },
          lanternPosition: { x: 135, y: 350 },
          position: { x: 200, y: 390 },
          frameProgram: [0, 3, 17, 3],
          ticksPerFrame: 5,
        },
      },
    },
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)

  const snapshot = createGameSnapshot(
    enterBoneyardWorld(
      createGameSimulation({ 'player-1': CHARACTER }),
      message.boneyard,
    ),
    'player-1',
  )
  assert.equal(snapshot.world.kind, 'boneyard')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshot.world.gateLeaves.length, 2)
  assert.equal(snapshot.world.encounter?.acceleration, 0)
  assert.deepEqual(snapshot.world.encounter?.digAudioEvents, [])
  assert.equal(snapshot.world.encounter?.digFrame, 0)
  assert.equal(snapshot.world.encounter?.transitionOffsetY, 0)
  const snapshotMessage = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(snapshotMessage)),
    snapshotMessage,
  )

  const malformed = JSON.parse(encodeGameMessage(snapshotMessage))
  delete malformed.frame.world.gateLeaves[0].tip
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(malformed)),
    /tip/,
  )

  const invalidPhase = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidPhase.frame.world.encounter.phase = 'monologuing'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidPhase)),
    /encounter\.phase/,
  )

  const invalidCue = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidCue.frame.world.encounter.voiceEvents = [{ id: 1, cue: 'solomon-improvised' }]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidCue)),
    /voiceEvents\[0\]\.cue/,
  )

  const invalidDigAudioCue = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidDigAudioCue.frame.world.encounter.digAudioEvents = [{
    id: 1,
    cue: 'backhoe-1',
  }]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDigAudioCue)),
    /digAudioEvents\[0\]\.cue/,
  )

  const unorderedDigAudio = JSON.parse(encodeGameMessage(snapshotMessage))
  unorderedDigAudio.frame.world.encounter.digAudioEvents = [
    { id: 2, cue: 'shovel-1' },
    { id: 2, cue: 'throw-dirt-1' },
  ]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unorderedDigAudio)),
    /digAudioEvents ids must increase/,
  )

  const excessiveDigAudio = JSON.parse(encodeGameMessage(snapshotMessage))
  excessiveDigAudio.frame.world.encounter.digAudioEvents = Array.from(
    { length: 9 },
    (_, index) => ({ id: index + 1, cue: 'shovel-1' }),
  )
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(excessiveDigAudio)),
    /digAudioEvents may contain at most 8/,
  )

  const exactNativeHeading = JSON.parse(encodeGameMessage(snapshotMessage))
  exactNativeHeading.frame.world.encounter.headingDeg = 360
  const decodedHeading = decodeServerGameMessage(JSON.stringify(exactNativeHeading))
  assert.equal(
    decodedHeading.type === 'server-snapshot'
      && decodedHeading.frame.world.kind === 'boneyard'
      ? decodedHeading.frame.world.encounter?.headingDeg
      : null,
    360,
  )

  const invalidDigFrame = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidDigFrame.frame.world.encounter.digFrame = 18
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDigFrame)),
    /encounter\.digFrame/,
  )

  const enemyDescriptor = [2, 1, 0, 1001, 12, 5, 1, 0, 0, 2, 0]
  const invalidType = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidType.frame.world.entities.spawned = [[...enemyDescriptor.slice(0, 3), 1004, ...enemyDescriptor.slice(4)]]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidType)),
    /invalid registered descriptor shape/,
  )

  const duplicateEnemies = JSON.parse(encodeGameMessage(snapshotMessage))
  duplicateEnemies.frame.world.entities.spawned = [enemyDescriptor, [...enemyDescriptor]]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateEnemies)),
    /duplicates 2:1/,
  )
})

test('protocol v42 strictly round-trips loot, Goodies, and their semantic event lane', () => {
  const runId = 'loot-protocol-run'
  let state = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    {
      ...loadedBoneyardFixture(runId),
      scene: {
        ...loadedBoneyardFixture(runId).scene,
        objects: [{ eid: 'goodie-1', typeId: 2061, pos: { x: 300, y: 400 } }],
      },
    },
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [{
    activationDelayTicks: 0,
    amount: 11,
    id: 1,
    kind: 'gold',
    nativeTypeId: 2012,
    phase: 30,
    position: { x: 1500, y: 1750 },
    source: 'enemy',
    tier: 3,
  }], 1)
  state = {
    ...state,
    tick: 1,
    world: {
      ...state.world,
      loot: spawned.store,
      lootEvents: [{
        actorId: 1,
        eventId: 1,
        playbackRate: 1,
        position: { x: 1500, y: 1750 },
        sound: 'drop-coins',
        tick: 1,
        type: 'loot-drop-sound',
      }],
    },
  }
  const snapshot = createGameSnapshot(state, 'player-1')
  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 1,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)

  const invalidCue = JSON.parse(encodeGameMessage(message))
  invalidCue.frame.world.lootEvents[0].sound = 'drop-maybe'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidCue)),
    /sound is not supported/,
  )
  const invalidDescriptor = JSON.parse(encodeGameMessage(message))
  const descriptor = invalidDescriptor.frame.world.entities.spawned.find(
    (entry: number[]) => entry[0] === 7,
  )
  descriptor[3] = 2011
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDescriptor)),
    /invalid registered descriptor shape/,
  )
})

test('full Boneyard welcome strictly round-trips a content-identified mod Sack', () => {
  const runId = 'mod-sack-welcome-run'
  let state = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loadedBoneyardFixture(runId),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const content = {
    consumeVfx: {
      color: [0, 1, 0, 1] as const,
      kind: 'spell_glow' as const,
    },
    contentId: '8068156596081641415',
    description: 'Prevents damage and mana loss.',
    durationMs: 180_000,
    icon: {
      atlasId: 'canary.lua.invincibility_potion:invincibility-potion',
      frame: {
        centerOffsetX: 0,
        centerOffsetY: 0,
        contentHeight: 32,
        contentWidth: 32,
        height: 32,
        logicalHeight: 32,
        logicalWidth: 32,
        width: 32,
        x: 0,
        y: 0,
      },
      frameIndex: 0,
      imagePath: 'sprites/invincibility_potion.png',
    },
    key: 'invincibility-potion',
    modId: 'canary.lua.invincibility_potion',
  }
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [{
    activationDelayTicks: 0,
    id: 0,
    item: {
      equipmentType: null,
      iconRecords: [],
      id: 77,
      kind: 'mod-potion',
      modContent: content,
      name: 'Invincibility Potion',
      nativeSubtype: 6,
      nativeTypeId: 7001,
      quantity: 1,
      rarity: null,
      recipeIndex: null,
    },
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position: { x: 800, y: 600 },
    source: 'enemy',
  }], 1)
  state = { ...state, tick: 1, world: { ...state.world, loot: spawned.store } }
  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    developerAccess: false,
    gameplayPause: null,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    modAssets: [],
    modCatalog: [{ content, name: 'Invincibility Potion', nativeSubtype: 6 }],
    playerId: 'player-1',
    protocolVersion: GAME_PROTOCOL_VERSION,
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    sessionKind: 'standalone',
    snapshot: createGameSnapshot(state, 'player-1'),
    snapshotRate: 20,
    snapshotSequence: 1,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)

  const nativePotionWithContent = JSON.parse(encodeGameMessage(welcome))
  nativePotionWithContent.snapshot.world.loot[0].itemNativeSubtype = 0
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(nativePotionWithContent)),
    /item identity is not a native Sack payload/,
  )
  const undeclaredField = JSON.parse(encodeGameMessage(welcome))
  undeclaredField.snapshot.world.loot[0].itemContentHint = content.contentId
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(undeclaredField)),
    /itemContentHint is not allowed/,
  )
})

test('party protocol strictly round-trips membership, access settings, requests, and results', () => {
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: 'player-2',
  })), {
    type: 'client-party-invite',
    targetPlayerId: 'player-2',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: 'invite-7',
  })), {
    type: 'client-party-accept',
    invitationId: 'invite-7',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-party-deny',
    invitationId: 'invite-8',
  })), {
    type: 'client-party-deny',
    invitationId: 'invite-8',
  })
  for (const message of [
    { type: 'client-party-settings' as const, visibility: 'invite-only' as const },
    { type: 'client-party-rotate-code' as const },
    { type: 'client-party-request-accept' as const, requestId: 'request-7' },
    { type: 'client-party-request-deny' as const, requestId: 'request-8' },
    { type: 'client-party-leave' as const },
    { type: 'client-party-kick' as const, targetPlayerId: 'player-2' },
  ]) assert.deepEqual(decodeClientGameMessage(encodeGameMessage(message)), message)

  const message = {
    type: 'server-party-state' as const,
    state: {
      hubPlayers: [
        {
          accountUsername: 'aurelia-prime',
          displayName: 'Aurelia',
          highestWave: 23,
          playerId: 'player-1',
          totalPlaytimeMs: 5_400_000,
        },
        {
          accountUsername: null,
          displayName: 'Basil',
          highestWave: null,
          playerId: 'player-2',
          totalPlaytimeMs: null,
        },
      ],
      invitations: [{
        id: 'invite-7',
        inviter: {
          accountUsername: 'aurelia-prime',
          displayName: 'Aurelia',
          highestWave: 23,
          playerId: 'player-1',
          totalPlaytimeMs: 5_400_000,
        },
        partyId: 'party-1',
      }],
      joinRequests: [{
        id: 'request-7',
        requester: {
          accountUsername: null,
          displayName: 'Guest Cassia',
          requesterId: 'requester-cassia',
        },
      }],
      party: {
        id: 'party-2',
        joinCode: 'ABCD-2345',
        leaderPlayerId: 'player-2',
        listingId: 'listing-2',
        memberPlayerIds: ['player-2'],
        visibility: 'invite-only' as const,
      },
      revision: 4,
    },
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-party-action',
    action: 'settings',
    ok: false,
    reason: 'not-leader',
  })), {
    type: 'server-party-action',
    action: 'settings',
    ok: false,
    reason: 'not-leader',
  })

  const duplicateMember = structuredClone(message)
  duplicateMember.state.party.memberPlayerIds.push('player-2')
  assert.throws(
    () => decodeServerGameMessage(encodeGameMessage(duplicateMember)),
    /memberPlayerIds.*duplicate/,
  )
  const missingInviter = structuredClone(message)
  missingInviter.state.hubPlayers.shift()
  assert.throws(
    () => decodeServerGameMessage(encodeGameMessage(missingInviter)),
    /inviter.*Hub player/,
  )
})

test('protocol strictly round-trips every welded projectile and persistent actor family', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const decodeFrame = (primarySpells: unknown) => decodeServerGameMessage(JSON.stringify({
    acknowledgedInputSequence: 0,
    frame: { ...frame, primarySpells },
    sequence: 2,
    type: 'server-snapshot',
  }))
  const projectile = {
    ageTicks: 1,
    ballLightningAcceleration: null,
    basePresentationPhaseDegrees: 35,
    buildId: 1000,
    castPlaybackRate: 1,
    castSoundVariant: null,
    charge: 1,
    contactsRemaining: 1,
    damage: 8,
    direction: { x: 0, y: -1 },
    flightTicks: 1,
    frostPulseAspect: null,
    frostPresentationLanes: null,
    frostTurnDegrees: null,
    groundSparkNativeAgeTicks: null,
    groundSparkTurnTicksRemaining: null,
    headingDegrees: 0,
    hitTargetIds: [],
    id: 1,
    kind: 'weld',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: 'player-1',
    phase: 'flight',
    position: { x: 800, y: 400 },
    presentationSeed: 42,
    projectileIndex: 0,
    reacquiresTarget: false,
    secondaryPresentationPhaseDegrees: null,
    speed: 3,
    targetId: null,
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
    turnInput: 2,
    underpowered: false,
    vector: [4, 8, 10, 1, 1, 0, 0, 0, 0],
    velocity: { x: 0, y: -3 },
    worldKey: 'hub:courtyard',
  }
  const common = {
    ageTicks: 0,
    birthTick: 100,
    direction: { x: 0, y: -1 },
    id: 1,
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    worldKey: 'hub:courtyard',
  }
  const actors = [{
    ...common,
    buildId: 1003,
    endpoint: { x: 800, y: 200 },
    kind: 'weld-channel',
    lightRegistration: null,
    midpoint: { x: 800, y: 300 },
    targetId: null,
    underpowered: false,
    variant: 1,
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
  }, {
    ...common,
    alpha: 1,
    alphaStep: Math.fround(0.2),
    baseScale: Math.fround(0.75),
    buildId: 1003,
    colorGreen: Math.fround(0.75),
    kind: 'weld-flame-lash-fade',
    lightRegistration: null,
    position: { x: 800, y: 200 },
    record: 35,
    rotationDegrees: 45,
    variant: 'endpoint',
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    wrapperScalar: 1,
  }, {
    ...common,
    alphaMultiplier: 1,
    blue: Math.fround(0.75),
    buildId: 1005,
    colorRise: Math.fround(0.15),
    contactDamage: 8,
    contactDue: false,
    contactEnabled: true,
    contactTicksRemaining: 5,
    kind: 'weld-steam',
    life: 1,
    lifeLoss: Math.fround(0.03),
    lightRegistration: null,
    phase: 0,
    position: { x: 800, y: 350 },
    remainingDistance: 9_999_999,
    rotationDegrees: 0,
    scale: 1,
    stretch: 2,
    terminalPosition: { x: 800, y: 350 },
    tintFade: 1,
    variant: 'normal',
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    velocity: { x: 1, y: 0 },
  }, {
    ...common,
    buildId: 1004,
    glowIndex: 0,
    kind: 'weld-blizzard-glow',
    lightRegistration: null,
    position: { x: 800, y: 400 },
    rotationDegrees: 45,
    scale: 1.25,
    variant: 24,
    vector: [8, 2, 1, 0.8, 0, 0, 0],
  }, {
    ...common,
    alpha: 0,
    boulderTerminalCharge: null,
    buildId: 1000,
    impactSoundPitch: null,
    impactSoundVariant: null,
    kind: 'weld-impact',
    lightRegistration: null,
    position: { x: 800, y: 350 },
    presentationRotationDegrees: null,
    presentationScale: 0,
    vector: [4, 8, 10, 1, 1, 0, 0, 0, 0],
  }, {
    ...common,
    buildId: 1007,
    alpha: 0.4,
    colorGreen: 0.25,
    growthFactor: Math.fround(1.015),
    kind: 'weld-meteor-marker',
    lightRegistration: null,
    rotationDegrees: 45,
    scale: 3.5,
    vector: [8, 12, 20, 1, 1, 0, 0, 0, 0],
  }, {
    ...common,
    alpha: 2,
    alphaStep: Math.fround(0.1),
    buildId: 1007,
    kind: 'weld-meteor-flash',
    lightRegistration: null,
    position: { x: 800, y: 350 },
    record: 15,
    scale: 6,
    vector: [8, 12, 20, 1, 1, 0, 0, 0, 0],
  }, {
    ...common,
    bodyScale: 1,
    buildId: 1007,
    cameraDisplacement: null,
    damage: 12,
    debris: [],
    fallHeadingDegrees: 20,
    fallHeight: 5,
    fallStep: Math.fround(0.04),
    impactAgeTicks: 0,
    impactDue: false,
    impactRadiusScalar: 1,
    impactRotationDegrees: 0,
    impactSoundPitch: null,
    impactThrowFirePitch: null,
    impactTicksRemaining: 200,
    kind: 'weld-meteor',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    phase: 'fall',
    position: { x: 800, y: 350 },
    privateSeed: 42,
    pulseDue: false,
    pulseSequence: 0,
    pulseTicksRemaining: 10,
    underpowered: false,
    vector: [8, 12, 20, 1, 1, 0, 0, 0, 0],
  }, {
    ...common,
    buildId: 1006,
    debris: {
      alpha: 2,
      bounceVelocity: -1,
      colorGreen: 0.25,
      enhancedShadow: true,
      height: -1,
      index: 0,
      position: { x: 0, y: 0 },
      record: 2008,
      rotationDegrees: 0,
      rotationStepDegrees: 1,
      scale: Math.fround(0.3375),
      velocity: { x: 1, y: 0 },
      verticalVelocity: -1,
    },
    kind: 'weld-boulder-debris',
    lightRegistration: null,
    position: { x: 800, y: 350 },
    vector: [12, 2, 1, 1, 1, 1],
  }, {
    ...common,
    buildId: 1008,
    kind: 'weld-hail-rock-fade',
    lightRegistration: null,
    position: { x: 810, y: 390 },
    rotationDegrees: 10,
    vector: [7, 2, 1, 1, 0.2, 0.5],
  }, {
    ...common,
    buildId: 1008,
    kind: 'weld-frost-fade',
    lightRegistration: null,
    position: { x: 800, y: 380 },
    scale: 5,
    vector: [7, 2, 1, 1, 0.2, 0.5],
  }, {
    ...common,
    alpha: Math.fround(0.75),
    alphaStep: Math.fround(0.1),
    buildId: 1009,
    kind: 'weld-ground-spark-fade',
    lightRegistration: null,
    position: { x: 800, y: 380 },
    record: 71,
    rotationDegrees: 20,
    scale: Math.fround(0.35),
    vector: [7, 2, 1, 1, 0, 0],
  }, {
    ...common,
    alpha: 1,
    alphaStep: Math.fround(0.075),
    buildId: 1008,
    end: { x: 820, y: 390 },
    endAlpha: Math.fround(0.4),
    kind: 'weld-hail-line',
    lightRegistration: null,
    start: { x: 800, y: 380 },
    vector: [7, 2, 1, 1, 0.2, 0.5],
    width: 6,
  }, {
    ...common,
    alpha: 1,
    alphaStep: Math.fround(0.1),
    buildId: 1008,
    kind: 'weld-hail-flash',
    lightRegistration: null,
    position: { x: 820, y: 390 },
    record: 15,
    vector: [7, 2, 1, 1, 0.2, 0.5],
  }, {
    ...common,
    buildId: 1008,
    delta: { x: 0, y: -1 },
    kind: 'weld-hail-knockback',
    lightRegistration: null,
    remainingTicks: 4,
    targetId: 'enemy:1',
    vector: [7, 2, 1, 1, 0.2, 0.5],
  }, {
    ...common,
    alpha: Math.fround(0.75),
    alphaStep: Math.fround(0.125),
    buildId: 1008,
    kind: 'weld-hail-terrain-particle',
    lightRegistration: null,
    position: { x: 820, y: 390 },
    record: 45,
    rotationDegrees: 240,
    scale: Math.fround(0.4),
    tint: 0xffffff,
    vector: [7, 2, 1, 1, 0.2, 0.5],
    velocity: { x: 1, y: -1 },
    velocityFactor: Math.fround(0.92),
  }, {
    ...common,
    alpha: 1.5,
    bounceVelocity: -2,
    buildId: 1008,
    enhancedShadow: true,
    height: -10,
    kind: 'weld-hail-terrain-bouncer',
    lightRegistration: null,
    position: { x: 820, y: 390 },
    record: 32,
    rotationDegrees: 240,
    rotationStepDegrees: 5,
    scale: Math.fround(0.6),
    vector: [7, 2, 1, 1, 0.2, 0.5],
    velocity: { x: 1, y: -1 },
    verticalVelocity: -2,
  }, {
    ...common,
    assemblyScale: Math.fround(0.18),
    buildId: 1006,
    damage: 12,
    flightTicks: 0,
    hitTargetIds: [],
    kind: 'weld-persistent',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    lifetimeTicksRemaining: 1_250,
    maximumScale: Math.fround(0.75),
    orientation: EARTH_BOULDER_IDENTITY_ORIENTATION,
    phase: 'held',
    pulseSequence: 0,
    quantity: 1,
    remainingDamage: 12,
    scale: Math.fround(0.18),
    shellScale: Math.fround(0.18),
    speedFactor: 1,
    toughness: 1,
    vector: [12, 2, 1, 1, 1, 1],
    velocity: { x: 0, y: 0 },
  }, {
    ...common,
    buildId: 1007,
    kind: 'weld-persistent',
    lightRegistration: null,
    phase: 'held',
    pulseSequence: 0,
    vector: [8, 12, 20, 1, 1, 0, 0, 0, 0],
  }, {
    ...common,
    buildId: 1008,
    collisionRadius: 40,
    damage: 7,
    kind: 'weld-persistent',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    maximumScale: 1,
    phase: 'held',
    releaseAgeTicks: null,
    releaseFadeScale: null,
    pulseSequence: 0,
    pushback: 0.2,
    rocks: [{
      damageRemaining: 0,
      decay: 1,
      localPosition: { x: 1, y: 2, z: 3 },
      phase: 0,
      rockId: 0,
      releaseOffset: null,
      spriteRecord: 168,
      visualScale: 0.2,
    }],
    scale: Math.fround(0.18),
    toughness: 1,
    vector: [7, 2, 1, 1, 0.2, 0.5],
    widen: 0.5,
  }]

  const decodedProjectile = decodeFrame({
    nextId: 2,
    projectiles: [projectile],
    transients: [],
  })
  assert.equal(decodedProjectile.type, 'server-snapshot')
  assert.deepEqual(decodedProjectile.frame.primarySpells.projectiles, [projectile])
  for (const actor of actors) {
    const decoded = decodeFrame({ nextId: 2, projectiles: [], transients: [actor] })
    assert.equal(decoded.type, 'server-snapshot')
    assert.deepEqual(decoded.frame.primarySpells.transients, [actor])
  }
  const hailActor = actors.find((actor) => 'rocks' in actor)
  if (!hailActor || !('rocks' in hailActor)) throw new Error('expected Hailstones fixture')
  assert.throws(() => decodeFrame({
    nextId: 2,
    projectiles: [{ ...projectile, vector: projectile.vector.slice(1) }],
    transients: [],
  }), /must contain 9 native values/)
  assert.throws(() => decodeFrame({
    nextId: 2,
    projectiles: [],
    transients: [{
      ...hailActor,
      rocks: [{ ...hailActor.rocks[0], releaseOffset: { x: 1, y: 2 } }],
    }],
  }), /releaseOffset does not match/)
})

test('chat protocol strictly bounds client text and authoritative server events', () => {
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-chat',
    channel: 'party',
    text: 'Meet by the fountain.',
  })), {
    type: 'client-chat',
    channel: 'party',
    text: 'Meet by the fountain.',
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-chat',
    channel: 'global',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 17,
    text: 'The Courtyard is busy today.',
  })), {
    type: 'server-chat',
    channel: 'global',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 17,
    text: 'The Courtyard is busy today.',
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-chat-rejected',
    channel: 'party',
    reason: 'rate-limited',
    retryAfterMs: 2_500,
  })), {
    type: 'server-chat-rejected',
    channel: 'party',
    reason: 'rate-limited',
    retryAfterMs: 2_500,
  })

  for (const text of [
    '',
    ' leading',
    'trailing ',
    'line\nbreak',
    'x'.repeat(GAME_CHAT_MAX_TEXT_CODE_UNITS + 1),
    '界'.repeat(171),
  ]) {
    assert.throws(() => decodeClientGameMessage(JSON.stringify({
      type: 'client-chat',
      channel: 'party',
      text,
    })), GameProtocolError)
  }
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerId: 'player-3',
    text: 'Between us only.',
  })), {
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerId: 'player-3',
    text: 'Between us only.',
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-chat',
    channel: 'whisper',
    recipient: { displayName: 'Basil', playerId: 'player-3' },
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 18,
    text: 'Between us only.',
  })), {
    type: 'server-chat',
    channel: 'whisper',
    recipient: { displayName: 'Basil', playerId: 'player-3' },
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 18,
    text: 'Between us only.',
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-chat-rejected',
    channel: 'whisper',
    reason: 'target-unavailable',
    retryAfterMs: 0,
  })), {
    type: 'server-chat-rejected',
    channel: 'whisper',
    reason: 'target-unavailable',
    retryAfterMs: 0,
  })
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-chat',
    channel: 'whisper',
    text: 'Hello',
  })), /targetPlayerId is required exactly when the channel is whisper/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-chat',
    channel: 'party',
    targetPlayerId: 'player-3',
    text: 'Hello',
  })), /targetPlayerId is required exactly when the channel is whisper/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-chat',
    channel: 'whisper',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 1,
    text: 'Hello',
  })), /recipient is required exactly when the channel is whisper/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-chat',
    channel: 'global',
    recipient: { displayName: 'Basil', playerId: 'player-3' },
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 1,
    text: 'Hello',
  })), /recipient is required exactly when the channel is whisper/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-chat',
    channel: 'party',
    sender: { displayName: 'Aurelia', playerId: 'player-2', forged: true },
    sequence: 1,
    text: 'Hello',
  })), /sender\.forged is not allowed/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-chat-rejected',
    channel: 'global',
    reason: 'rate-limited',
    retryAfterMs: 60_001,
  })), /retryAfterMs must be within/)
})
