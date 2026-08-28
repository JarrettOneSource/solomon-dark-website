# 2026-08-26 — Selected-primary Staff orb program

## Reported smell and parity question

- Reported web behavior: a wizard can learn and retain several category-1
  primary spells and select among them, but the colored Staff orb VFX stays on
  the wizard's creation element.
- Stock behavior to recover: determine whether PlayerWizard composition follows
  creation element, selected category-1 row, live cast actor, or equipped item;
  drain every pure, Weld, Plane Orb, invalid, scene, equipment, and lifecycle
  branch sharing that owner.
- Reproduction inputs/scenes: select another learned pure primary in Hub and
  Boneyard without changing the wizard loadout; repeat for all five pure rows,
  all ten learned Weld builds, temporary Planewalker, death/College-intro
  suppression, local/remote presentation, and selection restoration.
- Falsifiers: `0x0053B1D0` receiving creation element as an argument;
  `0x00539B80` caching a painter at construction; row 52 using one generic
  element; Plane Orb retaining the prior colored helper; or the current web
  view already rebuilding its orb children when selection changes.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same pinned image as the existing Staff submission and primary-spell reports. | high |
| Fresh canonical instructions | read-only Ghidra replica via the task Mod Loader wrapper; `0x0053B1D0`, all eight xrefs, `0x00539B80`, `0x00536C10`, `0x00537860` | Every draw resolves slot-12 selected primary (or actor override), dispatches pure IDs `8/16/24/32/40`, and drains row 52 through all `1000..1014` programs. Negative/default/80 draw no ordinary colored program. | high |
| Existing native asset catalogs | Mod Loader `native-content-inventory.json` and `native-atlas-consumers.json` | Air companion uses BadGuys `1836..1839`; Steam uses `2002..2007` plus core `110`; Crawling Shock's extra inline member is record `15`. | high |
| Existing durable ownership | this ledger's 2026-08-21 mixed quickbar, 2026-08-22 Staff submission/count, 2026-08-23 pulse/cadence, and 2026-08-24 atomic selected-skill entries | Selection can differ from creation element; protocol already publishes atomic selected identity, Weld build, Planewalker state, pulse phase, attachment pose, and lifecycle. | high |
| Current web causal trace | Website `799691a9`; `hub-actors.ts`, `native-element-vfx-view.ts`, Hub/Boneyard player-view caches, and strict protocol decoder | Both orb copies are constructed once from `player.config.element`. Their cache key is only tick/scale. The already-replicated selected-primary and Planewalker fields never reach the VFX planner. | high |

A new clean-stock desktop run was not required to identify the selector: the
instruction stream directly owns the state source, full jump table, program
order, color constants, and no-draw branches. Browser baseline reproduction is
the focused red test and pre-change Mac Chrome selection journey named below;
no Windows/WSL test is a completion receipt.

## System boundary and membership inventory

Native system: **selected-primary equipped-Staff element-effect program**, from
slot-12 mutation and temporary override through per-draw program selection,
authored painter rows/assets, existing Staff socket/pass/pulse composition,
replicated Hub/Boneyard presentation, restoration, suppression, and teardown.

