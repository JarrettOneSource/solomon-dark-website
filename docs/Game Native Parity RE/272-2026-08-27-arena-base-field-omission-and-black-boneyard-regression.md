# 2026-08-27 — Arena base-field omission and black Boneyard regression

## Reported smell and parity question

- Reported web behavior: a Boneyard that looked correct earlier in the day is
  now almost entirely black after a recent push. Props, actors, HUD, and small
  authored surface islands remain, but the lit ground disappears.
- Exact regression boundary: Mac Chrome rendered the same frozen mode-0
  Building/Monument fixture at `ced3632a` and `ec98c44e`. Before the latter
  commit, the player light reveals continuous ground. After it, identical
  Region-source diagnostics reveal only actors and props over black.
- Stock behavior to recover: Arena's complete base-field family — opaque clear,
  mode-selected DeadHawg 20/21 lattice, normal source-over fragment path,
  the immediately following Arena `+0x110` pass, both Region-composite
  branches, and teardown.
- Falsifiers: the `ec98c44e` boundary does not reproduce the black frame; the
  field calls select a non-normal blend; raw field submission restores the
  earlier Website visual without white mattes; or the tracked ground capture
  is a native runtime asset.

This reopens the 2026-08-27 Arena field/Road entry above. That pass correctly
removed Canvas2D Road approximations but removed the known-good continuous web
ground before the complete native Arena surface owner had been mirrored.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Mac differential | clean detached Website `ced3632acc5e87ae744dd7237031a3e258735433` versus `ec98c44ec5001802946289e833a3df5a0e8010fb`; `smoke-boneyard-building-lighting.mjs`; 1600x900 Chrome/WebGL2 | The same fixture changes from visible lit ground to black ground at the surface commit. Both runs retain one player source, Region multiply, four Buildings, 21 Monuments, and empty browser-error arrays. | high |
| Current source | `native-boneyard-surface-view.ts`, `boneyard-world-renderer.ts` at `origin/main 0bf893b6` | The surface root contains Roads only. The application clears opaque black, and the post-Road resident bank has only authored Terrain/compact pixels. DeadHawg 20/21 are neither preloaded nor submitted. | high |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Matches the canonical analyzed retail 0.72.5 image. | high |
| Arena instructions | canonical read-only Ghidra replica; `Arena::Render 0x0046EC80`; calls `0x0046F528 -> 0x004142E0` and `0x0046F651 -> 0x004142E0`; Region composites `0x0046FAFA` and `0x00470102` | Mode 0 draws record 21; modes 1/2 draw record 20. Every field draw precedes RegionLayout and both Complex-Lighting composite branches. | high |
| Renderer state | reset `0x0041D000`; dispatcher `0x004208A0`; Arena writes `0x00470318/0x00470397`; main-target restore `0x0057D5E0` | Blend request starts at selector 0 (`SRCALPHA,INVSRCALPHA`). Arena's only blend writes select multiply later and restore selector 0 before return. No state write occurs between target restore and field draws, so the field is ordinary source-over, then Region-multiplied. | high |
| Asset/data | DeadHawg records 20/21, static Sprites `0x00B2F2A4/0x00B2F368`; tracked crops SHA-256 `0d82c1db7df1f92aaa7e0a34c79350fabbd6de24a4f97ae444cd8c3379a0a950` and `040c2efb55dd57daf68b52b8108aea98a7c053567cebcbd62a008107a5e33db5` | Record 20 is a 102x77 inverse oval used on a 200-unit lattice; record 21 is a 43x35 black alpha ring registered inside a 200x200 logical cell. | high |
| Native sibling | `Bonedit::Render 0x004D5F40`, draw `0x004D6223` | Bonedit always uses record 21 on the same 200-unit lattice. It confirms shared record/registration ownership but is not a Website `/game` scene. | high |
| Live debugger | task-owned loader session, retail image base `0x000C0000`; WinDbg breakpoints at runtime `0x0012F534/0x0012F65D` (preferred calls `0x0046F534/0x0046F65D`) | Both record-21 and record-20 calls have white `0xFFFFFFFF`, blend selector/cached selector zero, texture-stage selector zero, and saturation request/cached value `.65`. The source-over conclusion is confirmed live. | high |
| Browser falsification | first exact-field candidate in the frozen fixture and deterministic real Boneyard | Raw record 20 below the Region composite produces exposed white 102x77 rectangles in both frames. The candidate is rejected; the field call cannot be ported alone as the complete base surface. | high |
| Arena vslot ownership | live Arena vtable `+0x110` resolves to preferred `0x00470EE0`; caller `0x0046F6BE` is immediately after the field loop | `0x00470EE0` is not merely a late player aperture. It is a large Arena surface/object pass containing three manager families, compact spatial results, per-player environment work, nested targets, and restore paths before Region multiplication. The previous ownership statement was incomplete. | high |

