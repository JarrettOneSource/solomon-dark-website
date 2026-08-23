import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { MOBILE_DOCK_HALF_WIDTH, MOBILE_QUICKBAR_SLOT_MIN_SIZE } from './mobile-quickbar-layout.ts'

// Touch-HUD contract for the 2026-08-23 ledger entries (docs/game-native-parity-re.md,
// "Reopened: compact iPhone-landscape touch HUD, second owner report" and "Owner picks
// and the touch ally-roster column"). Every member that changed behaviour or coordinate
// policy on a coarse pointer is pinned here so a later edit cannot silently reopen the
// system: the pause skull is a real gated control, the party card collapses to a 22 px
// chip whose member card hangs from it as a tab, the gear is vector art, the ally roster
// continues the social column under the chip and yields while the column is open, no
// in-stage member adds the safe-area inset a second time, the gameplay scenes refuse
// page pinch/pan, and the dock half width tracks the stylesheet (owner pick B).

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const hub = read('./HubScene.tsx')
const boneyard = read('./BoneyardScene.tsx')
const gameHud = read('./GameHud.tsx')
const allyHud = read('./AllyHud.tsx')
const hubCss = read('./hub.css')
const boneyardCss = read('./boneyard.css')
const chatCss = read('./game-chat.css')
const joystickCss = read('./input/touch-joystick.css')
const partyCss = read('./party-settings.css')
const dialog = read('./PartySettingsDialog.tsx')
const gear = read('./PartySettingsGearIcon.tsx')

function coarseBlock(css: string): string {
  const start = css.indexOf('@media (hover: none) and (pointer: coarse) {')
  assert.ok(start >= 0, 'coarse-pointer block present')
  return css.slice(start)
}

test('the pause skull is a touch-only button behind the same gates as the keyboard edge', () => {
  assert.match(gameHud, /<button[^>]*className="hub-hud-skull-button"[\s\S]*?disabled=\{!onMenuClick \|\| !coarsePointer\}[\s\S]*?onClick=\{onMenuClick\}/)
  assert.match(gameHud, /import \{ useCoarsePointer \} from '\.\/input\/use-coarse-pointer\.ts'/)
  assert.match(hub, /onMenuClick=\{\(\) => \{\s*if \(inputBlocked \|\| modalOpen \|\| transitionActive\) return\s*onPauseRequest\(\)\s*\}\}/)
  assert.match(boneyard, /onMenuClick=\{\(\) => \{\s*if \(sceneInputBlocked \|\| run\.phase !== 'active'\) return\s*onPauseRequest\(\)\s*\}\}/)
  // Desktop keeps the stock paint-only skull at (11, 7) / 31 px.
  assert.match(hubCss, /\.hub-hud-skull-button \{[^}]*top: 7px;[^}]*left: 11px;[^}]*width: 31px;[^}]*pointer-events: none;/)
  const coarse = coarseBlock(hubCss)
  assert.match(coarse, /\.hub-hud-skull-button \{[^}]*width: calc\(44px \/ var\(--hud-display-scale, 1\) \/ var\(--game-ui-scale, 1\)\);[^}]*pointer-events: auto;/)
  assert.match(coarse, /\.hub-hud-skull-button:disabled \{ pointer-events: none; \}/)
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
  for (const [name, css] of [['hub.css', hubCss], ['game-chat.css', chatCss], ['touch-joystick.css', joystickCss], ['party-settings.css', partyCss]] as const) {
    assert.doesNotMatch(css, /env\(safe-area-inset/, `${name} re-applies a safe-area inset`)
  }
  const mainMenu = read('./main-menu.css')
  assert.match(mainMenu, /\.main-menu-page \{[^}]*padding: env\(safe-area-inset-top\) env\(safe-area-inset-right\)\s*env\(safe-area-inset-bottom\) env\(safe-area-inset-left\);/)
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
  assert.match(coarse, /\.hub-hud-count-red \{ left: calc\(50% - 185\.5px\); \}/)
  assert.match(coarse, /\.hub-hud-count-blue \{ left: calc\(50% \+ 175px\); \}/)
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
