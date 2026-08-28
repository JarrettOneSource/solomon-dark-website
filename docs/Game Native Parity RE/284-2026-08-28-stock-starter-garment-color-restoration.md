# 2026-08-28 — Stock starter-garment color restoration

## Reported smell and parity question

- Reported web behavior: player robes are bright, neon-like colors instead of
  Stock's subdued cloth colors.
- Regression owner: Website commit `f8944a38` deliberately replaced Stock's
  starter-color transform with raw element RGB values
  `FF19FF/FF1919/19FFFF/1980FF/00BF00`, rewrote every ordinary starter producer
  and fallback to that table, recolored the first College generation after
  Create, and migrated completed saves to those values.
- Stock behavior to restore: starter Hat/Robe primary colors are item-owned
  outputs of the selected base family, three native jitter draws, clamp, and
  the shared luminance mixer. The secondary layer is white. The first
  post-Tutorial College garments are a separate one-shot green construction
  and survive Create unchanged.
- Reproduction inputs/scenes: all five ordinary element choices; fresh join,
  post-Game-Over generation, first College/Create, Tutorial, save restore,
  reconnect, local/remote living players, inventory/belt/SkillBook, death, and
  memorial presentation.
- Falsifiers: the neon remains after authoritative item tints use the native
  roll; Stock writes raw element RGB; renderer/material tint differs from the
  item; another wearable family shares the starter writer; or a saved vivid
  starter pair cannot be distinguished from item-owned generated/dyed gear.

