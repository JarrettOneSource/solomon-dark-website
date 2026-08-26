import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { MOBILE_DOCK_HALF_WIDTH, MOBILE_QUICKBAR_SLOT_MIN_SIZE } from './mobile-quickbar-layout.ts'

// Touch-HUD contract for the 2026-08-23 ledger entries (docs/game-native-parity-re.md,
// "Reopened: compact iPhone-landscape touch HUD, second owner report" and "Owner picks
// and the touch ally-roster column") and the 2026-08-24 entry ("Mobile menu pass: dialog
// fit, one stage skull, skull backs out"). Every member that changed behaviour or
// coordinate policy on a coarse pointer is pinned here so a later edit cannot silently
// reopen the system: the menu skull is one stage-level control that backs out of an open
// modal before it opens a menu, the party card collapses to a 22 px chip whose member card
// hangs from it as a tab, the gear is vector art, the ally roster continues the social
// column under the chip and yields while the column is open, no in-stage member adds the
// safe-area inset a second time, every dialog backdrop centres with flex so a percentage
// height resolves against the stage and the body scrolls, the gameplay scenes refuse page
// pinch/pan, and the dock half width tracks the stylesheet (owner pick B).

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const hub = read('./HubScene.tsx')
const boneyard = read('./BoneyardScene.tsx')
const gameHud = read('./GameHud.tsx')
const allyHud = read('./AllyHud.tsx')
const darkCloud = read('./DarkCloudScene.tsx')
const menu = read('./MainMenuScene.tsx')
const skull = read('./GameMenuSkull.tsx')
const navigation = read('./input/gamepad-menu-navigation.ts')
const hubCss = read('./hub.css')
const boneyardCss = read('./boneyard.css')
const chatCss = read('./game-chat.css')
const joystickCss = read('./input/touch-joystick.css')
const partyCss = read('./party-settings.css')
const mainMenuCss = read('./main-menu.css')
const darkCloudCss = read('./dark-cloud.css')
const joinPartyCss = read('./join-party.css')
const playRoutingCss = read('./play-routing-dialog.css')
const runtimeErrorCss = read('./game-runtime-error.css')
const deploymentCss = read('./game-deployment-update.css')
const dialog = read('./PartySettingsDialog.tsx')
const gear = read('./PartySettingsGearIcon.tsx')

function coarseBlock(css: string): string {
  const start = css.indexOf('@media (hover: none) and (pointer: coarse) {')
  assert.ok(start >= 0, 'coarse-pointer block present')
  return css.slice(start)
}

