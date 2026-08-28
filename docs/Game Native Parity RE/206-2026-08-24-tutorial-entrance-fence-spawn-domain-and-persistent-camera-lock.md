# 2026-08-24 — Tutorial entrance-fence spawn domain and persistent camera lock

## Reported smell and parity question

- Reported web behavior: Tutorial enemies sometimes materialize south of the
  continuous entrance Fence, inside the player's retired spawn strip, and can
  remain separated from combat by the Fence/Gate collision owner.
- Stock behavior to recover: exact near-player sampling and UID-group cache
  semantics; placement-policy/collision order; whether stock tests Fence side
  or path connectivity; and the complete authored camera-lock/cleanup lifetime
  that may constrain the normal spawn context.
- Reproduction: exact Tutorial scene, opening group 10010, player legally on
  the combat side at `(700,1525)` and at the natural confrontation latitude
  `(1025,1350)`, over 512 deterministic seeds each.
- Falsifiers: a stock fence-side query, a group-wide raw point in all six rows,
  a 300-tick native unlock, a server-side Tutorial domain already present in
  the web port, or a collision-only failure confined to the Fence line.
- This is a secondary report against the Tutorial system closed on 2026-08-23.
  That pass violated the complete ownership/membership rule: it recorded the
  camera trigger and group member lists but did not drain UIDGroup `+0x58`,
  follow the target through authoritative placement and the actual renderer,
  or distinguish the cleanup sleep from lock lifetime.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Web source | untouched Website `10017c42`; `native-tutorial.ts`, `boneyard-world.ts`, `boneyard-collision.ts`, `boneyard-world-renderer.ts` | One raw angle is drawn per batch; every member independently retries that same root. Spawn placement uses full Tutorial bounds. `camera()` clamps only while the cleanup countdown is nonzero; the actual render path never uses the Tutorial lock. | high |
| Deterministic Mac reproduction | detached Apple-arm64 tree at `10017c42`; exact stock scene/collision plus real Tutorial intents/materializer | At `(700,1525)`, 378/512 seeds put at least one opening skeleton south of the solid Fence, reaching `y=1851.57`; at `(1025,1350)`, 248/512 fail, including roots beyond `y=1687.92`. The roots are far clear of Fence geometry, falsifying a thin collision-gap cause. | high |
| Retail identity | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical image used by fresh Ghidra and clean observation. | high |
| Exact level data | `tutorial.boneyard`, 33,220 bytes, SHA-256 `97802f2ca45d9bc6f90a497e7c12a55926298161e191fa70eee5e666b90106ed` | Entrance chain is Fence rows 0..15 at approximately `y=1605..1627`, with segment-code-2 Gate gap `x=933.454345703125..1118.454345703125`; spawn is `(1025,2070.0703125)` on the south side. | high |
| Fresh canonical Ghidra | `0x00401170`, `0x00410C50`, `0x00463BE0`, `0x00463D30`, `0x00464B20`, `0x00465E40`, `0x00466200`, `0x00469580`, `0x0046C710`, `0x0046C790`, `0x0046D000`, `0x0046E570`, `0x004728B0`; raw `0x00463D30/0x00463BE0` instructions and complete xrefs | Fresh player/direction sampling per spawn call; one authored shared-final-root row; policy 0 accepts light scalar `<=0`; no Fence-side/path-component test; persistent target and recursive local camera; 300 ticks delay cleanup only. | high |
| Clean stock | direct uninjected PID 14644 from task-owned retail copy, started `2026-08-24 17:14:40-04:00`; five loaded modules; 1600 x 900 | Fresh player crossed the entrance and confronted Solomon. Opening skeletons appeared on the combat side in the observed run. Capture `11-solomon.png` SHA-256 `86114c009a436722b88afdc2bc2e6aa67c73eb8ed84842036c67e7ab9a024dd8`. | high for observed run |
| Durable native correction | `Mod Loader/docs/re/tutorial-mechanics.md`, “Tutorial entrance-fence spawn and camera-lock correction”; `config/binary-layout.ini` | Owns full caller census, complete six-row `+0x58` table, exact camera target/current fields, cleanup membership, and the explicit absence of a stock no-south guarantee. | high |

## System boundary and membership inventory

Native/web system: every Tutorial enemy birth from authored script/group
selection through raw near-player sampling, policy/collision adjustment,
entrance-domain admission, registration, camera target/current presentation,
300-tick off-camera cleanup, save/resume, and scene teardown.

