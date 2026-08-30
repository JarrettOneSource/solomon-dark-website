# 2026-08-24 — Solomon Dig dirt actor and state-0 presentation closure

> **2026-08-29 correction:** the Flydirt ownership conclusion survives, but
> the parent presentation and lighting descriptions were incomplete. State 0
> clips the body to `(actor.x-100,actor.y-100,200,100)`, applies planted field
> `+0x21C=5` plus the bob, restores the clip, and only then draws record 13.
> `0x004A2610` installs the scalar sampled at `(x-22,y-62)` after those parent
> children, so it tints Flydirt only. The former body/grave/mouth tint and the
> phrase “body/shadow under the source-root multiplier” are refuted. See entry
> 297's second reopening for all five Solomon states.

## Reported smell and parity question

- Reported web behavior: Solomon Dig performs the digging animation and plays
  the recovered shovel/throw-dirt sounds, but no dirt leaves the shovel.
- Stock behavior to recover: the complete state-0 visual emission owner,
  including birth edge, exact art, flight, fade, painter/lighting order,
  authority, late join, interruption, and teardown.
- Reproduction scene: every Boneyard that materializes type-5009 Solomon in
  state 0; the default opening mode 10 is the browser acceptance path.
- Falsifiers: dirt is embedded in a Solomon body frame rather than a child;
  more than one dirt class/style/caller exists; motion consumes the RNG scalar
  at Solomon `+0x24C`; audio mute gates construction; or the child is sorted,
  lit, serialized, or retired independently of Solomon's child manager.

This reopens the 2026-08-20 digging-audio entry. That pass found the
`Anim_Flydirt` call but declared the visual actor a separate future system even
though the same state body owns its cursor edge, audio cue, child construction,
RNG order, and interruption. It also called `+0x24C` the dirt motion scalar.
The complete trace proves that field drives Solomon's own body bob and the dirt
actor is fixed and RNG-free. Splitting those outputs was the skipped
system-boundary rule behind this second report.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; canonical read-only Ghidra replicas; state 0 `0x00481FC0`; call `0x00482155`; constructor `0x00453A70`; vtable `0x00784F34`; update/render `0x00453AC0`/`0x00458300` | Strict dirt edge, one constructor xref, fixed spawn/flight/fade, two identical draw calls, and mark/remove lifecycle are instruction-proved. | high |
| Ownership instructions | `ObjectManager` constructor/update/render/destructor `0x00402070`/`0x004022A0`/`0x004023F0`/`0x00402190`; Solomon render/destructor `0x004A2610`/`0x0047D010` | Dirt is a Solomon-owned transient, updated before state and drawn after the body under the source-root Region light multiplier; owner teardown frees it. | high |
| Asset/data | retail `Solomon.bundle` / `Solomon.png`, hashes `a4d85b56f79486361a4ae18a6b4bc2bc1c0e28ba1a57f96ef68cc64e09e9cafa` / `057a3661340a3a099cf88c491d88c4268d82b8bb48ab29d214961ce701140126`; record 0 | One `28x46` cell at atlas `(590,975)`, origin `(0,0)`; exact optimized crop SHA-256 `1a2631f8022e0bef521aa112e4059c9ab7df5f6bfafbe6235972b92788ee95e7`. | high |
| Membership sweep | `refs_to_addr_decompile.py 0x00453A70`; `catalog_native_classes.py '^Anim_'`; Solomon builder `0x004ED980`; placement dispatcher `0x00467230` | One caller and one dirt class exist. The other 83 `Anim_*` RTTI classes have distinct vtables/consumers; Solomon record 1 and no-actor placement branches are not dirt variants. | high |
| Existing durable evidence | Mod Loader `native-solomon-dig-and-wave-director.md`, corrected in this pass; Website audio/encounter entries | The cursor, audio pools, event IDs, host RNG, placement, body banks, Region light, and state transition already have authoritative owners. | high |
| Current web owner trace | `core-kernels/boneyard-encounter.ts`, protocol 70, `renderer/boneyard-solomon-render.ts`, `renderer/boneyard-world-renderer.ts`, `renderer/boneyard-textures.ts` at base `4021fce` | The host consumes the body-bob RNG draw but discards its value; digging body offset is fixed at zero; the audio-only event has no birth tick; record 0 and a dirt view do not exist. | high |

