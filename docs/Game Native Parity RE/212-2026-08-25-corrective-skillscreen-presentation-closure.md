# 2026-08-25 — Corrective SkillScreen presentation closure

## 2026-09-27 — Report 47: inline skill-stat unit typography reopening

The edited report identifies the damage and mana-cost `/ second` suffixes in
Frost Jet's level-up detail box. Its preserved 861-by-805 screenshot shows
the small units drawn across the `5.5` and `18.50` values. This is a separate
failure from Report 33's outer HoverBox width: the box contains the ink, but
two runs within each stat line overlap.

### Evidence and causal trace

| Evidence class | Source | Observation | Confidence |
| --- | --- | --- | --- |
| Reporter image | `2026-09-25/47-level-up-stat-text-misaligned/attachments/1553073787686355174__image.png`, SHA-256 `3980bb9d5956b77c01f81b42db6d8a9a8a08ee033a7ebd663782b4c710f782e1` in the retained report archive | Frost Jet rank three has overlapping damage and mana-cost suffix ink. | high, visual |
| Authored data | tracked `native-skill-catalog.json`, Frost Jet row 32 and complete public-row sweep | Both strings append `_s(.7)_o(0,1)_i / second`; 19 catalog rows contain 25 stat/bonus lines with this same inline command family. Multi-rank titles use the same scale/offset parser. | high, static |
| Retail instructions already recovered | 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; entry 287 `ExactText_Render 0x0043AFC0 -> Glyph_Draw 0x004143D0`; entry 212 HoverBox `0x005C3A60` | The shared native pen advances glyph by glyph and applies italic to glyph geometry; skill detail uses this ExactText owner. No fresh stock runtime recording is claimed. | high, instruction-derived |
| Current Website reconstruction | published base `8ecf4f8b`; Chromium 150 WebGL probe on WSL at 1600 by 900; task-only Frost Jet rank-three render probe | Damage suffix starts 29.68 pixels before the value's ink ends; mana suffix starts 32.54 pixels before it ends. `native-skill-hover-box.ts` measures a logical run advance, then skews the entire suffix container around its stage origin; its child glyphs have no italic skew. The large local Y coordinate shifts the whole suffix left. Baseline image SHA-256 `696b9f6ec21ca79d12120e56d3adbfacedde0e08a723fce3b022cd3187a8b933`. | high, live/static |

The earlier presentation pass ported the shared HoverBox and text commands but
skipped the final glyph-transform ownership: a Pixi container skew is not a
native per-glyph italic. Report 33's frame-containment probe could pass while
two runs on one line still collided. The existing `nativeUiPixiFor(...).textRuns`
already implements the recovered continuous pen, run scale/offset, and
per-glyph italic; the skill painter hand-rolls those operations instead.

System boundary: the shared SkillScreen/LevelupScreen skill-detail ExactText
painting path from catalog semantic lines through command runs to glyph ink.
The same box painter serves Hub and Boneyard SkillScreen hover and the
LevelupScreen's read-only desktop/touch detail extension. It owns painted
line layout and teardown, not skill progression, offered choices or authority.

| Member | Final disposition | Proof |
| --- | --- | --- |
| Frost Jet's two rank-three stat suffixes | `exact-ported` | Exact built desktop/touch browser captures show the small italic units following their values; the browser render probe finds positive native ink gaps. |
| All 19 authored styled stat rows (25 lines), including other per-second units | `exact-ported` | One shared painter and 148 rank/row inline browser cases have zero failures; no item-specific offsets remain. |
| Multi-rank title suffixes and other command runs | `exact-ported` | The same continuous pen preserves parsed scale/offset commands; 422 rendered cases retain title/rank order with zero frame overflow. |
| HoverBox semantic line builder, 380/400 wrapping and box geometry | `verified-already-at-parity` | Report 33's width and overflow checks remain green. |
| Hub/Boneyard SkillScreen, LevelupScreen detail, desktop/touch and teardown | `exact-ported` | Both scenes and menus call the same corrected painter; exact built desktop/touch LevelupScreen journeys, a current Hub SkillScreen capture, the 422-case render/retirement sweep, and Report 33's earlier Boneyard book acceptance cover the scene/lifecycle membership. |
| Other native UI text consumers, item/shop/dialogue boxes and gameplay authority | `out-of-system` | Different text producers/painters; no catalog or simulation mutation. |

The falsifying acceptance is a real Frost Jet rank-three render with positive
suffix-to-value ink gaps on both lines, followed by the complete styled-row
render sweep, the mandatory picker and optional book journeys, and the WSL
canonical Website gate. A change to generic glyph metrics or a Frost-only
spacing constant would contradict the recovered ownership.

