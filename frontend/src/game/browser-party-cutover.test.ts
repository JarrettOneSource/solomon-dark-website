import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gamePage = readFileSync(new URL('../pages/Game.tsx', import.meta.url), 'utf8')
const bootstrap = readFileSync(new URL('./game-bootstrap.ts', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const searchParties = readFileSync(new URL('../pages/SearchParties.tsx', import.meta.url), 'utf8')
const supervisor = readFileSync(
  new URL('./host/game-session-supervisor.ts', import.meta.url),
  'utf8',
)

test('browser game owns one shared-Hub admission path and no lobby compatibility path', () => {
  const browserGameSource = [gamePage, bootstrap, supervisor].join('\n')
  assert.match(bootstrap, /request\('\/api\/game\/hub'/)
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
  assert.doesNotMatch(hubScene, /onMouseDownCapture/)
})
