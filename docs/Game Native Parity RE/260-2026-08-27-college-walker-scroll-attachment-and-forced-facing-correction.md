# 2026-08-27 — College walker scroll attachment and forced-facing correction

## Reported smell and parity question

- The prior College identity pass was falsified by direct user observation:
  the moving pre-Create wizard carries the scroll-bearing Robe attachment on
  the wizard's left side while holding an orbless Staff on the right. The
  scrolls are not exclusive to the stationary statue.
- The same report requires the scripted player facing to remain locked to the
  direction of forced travel for the complete Courtyard and Office approach,
  not merely to match two sampled title-card headings.
- Process failure: the earlier pass stopped at item construction and treated
  the absence of an `Item_Misc` book as proof that the player had no scroll
  pixels. It also compared the browser against the same heading helper used by
  the implementation at Title 7/9, leaving continuous movement ownership and
  the Office sibling untested.
- Falsifiers: selector-0 Robe does not own the scroll-shaped attachment; the
  College flag injects a separate player-only draw; scripted native movement
  respects a cast-owned facing; every rendered browser frame already aligns
  facing with forced displacement through both paths.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | on-disk retail 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | canonical image for every address below | high |
| Clean visual statement | user correction plus the retained native title-walk capture | the small green-gray moving wizard visibly carries the scroll bundle and plain Staff as separate left/right members | high-visible |
| Robe compositor | `PlayerWizard::Render 0x0054BA80 -> 0x00538B80 -> Item_Robe::RenderAttachment 0x00577DA0` | equipped selector-0 Robe contributes primary and secondary five-pose/24-facing art plus both fixed-color lanes; those are the scroll-bearing clothing attachment, not an inventory book | high |
| Authored Robe membership | Clothes primary `868..987`, secondary `1228..1347`, shared fixed primary/secondary banks documented by the complete equipment extraction | selector 0 is one complete two-color sibling of selectors 1/2; all heading/pose cells are extractable and already present in the player atlas | high |
| Staff/orb membership | Staff 7004 selector 0, `0x00578D20`, Clothes material record 5 and pose banks `3244..3483` / `3484..3723`; element helper `0x0053B1D0` | the Staff remains visible; negative pre-Create selection suppresses only the orb/effect | high |
| College-flag xref census | canonical Ghidra `refs_to_addr_decompile.py 0x00B3BCA0`, 37 references in 31 functions | neither `0x0054BA80`, `0x00538B80`, nor `0x00577DA0` reads the flag; College chooses the shared garment tint/start state and does not inject a special scroll renderer | high |
| Forced-facing instructions | raw instructions in Courtyard `0x00503E29..0x00503E64`, Office `0x00504917..0x0050493E`, and setter `0x00503100..0x00503166` | each path normalizes target minus player, stores that vector at actor `+0x7C/+0x80`, and unconditionally writes heading `+0x84 = degrees(atan2(x,-y))`; no action/cast-facing gate exists | high |
| Current web causal trace | `planHubScriptedMovement -> commitPlayerCharacterTick` in authority and `hub-prediction.ts`; `HubPlayerView` visible-position projection | the shared commit could retain action facing, while browser correction motion could visibly diverge from the authoritative heading | high |

## System boundary and membership inventory

Native system: the complete pre-Create player equipment compositor and every
scripted-movement facing owner used from Tutorial completion through automatic
Archchancellor contact.

