# 2026-08-24 — Mobile menu pass: dialog fit, one stage skull, skull backs out

## Reported smell and parity question

- Reported web behavior (owner, iPhone XR, Safari landscape): opening the
  Settings menu cuts off the `DONE` button, and the settings body cannot be
  pulled down with a held finger the way phones scroll. The Hub/Boneyard pause
  skull and the Dark Cloud crest skull differ in size and behavior between
  scenes, and pressing the skull while a menu is already open pops the pause
  (Esc) menu instead of backing out of the open surface.
- Requested behavior: every message box, prompt, and menu fits the phone
  viewport with its confirm/back row on screen and scrolls by touch drag when
  its body overflows; one skull of one size and one behavior over every scene
  that has a menu, especially on touch; pressing the skull while any menu or
  dialog is open backs out of that surface and never raises the pause menu on
  top of it.
- Reproduction membership: the settings dialog on the title, Dark Cloud, Hub,
  and Boneyard (root page and the `TWEAK GAME` page); the play-routing,
  join-party consent, party-settings, Hub player-card, Hub Boneyard-picker,
  Dark Cloud search/detail, runtime-error, and deployment-update dialogs; the
  skull over the Dark Cloud, the Hub, and an active Boneyard run; the title,
  loading, Game Over, and level-up surfaces as non-members.
- Falsifiers: any dialog's confirm/back control lies outside the stage or
  below a 44 px touch row on `896 x 366`; a touch drag over an overflowing
  settings body leaves `scrollTop` at zero; a second safe-area inset is applied
  inside the stage; two skulls of different geometry exist in the tree; the
  skull opens the pause menu while a modal is open; the skull opens a scene
  menu while the scene's own OPEN MENU gate is closed; the skull paints over
  the loading fade; a desktop pointer geometry changes without a ledger row.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing instruction ledger (2026-08-23 touch HUD entry) | HUD painter `FUN_005d2520` (`0x005D2520`); OPEN MENU binding `0x00B3BCCC` with four xrefs (`FUN_0058f320`, `Controls_Render`, `Settings_Render`, `FUN_005cb360`); `GameplayKeyboardEdge_Check(DAT_00b401a8 + 0x750, binding)` | Stock paints the skull only; the menu opens from a keyboard rising edge gated by `DAT_008203f0 == 0 && param_1[0x22] == 0`. No xref reads the binding from a mouse or hit-test path, so a pointer/touch skull is web policy under the platform constraint (no key on touch). | high (instruction-derived) |
