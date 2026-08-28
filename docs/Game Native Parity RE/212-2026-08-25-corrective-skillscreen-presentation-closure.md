# 2026-08-25 — Corrective SkillScreen presentation closure

## Reported smell and parity question

- Reported web behavior: the Skill Book “looks goofy.” The settled web frame
  shows full wizard statues inside the upper leather field, tiny bright title /
  help copy, hard rectangular per-skill cards, a fixed oversized tooltip over
  the instructions, and a bright numbered belt.
- Stock behavior to recover: the complete optional actor-owned `SkillScreen`
  renderer family—not only its page-region overlay—including root chrome,
  ambient seal motion, dependency-page panels, every row/frame/font variant,
  the shared `HoverBox`, live eight-slot HUD rendering, both gameplay scenes,
  and the 40-tick lifecycle.
- Reproduction inputs/scenes: fresh Ether/Arcane Hub SkillScreen, hover Call
  Leviathan, duplicate Call Leviathan into a second belt slot, mixed
  pure-primary/concentration/Weld pages, wrapped dependency pages, then repeat
  in Boneyard at `1600 x 900`.
- Falsifiers: a separate card background per dependency row, Skills record `5`
  stretched beyond `87 x 88`, whole top statues, body/medium fonts for the root
  instructions, a fixed six-property tooltip, missing CFG `mBonus` lines,
  static ambient arcs, scene-owned copies, or unique-only quickbar bindings.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | unmodified retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Mod Loader/tests/fixtures/webgame/menu-reference-captures/skill-screen.png` SHA-256 `5b2423d5daf56e6bb5d154dd2ce0abc80d947286f087c8f81134b01686bb1c87`; duplicate-belt capture SHA-256 `e934a18512ef5ed92753be150f5a37e5182751c8ed25644f5030a5d63b87f05d` | partial off-screen top ornaments, menu-sized gray copy, soft root-tinted page panels, muted live belt, and duplicate-slot result | high |
| Current Mac web | retained Chrome/WebGL2 receipts from Website `981fec5a6888af5b714456e9a5ce7762c6f2735c`: `/Users/jarrett/codex-acceptance/solomon-skill-book-mac-981fec5-tooltip.png` SHA-256 `4bec1635aaf9481e8913bcc53320130b6742b0f887d4218046bac4e0d5eafbd2` and mixed quickbar SHA-256 `af5ce43440854b694c65330882b8b5b04c177343dc0e95a79d31cd29332bade3` | reproduces the large top statues, small copy, hard stretched frames, fixed tooltip, and bright numbered belt | high-live |
| Root instructions | canonical read-only Ghidra replica, `SkillScreen` vtable `0x0079F72C`; root `+0x0C -> 0x0065B550`, overlay `+0x28 -> 0x0065BEF0`; preferred image base `0x00400000` | the earlier pass stopped at the overlay and omitted the true root; fixes all root records, transforms, fades, motion, field clipping, and live-HUD call | high |
| Page instructions | builder `0x0066B380`, page render `0x006720F0`, open/hits `0x00673EE0`, Welding helper `0x00671810` | one page-wide Skills `0` panel; exact selected/unselected alpha; records `13/164`, `5/14`, `6`, authored icons, +4/+4 shadow, and font ownership | high |
| Hover instructions/data | `HoverButton +0x98 -> 0x00656CE0`; `Skills_Wizard +0xA4 -> 0x0066B990`; formatter `0x0065D7F0`; bonus formatter `0x0065DEF0`; `HoverBox` `0x005C38F0/0x005C3A60/0x005AB060`; 72 public CFG rows in `native-skill-catalog.json` | shared vertically flipping box, 50 source gap, 25 margin, authored `mStats` and category-3 `mBonus` order, exact D/F/X/N formats and ExactText commands | high |
| Asset/font data | `native-ui-assets.json`, Skills/UI/Fonts atlases and `native-asset-object-map.json` | UI `3,4,10,30,31,32,33,49,71`; Skills `0,5,6,13,14,27..122,164..165`; Fonts groups `0,1,3,5` plus live-HUD group | high |

The static project/program is the canonical
`Decompiled Game/ghidra_project/SolomonDark.gpr` / `SolomonDark.exe` retail
image above. No injected runtime conclusion is promoted here. A loader sandbox
launch attempted during investigation did not advance past its initial dialog;
its pixels and empty semantic snapshot are explicitly excluded from evidence.

## System boundary and membership inventory

Native system: **optional actor-owned SkillScreen presentation**—the root and
overlay render passes, dependency pages, row variants, shared contextual
HoverBox, live belt/HUD composition, input/lifetime edges, and Hub/Boneyard
consumers. Progression offer mechanics and the compact selected-skill selector
remain sibling systems already closed separately.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| opaque root curtain and opening/closing alpha | `0x0065B550`, `0x006567E0` | exact-ported | render-contract alpha assertions and 40-tick browser edges |
| eight UI.3 ambient seal members | `0x0065B550` loop | exact-ported | count, shared centre/scale, 45-degree spacing, jitter envelope, and live frame phase |
| left/right UI.33 top flourishes | `0x0065B830..0x0065B892` | exact-ported | exact two centres and +/-90-degree transforms |
| left/right UI.31 partial top wizards | `0x0065B89D..0x0065B8FB` | exact-ported | exact centres and left mirror; reviewed crop excludes whole in-field statues |
| left/right UI.30 bottom masonry | `0x0065B900..0x0065B958` | exact-ported | exact edge centres |
| left/right UI.32 bottom warriors and clip | `0x0065B9D5..0x0065BA8E` | exact-ported | exact `80`-pixel clip, centres, and right mirror |
| page-region leather and black top/bottom fades | UI.49 and `0x0065BAA4..0x0065BD6D` | exact-ported | fixed `(0,50,1600,760)` black-composited field prevents pre-field fixture bleed through semitransparent atlas texels |
| UI.10 chains, UI.71 endcaps, UI.4 title backing | `0x0065BEF0` | exact-ported | exact record/position inventory and stock-crop comparison |
| `SKILLS`, mouse help, touch help, belt help | `0x0065BEF0`, Fonts group 3 | exact-ported | copy, menu font, RGB `(0.5,0.5,0.5)`, settled help alpha `.75`, pointer-mode branch |
| page construction and wrap for every public row `8..79` | `0x0066B380`, `0x0065E670` | exact-ported | complete 72-row, shared-dependency, duplicate-membership and row-wrap matrix |
| unselected root-tinted page panel | `0x006720F0` | exact-ported | Skills.0, inset 12, alpha `.1`, one additive edge pass |
| selected primary/concentration page panel | `0x00672150..0x006723CE` | exact-ported | first selected row ownership, alpha `.5`, second additive pass |
| root row and every dependent row | `0x006720F0` | exact-ported | centres `100,280,+160`, Skills.13/164 scale `1.15`, record-6 connector |
| ordinary/passive frame | row action byte `+0x32 == 0` | exact-ported | Skills.5 natural `87 x 88` assertion |
| actionable primary/secondary/concentration frame | row action byte `+0x32 != 0` | exact-ported | Skills.14 natural-size assertion across all categories |
| first selected primary/concentration frame and label | `0x00672795..0x00672981` | exact-ported | Skills.5 tint `0x97c797`, recovered from source RGB `(.25,1,.25)` blended `.75` toward luminance, alpha `1`, plus group-0 source `casting` / `concentrate` small caps |
| ordinary icon rows `27..122` | row icon byte `+0x30` | exact-ported | full icon domain and opaque black `(+4,+4)` shadow |
| Spell Welding row 52 and builds `1000..1009` | `0x00671810` | exact-ported | all ten split-root glow/icon/name/description variants |
| name/family/quick-description/category footer | `0x006738C7`, `0x00673996`, `0x00673E06`, `0x00673A2D` | exact-ported | Fonts groups `1/5/1/0`, rank suffix, original-case `FUN_0043D030` wrap at `140`, native line restart/no-break `PLANEWALK-\nER`, shadowless quick description, and dynamic name/description heights |
| shared HoverBox construction/layout/render | `0x00656CE0`, `0x005C38F0`, `0x005C3A60`, `0x005AB060` | exact-ported | opaque black/native edge, 25 margin, 50 source gap, above/below flip and viewport clamp |
| tooltip ordinary rank/title/category/description | `0x0066B990` | exact-ported | case-preserving lines, native scaled rank suffix, every public row |
| tooltip boosted and item-granted effective-rank branches | `0x0066BB0D..0x0066BC33` | exact-ported | both `BOOSTED` / `GRANTED BY ITEM` branches |
| tooltip `mStats` rows and D/F/X/N formats | `0x0065D7F0`, all 72 CFG rows | exact-ported | authored order, literal percent, 0/1/2-decimal and conditional-N fixtures |
| tooltip concentration `mBonus` | category-3 predicate `0x0067BEE0`, `0x0065DEF0` | exact-ported | all fourteen category-3 bonus arrays and inline ExactText directives |
| eight live BeltButton slots, empty/occupied/duplicate/replacement | `0x005C8740`, `0x005D3E10` | exact-ported | muted native frame/key treatment, every slot, duplicate state and one-slot replacement |
| drag target and SkillDragger | `0x00656980`, `0x006564A0` | exact-ported | natural held icon, threshold, target highlight, accepted/rejected release |
| Hub consumer | gameplay `+0x1664`, opener `0x005CA640` | exact-ported | HUD/key open, hover, drag, close, input block browser journey |
| Boneyard consumer | same gameplay/actor screen owner | exact-ported | matching settled composition and state-survival journey |
| open, close, Inventory handoff, interruption and teardown | `0x0067CAC0`, `0x006568E0`, `0x0066B200` | exact-ported by the 2026-08-28 reopening in ledger 115 | 40-tick overlap, silent open, one `openpanel` close cue, reciprocal replacement, no input leak |
| runtime-only 80, reserved 81, allocated reserve 82 | public learned-vector/page admission | out-of-system (no public SkillPage producer) | existing complete row-domain test |
| mandatory SkillPicker and compact HUD selector | separate native modal owners | out-of-system (already closed sibling systems) | their render/authority suites remain unchanged |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction path: gameplay owns one `SkillScreen*` at `+0x1664`.
  `0x005CA640 -> 0x006576C0` constructs the actor-addressed screen. Vtable
  `+0x0C` renders the true root; vtable `+0x28` renders the page-region overlay.
- Upstream state producers: actor learned-vector order; row dependencies,
  category/action/icon/root; permanent/effective ranks; selected primary and
  concentration A/B; active Weld build; eight BeltButton entries; render frame
  counter; pointer mode; screen open/close progress.
- State representation and transitions: `closed -> opening -> settled ->
  closing -> destroyed`, `+/-0.025` each 10-ms native tick. Page selection is
  the first row, in page order, matching primary first then A/B. Hover owns a
  transient `HoverBox*` at `HoverButton +0xB8`; leaving/replacing the target
  destroys it. Drag owns a transient `SkillDragger`.
- Downstream consumers: root/background painter, page painter, shared
  HoverBox, BeltButton painter, authoritative primary/concentration/belt
  mutation, save/checkpoint, and gameplay input suppression.
- Siblings: Inventory shares optional-book admission and the live HUD painter;
  LevelupScreen shares Skills.0/5/13/164 but is not a SkillPage; trader/item
  inspection shares HoverBox layout/render but has different line builders.
- Entry/reset/teardown: Hub and Boneyard address the same actor owner; `I`/`T`
  handoff is mutually exclusive; screen close is silent; teardown destroys all
  pages, buttons, hover/dragger state, and releases the local suspension depth.

## Recovered behavioral contract

- Timing: black root alpha follows open progress; page/overlay uses cubic and
  higher-order native fades. At settled state the eight seal members remain
  animated; they do not freeze when React state settles. Open/close remains 40
  fixed ticks with no audio.
- Geometry: full root is `1600 x 900`; page region `(0,50,1600,760)`; page
  `200 x 300`, +160 per dependent; wrap threshold `1590`; row centres
  `100,280,+160`; icon/hit frame `87 x 88` centred at local y 80.
- Render order: curtain -> seal ambient -> top/bottom authored fixtures and
  clipping -> field/fades -> chains/title/help -> root-tinted page panels ->
  row aura/glow/frame/icons/text -> live belt/HUD -> transient HoverBox /
  SkillDragger.
- Assets/fonts: exact membership is listed above. No per-row nine-slice made
  from Skills.5, rounded browser primitive, OS font, white universal help copy,
  or fabricated tooltip property order is permitted.
- Input/authority: transparent React hit targets may route pointer, keyboard,
  focus, drag and close semantics, but all loadout mutations remain
  authenticated host commands. Hover is presentation-local and immediate.
- Boundary behavior: shared dependencies may repeat on multiple pages; the
  first selected row determines page emphasis; duplicate quickbar IDs remain
  legal; touch replaces only the first help verb with `TOUCH AND HOLD`.

## Nearby-system findings

- The earlier report's direct-root membership was incomplete and partly
  misassigned. UI.33 owns the top flourish and UI.71 owns rail endcaps; UI.31
  and UI.32 are not interchangeable corner decorations.
- `HoverButton +0x98` proves SkillScreen uses the same concrete HoverBox class
  as shops/perks. The correct web seam is shared layout/render ownership with a
  Skill-specific line builder, not a second tooltip visual language.
- CFG `mStats` and `mBonus` are already present in the Website's immutable
  native skill catalog. The old tooltip ignored both authored arrays despite
  their being fully extractable.
- Durable native report updated:
  `Mod Loader/docs/reverse-engineering/native-skill-screen-and-quickbar.md`.

## Confidence and open questions

- Confirmed: class/vtable ownership, root/overlay split, all root/page/hover
  functions, complete asset/font membership, transforms, clips, settled
  alpha/tints, page selection, row geometry, icon shadow, all CFG tooltip
  lines/formats, quickbar cardinality, scene/lifecycle ownership, and stock /
  current-web visual discrepancy.
- Inferred: none material. Browser semantic focus is additive and invisible.
- Unknown: none. Presentation-local random seal jitter is reproduced inside
  the recovered 40-pixel native envelope; stock does not promise a cross-run
  RNG-identical frame.

## Web implementation consequence

- Add a pure SkillScreen render contract for root chrome, page panel/selection,
  row/frame/font variants, and the complete tooltip line formatter.
- Split the renderer into persistent root/ambient/chrome/content/HUD/hover
  layers. `render(nowMs)` updates the ambient members while
  `setPresentation(...)` rebuilds state-owned content.
- Replace the stretched per-row Skills.5 nine-slice and fixed purple/gray
  primitives with one Skills.0 page panel using the root tint and exact
  selected/unselected/additive passes.
- Add Skills.13, correct icon shadow/frame colors, and exact font groups.
- Replace the fixed six-stat tooltip with the shared HoverBox geometry and all
  catalog-authored `mStats` / `mBonus` lines. Remove the obsolete helper and
  its guessed label table.
- Replace the bright numbered belt treatment with the muted live-BeltButton
  composition while retaining the existing strict actor-authoritative command
  path and transparent hit targets.

## Validation contract

- Focused pure tests: exact root records/centres/angles/clips/fonts/tints;
  page-wide record-0 panel and selected/unselected passes; every row/action /
  selected/Weld variant; every icon and font group; all 72 `mStats` arrays;
  all fourteen category-3 `mBonus` arrays; D/F/X/N/percent/ExactText parsing;
  HoverBox flip/clamp; eight slot states and duplicate replacement.
- Focused render/integration coverage and browser pixels: no stretched Skills.5
  nine-slice, per-row rounded background, fixed top tooltip, or substitute stat
  line presentation remains.
- Mac full gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  Website candidate tree.
- Mac Chrome/WebGL2: matching `1600 x 900` fresh Ether frame, hover primary and
  secondary, mixed primary/concentration/Weld pages, dependency chain/wrap,
  duplicate drop, Hub/Boneyard, open/close/handoff, touch-copy branch, and
  empty page/console/failed-response arrays.
- Stock comparison: reviewed crops must match partial top fixtures, menu-sized
  gray copy, page panel silhouette/tint, icon frame/shadow, HoverBox placement,
  and muted unnumbered belt. Structural pixel masks exclude only the stock
  presentation-local seal jitter phase.

## Implementation validation receipt

- The clean detached Mac candidate containing the complete source change passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` with the pinned Node
  `22.17.0` / npm `10.9.2` toolchain. The gate completed the backend build and
  22 integration contracts, backend formatting, frontend lint and generated
  contracts, every frontend suite including the 1,549-test Boneyard group and
  all eleven Skill Book checks, desktop tests, production build, media policy,
  and the game bundle budget (`471608` raw / `132295` gzip bytes).