Implementation preflight: the skill painter now submits each parsed line to
the existing shared `textRuns` glyph path instead of skewing each suffix
container. The WSL browser render check failed before that change on all 148
styled cases; afterward it painted 422 public-row/build cases and 59,116 glyphs
with zero frame overflows, zero inline failures, and no retained children.
Thirty-nine focused typography/skill tests, lint, and production build passed.
The built Hub LevelupScreen displayed rank-three Frost Jet on desktop and
touch; both screenshots were inspected, the detail remained read-only and
silent, and page/console/response errors were empty. The shared SkillScreen
painter also reached a real Hub Call Leviathan tooltip in a separate browser
journey. That broader book smoke later timed out in its two-second belt
pull-off effect wait, after the relevant tooltip capture; this is not recorded
as a complete book-journey pass. Earlier Report 33 acceptance already covered
Hub/Boneyard optional-book and level-up detail call sites.

The exact source candidate `79fd695e3213626fb0ceb6d8b9bc73c5aa2d9de9`
passed the WSL canonical gate: 3,943 Node tests and 24 Python tests with no
failures or skips, 100 percent renderer quality coverage and no quality
failures (gate log SHA-256
`b95279515d1840d6611e76089ce4183577c181f2376c6d84ca03d3231c0a0059`).
The same exact tree repeated the 422-case/59,116-glyph browser render sweep,
including 148 inline checks and zero errors (log SHA-256
`dc6b4d6a2dc6014497460bc3581e2c05bea71cffcf173328f58fe118b3b726a5`),
and the built desktop/touch Frost Jet journeys with read-only/silent detail
and empty browser error lists (log SHA-256
`9de02a547d3781436dcd6de11ac9f31ab25acd6503c4fffd703295c4782a68b1`).
No browser platform approximation or catalog/rank change is involved. The
separate full optional-book smoke's later belt-effect timeout remains a limit
of that broader journey, not a pass claim for it.

## 2026-09-26 — Report 33: shared skill HoverBox text-width ownership

The Meditation concentration bonus overruns the right border in the reported
LevelupScreen screenshot. The earlier closure checked authored text presence
but did not exercise the native line-add width boundary. Its 380-pixel maximum
was applied to the whole box while only descriptions were wrapped. That
assumption is superseded here for both SkillScreen and the requested
LevelupScreen detail projection; changing Meditation's copy or shrinking its
font is not the native fix.

### Native evidence and causal trace