| Member / branch | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| selector-0 Robe dynamic primary/secondary scroll attachment | `0x00577DA0`, Clothes `868..987` / `1228..1347` | `verified-already-at-parity` | all 24 facings x five poses present; live admission renders both color lanes |
| selector-0 Robe fixed primary/secondary lanes | `0x00577DA0`, shared fixed banks | `verified-already-at-parity` | both fixed lanes remain visible and share the persisted College colors |
| Robe selectors 1/2 siblings | same renderer/table family | `verified-already-at-parity` | complete extracted selector membership remains unchanged |
| Hat 7005 selector 0 and College garment tint | `0x005758F0`, `0x005CFA80` | `verified-already-at-parity` | common persisted Hat/Robe tint and white secondary |
| Staff 7004 selector 0, back/front depth members | `0x00578D20`, complete two-bank pose family | `verified-already-at-parity` | visible plain Staff across direction changes |
| pre-Create selected-element effect | negative root, `0x0053B1D0` early return | `verified-already-at-parity` | zero orb/effect sprites throughout both forced paths |
| Courtyard forced path facing | `0x00503CE0 -> 0x00503100` | `exact-ported` | every nonzero scripted tick overwrites cast/stale facing from movement |
| Office forced path facing | `0x00504670 -> 0x00503100` | `exact-ported` | transformed path receives the identical unconditional rule through contact |
| portal/loadout scripted-movement siblings | common Game movement setter and web `planHubScriptedMovement` | `exact-ported` | every shared scripted plan owns facing; ordinary input keeps cast ownership |
| local prediction/reconciliation and display frames | browser-only projection of the same serialized path | `exact-ported` | renderer selects each 24-way frame from consecutive visible scripted positions |
| stationary CollegeStatue and ambient Students | independent actor/prop renderers | `out-of-system` for player attachment ownership | remain independent and visually unchanged |

No member is blocked by the browser platform.

## Native ownership thread and implementation consequence

- `Gameplay_FinalizePlayerStart` equips selector-0 Hat, Robe, and Staff. Robe
  is the owner of the left scroll-bearing clothing art; Staff owns the opposite
  held attachment. The negative element root removes the Staff orb only.
- Courtyard and Office evaluate their authored splines, normalize the current
  target delta, then call the same unconditional actor movement/facing setter.
  This late scripted write owns facing even if another action state previously
  selected a direction.
- Preserve the extracted player atlases and common equipment renderer. Static
  renderer coverage names selector-0 Robe's dynamic/fixed color members so it
  cannot again be misclassified as scenery.
- Scripted movement explicitly owns authoritative/predicted facing in the
  shared movement plan. `HubPlayerView` additionally derives its rendered bank
  from consecutive visible scripted positions, so correction smoothing cannot
  move one direction while painting another. Ordinary input retains the
  existing cast-facing rule.
- Do not add an `Item_Misc` scroll, a College-only sprite, a guessed offset, or
  a renderer exception.

## Validation contract

- Red/green kernel coverage injects a cast-owned stale heading into Courtyard,
  Office, and one shared scripted plan; every nonzero scripted delta must own
  the 24-way direction while ordinary cast movement remains unchanged.
- Client prediction coverage uses the same participant/path plan without
  transport timers. Renderer contracts pin visible-displacement facing in both
  Courtyard and private-room owners.
- Equipment coverage asserts selector-0 Robe primary/secondary dynamic and
  fixed lanes, selector-0 Staff back/front membership, College tints, and zero
  pre-Create orb effects while retaining selectors 1/2 and every pose row.
- Mac Chrome/WebGL acceptance continuously samples position and rendered
  heading through Courtyard and Office. Every stable-cursor moving frame must
  face its visible displacement; title frames must report Robe 0, Staff 0,
  shared green tint, and no orb. Browser error arrays must be empty.
- Run the complete Mod Loader static-RE registry and Website
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact byte-identical Mac
  candidate. Publication and deployment remain separate and unrequested.

## Implementation validation receipt

- Root cause and fix: `planHubScriptedMovement` marks one movement-owned-facing
  plan consumed by the shared character commit, so active/stale cast state can
  no longer suppress Courtyard, Office, portal, or loadout scripted headings.
  `HubPlayerView` selects the rendered 24-way bank from consecutive visible
  positions while a College/transition program owns movement, preventing local
  correction smoothing from painting a stale direction. Ordinary movement and
  cast-facing behavior are unchanged.
- Scroll correction: no new art or item was added. Static renderer coverage
  pins selector-0 Robe's primary/secondary dynamic and fixed lanes beside the
  Staff back/front lanes. Browser title receipts resolve Robe selector `0`,
  Staff selector `0`, common tint `0x6F7E72`, and `orbSpriteCount == 0`.
- Red evidence: before the shared-plan fix, authority and client prediction
  each retained stale cast heading `12` on the first Courtyard tick where
  movement required `2`. Before the renderer fix, continuous Chrome sampling
  found stable-cursor visible displacement `22` while the painted bank remained
  `21`. Both exact failures are now regression-covered.