- The historical 2026-08-25 receipt recorded a matching read-only external RE
  snapshot at `35d0941d6baad59dd7c46907a39d2ba6e6072c09`; that snapshot is provenance,
  not a maintained Website validation gate.
- Mac Chrome completed `npm run smoke:game:skill-book` at `1600 x 900` with
  WebGL2, duplicate Call Leviathan slots, mixed primary/concentration state,
  Hub and Boneyard selector paths, and empty console, page, and failed-response
  arrays. The final settled, tooltip, and mixed screenshots have SHA-256
  `c2dd81e0c025358fa97dc2e5bad5c535f921fcc64a0ef9c1ae465a39134241b9`,
  `1f29324446a2e4eae786c4e5ed41d55fd894bf573425d67aeebe007cd58d47ab`,
  and `de3c5daeeada89b39c2863c52011a62593527f96d3833968042ac7bc98f4d74a`.
- The settled frame was reviewed directly against stock
  `5b2423d5daf56e6bb5d154dd2ce0abc80d947286f087c8f81134b01686bb1c87`.
  Root fixture clipping, title/help baselines, page geometry and tint, icon
  frames/shadows, original-case wrapping, selected treatment, and the clipped
  live HUD align. The presentation-local seal phase is intentionally excluded
  from cross-run structural equality. No member is browser-blocked; deployment
  remains a separate operation outside this validation.