The static addresses use the canonical read-only project. The live supporting
session used the same retail hash with image base `0x000C0000`; preferred and
runtime addresses are kept explicit above. Loader injection supplied debugger
access only and is not treated as clean visual evidence.

## System boundary and membership inventory

The native Arena surface system remains reopened because the complete
`0x00470EE0` membership is larger than the previously documented direct-light
branch. The user-requested repair boundary is the Website regression itself:
restore the exact pre-`ec98c44e` visible ground policy without reverting the
new exact Road mesh or mislabeling the policy as retail runtime parity.

| Member / branch | Source | Disposition for this repair | Proof contract |
| --- | --- | --- | --- |
| known-good continuous web ground | tracked `arena-ground.webp`, SHA-256 `dabc48e7af0220283889647f57cde6442aecc79629555ce9104815ebadbdb070` | exact-ported Website policy | one world-anchored repeat mesh under Roads and Region light |
| modes 0/1/2 | prior Website runtime behavior | exact-ported Website policy | the continuous web ground exists in every generated mode, as before the regression |
| Road styles 0..4 | `0x0064C1F0/0x00640750` | verified-already-at-parity | exact indexed meshes remain above the restored ground |
| Terrain and compact authored detail | existing post-Road resident bank | verified-already-at-parity | unchanged above ground/Road and below Region light |
| Region raster/analytic lighting and both composite branches | existing lighting owner | verified-already-at-parity | restored ground is multiplied and sampled by the existing paths |
| raw DeadHawg 20/21 field submission | live-confirmed native calls | out-of-system for this repair (incomplete without the full `0x00470EE0` pass) | rejected browser frames are retained as falsification, not shipped |
| complete `0x00470EE0` manager/compact/player/nested-target family | Arena vslot `+0x110` | out-of-system for this repair (separate reopened native closure) | no partial second port or completion claim |
| Bonedit record-21 sibling | `0x004D5F40/0x004D6223` | out-of-system (native authoring scene) | unchanged editor behavior |
| replacement/failure/destroy | Website surface owner | exact-ported Website policy | one mesh/texture owner, no per-frame allocation, exact teardown |

No member is browser-blocked. The predicted visible difference is explicit:
the repaired Website keeps the earlier continuous retail-editor-derived ground
in modes where a fully mirrored retail `0x00470EE0` surface may differ.

## Native ownership thread and corrected consequence

- The raw field facts are confirmed: mode 0 uses record 21; modes 1/2 use
  record 20; both are ordinary source-over under `.65` saturation.
- The prior ledger placed `0x00470EE0` late and described only its per-player
  light branch. The live vtable and caller prove it begins immediately after
  the field loop and before the Region compositor. Its earlier manager loops,
  compact spatial render, nested target work, and later player branches are one
  Arena owner.
- Porting only the raw field was therefore another partial-system mistake. Its
  white rectangles are not acceptable even though its individual Sprite call
  is instruction-accurate.
- The user's requested observable is the known-good earlier Website surface.
  This repair restores that tracked field capture as an explicitly named web
  policy layer, then preserves exact Roads, authored detail, Region lighting,
  shadows, saturation, HUD order, and teardown above it.

## Confidence and open questions

- Confirmed: regression commit, before/after pixels, field records/calls/state,
  live image base, immediate `0x00470EE0` ownership, raw-field visual failure,
  and exact prior Website ground bytes/order.
- Unknown outside this repair: the complete class/list disposition of every
  earlier and nested branch in `0x00470EE0`. No native-parity completion claim
  is made for that reopened system.

## Web implementation consequence

- Add one Arena-bounds mesh using the tracked 512x512 repeat texture before the
  exact Road root in `NativeBoneyardSurfaceView`.
- Run it through the existing Arena fragment shader and Region-light boundary;
  preload/destroy it under `BoneyardWorldTextures` with no frame allocations.
- Publish `retail-editor-field-capture-web-override` diagnostics so the policy
  cannot be mistaken for a newly extracted retail texture.