| Existing instruction ledger (pause entries) | Pause action `0x0058EA50` rows `RESUME GAME[1]|GAME SETTINGS[0]|LEAVE GAME[2]`; `SimpleMenu::Tick 0x005A8950`; modal exclusion `0x008203F0` | While a modal owns the active region, retail excludes another OPEN MENU edge until Resume/Settings/Leave returns. A skull that never raises a second menu over an open surface is the stock exclusion, not a new rule. | high |
| Existing instruction ledger (Dark Cloud entry) | dispatcher `0x005A5530` slot `+0x10` rows `RESUME[0]|GAME SETTINGS[1]|SIGN OUT[2]|MAIN MENU[3]`; the native owner swallows the second OPEN MENU | The Dark Cloud crest and OPEN MENU raise the same `SimpleMenu`; the second edge is consumed, so the Website keeps `escapeAction={null}` there. | high |
| Existing instruction ledger (Inventory/Pause composition) | retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Pause `0x0058EA50 -> 0x005ABF10 -> 0x005C5A00` | Every stock modal is a fixed `1600 x 900` screen-space composition; retail owns no phone viewport, safe-area, or overflow policy. Dialog fit is a Website adaptation of already-ported surfaces. | high |
| Current Website causal trace | Website `main` `c7902943`; `main-menu.css` `.game-settings-backdrop { display: grid; place-items: center }` with `.game-settings-dialog { height: min(760px, 100%) }` | A centred grid item resolves its percentage height against the content-sized implicit track, so on the `896 x 366` contain-fit stage (`650.7 x 366` CSS px) the dialog took its content height, centred, and the stage's `overflow: hidden` clipped the 74 px `DONE` row. Nothing scrolled because the content row had no overflow owner. | high (reproduced in Mac Chrome at the iPhone XR geometry) |
| Current Website causal trace | `dark-cloud.css` `env(safe-area-inset-*)` inside the stage; `.main-menu-page` padding `env(safe-area-inset-*)` | Two safe-area owners inset the Dark Cloud chrome twice on a notched phone. The page padding is the single owner. | high |
| Current Website causal trace | `GameHud.tsx` `.hub-hud-skull-button` (HUD-scaled, `useCoarsePointer`), `DarkCloudScene.tsx` `.dark-cloud-menu` with `dark-cloud/skull.png` | Two skull controls with different art, geometry, and stacking; neither consults the modal stack, so a press over an open dialog re-requested the pause owner. | high |
| Current Website navigation seam | `gamepad-menu-navigation.ts` `activeNavigationRoot(root, true)` (last visible `[role="dialog"][aria-modal="true"]` / `[data-game-controller-navigation-root="true"]`), `[data-game-back="true"]` owners in every dismissible modal | The controller back convention already names the topmost modal and its back owner; the skull can share it instead of adding a second dismissal policy. | high |
| Mac Chrome journey | `frontend/tools/smoke-mobile-menus.mjs` at `896 x 366` and `896 x 414`, touch emulation, iPhone user agent | Geometry receipts and screenshots for every member at both Safari heights; see the receipt below. | high |
| Rebase base (`origin/main` `21c56bcd`, 52 commits after `c7902943`) | `hub.css` `.hub-hud[data-tutorial-combat='false'] > :is(.hub-hud-skull-button, …) { display: none }` from the stock tutorial port (`nativeTutorialHudAccess`: `combat` unlocks at stage 14 / ≥15); `StockPromptDialog` `Play the Tutorial?` (stock MsgBox on a `.main-menu-native-stage`, `data-game-back` on `NO`) offered on the title while `saveDetection === 'missing'` | The tutorial keeps the stock skull unpainted until the combat HUD unlocks, so removing the HUD skull needs the same gate on the stage skull; a fresh browser profile now meets the tutorial offer before `Play`, and the prompt covers the stage until answered. | high (source) |

No new retail address, table, or asset was recovered; the Mod Loader reports
and the 2026-08-23 touch HUD entry remain the native authority.

## System boundary and membership inventory

Native/web system: the complete stage-level menu surface on a phone — every
dialog's fit and scroll inside the contain-fit `1600 x 900` stage under one
safe-area owner, plus the one pointer skull that stands in for the OPEN MENU
key on touch and owns the stock "no second menu over a modal" exclusion.

