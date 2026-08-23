import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const bootstrap = readFileSync(new URL('./game-bootstrap.ts', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const hubStyles = readFileSync(new URL('./hub.css', import.meta.url), 'utf8')
const searchParties = readFileSync(new URL('../pages/SearchParties.tsx', import.meta.url), 'utf8')
const supervisor = readFileSync(
  new URL('./host/game-session-supervisor.ts', import.meta.url),
  'utf8',
)
const partySmoke = readFileSync(
  new URL('../../tools/smoke-shared-hub-parties.mjs', import.meta.url),
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
  assert.match(supervisor, /GAME_HUB_PATH = '\/game-hub'/)
  assert.doesNotMatch(browserGameSource, /game\/lobbies|createGameLobby|joinGameLobby/)
  assert.doesNotMatch(gamePage, /searchParams|get\('party'\)|hostedLobby/)
  assert.doesNotMatch(searchParties, /WebGameLobby|gameLobbies|Web Rebuild Playtest/)
})

test('Hub player interaction shares one pointer path across mouse and touch', () => {
  assert.match(hubScene, /onPointerDownCapture=\{activatePointerTarget\}/)
  assert.match(hubScene, /selectHubPlayerAtPoint/)
  assert.match(hubScene, /data-profile-player=\{selectedPlayerId\}/)
  assert.match(hubScene, /Invite to Party/)
  assert.match(hubScene, /data-party-invitation/)
  assert.match(hubScene, /onAcceptPartyInvitation/)
  assert.match(hubScene, /onDenyPartyInvitation/)
  assert.match(hubScene, />\s*Deny\s*</)
  assert.doesNotMatch(hubScene, /onMouseDownCapture/)
})

test('coarse-pointer Party panel keeps every semantic surface in a compact frame', () => {
  const mobileStyles = hubStyles.slice(hubStyles.indexOf('@media (hover: none) and (pointer: coarse)'))
  assert.match(mobileStyles, /\.hub-party-panel\s*\{[\s\S]*?width:\s*164px;/)
  assert.match(mobileStyles, /\.hub-party-settings-open\s*\{[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;/)
  assert.match(mobileStyles, /\.hub-party-member-open\s*\{[\s\S]*?min-height:\s*28px;/)
  assert.match(hubScene, /className="hub-party-members"/)
  assert.match(hubScene, /data-party-invitation/)
})

test('browser game acceptance tools consume the authoritative protocol identity', () => {
  assert.match(partySmoke, /GAME_PROTOCOL_VERSION/)
  assert.doesNotMatch(partySmoke, /protocolVersion:\s*\d+/)
  assert.match(partySmoke, /type: 'client-hello',[\s\S]*cheatsEnabled: false/)
  assert.match(partySmoke, /cast: \{ primary: false, quickbar: null \}/)
  assert.match(partySmoke, /sendChat\('whisper'/)
  assert.match(partySmoke, /data-whisper-target/)
  assert.match(partySmoke, /chat-hub-whisper\.png/)
  assert.doesNotMatch(partySmoke, /secondary: null/)
  assert.match(luaSmoke, /GAME_PROTOCOL_NAME/)
  assert.doesNotMatch(luaSmoke, /solomon-dark\/\d+/)
})