The retail image and canonical Ghidra program are SolomonDark.exe 0.72.5,
preferred base `00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Fresh read-only M2 replica queries recovered the complete skill detail builder,
stat/bonus formatters, line insertion, measurement, wrapping, positioning and
render owners. The canonical project and Mod Loader are unchanged. This is
instruction/data evidence, not a fresh clean-stock gameplay recording.

- `0066B990`, reached through Skills_Wizard vtable cell `007A0D78`, first
  wraps the description through `0043D230` at float `0078E934 = 380`.
- Every resulting title/category/description/stat/bonus line goes through
  `Dialog_AddLine 005BCCB0`. It measures ExactText via `0043C870`, compares
  against **double** `0078E600 = 400`, and wraps an over-width line through
  `0043D030` before storing it. The generic limit is distinct from the
  description's narrower preparatory wrap.
- The line-add tail updates HoverBox `+80` to the maximum measured stored
  line width. It does not clamp the box independently of the rendered text.
  `005AB060` adds the requested margins; the SkillScreen opener `00656CE0`
  supplies source gap 50 and margin 25.
- `005C3A60` consumes those stored strings with ExactText; indentation, explicit
  breaks and inline rank/scale commands must not be replaced by CSS wrapping.
- The complete public-row/rank scan of the existing extracted catalog finds
  Meditation's bonus at 424 logical pixels. Its current box allocates only
  380 content pixels. No other non-description authored row in that scan
  exceeds 380; the correction nevertheless belongs to all semantic line kinds.

The full xref sweep found only `0066B990` and `004FD6A0` using the specialized
description wrapper `0043D230`. HoverBox constructor callers are `004A98E0`,
`00553B80`, `0055E2C0`, `0056FC90`, and `0066B990`. All line-add callers were
enumerated; the skill builder's own calls, including both current/next-rank
branches and all Welding cases, share the same width owner. Other item,
message, and shop builders do not use the Website skill tooltip compositor.

### Boundary and membership before implementation

This correction owns the shared **skill-detail text-to-box width pipeline**,
from authored semantic lines through wrapped text and measured extents to
the existing fixed-stage HoverBox placement. It does not change progression,
offered ranks, copy, fonts, colors, line gaps, interaction, audio or gameplay.
Existing native catalog rows/assets are reused in full, not re-authored.

| Member | Native source | Disposition / acceptance required |
| --- | --- | --- |
| All public skill rows 8–79, every authored rank and boosted/item-granted titles | existing complete catalog; `0066B990` | exact-ported: exhaustive layout checks |
| All fourteen concentration bonus families, including Meditation 58 | `0065DEF0`, `0066EDDC` | exact-ported: 400-pixel line-add wrapping and unchanged text |
| Current-rank stats, scalar/vector formatting, explicit newlines | `0065D7F0`, shared line-add | exact-ported: line measurement and frame containment |
| Description preliminary wrapping | `0066BE48`, `0043D230`, 380 float | exact-ported: reuse native in-place wrapper for plain catalog descriptions |
| Title/category/boost/level/spacer lines and ExactText directives | `0043C870`, shared line-add | exact-ported: no width clamp independent of rendered strings |
| All ten exposed Welding detail identities | existing row52/1000–1009 projection | exact-ported: same width and extent owner |
| SkillScreen Hub/Boneyard and LevelupScreen desktop/touch details | two callers of `drawNativeSkillHoverBox` | exact-ported: built-client journeys, silent read-only details, dismissal |
| Empty details, left/right edges, above/below flip and viewport clamp | `005AB060`, existing fixed-stage projection | exact-ported: focused layout boundaries |
| Inventory/item/shop/MsgBox builders | other enumerated HoverBox/line-add callers | out-of-system: separate text producers/compositors; existing native MsgBox wrapper is reused without changing it |
| Progression, combat, network/save state, hotbar model | independent authoritative owners | out-of-system: no mutation needed for tooltip width |
| Root selectors 0–7 and internal Plane Orb/Reserved rows 80/81 | complete catalog boundary | out-of-system: roots are page headings; rows80/81 have no category or authored tooltip config |

No browser constraint requires a visible approximation. The per-member checks and built-client results below establish the implemented
width contract. The final integrated release remains gated on canonical Mac validation. Original report text, screenshot and source metadata remain
in the named archive; execution probes and captures are task scratch.

### Implemented width contract and per-member checks

Single-fix candidate `cd93627843d7f3442b8b6a5dd8fa6c595697c9c8` passed 31 focused
skill-book/typography contracts, strict test TypeScript checking, lint, and a
production build. The new red regression first demonstrated the 424-pixel
Meditation line against the old 380-pixel content cap. The corrected generic
line-add split is `   Concentrate: Can Meditate while walking (lesser` followed
by `effect)`. A separate 381-pixel row stays unwrapped and sizes its own frame;
the description-specific 380-pixel boundary is not applied to other kinds.

The actual native bitmap renderer exercised 422 cases and 59,116 glyphs with
no ink outside the painted frame. Coverage includes every public skill, native
maximum and boosted/granted titles, all ten exposed Welding identities,
left/right placement, above/below placement, empty details, and disposal.
Every public description was checked to contain no native inline directives;
reusing the existing plain native wrapper therefore loses no authored control.
Pure layout tests additionally enumerate every authored rank plus four bonus
ranks, permanent versus item-granted sources, all semantic line kinds,
explicit line breaks, inline rank commands, and empty content.

The untouched production client reproduced the reported right-border overrun.
The corrected built client completed eight real journeys: desktop 1600x900 and
Chrome touch-emulated 844x390, each with SkillPicker in College and Boneyard,
and learned SkillBook in both scenes. Meditation rank-one and rank-two previews,
mouse/keyboard focus/tap, sibling replacement, real selection, dismissal, and
reopening passed. Detail inspection did not grant a rank or play acquisition
audio; the real selection granted exactly once and played once. Browser,
HTTP, and wire error arrays were empty. Before/after desktop and compact-touch
frames were visually inspected. Physical-mobile and fresh clean-stock runtime
capture are not claimed.

The maintained smoke tools are `frontend/tools/smoke-skill-tooltip.mjs` and
`frontend/tools/smoke-skill-tooltip-render.mjs`. The first uses a private
standalone test host and deterministic native offers. Like the existing
SkillPicker smoke, it supplies a new input edge after preparing the barrier;
waiting for paused ticks cannot publish a manually prepared fixture. No
production timing workaround or host modification was added.

The final integrated candidate includes the separately owned report32 commit.
Its complete canonical gate, exact-source manifest, repeated post-build
browser/render checks, publication, and cleanup are recorded in the canonical
M2 archive receipt `_source/20260926-report33-9dfnkrb2-release.json` and STATUS.md.
That receipt starts explicitly pending and is completed only after those
steps succeed. Keeping release bookkeeping there leaves the fully qualified
Website source tree unchanged. All in-system membership above uses the same
measured/wrapped compositor; no extractable width fact or platform-blocked
member remains. Original source/media evidence is preserved separately from
disposable execution logs and captures.

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
