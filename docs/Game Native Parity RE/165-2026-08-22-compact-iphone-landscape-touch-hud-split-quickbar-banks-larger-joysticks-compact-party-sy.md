# 2026-08-22 — Compact iPhone-landscape touch HUD: split quickbar banks, larger joysticks, compact party system

## Reported smell and parity question

- Owner request for an iPhone XR-class landscape phone (`896 x 414` CSS px,
  DPR `2`): keep the centre dock (backpack, tome, XP bar, red/blue potions)
  exactly as it is, split the eight-slot skill quickbar into `4 + 4` banks
  near each thumb, make both virtual joysticks `25%` larger, ship a compact
  party menu (panel, invitation, settings dialog, player card), shrink the
  chat-open button, and stop the HUD from eating the play area. Very small
  chrome is acceptable; hit targets must stay thumb-sized.
- This reopens the `2026-08-21 — Mobile gameplay controls on the unified skill
  quickbar` system. Nothing semantic changes: every touch producer still
  publishes the same actor-owned intents (`cast.quickbar` slot identity,
  strict potion consume, Inventory/Skills openers, movement/aim levels). The
  whole change is coarse-pointer layout policy.
- Falsifiers: any quickbar slot that is not topmost at its centre, any pair of
  touch controls whose rectangles overlap, a dock/potion rectangle or centre
  spacing that differs from the 2026-08-21 contract, a joystick ratio other
  than exactly `1.25`, a desktop (fine-pointer) pixel change, a slot whose
  order no longer matches native slots `0..7` left-to-right, or a Hub versus
  Boneyard membership difference for the shared members.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Prior contract | this ledger, `2026-08-21` entry; Website `1149ccc0` (`Revert "Redesign the mobile gameplay HUD"`) | joysticks `190/80` logical, eight `100`-px slots in one centred row (`MOBILE_QUICKBAR_SLOT_OFFSETS = [-414 … 314]`, `bottom: 132px`), dock buttons `100 x 100` with centres `110` px apart, potions at `calc(50% ∓ 215px)` / `calc(50% + 115px)` | high |
