# 2026-08-23 — Selected-spell HUD controls and compact loadout selectors

## Reported smell and parity question

- Reported web behavior: the selected spell emblem between the Health and Mana
  bars is visual only. Clicking it does not enter the stock spell/concentration
  swap interaction and may instead reach the gameplay pointer path.
- Stock behavior to recover: the selected primary and each occupied
  concentration emblem are separate HUD buttons. They open compact learned-row
  selectors, replace the addressed primary/A/B binding, suspend local input,
  and close on selection or outside click.
- Reproduction inputs/scenes: primary-only, primary+A, and Split Mind A+B HUDs
  in Hub and active Boneyard; primary, A, and B clicks; outside cancel; pure and
  Weld primaries; every concentration; Plane Orb and Mind Chug gates.
- Falsifiers: opening the full Skill Screen, using one generic concentration
  replacement cursor for both HUD icons, displaying acquisition order instead
  of native row order, permitting a duplicate A/B concentration, allowing the
  click to cast, or mutating loadout state client-side.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Stock behavior | user-reported retail comparison, 2026-08-23 | Clicking the top-center spell icon opens the stock swap surface rather than casting. | high for the reported entry behavior |
| Retail identity | unmodified `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same 0.72.5 image as the owned HUD, SkillScreen, progression, and audio corpora. | high |
| Read-only instructions | canonical Ghidra replica; `0x005CBA00`, `0x005C7200`, `0x005D50E0`, `0x005D76C0`, Game vslot `+0x10 -> 0x005D8120`; selector `0x00657A70/0x0066F0B0/0x0066F330/0x00659AD0/0x00658DC0`; modal `0x004281F0` | Fixes Game ownership, all three button fields, dynamic rectangles, option membership/order, slot-specific clearing, modal geometry, pointer cancel, and teardown. | high |
| Static data/audio | skill rows `0..82`; Skills records `27..122`; Fonts group `93..184`; audio registry offsets `+0x18` and `+0x304` | Fixes full primary/concentration membership, exact icons/font, `click`, and `concentrate`. | high |
| Current web trace | `GameHud`, `native-hud-presentation`, `SkillBook`, `MainMenuScene`, Hub/Boneyard scenes, protocol 61/session/host | Emblems render exact records/centers but have no hit target; only tome/`K` opens SkillBook; concentration messages carry no addressed slot. | high |

No injected process or runtime address is used. All executable addresses are
preferred-image virtual addresses from the canonical read-only project.

## System boundary and membership inventory

Native system: `Game`'s selected-skill HUD controls and the transient
`Skills_Quickbar` learned-category selector, from reverse-z pointer ownership
through actor-private authoritative binding mutation and modal teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| selected-primary binding 12 button | Game `+0x3AC`, `0x005D8120` | exact-ported | `40 x 65` hit/action and primary selector tests |
| concentration-A binding 16 button | Game `+0x46C`, `0x005D8120` | exact-ported | addressed slot-A option/mutation tests |
| concentration-B binding 20 button | Game `+0x52C`, `0x005D8120` | exact-ported | Split Mind/addressed slot-B tests |
| zero/one/two-concentration hit layouts and HUD-hide offset | `0x005D50E0`, `0x005C7200`, `0x005D76C0` | exact-ported | per-layout rectangle assertions |
| reverse-z click ownership and world-cast swallow | common router `0x00428620`, Game children `0x005CBA00` | exact-ported | pointer journey plus stopped-input assertion |
| pure primaries 8/16/24/32/40 | category-1 rows | exact-ported | table-driven selector membership |
| Spell Welding 52 and builds 1000..1009 | category-1 row/build icon table | exact-ported | every build icon option assertion |
| persisted Game `+0x1668` row-exclusion bytes | constructor zero, `0x005C7AB0` raw native state import/export, selector read | out-of-system (Website does not ingest raw native Game saves and has no producer for this array) | all supported web sessions use the native zero/default branch |
| Plane Orb 80 temporary primary gate | `0x005D82A3` | exact-ported | no-open/swallowed-click branch |
| concentrations 57..63 and 65..71 | category-3 rows | exact-ported | fourteen-row selector membership |
| opposite-slot exclusion and duplicate rejection | `0x005D83C1`, `0x005D84B3`, `0x0066F0B0` | exact-ported | A/B option and strict protocol tests |
| no Split Mind / empty A / empty B / full A+B replacement | `0x005D8409..0x005D8440`, `0x005D8516..0x005D8533`, `0x005D5600` | exact-ported | every slot/capacity transition |
| Mind Chug mutation lock | progression `+0x828`, `0x005D5703` | exact-ported | rejection/no-feedback test |
| selector title, black panel, medium bitmap font and full-alpha icons | `0x0066F330` | exact-ported | deterministic render-contract assertions |
| strict option and outside-cancel hit tests | `0x00659AD0` | exact-ported | pointer option/cancel tests |
| open/primary-select click and concentration click+concentrate audio | `0x005D82D7`, `0x005D8389`, `0x005D8481`, `0x005D5686`, `0x005D57EF` | exact-ported | ordered audio assertions |
| local suspension, close, interruption, teardown | `0x0066F0B0`, `0x004281F0`, `0x00658DC0` | exact-ported | source-qualified pause/close tests |
| Hub and Boneyard consumers | shared Game HUD owner | exact-ported | both-scene browser journey |
| SkillScreen primary card selection | `0x00674110` category 1 | verified-already-at-parity | retained primary card action |
| SkillScreen category-3 cards | `0x00674110 -> 0x005D5600` | verified-already-at-parity | non-draggable click seeds A or uses the general replacement cursor |
| Settings primary/concentration rows | prior ownership inference | out-of-system (the rows never belonged to `MyCPanel`; `0x005D8120` is a Game vslot) | native report and Website historical ledger correction |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction: `Game` embeds and registers the three `UIButton`
  children. HUD paint remains in `0x005D2520`; button state is not React-local
  decoration in native.
- State producers: authoritative learned/effective ranks, selected primary,
  concentration A/B, Split Mind, active Weld build, Plane Orb override, Mind
  Chug, viewport width, and HUD reveal offset.
- State transitions: click -> registry-0 cue -> synchronous selector modal ->
  option or `-1`; primary writes the selected row; concentration pre-clears the
  clicked slot then runs the shared category router; accepted A/B selection
  plays click then concentrate.
- Downstream consumers: progression refresh, HUD emblem resolver, casting and
  concentrated gameplay, save checkpoint, replicated snapshot, and audio.
- Siblings: SkillScreen category-1 direct selection remains valid; category-3
  card clicks seed the first concentration and retain the general Split Mind
  replacement cursor, while occupied HUD A/B buttons target an exact slot.
- Entry/teardown: selector exists only during active gameplay, owns the local
  suspension depth, cancels on outside/Back/interruption, and releases without
  a catch-up tick or leaked pointer edge. Hub-to-Boneyard placement preserves
  A/B and the replacement cursor; post-run loadout reconstruction clears them.

## Recovered behavioral contract

- Every HUD action rectangle is `40 x 65`, normally top `-7`, centered on its
  emblem. Centers are primary `800`; primary/A `780/820`; and primary/B/A
  `760/800/840`.
- The primary button is inert but still pointer-owning during Plane Orb. A/B
  buttons exist only for occupied slots; B requires Split Mind.
- Selector options are learned positive-rank rows in ascending numeric ID,
  category `1` or `3`. A selector excludes current B; B excludes current A.
- Each option cell is `52 x 52`, centered as one strip at `y=100`. The panel is
  centered at `x=800`, top `52`, height `79`, and width
  `max(52 * optionCount, titleWidth) + 10`.
- The title baseline is `69`, medium bitmap font, RGBA
  `(0.85,0.73,0.44,0.75)`. The panel is black alpha `0.95`; icons are authored
  Skills records at white/full alpha.
- Outside click or Back closes silently. Open and accepted primary play
  `sounds\\click`; accepted concentration plays `sounds\\click` followed by
  `sounds\\concentrate` at gain/pitch one.
- The browser host authenticates the actor and target slot, validates active
  phase/pause owner/rank/category/Weld/Split Mind/duplicate/Mind Chug, applies
  the mutation, stops queued input, publishes a snapshot, and checkpoints.

## Nearby-system findings

- The earlier `SettingsControl_HandleAction` name is disproved by the class
  catalog: `0x005D8120` is `Game::vftable +0x10`; `MyCPanel::vftable +0x10` is
  `0x00434C60`. The 2026-08-21/22 Settings entries misattributed three HUD
  controls as Settings rows. Removing Website loadout mutation from Settings
  remains correct, but it is now native parity rather than a product deviation.
- Durable native reports updated: `native-hud.md`,
  `native-skill-screen-and-quickbar.md`, `native-progression-and-skills.md`,
  `native-gameplay-pause.md`, `native-settings-system.md`, and the class catalog.

## Confidence and open questions

- Confirmed: owner/vtable, three fields, registration, every layout branch,
  exact dimensions/centers, category/row order, opposite-slot exclusions,
  primary/Plane Orb and A/B/Split Mind/Mind Chug branches, renderer geometry,
  fonts/icons/colors, audio identities/order, pointer cancel, suspension, and
  teardown.
- Inferred: none material.
- Unknown: none. Browser focus support can be additive semantic access while
  pointer geometry and visible presentation remain native.

## Web implementation consequence

- Keep icon resolution and centers in `native-hud-presentation`; add the exact
  `40 x 65` semantic buttons in `GameHud` and route binding 12/16/20 through one
  scene-independent selector owner.
- Add a compact `HudSkillSelector` with a WebGL native-font/icon renderer and
  transparent semantic `52 x 52` option buttons. Do not open `SkillBook` as a
  substitute.
- Retain category-1 and category-3 SkillScreen click routing; category 3 remains
  non-draggable. Add the compact HUD selectors as a sibling, not a replacement.
- Protocol 63 adds a distinct addressed-slot concentration command beside the
  retained general SkillScreen command and a source-distinct `skill-selector`
  pause owner. Do not infer HUD A/B from arrival order or authorize the command
  from a full SkillScreen pause.
- Add exact `concentrate.wav` as audio registry member 17 and fire cues only at
  the recovered lifecycle edges.

## Validation contract

- Focused contracts: all hit layouts; every pure/Weld primary; every
  concentration; numeric option order; A/B exclusions and exact replacement;
  Split Mind, duplicates, Mind Chug and Plane Orb; panel/title/icon geometry;
  click/concentrate order; protocol decoding/rejection; pause ownership and
  teardown; SkillScreen category branches.
- Mac full gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  candidate tree, plus Mod Loader `python3 tests/re/run_static_re_tests.py --ci`.
- Browser: Mac Chrome/WebGL2 clicks primary, A, and B in Hub, cancels outside,
  selects a different primary and both concentration slots, enters Boneyard,
  repeats the selector, verifies stopped movement/cast beneath it, captures the
  panel, and records empty page/console/failed-response arrays.
- Stock comparison: match control/option rectangles, visible option records and
  order, final binding state, and ordered audio requests to the preferred-image
  contract above.

## Implementation validation receipt

- Implementation: `GameHud` owns three exact action rectangles;
  `HudSkillSelector` and its WebGL renderer own the compact modal; protocol 63
  separates the general SkillScreen command from addressed A/B replacement and
  its `skill-selector` pause source; the host remains authoritative; the exact
  stock `concentrate.wav` is pinned and reproducibly extracted.
- The first Mac browser pass exposed that Hub-to-Boneyard placement rebuilt
  `PlayerSkillRuntime` with null A/B. That shared reset now preserves only the
  selected concentrations and replacement cursor for this scene transition;
  the real post-run loadout boundary still clears them. The transition has a
  deterministic regression and the original browser failure no longer
  reproduces.
- Exact candidate paths are local
  `/home/user/.codex-worktrees/solomon-website-hud-spell-picker-20260823-root`
  and `/home/user/.codex-worktrees/solomon-loader-hud-spell-picker-20260823-root`,
  with Mac mirrors under
  `/Users/jarrett/codex-acceptance/hud-spell-selector-20260823/`. The pre-receipt
  manifests matched byte-for-byte across 42 Website and 11 Mod Loader files.
- Mac Website gate r3 passed backend build/integration and formatting, lint and
  architecture boundaries, frontend suites `4/44/249/1414/6/61/9/43/12/7/36/23`,
  desktop `5/5`, production TypeScript/Vite/game-host build, bundle budget, and
  media policy. `Game-B_DDC9XZ.js` was `437025` raw / `122982` gzip bytes under
  `524288` / `131072`; log SHA-256
  `7c1e591251027589e0f185e1b15de111c9ae11dd8e4d4831666bc70422aed514`.
- Mac Mod Loader static RE r3 passed `495/495`; log SHA-256
  `a779047082ae6895277464b6b7a966ed328440b483f25b9385523120eff7da04`.
- Mac Chrome/WebGL2 r5 passed SkillScreen first-A seeding, primary/A/B compact
  selectors in numeric order, exact `40 x 65` HUD rectangles, outside cancel,
  Plane Orb no-open, Hub-to-Boneyard A/B preservation `[59,57]`, Boneyard
  selection, and no movement/cast leak. Audio requests were open `click`,
  primary accept `click`, and concentration accept `click -> concentrate`, all
  at playback rate/gain one. Page, console, and failed-response arrays were
  empty; log SHA-256
  `4374f481228d6167dd72ed4e55604b4af959ac06232457a16de7cc69e9387364`.
  Reviewed Hub/Boneyard selector captures have SHA-256
  `d1665e2eddfd21de70f231072c10c4026ab94314acbaa505278842018d1104a5`
  and `558df03960586d96693cb36f3964d79833c71dbab02f49df7f05e6a81aaff1fd`.
- No member is blocked by the browser platform and no material unknown remains.
  Commits are retained on the two focused local branches; push and deployment
  were not authorized and were not performed. Task acceptance worktrees and
  the evidence named above remain retained for review.
