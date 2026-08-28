# 2026-08-28 — Wizard starter-garment element identity reopening

## Reported smell and parity question

- Reported production behavior: the wizard's robe color no longer visibly
  matches the selected element. The user requires the web port to restore that
  identity and publish the correction to `main`.
- Production and source identity at reproduction start are both Website
  `4c608b42118d487a3eb2c6e1a8cb29c020df6479`; this is not a stale deployed
  bundle.
- The earlier starter-color passes proved item-state values, but did not close
  a dedicated end-to-end browser matrix in which selection, authoritative
  starter items, replicated state, and the rendered robe are compared as one
  observable contract. That missing visual seam reopens the whole starter-
  garment color system.
- Falsifiers: a selected-element handoff that is absent in authority; correct
  authority state but stale client replication; correct replicated state but a
  renderer tint/cache mismatch; or a byte/pixel receipt proving the robe is in
  the selected family and the report instead concerns intentionally item-owned
  dyed/generated clothing.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000` | `Gameplay_FinalizePlayerStart 0x005CFA80` owns starter Hat/Robe construction; selected-primary rows `8/16/24/32/40`, College flag `DAT_00B3BCA0`, and mix helper `0x0040FC60` own its color branch. | high |
| Durable native reports | Mod Loader `native-game-over-session-semantics.md`, `native-items-equipment-and-loot.md`, and `wizard-render-animation-deep-dive.md` | Hat and Robe retain independent item float4s at `+0x88/+0x98`; inventory and equipped-wizard painters consume the same colors. Generated, recipe, and dyed clothes intentionally retain item-owned colors instead of following the wizard element. | high |
| Current authority trace | `native-starter-equipment.ts`, `hub-economy.ts`, `player-entity-store.ts`, `game-simulation.ts` at `4c608b42` | Five selected-element bases feed one jitter/mix kernel; successful College and post-Game-Over confirmations request the selected element, mutate both starter items, and advance the economy revision. Tutorial and pre-confirmation College each have separate authored colors. | high-static |
| Current presentation trace | `player-equipment-appearance.ts`, `hub-actors.ts`, inventory/belt/SkillBook painters, death/memorial painters, snapshot/protocol/save paths | Living selector-0 Hat/Robe consume persisted `iconTints`; the world renderer assigns primary and secondary item tints to every dynamic/fixed garment layer. Other surfaces have separate consumers and must not silently fall back to a different palette. | high-static |
| Current Mac gate | clean detached Mac worktree at `4c608b42`; `/opt/homebrew/bin/bash ./scripts/validate.sh` on 2026-08-27 EDT | Complete canonical gate exits zero, including the all-five/all-discipline authority contracts. This is structural evidence, not the missing visual proof. | high |
| Browser red attempt | Mac Chrome 151, stock-size Tutorial smoke on the same tree | The journey stopped before Create because its terrain assertion still expected the superseded `opaque-black-clear+native-layout` label while current main correctly reports `retail-editor-field-capture+native-road-layout`. The robe symptom was neither passed nor failed by that attempt. | high |
| Focused Air browser | Mac Chrome 151, production build from `4c608b42`, Tutorial -> College -> Air/Body Create -> returned Hub | Authority element `air`, primary row `24`, Hat tint, Robe tint, and live material tint all agree at `0x9FCACA`; the selected-element frame is coherent and error arrays are empty. | high-live |
| Focused Fire browser | same exact build and journey with Fire/Body | Authority element `fire`, primary row `16`, Hat tint, Robe tint, and live material tint all agree at `0x895E5D`, yet the unobscured frame makes the user-visible defect concrete: the garment is gray-brown/desaturated beside the vivid Fire Staff effect. This falsifies stale state/replication/renderer-cache explanations. | high-live |
| User product direction | explicit 2026-08-27 follow-up after the native exception/mix was explained | Ordinary web starter garments must visibly match their selected element; preserving the stock desaturated starter mix is not the requested web result. | high-product |

## System boundary and membership inventory

Native/product system: the starter-garment color identity beginning at a
wizard-generation color decision and ending at every persisted, replicated,
and rendered Hat/Robe consumer.

| Member | Native/product source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether, Fire, Air, Water, Earth ordinary starter families | `0x005CFA80` rows `8/16/24/32/40`; web starter kernel | `out-of-system` for final saturation (explicit selected-element web palette); lifecycle remains exact | exact base `FF19FF/FF1919/19FFFF/1980FF/00BF00`, white trim, and matching rendered family identity |
| starter Hat and Robe primary layers | item `+0x88`; sinks `Game+0x1428/+0x142C` | `exact-ported` lifecycle; explicit web palette applied | identical persisted tint and matching live composition |
| starter white secondary/trim layers and selector zero | item `+0x98`; Hat/Robe constructors | `verified-already-at-parity` | white trim on every family and consumer |
| Tutorial tan/orange Hat/Robe | Tutorial writers `0x005D5DA1..0x005D5E75` | `verified-already-at-parity` | remains independent of Ether Staff/VFX |
| pre-Create College green Hat/Robe | `DAT_00B3BCA0`, one-shot starter branch | `verified-already-at-parity` | retained only until successful Create confirmation under the current web product rule |
| successful College Create confirmation | browser product boundary over native one-shot guard | `exact-ported` lifecycle; explicit web palette applied | selected config, both garment items, Staff VFX, replication, and live renderer switch atomically |
| ordinary fresh New Game and post-Game-Over Create | selected-primary starter branch; web generation replacement | `exact-ported` lifecycle; explicit web palette applied | selected family owns the new generation; old tint cannot survive |
| save/reconnect and multiplayer snapshots | strict economy item protocol and save document | `verified-already-at-parity` | exact item tints and newer revision survive round trip on every peer |
| inventory, belt, SkillBook, living world, death, and memorial consumers | item icon and wizard attachment painters | `verified-already-at-parity`; starter fallback palette updated | one item value, no consumer-specific stale palette |
| named recipe, generated random, dyed, and mod clothing | recipe/random/dye/mod item owners | `out-of-system` (intentionally item-colored) | never recolored merely because wizard element changes |
| Staff orb and elemental spell VFX | separate selected-primary presentation owner | `out-of-system` as a garment writer; comparison cue only | selected element remains the visible identity reference |

## Native ownership thread

- `0x005CFA80` creates the starter Robe and Hat and writes their live item
  colors before attaching them to the gameplay sinks. The items, not the actor
  element field or renderer, own those colors afterward.
- `Item_Robe::RenderAttachment 0x00577DA0` and
  `Item_Hat::RenderAttachment 0x005758F0` consume the live item colors across
  their complete primary/secondary and dynamic/fixed layer membership.
- The web authority mirrors that lifetime with `HubInventoryItem.iconTints`.
  Snapshots, saves, and every renderer must consume the same item state.
- Generated, named, dyed, and mod wearables are sibling producers with their
  own item colors; they are not legal targets for an element-wide recolor.

## Confidence and open questions

- Confirmed: native owner/functions, all six starter color owners (five
  elements plus College), Tutorial override, item storage, web authority
  writers, consumer membership, current source/deployment identity, and clean
  canonical gate.
- Confirmed root cause: authority, replication, and the renderer agree. The
  stock `0x0040FC60` result currently stored for ordinary web starters mixes
  `80%` luminance with only `20%` of the selected channel, so Fire becomes
  `0x895E5D` in the reproduced generation and no longer reads as the vivid
  Fire family beside its Staff effect.
- Product decision: ordinary web starter garments use the exact selected-
  element base table without jitter or luminance mixing. The native roll/mix
  remains available for the authored pre-Create College branch and remains
  documented as stock truth.
- No browser-platform approximation is expected or permitted for this system.

## Web implementation consequence

- Keep `HubInventoryItem.iconTints` as the single garment-color owner.
- Add one selected-element appearance producer beside, not inside, the native
  random/mix function. It maps Ether/Fire/Air/Water/Earth to
  `0xFF19FF/0xFF1919/0x19FFFF/0x1980FF/0x00BF00` with white trim. Use it for
  fresh, confirmed-College, post-Game-Over, archive, legacy fallback, inventory,
  living, and death starter paths.
- Keep `rollNativeStarterEquipmentAppearance` for College and native evidence;
  do not recolor Tutorial, College before confirmation, dyed/generated/named/
  mod items, or add a scene-local CSS/Pixi patch.
- Reconcile persisted starter items on full-continuation restore and profile
  hydration only after both onboarding flags are clear. Advance the economy
  revision when migration changes Hat/Robe. Pending Tutorial/College colors and
  every item that fails the existing starter predicate remain byte-for-byte
  unchanged.
- Repair the stale terrain expectation only as needed to let the existing
  current-main Tutorial journey reach its wardrobe assertions; terrain behavior
  itself is outside this reopening.

## Validation contract

- Authority: cover all five elements, both starter items, fresh/College/post-
  Game-Over transitions, Tutorial exception, revision advance, saves, and
  multiplayer snapshots.
- Browser: stock-size Mac Chrome must cross Tutorial -> College -> Create,
  choose a non-Ether element, then prove selected config, both item tints,
  rendered robe tint, and Staff effect agree in the returned Hub. Capture an
  unobscured frame and empty page/console/failed-response arrays.
- Cross-surface: inventory and living-world receipts must expose the same item
  tint; intentional dyed/generated/mod clothing remains unchanged.
- Save migration: a current-schema completed-onboarding save carrying the old
  muted starter tint must restore/hydrate to the selected palette with a newer
  economy revision; pending Tutorial and College saves must retain their
  authored colors.
- Run the complete Mac canonical gate again on the final byte-identical
  candidate, then rebase if `origin/main` moved and repeat before publication.

## Implementation validation receipt

- `native-starter-equipment.ts` now keeps two explicit owners: the unchanged
  native jitter/luminance roll used by pre-Create College, and the ordinary web
  selected-element palette `FF19FF/FF1919/19FFFF/1980FF/00BF00`. Fresh economy,
  completed-run archive, and accepted generation replacement use the latter.
  Starter/default world/death and Inventory/Belt/SkillBook fallbacks consume
  the same table. Tutorial and College special colors and every item-owned
  named/generated/dyed/mod path are unchanged.
- Full-continuation restore and profile hydration selectively migrate only
  completed-onboarding starter Hat/Robe items from prior muted tints, advance
  the economy revision once, and preserve pending College green. The registered
  save regression covers both restore modes and the negative College branch.
- The new all-five economy regression failed red on the Mac exactly as
  intended: Air produced `0x9CC8C8` instead of `0x19FFFF` (`311/312` tests
  passed). The first green attempt exposed float-pack rounding (`0x1AFFFF`),
  so the requested packed palette is explicit rather than inferred from float
  `0.1`.
- The final byte-identical Mac candidate passes the complete canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate: all backend/Website,
  registered frontend/host, lint, type, desktop, build, bundle-budget, and
  media-policy contracts are green. Final bundle is `251,319` raw / `76,429`
  gzip; combined log SHA-256 is
  `4ad9485bc874c55d49ef51c3fd7aa28cc8387fe6dab2687d3337e04deef1264f`.
- Mac Chrome 151 completed five independent stock-size Tutorial -> College ->
  Create -> returned-Hub journeys. Ether/Fire/Air/Water/Earth respectively
  report `FF19FF/FF1919/19FFFF/1980FF/00BF00` for authoritative Robe tint,
  live material tint, and expected selected palette, with matching primary
  rows `8/16/24/32/40`, completed saves, and empty page/console/failed-response
  arrays. Browser log SHA-256 is
  `84c58cceab48959d1f1c0d5bb65feb7ea983d4c2155fecabdcded4fc8d078120`.
- The five unobscured selected-wizard frames have SHA-256 values Air
  `b2d25dbfa22709cbe412a6fc8a8f217e4754127ecd2c9456aabe7b5a920bffc0`,
  Earth `e7b32252d00dd173f3d3246c83b6c480202f048cc8bd5b573b0c03756aeb454b`,
  Ether `599b36f0309c3b9565a8bd8b2e1b5c8e407a4a1f33ca678df844d2c666bf38f2`,
  Fire `b7d4bda28a4dc55d6f81ff9d138660fd5c7f8188f01dd847f0a8d45fc7c373cc`,
  and Water `0cd6a7752b9c9b1f9a3d92699500c0f843a495bd3d10269208499bb7179b2f4a`.
  Visual inspection confirms the garment and selected element now read as one
  color family, including vivid red Fire and green Earth.
- The exact post-migration candidate repeated the Fire journey, including the
  pending-College save reload. It retained College tint `0x6F7E72` before
  confirmation, then returned with element/robe/material `0xFF1919`, primary
  row `16`, completed onboarding bits, and empty error arrays. Browser log
  SHA-256 is
  `b559f86fd1b7983722b6d43b2c77ace65c74f32a5f1c9ae3b34bdc999c2ddb2b`;
  the inspected final frame SHA-256 is
  `807c177fd041054cc12b4ae11168a0fee38ca8e7035830d921d16f133af10f6f`.
- Publication rebase preserved concurrent enemy targeting/navigation
  `c59c27af`, welded-clock `7c4eae0f/9691cd7d`, and Damage x4 Staff VFX
  `21b51c51`. A fresh detached Mac worktree at that exact base plus the focused
  16-file manifest was byte-identical to rebased candidate `f9b8da20`.
- The complete rebased Mac gate passed 27 backend/Website contracts, every
  registered frontend/host/desktop suite (including the expanded 1,715-test
  Boneyard group), strict lint/type/boundary/generated checks, both production
  builds, media policy, and the bundle budget (`251,319` raw / `76,425` gzip).
  Final rebased gate-log SHA-256 is
  `09c9180497902da8875dc67635fbcbbf8a155bb9df55a72ce088edb0532a3183`.
- Final rebased Mac Chrome repeated the pending-College reload and Fire Create
  journey with College `0x6F7E72` before confirmation and selected element,
  Robe, and material all `0xFF1919` afterward. Primary row `16`, completed
  onboarding/save state, and empty error arrays remained exact. Browser-log
  SHA-256 is
  `7eed2b237444a465ebe1b1cc6c5c31b0af69d36db4c86b9ad7cc99d6c80d3a80`;
  reviewed frame SHA-256 is
  `e96287bb7b886625f08397252a1a4f2357cdb35454c590a705cad25fa631b0a1`.
- No browser-platform member is blocked and no material unknown remains. Push
  and deployment remain separate publication steps after the final rebase.