- Exact candidate: Website local, remote, and detached Mac bases are
  `58ded923596cad83748ba2b471daee8dfa945842`; Mod Loader local, remote, and
  detached Mac bases are `445d6f97565856220bad17ff959cd53cb888c121`.
  All 13 changed Website files and the one native report were manifest-
  identical before final validation.
- Mac validation: the current Mod Loader registry passes `517/517`. The
  Website canonical gate passes backend Release build/contracts, lint/type and
  generated checks, every frontend/desktop suite, production builds, media
  policy, and the unchanged bundle budget. `Game-C4STzngx.js` is 479,117 raw /
  134,105 gzip bytes against 524,288 / 134,144 limits.
- Mac Chrome 151.0.7922.174 completes the stock Tutorial -> Courtyard -> Office
  -> Create -> Courtyard journey with `status: ok`. The sampler records 891
  frames, including 514 moving Courtyard and 258 moving Office samples across
  headings `0,1,2,3,4,5,11,17,18,19,20,21,22,23`, with zero mismatch. Academy
  advances, exactly one automatic `ARCH_INTRO_0` voice starts, and page,
  console, and failed-response arrays are empty.
- Evidence hashes: browser log
  `74ad3ec154c3e181577df14135e31dec5380bded8659233d801cd3fb45c3b5d6`;
  canonical log
  `d364e561238b6d9e3756f28b6fcc30a05440a6108abf35bab79f2920f8752d2a`;
  Title 7 frame
  `51af6888912c764156983783b4294fc61854780eddb9cb2e0f0a98b6e7082255`;
  Title 9 frame
  `695a3e73ecac333f533a88d20daab295acad293ffb538b83bf5cee303ca6614f`;
  Office frame
  `67f69527736eaa173fab2131e04258f7ae3893b59f235bc9764a6346a3ed0e26`;
  reviewed walker crop
  `778a414b6ea07938a07e9972ca8711cd1aa4dbce7246b1b4b42936fad9663485`;
  static-RE log
  `95e753350f89c1dd9337edc6d6aa20be9f232ce86f94854cf642037fc455a253`.
- No platform-blocked member or material unknown remains. The focused changes
  are uncommitted, unpushed, and undeployed; publication was not requested.

## 2026-08-28 — Pre-Create wizard scroll and plain-Staff attachment closure

### Reported smell and parity question

- Reported web behavior: the small wizard in the post-Tutorial College intro
  does not visibly carry the stock scroll and Staff pair.
- Stock behavior to recover: every rendered facing of the pre-Create wizard
  carries one heading-selected scroll/hand sprite and one generated plain
  Staff, while the ordinary equipped weapon and element orb are suppressed.
- Reproduction scenes: the complete Courtyard and Office scripted paths from
  Tutorial completion through Create admission, including both native title
  cards and every 24-way facing reached by either path.
- This reopens the 2026-08-27 College walker entry. That pass asserted Robe and
  Staff selector IDs, tint, heading, and zero orb sprites, but did not inspect
  the composed pixels. It also described the selector-0 dynamic Robe bank as
  scroll-bearing even though the already-generated native atlas catalog listed
  a separate `Item_Robe::RenderAttachment` consumer at Clothes `1588..1611`.
  The missing inventory row and selector-only browser receipt let the defect
  ship.
- Falsifiers: Clothes `1588..1611` is unrelated to this actor; the branch is
  selector-0 or College-flag specific; a valid Staff continues through its
  normal item renderer while primary selection is `-1`; or the special prop is
  drawn outside the Robe fixed-lane transform/order.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | canonical program for all preferred addresses below | high |