| Member | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| settings dialog (title, Dark Cloud, Hub, Boneyard; root and `TWEAK GAME` page) | `GameSettingsDialog`, `.game-settings-*` in `main-menu.css` | `exact-ported` to the dialog-fit contract | backdrop flex-centred; dialog `height: min(760px, 100%)` + `max-height: 100%`, rows `78px minmax(0, 1fr) 74px`; content `overflow: auto; overscroll-behavior: contain`; `DONE`/`BACK` inside the stage and `>= 44` px on touch; touch drag moves `scrollTop` when the body overflows |
| play-routing dialog | `.play-routing-*` | `exact-ported` to the dialog-fit contract | flex backdrop; `max-height: 100%; overflow: auto; overscroll-behavior: contain` |
| join-party consent and party-settings dialogs | `join-party.css`, `party-settings.css` | `exact-ported` to the dialog-fit contract | flex backdrops; `.party-settings-dialog` `max-height: 100%`; no `vh` units |
| Hub player card | `HubScene.tsx` `.hub-player-profile` | `exact-ported` to the dialog-fit contract | flex column; `.hub-player-profile-body { min-height: 0; overflow: auto; overscroll-behavior: contain }` wraps the header and rows so the corner ornaments stay on the frame; touch `width: 300px; max-height: 90cqh`; Close keeps the accepted 30 px 2026-08-23 row |
| Hub Boneyard picker | `HubScene.tsx` `.hub-boneyard-picker` | `exact-ported` to the dialog-fit contract (party-settings recipe on touch) | `overflow: auto; overscroll-behavior: contain`; touch `width: min(520px, 92cqw); max-height: 90cqh`, counter-scaled by `1 / var(--hud-display-scale)`, 44 px Cancel |
| Dark Cloud search modal and detail backdrop | `dark-cloud.css` | `exact-ported` to the dialog-fit contract | one combined flex rule; `.dark-cloud-detail-backdrop { z-index: 2000 }` kept; `.dark-cloud-stone-button` `min-height: 46px`; no `env()` inside the stage |
| runtime-error and deployment-update overlays | `game-runtime-error.css`, `game-deployment-update.css` | `exact-ported` to the dialog-fit contract (fixed overlays) | fixed flex overlay `overflow: auto; overscroll-behavior: contain`; panel `width: min(…, 100%); margin: auto` so a taller-than-viewport panel scrolls instead of clipping its top |
| safe-area ownership | `.main-menu-page` padding | `verified-already-at-requested-policy`; duplicate owner removed | `main-menu.css` holds exactly eight `env(safe-area-inset` uses (page padding + orientation hint); every other game stylesheet holds none |
| one stage skull over Dark Cloud, Hub, and Boneyard | new `GameMenuSkull.tsx`, rendered by `MainMenuScene` after the screen fade | web-policy (platform constraint: no OPEN MENU key on touch), now one owner | one `.game-menu-skull` per stage; desktop `31 x 33` at `(11, 7)` scaled by the frame scale (`gameUiScale * displayScale` in game, `1` in the Dark Cloud); touch `44 x 44` at `(4, 4)` with 36 px art; `z-index: 100002` under the fade `100003`; art `hub.hud.skull` everywhere (`dark-cloud/skull.png` removed) |
| skull press with a modal open | `activateMenuBack(root)` in `gamepad-menu-navigation.ts` | `exact-ported` (stock modal exclusion `0x008203F0`) | presses the `[data-game-back]` owner of `activeNavigationRoot(root, true)`: pause `RESUME`, settings `BACK` then `DONE`, search `DONE`, player card Close, picker Cancel; a modal without a back owner swallows the press (`modal-without-back`); the pause menu is never raised over a modal |
| skull press with nothing open | scene gate `menuAvailable` published by `HubScene` (`!inputBlocked && !modalOpen && !transitionActive`), `BoneyardScene` (`!sceneInputBlocked && run.phase === 'active'`), Dark Cloud (`!darkCloudMenuOpen && settingsContext === null`) | `exact-ported` (keyboard edge gate `DAT_008203f0 == 0 && param_1[0x22] == 0`) | `data-game-menu-available` mirrors the gate; the press calls the same `requestGameplayPause` / `openDarkCloudMenu` owners as the key |
| Dark Cloud pause back owner | `GameplayPauseMenu` `backAction="resume"` with `escapeAction={null}` | `exact-ported` (native owner swallows the second OPEN MENU; back is the `RESUME[0]` row) | skull and controller B resume; a second OPEN MENU key is still consumed |
| Hub/Boneyard settings close | `MainMenuScene` `onClose` | `verified-already-at-parity` (`GAME SETTINGS` handoff, Done releases the pause) | after `DONE` no pause overlay remains; the skull is available again |
| HUD skull, Dark Cloud crest skull, `useCoarsePointer`, `onMenuClick` | `GameHud.tsx`, `DarkCloudScene.tsx`, `hub.css`, `dark-cloud.css` | removed (superseded members) | contract test forbids `hub-hud-skull`, `className="dark-cloud-menu"`, `onMenuClick`, `dark-cloud/skull.png` |
| tutorial skull paint gate | `BoneyardScene` publishes `GameMenuAvailability` (`'hidden'` while `tutorialAccess && !tutorialAccess.combat`, else `'available'`/`'inert'`); `GameMenuSkull` returns `null` for `'hidden'`; `hub.css` tutorial list no longer names a skull | `exact-ported` (stock tutorial paints the skull with the combat HUD, `nativeTutorialHudAccess.combat`) | contract test pins the Boneyard mapping and the `hidden → null` branch; the Hub publishes `'available'`/`'inert'` only |
| title tutorial offer (`Play the Tutorial?`) | `StockPromptDialog` on a `.main-menu-native-stage` (1600 × 900 stage space) | `verified-already-at-parity` (stock MsgBox port; fits by construction inside the contain-fit stage) | every Website smoke that starts from a fresh profile answers `NO` before `Play` (`smoke-mobile-menus`, `smoke-game-settings`, `smoke-mobile-hud-compact`, `smoke-game-runtime`), the same handling as the owner's smokes |
| title screen | title `SimpleMenu` owner | `out-of-system` | no skull is rendered on the title |
| loading fade, Game Over, level-up barrier | `.main-menu-screen-fade`, `GameOverOverlay`, `levelUpBarrier` | `out-of-system` | the fade paints above the skull; the skull unmounts at `game-over`; a modal root without a back owner swallows the press |
| desktop pointer geometry | `.game-menu-skull` fine-pointer rule | explicit deviation from stock paint-only (already recorded 2026-08-23) | `(11, 7, 31 x 33)` unchanged; pointer smokes still find `.game-menu-skull img` |

