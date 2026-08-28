# 2026-08-27 — InventoryScreen Sack return-control presentation closure

## Reported smell and parity question

- Reported production behavior: Sack contents can now be entered, but the
  visible icon for leaving the InventoryScreen or returning to the previous
  Sack is missing.
- This is a secondary report in the 2026-08-27 InventoryScreen page system.
  The earlier pass recovered the parent-root stack, page transitions, audio,
  and a semantic game-back hit target, but it did not enumerate the Game-owned
  backpack control that paints the action. Its browser journey clicked the
  transparent semantic button and reviewed broad screenshots without a
  per-branch visible-control assertion. That violated the complete-membership
  and per-member proof rules.
- Reproduction membership is the outer participant inventory; empty,
  nonempty, and recursively nested Sacks; standalone College/Hub and active
  Boneyard screens; Fomentius, Hagatha, Luthacus, and both Shlorio companion
  screens; fixed desktop and coarse-pointer landscape viewports; forward,
  reverse, interruption, and teardown phases.
- Falsifiers were a Sack-depth-specific native icon/arrow, an InventoryScreen
  painter owning the control, a depth branch that hides record 47, or a web
  state branch that intentionally removes the control while game-back remains
  available. Fresh evidence falsifies all four.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified retail `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | The canonical program and image-base contract remains unchanged. | high |
| Fresh instructions | canonical read-only `SolomonDark` Ghidra replica 2 through the Mod Loader wrapper; `Game` HUD constructor/layout `0x005D76C0`, modal slide `0x005C7200`, InventoryScreen action `0x0056D920` | `Game+0x22C` owns one 58 by 62 backpack control; its image field `Game+0x2B8` receives UI 47 from `UI+0x2434`. Modal slide changes only geometry. Sack depth never changes or hides the record. | high |
| Existing instruction thread | InventoryScreen ctor `0x00560380`, update `0x00551A10`, page builder `0x00560D30`, close/dtor `0x00555810/0x005684C0` | The screen owns the current root, parent stack, direct-child grids, transition lock, and back-vs-close branch, but not the visible Game HUD control. | high |
| Asset/data | `frontend/src/assets/game/native-ui-assets.json`, UI record 47; extracted `hub-hud-backpack.png`; UI 48 sibling | UI 47 is exactly 58 by 62. UI 48 is the adjacent tome control; no alternate Sack-return glyph exists. | high |
| Clean stock capture | Mod Loader `tests/fixtures/webgame/menu-reference-captures/inventory-screen.png`; HUD census | The outer InventoryScreen retains the bag control; the base is accompanied by a black `+5,+5` shadow and remains clipped by the 900-pixel viewport after modal slide. | high |
| Prior Mac browser evidence | Chrome/WebGL2 `sacks-dyes-v4-sack-inside.png` and service sibling frames under `/Users/jarrett/codex-evidence/inventory-belt-teleport-20260827-rebased/`; Website `97c61453` | The prior fixed-stage candidate visibly painted the bag at one child depth, but the receipt did not assert it and did not prove current main, every depth, or responsive membership. | medium-currentness, high observation |
| Current production/source trace | live `/deployment.json` revision `d62ed095`; `HubInventoryUi.tsx`, `hub-inventory-renderer.ts`, `hub-inventory-render-contract.test.ts` | The action rect and path logic are present. The renderer hides the ordinary DOM HUD, reconstructs UI 47 inside a helper named only for the belt, paints the supposed shadow as a second untinted copy, and has no focused visual-control contract. Companion services additionally position the visible modal HUD at settled progress 1 while the return hit rect reads the unrelated standalone-inventory progress, leaving a 15-stage-pixel offset after ordinary inventory teardown. | high |

All native addresses are preferred-image addresses. No injected runtime address
or ASLR mapping is used. The current production revision check is a
read-only deployment observation, not a publication or deployment action.

## System boundary and membership inventory

Native system: the cross-owner InventoryScreen game-back affordance, from the
Game-owned backpack control's asset/layout/painter through InventoryScreen's
root-stack consumer, every input source, every screen host, and teardown.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| backpack base glyph | UI 47 at `UI+0x2434`; `Game+0x2B8` | `exact-ported` by this closure | exact extracted record, untinted base, 58 by 62 authored size |
| backpack shadow | shared control painter; HUD census | `exact-ported` by this closure | black copy at `+5,+5`, never a second full-color bag |
| resting/opening/settled/closing geometry | `0x005D76C0`, `0x005C7200` | `verified-already-at-parity`, strengthened with visual proof | `W/2-69.5`, `H-75+15p`; fixed-stage viewport clipping retained |
| outer participant root | game-back branch in `0x0056D920` with empty parent stack | `verified-already-at-parity` | visible UI 47 closes the screen and requests `openpanel` |
| empty and nonempty Sack child | same handler, parent count nonzero | `verified-already-at-parity`, visual proof added | same UI 47 pops one parent and requests `backpack_close` |
| recursively nested Sack at all admitted depths | same dynamic root stack | `verified-already-at-parity`, visual proof added | control persists unchanged and one activation pops exactly one level |
| forward/reverse page motion | `+0x168/+0x16C/+0x170`, `0x00551A10` | `verified-already-at-parity` | control stays in the Game HUD lane while page grids move; transition lock ignores another action |
| standalone College/Hub screen | `0x005C6F10` | `verified-already-at-parity`, visual proof added | root, child, nested, and close frames retain the control |
| active-Boneyard screen | shared standalone owner | `verified-already-at-parity`, visual proof added | identical control/action while inventory pause authority remains unchanged |
| Fomentius/Hagatha/Luthacus/Shlorio companion screens | shared companion InventoryScreen | `verified-already-at-parity`, visual proof added | service overlay cannot cover or replace the player backpack control |
| keyboard/menu key and controller game-back | shared addressed game-back input | `verified-already-at-parity` | same consumer, one level per accepted edge |
| pointer and coarse-pointer activation | `Game+0x22C` control rect | `verified-already-at-parity`, responsive visual proof added | semantic rect overlays the visible UI-47 base throughout modal slide |
| notice, DyeClothing, chat coexistence, and service modal interruption | sibling modal owners | `out-of-system` where Website-only chat is involved; `verified-already-at-parity` for native notice/dye suspension | a higher-priority modal may suspend input but cannot silently erase only the painter and leave an active back target |
| close, service teardown, world transition, death/Game Over | screen and scene teardown | `verified-already-at-parity` | visual and semantic control leave together; no Sack path survives |
| UI-48 tome control | adjacent Game control at `Game+0x2EC` | `out-of-system` for Sack action; shared painter verified | exact sibling receives the same shadow/base correction and continues routing SkillScreen only |
| eight BeltButtons and XP bar | neighboring Game HUD objects | `out-of-system`: separate action/state owners | no belt or XP state gates the backpack control |
| desktop and coarse-pointer landscape composition | fixed 1600 by 900 browser stage | `exact-ported` web projection | one uniform outer transform keeps art and hit rect coincident; no platform block |

No member is `blocked-by-platform`.

## Native ownership thread and recovered behavioral contract

- `Game` constructs and retains the backpack control for the participant
  lifetime. UI 47, its shadow/base painter, and its backbuffer-relative rect
  do not know which `InventoryScreen` root is active.
- `InventoryScreen` owns only navigation state: current root `+0x158`, parent
  stack `+0x174`/count `+0x184`, two page lanes, transition state, selection,
  ItemInfo, and dragger. The generic game-back action enters `0x0056D920`;
  nonzero parent count pops one root, while zero count begins screen close.
- `0x005C7200(Game,p)` moves backpack, tome, and belt controls during modal
  reveal. At 1600 by 900 and `p=1`, UI 47's base rect is
  `[730.5,840,788.5,902]`; stock clips the bottom two pixels. Its logical hit
  rect is `[730.5,840,58,62]`. The writer's complete xref set is four calls:
  two open/close branches in InventoryScreen update `0x00551A10` and two in
  SkillScreen update `0x006567E0`; no other screen or Sack branch owns it.
- The painter is an untinted UI-47 base plus a black copy at `+5,+5`. There is
  no depth-dependent arrow, parent Sack icon, label, random choice, audio, or
  authored table beyond this one asset row. UI 48 is the only immediate
  control sibling and routes SkillScreen.
- Page motion and the bottom HUD are separate presentation lanes. The grids
  traverse horizontally for 160 fixed ticks; the return control remains fixed
  and ignores input until the transition unlocks. Closing resets both the
  browse path and the modal HUD presentation without touching inventory data.

## Confidence, nearby findings, and implementation consequence

- Confirmed: complete asset membership, owner split, constructor fields,
  layout/slide formulas, base/shadow composition, all Sack-depth branches,
  all screen hosts, input consumer, transition gate, and teardown.
- Inferred: none used as native implementation truth. Prior screenshots prove
  only their named candidates and are not substituted for fresh current-tree
  acceptance.
- Unknown: none material and no browser approximation. If a device still
  loses the glyph after this closure, the next falsifier is a captured WebGL
  frame plus viewport/safe-area geometry from that exact device, not a guessed
  alternate icon.
- Correct web owner: retain the local Sack path in `HubInventoryUi`, but give
  the Game-owned modal controls an explicit renderer contract instead of
  leaving UI 47 hidden inside belt construction. Paint the black shadow and
  untinted base for both UI 47 and its UI-48 sibling; keep the control outside
  moving Sack page containers and above service page content. Bind companion
  service hit geometry to the same settled modal progress as its painted HUD,
  rather than reusing the standalone InventoryScreen slide store.
- Remove no protocol, save, host, inventory, or audio behavior. Do not add an
  arrow, breadcrumb, parent-Sack thumbnail, fallback DOM icon, or depth action.

## Validation contract

- Focused contract tests: exact UI 47/48 records, authored size, black
  `+5,+5` shadow, base centers at modal progress 0 and 1, and renderer
  ownership outside both moving page containers.
- Focused UI tests: visible semantic rect and art contract at outer, empty,
  filled, and two-level nested paths; transition lock; one-level back; outer
  close; teardown; all four trader families and both Shlorio states.
- Mac Chrome production-bundle journey: current main baseline, then exact
  candidate at desktop 1600 by 900 and coarse-pointer landscape. Capture
  outer, child, nested, return, Boneyard, and companion frames; verify the
  UI-47 region is nonempty by reviewed pixels, the hit rect overlaps the
  visible base, and page/console/failed-response/host arrays are empty.
- Run the complete Website `/opt/homebrew/bin/bash ./scripts/validate.sh` and
  the Mod Loader `python3 tests/re/run_static_re_tests.py --ci` gates on
  byte-identical clean Mac trees. Publication and deployment remain separate
  and require explicit authorization.

## Implementation validation receipt

- The focused red candidate on Website base `d62ed095` passed every prior Hub
  UI member but failed the new control contract exactly `84/85` because no
  explicit `addModalHudControls` owner existed. No unrelated test failed.
- `HUB_MODAL_HUD_CONTROLS` now pins UI records 47/48, their labels, and the
  black `+5,+5` shadow. `addModalHudControls` paints shadow then untinted base
  outside both Sack page lanes and before the eight BeltButtons. The old four
  untinted sprite loop is removed. `HubInventoryUi` also uses settled progress
  `1` for companion-service return geometry, matching the already-settled
  painted modal HUD instead of the standalone InventoryScreen slide store.
- Focused renderer coverage checks both exact 58 by 62 asset rows, the
  shadow/base order and tint, the Game-owned layer, removal of the old loop,
  standalone live-slide geometry, and companion settled geometry. The
  production Sack smoke records exact inline `[730.5,840,58,62]`, renderer
  reveal `1`, transformed control size, and at least 90 percent hit/art
  overlap for every observed root. Playwright reports the post-click focused
  transparent button two pixels above its inline top on some return frames;
  the retained overlap is `0.9677`, while both the native logical rect and the
  painted renderer progress remain exact.
- The current refreshed trees are based on Website
  `b44c9f23e1f997e20c064c62e749604371032b3c` and Mod Loader
  `f1c209a4ff4ab2f484fe8c4fd9e54463c8d2f068`. Upstream Arena-pipeline,
  retained-Weld, College-scroll/facing, and durable-party-rejoin changes were
  preserved; only this
  append-only ledger overlapped, and every complete upstream entry precedes
  this complete Sack entry. Local/Mac changed-file SHA-256 manifests were
  byte-identical before validation.
- The pre-refresh exact Mac Website candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build zero warnings
  and errors, `26/26` Website/backend contracts, formatting/lint/generated
  checks, every registered frontend and desktop suite, production frontend and
  game-host builds, bundle budget, and CSP/media policy. The focused Hub UI
  group passed `85/85`, including `InventoryScreen paints the Game-owned
  backpack return control at every Sack depth`. Production entry
  `Game-MzQSVol_.js` measured `479117` raw / `134100` gzip bytes under
  `524288 / 134144`.
- The byte-identical Mod Loader candidate passed the complete portable static
  RE suite `517/517`, including the InventoryScreen UI-47 owner, field,
  shadow, geometry, no-alternate-arrow, and UI-48 sibling assertions.
- Mac Chrome `151.0.7922.174` / WebGL2 completed the exhaustive desktop
  production-bundle journey at `1600x900`: outer, empty, filled, two-level
  nested, all four trader companions, Luthacus storage, and active-Boneyard
  paths; all 18 Dye swatches and the existing inventory/belt siblings also
  remained green. Exact cue deltas were 18 `backpack_open` and 12
  `backpack_close`. Page errors, console errors, failed responses, and host
  errors were empty. The reviewed child-Sack frame SHA-256 is
  `37cef250119dac24a1782bfdbcccdb2fd1295fc0b80bc9c012173263888792ea`.
- A separate touch-enabled `896x414` production-bundle journey opened and
  returned through an empty Sack, a filled Sack, and nested path
  `40005/40003`. UI 47 stayed visibly legible at the bottom centre; the
  transformed hit box was `26.68 x 28.52` CSS pixels, renderer reveal remained
  `1`, and overlap was `0.9677..1`. Page, console, and failed-response arrays
  were empty. Reviewed empty/filled/nested frame SHA-256 values are
  `7e976647a05866da176a898c7cccb08a6b0ed5faa93e2fc088f50e2e8dd95d8d`,
  `bc69be1fa562f6eb2011521c85605dbc8839691276b328b05b390bb6035b58d6`,
  and `1e791e632c64c3db6fc15bad4b211455dab24e794574553bb43217ca734e745c`.
- Evidence is retained under Mac
  `/Users/jarrett/codex-acceptance/sack-return-control-20260827-final/evidence/`.
  The docs-inclusive exact-tree rerun passed the complete Website gate with
  the same deterministic production entry and budget result. No runtime,
  test, build, or browser source changed after the accepted journeys.
- The refreshed exact Mac Website candidate on
  `b44c9f23e1f997e20c064c62e749604371032b3c` passed the complete supported
  `./scripts/validate.sh` gate after the durable-party-rejoin changes landed:
  backend build zero warnings and errors, `26/26` Website/backend contracts,
  every registered frontend/runtime/desktop group, production frontend and
  game-host builds, bundle budget, and CSP/media policy. Production entry
  `Game-DCrSUo92.js` measured `479137` raw / `134112` gzip bytes under
  `524288 / 134144`.
- The refreshed desktop production-bundle journey passed at `1600x900` with
  22 sampled outer/empty/filled/nested/service/Boneyard return-control states.
  Every state retained exact logical rect `[730.5,840,58,62]`, reveal `1`,
  and hit/art overlap `0.9677..1`; cue deltas remained 18
  `backpack_open` and 12 `backpack_close`. All 16 screenshots, all 18 Dye
  swatches, and the existing inventory/belt paths completed with empty page,
  console, failed-response, and host-error arrays. The reviewed child-Sack
  frame SHA-256 is
  `6f5a79735bd8256bce661bca6db9663fb7bafc9da2aa46a34386b96f270d79d9`.
- The refreshed touch-enabled `896x414` journey passed seven outer,
  empty/filled, nested, and return samples. The same logical rect and reveal
  remained exact, transformed size was `26.68 x 28.52` CSS pixels, and
  overlap was `0.9677..1`; page, console, and failed-response arrays were
  empty. Reviewed empty/filled/nested frame SHA-256 values are
  `436c7d67e0308ba2fb8016ce9b84baa75c6300277e815f091e7bd919152dda4b`,
  `7ba75d249604949ce29bd233cac153f119808bb544eb6c0aa53f914f5ff198a6`,
  and `e00f11d474cea73a32c3c40f6a3629704df759d275adba31b147a027fed0a6a3`.
- Fresh reviewed pixels show UI 47 at bottom centre in every named current-main
  frame. Evidence is retained under Mac
  `/Users/jarrett/codex-acceptance/sack-return-control-20260827-current-main/evidence/`.
  Runtime, test, build, and browser sources did not change after these
  journeys; this detailed receipt is part of the docs-inclusive exact-tree
  validation input.
- No member is browser-blocked and no native unknown remains. Publication to
  Website and Mod Loader `main` was authorized after acceptance; deployment,
  production cutover, and service restart remain unauthorized and will not be
  performed by this task. Exact post-push SHAs belong in the external handoff
  because a commit cannot contain its own hash.
