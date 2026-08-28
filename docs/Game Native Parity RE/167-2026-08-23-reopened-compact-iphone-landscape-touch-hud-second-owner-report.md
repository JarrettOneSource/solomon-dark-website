# 2026-08-23 — Reopened: compact iPhone-landscape touch HUD, second owner report

## Reported smell and parity question

Second report against the system the `2026-08-22` entry above claimed closed
(owner, 2026-08-23): "make the party card a bit smaller … party card can be
even smaller", "redesign the party settings ui", "fix the settings cog icon",
"make it so if i rotate the screen and back it fixes", "the UI scale on mobile
should be a bit bigger by default for the inventory and skillbook buttons",
"the pause menu skull button should be a bit larger and actually work on
mobile", "make an artifact with several real screenshot options and i will
slowly pick". A secondary report is a process failure, so this entry reopens
the system instead of patching five symptoms.

**Rule the earlier pass skipped — the membership sweep stopped at collision
targets.** The `2026-08-22` inventory dispositioned "top chrome: skull,
diagnostics, meters, … help, fullscreen toggle" as `verified-unchanged; used
only as collision targets`, carried the dock over as `verified-unchanged`
because it matched the `2026-08-21` contract, never asked whether the `⚙`
glyph had a platform constraint, and bounded the orientation lifecycle at the
portrait rotate gate. For a touch HUD the producers are the membership: the
skull is the only on-screen pause affordance a touch player has (the pause
path is keyboard-edge only, below), the gear is the only route to the party
settings, the dock is the only route to inventory/skills, and rotation is a
state transition of the whole layout. Treating them as static geometry is
the same defect as the Boneyard shadow pass that extracted one caster:
members that share the system kept an unexamined path. This pass enumerates
the touch producers and the orientation lifecycle, dispositions each, and
closes the system under owner-picked geometry.

## Evidence

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Static binary (replica wrapper, retail `0.72.5`, image base `0x00400000`) | `refs_to_addr_decompile.py 0x00B3BCCC` (OPEN MENU binding): `4` xrefs — `0x0058F478` in `FUN_0058f320`, `0x005DB40F` in `Controls_Render`, `0x005DA824` in `Settings_Render`, `0x005CB3D4` in `FUN_005cb360` | the two renderers only print the binding; both runtime consumers sample it through `GameplayKeyboardEdge_Check(DAT_00b401a8 + 0x750, binding)` — a keyboard edge. No xref reads the binding from a mouse/hit-test path | high (instruction-derived) |
| Static binary | `FUN_005cb360` (Gameplay tick input branch, contains `0x005CB3D4`) | gated by `DAT_008203f0 == 0 && param_1[0x22] == 0`; edges: Inventory (`param_1[0x6b0] != 0` → `FUN_005c6f10`), Skills (`+0x1ac1` → `FUN_005ca640`), OPEN MENU (`(float)param_1[0x358] > 0` → `FUN_00403730(&stack)` + `FUN_0042dd10`), then the eight belt bindings `DAT_00b3bcd0..0x00b3bcf0` over `param_1 + 0x17b` (stride `0x3b` ints, vtable `+0x10`, sets `+0x7d = 1`). Every branch is a keyboard edge; no cursor compare | high |
| Static binary | `FUN_0058f320` (surface tick with fade `param_1[0x1f] ∈ [0,1]`, mode `param_1[0x21]`) | samples the OPEN MENU edge gated by `(float)param_1[0x270] > 0` → `FUN_00747360` ×2 + `(DAT_0081f630 vtable + 0x130)()`; keyboard edge only | high |
| Static binary | HUD painter `FUN_005d2520` (`0x005D2520`, param = gameplay object) | draw-only: Hub-only block gated by `*(char*)(*(int*)(DAT_0081c264 + 0x1358) + 0x160)`, glyph text via `Glyph_Draw(DAT_008199e4 + 0x2060)` / `Glyph_Draw(DAT_0081997c + 0x1d50)`, map pair `FUN_0050dbf0` / `FUN_00500250` when `DAT_00819a70 != 0`, run branch `LAB_005d3d48 → FUN_004f6070` (a name-string assign helper, `String_Assign(DAT_008199a0 + 0x4d530)` gated by `param_1 + 0x24 > 0`). No mouse global is read anywhere in the painter | high (decompiler interpretation of draw calls; absence of mouse reads is instruction-derived) |
| Conclusion (native) | the three rows above | the stock skull is paint only; the menu opens from the keyboard edge alone. A pointer/touch affordance on the skull has **no native oracle** — it is web policy under the platform constraint "a touch device has no keyboard edge", the same disposition as the Dark Cloud crest button (this ledger, `2026-08-1x` Dark Cloud entry, "crest button = web policy") | high |
| Web owner | `GameHud.tsx:207` `<img className="hub-hud-skull" alt="Menu">`; `HubScene.tsx:288-306` / `BoneyardScene.tsx:401-418` (`keydown` on `settings.controls.openMenu`, gates `inputBlocked \|\| modalOpen \|\| transitionActive` and `sceneInputBlocked \|\| run.phase !== 'active'`) → `onPauseRequest` → `MainMenuScene.requestGameplayPause` | the web port mirrors the native keyboard-only path exactly, so on touch the pause menu is unreachable from the HUD (the `2026-08-1x` account-name note at line `11619` already recorded the skull as inert) | high |
| Web owner | `HubScene.tsx:661-665` `<button className="hub-party-settings-open">⚙</button>`; `hub.css` coarse `16 x 16`, `font-size 9px` | `U+2699` is rendered from whichever platform font claims it: iOS substitutes the Apple emoji gear (colour, baseline-shifted, clipped in a `16`-px box), Chrome on macOS a text glyph — a platform constraint the earlier pass never named. The icon must be vector art owned by the page | high |
| Web owner | `hub.css:1087-1139` (coarse dock `100 x 100` root px, art `58 x 62` / `53 x 50` / `50 x 49` at `bottom 14/9/10`) | at display scale `0.46` the backpack/tome art is `27 x 29` CSS px inside a `46`-px button — the art, not the hit box, is what the owner reads as "too small"; the `2026-08-21` contract fixed the rectangles, not the touch legibility | high |
| Web owner | `hub.css:1130-1230` (party panel `134` px, `10`-px body, gear `16`, rows `20`), `party-settings.css:20-30` (`width: min(520px, calc(100vw - 24px))`, `max-height: calc(100vh - 24px)` inside the `1/displayScale` counter-scale) | owner wants the card "even smaller"; the dialog is a flat list with `vw/vh` lengths inside a scaled frame (they equal screen px only because the counter-scale happens to be exact; Safari's dynamic toolbar makes `100vh` the large viewport, so the sheet can exceed the visible area by the toolbar height) | high |
| Web owner (orientation) | `MainMenuScene.tsx:477-488` (stage `ResizeObserver` → `fixedGameViewportLayout`), `TouchJoystick.tsx:41-52` (radii re-measured per pointer event), `GameChat.tsx:158-165` (`visualViewport` resize), `main-menu.css:769-792` (portrait gate hides the stage), `game-surface.css` (`touch-action: manipulation` on the page, asserted by `game-fullscreen.test.ts:143-153` "without disabling accessibility zoom"), `index.html:7` (scalable viewport) | no member caches a mount-time measurement; every layout input re-derives on resize. The one lifecycle the page does not own is Safari's visual viewport: `manipulation` still allows two-finger pinch, and twin-stick play puts two thumbs down with only the joysticks/slots/book declaring `touch-action: none`. A pinch (or a keyboard-driven scroll offset) leaves the layout viewport zoomed/offset until a rotation re-fits it — exactly "rotate and back fixes it" | medium (mechanism inferred; no iOS device in the loop) |

## Membership inventory (reopened)

| Member | Native/current source | Disposition | Proof |
| --- | --- | --- | --- |
| pause skull (Hub + Boneyard run) | native paint-only (`FUN_005d2520`), keyboard edge `FUN_005cb360` / `FUN_0058f320`; web `GameHud.tsx` | web-policy (platform constraint: no keyboard edge on touch): `<button class="hub-hud-skull-button">` wrapping the stock art, `onMenuClick` routed through the SAME gated `onPauseRequest` path as the keydown handler in both scenes; on coarse pointers `≥ 44` CSS px hit box, art enlarged per the owner's pick; desktop geometry `(11, 7, 31 x 33)` unchanged | journey: tap → `.gameplay-pause-overlay` visible, `RESUME` tap closes it, in Hub and Boneyard; desktop smoke geometry unchanged |
| party settings gear | `HubScene.tsx:661-665` | web-policy with named platform constraint (glyph fallback fonts): inline SVG gear, `currentColor`, `≥ 40` px hit halo retained | journey: `.hub-party-settings-open svg` present, no text node; tap opens the dialog |
| dock: backpack + tome (touch default) | `hub.css` coarse dock | web-policy: larger touch default — pinned after the owner picks among options (art `x1.5` in the `100`-px rectangles / `120`-px rectangles with `x1.75` art and re-spaced centres / whole dock `x1.3`); `mobile-quickbar-layout.ts` `MOBILE_DOCK_HALF_WIDTH` follows the pick so the banks keep clearing the dock | contract test + journey dock rectangles + overlap-free band |
| dock: potions, counts, XP | same | verified-unchanged unless the picked option scales the whole dock (then re-pinned with the same proof) | journey |
| party card | `hub.css` coarse party rules | web-policy compact-2: options small card `110` / mini `96` / chip (collapsed pill: gold skull + count + gear, `≤ 84 x 30` CSS px, expands on tap to the member list); recommended chip. Invitations render as their own toast under the card in every option | journey envelopes per picked option; invitation accept through the toast |
| party settings dialog | `PartySettingsDialog.tsx`, `party-settings.css` | web-policy redesign: one semantic structure (header/close, visibility, Party ID, requests, members, leave) with two skins for the pick — "ledger" (Dark Cloud leather, gold filigree corners, inset rows) and "card" (Player Card double gold border); sized from the stage container (`cqw/cqh`), never `vw/vh` inside the scaled frame | journey: `≥ 300` px wide at screen scale, inside the viewport at `896 x 414` and `896 x 366`, close works |
| top-left cluster (skull, chat opener, party card, diagnostics, account name) | `hub.css`, `game-chat.css:396-476`, `game-account.css` | web-policy re-layout because the larger skull no longer fits above the `(8, 30)` opener: options "stack" (skull / opener / card) and "row" (skull + opener side by side, card beneath); diagnostics sit right of the cluster | journey: pairwise overlap-free, all inside the viewport at both heights |
| orientation lifecycle | `MainMenuScene` stage observer, portrait gate | web-policy contract: portrait → landscape and landscape → portrait → landscape must reproduce the fresh-landscape geometry exactly (every member rectangle within `0.75` px) | journey round-trip stops compared member-by-member to `hub-solo` |
| pinch/pan during gameplay | `game-surface.css` (page stays `manipulation` for menu accessibility zoom) | web-policy: `.hub-scene` / `.boneyard-scene` declare `touch-action: none` under `(hover: none) and (pointer: coarse)` — the gameplay stage is a direct-manipulation surface like the joysticks already are; menus keep accessibility zoom. **Explicit unknown / predicted difference:** no iOS device is in the loop and Chrome emulation cannot reproduce Safari's visual-viewport zoom/offset, so the "rotate and back" symptom is closed by mechanism, not by device capture. If the owner still sees it, the next evidence is `visualViewport.scale` / `offsetTop` read on the device | CSS contract test; emulated round trips |
| pause menu on touch (`GameplayPauseMenu`) | existing | verified-already-at-parity: native `SimpleMenu` rows already fit the fixed frame; the journey proves reachability from the skull and `RESUME` | journey |
| desktop fine pointer | base rules | verified-unchanged (every new rule sits under the coarse gate; the skull button keeps the stock anchor) | `game-fullscreen.test.ts`, desktop smokes |
| Boneyard picker, fullscreen toggle, help, meters, loadout, map control | — | out-of-system (untouched; collision targets only) | overlap-free band |

## Validation contract

- Ledger before code (this section); options built as real CSS variants
  switched by `html[data-sdr-hud-*]` attributes from a throwaway
  `mobile-hud-options.css` so every screenshot is the production bundle at
  `896 x 414` (and `896 x 366` where the cluster height matters); the
  attribute switch and the losing variants are deleted once the owner picks.
- `frontend/tools/smoke-mobile-hud-compact.mjs` gains: skull tap → pause →
  `RESUME` in Hub and Boneyard; SVG gear; portrait → landscape and landscape →
  portrait → landscape round trips compared to the fresh landscape geometry;
  per-option captures (cluster, dock, dialog, pause) with cropped evidence.
- Full gate `scripts/validate.sh` on the Mac mini against the exact tree, the
  journey against the production bundle served by the Debug backend + session
  supervisor, errors arrays empty; receipt per run.
- Push/deploy remain the owner's call; the options Artifact is the decision
  surface.

### Addendum 2026-08-23 — safe areas are applied twice inside the stage

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Web owner | `main-menu.css:1-22` (`.main-menu-page { position: fixed; inset: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left) }`, `.main-menu-stage { width: 100%; height: 100% }`) | the stage is already inset by the safe areas; every gameplay member is positioned inside the stage | high |
| Web owner | `touch-joystick.css` (`left/right: calc(48px * u + env(safe-area-inset-left/right) / s)`), `hub.css` coarse quickbar banks (`+ env(safe-area-inset-left/right) / s / u`), party panel (`top: (env(top) + 66px) / s`, `left: (8px + env(left)) / s`), `game-chat.css:396-400` (`top: env(top) + 30px; left: 8px + env(left)`) | each adds the inset a second time. Chrome emulation reports `0` insets, so every earlier receipt was blind to it; on an iPhone XR in landscape (`44` px left/right, `21` px bottom) the joysticks, banks, chat opener and party card all sit `44` px further inboard than designed, the bottom band `21` px higher | high (static; the emulation cannot observe it) |

Disposition: `exact-ported` policy correction across the whole membership — only the page padding owns the safe areas; no in-stage member adds `env()` again. The contract test asserts the absence for joysticks, banks, party card, chat opener and skull. The `2026-08-22` "safe areas" row ("joysticks, banks, and the chat opener add `env(safe-area-inset-left/right)`") is superseded by this addendum.

## Web implementation consequence (2026-08-23 pass)

Every rule below sits under `(hover: none) and (pointer: coarse)`; the desktop
HUD keeps the stock anchors untouched. Root px = screen px / `s` / `u`
(`s = --hud-display-scale`, `u = --game-ui-scale`); measurements quote
screen px at `896 x 414`, `u = 1`, `s = 0.46`.

| Member | Rule now in the tree | Disposition |
| --- | --- | --- |
| pause skull | `GameHud.tsx` renders `.hub-hud-skull-button` (44 px box at `(4, 4)`, 36 px skull art) whose `onMenuClick` goes through the scene gate to `onPauseRequest()`; `GameplayPauseMenu` opens with `RESUME / GAME SETTINGS / LEAVE GAME`. Stock `FUN_005d2520` paints the skull only and the menu opens from the OPEN MENU binding `0x00B3BCCC` — a touch surface has no key, so the button is web policy, not a ported native control | blocked-by-platform (named: no key binding on touch) — predicted visible difference: the skull is a button on phones, paint-only on desktop |
| party settings gear | `PartySettingsGearIcon` inline SVG (`viewBox 0 0 24 24`, 15 px desktop / 12 px coarse) replaces the emoji glyph whose shape and vertical metrics came from the platform emoji font (the "broken cog" report) | exact-ported policy (the native game has no party UI; the gear is web-only chrome) |
| party card | chip: `.hub-party-toggle` (`PARTY n ▾`, 26 px tall) with the member list `hidden` until tapped; expanded column 110 px wide. Measured `124.3 x 26` collapsed, `124.3 x 79` expanded with two members | out-of-system (web-only) — owner pick between chip / small / mini on the Artifact |
| party settings dialog | rebuilt as a screen-scale modal: visibility segmented control, Party ID with `COPY` / `REGENERATE`, join requests, members, `LEAVE`; two skins (ledger / card). Measured `520 x 209` at `896 x 414`; at `896 x 366` it lands at `(188, 78.5)` and fits | out-of-system (web-only) — owner pick |
| top-left cluster | row: skull `(4, 4)` 44 → chat opener `(56, 11)` 30 → FPS readout; party chip `(6, 54)`. Alternative `stack` (opener under the skull at `(11, 54)`, chip under the opener) captured for the pick | web policy — owner pick |
| dock | backpack / tome buttons 120 root px (55.2 screen px at `x = 390.5 / 450.3`), potions 100 root px (46 screen px at `x = 344.5 / 505.5`); `MOBILE_DOCK_HALF_WIDTH = 225` (was 215). Options B (130) / C (110) keep the potions at 100 | web policy — owner pick |
| quickbar banks | `mobileQuickbarBankLayout(width, u)` — full 100 px slots at the preferred inset 310 when they fit inside `rootHalfWidth - 225 - 16`; otherwise the thumb gap yields down to `MOBILE_QUICKBAR_BANK_MIN_INSET = 293.5` (`48 + 237.5 + 8`) before the slots shrink toward the 56 px floor. Worked cases: XR `u ≤ 1.25` → `{310, 100}`; 1500 logical `u = 1` → `{301, 100}`; XR `u = 1.5` and 1600 `u = 1.25` → `{293.5, 56}` (bank edge 413.5 ≤ dock edge 424.3 / 415); 1600 `u = 1` → `{310, 100}` | exact-ported policy correction (see nearby finding) |
| safe areas | page padding is the only owner (addendum above); contract test asserts no in-stage `env()` | exact-ported policy correction |
| rotation | all coarse geometry derives from the stage box and `s`; the journey rotates `896 x 414 → 414 x 896 → 896 x 414` and demands every member's anchor and box within 0.75 px of the fresh landscape capture. The FPS readout is left-anchored with an intrinsic text width (`"9 FPS"` vs `"58 FPS"` under load), so only its anchor and height are part of the contract | exact-ported (web contract) |
| gameplay pinch/pan | `.hub-scene` / `.boneyard-scene` `touch-action: none` under the coarse gate; `.game-surface` keeps `manipulation` for menu accessibility zoom | web policy; real-iOS visual-viewport behaviour remains an explicit unknown (no device in the loop) |
| option sweep | throwaway `mobile-hud-options.css` switched by `html[data-sdr-opt-{skull,cluster,dock,party,dialog}]`, set only by the capture journey; skull A 44/36 (default) · B 56/46 · C 36/30; dock A 120 · B 130 · C 110; party chip · small (110 always-open) · mini (96 always-open); cluster row · stack; dialog ledger · card | deleted with its two imports once the owner picks |

Nearby finding (closed in the same pass): widening the dock half width from
215 to 225 for the larger backpack / tome let the 56 px bank floor cross the
dock at XR `u = 1.5` and 1600 `u = 1.25` — caught by the existing
`'shrunk bank overlaps the dock'` contract on the Mac (r1). Loosening the floor
or the test would have shipped the overlap on every wide-dock variant, so the
bank inset now yields first (`mobileQuickbarBankLayout`), and the contract
tests enumerate the yield / shrink boundaries.

Nearby finding (Tailwind owns `[hidden]`): the r1 sweep captured the
always-open party variants as an empty chip because their
`html[data-sdr-opt-party=…] .hub-party-members[hidden] { display: grid }` rule
never applied. The r4 receipt shows computed `display: none` with the option
rule present and matching; the production `index-*.css` carries Tailwind v4's
preflight `[hidden]:where(:not([hidden=until-found])) { display: none !important }`
inside `@layer base`, and an `!important` declaration beats every normal
author `display` regardless of layer or specificity. Consequence: the `hidden`
attribute is the single collapse mechanism for the party list; an always-open
variant is implemented by not setting `hidden` in `HubScene.tsx`, never by a
stylesheet. The sweep now opens the list through the toggle before capturing
`small` / `mini`, and the refuted rule is gone. Confidence: high (static rule
in the built bundle + computed-style receipt).

## Implementation validation receipt (2026-08-23 pass)

Candidate tree: `87f86254` (= `origin/main`) + 19 uncommitted files, transferred
to the Mac clone `/Users/jarrett/codex-acceptance/mobile-hud-iter-20260823/website`
with byte-identical sha256 manifests; every run = production build → session
supervisor + Debug backend → `smoke-mobile-hud-compact.mjs` (Chrome, `896 x 414`
DPR 2, `hasTouch` / `isMobile`) → `scripts/validate.sh`; task-owned PIDs
disposed after each run (`leftovers=0`).

| Run (EDT) | Build | Journey | `validate.sh` | Disposition |
| --- | --- | --- | --- | --- |
| r1 10:27 | 0 | 31 stops, errors `[]` | 1382 / 1387 | gear regex too strict for multi-line JSX; `'shrunk bank overlaps the dock'` caught the 225 dock vs 56 floor overlap (nearby finding above); joystick / quickbar CSS tests still expected in-stage `env()`; `game host drops … transport heartbeat` `1006 !== 4000` |
| r2 10:42 | 0 | fail at `hub-solo-rotated-back`: `diagnostics[0].width 75.85 -> 69.73` | 1388 / 1388 (exit 0) | the FPS readout's width is intrinsic text; contract now excludes only that dimension |
| r3 10:47 | 0 | fail: `CONTENT_SIZED` TDZ (declared below the top-level flow) | 1387 / 1388 | `shared Hub admissions are single-use …` 10 s wait timed out (`game-session-supervisor.test.ts:476`) |
| r4 10:50 | 0 | 31 stops, errors `[]` | 1388 / 1388 (exit 0) | party `small` / `mini` captured collapsed (preflight finding above) |
| r5 10:57 | 0 | 31 stops, errors `[]` | 1388 / 1388, every suite 0 failures (exit 0) | final evidence set `evidence/r5` (34 files) |

Host-test flakes (r1, r3): two different wall-clock-bounded tests in
`src/game/host/*.test.ts`, no host file in the diff, both passing in r2 / r4 /
r5 and in an isolated run of all ten host test files on the same tree
(`99 / 99`, `logs/r4/host-tests-isolated.log`) while the Mac carried load
12–16 from other tasks' rollouts. Disposition: pre-existing load sensitivity,
not this tree.

Measured geometry, r5, screen px at `896 x 414` (`u = 1`, `s = 0.46`):
skull button `(4, 4)` `44 x 44`; chat opener `(56, 11)` `30 x 30`; party chip
`(6, 54)` `124.3 x 26`, tapped open `124.3 x 79` with two rows; always-open
`small` `113.3 x 71`, `mini` `108.3 x 65`; dock backpack / tome `55.2` at
`x = 390.5 / 450.3`, potions `46` at `x = 344.5 / 505.5`; settings dialog
`520 x 209`, at `896 x 366` anchored `(188, 78.5)` inside the viewport;
orientation round trip `896 x 414 → 414 x 896 → 896 x 414` reproduces every
member within 0.75 px (readout width excluded by contract); skull tap → pause
overlay → `RESUME` proven in Hub and Boneyard.

Explicit unknowns (platform): no iOS device or Playwright WebKit is in the
loop, so real Safari safe-area insets, the visual-viewport zoom/offset after a
rotation, and the `896 x 366` address-bar state are verified by mechanism and
emulated viewport only. Commit, push, deploy: none — the owner picks from the
Artifact first; production still serves `3e2aa260`.

## Owner picks and the touch ally-roster column (2026-08-23, round 4)

Owner message from the pick sheet: `skull=A cluster=row dock=B party=chip
dialog=ledger`, plus "make it so the ally health bars are under the party card
and when the party card is expanded we hide the ally health bars. Also I like
the smaller party card with mini but also having the collapse chevron and
collapsed by default." The picks pin the option sweep; the second sentence
reopens one member of the touch HUD (the ally roster) whose 2026-08-22 rule
("centred under the player's own meters at 72 %; the left column belongs to
chat + party") is superseded below. The option stylesheet, its two imports, and
the capture sweep are deleted in this pass; the Artifact is rebuilt from the
pinned stops.

| Pick | Pinned rule | Consequence |
| --- | --- | --- |
| skull A | 44 px button at `(4, 4)`, 36 px art — unchanged | none |
| cluster row | skull → chat opener `(56, 11)` → FPS readout; chip `(6, 54)` — unchanged | none |
| dock B | backpack / tome hit boxes 130 root px with the 58 x 62 stock art at 2x (`116 x 124` at `bottom 3 / left 7`); order from the centre red potion `-230..-130`, backpack `-130..0`, tome `0..130`, blue potion `130..230`; counts at `-185.5` / `+175` (same `+44.5` / `+45` offsets from their bottles as dock A). XR screen px: buttons `59.8` at `x = 388.2 / 448`, potions `46` at `x = 342.2 / 507.8` | `MOBILE_DOCK_HALF_WIDTH = 230`; see the bank finding below |
| party chip | the `mini` dimensions on the collapsing chip: toggle 22 px tall, `8px` Cinzel, `0 6px` padding, 11 px pill radius; member card 96 px wide, `2px 4px 3px` padding, 18 px rows, `9.5px` names; collapsed by default (`partyExpanded = false`), chevron kept; expanded, the chip squares its bottom corners into a tab (`3px 3px 0 0`, ring/drop shadow off) and the card hangs from it (`0 3px 3px 3px`, panel gap 0). The invitation toast and the action error keep their own 4 px / 3 px gaps under the chip | ally roster anchor moves to `54 + 22 + 6 = 82` |
| dialog ledger | gold ledger skin — unchanged; the `card` skin rules die with the option stylesheet | none |

Nearby finding (dock B vs the bank floor): with the dock half width at 230 the
56 px slot floor crosses the dock at the narrowest supported case, 1600 logical
px at `u = 1.25` (root half width 640, dock edge 410, bank edge
`293.5 + 2 * 56 + 8 = 413.5`). The `'bank overlaps the dock'` contract would have
caught it on the Mac; it is not loosened. The floor becomes
`MOBILE_QUICKBAR_SLOT_MIN_SIZE = 52` (bank edge 405.5: 4.5 px margin at
1600 / 1.25, 13.8 px at XR / 1.5), i.e. the 16 px dock gap is the yield budget
at the floor. Worked cases: XR `u ≤ 1.25` → `{310, 100}`; 1600 `u = 1` →
`{310, 100}`; 1500 `u = 1` → `{296, 100}`; XR `u = 1.5` and 1600 `u = 1.25` →
`{293.5, 52}`. Confidence: high (arithmetic on the contract; the layout test
enumerates every case).

### System boundary: the web ally HUD roster on a coarse pointer

Owner: `AllyHud.tsx` (`AllyHudRoster` → `.hub-hud-allies[data-ally-count]` with
one `.hub-hud-ally-row` per ally), rows from `ally-hud.ts`
(`derivePlayerAllyHudRows` = party members present in the same world,
`deriveGolemAllyHudRows` = the player's golem secondaries, plus the scene's
`additionalAllyRows`), mounted by `GameHud.tsx` in both gameplay scenes. The
desktop anchor (`top: 60px; left: 11px; width: 196px`, the stock-derived rule
from the ally HUD entry) is untouched; everything below sits under
`(hover: none) and (pointer: coarse)` and is web policy — the stock game has no
touch layout.

| Member | Rule | Disposition |
| --- | --- | --- |
| Hub roster | anchor `(6, 82)` screen px (chip 54 + 22 px pill + 6 px gap, the same 6 px that separates skull and chip), `164` root px wide at `scale(0.72 / s)` so the rows read `118 px` — the width of the chip-and-gear row; `hidden` while the party column is open below the chip | exact-ported policy |
| "party column open" | `partyColumnOpen = partyExpanded \|\| Boolean(partyActionError) \|\| invitations.length > 0` in `HubScene.tsx`; `allyRosterHidden = coarsePointer && partyColumnOpen` flows `GameHud → AllyHud → AllyHudRoster` as the `hidden` attribute (Tailwind's preflight owns `[hidden]`, see the 2026-08-23 finding; an intent rule `.hub-hud-allies[hidden] { display: none; }` sits beside the grid rule). All three states extend the column under the chip, so all three yield the roster — a toast or an error would otherwise paint over the bars | exact-ported policy |
| Boneyard roster | no party chip in a run, so the roster takes the chip's anchor `(6, 54)` (`boneyard.css` coarse `.boneyard-native-frame .hub-hud-allies`); size and scale from the shared rule; never hidden (no party column) | exact-ported policy |
| empty roster (0 rows) | container stays mounted with `data-ally-count="0"` and no box; the `hidden` attribute still tracks the column so the journey can read the contract in the solo state | verified-already-at-parity |
| desktop roster | unchanged stock-derived anchor; `hidden` is never set without a coarse pointer | verified-already-at-parity |
| UI scale `u` | anchor is screen-fixed (`/ s / u`) like the skull; the rows grow with `u` like every HUD-root member (`0.72 / s`). At `u = 1.5` three rows end at `~200` px, above the joystick top (`279` px) | exact-ported policy |
| player's own meters | unchanged top-centre | out-of-system |

Validation contract for the journey: `hub-solo` roster not hidden, 0 rows;
`hub-invitation` roster hidden (toast open), 0 rows; `hub-party` roster at
`(6, 82)`, 1 row `≤ 120 x 25`, disjoint from skull / opener / chip / meters /
joystick; `hub-party-expanded` roster hidden, 0 visible rows, member card 96 px
hanging from the 22 px tab; `run-idle` / `run-released` roster at `(6, 54)`,
1 row. The contract test pins the plumbing, the anchors, dock B, `230` / `52`,
the tab rule, and the absence of `mobile-hud-options.css`.

### Implementation validation receipt (round 4)

Same candidate tree (`87f86254` + 19 uncommitted files, `mobile-hud-options.css`
deleted on both machines) and the same Mac runner; sha256 manifests
byte-identical before each run. The option sweep is gone, so the journey is 18
stops (31 − 13 option captures).

| Run (EDT) | Build | Journey | `validate.sh` | Disposition |
| --- | --- | --- | --- | --- |
| r6 12:59 | 2: `GameHud.tsx(229,17)` `Cannot find name 'allyRosterHidden'` | — | — | the prop was declared and passed but not destructured; one-line fix, re-shipped sha-identical |
| r7 13:02 | 0 | 18 stops, errors `[]` | 1861 / 1861 across 12 TAP suites, 0 failures (exit 0) | final evidence set `evidence/r7` (19 files), `leftovers=0` |

Counting basis: every `# tests` / `# pass` / `# fail` line in `validate.log`.
On that basis r5 was `1859 / 1859`; the r5 row's `1388` above counted a subset.
The +2 are the new contract tests (ally column plumbing / anchors, pick-sheet
stylesheet gone).

Measured geometry, r7, screen px at `896 x 414` (`u = 1`, `s = 0.46`), all
within 0.75 px of the contract:

| Stop | Chip / column | Ally roster | Notes |
| --- | --- | --- | --- |
| `hub-solo` | pill `(6, 54)` `93.3 x 22`, gear `22 x 22` at `x = 103.3`, row `119.3` wide | `(6, 82)` `118.1 x 0`, not hidden, 0 rows | empty roster keeps its anchor; the contract is readable from the attribute |
| `hub-invitation` | column `150 x 81` (toast `150 x 55` at `y = 80`) | `hidden` | toast extends the column → roster yields |
| `hub-party` | pill / gear as solo | `(6, 82)` `118.1 x 24.5`, 1 row | the bar is 1.2 px narrower than the chip-and-gear row |
| `hub-party-expanded` | column `119.3 x 65`: tab `22` + member card `96 x 43` at `y = 76`, two `86 x 18` rows | `hidden`, 0 visible rows | card hangs from the squared pill (`border-radius: 3px 3px 0 0`) |
| `run-idle` / `run-released` | — (no chip in a run) | `(6, 54)` `118.1 x 24.5`, 1 row (Basil) | Boneyard anchor from `boneyard.css` |
| dock (every stop) | backpack / tome `59.8` at `x = 388.2 / 448`, potions `46` at `x = 342.2 / 507.8`, counts at `x = 362.7 / 528.5` | — | owner pick B, exactly the predicted values |
| settings dialog | `520 x 209` at `(188, 102.5)`; at `896 x 366` `(188, 78.5)` | — | ledger skin, unchanged |

Evidence: `/Users/jarrett/codex-acceptance/mobile-hud-iter-20260823/evidence/r7`
(`receipt.json` + 18 screenshots, reviewed: `hub-party`, `hub-party-expanded`,
`hub-invitation`, `run-idle`, dock crop), logs under `logs/r7/`. The Artifact
"Solomon Dark Touch HUD Picks" was republished from the same file with the
pinned result and the r7 captures. The owner authorized the push at 13:35 EDT;
the commit carrying this entry is the round-3/4 tree rebased onto `e75cdb1d`
(`main` moved while the picks were under review — only this ledger overlapped),
and the r8 re-validation receipt follows in its own entry. Deploy: none;
production served `3e2aa260` at the time of writing.

### Publication receipt (round 4, 2026-08-23 13:35–13:50 EDT)

`origin/main` had moved to `e75cdb1d` (the Category-2 cooldown / Golem mana
entry above) while the picks were under review. The round-3/4 tree was
committed as `f9bc9b4c` on `87f86254`, rebased onto `e75cdb1d` as `97e2c9fd`
(the only conflict was this ledger — both entries appended, upstream's kept
first), and re-validated on the Mac from a clean detached checkout of that
exact commit (tree `f1a051a7…` identical on both machines; nothing
transferred by file this time).

| Run (EDT) | Build | Journey | `validate.sh` | Disposition |
| --- | --- | --- | --- | --- |
| r8 13:40 | 0 | 18 stops, errors `[]` | 1872 / 1872 across 12 TAP suites, 0 failures (exit 0) | publication receipt; `leftovers=0` |

r8 against the r7 receipt: every contract member is identical — chip, member
card, ally roster in all four states, dock B, quickbar banks, skull, chat
opener, settings dialog. The only deltas are the FPS readout's intrinsic
text width (`diagnostics`, excluded from the contract) and the hidden
zero-size chat panel's anchor `y` in `run-held` (49 → 57; not rendered). The
+11 tests over r7 are upstream's. Mac load was ~16 from another task's ML
rollout server and trainers; none were validation jobs and none were touched.

Publication: `97e2c9fd` (code + ledger) and the docs-only commit carrying
this receipt go to `main` as a fast-forward. Deploy: none — production keeps
serving `3e2aa260` until the owner deploys. After the push proof the
acceptance clone, bundle, and runner are removed; the evidence and logs named
above (`/Users/jarrett/codex-acceptance/mobile-hud-iter-20260823/{evidence,logs}/r7`
and `r8`) are retained as the receipt's evidence.
