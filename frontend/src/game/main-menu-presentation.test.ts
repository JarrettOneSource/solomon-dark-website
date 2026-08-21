import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { gameAccountPresentation } from './game-account.ts'

const assetManifest = readFileSync(new URL('../lib/assets.ts', import.meta.url), 'utf8')
const scene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const renderer = readFileSync(
  new URL('./renderer/title-menu-renderer.ts', import.meta.url),
  'utf8',
)
const accountStyles = readFileSync(new URL('./game-account.css', import.meta.url), 'utf8')
const hall = readFileSync(new URL('./HallOfFameScene.tsx', import.meta.url), 'utf8')
const hallStyles = readFileSync(new URL('./hall-of-fame.css', import.meta.url), 'utf8')

test('contains the Solomon Darker artwork inside the native GPU title slot', () => {
  const mainMenuManifest = assetManifest.match(/export const mainMenu = \{([\s\S]*?)\n\}/)
  assert.ok(mainMenuManifest, 'missing main-menu asset manifest')
  assert.match(mainMenuManifest[1], /logo:\s*logoSolomonDark/)
  assert.match(renderer, /containedSprite\(texture\(mainMenu\.logo\), 435\.5, 0, 829, 395, 21\)/)
  assert.match(scene, /aria-label="Solomon Darker game menu"/)
  assert.match(scene, /TitleMenuPresentation/)
})

test('game account presentation names anonymous play explicitly', () => {
  assert.deepEqual(gameAccountPresentation(null), {
    accessibleLabel: 'Not logged in',
    username: 'Not logged in',
  })
})

test('game account presentation preserves the exact Website username', () => {
  assert.deepEqual(gameAccountPresentation('Account-Smoke_7'), {
    accessibleLabel: 'Signed in as Account-Smoke_7',
    username: 'Account-Smoke_7',
  })
})

test('title identity stays at the native left corner while Last Game uses its save path', () => {
  assert.match(scene, /fixedGameStageBounds\(fixedViewport, 'left', 'top'\)/)
  assert.match(accountStyles, /\.game-account-name-title[\s\S]*left:\s*11px/)
  assert.doesNotMatch(accountStyles, /\.game-account-name-title[\s\S]*right:\s*11px/)
  assert.match(scene, /action="last-game" accessibleLabel="Last game"/)
  assert.match(scene, /onClick=\{onLastGame\}/)
})

test('Hall of Fame is actionable and owns local plus four global boards', () => {
  assert.match(scene, /action="hall" accessibleLabel="Hall of Fame" onClick=\{onHall\}/)
  assert.match(scene, /screen === 'hall'/)
  assert.match(hall, /HALL_OF_FAME_BOARDS/)
  assert.match(hall, /scope === 'local'/)
  assert.match(hall, /scope === 'global'/)
  assert.match(hall, /aria-label="Main Menu"/)
  assert.match(hall, /formatHallOfFameTime\(entry\.elapsedTicks\)/)
  assert.match(hall, /hallOfFameClassName\(entry\.element, entry\.discipline\)/)
  assert.match(hallStyles, /top:\s*809\.5px/)
  assert.match(hallStyles, /left:\s*617\.5px/)
  assert.match(hallStyles, /width:\s*365px/)
  assert.match(hallStyles, /height:\s*85px/)
  assert.match(scene, /session\.onLeaderboardReceipt/)
  assert.match(scene, /if \(gameCheatsEnabled\(\)\) return/)
  assert.doesNotMatch(scene, /submitGlobalHallOfFame\(entry\)/)
})