Addresses are preferred-image virtual addresses at image base `0x00400000`.
No runtime/ASLR address or injected-loader sample is used as instruction truth.
The user's clean-stock observation establishes the visible smell; exact pixels,
motion, and ownership come from the sealed retail instructions and asset data.

## System boundary and membership inventory

Native system: the type-5009 state-0 digging presentation owner, from the
authoritative cursor through Solomon body bob, throw-dirt semantic event,
`Anim_Flydirt` child flight, two-pass rendering, and owner teardown.

| Member | Native source | Disposition | Proof required by this pass |
| --- | --- | --- | --- |
| body bob amplitude/current offset | `0x00481C20`, `0x00482212..0x004822AF`, `0x004902C0` | exact-ported | float32 half-sine tests and body-offset render assertion |
| dirt birth at strict cursor `>15` | `0x0048208E..0x00482176` | exact-ported | one event/child per armed cycle; same tick as throw-dirt cue |
| initial position/heading/speed/alpha | `0x00482124..0x00482155`, `0x00453A70` | exact-ported | constructor-state assertion |
| 29-sample flight/fade/retirement | `0x00453AC0`, vtable remove slot `+0x18` | exact-ported | fixed-tick golden at ages 0/1/28/29 |
| Solomon record 0 | builder destination `+0x38`, renderer `0x00458300` | exact-ported | source hashes, `28x46` geometry, exact PNG hash |
| two identical source-over passes | two calls in `0x00458300` | exact-ported | render plan/view contains exactly two co-transformed sprites |
| Flydirt-manager Region lighting | `0x004A2610` query at `(x-22,y-62)`, installed after state renderer | exact-ported after 2026-08-29 correction | body/mouth/record 13 remain white in this local scope; dirt receives the sampled scalar; Lantern remains independently lit |
| ordinary connected host/client | semantic state-0 event | exact-ported | replicated birth tick and age-corrected peer plan |
| muted/disabled audio | Sound gate is downstream of semantic event; child call is unconditional | verified-already-at-parity | mute suppresses playback only; dirt event/view still advances |
| late join/hydration | child manager is not in serializer `0x00473C40` | exact-ported | history initializes cursor without replay; future dirt appears once |
| contact during a live child | state transition occurs after birth/offset work; child manager remains live | exact-ported | no later births, existing 29-tick child completes |
| owner/run/scene teardown | `0x0047D010 -> 0x00402190` | exact-ported | view destroys both passes and event cursor with the Solomon/run owner |
| placement modes 2..5 and opening 10 | one type-5009 state body | verified-already-at-parity | shared implementation, no mode-specific dirt branch |
| placement modes 6..9, zero candidate, duplicate suppression | no type-5009 actor | out-of-system (no producer or owner exists) | `solomonDig: null` negative assertion |
| Solomon states 1..4 | no dirt constructor call | verified-already-at-parity (no new births) | phase test plus live-child natural completion |
| Solomon record 1 | builder `+0xFC`, never read by dirt renderer | out-of-system (not a dirt variant) | asset-consumer trace |
| other 83 RTTI `Anim_*` classes | complete class census | out-of-system (separate constructors, vtables, assets, and gameplay owners) | constructor/vtable census |

No member is blocked by the browser platform. Pixi/WebGL directly represents
the registered texture, float motion, rotation, source-over double submission,
multiplicative tint, fixed lifetime, and owner-local teardown.

## Native ownership thread

- Owner/construction: state 0 creates `Anim_Flydirt` inside Solomon's embedded
  child `ObjectManager +0x254` only when the dirt armed byte first sees cursor
  `>15`. Construction follows the throw-dirt sample selection but is not gated
  by playback success or settings.
- Upstream state: the host cursor/RNG path already owns strict gates and wrap.
  `Float(5)+5` initializes body-bob amplitude, not child motion.
