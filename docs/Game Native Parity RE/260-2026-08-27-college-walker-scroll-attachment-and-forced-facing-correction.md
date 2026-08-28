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