This reopens and supersedes only the web-product color decisions in the prior
"Wizard starter-garment element identity reopening" entry. Its native owner,
item lifetime, consumer census, and evidence remain valid. The skipped parity
rule was treating the Stock luminance transform and College one-shot guard as
optional appearance policy instead of executable behavior owned by the whole
starter-garment system.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User parity direction | explicit 2026-08-28 report | The raw-element neon result is wrong; review and restore Stock behavior. This supersedes the earlier explicit web saturation policy. | authoritative |
| Retail identity | unmodified Beta `0.72.5` `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical sealed retail program, re-hashed before this investigation. | high |
| Fresh read-only decompilation | canonical Ghidra 12.0.3 replica; `Gameplay_FinalizePlayerStart 0x005CFA80`; callers `0x005D0290` at `0x005D0756` and `0x005D2380` at `0x005D24FF` | Exactly two callers reach the guarded starter constructor. It creates both wearables once while `Game+0x86 == 0`. | high |
| Fresh raw instructions | `0x005CFAE3..0x005CFCAC`, `0x005CFCC2/0x005CFCE9/0x005CFD10`, `0x005CFD2E..0x005CFD46`, `0x005CFD98..0x005CFE82` | The constructor enumerates selected rows `8/16/24/32/40`, lets live College flag `DAT_00B3BCA0` override the base, adds three unsigned `Float(0.1)` draws, clamps, calls the shared mixer with factor `0.8`, then copies one primary float4 and one white float4 into both Robe and Hat. | high |
| Fresh helper instructions/data | mixer `0x0040FC60`; doubles `0x007DE8C0/0x007DE8B8/0x007DE8B0`; factor `0x00785368`; jitter maximum `0x007845E8` | Luminance weights are exactly `0.3086000085/0.6093999743/0.0820000023`; each output is `0.8*luminance + 0.2*channel`; jitter maximum is `0.1`. | high |
| Durable native reports | Mod Loader `native-game-over-session-semantics.md`, `native-session-flow.md`, `native-items-equipment-and-loot.md`, `wizard-render-animation-deep-dive.md` | Items own independent primary/secondary float4s at `+0x88/+0x98`; renderers consume them. The College branch uses base `(0.25,0.5,0.25,1)` once and its `Game+0x86` guard prevents confirmation from rebuilding clothes. Tutorial owns a separate deterministic orange/tan override. | high |
| Current web causal trace | Website `e3eff7b4`; originating commit `f8944a38`; `native-starter-equipment.ts`, `hub-economy.ts`, `player-entity-store.ts`, `game-save-document.ts`, `player-equipment-appearance.ts`, inventory render contract | Authority currently bypasses the already-exact native roll, stores raw element RGB on both items, and rewrites restored completed saves. Living and UI renderers correctly project that wrong state, so a renderer tint or shader patch would leave every other consumer wrong. | high |
| Prior web A/B evidence | prior Fire journey on the native-roll tree and five raw-palette journeys recorded in the preceding ledger entry | The coherent native-roll Fire item/material was `0x895E5D`; the raw override changed it to `0xFF1919`. State, replication, and material agreed in both cases, isolating production rather than consumption. | high |

## System boundary and membership inventory

Native system: **starter Hat/Robe appearance construction and item-owned
lifetime**, from the guarded selected-family/College base through native RNG and
luminance mixing, live item storage, persistence/replication, and every visual
consumer.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether root `8` ordinary generation | `0x005CFA80`, base `(1,.1,1,1)` | `exact-ported` | three seeded non-negative jitter draws, clamp, `0.8` native mix, white trim |
| Fire root `16` ordinary generation | same, base `(1,.1,.1,1)` | `exact-ported` | independent exact expected roll and non-neon browser pixels |
| Air root `24` ordinary generation | same, base `(.1,1,1,1)` | `exact-ported` | independent exact expected roll and material/item agreement |
| Water root `32` ordinary generation | same, base `(.1,.5,1,1)` | `exact-ported` | independent exact expected roll and material/item agreement |
| Earth root `40` ordinary generation | same, base `(0,.75,0,1)` | `exact-ported` | independent exact expected roll and material/item agreement |
| fresh ordinary participant/start | constructor guard clear; web `createHubEconomy` | `exact-ported` | offer seed drives the documented deterministic browser adaptation and both items share one result |
| post-Game-Over fresh generation | `0x005D0290 -> 0x005CFA80`; web archive/loadout replacement | `exact-ported` | newly selected element gets a fresh native roll; prior generation color cannot survive |
| pre-Create College Hat/Robe | `DAT_00B3BCA0`, base `(.25,.5,.25,1)` | `exact-ported` | one native roll on College admission, persisted on both items |
| first College Create confirmation | `Game+0x86 != 0` blocks a second construction | `exact-ported` | selected skills/config change while the existing College item colors remain byte-identical |
| Tutorial Hat/Robe override | `0x005D5DA1..0x005D5E75`; factor `.6`, no RNG | `verified-already-at-parity` | `0xC4915E/FFFFFF` remains independent of starter and Staff color |
| primary and secondary Hat/Robe layers | item `+0x88/+0x98`; constructors and serializers | `exact-ported` | same primary on Hat/Robe; exact white secondary; selector zero unchanged |
| living Hub/Boneyard local and remote players | shared item snapshot into `PlayerWorldView` | `verified-already-at-parity` | material tint equals authoritative item tint for every peer/scene |
| inventory, belt, and SkillBook item icons | native item icon consumers | `exact-ported` through item state; subdued degraded fallback restored | all surfaces agree with the same item; missing legacy tint never uses raw neon |
| death and memorial appearance | live item capture and immutable retirement projection | `exact-ported` through item state; subdued degraded fallback restored | equipped item color survives death/capture; raw palette is absent |
| save continuation/profile hydration and reconnect | serialized economy and snapshots | `exact-ported` persistence; targeted repair for the known web-only vivid pair | native-roll values round-trip unchanged; only exact raw-palette starter Hat+Robe pairs are repaired |
| named recipe, generated random, dyed, mod, and individually changed clothing | separate recipe/factory/dye/mod item owners | `out-of-system` (not starter construction) | no element or save repair rewrites these colors |
| Staff, selected-primary orb, spell/VFX element palettes, Region light, hit overlay, and renderer blend pipeline | separate presentation/lighting owners | `out-of-system` (comparison cues only) | no source or output change |
| shared mixer's other 156 static refs | UI, VFX, source-profile, generated-item, and unrelated color programs | `out-of-system` (the helper is already exact and is not being changed) | only starter callers switch back to the existing exact web kernel |

No member is blocked by the browser platform.

## Native ownership thread

- `0x005D0290` maps Create selection to roots `8/16/24/32/40`, refreshes
  progression, then reaches `0x005CFA80`. Startup owner `0x005D2380` is the only
  sibling caller.
- `0x005CFA80` is gated by `Game+0x86`. It chooses one of five element bases or
  the live College override, consumes three consecutive unsigned native float
  draws, clamps, applies `0x0040FC60`, and constructs one Robe and one Hat with
  identical color blocks.
- Hat and Robe own the result at item `+0x88`; their independently constructed
  `+0x98` layer is white. Equipped sinks, serializers, snapshots, and every
  painter consume those item values; selected element is not a later recolor
  owner.
- The first College Game constructs green garments before selection and sets
  the one-shot guard before Create. Confirmation changes progression/config but
  does not reconstruct or recolor the items.
- Individual death, scene changes, reconnect, and rendering do not regenerate
  color. A new ordinary character generation is the next native writer.

## Recovered behavioral contract

- Base membership is exactly Ether/Fire/Air/Water/Earth plus College. Each
  primary channel receives one non-negative `Float(0.1)` draw in R/G/B order.
- After clamping, `luminance =
  f32(r*0.3086000085 + g*0.6093999743 + b*0.0820000023)` and each output channel
  is `f32(0.8*luminance + 0.2*channel)`. Alpha remains one.
- One mixed primary float4 is copied to both starter items; a separately
  constructed white float4 is copied to both secondary layers. There is no raw
  packed element-RGB table in the retail starter output.
- The browser keeps the already-documented deterministic offer/generation seed
  in place of retail's process-global RNG cursor. It must preserve draw count,
  order, float32 rounding, clamp, and mix.
- The item is authoritative across renderer, UI, save, and multiplayer paths.
  No consumer may infer current selected element and substitute a brighter
  color when item state exists.
- Current saves written by the superseded override need a narrow data repair:
  only built-in starter Hat and Robe both carrying the exact raw primary for the
  current element and exact white secondary are replaced with the deterministic
  native roll for the stored generation offer seed. College/Tutorial pending,
  partial pairs, generated/named/dyed/mod items, and all other colors survive.

## Nearby-system findings

- The renderer, robe atlases, normal blend mode, lighting field, and
  replication were falsified as causes: prior browser receipts show item and
  material tints agree exactly before and after the vivid override.
- `0x0040FC60` is a broad shared color helper with 157 static references. The
  correct fix calls the existing exact web implementation from the starter
  producers; changing the helper would corrupt unrelated UI, generated gear,
  VFX, Tutorial, and native source-profile programs.
- The earlier save migration was intentionally broad enough to overwrite any
  completed built-in starter-shaped garments. The restoration must instead
  identify the exact vivid Hat+Robe pair together so user-owned item colors are
  not treated as element state.
- Native reports require no edit: the fresh instruction pass confirms their
  existing owner, formula, caller, item-layout, and College-guard findings
  without recovering a new retail fact.

## Confidence and open questions

- Confirmed: retail identity, complete starter-constructor caller census, all
  six base branches, RNG count/order/range, clamp, exact mix constants, item
  writes, Hat/Robe/trim membership, College guard, Tutorial sibling, all web
  producers/consumers, persistence paths, and the raw override's originating
  commit.
- Inferred: none material.
- Unknown: none. Every member and the persisted-regression repair are directly
  representable in existing authoritative web state.

## Web implementation consequence

- Remove `WEB_SELECTED_ELEMENT_STARTER_PRIMARY_TINTS` and
  `selectedElementStarterEquipmentAppearance`; the raw web palette must have no
  runtime consumer.
- Route fresh economy, completed-run archive, ordinary generation replacement,
  tests, and smoke expectations back through
  `rollNativeStarterEquipmentAppearance` with the existing deterministic seed.
- Do not pass a new starter appearance at first College Create; preserve the
  one-shot College Hat/Robe while still replacing skills/config and clearing
  onboarding state.
- Change the restore migration into an exact-pair repair from the five known
  web vivid values to the native roll. Do not recolor arbitrary starter-shaped,
  partial, dyed, generated, named, recipe, or mod clothing.
- Restore the existing subdued element fallback table on surfaces that can
  display pre-color legacy items. Authoritative current items continue to use
  persisted native-roll values, never that degraded fallback.

## Validation contract

- Native kernel regression: pin base table, all five deterministic roll
  outputs for multiple seeds, three-word RNG advancement, float32 mixing, white
  trim, and absence of a raw selected-element appearance function/table.
- Authority regression: fresh, post-Game-Over, and all 15 element/Discipline
  generations use the native roll; Hat and Robe match; different seeds can
  vary; Tutorial retains `C4915E`; first College Create retains its pre-Create
  green items while selected skills/config change.
- Persistence regression: native-roll and arbitrary user colors round-trip
  unchanged; an exact vivid built-in Hat+Robe pair repairs once using stored
  offer seed and advances economy revision; pending Tutorial/College, partial
  pair, generated, recipe, dyed, and mod equipment do not change.
- Cross-surface regression: living, death, memorial, inventory, belt,
  SkillBook, snapshot, and remote-player consumers all expose the same persisted
  mixed tint and no raw element fallback.
- Mac Chrome: run five ordinary selected-element journeys and one first-College
  journey on the production build. Record element, offer seed, expected native
  roll, authoritative Hat/Robe, local/remote material, inventory icon, death or
  memorial sample, College before/after tint, screenshots/pixel saturation,
  and empty page/console/failed-response arrays.
- Stock-versus-web acceptance: for each ordinary journey compute the exact
  retail formula from the recorded seed and require byte equality at every web
  consumer. The visible robe must be luminance-mixed rather than the raw base;
  College must remain its one-shot green after Create.
- Complete gate: exact byte-matched candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini after rebase.

## Implementation validation receipt

- Implementation removes the web raw-element appearance producer and restores
  every ordinary starter writer to `rollNativeStarterEquipmentAppearance`.
  `createHubEconomy`, completed-run archive, and post-Game-Over loadout
  replacement now preserve the exact three draws, float32 clamp/luminance mix,
  and white trim. First College confirmation no longer supplies a replacement
  appearance, so its one-shot green items survive while skills/config and
  onboarding state still change atomically. No renderer, shader, atlas, light,
  Staff effect, protocol field, or item serializer changed.
- Persisted regression repair is exact-pair-only. A completed built-in Hat and
  Robe must both have the current element's superseded raw primary, white trim,
  exact starter type/name/records, and no selector, recipe, generated state,
  effect, mod wearable, or affix. Only then are both replaced with the native
  roll from the current progression offer seed and the economy revision
  advanced once. Pending Tutorial/College, partial vivid pairs, and arbitrary
  custom pairs remain identity-equal in focused tests.
- The Mac red tree was byte-identical for its ten changed test/document files
  and failed the canonical gate at the intended seams: Air starter construction
  produced raw `0x19FFFF` instead of native-roll `0x9CC8C8`, and continuation
  restore kept raw Fire `0xFF1919` instead of the saved seed's native roll. Red
  log SHA-256 is
  `839fc68635642a8e19c160efde5611e04ff218ae78981682d6d2955624ba839e`.
- The final 16-file implementation manifest was byte-identical between the
  isolated local and Mac worktrees at base
  `e3eff7b4152c0709aeee107dd366236bf63e077c`. The pre-receipt canonical Mac
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate exited zero: 28
  backend/Website contracts, `313/313` pre-suite tests, `1,720/1,720` main
  Boneyard tests, every later registered frontend/host/desktop group, lint,
  type/generated/boundary checks, production builds, media policy, and bundle
  budget passed. Production Game entry `Game-558E2J7V.js` is `258,247` raw /
  `78,120` gzip bytes. Gate-log SHA-256 is
  `95d23e7791c10d012176def930b214d43b142930a930b1ddfe19d84eb7076305`.
- Mac production Chrome ran five independent fresh ordinary Create journeys,
  each with its own browser context and real task-owned `GameHost`. For recorded
  offer seeds Air `150728`, Earth `163521`, Ether `121544`, Fire `999770`, and
  Water `472672`, the recovered formula produced respectively
  `0x9FCACA/0x6A906C/0x996F99/0x835658/0x61778E`. Authoritative Hat, Robe, saved
  continuation, and live WebGL material tint were byte-equal in every case and
  differed from raw `19FFFF/00BF00/FF19FF/FF1919/1980FF`. Frames reported
  `61..62 FPS`; every page, console, and failed-response array was empty.
  Browser-log SHA-256 is
  `60ac97e8850e638702e25a78feae9880e9c21929deb82b4fc71d54e6f853e1cc`.
- Reviewed ordinary screenshot SHA-256 values are Air
  `f8f882a3ea3af7d1be862b1c20550d3844fc07a1f3978f40dabdcfacbf539ea0`,
  Earth `7589a48cbca9c85f4da3900dd4d66a3d1d358458e99c9ad998f1d853a031074f`,
  Ether `2cb5b11e3d8dfcfc957795093d73a0491d2f04ad91ca38339498198d4e05a8f5`,
  Fire `368e13f538d14a90c2d0725995ee6b1ea379f56c3409070436878fd5626c8256`,
  and Water `1a72cdb09e3d5c2cab96b1a4a2e4d31e0c3fc75cdb53e834dd7c95819421e38a`.
  Visual inspection shows subdued cloth while each separate selected-element
  Staff effect remains vivid; no robe reads as the former neon base.
- The established Tutorial-responsive Chrome journey completed its full stock
  scenario plus desktop/mobile siblings with empty page, console, and failed-
  response arrays. College Title 7, Title 9, acknowledged Office save, restored
  Office, post-Fire Create, returned Courtyard item, and live material all kept
  exact `0x6F7E72`; selected primary correctly changed to Fire row `16` without
  recoloring the garments. Desktop selected-Fire frame SHA-256 is
  `0a409e82e1ec9f4376678eb0b067991a0c43054d7af32b326e30d3ab974652d3`;
  mobile is
  `cebb2aaa0ec580a04fec9b0548e166315dc7a39cb33a8a1cc8e63fb6306681ac`;
  full browser-log SHA-256 is
  `9d422075fd29268fd26617a5b7bee72fc70a1635187bbe156b9d55ec8bc23d01`.
- No native report changed because the fresh Ghidra pass confirmed, rather than
  extended, the existing retail facts. No browser-platform member is blocked
  and no material unknown remains. Publication and deployment were not
  requested and were not performed. A final exact-tree canonical gate follows
  this receipt-only ledger update; its result is reported in the task handoff
  rather than recursively mutating this document again.

## 2026-08-28 follow-up report audit

The later report that a newly created wizard can show the wrong robe color is
already closed by the current `origin/main` implementation above; no second
writer or renderer patch is justified. The exact observable contract is more
specific than “always recolor to the selected primary”:

- an ordinary fresh or post-Game-Over generation constructs Hat and Robe from
  the selected Ether/Fire/Air/Water/Earth base through the native three draws,
  clamp, and luminance mix, so the item visibly belongs to that family without
  using the superseded neon RGB;
- first-College admission constructs one green Hat/Robe pair before Create,
  and stock's `Game+0x86` guard means Create changes the selected primary but
  does **not** recolor those existing items;
- Tutorial tan/orange clothing remains its separate authored override; and
- every later named, generated, recipe, dyed, modded, or individually changed
  garment keeps its own item colors and is never rewritten from current spell
  selection.

Current source at Website `0c510ce3` still routes ordinary construction and
the narrow vivid-save repair through `rollNativeStarterEquipmentAppearance`,
retains the College one-shot pair, and projects item tints to local/remote
Hub/Boneyard, inventory, death, memorial, persistence, and reconnect consumers.
The final task receipt will repeat the established ordinary/College browser
assertions on the exact integrated candidate. A failure there reopens this
system; a passing receipt leaves the implementation untouched.

### Follow-up validation receipt

- No starter-equipment, economy, save, protocol, or renderer production file
  changed in this task. The complete Mac gate retained all ordinary five-
  element construction, persistence, consumer, College, Tutorial, and custom-
  clothing contracts.
- Built Mac Chrome completed the stock-size Tutorial/College scenario with Fire
  selected. Tutorial appearance remained exact `0xC4915E`. College Title 7,
  Title 9, acknowledged Office save, restored Office, returned Courtyard Hat,
  Robe, and live material all remained exact `0x6F7E72`. Create selected Fire
  primary row `16` and reset the skills/config without recoloring the existing
  College pair. Page, console, and failed-response arrays were empty.
- Browser-log SHA-256 is
  `0dfb4c788bd0bac573e4a729daf572b6f06e2540b5844f228f0cfaf955c32248`.
  The reviewed selected-Fire frame is SHA-256
  `97b5b2e2e4878d7c3479923f7d8d7fb6ef6fc51adabc94ac58d46e908ea44690`;
  restored Office is
  `60a0a63abee91dc761bafe899d7cd033858af7af6b28f4f44fe2fb4200eba47f`.
- The follow-up report therefore does not justify another color writer.
  Ordinary new generations follow their selected native family; College and
  Tutorial keep their stock exceptions; later found/generated/dyed/mod clothes
  remain item-owned.