| Clean stock | `/mnt/d/codex-evidence/tutorial-college-student-20260826/native-title-walk-probe.mp4`, SHA-256 `fb4f8863456261facdfe1189ff78b337f17e1a8996059485a8cc2fb9efd8d589`, frames 9.5..11.9 seconds | the green-gray scripted wizard visibly carries a rolled prop on one side and a long plain Staff on the other through the title walk | high-visible |
| Current web witness | `tutorial-r2-solomon-dark-title.png`, SHA-256 `690944bb8fc601a7c4971f910524ef15e753d2bb563cfb008582c1f02c83b7ce`, prior Mac Chrome College receipt | the frame reports Robe selector 0, Staff selector 0, green tint, and zero orb sprites, yet the composed actor contains only the ordinary short equipped-Staff pass and no scroll/long-Staff pair | high |
| Red browser candidate | exact Mac Chrome candidate after the finite sheets/renderer landed; natural Tutorial Game Over into Title 7; focused authority/client follow-up | `playerUnselectedPrimaryAttachment` was false. Fresh welcome carried `-1`, but after the first College movement ticks both authority and client carried Ether `8`: `stepPrimarySpells` rebuilt `selectedPrimaryId` from the skill-book-backed `castAuthority` every tick. Renderer correctness alone could not activate the native branch. | high |
| Robe instructions | canonical Ghidra 12.0.3 read-only replica, `Item_Robe::RenderAttachment 0x00577DA0` | after dynamic Robe layers, gameplay-present plus selected-primary `-1` draws Clothes `1588+f`, then a generated Clothes-5 shaft between `1.1 *` points 0/1 from Clothes `460+f`; it runs before all four fixed Robe banks and under their optional transform | high |
| Weapon compositor instructions | `PlayerWizard::Render 0x0054BA80 -> 0x00538B80`; raw branch `0x0053971A..0x00539758` and fallback `0x00539659..0x00539AF1`; float `4.0` at `0x007849F8` | selected-primary `-1` diverts before the live weapon-type branch and forces fallback pose 4, so Staff selectors 0..5, Wand, and an empty sink use rows `580..603` / `772..795` rather than the equipped weapon painter; ordinary empty-weapon states retain actor-selected fallback poses 0..4 | high |
| Hand action instructions | fresh Ghidra constructors/ticks `0x0044B400`, `0x0044B580`, `0x0044B5E0`, `0x0044C750`, `0x0044C810`, no-item CastSpin/Sweep `0x00448860` / `0x004488F0`; Staff admission `0x00537AA0` | the ordinary empty-weapon compositor receives unclamped actor pose directly. Idle is 0; HandCast1 owns RNG-selected `[3,1,2,2,2]` / `[0,1,2,2,2]`; HandCast2 owns `[1,3,3,3,3,3,3]`; HandConstant owns `[2]`; no-item CastSpin/Sweep owns 3. Staff melee poses 4..6 require equipped type `0x1B5C`; no Staff-to-hand lookup exists. | high |
| Complete static content | retail `images/Clothes.png`, SHA-256 `eaa1feb70362cf6dbc2068036f9cc9f77001d888e26cbd218c6144ebe63d6ac1`; `Clothes.bundle`, SHA-256 `69595c233b6dd61d2273bf60d13e0e2bf7f2dde5db8036ee8fd86e9aae30624` | all 24 special prop rows, all 24 two-point socket rows, Staff material 5, and both five-pose fallback families are extractable without approximation | high |
| Injected runtime support | loader-injected retail process PID 7000; loaded Clothes object `0x0140E2F4`; `+0x640` array `0x19767484`, count 24; parallel socket array `0x19764E74`, count 24 | facing 18 resolves prop record slot `0x1976824C`; the runtime socket row at `0x19765C3C` has exactly two points `(-41,-37.5)` and `(30,-17)`, matching Clothes record 478. This supports loaded-table identity only; the clean capture and instructions own parity truth. | high-supporting |

The reusable native correction is recorded first in Mod Loader
`docs/reverse-engineering/native-session-flow.md` and
`native-items-equipment-and-loot.md`.

### System boundary and membership inventory