- State representation: the body offset is
  `f32(sin(pi*((cursor-3)/12))*amplitude)` for `3 < cursor <= 15`, zero outside.
  The dirt child owns position, heading, speed, and alpha only.
- Downstream: manager update advances existing children before state 0, so a
  new dirt child renders at age zero. Solomon's main render draws the clipped
  body and unclipped record 13, installs the Region scalar sampled at
  `(x-22,y-62)`, then renders the child list and restores draw state.
- Interruption/teardown: contact prevents future births but does not kill the
  current child. Alpha retirement removes it before render on update 29. Owner
  destruction clears every remaining child.

## Recovered behavioral contract

- Birth: position `(solomon.x-22, solomon.y-62)`, heading `35`, speed `2`,
  alpha `1`; no RNG, collision, shadow, hit test, light source, or gameplay hit.
- Update: move by `speed*(sin heading,-cos heading)` with float32 stores; then
  speed `*= 0.9750000238418579`, heading `+=2`, alpha
  `-=0.03500000014901161` with float32 store/clamp.
- Lifetime: ages `0..28` render; update 29 marks/removes before render.
- Render: exact Solomon record 0 is centered at its registered origin, rotated
  by heading, and submitted twice consecutively source-over with the same alpha
  and source-root light tint. It remains inside Solomon's painter block.
- Authority: one semantic dig event carries cue, monotonic ID, and authoritative
  birth tick. Audio and dirt are sibling consumers. Clients may age-correct to
  snapshot tick; late hydration does not replay event history.

## Nearby-system findings

- The earlier audio ledger's “next dirt child's motion scalar” is refuted.
  `+0x24C/+0x250` are body-bob amplitude/current offset and renderer
  `0x004902C0` adds the latter to body Y. This pass replaces the assumption in
  both native and web documentation and implementation.
- Protocol's `digAudioEvents` name is now too narrow: the same native event
  triggers audio and art. The cohesive model is `digEvents`, with audio and
  dirt consumers, not a visual side channel inferred from wall time.
- No `Anim_Flydirt` sibling, enhanced-effects row, or random art selector
  exists. Adding variety would diverge from stock.

## Confidence and open questions

- Confirmed: complete caller/vtable/class membership; owner and lifecycle;
  birth order; all constants/formulas; record and registration; double draw;
  lighting/painter order; state/placement branches; authority and serializer
  boundary.
- Inferred: none used for implementation.
- Unknown: none inside this system boundary.

## Web implementation consequence

- Keep cursor, bob amplitude/current offset, semantic event ID/cue/birth tick,
  and RNG ordering in `boneyard-encounter.ts`.
- Rename the audio-only event seam to the shared semantic `digEvents`, bump the
  strict protocol, and preserve bounded ordered history.
- Add a cohesive dirt presentation kernel and Solomon-owned Pixi view using the
  exact record-0 asset and two sprites. Do not create a general particle engine.
- Sample a dedicated dirt tint at the native source root; keep body and lantern
  samples unchanged.
- Remove the discarded/misnamed debris draw and zero digging-body offset.

## Validation contract

- Focused kernel tests: body half-sine gates/amplitude; dirt state at birth,
  updates 1/28, removal 29; no RNG; event/cue/tick order; no post-contact birth.
- Asset/render tests: retail source hashes, exact `28x46`/PNG hash, two identical
  source-over passes, centered registration, positive native rotation, body
  offset, dedicated source-root tint, and teardown.
- Protocol/client tests: protocol bump, strict finite nonnegative event tick,
  ordered bounded history, interpolation copy, late hydration no replay, peer
  age correction, and muted audio independence.