- Do not submit DeadHawg 20/21, reintroduce Canvas2D Road approximations, alter
  light constants, or disturb Terrain/compact, actor, shadow, HUD, gameplay,
  audio, or network owners.

## Validation contract

- Focused tests pin the ground SHA-256, Arena-bounds quad, world-anchored
  512-unit UV repeat, full-white vertex input, ground-before-Road order, native
  surface shader, and teardown.
- The 1600x900 WebGL2 differential must turn the exact lit empty sample from
  `0` non-black pixels into textured ground, require more than eight distinct
  RGB values, and reject maximum RGB totals at or above `700` so neither the
  black regression nor raw white record-20 mattes can pass.
- Real Tutorial/default Boneyard captures must show continuous textured ground
  with no white rectangles, while exact Road/Terrain/compact/Region diagnostics
  and empty page/console/failed-response arrays remain.
- The exact rebased Mac candidate must pass focused tests and
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.

## Implementation validation receipt

- Causal result: Website `ec98c44e` removed the continuous web ground while
  deliberately excluding DeadHawg 20/21. The exact Mac A/B reproduced the
  user's black frame. Static and live tracing then proved the raw fields are
  source-over, but live vtable ownership reopened the much larger immediate
  `0x00470EE0` Arena pass. A raw-field candidate was rejected after both the
  empty fixture and real Boneyard exposed white 102x77 rectangles.
- `NativeBoneyardSurfaceView` now owns one immutable Arena-bounds ground mesh
  before its exact Road root. `BoneyardWorldTextures` preloads the tracked
  512x512 field capture once with repeat addressing. The mesh shares the Arena
  fragment shader and Region-light boundary; Terrain/compact, actors, shadows,
  weather, HUD, simulation, audio, protocol, and network code are unchanged.
  Diagnostics label it `retail-editor-field-capture-web-override`, and both
  mesh/texture owners are destroyed with the Boneyard renderer.
- Red/green Mac WebGL2 evidence is direct: the broken candidate sampled
  `0` non-black pixels and RGB total `0` at a lit empty point. The repaired
  candidate samples all `289` pixels as non-black, with `170` distinct RGB
  values, RGB total `40,196`, and maximum RGB total `291`; the same oracle
  rejects the raw white field at maximum `>=700`. Four Building variants and
  all 21 Monument variants retain their light-dependent pixel deltas and zero
  base/roof color mismatch. The reviewed focused frame SHA-256 is
  `56e74a3832e18a4156be7c7c74003bee8b7fd862f17c7d9c45329943b824da55`.
- The rebased Mac focused matrix passes 51/51 surface/render contracts plus the
  complete TypeScript test configuration. The first canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` pass completed 27 backend/
  Website contracts, all registered frontend/host suites, 77 ML tests,
  production builds, media policy, and bundle budget (`251,319` raw /
  `76,426` gzip); log SHA-256 is
  `2cd7b7786e76c85acbb448cf8e7ea65d8605a0b0088e100da7eda2b438edf4ca`.
  The exact post-receipt/tool tree is rerun at
  `/Users/jarrett/codex-acceptance/boneyard-lighting-regression-20260827-final/validate-final.log`.
- The paired Mod Loader registered static RE suite passes 522/522 on the Mac;
  log SHA-256 is
  `bbcb34c3f86e64ddce1c5ef3beb584aa1123a8ca60aa1695b4267504da632f26`.
- Production-build Chrome completed the deterministic Solomon opening with
  status `ok`, 38 active Road meshes / 684 indices / 304 vertices, and empty
  page, console, failed-response, and wire-error arrays. The inspected speaking
  and dirt frames show continuous textured ground with no raw white rectangles;
  SHA-256 values are
  `4b2cc9f45ad11aa35e9b964ff6a14d8ec8c8f979014a1bbcce23cb1786982b8d`
  and `3292164046abe5edc14d11a6838ac5b41db2bfbdb2836fef87bc51dbeafe9805`.
  Browser-log SHA-256 is
  `2e483c989ede361a6ef2cb7d427bb17687f6f0f52187eafc1d8b6c0177c83170`.
- No browser constraint blocks this repair. The one explicit predicted stock
  difference is the restored, earlier Website continuous ground policy while
  the broader native `0x00470EE0` surface family remains reopened. No push,
  deployment, production cutover, or service restart was requested or
  performed.