Native system: the complete living PlayerWizard attachment program selected
when the current primary-spell selection is exactly `-1`, from selection lookup
through back/front generic passes, Robe-owned prop/shaft composition, material
tint, hit redraw, scene lifetime, and return to ordinary equipped rendering.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| actor-local selection controller and slot-global fallback | actor `+0x21C` or `DAT_00819E84[playerSlot+12]` | `exact-ported` | equality to `-1`, not scene name or a guessed College flag, selects the branch |
| fallback bank A, five poses x 24 facings | Clothes `484..603`, `g+0x5A0` | `exact-ported` | all 120 cells extracted and split by point-0 Y against baseline `0.5`; selected `-1` uses pose 4 |
| fallback bank B, five poses x 24 facings | Clothes `676..795`, `g+0x5C0` | `exact-ported` | all 120 cells extracted; ordinary empty-weapon depth copy and selected-`-1` pose-4 unconditional copies remain distinct |
| ordinary empty weapon, nonnegative primary, idle/reset | null item branch, actor pose 0 | `exact-ported` for attachment pixels | generic back/front pose-0 cells replace the web's empty idle attachment |
| ordinary empty weapon during HandCast1/HandCast2/HandConstant/CastSpin/Sweep | unclamped actor pose from the separate Hand/action owner | `out-of-system` in this closure | current wire state lacks the HandCast1 RNG variant and collapses secondary StaffCast2/CastSpin occupancy instead of carrying Hand/action progress; renderer draws no guessed Hand cell instead of indexing a Staff pose or clamping it |
| null/non-Staff selected-element helper | `0x0053B321..0x0053B66B` | `out-of-system` (separate selected-element raster/socket program) | this correction changes attachment pixels only and does not guess its already-documented randomized/null-item VFX placement |
| Robe selectors 0, 1, and 2 | shared `0x00577DA0` branch | `exact-ported` | special prop admission is independent of Robe selector; all three compiled native Robes use the same 24 rows |
| heading prop/hand family | Clothes `1588..1611`, `g+0x640` | `exact-ported` | one extracted cell and one browser-visible member for every facing 0..23 |
| plain Staff material and geometry | Clothes material 5; points 0/1 of `460..483`; double `1.100000023841858` at `0x00785070`; half-width double `0.5` at `0x007DE808` | `exact-ported` | bilinear endpoint-quad extraction for every facing; no rotate-after-resize substitute |
| equipped Staff selectors 0..5 | type 7004 normal item branch | `exact-ported` negative branch | every selector is suppressed while selection is `-1` and returns unchanged for a positive primary |
| equipped Wand | Wand branch in `0x00538B80` | `exact-ported` negative branch | selected `-1` suppresses the Wand and forces fallback pose 4; nonnegative selection restores the unchanged Wand |
| empty weapon sink under selected `-1` | null branch in `0x00538B80` | `exact-ported` | uses forced fallback pose 4 and neither removes nor replaces the Robe-owned plain special Staff |
| native Robe absent | no `Item_Robe` vtable call | `exact-ported` negative branch | generic fallback remains, but no scroll/plain-Staff Robe composite is synthesized |
| Hat/head and ordinary dynamic/fixed Robe families | existing painter siblings | `verified-already-at-parity` | unchanged selectors, colors, five-pose gait, fixed pose, bob, and heading |
| living red hit redraw | `PlayerWizard` living duplicate pass | `exact-ported` | current fallback and special Robe layers mirror into the red redraw; shadow/orb/death remain excluded |
| Courtyard and Office pre-Create paths | selected primary `-1`, native Robe present | `exact-ported` | same shared rule through every scripted heading and both region owners |
| fresh and restored College admission authority | native new PlayerWizard generation; web `armGameSimulationCollegeIntro` | `exact-ported` | fresh arming and active/restored Courtyard, acknowledged Office, and loadout-transition states repair the live primary-cast lane to idle selection `-1`; confirmed incoming/loadout does not re-arm it |
| Tutorial Sirmin and ordinary post-Create players | selected primary 8 or another nonnegative row | `verified-already-at-parity` | keep ordinary equipped Staff/Wand and selected-primary VFX; no scroll/plain-Staff branch |
| Create wizard preview | `CreateWizardMenu`, separate preview compositor | `out-of-system` | it is not this PlayerWizard scene actor or selected-`-1` attachment branch |
| mod-authored Web Robes | browser extension with no retail `Item_Robe` class/table row | `out-of-system` | do not graft the stock compiled Robe special branch onto arbitrary mod art |
| death, corpse weapon bouncer, memorial portrait | separate terminal/memorial renderers | `out-of-system` | no living selected-primary attachment program survives terminal handoff |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- `PlayerWizard::Render 0x0054BA80` invokes attachment compositor
  `0x00538B80` before and after the Robe. The compositor resolves the current
  primary through actor `+0x21C`, or the participant slot table when that
  object is null. Equality to `-1` jumps around the live Staff/Wand virtual
  renderer and into the generic two-bank program.