| Projection basis | `frontend/src/game/renderer/game-viewport.ts` (`GAME_VIEWPORT_MIN_WIDTH 1600`, `GAME_VIEWPORT_MIN_HEIGHT 900`, `fixedGameViewportScale = min(w/1600, h/900)`); `HubScene.tsx:572-579`, `BoneyardScene.tsx:794-798`; `GameHud.tsx:192-204` | `896 x 414` gives display scale `0.46`, logical viewport `1947.83 x 900`; `1` CSS px = `2.1739` logical px. `.hub-hud` is `viewport/uiScale` wide and scaled by `uiScale` about the centre; `TouchJoystick` scales itself by `--game-ui-scale` from its own bottom corner (`touch-joystick.css`) | high |
| Hub primary joystick | `git log -S'lane="primary"' -- HubScene.tsx` → `3eb6171b` (added 2026-08-14), `86d7a704` (`Seal Hub combat and defer shared admission`, 2026-08-22) | the Hub no longer mounts a primary joystick; `BoneyardScene.tsx:925-934` mounts both lanes. The `right: 170px` primary anchor that cleared the Hub map control has no remaining purpose; `smoke-game-devices.mjs:383` asserts zero primary joysticks in the Hub | high |
| Map control | `GameHud.tsx:382-388`, `HubScene.tsx:485-492` (`beginMatch`) | `.hub-hud-map` is Hub-only at `right 17 / bottom 16`, `121 x 118` logical; with a single catalogued boneyard it starts the run directly and never opens `.hub-boneyard-picker` (the picker needs ≥ 2 boneyards, so it is unreachable in the acceptance stack) | high |
| Pre-change geometry (screen px, `896 x 414`) | Mac full-stack run `mobile-hud-compact-20260822/evidence/baseline/hub-solo.png` (+ earlier run #1 stops `hub-invitation`, `hub-party`, `hub-party-settings`, `hub-player-card`, `hub-chat-open`) | joystick base `≈ 87` CSS px (`190 x 0.46`), slots `46` px in one row `x ≈ 257-638`, party panel `≈ 215 x 115` (solo) / `≈ 205` tall with an invitation because `.hub-party-panel` is scaled by `1/0.46` to screen pixels, ally roster bar `≈ 195 x 35`, chat-open `42 x 42` at `(10, 38)`, player card `≈ 400 x 335` (81% of the height), party settings dialog already compact; dock `46`-px buttons at `x ≈ 349-547` | high |
| Slot internals | `hub.css:250-300`, coarse section `hub.css:1043-1080` | icon and cooldown are fixed-size and centred (`translate(-50%, -50%)`), so a slot rectangle may shrink to `≥ 56` root px without touching the art; `.hub-hud-skill-quickbar` is an `inset: 0` absolute container with slots positioned individually | high |
| Joystick travel | `TouchJoystick.tsx:40-52` | input and render radii are `0.34 x` the measured base, so a larger base enlarges travel proportionally with no constant to edit | high |
| Safe areas | `frontend/index.html:7` (`viewport-fit=cover`), `game-chat.css:398` | the page extends under the notch in landscape; only the chat sheet honours `env(safe-area-inset-*)` today. Chrome emulation reports `0` insets, so screen assertions are inset-free | high |
| Ergonomic brief (advisory, no oracle) | Sonnet web-research brief captured in this task | thumb zones are the lower `40-50%` near the side edges; `≥ 44` CSS px targets; idle chrome `60-80%` opacity; keep the middle band clear; XR insets `44` L/R, `21` bottom | medium |
| uiScale range | `game-settings.ts:3-4,147-151`; `smoke-game-devices.mjs:555-563` | integer percent `75..150`, applied to the HUD root and the joysticks; the devices smoke asserts a `1.5 x` joystick at `150%` | high |

No retail address or reusable native fact is recovered; the retail game has no
mobile oracle. Everything below is explicit browser policy layered on the
unchanged 2026-08-21 producers.

## System boundary and membership inventory

System: coarse-pointer gameplay HUD layout shared by the Hub and Boneyard
scenes — joysticks, quickbar banks, dock, party surfaces, ally roster, chat
opener, and the top chrome they must not collide with — across `uiScale`
`75..150%`. The boundary ends at CSS geometry and the pure placement function;
input producers, session/party authority, replication, audio, and modal owners
are untouched.

| Member | Native/current source | Disposition | Proof |
| --- | --- | --- | --- |
| movement joystick (Hub + Boneyard) | `touch-joystick.css`, `TouchJoystick.tsx` | exact-ported policy: base `190 → 237.5`, knob `80 → 100` (`x 1.25`), anchor `left 48 / bottom 56` logical plus `env(safe-area-inset-left)` | computed `237.5/100`, screen width `237.5 x 0.46 = 109.25 ± 0.1`, idle knob centred, held knob follows the touch |
| primary joystick (Boneyard only since `86d7a704`) | same | exact-ported policy: mirrored `right 48 / bottom 56` (the Hub-map clearance offset `170` is retired) | same geometry, two-finger hold proof, absent in the Hub |
| quickbar slots `0..3` | `SkillQuickbar.tsx`, `hub.css` coarse rules | web-policy change: left `2 x 2` bank `[0 1 / 2 3]`, `100`-px slots, `8`-px gap, bank inset `310` root px from the left edge, bank bottom `62` | four slots with centres left of mid-screen, `46 ± 0.1` CSS px, topmost, non-overlapping, clear of joystick, dock, party panel, chat |
| quickbar slots `4..7` | same | web-policy change: right bank `[4 5 / 6 7]` mirrored from the right edge; slot `4` is the inboard column so reading order stays `0..7` left-to-right | four slots right of mid-screen, same checks, clear of the Hub map control |
| adaptive bank width at large `uiScale` | new `mobile-quickbar-layout.ts` | web-policy: slot size `= clamp(56, ((W/(2u) − 231) − 318) / 2, 100)` root px so joystick, bank, and dock never overlap; on `896 x 414` the clamp engages above `u ≈ 1.33` | unit test at `u = 0.75 / 1 / 1.25 / 1.5` |
| dock: backpack, tome, XP bar, red/blue potions and counts | 2026-08-21 contract | verified-unchanged | dock rectangles equal the prior contract (`46`-px buttons, potion-red left `349.1 ± 0.5`, backpack `399.7`, tome `450.3`, potion-blue `500.9` CSS px) |
| party panel (`.hub-party-panel`, heading, count, gear, member rows, tags) | `hub.css:500-636` + coarse `1130-1145` | web-policy compact: screen-px scaling retained, width `156`, `11`-px body, `22`-px rows, `22`-px gear, `top 150` logical | panel `≤ 170 x 120` CSS px solo, gear `≥ 22` px, all members visible |
| party invitation (`.hub-party-invitation`, Accept/Decline) | `hub.css:637-680` | web-policy compact: `32`-px action buttons, `11`-px text | invitation accepted through the compact buttons; panel `≤ 190` px tall with an invitation |
| party settings dialog (`party-settings.css`) | current | web-policy tidy under the coarse gate: `12`-px padding, `36`-px controls, `16`-px code; counter-scaled by `1 / --hud-display-scale` like the panel (it lives inside the display-scaled frame and rendered at `239 x 61` CSS px — `520 x 0.46` — with `≈ 5.5`-px text on the XR before this entry), width `min(520px, 100vw - 24px)`, `max-height: 100vh - 24px` | dialog `≥ 300` px wide (screen scale), inside the viewport in both the leader and member views, close works |
| player card (`.hub-player-profile*`) | `hub.css:708-940` + coarse `1150-1157` | web-policy compact: width `300`, `12/14` padding, `18`-px name, `13`-px stats, `30`-px buttons | card `≤ 320 x 270` CSS px, close works |
| ally roster (`.hub-hud-allies`) | `hub.css:44-150` + coarse `1159-1164` | web-policy compact: screen scale `0.72 / displayScale`, `top 96` logical retained | row `≤ 145 x 27` CSS px with one ally, under the meters, clear of the party panel |
| chat opener (`.game-chat-open`) | `game-chat.css:396-476` | web-policy: `30 x 30`, `16`-px icon, `left 8 + safe-area-left`, `top safe-area-top + 30`; open sheet unchanged | `≤ 32` px square, opens and closes the sheet |
| top chrome: skull, diagnostics, meters, selected-skill rune, help, fullscreen toggle, loadout column, Hub map control | `hub.css`, `game-fullscreen` | verified-unchanged; used only as collision targets | no overlap with any moved member |
| Boneyard picker modal | `HubScene.tsx:870-905` | out-of-system (centred modal, unreachable with one boneyard, untouched) | none |
| `uiScale 75..150%` | `GameHud.tsx`, `TouchJoystick.tsx` | exact-ported: the HUD root gains `--game-ui-scale` so safe-area insets divide by `displayScale x uiScale`; joystick own-scale contract unchanged | layout unit test; `smoke-game-devices.mjs` `1.5 x` assertion untouched |
| portrait coarse pointer | `touch-joystick.css` portrait block | out-of-system (rotate gate); joystick portrait offsets scale with the new base (`bottom 74`, `left/right 54`) | existing devices smoke |
| desktop fine pointer | base rules | verified-unchanged (all new rules sit under `(hover: none) and (pointer: coarse)`) | `game-fullscreen.test.ts`, desktop smokes untouched |
| safe areas | `index.html` `viewport-fit=cover` | web-policy: joysticks, banks, and the chat opener add `env(safe-area-inset-left/right)`; the dock and top-left column keep their current anchors | CSS contract test; emulation insets are `0` |

## Native ownership thread

Unchanged from 2026-08-21: `BrowserGameplayInput` owns the source-qualified
holds; slots publish only semantic slot identity; potions send the strict
consume action; Inventory/Skills openers are participant-owned. The retail
presenter `0x005D3E10` draws eight slots in one row because the retail game has
no touch profile — the banks are a browser projection of the same eight
actor-owned slots, which is why the bank order must keep native slot order.

## Recovered behavioral contract

- Joysticks: `237.5`-px bases, `100`-px knobs, `0.34` travel ratio, both
  anchored `48` logical px from their screen edge and `56` from the bottom,
  scaled from their own bottom corner by `uiScale`. Primary only in the
  Boneyard. Idle knob centred; pointer capture, blur, hidden, and teardown
  releases unchanged.
- Quickbar banks: slot `s` lives in bank `⌊s/4⌋`, column `s mod 2`, row
  `⌊(s mod 4)/2⌋`; left bank columns grow rightward from inset `310`, right
  bank columns grow leftward from inset `310` measured from the right edge so
  slot `4` is inboard; row `0` sits above row `1`; bottom `62`. Slot size is
  `100` root px unless the half-width cannot host joystick + bank + dock, in
  which case it shrinks (floor `56`) so nothing overlaps.
- Dock, potions, counts, XP bar: byte-identical CSS to the prior contract.
- Party surfaces keep screen-pixel scaling (`1/displayScale`) so text stays
  legible, but shrink to the compact sizes above; the invitation remains
  inside the panel; the player card and settings dialog stay centred modals.
- Chat opener is a `30`-px tile; the open sheet, messages, and close control
  are unchanged.

## Nearby-system findings

- `tools/smoke-game-built-joystick.mjs` is already stale before this change:
  it waits for a Hub primary joystick (removed in `86d7a704`) and casts slot
  `0` in the Hub (sealed by the same commit). It is not a `validate.sh` gate.
  Its geometry constants are updated to the new contract so the file does not
  contradict the ledger; its Hub flow is out of scope and recorded here.
- `tools/smoke-hub-combat-entry.mjs:113` asserts
  `.touch-joystick[data-lane="primary"]` — a selector that never existed (the
  class is `.game-touch-joystick[data-joystick]`), so the assertion is vacuous.
  Not fixed here; logged for the gate-mutation register.
- The Boneyard picker modal only appears with ≥ 2 catalogued boneyards; the
  acceptance stack (task-private backend, stock catalogue only) cannot reach
  it, which is why the journey has no picker stop.
- Recovered during browser acceptance (run `r2`): the party settings dialog
  rendered at the frame's display scale on touch devices — `239 x 61` CSS px
  on the XR (`520 x 0.46`), i.e. `≈ 5.5`-px labels — because only the party
  panel and player card carried the `1 / --hud-display-scale` counter-scale.
  A pre-existing defect inside this system's membership; fixed in this entry
  (see the membership row) and guarded by the journey's `assertDialogFits`
  (`≥ 300` px wide, inside the viewport) at both settings stops.
- The acceptance stack's supervisor secret is derived from the run label; the
  game host rejects secrets under 32 bytes (`game-host.ts:345`), so the short
  label `r1` never booted a session (journey timed out at `enterHub`). Stack
  script fixed to a fixed-length prefix; product code not involved.

## Confidence and open questions

- Confirmed: projection math, slot/bank mapping, collision-free geometry at
  `uiScale 1`, dock immutability, and the producer contract. No simulation
  inference.
- Physical grip ergonomics and notch behaviour on real hardware remain
  unverified (Chrome emulation reports zero safe-area insets).
- `uiScale > 1.33` on a `896 x 414` screen relies on the adaptive slot size;
  hit targets then drop below `44` CSS px by the owner's own scale choice.

## Web implementation consequence

- New `frontend/src/game/mobile-quickbar-layout.ts` (pure placement + joystick
  constants) with `mobile-quickbar-layout.test.ts` (added to `test:boneyard`).
- `SkillQuickbar.tsx` receives `uiScale` and the logical viewport width and
  emits `data-quickbar-bank` plus `--mobile-quickbar-slot-x/-bottom/-size`.
- `hub.css` coarse section: bank-anchored slots, compact party panel,
  invitation, player card, ally roster; dock rules untouched.
- `touch-joystick.css`: `237.5/100`, symmetric anchors, safe-area insets.
- `game-chat.css`: `30`-px opener. `party-settings.css`: coarse tidy.
- `GameHud.tsx`: `--game-ui-scale` on the HUD root.
- `tools/smoke-mobile-hud-compact.mjs` becomes the acceptance journey
  (`npm run smoke:game:mobile-hud`) on the production bundle behind the real
  backend + supervisor: stops `hub-solo`, `hub-solo-settings` (leader view
  of the dialog), `hub-invitation`, `hub-party`, `hub-party-settings`
  (member view), `hub-player-card`, `hub-chat-open`, `run-idle`,
  `run-held`, `run-released`, each with geometry/collision assertions and a
  `receipt.json`.

## Validation contract

- Unit: `mobile-quickbar-layout.test.ts` (bank membership, mirrored columns,
  adaptive sizes at `u = 0.75/1/1.25/1.5`, CSS constants match), existing
  `game-fullscreen.test.ts`.
- Gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini from a
  clean detached worktree of the exact tree under review.
- Browser acceptance on the Mac production bundle (`backend/wwwroot` served by
  `Server.dll` with the supervisor) in Chrome, `896 x 414`, DPR `2`, touch,
  iPhone UA: all journey stops above green, screenshots reviewed, empty page
  and console error lists.
- No publication, push, or deployment is authorized by this entry.

## Implementation validation receipt

- Tree under review: worktree branch `claude/mobile-hud-compact-20260822` on
  base `1149ccc0`; the Mac worktree
  `/Users/jarrett/codex-acceptance/mobile-hud-compact-20260822/website` is
  `1149ccc0` plus the same 12 changed/new files (SHA-256 verified
  byte-identical after each sync).
- Unit (Mac): `node --experimental-strip-types --test
  src/game/mobile-quickbar-layout.test.ts` → 6/6 pass (also wired into
  `test:boneyard`).
- Gate (Mac mini, 2026-08-22 22:02:47 → 22:04:28 EDT):
  `/opt/homebrew/bin/bash ./scripts/validate.sh` exit `0` — Website contracts
  + backend integration tests, backend formatting, frontend lint, 11 frontend
  suites (`# fail 0` × 11; 1,775 tests), desktop shell tests, production
  build (`Game` chunk `420,344` raw / `117,564` gz ≤ `131,072` budget),
  production media policy.
- Browser acceptance, run `r3` on the production bundle (`backend/wwwroot`
  behind `Server.dll` + supervisor; Chrome, `896 x 414`, DPR `2`, touch,
  iPhone UA): 10 stops, exit `0`, empty page and console error lists,
  `receipt.json` + screenshots under `evidence/r3/` (all reviewed):
  - display scale `0.46`, UI scale `1`; dock `x = 349.1 / 399.7 / 450.3 /
    500.9`, `46` px — identical to the pre-change baseline.
  - quickbar: left bank slots `0-3` at `x = 142.6 / 192.28`,
    `y = 289.8 / 339.48`; right bank slots `4-7` at `x = 657.71 / 707.39`
    (`46` px, `2 x 2`); joysticks `109.25` px base / `46` px knob at
    `x = 22.08` (movement) and `764.66` (primary), `y = 278.99`; pairwise
    overlap-free among the moved members and against the dock, XP bar and
    potion counts; everything inside the viewport.
  - party panel `156 x 65` solo, `156 x 132` with an invitation,
    `156 x 88` with two members; ally row `141.12 x 24.48`; chat opener
    `30 x 30` at `(8, 30)`; player card `300 x 221` centred; settings
    dialog `520 x 207` (leader view) / `520 x 132` (member view) at screen
    scale, inside the viewport.
  - `run-held`: movement knob centre deflected `+32.85` px (reach
    `0.3 x 109.25 = 32.78`); `run-released`: knob recentred within `0.01` px.
- Earlier runs: `r1` failed on the stack script's own secret length (no
  product defect, see nearby findings); `r2` passed 9/9 stops and surfaced
  the settings-dialog frame-scale defect, fixed before `r3`.