No member is blocked by the browser platform.

## Ownership thread and recovered/requested contract

- Dialog fit is one contract for the whole backdrop family: a flex-centred
  backdrop that fills its stage, a dialog bounded by `max-height: 100%` with no
  viewport (`vh`) units, its scrolling body owning `overflow: auto` and
  `overscroll-behavior: contain`, and `margin: auto` on fixed overlays so a
  tall panel scrolls from its top. Grid centring is forbidden because it is the
  exact mechanism that let the settings dialog outgrow the stage.
- Safe-area insets have one owner, the page padding; the stage is contain-fit
  inside that padded page, so no in-stage rule may apply `env()` again.
- The skull is a stage-level control, not a HUD member: it sits over the fade
  order of every scene, receives the frame scale so the desktop geometry equals
  the stock painter's `(11, 7)` placement, and takes the touch geometry the
  owner picked on 2026-08-23. Its press has exactly two outcomes: back out of
  the topmost modal through the controller back convention, or open the scene
  menu through the scene's own OPEN MENU gate. It never toggles.
- The scenes publish their gate instead of owning a button, so a fresh scene
  cannot grow a second skull with different rules.

## Confidence and open questions

- Confirmed: stock paint-only skull and keyboard-edge menu; stock second-edge
  exclusion; grid-centring root cause of the clipped `DONE`; duplicate safe-area
  owner; the existing controller back convention; every dialog owner listed.
- Inferred: none used as native fact. Touch geometry (44 px at `(4, 4)`, 36 px
  art), 44 px touch rows, and the 30 px player-card Close are owner picks.
- Unknown: real-device Safari was not driven in this pass; the Mac Chrome
  journeys emulate both Safari heights (`366` with the address bar, `414`
  without) with touch and the iPhone user agent. A device check remains the
  owner's follow-up.

## Web implementation consequence

- `main-menu.css`: settings backdrop flex; dialog `max-height: 100%` with the
  `minmax(0, 1fr)` body row; content scrolls; one `.game-menu-skull` rule pair
  (fine pointer scaled geometry, coarse 44 px) and the fade at `100003`.
- `play-routing-dialog.css`, `join-party.css`, `party-settings.css`,
  `hub.css`, `dark-cloud.css`, `game-runtime-error.css`,
  `game-deployment-update.css`: the same contract; `dark-cloud.css` loses its
  `env()` and `.dark-cloud-menu`; `hub.css` loses the HUD skull and gains the
  player-card body and the touch picker recipe.