- Generic bank A and B use `index = facing + 24 * pose`. A nonnegative-primary
  empty weapon uses `trunc(actor+0x238)`; selected primary `-1` substitutes
  exact pose `4` from `0x007849F8`, while the Robe fixed banks keep their
  ordinary actor pose. Point-0 Y is compared with Clothes-316 point-0 Y `0.5`:
  pass 1 submits `<=0.5` behind the dynamic Robe; pass 0 submits `>0.5` after
  the fixed Robe. While selection is `-1`, bank B pose 4 is additionally
  submitted after the depth-selected calls in both passes. The duplicate-
  looking submissions are native painter membership and must not be
  deduplicated by the extractor.
- The ordinary empty-weapon index is not clamped. Native action admission keeps
  it in range through distinct HandCast1, HandCast2, HandConstant, and no-item
  CastSpin/Sweep programs whose only reachable rows are 0..3. Staff melee/spin
  requires an equipped Staff. The current web action state does not replicate
  HandCast1's RNG branch or HandCast2/CastSpin progress, so this closure ports
  exact idle row 0 and withholds active Hand pixels; it never maps Staff poses
  7..9 into the five-row sheet.
- `Item_Robe::RenderAttachment 0x00577DA0` first paints its ordinary primary
  and secondary five-pose rows. When gameplay exists and current selection is
  `-1`, it paints the heading-only Clothes row `1588+f`, then maps Staff
  material record 5 into a four-vertex quad between
  `1.1 * Clothes[460+f].point[0]` and
  `1.1 * Clothes[460+f].point[1]`. The selected Robe's primary/secondary
  colors do not tint this prop; actor lighting/material tint still applies.
- That prop and shaft are inside the optional fixed-lane transform and before
  fixed primary A/B and fixed secondary A/B. In web terms it uses
  `fixedRobeOffset`, sits after both dynamic Robe colors, and sits before all
  four fixed layers. The fallback back pass stays at actor root; its front pass
  uses the existing `frontAttachmentOffset` including the native `+1` Y.
- The rule is state-owned, not College-owned. Any living native-robed
  PlayerWizard with selected primary `-1` receives it in any scene. The
  College path is the shipped consumer; switching to the chosen nonnegative
  primary immediately restores the ordinary equipped item and element effect.
- The Website must create that selection state at the same admission boundary.
  The first browser red run proved that hiding element VFX from
  `participant.collegeIntro` is not equivalent: `armGameSimulationCollegeIntro`
  must reset the live primary-cast component to idle `selectedPrimaryId=-1`
  both when it creates the Courtyard program and when it repairs an already-
  active/restored pre-Create program. `stepPrimarySpells` must then omit that
  player from its skill-book-backed `castAuthority` only while
  `hubCollegeAdmissionPrimaryUnset` is true; otherwise the first fixed tick
  rewrites Ether 8 over the native state. That predicate is narrower than
  `hubCollegeAdmissionPreLoadout`: plain fresh Courtyard pending state and an
  incoming transition from the library remain ordinary selected-primary
  owners. Once loadout has passed, arming remains a no-op and Create
  confirmation installs the chosen primary in both the new skill book and the
  live primary-cast component.
- The same predicate seals every live selection writer: direct primary
  selection, a primary quickbar edge, and skill-book-backed per-tick cast
  reconstruction. Restore/arm repairs stale nonnegative selections in active
  Courtyard, acknowledged Office, and `college-loadout`; confirmed
  Office-to-Courtyard incoming is the first state that restores ordinary
  selection ownership.
- Destruction remains PlayerWorldView-owned. No standalone prop entity,
  protocol field, timer, audio, collision, authority, or save field exists.

### Complete heading/socket table

