import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const bootstrap = readFileSync(new URL('./game-bootstrap.ts', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const playerCard = readFileSync(new URL('./PlayerCardDialog.tsx', import.meta.url), 'utf8')
const searchParties = readFileSync(new URL('../pages/SearchParties.tsx', import.meta.url), 'utf8')
const supervisor = readFileSync(
  new URL('./host/game-session-supervisor.ts', import.meta.url),
  'utf8',
)
const partySmoke = readFileSync(
  new URL('../../tools/smoke-shared-hub-parties.mjs', import.meta.url),
  'utf8',
)
const privateCollegeSocialSmoke = readFileSync(
  new URL('../../tools/smoke-private-college-social.mjs', import.meta.url),
  'utf8',
)
const luaSmoke = readFileSync(
  new URL('../../tools/smoke-game-lua-console.mjs', import.meta.url),
  'utf8',
)

test('browser game owns one global-Hub endpoint plus in-memory party admission and no lobby compatibility path', () => {
  const browserGameSource = [gamePage, bootstrap, supervisor].join('\n')
  assert.match(bootstrap, /request\('\/api\/game\/hub'/)
  assert.match(bootstrap, /request\('\/api\/game\/join\/admit'/)
  assert.match(bootstrap, /request\('\/api\/game\/rejoin'/)
  assert.match(supervisor, /GAME_HUB_PATH = '\/game-hub'/)
  assert.doesNotMatch(browserGameSource, /game\/lobbies|createGameLobby|joinGameLobby/)
  assert.doesNotMatch(gamePage, /searchParams|get\('party'\)|hostedLobby/)
  assert.doesNotMatch(searchParties, /WebGameLobby|gameLobbies|Web Rebuild Playtest/)
})

test('Hub player interaction shares one pointer path across mouse and touch', () => {
  assert.match(hubScene, /onPointerDownCapture=\{activatePointerTarget\}/)
  assert.match(hubScene, /selectHubPlayerAtPoint/)
  assert.match(playerCard, /data-profile-player=\{player\.id\}/)
  assert.match(playerCard, /data-profile-activity=\{player\.activityKind\}/)
  assert.match(playerCard, /Invite to Party/)
  assert.match(hubScene, /data-party-invitation/)
  assert.match(hubScene, /onAcceptPartyInvitation/)
  assert.match(hubScene, /onDenyPartyInvitation/)
  assert.match(hubScene, />\s*Deny\s*</)
  assert.doesNotMatch(hubScene, /onMouseDownCapture/)
})

test('browser game acceptance tools consume the authoritative protocol identity', () => {
  assert.match(partySmoke, /GAME_PROTOCOL_VERSION/)
  assert.doesNotMatch(partySmoke, /protocolVersion:\s*\d+/)
  assert.match(partySmoke, /type: 'client-hello',[\s\S]*cheatsEnabled: false/)
  assert.match(partySmoke, /onlinePreferences: \{ activityMessages: true, globalChat: true, submitRuns: true \}/)
  assert.match(partySmoke, /cast: \{ primary: false, quickbar: null \}/)
  assert.match(partySmoke, /sendChat\('whisper'/)
  assert.match(partySmoke, /data-whisper-target/)
  assert.match(partySmoke, /chat-hub-whisper\.png/)
  assert.match(partySmoke, /chat-boneyard-global\.png/)
  assert.match(partySmoke, /data-message-activity="searching-solomon"/)
  assert.match(partySmoke, /data-chat-global-enabled/)
  assert.match(partySmoke, /type: 'client-hub-activity'/)
  assert.match(partySmoke, /socialSoundCount\(first\.page, 1\.1\)/)
  assert.match(partySmoke, /socialSoundCount\(first\.page, 1\.25\)/)
  assert.match(partySmoke, /socialSoundCount\(observer\.page, 0\.85\)/)
  assert.match(privateCollegeSocialSmoke, /Invite me from this message/)
  assert.match(privateCollegeSocialSmoke, /Resident Hub reaches both private Colleges/)
  assert.match(privateCollegeSocialSmoke, /Private College whisper before invitation/)
  assert.match(privateCollegeSocialSmoke, /Private College whisper reply/)
  assert.match(privateCollegeSocialSmoke, /Private College invitation/)
  assert.match(privateCollegeSocialSmoke, /CHEATS ENABLED FOR THIS COLLEGE/)
  assert.match(privateCollegeSocialSmoke, /DOWNLOAD & JOIN ONCE/)
  assert.match(privateCollegeSocialSmoke, /data-session-kind/)
  assert.match(privateCollegeSocialSmoke, /data-session-cheats-enabled/)
  assert.match(privateCollegeSocialSmoke, /initialHealth\.privateSessions, 2/)
  assert.match(privateCollegeSocialSmoke, /transferHealth/)
  assert.match(privateCollegeSocialSmoke, /waitForEmptyHealth\(\)/)
  assert.doesNotMatch(partySmoke, /secondary: null/)
  assert.match(luaSmoke, /GAME_PROTOCOL_NAME/)
  assert.doesNotMatch(luaSmoke, /solomon-dark\/\d+/)
})