- `GameMenuSkull.tsx` (new) rendered twice by `MainMenuScene` (Dark Cloud; Hub
  or Boneyard while a live session exists and the run is not over);
  `HubScene`/`BoneyardScene` publish `onMenuAvailabilityChange`; `GameHud` and
  `DarkCloudScene` lose their buttons; `GameplayPauseMenu` gains `backAction`.
- `gamepad-menu-navigation.ts`: `activateMenuBack(root): 'activated' |
  'modal-without-back' | 'no-modal'` on top of `activeNavigationRoot`.
- Journeys: `tools/smoke-mobile-menus.mjs` (new, `npm run
  smoke:game:mobile-menus`); `smoke-game-runtime.mjs` and
  `smoke-mobile-hud-compact.mjs` locate `.game-menu-skull`.

## Validation contract

- `mobile-hud-touch-contract.test.ts`: the skull owner/gate/back pins, the
  removed members, the desktop and touch skull geometry, the fade order, the
  dialog-fit contract for all nine backdrops (flex, no grid, no `vh`, scroll
  owners, `margin: auto` panels), and the single safe-area owner (eight
  `env()` uses in `main-menu.css`, none elsewhere).
- `gamepad-menu-navigation.test.ts`: `activateMenuBack` presses only the
  topmost modal's back owner and reports `modal-without-back` / `no-modal`.
- `dark-cloud-presentation.test.ts`: no `env()` in the Dark Cloud stylesheet;
  skull pins.
- Mac Chrome `smoke:game:mobile-menus` at `896 x 366` and `896 x 414`: title
  settings fit; Dark Cloud skull → menu → skull resumes → settings `DONE` fits
  and scrolls by drag → skull presses `DONE` → search modal fits → skull presses
  its `DONE`; Hub skull → pause → skull resumes → settings fits/scrolls → skull
  `DONE` → player card fits → skull closes it; Boneyard skull → pause → settings
  → `TWEAK GAME` `BACK` → skull `BACK` → skull `DONE` → resumed; every skull
  receipt is one `44 x 44` button at stage `(4, 4)` with the right scene and
  gate; empty page/console error arrays. Every evidence frame is a settled
  state: finite CSS animations/transitions finished, and every mounted scene
  menu at `data-gameplay-pause-reveal="1"` (its reveal is a JS ramp that
  `document.getAnimations()` cannot see).
- Mac Chrome `smoke:game:mobile-hud` (18 stops), `smoke:game:settings`, and
  `smoke:game` keep passing with the relocated skull (`smoke:game` answers the
  `deployment.json` poll on all three pages like the other smokes do; Vite dev
  serves none); the exact candidate passes `./scripts/validate.sh` on the Mac
  mini.

## Implementation validation receipt

- Branch `claude/mobile-menus-20260824` on base `21c56bcd` (`origin/main`).
  Every candidate below is an exact commit accepted on the Mac mini (Apple
  M2, macOS 26.6.2, Google Chrome 151.0.7922.170, node v22.17.0): shipped as
  a git bundle, fetched by hash, checked out detached with the tree hash
  asserted (`base-is-ancestor: yes` every time). Nothing pushed; nothing
  deployed; landing on `main` is the owner's call.
- r1 (2026-08-24 19:15:54Z–19:24:54Z) on `874549c4` (tree `fe71af47`):
  gates green (lint 0 errors, `test:boneyard` 1763/1763, build + bundle budget
  ok), `smoke:game:mobile-hud` green (18 stops); three journeys red with three
  root causes, none in the product tree. `smoke:game:mobile-menus` timed out
  on `.hub-party-toggle` because the smoke's in-process host used a session
  kind that owns no party system (only `private-college` / `global-hub` do) →
  `sessionKind: 'private-college'`. `smoke:game:settings` failed on two
  console `404`s: the deployment-revision poll (`deployment-revision.ts`, run
  from `Game.tsx` since `9deaf0e7`) asks Vite dev for a `deployment.json` it
  never serves (the manifest is a build-time `generateBundle` artifact) → a
  route stub answering the `current` revision, the convention twenty other
  smokes already use. `smoke:game` asserted the pre-`97e2c9fd` desktop ally
  roster position on its mobile stop (`351.44` vs `5.999`) → the
  coarse-pointer contract (roster at `(6, 82)` in the hub, `(6, 54)` in the
  boneyard, `164 × 0.72 = 118.08` wide). `validate.sh` 1820/1821: the Lua
  host p99 budget (42.488 ms), a perf flake that did not recur. Two orphans
  were found after the phase (a Vite on `:4191`, pid 18977, left by a
  direct-child-only kill; the in-process game host, pid 18963) → the runner
  disposes whole process trees and the post-run hygiene sweep selects by
  `cwd` under the checkout (`lsof -a -p PID -d cwd`), so other people's
  processes on the box are never touched.
