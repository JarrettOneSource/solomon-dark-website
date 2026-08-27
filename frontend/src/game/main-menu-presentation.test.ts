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
const stockPrompt = readFileSync(new URL('./StockPromptDialog.tsx', import.meta.url), 'utf8')
const stockPromptContract = readFileSync(new URL('./title-menu-prompt.ts', import.meta.url), 'utf8')
const stockPromptStyles = readFileSync(new URL('./stock-prompt-dialog.css', import.meta.url), 'utf8')
const menuStyles = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')
const publicIcons = readFileSync(new URL('../../public/icons.svg', import.meta.url), 'utf8')

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
  assert.match(scene, /canResume=\{resumeSave !== null\}/)
  assert.match(renderer, /playButtonViews\[0\]\.label\.alpha = frame\.canResume \? 1 : 0\.36/)
})

test('New Game uses the stock current-wizard YES or NO decision before Create', () => {
  assert.match(scene, /if \(resumeSave\) \{[\s\S]*setActiveWizardPrompt\(true\)/)
  assert.match(scene, /await onKillWizard\(\)[\s\S]*continueNewGame\(\)/)
  assert.match(scene, /inert=\{titlePrompt !== null \|\| undefined\}/)
  assert.doesNotMatch(scene, /resumePromptWizard|onResume=/)
  assert.match(stockPromptContract, /NATIVE_KILL_CHARACTER_TITLE = 'Kill character\?'/)
  assert.match(stockPromptContract, /Starting a new game will kill off your current game and character/)
  assert.match(stockPromptContract, /Are you sure you want to do this\?/)
  assert.match(stockPromptContract, /primaryLabel: 'YES'/)
  assert.match(stockPromptContract, /secondaryLabel: 'NO'/)
  assert.match(stockPromptContract, /planNativeUiMessage/)
  assert.match(renderer, /title-menu-prompt-stage/)
  assert.match(renderer, /nativeUi\.render\(planTitleMenuPrompt/)
  assert.match(stockPrompt, /aria-modal="true"/)
  assert.match(stockPrompt, /role="dialog"/)
  assert.match(stockPromptStyles, /background:\s*transparent/)
})

test('title prompt curtain owns the full responsive renderer while content stays native-stage anchored', () => {
  assert.match(renderer, /promptCurtain/)
  assert.match(renderer, /promptCurtain\.clear\(\)[\s\S]*\.rect\(0, 0, viewport\.width, viewport\.height\)/)
  assert.match(renderer, /planTitleMenuPrompt\([\s\S]*\}, 0\)/)
  assert.match(renderer, /promptCurtain\.alpha = 0\.75/)
  assert.match(renderer, /promptStage\.position\.set\(centerBounds\.x, centerBounds\.y\)/)
  assert.doesNotMatch(stockPromptStyles, /background:\s*(?:rgba?|hsla?)\(/)
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
  assert.match(scene, /if \(!session\.developerAccess && gameCheatsEnabled\(\)\) return/)
  assert.doesNotMatch(scene, /submitGlobalHallOfFame\(entry\)/)
})

test('Discord is a root-screen corner icon, not a native menu row', () => {
  const rootButtonViews = renderer.match(/const rootButtonViews = \[([\s\S]*?)\n  \]/)
  assert.ok(rootButtonViews, 'missing root title-button collection')
  assert.equal(rootButtonViews[1].match(/createMainButton/g)?.length, 4)
  assert.match(scene, /const DISCORD_INVITE_URL = 'https:\/\/discord\.gg\/HGHxZgyM2p'/)
  assert.match(scene, /screen === 'root' && titlePrompt === null \? \([\s\S]*className="main-menu-discord-link"/)
  assert.match(scene, /aria-label="Join the Solomon Darker Discord server"/)
  assert.match(scene, /href=\{DISCORD_INVITE_URL\}/)
  assert.match(scene, /rel="noreferrer"/)
  assert.match(scene, /target="_blank"/)
  assert.match(scene, /<use href="\/icons\.svg#discord-icon" \/>/)
  assert.doesNotMatch(scene, /action="discord"/)
  assert.doesNotMatch(renderer, /\| 'discord'|createMainButton\(texture, 'discord'/)
  assert.match(
    menuStyles,
    /\.main-menu-discord-link \{[\s\S]*bottom:\s*10px;[\s\S]*left:\s*10px;/,
  )
  assert.doesNotMatch(menuStyles, /data-game-action='discord'|content:\s*'DISCORD'/)
  assert.match(menuStyles, /@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*\.main-menu-discord-link \{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/)
  assert.match(publicIcons, /<symbol id="discord-icon"[\s\S]*<path fill="currentColor"/)
})

test('runtime progression invalidates the Hub scene when Teacher unlock flags change', () => {
  assert.match(
    scene,
    /current\.advancedUnlocks\.every\(\(unlocked, index\) => \([\s\S]*?unlocked === next\.advancedUnlocks\[index\]/,
  )
  assert.match(
    scene,
    /current\.pendingOffer\?\.automaticChoiceIndex === next\.pendingOffer\?\.automaticChoiceIndex/,
  )
})

test('the participant College loadout boundary invalidates the resident Hub shell', () => {
  assert.match(scene, /sameRuntimeScene\(current, snapshot, session\.playerId\)/)
  assert.match(scene, /data-college-loadout-active=\{collegeLoadoutActive \|\| undefined\}/)
  assert.match(
    scene,
    /currentCollegeLoadout[\s\S]*nextCollegeLoadout[\s\S]*return currentCollegeLoadout === nextCollegeLoadout/,
  )
})