- Mac browser journey: default Boneyard must observe repeated dirt births on
  the same event IDs/ticks as throw-dirt cues, two live passes, changing
  position/heading/alpha across fixed ages, no new birth after contact, natural
  retirement, body bob, and empty page/console/failed-response arrays.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`;
  the sibling Mod Loader `python3 tests/re/run_static_re_tests.py --ci` must pin
  the corrected native report.

## Implementation validation receipt

- `core-kernels/boneyard-encounter.ts` now retains the constructor/wrap
  `Float(5)+5` body-bob amplitude, computes the native float32 half-sine body
  offset, and publishes one bounded `digEvents` lane with cue, monotonic ID,
  and authoritative birth tick. Audio and dirt consume the same event; protocol
  71 validates ordered IDs/ticks and the bounded bob offset. Save normalization
  migrates the former audio-only ID without replaying historical dirt.
- `renderer/boneyard-solomon-dirt-presentation.ts` reconstructs the fixed
  age-0 through age-28 flight, alpha, heading, and retirement with no RNG.
  `BoneyardSolomonView` owns two identical source-over Pixi sprites after the
  body/mouth, applies the separately sampled source-root Region tint, preserves
  a live child across contact, and destroys every child with the Solomon view.
  The exact 28-by-46 record-0 PNG is checked in at SHA-256
  `1a2631f8022e0bef521aa112e4059c9ab7df5f6bfafbe6235972b92788ee95e7`;
  its extractor pins both retail Solomon source hashes and record geometry.
- Focused coverage pins strict cursor/event order, RNG sequence, bob gates and
  amplitude, birth/update ages `0/1/28`, removal at 29, two equal draw passes,
  hydration without replay, contact cutoff, exact asset hash/size, painter
  ownership, dedicated lighting root, protocol rejection, interpolation copy,
  audio request identity, and current-save migration. The complete Mod Loader
  Mac suite passed `499/499` on base `49fe4b9e`; log SHA-256 is
  `6af8610d1c86a0dd32c114be287c46f3eabca245aca182b1b747f106d7745fac`.
- On Apple arm64 macOS 26.6.2 with Node 22.17.0, npm 10.9.2, .NET 10.0.302,
  and Chrome 151.0.7922.170, the manifest-identical Website candidate on base
  `7a352805` passed `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend
  build with zero warnings/errors; 22 backend contracts; formatting, lint,
  generated-policy, and import boundaries; frontend groups
  `9/4/45/267/1489/6/77/9/63/12/15/7/36/55`; five desktop tests; production
  frontend/GameHost builds; bundle budget (`460899` raw / `129580` gzip against
  `524288` / `131072`); and media policy. The retained gate log SHA-256 is
  `8015f41d69430122b22f1d12c81b809fc23520f5fdd64d5898f34dd4be344bff`.
- The final built-production 1600-by-900 Mac Chrome journey dismissed the
  stock Tutorial prompt with its explicit `NO` action, crossed the physical
  entry Gate, approached Solomon, and captured dirt event 78 on screen. It
  compared 22 rendered samples from age 3 through 28 against the exact kernel:
  alpha fell `0.8949999213 -> 0.01999967545`, heading advanced `41 -> 91`,
  position moved `(912.62213,2212.93994) -> (942.47766,2197.29907)`, and every
  sample had one child, exactly two passes, and `audioEventId == eventId`.
  The child retired naturally, the later body bob measured
  `1.710616111755371`, and speaking/contact retained no live dirt or new event.
  The journey continued through Solomon's run edge and an 11-enemy opening
  threshold with empty page/console, failed-response, wire-error, and
  outside-combat-enemy arrays.
- Browser log SHA-256 is
  `98a49d9c8198f0aab84cac42e6665598a61734e0b070c3bff0125ce7591a7bfc`.
  The visibly inspected near-Solomon dirt frame is
  `/tmp/solomon-dig-dirt-browser-visible-20260824-dirt.png`, SHA-256
  `bf5911ad24889590ca7d61c2170f943b35f66206f3e00d9cd6ff99a9860e0c81`;
  speaking and combat captures are respectively
  `5afa8f6b894268cb2d3dc825e0f2de3a2c07c85305ac7c2144a97a37c7df1901`
  and `61e3523746cf7dac59c50579704549103a86f826315a8d54d3da4a88ec1d5acf`.
- No member is blocked by the browser platform and no unknown remains inside
  the declared state-0 presentation boundary. Publication and deployment were
  not requested and were not performed; the focused Website and Mod Loader
  worktrees remain for review.