| Member | Native source / authored row | Disposition required by this pass | Proof contract |
| --- | --- | --- | --- |
| entrance Fence rows 0..15 | exact `tutorial.boneyard` points; row 5 segment code 2 | exact-ported geometry/collision; exact Website safety-domain source | every admitted center plus radius is on the north/combat side of the complete interpolated chain, including across the Gate gap |
| unrelated Fence rows 16..27 | exact level rows, separate local chains | verified-already-at-parity; out-of-system for entrance-domain classification | domain-table census proves they are not silently used as barriers |
| recipe 10004 Starter Skeleton | waves 1/3/4 | exact-ported spawn membership | every batch and near-Fence seeded placement |
| recipe 10051 Item Skeleton | wave 2 | exact-ported spawn membership | all off-screen/light batches plus death-link retained |
| recipe 10059 Skeletal Archer | wave 4 | exact-ported spawn membership | mixed group and shared-root group coverage |
| recipe 10065 Potion Skeleton | wave 5 | exact-ported spawn membership | light placement and death-link retained |
| recipe 10076 survival Skeleton | groups 10078/10086 | exact-ported spawn membership | both interval script producers |
| recipe 10077 survival Archer | group 10078 | exact-ported spawn membership | seeded selected-member path |
| recipe 10085 deadly Archer | group 10086 | exact-ported spawn membership | late interval path |
| group 10010 | `+0x58=0`, ordered 10004 x5 | exact-ported correction | five fresh raw draws in each of two same-tick batches; no shared final root |
| group 10052 | `+0x58=0`, ordered 10051 x5 | exact-ported correction | each of four wave-2 groups owns five fresh roots |
| group 10060 | `+0x58=0`, 10059,10059,10004,10004,10004 | exact-ported correction | order and independent roots retained |
| group 10061 | `+0x58=0xCD`, 10059 x3 | exact-ported correction | all calls consume raw draws; only first policy/collision result is shared by all three without later placement-RNG consumption |
| group 10078 | `+0x58=0`, 10076,10077,10076 | exact-ported correction | random-one selection interleaves with that member's fresh raw draw |
| group 10086 | `+0x58=0`, 10085,10076 | exact-ported correction | same late-survival contract |
| UIDGroup `+0x5C/+0x60/+0x34` tails | all six exact serialized rows | verified-already-data-complete; out-of-system (no recovered placement consumer) | raw values remain documented; no inferred behavior |
| dark policy 0 | `0x00463BE0`, scalar `<=0`; 350 fallback | exact-ported predicate/topology; existing server light source projection retained | equality, retry, fallback, and domain assertion |
| light policy 1 | scalar `>0` | verified-already-at-parity plus domain admission | waves 2/5/survival cannot enter spawn strip |
| off-screen policy 2 | camera rectangle predicate | verified-already-at-parity plus domain admission | wave-2/3 batches remain off-screen and north-side |
| direct and edge policies 3/4 | shared helper branches | verified-already-at-parity; no authored Tutorial producer | negative tests retain ordinary/custom behavior |
| raw point | `0x00465E40`, player draw plus random unit vector x100 | exact-ported correction | singleton selection word plus direction word per requested enemy, even in group 10061 |
| collision/ring adjustment | `0x00466200 -> 0x00463D30` | verified-already-at-parity; domain predicate added at the same admission seam | native collision/mobile-body checks preserved; no post-materialization teleport |
| trigger 642218 | serialized player-steps-on rectangle | verified-already-at-parity | one start only |
| lock target | `0x00464B20`, Arena `+0x8E98..+0x8EA4` | exact-ported correction | immediate target `(0,0,2043,849.91796875)` persists until teardown |
| current camera interpolation | `+0x8EA8..+0x8EB8`, `0x0046E570` | exact-ported correction | age 0/1/299/300/settled recursive float32 samples; both `camera()` and actual render consume one resolver |
| 300-tick sleep / cleanup | script 642219, `0x004728B0` | exact-ported lifetime; browser immutable scene keeps equivalent permanently culled source rows | countdown never unlocks; target-exterior scenery cannot reappear; Fence/enemies/player remain |
| camera unlock mode 1 | `0x00464B20` | out-of-system (no Tutorial producer) | no fabricated unlock on countdown, stage change, save, or resume |
| protocol/save/late hydration | browser-only persistence owner | exact-ported browser projection | protocol 74 and schema 9 carry bounded camera-lock age; schema-8 triggered saves normalize safely to a persistent target |
| Tutorial teardown/new run | controller/world replacement | exact-ported | no barrier, cache key, camera age, or target leaks |
| ordinary generated Boneyard | shared placement helper, different entrance lifecycle | verified-already-at-parity; out-of-system for fixed Tutorial chain | existing combat bounds remain sole domain owner |
| custom/mod Boneyard | authored arbitrary layout | out-of-system for fixed Tutorial chain | unchanged full authored bounds and placement policies |
| player-action `0x0054CC50` placement xrefs | two non-enemy calls to `0x00463D30` | out-of-system (separate action owner) | no Tutorial domain injected into player action |
| Imp/Coffin/Portal child spawns | no Tutorial recipe/group producer | out-of-system | no invented Tutorial enemy family |