The finite authored row is drained in Mod Loader
`native-items-equipment-and-loot.md`: facings `0..23` map one-to-one to
Clothes prop records `1588..1611` and socket records `460..483`, including both
raw points and the exact `1.1` shaft endpoints. The web source sheet is a
pixel-preserving extraction of that full table; no facing is synthesized from
rotation or reflection.

### Web implementation consequence

- Extend the stock extractor with ordinary bare-hand back/front sheets, the
  selected-`-1` pose-4 fallback copies, and the heading-only Robe prop/plain-
  Staff sheet. Pack them into the shared player atlas and keep the raw
  extracted sheets as reviewable pixel oracles.
- Make `createPlayerCharacterDrawPlan` expose the exact selected-`-1` branch.
  `PlayerWorldView` must suppress normal equipped Staff/Wand pixels, select
  fallback pose 4, place the Robe special sheet at the fixed-lane offset, and
  mirror those same textures/order into the hit redraw. An ordinary positive-
  primary idle empty weapon uses exact bare-hand row 0 without the selected-
  `-1` duplicate.
- Carry the ordinary bare-hand selector separately from the ten-pose Staff
  selector. This closure consumes exact idle row 0 only; active Hand action art
  stays absent until action mode/progress/RNG variant becomes authoritative.
  Never clamp, wrap, or reuse Staff poses 5..9 as a five-row Hand index.
- Make College admission own the matching authoritative state: reset only the
  live primary-cast lane to stock idle selection `-1` while the actual
  pre-Create program is active, including restore/repair. Use the narrower
  `hubCollegeAdmissionPrimaryUnset` boundary to omit that owner from per-tick
  primary `castAuthority`; the broader pending bit also covers ordinary fresh
  Hub state and cannot own this suppression. On confirmation, derive the live
  selected primary from the newly created skill book in the same replacement
  operation. Do not alter the Tutorial profile baseline, equipped item
  identity, or confirmed loadout membership.
- Admit the Robe special only for a compiled native Robe appearance. Keep
  positive-primary, empty-Robe, mod-wearable, death, memorial, and Create
  ownership boundaries explicit.
- Remove the misleading selector-only assertion as completion proof. Selector
  identity remains useful state evidence, but the browser contract must inspect
  rendered special/fallback membership and pixels.

### Validation contract

- Extraction/generation: assert all `24` prop rows, both `24` socket rows,
  Staff material 5, all `120 + 120` fallback cells, exact depth classification,
  unconditional bank-B duplication, `1.1` endpoint scaling, source PNG hashes,
  and packed-atlas byte reconstruction.
- Pure/runtime tests: selected primary `-1` selects forced fallback pose 4 and
  special rendering for native Robes across Staff selectors 0..5, Wand, and
  null; positive primary restores each ordinary weapon; positive-primary null
  idle uses bare pose 0 without the duplicate; no native Robe removes only the
  special layer; mod Robes never inherit it; hit redraw mirrors the exact
  selected-`-1` living membership.
- Hand boundary tests: ordinary idle no-weapon state exposes bare pose 0;
  primary, secondary, and Staff-action occupancy expose no bare selector; the
  renderer never indexes a five-row Hand sheet with `attachmentPose`.
- Authority/client tests: first arm and already-active repair publish
  `selectedPrimaryId=-1`; welcome, delta, local prediction, and presentation
  retain it through both College paths; alternate primary quickbar and direct
  selection cannot replace it; stale acknowledged Office and loadout states
  repair it; confirmed Create restores the selected primary.
- Mac Chrome/WebGL: traverse the natural Tutorial-to-College handoff and sample
  every stable moving frame through Courtyard and Office. Both title-card
  frames and every observed heading must report the selected-`-1` branch,
  visible fallback and Robe-special pixels, hidden ordinary weapon pixels, zero
  orb sprites, and empty page/console/failed-response arrays.
- Stock-versus-web: compare matching native/web headings at the same scale and
  scene phase, including the long Staff endpoint, scroll bounds, layer order,
  fixed-lane gait offset, and transition to ordinary selected equipment after
  Create. Run the exact byte-identical Mac candidate through
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.

### Implementation validation receipt