- r2 (19:42:48Z–19:51:08Z) on `504acdf4` (tree `ba96a335`): lint `Found 8
  warnings and 0 errors` (the eight pre-existing
  `react(only-export-components)`), `test:boneyard` 1763/1763, build ok
  (`Game-CQ09pnu7.js` gzip 129098 of 131072), `mobile-menus` 366 + 414 green,
  `settings` green, `mobile-hud` green (18 stops), `validate.sh` 2114/2114.
  `smoke:game` red: four console `404`s on the first page — the same
  deployment poll, exposed once the roster fix let the journey reach its
  closing console-error asserts → `743e63b9` stubs the route on all three
  pages.
- r3 (19:56:28Z–19:59:33Z) on `743e63b9` (tree `962387ae`): `mobile-menus`
  366 + 414 green, `smoke:game` green (mobile hub roster at `(6, 82)`, 118.08
  wide; boneyard at `(6, 54)`). Finding: the three open-menu frames
  (`dark-cloud-menu`, `hub-pause`, `boneyard-pause`) were mid-reveal — the
  scene menu ramps `reveal` 0→1 on `requestAnimationFrame` (29 × 10 ms) and
  derives the dim, the panel and the waiting note from it, which
  `document.getAnimations()` cannot see → `6327581f` waits for every mounted
  `data-gameplay-pause-reveal="1"` before each capture.
- r4 (20:07:02Z–20:09:02Z) on `6327581f` (tree `f73a2948`; the product tree
  is `874549c4` plus the `504acdf4` contract test): `mobile-menus` 366 + 414
  green, `errors=[]`, 23 receipts each; `DONE` bottom 348.03 / 394.59 in
  viewports 366 / 414; every settings drag scrolls (207/252/213/188/191 px at
  366, 179/179/243/243/149 at 414); every skull receipt `44 × 44` at `(4, 4)`;
  all seven skull-backs-out expectations hold. Settled proof: within a run
  the four Dark Cloud menu frames (`dark-cloud-menu`, `-open`, `-again`,
  `-exit`) are byte-identical — one hash per height, equal to r3's
  already-settled `-open` frame — and the hub and boneyard pause frames carry
  the full `0.85` dim.
- Hygiene after every chain: 0 processes with `cwd` under the checkout, 0
  leftovers, 0 listeners on `5250/5252/4191/4193` (r2 journeys disposed pids
  28220 28221 28601; r3 smoke disposed 33484). Local on `6327581f`: `npm run
  lint` exit 0 (same eight warnings).
- SHA-256, r2 logs: `lint.log`
  `5ecdd2e03fad763a12688ba96f6f774f5b7dfaf35248f51e4762d72f9704df08`,
  `test.log`
  `9bc5e244fec490ce265e62cc97311bd878a3b765ff9fe9b9d1a0545ba786c974`,
  `build.log`
  `96abbe9cd94589253f635dfad668295e1beed468487c10e212590198161bd0f2`,
  `validate.log`
  `6da8f07e9a822430c5724a87e048647676c4aba7a5fe9427c8d1d6eefe45dc59`,
  `mobile-hud.log`
  `c15ab00032979dc2878cf91b8bd0df219c74e8be2f9ba079f36e29e538742b7d`,
  `mobile-hud/receipt.json`
  `e77fd36ac53892370cfbc3415792d826f4f9513be6e3ff0cea0fb075b464b445`,
  `settings.log`
  `74ba324e712d5fab3fb0138b780668ae60b58c7eaa48d2693cb310e3f006701d`,
  `smoke-game.log` (red)
  `d66d56d53df89f2accf2994812ed0f4d0be6c1f69222b126617e31ec7f4315ac`.
