import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { LocalPartyState } from './protocol/party-state.ts'
import {
  GAME_CHAT_HISTORY_LIMIT,
  GAME_CHAT_INACTIVITY_HOLD_MS,
  appendGameChatMessage,
  availableGameChatChannels,
  defaultGameChatChannel,
  gameChatRejectionText,
  isGameChatFaded,
  nextGameChatChannel,
  reconcileGameChatChannel,
  shouldIncrementGameChatUnread,
} from './game-chat.ts'
import { nativeInventoryGoldLedgerRight } from './native-inventory-gold-layout.ts'

const singleton = partyState(['player-1'])
const grouped = partyState(['player-1', 'player-2'])
const component = readFileSync(new URL('./GameChat.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./game-chat.css', import.meta.url), 'utf8')
const mainMenu = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const playerCard = readFileSync(new URL('./PlayerCardDialog.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')
const inventory = readFileSync(new URL('./HubInventoryUi.tsx', import.meta.url), 'utf8')
const inventoryRenderer = readFileSync(
  new URL('./renderer/hub-inventory-renderer.ts', import.meta.url),
  'utf8',
)
const skillBook = readFileSync(new URL('./SkillBook.tsx', import.meta.url), 'utf8')
const skillPicker = readFileSync(new URL('./SkillPicker.tsx', import.meta.url), 'utf8')
const hudSkillSelector = readFileSync(new URL('./HudSkillSelector.tsx', import.meta.url), 'utf8')
const pauseMenu = readFileSync(new URL('./GameplayPauseMenu.tsx', import.meta.url), 'utf8')
const mainMenuCss = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')
const playerReference = (suffix: string) => `player-ref-${suffix.padEnd(32, 'x').slice(0, 32)}`

test('chat channels follow host-wide Global, Hub Party, and exact Boneyard scope', () => {
  assert.deepEqual(availableGameChatChannels('hub', singleton, 'global-hub'), ['global'])
  assert.equal(defaultGameChatChannel('hub', singleton, 'global-hub'), 'global')
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'global-hub'),
    ['party', 'global'],
  )
  assert.equal(defaultGameChatChannel('hub', grouped, 'global-hub'), 'party')
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, 'global-hub'),
    ['boneyard', 'global'],
  )
  assert.equal(defaultGameChatChannel('boneyard', grouped, 'global-hub'), 'boneyard')
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, 'private-college'),
    ['boneyard', 'global'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', singleton, 'private-college'),
    ['global'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'private-college'),
    ['party', 'global'],
  )
  assert.deepEqual(availableGameChatChannels('hub', null, 'standalone'), ['party'])
})