- Red browser proof: the first exact Mac candidate contained the new native
  sheets and renderer but failed at Title 7 because the presented branch was
  false. That falsified a renderer-only fix and located the remaining defect at
  the Tutorial-to-College authoritative primary-selection boundary.
- Focused red proof then showed the welcome snapshot at `-1` and the first
  walked snapshot at Ether `8`, identifying unconditional per-tick
  `castAuthority` selection as the overwriter.
- The first full-gate authority correction exposed two sibling boundary
  regressions: using the broad pre-loadout predicate suppressed the selected
  primary for an ordinary fresh Courtyard profile, and Create loadout
  replacement installed the new skill book while retaining the old live
  primary-cast selection `-1`. The correction narrows suppression to active
  College-intro/Office/loadout-transition ownership and refreshes the live
  selection from the replacement skill book atomically.
- Independent diff review then found the remaining primary quickbar/direct
  selection writers, restored acknowledged-Office/loadout repair gap, and the
  invalid five-row Hand-sheet use of a ten-pose Staff selector. The authority
  fixes share one predicate; the renderer now exposes exact bare idle pose 0
  separately and refuses to invent active Hand action poses.
- Exact pre-receipt candidate: Website was rebased on `39228f6e`; all 27 task
  files matched the detached Mac worktree byte-for-byte. The 26 non-ledger
  runtime/source files are retained in manifest SHA-256
  `f53bb0d0320a61fcc0be0108722be9036cda625d954eaab97810c2d089666f48`.
  Mod Loader was rebased on `a369115d`; all four task files matched its
  detached Mac worktree.
- Native validation: the exact Mod Loader candidate passed `532/532` static-RE
  contracts. Log SHA-256 is
  `0225acf068661c1fc1f0998f9a0257ae406429824a6d0d8a5c8776aabc5194f6`.
- Website validation: `/opt/homebrew/bin/bash ./scripts/validate.sh` exited zero
  across backend build/contracts, lint/type/generated checks, every registered
  frontend/runtime/Tutorial/desktop suite, production builds, bundle budget,
  and media policy. Log SHA-256 is
  `a5f4af566e72189fe92b696e2eec0f6af7c3bcf3586a1b4f4bd23fbacf7e7900`;
  the production Game entry is 261,974 raw / 79,465 gzip bytes.
- Mac Chrome completed the natural stock Tutorial Game Over -> Courtyard ->
  Office -> Create -> returned Courtyard journey with `status: ok`, 892 sampled
  College frames, 202 moving Courtyard and 105 moving Office frames, headings
  `0,1,2,3,4,5,17,18,19,20,21,22,23`, and empty page, console, and failed-
  response arrays. Browser log SHA-256 is
  `947ed06ec0de5632e7d28693d493714188244ef70de73e5f8b87947dcaff3646`.
- Title 7 heading 2 and Title 9 heading 18 each reported authoritative and
  presented selected primary `-1`, fallback true, Robe special true, ordinary
  weapon false, and zero orb sprites. Raw frame SHA-256 values are
  `26bf60e784203e95caacd969eb9252ae4b9a516f73523e836268bb41d239427f`
  and `4997f4da8c4cced05b53a7e7b24de1fbc4ebf4d6113e3284cd5a50a34fd20d5b`.
  The Office frame SHA-256 is
  `cf9aeef46cc49394fc474c9c1bc22ef51e9afcb66e5385f6ff2e4e827fa52173`.
  Pixel crops were visually inspected: Title 9 shows the long horizontal plain
  Staff across the wizard, and Office shows the rolled tan scroll in the left
  hand plus the long upright Staff on the right. Crop SHA-256 values are
  `df349ef9d4a1142afb791e78c29295e8cae5fbf82c8eace1aad0c44248f2660d`
  and `e76fb5fbecca63840d236213d85d9e2f0a5b263fdab530603734e4bdedce3aa1`.
- Requested pre-Create selected-`-1` attachment parity is closed. The broader
  active empty-hand action painter remains a known non-platform residual:
  active Hand pixels are intentionally absent until native action mode,
  progress, and Cast1 RNG variant become authoritative. This receipt does not
  call the complete generic fallback-bank system closed.
- Push, deployment, and production restart were not requested and were not
  performed. Task worktrees and evidence remain retained.