- Local (WSL) pre-checks on the changed files: `oxlint` clean,
  `check-game-boundaries` clean, `tsc -p tsconfig.app.json` and
  `tsc -p tsconfig.test.json` clean.
- Scaffolding: the task's own Mac dev server (pids `44298/44299/44300`, port
  `5205`) disposed by exact PID; every stack run disposed its own supervisor +
  backend (`leftovers=0`). The Mac worktree and `evidence/` are retained for
  owner review; they are removed only after an authorized push.
- Owner authorized the push (2026-08-22 late evening) and then "push to main".
  Between the first push (`a9eaee42`) and the landing, `main` moved to
  `3827f89e` (Hall of Fame rows); the branch was rebased onto it as
  `774070ac` — only `frontend/package.json` (auto-merged, disjoint script
  edits) and this ledger (both entries appended at EOF; resolved by keeping
  main's entry followed by this one) overlapped, no touch-HUD code.

### Rebase re-validation (`774070ac`, fresh Mac clone from GitHub)

- `validate.sh` attempt 1 (23:43:08 → 23:45:25 EDT) failed on one check:
  `web Lua trivial execution stays below the fixed-tick budget`
  (`src/game/host/lua/web-lua-runtime.test.ts:279`, p99 `36.673` ms vs the
  `20` ms budget). The Mac was at load average `20.6` from another task's two
  `ml-bot-rollout-server.mjs` processes (~300 % CPU each) plus a C++ collector;
  the test file is untouched by both commits and measures wall-clock latency, so
  this is scheduling contention, not a regression. Those processes belong to
  another task and were left alone; the gate stops at the first failure, so the
  whole script was re-run.
- `validate.sh` attempt 2 (23:46:21 → 23:49:12 EDT) exit `0`: 11 frontend
  suites `# fail 0` (1,791 tests, including main's new Hall of Fame
  presentation tests), backend build + contracts + formatting, frontend lint,
  desktop tests, production build (`Game` chunk `434,638` raw /
  `122,303` gz ≤ `131,072`), media policy.
- Journey `r4` on that production bundle: 10 stops, exit `0`, zero page and
  console errors. A recursive diff of the `r4` receipt against `r3` compares
  1,821 leaves and finds 2 differences, both the diagnostics FPS readout width
  (`37.73` → `41.05` px, longer frame-time text under load); every HUD member
  (quickbar banks, joysticks, dock, party chrome, dialogs, player card, held /
  released knob) is identical to `r3`.
- This paragraph is the only change on top of the validated tree (docs only).
- Landing: branch fast-forwarded onto `main`; deploy remains a separate owner
  call.

### Follow-up 2026-08-23 — party panel vs chat opener on the real phone viewport

- Owner report after the landing: "in the hub the party card is still too large
  on a small screen like iPhone XR and the chat button overlaps it." Production
  was already on this build (`DEPLOYED_GIT_SHA` = `3e2aa260`, `wwwroot`
  swapped 23:55 EDT; `Game` chunk `434,638` bytes = the validated size), so the
  report is about the landed touch HUD, not the previous one.
- Reproduced in a browser at iPhone XR emulation against the dev build, with the
  panel markup mounted verbatim (the backend-less `dev:game` flow has no party
  state). Measured at `896 × 414`: chat opener `(8, 30) 30 × 30`, panel
  `(5.1, 69) 156 × 65` — a `9` px gap, which is what the journey captured. The
  two live in different coordinate spaces: the opener is screen-pixel
  positioned (`top: safe-area-top + 30px; left: 8px + safe-area-left`), the
  panel is frame-logical (`top: 150px; left: 11px`, then counter-scaled), so its
  screen top is `150 × display-scale`. Safari's landscape viewport on the XR is
  `896 × 366` (address bar visible): display scale `0.4067`, panel top `61` px,
  gap `1` px — the opener's border and its `-7px` hit halo sit on the card. The
  panel also ignores `safe-area-inset-left`, so with the notch on the left the
  opener moves `44` px right and lands directly above the card's header: the
  two read as one overlapping cluster, and a `156 × 65` card in a `366` px tall
  view is a third of the height together with the opener.
- Fix (CSS only, coarse-pointer block): place the panel in the opener's screen
  column — `top = (safe-area-top + 66px) / display-scale`, `left = (8px +
  safe-area-left) / display-scale` — a constant `6` px below the `30` px
  opener at every viewport height, aligned on the same safe-area edge; and
  shrink the card: `134` px wide, `3px 6px 4px` padding, `8.5` px header with a
  `16` px gear (hit halo kept at `40` px), `20` px member rows, `10.5` px names,
  `7` px tags, `28` px invitation buttons. Prototype at `896 × 414`: solo card
  `(8, 66) 134 × 50`.
- Journey: `smoke-mobile-hud-compact.mjs` gains a minimum-gap assertion between
  the opener and the card and a second solo stop at Safari's `896 × 366`
  viewport (`hub-solo-short`), plus tightened envelopes (solo ≤ `140 × 58`,
  party ≤ `140 × 80`, invitation ≤ `140 × 130`).
- Receipt (Mac mini, 2026-08-23, fresh clone of `3e2aa260` + this patch):
  `scripts/validate.sh` 00:26:31 → 00:28:40 EDT, exit `0`; production bundle
  `Game-CKwSnHoX.js` `434,638` B raw / `122,300` B gzip, within budget; journey
  r5 against the Debug backend + session supervisor serving that bundle, real
  Chrome with CDP touch emulation, `12` stops, exit `0`, evidence under
  `codex-acceptance/mobile-hud-compact-20260822/evidence/r5`. Measured on the
  BUILT bundle: opener `(8, 30) 30 × 30` at every stop; panel `(8, 66)
  134 × 50` solo at `896 × 414` and at `896 × 366` (`hub-solo-short`, display
  scale `0.4067`), `134 × 70` with two members, `134 × 109` with an
  invitation; gap to the opener `6` px in every state and at both heights
  (was `9` / `1`), x offset `0`. Portrait `414 × 896` is behind the rotate
  overlay; the panel keeps the opener's column there (no regression). Stack
  disposed by exact PID (`2239 2240`, leftovers `0`); local dev page + headless
  Chrome disposed by exact PID after the before/after captures.
- Landing re-validation (2026-08-23, owner: "push to main and clean up"): `main`
  had moved to `163caeac` (63 ML-bot / shared-party commits, none touching
  this change's files); rebased as `1d96d2cf`. Mac mini on the rebased tree:
  `npm ci` + Debug backend rebuild, `scripts/validate.sh` 09:12:09 → 09:15:48
  EDT exit `0` (now includes `test:ml-bot`); journey r8 `12` stops exit `0` on
  bundle `Game-ydxk-gra.js`: opener `(8, 30) 30 × 30`; panel `(8, 66) 134 × 50`
  at `896 × 414` and at `896 × 366`, `134 × 70` party, `134 × 109` invitation;
  gap `6` px, x offset `0`, no console / page errors; stack disposed by exact
  PID, leftovers `0`. Two journey runs before r8 failed at `enterHub` for
  scaffolding reasons, not the HUD: r6 — on `main ≥ 163caeac` the session
  supervisor requires `SDR_GAME_ML_BOT_CHECKPOINT` and exits at start without
  it (backend then answers `503` on shared-Hub admission); r7 — a comment
  inserted inside the task stack script's backslash-continued env chain
  dropped the supervisor secret. Both fixed in the task-private stack script
  (`SDR_GAME_ML_BOT_CHECKPOINT=frontend/server-assets/ml-bot-policy-v5-selected.sdml`,
  the same file `smoke-game-deployment-restart.mjs` uses). Landed on `main` as
  `1d96d2cf` plus this docs note; production deploy is the owner's call.