No member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- Script helpers request recipe/group members; `SpawnEnemy` owns one raw
  player/direction sample per call. Group `+0x58` can reuse the first **final**
  placement but never suppresses later raw RNG consumption.
- Policy/collision adjustment has no path-component or Fence-side branch. The
  clean observed run is the normal stock outcome, not a proof of an absolute
  invariant. The user's required no-spawn-strip result is therefore a named
  Website safety policy over exact authored Fence data, not a fabricated stock
  claim.
- The safety domain is a continuous admission barrier across rows 0..15,
  including the dynamic Gate opening. It affects birth only. The authored Gate
  remains pushable movement collision, and no live enemy is teleported after
  registration.
- Command 1065 writes its target once. Arena camera tick recursively approaches
  it with float32 blend `0.01`, growth `1.01`, cap one, and no Tutorial unlock.
  The 300-tick lane leads to command 1066 only.
- Native cleanup removes target-exterior static-manager members but not Fence,
  BadGuys, or player. In the browser the loaded scene is immutable content;
  persistent target culling gives the same presentation while authoritative
  collision/spawn within the retained target remains unchanged.
- Authority is the singleton Tutorial host. Domain admission, final-root cache,
  RNG, and camera age are deterministic save/protocol state or derivable exact
  scene data; clients never choose a side or placement.

## Nearby-system findings

- The existing parity entry's “light scalar below zero” wording is corrected
  to non-positive. Web code's `<=0` predicate was already instruction-exact.
- The actual render camera and the public `camera()` projection currently use
  different bounds. Fixing only enemy roots would retain pointer/hit/render
  disagreement and repeat the incomplete-system failure.
- The six serialized UIDGroup tails are now fully drained. Only group 10061
  owns shared-final-root semantics; applying it to every batch is falsified.
- Native stock does not guarantee fence-side births. The completion receipt
  must label the continuous entrance domain as the requested Website safety
  rule, even though its source geometry is exact retail data.

## Confidence and open questions

- Confirmed: stock executable/data identity; all relevant xrefs; raw sampling
  per call; complete UIDGroup table; exact policy strictness; retry topology;
  absence of a Fence/path test; target/current camera fields; persistent lock;
  cleanup membership; current web failure and its high-rate seeded repro.
- Clean stock directly confirms one normal opening with no spawn-strip actor.
  Static analysis proves that this single observation is not a mathematical
  native guarantee, so no broader claim depends on sampling more retail runs.
- No extractable table or material native branch remains unknown.

## Web implementation consequence

- Represent all six UID groups with members plus `shareFinalRoot`; consume a
  singleton player-selection draw and a fresh direction draw per requested
  enemy, interleaving random-N recipe selection with spawn sampling. Carry a
  batch-local placement cache key only for group 10061.
- Add one exact Tutorial entrance-chain admission predicate to the shared spawn
  placement seam. Apply it to every candidate and every Tutorial recipe/wave;
  do not clamp a finished actor or alter ordinary/custom Boneyards.
- Keep full Tutorial bounds for actor collision and legal raw-root acceptance.
  After the camera trigger, only non-dark retry rings use the persistent target
  inset by actor radius; dark retries retain their recovered target bypass, and
  off-screen policy samples the recursively interpolated current camera.
- Add bounded camera-lock age to the Tutorial state, protocol 74, and save
  schema 9. One camera-bounds resolver must drive real rendering, public
  projection/hit math, late hydration, resume, and teardown. The cleanup
  countdown remains a separate field.
- Remove the transient countdown-based camera condition and the actual-render
  full-bounds path. No compatibility shim or alternate camera owner remains.

## Validation contract

- Red first: on untouched `54daa1eb`, retain the 512-seed natural and
  near-Fence loops and prove the reported south-side actors; pin the render vs
  `camera()` mismatch and group-wide raw-root reuse.
- Focused kernels: every entrance-chain segment and Gate gap; boundary equality
  with all Tutorial collision radii; every recipe, group, wave, and policy;
  independent raw draws; group-10061 final-root/RNG cache; all negative
  generated/custom/action members.
- Camera: trigger idempotence, exact target, recursive samples at ages
  0/1/299/300/settled, cleanup without unlock, renderer/projection identity,
  protocol 74 strictness, schema-9 round trip, schema-8 migration, late join,
  teardown, and restart.