- SHA-256, r3 logs: `mobile-menus-366.log`
  `c3b66c5d4374062f2478747e7311b7c7f7cec14598552ffdff8a058aa6a1a863`,
  `mobile-menus-414.log`
  `7cdb44348702df2f55bc62ada4c70e8564bf69834ad255d84af74ef2078ebaf0`,
  `smoke-game.log`
  `a1c380afbbf8b322b8311ec0540fc937f571651457ae28eeb492962610d5585b`,
  `smoke-game-ally-mobile-hub.png`
  `347d595bd99b86c37c3c8447d8eeb0de8c1ed43848553d4062bd08681dbd6a7e`.
- SHA-256, r4: `mobile-menus-366.log`
  `5c05cdffafbbfb16be66369d74363c17cd7fcca1b7d557b55e96098a6c25063`,
  `mobile-menus-414.log`
  `52b1825390d61318e6e2ca050d06299c45f1f1fcfe3f208f7dbe5fa03b65f332`;
  366: `dark-cloud-menu.png` (all four menu frames)
  `69b3a158888c248068016305b0a849ca73b01c25fa6f4c9d80c7d2729afe0326`,
  `hub-pause.png`
  `2d368597b57e1f6035572d7f88f8ea218427eaf231a8ef79ea98b238e53b750e`,
  `boneyard-pause.png`
  `12c7934d586b109743e6f5e48e6a541417f6c4d8c40ee0d4e7c83ab3fd28705d`,
  `title-settings-after-drag.png`
  `966698a442963ecc5509afd525b8a3d266d81e0e120cf7f7b298d0101f5a9a5a`,
  `dark-cloud-settings-after-drag.png`
  `2ca81f5768d43e110f0b46161cc69edc80983f1f6b8c25de3f5f1315716047f1`,
  `hub-settings-after-drag.png`
  `cc3c763933a6b657c158d3965933543e0ec6e7a2e252af6240883a5f069efe5b`,
  `boneyard-settings-after-drag.png`
  `a017cc00fa098575291295010774b1ace4a0719ccdfd7c65e5f73a53862f882f`,
  `boneyard-settings-performance-after-drag.png`
  `45fadf6b5997f8e9ac9e98d0de61b00d9f0fd4b72ec3cfc0fea3392af191aa53`;
  414: `dark-cloud-menu.png` (all four menu frames)
  `4d4f4896aab3bd88c4b21ab3b9f56dfebfa3c211e2d8d9bf56ac4a19c5eac203`,
  `hub-pause.png`
  `2f3a0c82e9d08d7b6d4a7b914a854551a30aebc80ec4c27c65fc21e09bc790ea`,
  `boneyard-pause.png`
  `df7db0c14746557704633597ae53293d2aa4b1ec00f0e61f1843d0def1ebe74f`,
  `title-settings-after-drag.png`
  `64130cb8cd952bd41b810013dbb4769ef6f81982d51c1d83dd1e9dbf10ef991b`,
  `dark-cloud-settings-after-drag.png`
  `104d1c0db1289e98fc1375686223d770b0dbb86c40c3df218134117bf98eac3e`,
  `hub-settings-after-drag.png`
  `0ed5d0eab9b6e3fea9087d0a55177078cebc946bdd356c714a78158856d02cf4`,
  `boneyard-settings-after-drag.png`
  `8732390009eb4369dada39acd71ca82d87768ed1b3ada2757d1d502106663d52`,
  `boneyard-settings-performance-after-drag.png`
  `bdf67e8102b428ba9515423f3ea8b2c6fb7a9d1337dfa59d469e8ddd1758c327`.
- Follow-up outside this branch: a Vite dev middleware serving
  `deployment.json` would close the `404` class for the 38 smokes that do not
  stub it, instead of one stub per smoke.