| Member | Native source | Required disposition | Proof |
| --- | --- | --- | --- |
| direct Skill Book and compact/quickbar primary selection | `0x005D5600` to refresh; existing atomic web mutation | `verified-already-at-parity` | selection and cast reset tests remain unchanged |
| Ether `8` | `0x00539B80 -> 0x00535A30` | `exact-ported` | distinct selected-program row and live swap assertion |
| Fire `16` | `0x00539B80 -> 0x005360C0` | `exact-ported` | same |
| Air `24` | `0x00539B80 -> 0x00536380` | `exact-ported` | same |
| Water `32` | `0x00539B80 -> 0x005370D0` | `exact-ported` | same |
| Earth `40` | `0x00539B80 -> 0x005374C0` | `exact-ported` | same |
| learned Weld `1000..1009` | row `52` plus progression `+0x750` complete jump table | `exact-ported` | one table assertion per program, order, tint/alpha/scale, sprite family, and live representative |
| internal pure-build programs `1010..1014` | same fifteen-row table | `exact-ported` in pure planner; `out-of-system` at wire input because retail player acquisition does not expose them | table assertions preserve the native rows without broadening accepted protocol state |
| Plane Orb `80` while Planewalker is active | selected-primary default/no-draw branch; separate Plane Orb actor | `exact-ported` | colored orb hidden during override and restored afterward |
| unselected/negative and invalid/default IDs | `0x0053B228` and switch default | `exact-ported` | empty plan; strict protocol still rejects invalid positive wire state |
| both native Staff front submissions | five main-render xrefs and recovered pass gates | `verified-already-at-parity` | both copies consume the same selected program without changing call counts |
| Staff socket and `1 + 10*pulse` scale | `0x0053B261..0x0053B318` | `verified-already-at-parity` | current offsets/pass counts/pulse tests retained for every selected row |
| Wand and empty-hand helpers | `0x0053B321..0x0053B66B` | `out-of-system` (different emitter geometry; reported object is the equipped Staff orb) | existing no-Staff visibility gate remains explicit |
| Hub Courtyard/private-room player views | shared `PlayerWorldView` | `exact-ported` | local and remote snapshots swap without reconstructing robes |
| Boneyard player views | same shared view | `exact-ported` | local and remote snapshots swap during an active run |
| creation-element robe/hat/body art | separate player texture and equipment selectors | `verified-already-at-parity` | cross-element selection changes orb only |
| College-intro, death/spectator, no-Staff suppression | existing helper/visibility gates | `verified-already-at-parity` | no hidden program leaks while selection mutates |
| player replacement, disconnect, world reset, renderer destroy | player/session/view owners | `verified-already-at-parity` | no retained orb sprites survive the player view |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction path: PlayerWizard remains the root. Main and
  alternate renderers submit `0x0053B1D0` at the recovered Staff socket;
  the helper delegates actual selected-program choice to `0x00539B80`.
- Upstream state producers: slot 12 in `DAT_00819E84` for the ordinary
  actor, `PlayerWizard +0x21C` for an override, row 52's current build at
  progression `+0x750`, and Planewalker's saved/forced/restored selection.
- State representation and transitions: the selected ID is read on every draw.
  No element-painter pointer or creation-element cache survives a primary
  selection change.
- Downstream consumers: the five pure painters, fifteen row-52 programs,
  Staff/Wand/hand socket geometry, existing color-state stack, pass count,
  pulse scale, and player-root painter ordering.
- Entry/reset/teardown: negative selection and death suppress; Plane Orb has no
  ordinary colored helper; restore resumes the saved program; PlayerWizard/view
  destruction owns all nested sprites.

## Recovered behavioral contract

- Timing: selection and orb identity change at the same published selected-state
  boundary. The program's cosmetic phase remains the shared fixed-tick phase;
  selection does not restart or invent a wall-clock animation.
- Geometry/order: retain current attachment pose/socket and one/two front-copy
  program. Every selected-program draw stays nested in the Player root; body
  appearance and world sort do not change.
- Assets/randomness: pure painters retain their recovered deterministic browser
  projection. Weld programs preserve native call order, color/alpha/scale
  multipliers, Air companion, Steam `2002..2007`, core `110`, and
  record `15`. Cosmetic samples derive from fixed tick/program channels
  and do not advance gameplay RNG.
- Authority/replication: host-selected primary, Weld identity, and Planewalker
  state are already strict wire fields. Presentation consumes them directly;
  no protocol bump or client-local selection state is added.
- Failure behavior: sentinel/default yields an empty program. Do not fall back
  to creation element, because that recreates the reported stale orb.

## Nearby-system findings

- The earlier mixed-quickbar entry correctly moved cast cadence, Staff pose,
  projectile, audio, HUD, and Magic Trap to selected identity, but omitted the
  sibling equipped-element consumer. This reopening closes that skipped
  membership rule.
- Current `createPlayerCharacterDrawPlan` already separates creation
  appearance from selected cast pose. That separation is preserved.
- Reusable native program details are added to Mod Loader
  `native-items-equipment-and-loot.md`; no runtime architecture or wire
  topology changes.

## Confidence and open questions

- Confirmed: all helper xrefs, selected-state sources, pure and row-52 switches,
  fifteen authored programs, relevant asset rows, color/alpha/scale constants,
  no-draw branches, existing web cache fault, and scene/wire consumers.
- Inferred: none material.
- Unknown: none. Every member is representable in Pixi without a platform
  approximation.

## Web implementation consequence

- Correct owner/module: selected-program projection belongs beside
  `element-vfx-native.ts`; Pixi materialization stays in
  `NativeElementVfxView` and player attachment/passes stay in
  `PlayerWorldView`.
- Replace the immutable creation-element orb input with the current strict
  selected-primary program plus current Planewalker override. Include program
  identity in retained-view invalidation.