- Run the exact candidate only on the Mac mini: focused tests, complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, then built Chrome at
  1600 x 900. The browser journey must enter the real Tutorial, cross the Gate,
  place the player near the north side, launch representative dark/off-screen/
  light/shared-root waves, assert every enemy circle remains north of the
  entrance chain, and prove the camera stays locked after the 300-tick cleanup
  lane. Page, console, failed-response, wire, and runtime-error arrays must be
  empty.

## Implementation validation receipt

- `native-tutorial.ts` now drains all six UIDGroup `+0x58` rows, consumes one
  singleton-player and one direction draw per spawn call, and marks only group
  10061 for batch-local final-root reuse. `boneyard-enemy-store.ts` owns that
  cache at materialization; all other groups retain independent placement.
- `boneyard-collision.ts` admits an optional scene domain at the existing
  placement predicate and splits legal raw roots from retry bounds. The exact
  Tutorial host supplies the complete 17-point entrance chain to every policy;
  after lock, non-dark retries use the target inset while dark retains its
  native bypass. Generated and custom Boneyards supply neither rule.
- Tutorial camera age is now independent of its 300-tick cleanup countdown.
  One precomputed float32 recurrence feeds authority off-screen policy, client
  interpolation, public projection, and actual WebGL rendering. Protocol 74
  rejects absent, untriggered, or inconsistent clocks. Save schema 9 persists
  the age; schema 8 and earlier current-envelope saves normalize it without
  resetting an already completed lock. The backend accepts current schema 9
  and legacy schema 8 through the same account slot.
- On untouched Mac base `54daa1eb`, the red real-materializer regression failed
  at seed 0 with actor 3 at `(1159.74072265625,1636.077392578125)` south of its
  legal full-circle boundary. Red log SHA-256 is
  `3a6dfee2e27d38194e041e43c1a67c7644d6f185c9e3f1a45e16e977efa63e33`.
- On final combined base `0d95bc27`, the focused Tutorial group passed `25/25`;
  log SHA-256 is
  `965e02c81d7bd3ff7ea07d62a9121f9713b396b310b7e728b2d57b11cf7894cb`.
  The broad Boneyard group passed `1514/1514`, including all seven recipes,
  six groups, authored policies, Fence segments/Gate gap, shared-root cache,
  target-bounded retries, timeline camera interpolation, protocol/save
  migrations, upstream shared-Memorial and bounded replication-recovery state,
  and ordinary/custom negative members. Log SHA-256 is
  `f04d17ebe32567190f8c445ad0676917bf70a72857ef60101b0722eba032c70d`.
- The exact combined Website candidate passed the complete canonical Mac
  gate: backend build and integration contracts; formatting, lint, and import
  boundaries; every frontend/desktop suite; production frontend/GameHost
  builds; media policy; and bundle budget. `Game-srbqqEOF.js` is 464,489 raw
  bytes / 130,329 gzip against 524,288 / 131,072. Gate-log SHA-256 is
  `1a16f5242393ec8121398de30d11d3330fdc73343472c1ca9a0d4d5cd429ff1b`.
- The rebased Mod Loader report passed its complete registered Mac static suite
  `500/500`; log SHA-256 is
  `eed446e35a25d069c98e03a187bc2c8262fb616642b2974cec52b89d70b58512`.
- Built Chrome `151.0.7922.174` on macOS `26.6.2` ran the real host, protocol
  74, schema 9, exact Tutorial scene, upstream shared Memorial and replication
  recovery, and WebGL renderer at 1600 x 900. It
  observed, respectively, 10 opening-dark Skeletons, five off-screen Item
  Skeletons, three shared-root Archers, and one light Potion Skeleton. Minimum
  full-circle entrance clearances were `68.947620`, `66.552246`, `98.317404`,
  and `327.907609` world units. Camera age reached 464, cleanup reached zero,
  target bounds remained `(0,0,2043,849.91796875)`, and WebGL camera Y was
  `516.5846354166667`. Page, console, failed-response, and page-error arrays
  were empty. Browser-log SHA-256 is
  `8cb05e970c528e3ea41c056f1fc8866d4b1e6283f0d1d04a773cdc18aaec7b47`;
  reviewed spawn/camera frame SHA-256 values are
  `7bd960174d4f5d34649ba7824712bf454b5918b4c7232e687341b96f49082ca3`
  and
  `51752c74c861ed6bc23d9afe9fe4b6251bc69692ef7ed0050ca555bc56127adb`.
- No native member is browser-blocked. The absolute continuous entrance-domain
  exclusion is deliberately labeled Website safety policy because stock owns
  no Fence-side predicate. No commit was pushed and nothing was deployed.