/** Declarations of the first rule whose selector list starts a line with exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const at = css.search(new RegExp(`^\\s*${selector.replace(/[.-]/g, '\\$&')}\\s*(?:,[^{]*)?\\{`, 'm'))
  assert.ok(at >= 0, `${selector} rule present`)
  const open = css.indexOf('{', at)
  return css.slice(open + 1, css.indexOf('}', open))
}

test('one stage skull: back out of the open modal first, else the scene menu behind its own gate', () => {
  assert.match(skull, /if \(activateMenuBack\(root\) !== 'no-modal'\) return\s*if \(menuAvailable\) onOpenMenu\(\)/)
  assert.match(skull, /<button\s+type="button"\s+className="game-menu-skull"\s+aria-label="Menu"/)
  assert.match(skull, /<img src=\{hub\.hud\.skull\} alt="" \/>/)
  assert.match(navigation, /export function activateMenuBack\(root: ParentNode\): MenuBackResult \{\s*const scope = activeNavigationRoot\(root, true\)/)
  // Mounted once on the stage, over every scene with a menu, with that scene's gate.
  assert.match(menu, /<GameMenuSkull\s+availability=\{!darkCloudMenuOpen && settingsContext === null \? 'available' : 'inert'\}\s+frameScale=\{1\}\s+onOpenMenu=\{openDarkCloudMenu\}\s+scene="dark-cloud"\s+stage=\{stageRef\}/)
  assert.match(menu, /<GameMenuSkull\s+availability=\{sceneMenuAvailability\}\s+frameScale=\{gameUiScale\(gameSettings\) \* fixedViewport\.displayScale\}\s+onOpenMenu=\{requestGameplayPause\}\s+scene=\{gameScene === 'boneyard' \? 'boneyard' : 'hub'\}\s+stage=\{stageRef\}/)
  assert.match(hub, /const menuAvailable = !inputBlocked && !modalOpen && !transitionActive/)
  assert.match(
    hub,
    /onMenuAvailabilityChange\?\.\(collegeIntro\s*\? 'hidden'\s*: menuAvailable \? 'available' : 'inert'\)/,
  )
  assert.match(boneyard, /const menuAvailable = !sceneInputBlocked && run\.phase === 'active'/)
  // Stock paints no skull until the tutorial unlocks the combat HUD (nativeTutorialHudAccess
  // `combat`, the gate hub.css applies to the meters); the stage skull follows that gate
  // through the scene instead of a HUD rule, and the HUD's tutorial list no longer names it.
  assert.match(boneyard, /tutorialAccess && !tutorialAccess\.combat\s*\? 'hidden'\s*: menuAvailable \? 'available' : 'inert'/)
  assert.match(skull, /if \(availability === 'hidden'\) return null\s*const menuAvailable = availability === 'available'/)
  assert.match(hubCss, /\.hub-hud\[data-tutorial-combat='false'\] > :is\(\s*\.game-account-name-hud,/)
  assert.equal(menu.match(/onMenuAvailabilityChange=\{setSceneMenuAvailability\}/g)?.length, 2)
  // The Dark Cloud menu keeps Escape consumed but names RESUME as its back owner.
  assert.match(menu, /backAction="resume"[\s\S]*?escapeAction=\{null\}/)
  // No scene paints a skull of its own any more.
  for (const [name, source] of [['GameHud.tsx', gameHud], ['DarkCloudScene.tsx', darkCloud], ['HubScene.tsx', hub], ['BoneyardScene.tsx', boneyard]] as const) {
    assert.doesNotMatch(source, /hub-hud-skull|className="dark-cloud-menu"|onMenuClick|dark-cloud\/skull\.png/, `${name} keeps a scene skull`)
  }
  assert.doesNotMatch(gameHud, /useCoarsePointer/)
  assert.doesNotMatch(hubCss, /hub-hud-skull/)
  assert.doesNotMatch(darkCloudCss, /\.dark-cloud-menu\s*[{,]/)
  // Desktop: the stock HUD placement (11, 7) / 31 px in screen px; touch: 44 at (4, 4), 36 px art.
  assert.match(mainMenuCss, /\.game-menu-skull \{[^}]*z-index: 100002;\s*top: calc\(7px \* var\(--game-menu-skull-scale, 1\)\);\s*left: calc\(11px \* var\(--game-menu-skull-scale, 1\)\);[^}]*width: calc\(31px \* var\(--game-menu-skull-scale, 1\)\);/)
  const coarse = coarseBlock(mainMenuCss)
  assert.match(coarse, /\.game-menu-skull \{\s*top: 4px;\s*left: 4px;\s*width: 44px;\s*height: 44px;\s*\}/)
  assert.match(coarse, /\.game-menu-skull img \{ width: 36px; \}/)
  assert.match(coarse, /\.game-settings-close \{ min-height: 44px; \}/)
  // The screen fade covers the skull (and every other stage overlay) while a screen changes.
  assert.match(ruleBody(mainMenuCss, '.main-menu-screen-fade'), /z-index: 100003;/)
})

test('every dialog backdrop centres with flex and the dialog scrolls inside the stage (dialog fit contract)', () => {
  // A centred grid item resolves a percentage height against its content-sized implicit
  // track, so `height: min(760px, 100%)` overflowed a 366 px stage and DONE fell off it.
  const backdrops = [
    ['main-menu.css', mainMenuCss, '.game-settings-backdrop'],
    ['dark-cloud.css', darkCloudCss, '.dark-cloud-modal-backdrop'],
    ['dark-cloud.css', darkCloudCss, '.dark-cloud-detail-backdrop'],
    ['play-routing-dialog.css', playRoutingCss, '.play-routing-backdrop'],
    ['hub.css', hubCss, '.hub-player-profile-backdrop'],
    ['hub.css', hubCss, '.hub-boneyard-picker-backdrop'],
    ['party-settings.css', partyCss, '.party-settings-backdrop'],
    ['game-runtime-error.css', runtimeErrorCss, '.game-runtime-error'],
    ['game-deployment-update.css', deploymentCss, '.game-deployment-update'],
  ] as const
  for (const [name, css, selector] of backdrops) {
    const body = ruleBody(css, selector)
    assert.match(body, /display: flex;/, `${name} ${selector} centres with flex`)
    assert.doesNotMatch(body, /place-items|display: grid/, `${name} ${selector} must not centre as a grid`)
  }
  // The detail backdrop shares the flex rule and only lifts its z-index over the modal.
  assert.match(darkCloudCss, /\.dark-cloud-detail-backdrop \{ z-index: 2000; \}/)
  // Sizes resolve against the stage (percentage of the backdrop or cq units), never the
  // browser viewport (Safari measures vh without its address bar), and every scrolling
  // body contains its overscroll.
  for (const [name, css] of [
    ['main-menu.css', mainMenuCss],
    ['play-routing-dialog.css', playRoutingCss],
    ['party-settings.css', partyCss],
    ['hub.css', hubCss],
    ['game-runtime-error.css', runtimeErrorCss],
    ['game-deployment-update.css', deploymentCss],
  ] as const) {
    assert.doesNotMatch(css, /\d(d|s|l)?vh\b/, `${name} sizes by the browser viewport`)
  }
  assert.match(ruleBody(mainMenuCss, '.game-settings-dialog'), /height: min\(760px, 100%\);\s*max-height: 100%;/)
  assert.match(ruleBody(mainMenuCss, '.game-settings-content'), /overflow: auto;\s*overscroll-behavior: contain;/)
  assert.match(ruleBody(playRoutingCss, '.play-routing-dialog'), /max-height: 100%;\s*overflow: auto;\s*overscroll-behavior: contain;/)
  assert.match(ruleBody(partyCss, '.party-settings-dialog'), /max-height: 100%;/)
  assert.match(ruleBody(hubCss, '.hub-boneyard-picker'), /overflow: auto;\s*overscroll-behavior: contain;/)
  assert.match(ruleBody(hubCss, '.hub-player-profile-body'), /min-height: 0;\s*overflow: auto;\s*overscroll-behavior: contain;/)
  assert.match(hub, /<div className="hub-player-profile-body">\s*<header className="hub-player-profile-header">/)
  // Touch: the picker and the player card leave the world frame's scale like the party dialog.
  const coarse = coarseBlock(hubCss)
  assert.match(coarse, /\.hub-boneyard-picker \{\s*width: min\(520px, 92cqw\);\s*max-height: 90cqh;[^}]*transform: scale\(calc\(1 \/ var\(--hud-display-scale, 1\)\)\);/)
  assert.match(coarse, /\.hub-boneyard-cancel \{\s*min-height: 44px;/)
  assert.match(coarse, /\.hub-player-profile \{\s*width: 300px;\s*max-height: 90cqh;/)
  for (const [name, css, selector] of [
    ['game-runtime-error.css', runtimeErrorCss, '.game-runtime-error-panel'],
    ['game-deployment-update.css', deploymentCss, '.game-deployment-update-panel'],
  ] as const) {
    assert.match(ruleBody(css, selector), /margin: auto;/, `${name} ${selector} keeps its top reachable when it scrolls`)
  }
})

test('the party card collapses to a chip on touch and the gear is inline vector art', () => {
  assert.match(hub, /const \[partyExpanded, setPartyExpanded\] = useState\(false\)/)
  assert.match(hub, /data-party-expanded=\{!coarsePointer \|\| partyExpanded\}/)
  assert.match(hub, /className="hub-party-toggle"[\s\S]*?aria-expanded=\{partyExpanded\}[\s\S]*?aria-controls="hub-party-members"/)
  assert.match(hub, /className="hub-party-members"\s*id="hub-party-members"\s*role="list"\s*hidden=\{coarsePointer && !partyExpanded\}/)
  assert.match(hubCss, /\.hub-party-members\[hidden\] \{ display: none; \}/)
  assert.doesNotMatch(hub, /⚙/)
  assert.match(hub, /<PartySettingsGearIcon \/>/)
  assert.match(gear, /<svg\s+className="hub-party-settings-gear"\s+viewBox="0 0 24 24"\s+aria-hidden="true"\s+focusable="false"\s*>/)
  assert.match(gear, /fill="currentColor"/)
})

test('no in-stage member adds the safe-area inset the page padding already applies', () => {
  for (const [name, css] of [
    ['hub.css', hubCss],
    ['boneyard.css', boneyardCss],
    ['game-chat.css', chatCss],
    ['touch-joystick.css', joystickCss],
    ['party-settings.css', partyCss],
    ['dark-cloud.css', darkCloudCss],
    ['join-party.css', joinPartyCss],
    ['play-routing-dialog.css', playRoutingCss],
  ] as const) {
    assert.doesNotMatch(css, /env\(safe-area-inset/, `${name} re-applies a safe-area inset`)
  }
  assert.match(mainMenuCss, /\.main-menu-page \{[^}]*padding: env\(safe-area-inset-top\) env\(safe-area-inset-right\)\s*env\(safe-area-inset-bottom\) env\(safe-area-inset-left\);/)
  // The page is the only owner: main-menu.css uses env() for the page padding and the
  // orientation hint's inset alone (four edges each).
  assert.equal(mainMenuCss.match(/env\(safe-area-inset/g)?.length, 8)
})

test('gameplay scenes refuse page pinch and pan on touch while the game surface keeps accessibility zoom', () => {
  assert.match(coarseBlock(hubCss), /\.hub-scene \{ touch-action: none; \}/)
  assert.match(coarseBlock(boneyardCss), /\.boneyard-scene \{ touch-action: none; \}/)
  assert.doesNotMatch(hubCss.slice(0, hubCss.indexOf('@media (hover: none) and (pointer: coarse) {')), /\.hub-scene \{[^}]*touch-action/)
  const surface = read('./game-surface.css')
  assert.match(surface, /\.game-surface \{[^}]*touch-action:\s*manipulation;/)
})

test('the touch dock (owner pick B) and the quickbar half width describe the same dock', () => {
  const coarse = coarseBlock(hubCss)
  assert.match(coarse, /\.hub-hud-potion-button-red \{[^}]*left: calc\(50% - 230px\);/)
  assert.match(coarse, /\.hub-hud-potion-button-blue \{[^}]*left: calc\(50% \+ 130px\);/)
  assert.match(coarse, /\.hub-hud-backpack-button \{[^}]*left: calc\(50% - 130px\);/)
  assert.match(coarse, /\.hub-hud-tome-button \{[^}]*left: 50%;/)
  assert.match(coarse, /\.hub-hud-backpack-button,\s*\.hub-hud-tome-button \{\s*width: 130px;\s*height: 130px;/)
  assert.match(coarse, /\.hub-hud-backpack,\s*\.hub-hud-tome \{[^}]*bottom: 3px;\s*left: 7px;\s*width: 116px;\s*height: 124px;/)
  assert.doesNotMatch(gameHud, /function InventoryCount/)
  assert.match(gameHud, /NativeQuickbarBinding/)
  assert.equal(MOBILE_DOCK_HALF_WIDTH, 230)
  // The slot floor is bounded by the 230 dock at 1600 logical / 125 % (layout test).
  assert.equal(MOBILE_QUICKBAR_SLOT_MIN_SIZE, 52)
})

test('the top-left row keeps the opener beside the skull and the mini chip under it, in stage pixels', () => {
  assert.match(coarseBlock(chatCss), /\.game-chat \{\s*top: 11px;\s*right: auto;\s*bottom: auto;\s*left: 56px;/)
  const coarse = coarseBlock(hubCss)
  assert.match(coarse, /\.hub-party-panel \{\s*top: calc\(54px \/ var\(--hud-display-scale, 1\)\);\s*left: calc\(6px \/ var\(--hud-display-scale, 1\)\);\s*display: grid;\s*gap: 0;/)
  assert.match(coarse, /\.hub-party-toggle \{[^}]*height: 22px;\s*padding: 0 6px;[^}]*border-radius: 11px;[^}]*font: 700 8px Cinzel/)
  assert.match(coarse, /\.hub-party-panel\[data-party-expanded='true'\] \.hub-party-toggle \{\s*border-radius: 3px 3px 0 0;\s*box-shadow: none;\s*\}/)
  assert.match(coarse, /\.hub-party-members \{[^}]*width: 96px;\s*padding: 2px 4px 3px;[^}]*border-radius: 0 3px 3px 3px;/)
  assert.match(coarse, /\.hub-party-member-open \{\s*min-height: 18px;/)
  assert.match(coarse, /\.hub-party-member-name \{ font-size: 9\.5px; \}/)
  // The chevron stays on the chip and the list starts collapsed.
  assert.match(hub, /<span className="hub-party-toggle-chevron" aria-hidden \/>/)
  assert.match(coarse, /\.hub-party-toggle-chevron \{\s*width: 0;/)
})

test('the ally roster continues the social column under the chip and yields while the column is open', () => {
  // Plumbing: HubScene → GameHud → AllyHud → the roster root's `hidden` attribute.
  assert.match(hub, /const partyColumnOpen = partyExpanded\s*\|\| Boolean\(partyActionError\)\s*\|\| \(partyState\?\.invitations\.length \?\? 0\) > 0/)
  assert.match(hub, /allyRosterHidden=\{coarsePointer && partyColumnOpen\}/)
  assert.match(gameHud, /allyRosterHidden\?: boolean/)
  assert.match(gameHud, /<AllyHud\s+additionalRows=\{additionalAllyRows\}\s+hidden=\{allyRosterHidden\}/)
  assert.match(allyHud, /className="hub-hud-allies"\s+data-ally-count=\{rows\.length\}\s+hidden=\{hidden\}/)
  assert.match(allyHud, /<AllyHudRoster hidden=\{hidden\} rows=/)
  assert.doesNotMatch(boneyard, /allyRosterHidden/)
  // Anchors: desktop untouched; Hub (6, 82) under the 22 px chip; Boneyard takes the chip's (6, 54).
  assert.match(hubCss, /\.hub-hud-allies \{\s*position: absolute;\s*top: 60px;\s*left: 11px;\s*display: grid;\s*width: 196px;/)
  assert.match(hubCss, /\.hub-hud-allies\[hidden\] \{ display: none; \}/)
  const coarse = coarseBlock(hubCss)
  assert.match(coarse, /\.hub-hud-allies \{\s*top: calc\(82px \/ var\(--hud-display-scale, 1\) \/ var\(--game-ui-scale, 1\)\);\s*left: calc\(6px \/ var\(--hud-display-scale, 1\) \/ var\(--game-ui-scale, 1\)\);\s*width: 164px;\s*transform: scale\(calc\(0\.72 \/ var\(--hud-display-scale, 1\)\)\);\s*transform-origin: top left;/)
  assert.doesNotMatch(coarse, /\.hub-hud-allies \{[^}]*left: 50%/)
  assert.match(coarseBlock(boneyardCss), /\.boneyard-native-frame \.hub-hud-allies \{\s*top: calc\(54px \/ var\(--hud-display-scale, 1\) \/ var\(--game-ui-scale, 1\)\);\s*\}/)
})

test('party ally rows expose distinct dead and disconnected presentation states', () => {
  assert.match(allyHud, /data-ally-connected=\{row\.connected\}/)
  assert.match(allyHud, /data-ally-dead=\{row\.dead\}/)
  assert.match(allyHud, /allyHudAccessibleStatus\(row\)/)
  assert.match(hubCss, /\.hub-hud-ally-row\[data-ally-dead='true'\] \.hub-hud-ally-bar::after/)
  assert.match(hubCss, /\.hub-hud-ally-row\[data-ally-connected='false'\] \.hub-hud-ally-bar::before/)
  assert.match(hubCss, /@media \(prefers-reduced-motion: reduce\)/)
})

test('the owner pick sheet stylesheet is gone with its imports', () => {
  assert.ok(!existsSync(new URL('./mobile-hud-options.css', import.meta.url)))
  assert.doesNotMatch(hub, /mobile-hud-options/)
  assert.doesNotMatch(boneyard, /mobile-hud-options/)
  assert.doesNotMatch(hubCss, /data-sdr-opt/)
})

test('the party settings dialog is sized by the stage container on touch and keeps its verbs', () => {
  assert.match(coarseBlock(partyCss), /\.party-settings-dialog \{\s*width: min\(520px, 92cqw\);\s*max-height: 90cqh;/)
  assert.match(partyCss, /\.party-settings-body \{[^}]*overflow: auto;/)
  assert.match(dialog, /className="party-settings-segment"[\s\S]*?name="party-visibility"[\s\S]*?<span>\{VISIBILITY_LABELS\[visibility\]\}<\/span>/)
  for (const verb of ['CLOSE', 'COPY', 'REGENERATE', 'ACCEPT', 'DENY', 'KICK', 'LEAVE PARTY', 'LEAVE COLLEGE']) {
    assert.match(dialog, new RegExp(verb), `dialog keeps ${verb}`)
  }
})