test('whisper channel appears exactly while a whisper thread is open', () => {
  assert.deepEqual(
    availableGameChatChannels('hub', singleton, 'global-hub', true),
    ['global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'global-hub', true),
    ['party', 'global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, 'global-hub', true),
    ['boneyard', 'global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'global-hub', false),
    ['party', 'global'],
  )
  const channels = availableGameChatChannels('hub', grouped, 'global-hub', true)
  assert.equal(nextGameChatChannel('global', channels), 'whisper')
  assert.equal(nextGameChatChannel('whisper', channels), 'party')
  assert.equal(reconcileGameChatChannel('whisper', ['party', 'global']), 'party')
})

test('Tab cycling and channel reconciliation stay inside current membership', () => {
  const channels = availableGameChatChannels('hub', grouped, 'global-hub')
  assert.equal(nextGameChatChannel('party', channels), 'global')
  assert.equal(nextGameChatChannel('global', channels), 'party')
  assert.equal(nextGameChatChannel('global', ['global']), 'global')
  assert.equal(nextGameChatChannel('party', ['party']), 'party')
  assert.equal(reconcileGameChatChannel('global', ['party']), 'party')
  assert.equal(reconcileGameChatChannel('party', channels), 'party')
})

test('chat history is ordered, duplicate-safe, and bounded', () => {
  let messages = [] as ReturnType<typeof appendGameChatMessage>
  for (let sequence = 1; sequence <= GAME_CHAT_HISTORY_LIMIT + 2; sequence += 1) {
    messages = appendGameChatMessage(messages, {
      channel: 'party',
      sender: {
        displayName: 'Helvidius',
        playerId: 'player-1',
        playerReference: playerReference('one'),
      },
      sequence,
      text: `Message ${sequence}`,
    })
  }
  assert.equal(messages.length, GAME_CHAT_HISTORY_LIMIT)
  assert.equal(messages[0]!.sequence, 3)
  assert.equal(messages.at(-1)?.sequence, GAME_CHAT_HISTORY_LIMIT + 2)
  assert.equal(appendGameChatMessage(messages, messages.at(-1)!), messages)
})

test('host-authored activity shares Global history without becoming player speech', () => {
  const activity = {
    activity: 'entered-college',
    channel: 'global',
    sender: {
      displayName: 'Aurelia',
      playerId: 'player-2',
      playerReference: playerReference('two'),
    },
    sequence: 1,
    text: 'Aurelia has entered the college.',
  } as const
  assert.deepEqual(appendGameChatMessage([], activity), [activity])
  assert.equal(shouldIncrementGameChatUnread(activity, 'player-1', false, 'boneyard'), true)
  assert.match(component, /message\.activity/)
  assert.match(mainMenu, /if \(message\.activity !== undefined\) return/)
})

test('chat cue is owned by the deduplicated authoritative delivery, never draft submit', () => {
  assert.match(
    mainMenu,
    /session\.onChatMessage\(presentWorldSpeech\)/,
  )
  assert.match(
    mainMenu,
    /const request = HUB_SOCIAL_SOUND_REQUESTS\.chat[\s\S]*audio\.playSound\(request\.cue,[\s\S]*appendGameWorldSpeech/,
  )
  assert.doesNotMatch(
    component,
    /const submit[\s\S]*audio\.playSound/,
  )
  assert.doesNotMatch(component, /onMessage\(message\)/)
})

test('closed chat fades at the exact inactivity boundary and open chat does not', () => {
  assert.equal(isGameChatFaded(false, 10, 10 + GAME_CHAT_INACTIVITY_HOLD_MS - 1), false)
  assert.equal(isGameChatFaded(false, 10, 10 + GAME_CHAT_INACTIVITY_HOLD_MS), true)
  assert.equal(isGameChatFaded(true, 10, 10 + GAME_CHAT_INACTIVITY_HOLD_MS * 2), false)
})

test('chat rejections provide concise channel and retry feedback', () => {
  assert.equal(gameChatRejectionText({
    channel: 'global',
    reason: 'channel-unavailable',
    retryAfterMs: 0,
  }), 'Global chat is unavailable here.')
  assert.equal(gameChatRejectionText({
    channel: 'party',
    reason: 'rate-limited',
    retryAfterMs: 1_001,
  }), 'Slow down. Try again in 2s.')
  assert.equal(gameChatRejectionText({
    channel: 'whisper',
    reason: 'target-unavailable',
    retryAfterMs: 0,
  }), 'That wizard is no longer connected.')
})

test('closed chat counts only remote messages as unread', () => {
  const own = {
    channel: 'global',
    sender: {
      displayName: 'Helvidius',
      playerId: 'player-1',
      playerReference: playerReference('one'),
    },
    sequence: 1,
    text: 'sent and closed',
  } as const
  const remote = {
    ...own,
    sender: {
      displayName: 'Daria',
      playerId: 'player-2',
      playerReference: playerReference('two'),
    },
    sequence: 2,
  } as const
  assert.equal(shouldIncrementGameChatUnread(own, 'player-1', false, 'global'), false)
  assert.equal(shouldIncrementGameChatUnread(remote, 'player-1', false, 'global'), true)
  assert.equal(shouldIncrementGameChatUnread(remote, 'player-1', true, 'global'), false)
  assert.equal(shouldIncrementGameChatUnread(remote, 'player-1', true, 'party'), true)
})

test('chat UI owns its configured key, real text focus, Tab channels, fade, and local gameplay exclusion', () => {
  assert.match(mainMenu, /const GameChat = lazy\(\(\) => import\('\.\/GameChat\.tsx'\)\)/)
  assert.match(component, /event\.code !== openKeyCode/)
  assert.match(component, /<input/)
  assert.match(
    component,
    /if \(event\.key === 'Tab'\) \{\s*event\.preventDefault\(\)\s*event\.stopPropagation\(\)[\s\S]*?const enabledChannels[\s\S]*?chooseChannel/,
  )
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /className="game-chat-player-name"/)
  assert.match(component, /onPlayerCardRequest\(message\.sender\.playerReference\)/)
  assert.match(component, /messageCardTarget\(message, session\.playerId\)/)
  assert.match(component, /aria-label="Open chat"/)
  assert.match(css, /data-chat-faded='true'/)
  assert.match(css, /opacity 650ms ease/)
  assert.match(mainMenu, /const sceneInputBlocked = chatOpen/)
  assert.match(mainMenu, /openKeyCode=\{gameSettings\.controls\.openChat\}/)
  assert.match(hubScene, /event\.code !== settings\.controls\.openSkills/)
  assert.match(boneyardScene, /event\.code !== settings\.controls\.openSkills/)
})

test('chat clears the exact scaled gold ledger on Inventory and companion service surfaces', () => {
  assert.equal(nativeInventoryGoldLedgerRight(500), 75)
  assert.equal(nativeInventoryGoldLedgerRight(10_000), 96)
  assert.equal(nativeInventoryGoldLedgerRight(Number.MAX_SAFE_INTEGER), 207)
  assert.match(inventoryRenderer, /NATIVE_INVENTORY_GOLD_LEDGER\.iconRecord/)
  assert.match(inventoryRenderer, /NATIVE_INVENTORY_GOLD_LEDGER\.iconCenter/)

  assert.ok(mainMenu.includes('gold={runtimeSnapshot.players[session.playerId]!.economy.gold}'))
  assert.ok(mainMenu.includes('nativeStageLeftPx={nativeStageCssBounds.x}'))
  assert.ok(mainMenu.includes('nativeStageScale={fixedViewport.displayScale}'))
  assert.match(component, /nativeInventoryGoldLedgerRight\(gold\)/)
  assert.match(component, /data-native-gold-clear-left=\{nativeGoldClearLeftPx\}/)
  assert.match(component, /--game-chat-gold-clear-left/)

  const finePointerRule = css.slice(
    css.indexOf('@media (hover: hover) and (pointer: fine)'),
    css.indexOf('/* ---- transcript / panel'),
  )
  assert.match(finePointerRule, /data-surface-kind='inventory'/)
  assert.match(finePointerRule, /data-surface-kind='service'/)
  assert.match(
    finePointerRule,
    /left: max\(clamp\(14px, 2\.2vw, 34px\), var\(--game-chat-gold-clear-left\)\)/,
  )
})

test('the open chat window owns Escape independent of focus and closes on accepted submit', () => {
  assert.match(
    component,
    /openRef\.current[\s\S]*event\.key === 'Escape'[\s\S]*stopImmediatePropagation\(\)[\s\S]*closeChat\(\)/,
  )
  assert.doesNotMatch(
    component,
    /const handleInputKey[\s\S]*event\.key === 'Escape'/,
  )
  assert.match(
    component,
    /const submit[\s\S]*session\.sendChatMessage\([\s\S]*closeChat\(\)/,
  )
  assert.match(
    component,
    /onChatRejected[\s\S]*setOpen\(true\)/,
  )
})

test('chat remains admitted over every gameplay modal while exclusive application surfaces still disable it', () => {
  const disabled = mainMenu.slice(
    mainMenu.indexOf('const chatDisabled ='),
    mainMenu.indexOf('const sceneInputBlocked ='),
  )
  for (const retainedModal of [
    'levelUpModalActive',
    'skillBookOpen',
    'hudSkillSelector',
    'inventoryScreenOpen',
    'hubPauseMenuOpen',
    'gameplayPause',
  ]) assert.doesNotMatch(disabled, new RegExp(retainedModal))
  for (const exclusiveSurface of [
    'loading !== null',
    'tutorialSession',
    'gameplaySettingsOpen',
    'gameplayResumeGrace !== null',
    'socialModalOpen',
  ]) assert.match(disabled, new RegExp(exclusiveSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.equal(mainMenu.match(/chatInputActive=\{chatOpen\}/g)?.length, 2)
  assert.equal(mainMenu.match(/inputSuspended=\{chatOpen \|\| socialModalOpen\}/g)?.length, 4)
  assert.match(
    mainMenuCss,
    /\.main-menu-page\[data-chat-open='true'\] \.game-menu-skull,[\s\S]*\.main-menu-page\[data-chat-open='true'\] \.game-fullscreen-control\s*\{[\s\S]*pointer-events:\s*none/,
  )
})

test('chat suspends retained modal input without destroying state and restores each focus owner', () => {
  for (const scene of [hubScene, boneyardScene]) {
    assert.match(scene, /chatInputActive: boolean/)
    assert.match(scene, /inputSuspended=\{chatInputActive\}/)
  }
  assert.match(inventory, /inputSuspended: boolean/)
  assert.match(inventory, /if \(inputSuspended\) return/)
  assert.match(inventory, /<NativeHubSurface[\s\S]*inputSuspended=\{inputSuspended\}/)
  assert.match(inventory, /className="hub-native-ui-overlay"[\s\S]*inert=\{inputSuspended \|\| undefined\}/)
  assert.doesNotMatch(
    inventory.slice(
      inventory.indexOf('if (!surface) return'),
      inventory.indexOf('const openWorldDialogue'),
    ),
    /inputSuspended[\s\S]*closeSurface\(\)/,
  )

  for (const modal of [skillBook, skillPicker, hudSkillSelector, pauseMenu]) {
    assert.match(modal, /inputSuspended: boolean/)
    assert.match(modal, /inert=\{inputSuspended \|\| undefined\}/)
  }
  assert.match(skillBook, /if \(topMost && !inputSuspended\) rootRef\.current\?\.focus\(\)/)
  assert.match(skillPicker, /if \(revealReady && !inputSuspended\) buttonRefs\.current\[0\]\?\.focus\(\)/)
  assert.match(hudSkillSelector, /if \(!inputSuspended\) rootRef\.current\?\.focus\(\)/)
  assert.match(
    pauseMenu,
    /presentation\.kind === 'owner' && !inputSuspended[\s\S]*firstRowRef\.current\?\.focus\(\)/,
  )
})

test('whisper UX runs from the Player Card into a dedicated chat thread', () => {
  assert.match(component, /data-whisper-target=/)
  assert.match(component, /whisperRequest/)
  assert.match(component, /onWhisperRequestHandled\(\)/)
  assert.match(css, /data-message-channel='whisper'/)
  assert.match(css, /\.game-chat-player-name \{[\s\S]*pointer-events: auto;/)
  assert.match(
    css,
    /data-chat-faded='true'\]\[data-chat-open='false'\] \.game-chat-player-name \{[\s\S]*pointer-events: none;/,
  )
  assert.match(css, /data-channel='whisper'/)
  assert.match(playerCard, /hub-player-profile-message/)
  assert.match(hubScene, /onMessagePlayer\(/)
  assert.match(mainMenu, /whisperRequest=/)
  assert.match(mainMenu, /onWhisperRequestHandled=/)
})

test('Global has an adjacent persisted receive checkbox and Boneyard selection is session-owned', () => {
  assert.match(component, /aria-label="Enable global chat"/)
  assert.match(component, /onGlobalChatEnabledChange/)
  assert.match(component, /data-chat-global-enabled=/)
  assert.match(css, /game-chat-global-toggle/)
  assert.match(component, /worldChanged[\s\S]*defaultGameChatChannel/)
  assert.match(component, /chooseChannel[\s\S]*setChannel/)
})

function partyState(memberPlayerIds: readonly string[]): LocalPartyState {
  return {
    hubPlayers: memberPlayerIds.map((playerId, index) => ({
      accountUsername: null,
      displayName: `Player ${index + 1}`,
      highestWave: null,
      playerId,
      totalPlaytimeMs: null,
    })),
    invitations: [],
    joinRequests: [],
    party: {
      id: 'party-1',
      joinCode: 'TEST-2345',
      leaderPlayerId: memberPlayerIds[0]!,
      listingId: 'listing-1',
      memberPlayerIds,
      visibility: 'private',
    },
    partyRoster: memberPlayerIds.map((playerId, index) => ({
      connected: true,
      currentHealth: 50,
      displayName: `Player ${index + 1}`,
      element: 'ether',
      lifeState: 'alive',
      maximumHealth: 50,
      playerId,
    })),
    revision: 1,
  }
}