- Preserve creation element for robe/head/death/equipment textures and preserve
  all existing socket, pass-count, pulse, tint, and teardown behavior.
- Remove the creation-element fallback from Staff-orb presentation. No shim,
  protocol change, or whole-player reconstruction.

## Validation contract

- Focused red/green planner tests: all five pure IDs, ten learned Weld rows,
  five internal pure rows, Plane Orb/default/sentinel, exact member order,
  tint/alpha/scale, and asset family.
- Focused view tests: within one retained player view and fixed tick, change
  Ether to Fire to Water and prove textures/program change despite unchanged
  creation element, pose, socket, and player root; repeat Planewalker hide and
  restore.
- Integration/source contract: both Hub and Boneyard feed current selected and
  Planewalker state to both native Staff submissions; no config-element rebuild
  is used for orb identity.
- Mac Chrome journey: learn/select at least two primaries, swap in real Hub and
  Boneyard, inspect local and addressed-player program identities plus pixels
  before and after, verify body art is unchanged, and collect empty page,
  console, failed-request, and failed-response arrays. Strict wire tests and
  the branch-free shared `PlayerWorldView` cover remote participants.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the byte-identical
  Mac candidate.

## Implementation validation receipt

- `element-vfx-native.ts` now owns one selected-primary planner. Pure
  `8/16/24/32/40` rows dispatch their recovered painters; the complete
  `1000..1014` table retains native order, quarter-alpha Ether overlays,
  orange/gold Flame Lash, Air companion, Steam `2002..2007` with each
  record's extracted registration anchor, the two Earth programs, record-15
  Crawling Shock aura, and internal doubled-pure rows. Sentinel, Plane Orb 80,
  row 52 without a concrete build, and invalid defaults produce no ordinary
  colored plan.
- `NativeElementVfxView` keeps ordinary Create/Hall/Inventory element
  plans intact and adds an explicit selected-primary update lane whose retained
  cache key includes program identity. `PlayerWorldView` constructs both
  Staff submissions without a creation-element default and feeds current
  selected identity, or Plane Orb 80 while Planewalker is active, on every
  update. Robe/head/equipment textures still use `config.element`.
- Weld-only aura/Steam art lives in an explicit special texture bank; pure
  Hall/Inventory consumers reject those sprite families instead of widening
  their asset contract. Hub and Boneyard diagnostics expose both the local
  selected program and the complete addressed-player program map.
- The focused regression was red on the untouched implementation in the
  byte-identical Mac worktree: canonical validation reached
  `test:boneyard` and TypeScript rejected the absent selected planner,
  nullable program-less view, update method, and program getter. After
  implementation, all selected-primary and retained-view regressions pass,
  including all five pure rows, fifteen Weld programs, Plane/default/sentinel,
  same-tick Ether-to-Fire-to-Plane-to-Fire invalidation, both submission calls,
  and Planewalker override wiring.
- Final exact-tree Mac gate
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed: zero-warning
  backend build, 24 Website/backend contracts, formatting/lint/import
  boundaries, every frontend group including `1594/1594`
  Boneyard/game tests, five desktop tests, production frontend/game-host
  builds, bundle budget, and media policy. The production Game entry is
  `468795` raw / `130933` gzip bytes against
  `524288/134144`.
- Mac Chrome at `1600x900` ran the real Skill Book/compact-selector
  journey on the same worktree. One retained Ether-body player reported Hub
  Ether `8` with 21 visible orb sprites, Fire `16` with 3,
  restored Ether with 20, Boneyard Ether with 21, then Boneyard Fire with 3.
  Local and addressed-player program IDs agreed at every checkpoint; the
  authoritative character creation element remained Ether. Page, console, and
  network error arrays were empty.
- Visual inspection shows the same purple-robed Ether wizard carrying the
  magenta star/ray Ether orb in Hub and the compact orange flame/core Fire orb
  after Boneyard selection. Evidence hashes are
  `bb5eac105a3bbb6fbb7ebedb42d3f428a15570bb322f5c0c0fab8f8b07bd5fff`
  (Hub Ether) and
  `a69c6eb2cda893b923ea9203a1b7941e11b0750c71c908c8e372ca63fe0c8a26`
  (Boneyard Fire).
- The byte-identical Mod Loader report passed its complete portable static RE
  gate, `509/509`. No browser-platform exception or material unknown
  remains. The task is uncommitted and unpushed; deployment was not requested.
