# 2026-08-28 — Physical iPhone performance and Hail snapshot-allocation reopening

Reconciled onto current Website `main` on 2026-08-31; dated evidence below
retains the exact revision and capture provenance from each earlier pass.

## Reported problem and acceptance scope

The physical iPhone report was not a generic request for a mobile quality mode.
The observed product failures were rapid heating while plugged in, frequent
crashes around level-up, an Inventory tutorial softlock, and background lighting
flicker while the SkillPicker was open. Acceptance therefore covers the real
Website `/game` path on an iPhone XR in all of these states:

- Hub;
- empty and populated Boneyard;
- settled SkillPicker and restored gameplay;
- Inventory open, closed, and reopened;
- Acid Rain, Magic Storm, Lightning, and the five primary-element families;
- dense enemies;
- simultaneous movement and primary fire;
- overlapping Water, Fire, Ether, Earth, and Air effects;
- repeated level-up choices, Tutorial Inventory, installed web-app entry, and
  sustained generation/endurance;
- frame tails, WebContent/GPU footprint, battery temperature, browser errors,
  disconnects, and new Jetsam reports.

Visual count, native actor membership, authoritative timing, gameplay effects,
resolution, lighting, shadows, painter order, audio, and teardown are invariants.
An optimization that makes Mac Safari faster but makes the physical phone worse
is rejected.

## Controlled physical baseline

The iPhone XR runs iOS 18.7.6 at a logical `896x364`, DPR 2 viewport. Each
controlled sample starts with a fresh MobileSafari, WebContent, and WebKit GPU
generation, opens the exact immutable Website build, creates a private game,
enables cheats, grants deterministic skills through the Web Lua authority, and
records Hub, empty Boneyard, then the requested stress state. The host remains
on the Mac mini so device results measure the production browser/render path.

Controls consistently remain around 58–60 FPS. Dense Water is the decisive
failure. Exact max-rank family grants produce approximately:

- 1,340 `water-hail` actors;
- 313–318 Frost Jet actors;
- 6–7 Cold Aura actors;
- 1,663–1,667 total primary actors.

The ordinary sprite path records 9–14 FPS depending on the fresh phone
generation, with p95 frame times around 120–211 ms and WebContent reaching
1.3–1.5 GB. The confirmed report
`JetsamEvent-2026-08-28-101022.ips`, SHA-256
`cb18809526be999a71fa332261dafd10e3c09e5a9973b64953ced42d6fb76373`,
classifies frontmost priority-100 WebContent as a high-water kill at 98,304
pages, exactly 1.50 GiB. This reproduces the user report rather than inferring a
problem from source code.

## Implemented non-Hail closures retained by the candidate

The branch retains only changes with semantic coverage and positive controlled
evidence:

- scene-generation ownership and bounded reuse for secondary presentation
  plans, primitives, diagnostics, and painter rows;
- shared exact gradient resources for Acid/Storm streaks and specialized Storm
  drop updates without per-frame gradient or vertex object creation;
- retained enemy views and family-owned presentation state;
- packed static-building light bytes without changing sampled light values;
- a retained SkillPicker offer graph/cache and retained SkillPicker/Inventory
  renderer owners across opens;
- a fully opaque settled SkillPicker curtain, preventing live Boneyard lighting
  changes from flashing through the modal while preserving reveal timing;
- complete modal close/reopen teardown and stable canvas identity contracts.

The 2026-08-31 current-main reconciliation closes two newer presentation
writers before device acceptance. Native Insight cards own live pulsing glow,
frame, panel, label, and text passes. A 2026-09-01 physical iPhone reopening
falsified whole-offer cache bypass: ordinary offers held `55.50..57.57` FPS,
while Insight-bearing offers fell to `36.65..44.99` FPS and WebContent reached
`1004 MB` after eight consecutive selections. The retained owner therefore
caches one stable layer containing the heading, ordinary cards, and special
actions, while routing only each Insight card's complete, non-overlapping live
graph to the sibling pulse layer. The static render target stays enabled and
updates in place across offers instead of being destroyed and recreated.
Current enemy construction also adds live `scale` and `stridePhaseDeg` inputs,
so the retained enemy-plan cache invalidates on both while movement-only
position, light-provider, and shield state remain outside the plan. This keeps
Portal emergence and Skeleton/Zombie articulation live without discarding the
ordinary steady-state cache. The candidate is based on current-main protocol
115 and includes the later pure Fire/Ether Burn painter-enrollment barrier.

The exact pre-Hail controlled receipts and the full rejected-experiment ledger
were preserved during the monolithic-ledger split as local artifact SHA-256
`6cc0c461084115edd85db4d78c6c5e63a575b14641cee8817e71c2911873c0a9`.

## Rejected renderer and micro-optimization paths

The following candidates passed focused semantics and Mac validation but were
removed because physical WebKit regressed or failed to improve:

- cyclic Maggot emergence wrapping: removed during current-main reconciliation
  because the authoritative phase is now linear and preserves its endpoint;

- retained generic Hail plans/roots: 48.26 to 24.62 FPS in the earlier
  339-actor census;
- direct Hail sprite sync: 26.08 FPS;
- flattened/direct-parent Hail views: 27.39, then 16.95 FPS;
- removing primary Region point-gain calls: A/B/A 47.67 to 41.15 to 50.63 FPS;
- manual primary interpolation Maps/Sets/loops: 13.87 to 5.11 to 12.56 FPS;
- one common primary painter-root traversal: WebContent became unserviceable;
- retained Frost scalar fields: 9.37 to 7.13 FPS;
- reusing a local Frost plan: 14.30 to 8.20 FPS.

These results close source-level operation-count edits in the hot renderer. On
iOS WebKit, small shape changes perturb JIT and allocator behavior enough that
Mac or source reasoning is not a promotion signal.

## Exact Hail particle-run experiment and rejection

One structural renderer candidate replaced each Boneyard Hail
`Container + Sprite` pair with a Pixi `Particle`. Hail still entered the global
painter, and only actors receiving consecutive global z depths shared a
`ParticleContainer`; any player, Frost, static, enemy, loot, or secondary layer
split the run. One native unpremultiplied shader was scene-owned and shared by
all runs. Actor count, anchor, texture, alpha, rotation, scale, worldY, painter
position, audio, and 134-tick retirement remained exact.

Mac Safari improved to 58+ FPS at the full 1,664-actor Water census. Physical
iPhone evidence falsified it:

- exact batch build `8986160f77cb7605279547a36e3dad2af2647db1`;
- Hub `58.61` FPS, empty Boneyard `56.61` FPS;
- max Water `8.76` FPS, p95/p99 `192/382 ms`;
- 1,663 primaries, including all 1,340 Hail particles in 89 exact runs;
- 1.4-GB WebContent;
- receipt SHA-256
  `a7a372515d998f09a09d80ba0af2bf2d9b45aa1bd210541d9dcdd3993e0580e7`.

Exact unbatched `867d7a98e37a89c95851eec8bea2cf3fa2bcfb22`
records `11.28` FPS, p95/p99 `173/354 ms`, at 1,665 primaries and the same
1.4-GB footprint. Its receipt SHA-256 is
`0bafe3ecfc224015d4e687e1f49e23e9c95375556205e38f3a715fbdd8d2a3a7`.
The particle-run implementation and its public seam are removed completely.

## `Anim_Hail` dynamic-state and bounce-pitch protocol correction

The native Hail height envelope is not its constructor-only `[-20,0]` range.
Following `Anim_Bouncer` through its doubled displacement and first bounce gives
the closed minimum `Math.fround(-79.45)`. The strict protocol decoder now accepts
that complete native range and rejects values below it.

A 30-second Mac Water row also exposed a separate decoder failure at the exact
bounce-pitch endpoint. Read-only instructions `0x00458E50..0x00458EC6` show:

- `Integer(3)==1` gates the sound;
- inclusive native `Float(.2)` loads float32 `0.20000000298023224`;
- double `1.0` is added and the result is spilled as float32;
- `Integer(4)` selects the sample.

Seed 439,089 reaches `Math.fround(1 + Math.fround(.2))`, or
`1.2000000476837158`. The decoder's old double literal `1.2` rejected this valid
producer result. The upper bound is now `Math.fround(1.2)`, with deterministic
kernel and complete snapshot tests for the endpoint and strict negative tests
above it.

## Recovered allocation owner

The 1.4-GB footprint remains with both sprite representations, so the renderer
is not the sole owner. At the 20-Hz authority snapshot rate, the former frame
repeated every Hail actor as a keyed JSON object with 20 scalar/string fields
and two nested vectors. A representative stopped actor is 479 JSON bytes.
`EntityReplicationReconstructor` then materializes complete actors into snapshot
history. At display rate, `interpolatePrimarySpellState` formerly allocated
another Hail object and two vectors for all 1,340 actors on every frame: at
60 Hz, at least 241,200 short-lived Hail-owned JavaScript objects per second,
before Pixi work.

This makes replicated Hail state and display interpolation the next deep module
boundary. The correction changes representation and ownership, never native
simulation or presentation membership.

## Order-preserving compact Hail frame contract (protocol 106)

Full authoritative `GameSnapshot` state is unchanged. Subsequent
`GameSnapshotFrame.primarySpells` messages move Hail into one compact table:

- `ownerIds` and `worldKeys` intern repeated strings once;
- rows retain their authoritative Hail subsequence, while `positions` records
  each Hail row's exact index in the complete transient sequence;
- each 18-component row carries id, birth tick, bounce progress, optional
  sample and pitch, bounce sequence, height, horizontal velocity, position,
  rotation and rotation step, saved bounce velocity, scale, vertical velocity,
  and owner/world dictionary indexes;
- `kind` is the table discriminator;
- `ageTicks` is exactly `frame.tick - birthTick`;
- `life` comes from a 134-entry table generated by the exact repeated float32
  subtraction from `NATIVE_HAIL_INITIAL_LIFE`.

The host compacts only at frame projection. The strict decoder validates table
shape, dictionaries, indexes, globally unique actor IDs, total transient
capacity, an ascending unique in-range position partition, age, complete
Bouncer ranges, bounce-field consistency, and the inclusive float32 pitch
endpoint. The entity reconstructor places Hail at those exact positions and
materializes the complete unchanged actor contract used by audio, observers,
rendering, and presentation. There is one protocol path: no legacy fallback,
mobile branch, feature flag, or quality setting.

For 1,340 deterministic actors, the current keyed state is 694,035 bytes and
the order-preserving compact frame is 246,846 bytes. That removes 447,189 bytes,
or 64.43%, from every dense snapshot before WebSocket framing.

## Allocation-bounded Boneyard presentation contract

One Boneyard timeline owns a retained Hail presentation table keyed by actor ID.
For a continuing actor, its presentation object, position record, and velocity
record are reused and updated synchronously. Authoritative history remains
immutable. The output transient array is ephemeral until the next timeline
sample, matching the renderer's synchronous consumption contract. Hub
presentation remains owned-copy and unchanged.

Birth and retirement match the former `blend < 1` edge. Discrete bounce/audio
fields come from the same older/newer actor chosen previously; continuous age,
height, horizontal velocity, life, position, rotation, and vertical velocity use
the same interpolation expressions. Hail and non-Hail rows merge by exact actor
ID. Retirement removes retained storage before that numeric ID could be reused.

## Current validation and remaining promotion gate

Before rebasing onto the split ledger, the compact/retained candidate passed:

- the 316-test prerequisite gate;
- all 1,755 Boneyard tests;
- focused strict protocol, client-session, renderer-timeline, Hail audio/life,
  1,340-actor compression, exact reconstruction, identity, and retirement tests;
- lint, architecture boundaries, generated Web Lua checks;
- production build and bundle budget (260,026 raw / 78,571 gzip bytes).

Receipt SHA-256 values were:

- Boneyard: `c7cc14fee6ffd393bec057dfa15548912949bcb30507a613267799aa7445b5c0`;
- lint: `cc50495fbe1f524099b46b9217fb87cecd666ae6aa03d7653c159e5d8c1758ac`;
- build: `22a43f9fce943ad094ad423fcb27a4e6850baaee232931458a4924b40ca39c25`.

These receipts predate the latest upstream rebase and are not final acceptance.
Promotion still requires the exact rebased Mac canonical gate, built Safari
pixel/census comparison, and a fresh physical iPhone A/B proving materially
better FPS, tails, footprint, temperature, and no new Jetsam at the unchanged
1,340-Hail census. Only after Water passes may the full UI, level-up, Tutorial,
enemy, movement/fire, five-element, overlapping VFX, installed-app, and
endurance matrix close.

## Physical compact-frame result and remaining renderer owner

Exact physical A/B on the same rebased parent/candidate boundary retains 1,340
Hail and approximately 1,664 total primary actors:

- unbatched parent `407c3932f8df4c99625bab45a3bf291210d8d7b3`:
  `6.54` FPS, p95/p99 `260/410 ms`, 1.4-GB WebContent;
- compact/retained candidate `302b6b2db4bc08918658f08b22ed11329af592a9`:
  `10.65` FPS, p95/p99 `139/337 ms`, 1.4-GB WebContent.

The candidate is about 63% faster in this paired generation and its strict
errors array is empty, but it does not meet the product target and does not
reduce WebContent high water. Protocol/presentation churn is therefore a real
CPU owner but not the remaining backing-store owner. The compact protocol and
retained interpolation remain valuable; renderer topology must reopen without
repeating the rejected `ParticleContainer` design.

## Shared-quad Hail mesh reopening

### Boundary and complete membership

The owner is the Boneyard-only draw representation of native `Anim_Hail`
record `BadGuys:32`, after authoritative state/interpolation and before the
global ordinary-dynamic painter. Membership dispositions are:

- `water-hail` airborne, bounce, stopped, and fade branches: `exact-ported` by
  the shared-quad mesh candidate;
- Hail bounce audio, damage/contact, RNG, current protocol 106 state, and
  134-tick
  retirement: `verified-already-at-parity` and remain outside the draw adapter;
- global actor-ID painter row, worldY, queue family, inter-family gaps, and
  scene renderability/teardown: `exact-ported` through run splitting;
- Frost Jet `water`, Cold Aura `water-aura`, Hurricane `air-hurricane`, every
  Weld actor, player Staff VFX, and all Fire/Earth/Ether families:
  `out-of-system` because they own different sprite counts, blend passes,
  Region-light lanes, geometry, or overlay rules and keep their existing views;
- Hub/private-room presentation: `out-of-system`; authoritative Hail actors are
  born and stepped by Boneyard spell combat, and ordinary construction remains
  available for non-Boneyard fixtures.

No member is `blocked-by-platform`. WebGL and Pixi MeshGeometry can represent
the exact textured, rotated, alpha-colored quads and painter partitions.

### New representation and falsifiers

The failed particle candidate owned 1,340 JavaScript `Particle` objects and
rebuilt/uploaded 80–120 separate `ParticleContainer` buffers per frame. The new
candidate owns no per-actor Pixi display object. One retained state reference
per live actor feeds scene-generation mesh runs. Each run:

- is one `Mesh` with typed position, UV, index, and vertex-color buffers;
- draws exact record-32 anchor geometry, live position plus height, rotation,
  uniform scale, white tint, normal blend, and life alpha;
- uses the installed Arena mesh/batcher saturation and unpremultiplied texture
  path, not a new shader approximation;
- contains only Hail IDs whose globally assigned depths are consecutive;
- splits on every player, static, Frost, enemy, loot, secondary, or other
  painter gap, so no member crosses an external painter row;
- reuses capacity and typed storage, updates only active views, hides inactive
  runs, and destroys geometry/buffers exactly once with the scene.

The candidate is falsified by any changed actor/layer count, nonconsecutive run,
corner/UV/color mismatch, missing alpha quantization, painter crossing, stale
run after retirement, shader/geometry leak, pixel difference beyond differing
authoritative frame timing, unchanged physical object topology, or physical FPS
or footprint regression. Focused pure and `PrimarySpellWorldView` interface
tests, the exact Mac gate/browser census, and physical parent/candidate/restored
A/B remain mandatory.

## Physical shared-mesh result and combined Water owner

The Hail-only Mesh candidate at Website
`5d5cdd71d48faca484f6f3e37ec97bd30507b84f` is a positive structural step but
not a promotion result. Exact physical Water retains 1,340 Hail, approximately
312 Frost Jet actors, 7 Cold Auras, and 1,664 total primaries. A completed
eight-second row records `17.34` FPS, p95/p99 `106/154 ms`, 95 Hail Mesh runs,
and an empty browser-error array. Its receipt SHA-256 is
`f0e8c6ea1266322b6aeadbb48e4f77df7e876ca9a44e18b09c0755ddf58b2d94`.
This improves the compact-only `10.65` FPS result and one sample records 160 MB
during the window, but repeated fresh WebContent generations still reach
1.3–1.5 GB. The Hail-only Mesh therefore remains necessary but insufficient.

An isolated timing build changes no render or game behavior. Physical receipt
SHA-256
`4a763dda6bb78fecba636867b0f70015e4e8230c0242671cae96c652b46fc9c8`
records `15.23` FPS at the same 1,340-Hail census and attributes average frame
work as follows:

- complete presentation callback: `29.45 ms`;
- renderer: `25.40 ms`, including `15.29 ms` scene update and `5.55 ms`
  Pixi/WebGL submission;
- primary actor/view update: `4.98 ms`;
- primary painter-layer construction: `1.05 ms`;
- primary depth path: `2.68 ms`, including `1.02 ms` per-ID depth assignment,
  `0.32 ms` second Hail sort, and `1.19 ms` Hail writes/buffer updates;
- global painter-order construction: only `0.68 ms`;
- WebContent: 1.3 GB, with a `205 ms` pre-scene allocation/GC stall.

Two follow-up candidates are rejected. Retaining JavaScript painter-layer
objects does not reduce the owning phases: physical receipt SHA-256
`43717e3b9535780fe7aba138a036d017e357a0f775f24236d6037d937efd90df`
records `13.02` FPS, primary update `8.49 ms` versus `8.02 ms`, painter
`5.58 ms` versus `5.51 ms`, and 1.4-GB WebContent. Keeping every run's
power-of-two draw capacity active with transparent tail quads is also rejected:
run partitions migrate between indexes, accumulated transparent capacity makes
the physical page unserviceable after stress admission, and the game transport
closes before a sample. Neither experiment remains in the candidate.

The remaining deep owner is the complete Boneyard Water draw family, not Hail
alone. Each live normal Frost Jet currently owns one `Container` and three Pixi
`Sprite` objects in exact local order: normal core, additive half-core, then
additive glint. At the measured 312-actor census this is 1,248 retained display
objects whose alternating blend passes split Hail into roughly 90 global runs
and force the Pixi batcher to rebuild large alternating streams. This explains
both the actor-update/submission time and the remaining WebContent high water.

## Combined Water/Hail affine mesh contract

The reopened owner is the Boneyard-only presentation adapter for
`water-hail` and world-sorted normal `water` Frost Jet actors. Complete
dispositions are:

- Hail airborne, bounce, stopped, fade, and record-32 quad state:
  `exact-ported` from the Hail-only Mesh;
- Frost Jet normal kind, core/additive-core/glint presence, positions,
  heading, scales, quantized alphas, packed tints, record textures, and painter
  lanes: `exact-ported` into combined Water Mesh runs;
- actor birth/order, simulation, collision/damage, Hail bounce audio, RNG,
  protocol 106, retained interpolation, and lifetime: `verified-already-at-parity`
  and unchanged;
- Frost-over actors retain their existing post-world view because their native
  lane shares one stable depth with unrelated overlays; they are
  `out-of-system`, along with Cold Aura, Hurricane, Weld, Fire, Earth, Ether,
  Staff, secondary, enemy, player, static, loot, weather, lighting, and
  Hub/private-room renderers, all unchanged;
- external painter gaps: `exact-ported` through separate maximal consecutive
  runs;
- platform capability: no member is `blocked-by-platform`; WebGL2 custom Mesh
  attributes, three resident samplers, and premultiplied source-over blending
  represent the exact fixed-function result.

Every combined run follows the already computed global painter sequence. Hail
contributes one exact record-32 quad. Each normal Frost actor contributes its
existing one-to-three quads in the unchanged core, additive-core, glint order.
A run ends at every non-Water dynamic, static band, foreground transition, or
other global depth gap. Primitive order inside the indexed triangle list
therefore remains the native actor/pass order; no draw is regrouped by texture
or blend.

One premultiplied source-over state represents both native blend branches
without approximation. A normal pass writes its native saturated premultiplied
RGB and sampled alpha. An additive pass writes the same native saturated RGB
contribution with source alpha zero. Under WebGL `ONE, ONE_MINUS_SRC_ALPHA`,
that adds RGB and preserves the destination, exactly matching native Add for
the opaque Arena framebuffer. A later normal primitive attenuates the accumulated
RGB in the same order as the former Sprite sequence. CPU regression tests must
prove this affine equivalence for premultiplied and unpremultiplied texture
samples, all pass-presence branches, quantized alpha/tint, UVs, transformed
corners, run gaps, and retirement.

The combined candidate is falsified by any changed actor or pass census,
different primitive order, blend-equation mismatch, texture/UV/corner/tint/
alpha mismatch, painter crossing, Cold Aura or non-Water membership, retained
object/buffer growth, Mac or physical pixel difference, new browser error or
disconnect, unchanged 1.3-GB footprint, or failure to materially improve
physical frame tails. Chrome and Mac proof remain controls; only a fresh
physical iPhone A/B can promote it.

## Physical combined-mesh failure and stable indexed-range reopening

The combined candidate is not yet promoted. Exact-head Mac Safari at
`d7a2543361315250beb82c3c69e2f593bdd5997e` completes max Water with 1,665
primary actors at `58.38` FPS, but the physical iPhone loses its browser game
transport after max-Water activity begins. Two fresh physical generations
reached 60-FPS Hub and 56–58-FPS idle Boneyard controls, then the game host
recorded abnormal browser close `1006` during Water admission. The first
diagnostic also requested unsupported iPhone Inspector method
`Page.captureScreenshot`; a screenshot-free repeat independently ended with
`iPhone CDP Runtime.evaluate timed out`. Neither run produced a promotable
Water row, and no new Jetsam report was available immediately afterward.

Static inspection of the exact installed Pixi buffer owner identifies a
concrete mobile-GPU churn path. `updateRunActiveQuads` replaces
`vertexBuffer.data` and `indexBuffer.data` with active-prefix `subarray` views
whenever a run's quad count changes. Pixi `Buffer.setDataWithSize` stores that
shorter view. A later increase is then larger than the immediately previous
view and emits `change`, updates the resource identity, and reallocates the GPU
buffer even though the retained power-of-two capacity was already sufficient.
Water actor birth/retirement and exact painter-gap migration make those
decrease/increase cycles routine across many runs.

The corrective draw representation keeps each run's full-capacity vertex and
index arrays bound for its lifetime. Only the live vertex prefix is uploaded.
Index entries for live quads retain their exact two triangles; inactive tail
entries are zeroed to degenerate triangles at vertex zero. The fixed draw count
therefore adds no visible fragment, painter row, texture sample, or blend
contribution, unlike the rejected transparent-tail experiment, while the
buffer data object, descriptor size, and GPU resource identity remain stable
through shrink/grow cycles. Regression must prove typed-array identity,
degenerate tail indices after shrink, exact restored indices after growth,
unchanged active corners/UV/color/pass order, and complete retirement. A fresh
physical max-Water receipt remains the promotion gate.

## Critical-pressure proof and compact client-history owner

The stable indexed-range candidate passes the exact Mac canonical gate and
retains 1,666 primaries at `59.38` FPS, but its physical max-Water generation
still does not produce a complete sample. Live iOS syslog, 7,381 lines with
SHA-256 `dcb39305963f4259c96823b869a1854fc778096c84391b949a1f2bc0708440ef`,
records soft memory-limit enforcement immediately after combat admission,
then system memory-pressure `warn` and `critical` events while MobileSafari and
`com.apple.WebKit.GPU` are the visible foreground owners. The game transport
closes abnormally at the same boundary. The log explicitly records no process
killed during its reaper sweep, and no new Jetsam report was available, so the
receipt proves critical pressure but does not mislabel the termination as a
Jetsam kill. USB became unavailable later and physical promotion remains open.

The remaining allocation seam is before retained presentation. Every decoded
snapshot already contains the compact Hail table, but
`EntityReplicationReconstructor.apply` immediately calls
`materializePrimarySpellSimulationFrame`. At the measured 1,340-Hail census,
each snapshot allocates 1,340 Hail objects, 1,340 position objects, 1,340
horizontal-velocity objects, and a merged transient array. At 60 snapshots per
second this is approximately 241,200 Hail-owned JavaScript objects per second
before the Boneyard timeline retains up to eight full snapshots. The existing
`RetainedHailPresentation` only removes a second set of render-cadence actor
allocations; it cannot recover the snapshot churn that already occurred.

The client reconstruction boundary must therefore preserve
`PrimarySpellSimulationFrameState` through the Hub/Boneyard snapshot history.
Host simulation and welcome authority remain full `PrimarySpellSimulationState`.
The Boneyard presentation timeline copies/interpolates non-Hail actors as
before and decodes older/newer compact Hail rows directly into its one retained
actor set. Hail life remains derived from authoritative tick minus birth tick;
all other position, bounce, rotation, scale, owner/world, and sound-sequence
values come from the exact validated rows. Hail bounce audio compares the same
compact rows directly, so exactly-once sequences survive snapshot gaps without
materialized history actors. A one-time full welcome converts to the compact
client form before entering the timeline.

This seam is falsified by any host-state change, lost Hail row, changed
interpolation value, reordered painter membership, missed or duplicate bounce
audio, observer/client divergence, unbounded retained output, per-snapshot Hail
actor allocation, or regression in Hub/non-Hail snapshot behavior. Focused
protocol, reconstructor, retained-presentation, audio, client, observer, and
browser tests plus the full canonical gate precede another physical run.

## Physical compact-history result and Hail audio cursor owner

The compact client-history correction closes the memory failure but not the CPU
target. Exact Website `a64c222e942e6c961242f46ecc4a2d90d73c129c`
completes the physical iPhone max-Water row with an empty browser-error array:

- Hub: `60.24` FPS;
- empty Boneyard: `57.99` FPS;
- max Water: `18.67` FPS, p50/p95/p99 `47/104/179 ms`, maximum `325 ms`;
- 1,664 primary actors, including 1,594 combined Water-mesh actors at peak;
- main WebContent approximately 171 MB and WebKit GPU approximately 33 MB.

The former 1.3--1.5-GB WebContent owner is therefore removed. The unchanged
physical frame rate relative to the Hail-only mesh proves a separate CPU owner.
Receipt SHA-256 is
`512b110b8d9df807e7b750a9b9574f42e3f244a21c8b604ea304254ce49de3cc`.

Bounded timing builds change no game, render, protocol, or audio result. At the
same approximately 1,665-primary max-Water census, Mac Safari attributes each
20-Hz snapshot callback as follows:

- complete snapshot message: `7.26 ms` average;
- strict JSON decode and validation: `1.83 ms`;
- entity reconstruction: `0.06 ms`;
- complete primary-spell audio synchronization: `5.17 ms`;
- compact Hail bounce synchronization alone: `5.05 ms`;
- loop synchronization: `0.01 ms`.

The corresponding render-cadence averages are `5.27 ms` for the renderer,
`3.57 ms` for scene update, `1.31 ms` for WebGL submission, and `0.44 ms` for
presentation sampling. Mac remains `59.87` FPS because snapshot and render work
fit within its frame budget; the physical iPhone does not. The diagnostic
receipt is
`/private/tmp/solomon-cpu-diag-audio-d6797b8e-mac-water-8s.json` on the Mac
mini. Diagnostic commit `d6797b8e7180393f4145718b8b47db8dbdde6e47`
is isolated from the task branch.

The exact allocation owner is
`newNativeAirWaterFrameSoundRequests`: every compact snapshot constructs
`new Map(previous.hail.rows.map(...))`. At 1,340 Hail actors and 20 snapshots
per second this creates 26,800 temporary key/value pair arrays per second plus
a fresh 1,340-entry Map, before scanning the current rows. Packed wire bytes
would reduce the measured `1.83 ms` decode phase but would leave the larger
`5.05 ms` owner intact, so a protocol change is not the next correction.

Compact Hail rows retain authoritative transient order, and the strict protocol
requires unique actor IDs and an ascending position partition, but it does not
require the Hail row IDs themselves to be sorted. The audio correction must not
silently add that assumption. `PrimarySpellAudioSynchronizer` instead owns one
retained Hail audio cursor. Each actor-ID entry retains only its most recent
bounce sequence and last-seen generation. Continuing actors mutate their entry
in place; births hydrate without sound; a sequence increase emits the same
sample, pitch, attenuated position, and one request per unseen edge; snapshot
gaps remain exact. Listener-world or compact/full representation changes reset
and hydrate the cursor. Retired entries are pruned when retained capacity
exceeds a bounded multiple of the current census, so run duration cannot cause
unbounded growth.

This seam is falsified by any missed or duplicate bounce, sound on hydration,
dependence on row ordering, cross-world actor-ID collision, stale retained
growth, changed sound position/pitch/attenuation, new per-snapshot Hail lookup
allocation, non-Hail audio difference, or physical regression. Focused cursor
churn/world-transition tests, the canonical gate, exact Mac controls, and a
fresh physical Water row precede any packed-wire work.

## Native Hail voice saturation and Web Audio node storm

The retained cursor task head
`772432761c3b9337cc22e0f14a4b8b88fb09edaa` passes the complete canonical
gate (17,311 combined lines) and its exact Mac control retains 1,665 primary
actors at `58.75` FPS. The first physical repeat reached `58.80` FPS in Hub
and `57.15` FPS in idle Boneyard, then WebContent closed the game transport
with code `1006` approximately twelve seconds after max-Water admission. The
harness consequently timed out and produced no Water row. Its later process
sample showed approximately 264 MB WebContent rather than the old 1.5-GB
failure; no new Jetsam or WebContent crash report appeared. This is a failed
promotion receipt, not evidence of a memory kill.

Exact-head diagnostic `24b5358130763c95e30db194313ff7e4f2f5b3e1`
shows why the retained lookup did not reduce the measured audio phase. At the
same 1,665-primary census, every 20-Hz snapshot produces an average `386.2`
Hail bounce requests and a maximum `471`. Hail audio remains `5.09 ms` of the
`5.22-ms` complete primary-spell audio callback on Mac. The old Map allocation
was real but secondary; Website attempts roughly 7,700 resident-buffer source
starts per second, each currently creating a new `AudioBufferSourceNode` and
`GainNode`.

Fresh stock instruction inspection closes the missing playback-policy member.
All four Hail registry `Sound` loads pass `10` as `BASS_SampleLoad.max` and
store it at `Sound +0x20`. `Sound` channel acquisition at `0x00407A20` reuses
an inactive owned channel, but when all ten channels for that sample are active
the `count >= max` branch at `0x00407A8F..0x00407A95` returns null without
starting or replacing a voice. Stock therefore permits at most ten concurrent
voices for each Hail variant, forty total, while still generating every exact
bounce event.

The next correction belongs in the resident Web Audio playback adapter. Native
Hail cues carry a per-source maximum of ten; a source is admitted only while
its active set is below that bound, and its `ended` edge releases exactly one
slot. Saturated requests are dropped exactly as stock does. Other one-shots,
streams, loops, semantic generation, RNG, pitch, gain, ordering, and visual
state remain unchanged. Tests must prove ten admitted overlapping sources,
the eleventh rejected without node construction, release/reuse after `ended`,
independent limits for all four variants, and unlimited behavior for sources
without a recovered cap. Exact Mac timing and a fresh physical Water receipt
remain mandatory.

## Physical voice-cap result and retained native channel reopening

Exact task head `2c81b04d91765a3924be64702d683e04c43f08ab` passes the
complete canonical gate with 17,321 combined lines. Its uninstrumented Mac
Water control records `59.75` FPS, p95/p99 `18/26 ms`, 1,665 primaries, and no
browser errors. Diagnostic `42a837ecebfa49e9b504c1fc08fb3390fdf6ef50`
keeps an average `387.07` generated Hail requests per snapshot but reduces
Hail audio from `5.09` to `0.25 ms`, complete primary audio from `5.22` to
`0.39 ms`, and the snapshot callback from `7.39` to `2.49 ms`.

The cooled physical iPhone repeat completes successfully:

- Hub and empty Boneyard: `60.00` FPS;
- max Water: `31.05` FPS, p50/p95/p99 `29/45/104 ms`, maximum `222 ms`;
- 1,664 primaries, including 1,594 combined Water-mesh actors and 254 normal
  Frost actors at peak;
- WebContent/GPU CPU approximately `58.2/56.4%` during the row;
- WebContent/GPU footprint approximately `918/69 MB`;
- empty browser-error array and no game transport close.

This is about 66% faster than the preceding `18.67`-FPS exact physical row and
proves the recovered cap, but it is not the excellent-performance target. It
also reopens a bounded allocation owner. The current browser adapter correctly
limits each variant to ten active sources, yet an ended Web Audio
`AudioBufferSourceNode` cannot be restarted. It destroys that source and gain,
then creates new nodes for the next admitted request. With four 0.11--0.26-s
Hail samples, the active set is bounded while hundreds of node pairs may still
be created each second. Stock instead retains and restarts the same ten channel
records per `Sound`.

The next correction is one resident native-sound voice-pool module. Startup
loads it with the audio bank. One `AudioWorkletNode` owns the four unchanged
decoded mono PCM buffers and ten persistent logical slots per source. The main
thread admits a request only into an inactive slot; one message resets that
slot's sample cursor, playback rate, and gain. The audio render thread performs
the overlap sum and reports the exact slot ended edge; no per-request Web Audio
node or gain is created. The existing master gain still owns mute/user volume,
uncapped one-shots keep their current path, and streams/loops/music remain
unchanged.

This seam is falsified by an eleventh active slot, replacement of an active
voice, delayed or stale slot release, changed PCM membership/pitch/gain,
cross-source capacity sharing, per-request node growth, worklet startup outside
the loader, missing teardown, regression of uncapped sound, or a failed Mac or
physical Water receipt.

## Ordered Water depth and primary hot-path allocation owner

The retained-channel physical row remains approximately `31.04` FPS with the
full 1,664-primary census and an empty browser-error array. Its DVT memory
sample was unavailable because the no-root device tunnel reset during the row,
so the worklet's footprint closure remains open. It neither regressed nor
improved frame rate. Exact-head Mac diagnostic
`edabcf5885b567d55b5157b5ee479a3c49c1f19a` splits the `3.71-ms` scene update:

- dynamic views: `1.41 ms`, including primary view `0.90 ms`;
- light-index construction: `0.11 ms`;
- lighting/tint application: `0.41 ms`;
- painter construction: `0.54 ms`;
- painter depth and Water run assembly: `1.23 ms`, including complex shadows
  `0.14 ms`.

The primary, painter, and depth phases own `2.67 ms`, or approximately 72% of
scene update on Mac. Their current work also contains three exact but redundant
allocations:

1. `PrimarySpellWorldView.update` creates
   `[...projectiles, ...transients]` every display frame, copying all 1,664
   references before visiting them.
2. Boneyard painter construction spreads every retained primary painter layer
   into a new object merely to replace `sourceOrder`; max Water creates roughly
   1,595 of these short-lived objects per frame.
3. `buildBoneyardPainterOrder` already returns every dynamic layer in strict
   final depth order, but `NativeWaterMeshRuns` writes those depths into another
   Map, copies 1,595 IDs, and sorts them by the same depth before splitting
   consecutive runs.

The correction visits projectile and transient arrays through one index without
concatenation, mutates each retained primary layer's existing `sourceOrder`, and
feeds the globally ordered painter result directly into Water run assembly.
Water keeps parallel retained ID/depth arrays and asserts strictly increasing
depths. Run gaps, first depth, actor order, quad order, geometry, texture,
blend, alpha, tint, active range, and retirement remain unchanged. Non-Water
primary views receive their depth during the same ordered traversal; post-world
layers retain `foreground +0.5`.

This seam is falsified by accepting unordered Water depths, any changed run
partition or mesh z-index, a missing/duplicate actor, changed post-world depth,
new per-frame primary layer objects, reintroduced concatenation/sort, or a Mac
or physical visual/performance regression.

## Physical ordered-depth result and packed Hail frame reopening

Exact task head `aa1f6c301df6796cc46de0a75fb4fcfdc078349a` passes the
complete canonical gate with 17,342 combined lines. Its exact Mac max-Water
control retains the full census at `59.88` FPS. The physical iPhone repeat also
keeps Hub and empty Boneyard at `60.00` FPS, but max Water falls to `22.69` FPS
at 1,664 primaries, 1,598 combined Water-mesh actors, and eight enemies. The
row has p50/p95/p99 `38/74/216 ms`, a `269-ms` maximum, and 140 frames over
34 ms. WebContent reaches approximately 1.2 GB and 70% CPU while the WebKit GPU
process remains approximately 66 MB and 47% CPU. The empty browser-error array
and complete result prove load rather than a transport or renderer failure.

Runtime-equivalent diagnostic `bc3d7d22733b34ce9e6b78fb746177704eb2448a`
attributes the first full-census physical row as follows:

- strict message decode and validation: `7.93 ms` average;
- complete snapshot callback: `11.39 ms` average;
- scene update: `13.89 ms`, including `4.02 ms` primary view,
  `6.59 ms` dynamic views, and `3.95 ms` painter depth;
- renderer: `20.62 ms`, including `4.73 ms` WebGL submission;
- complete presentation: `26.30 ms` average.

The same live session's automatic endurance repeat worsens to `11.76` FPS
without increasing the 1,665-primary census. Decode rises to `11.50 ms`, the
snapshot callback to `15.29 ms`, scene update to `23.13 ms`, renderer to
`31.55 ms`, and complete presentation to `39.79 ms`. WebContent remains near
1.1 GB while the GPU process remains near 66 MB. This is sustained allocation
and garbage-collection pressure, not merely one cold-frame outlier.

An isolated shared-vertex-buffer experiment at
`3ac8debdf77825e38e797bd80fa3503249b2016d` uploads the complete Water vertex
arena once per frame while preserving every painter run and draw. It starts at
a measured 34.5 degrees C battery temperature. The first row reaches `26.32`
FPS with only six enemies, but the comparable eight-enemy repeat falls to
`20.26` FPS while WebContent again reaches 1.1 GB. The experiment is therefore
falsified and remains unmerged: duplicate Water vertex buffers are not the
dominant physical owner.

The remaining Hail table is compact only at the object-schema level. Every
snapshot still sends 1,340 arrays of 18 JSON numbers plus a 1,340-number
position array. A representative full census is approximately 328 KB of JSON
for Hail alone and creates 1,340 row arrays plus 24,120 parsed number entries
per snapshot. The Boneyard timeline correctly retains compact frames, but at
the 60-Hz authority rate those freshly parsed arrays still enter and leave its
history continuously. This directly matches the physical decode growth,
near-gigabyte WebContent footprint, and within-session collapse.

Protocol 107 replaces only that Hail row/position representation with one
versioned base64 payload. Its decoded owner is a structure-of-arrays object:

- exact safe-integer `id`, `birthTick`, and `bounceSoundSequence` columns use
  IEEE-754 float64 storage, preserving the complete existing integer domain;
- the twelve native float fields use float32 storage because their owning
  constructors and fixed ticks already commit each value through
  `Math.fround`;
- transient position uses uint16 under the existing 16,384-transient bound;
- bounce sample, owner dictionary index, and world dictionary index use uint8
  under their existing four-sample and 64-player bounds;
- one magic/version/count header and exact payload-length validation reject
  malformed, truncated, extended, or wrong-version data before it enters
  history.

Owner and world dictionaries remain the same small JSON arrays. The decoded
typed columns remain authoritative snapshot state; presentation interpolates
the same older/newer values, derives life from the same snapshot ticks, and
retains the same one actor object per live Hail ID. Audio reads the same sample,
pitch, sequence, position, and world columns. Materialization remains available
for full-state boundaries and restores the exact transient order from the
packed position column. There is no legacy row-array fallback in protocol 107.

This seam is falsified by any changed numeric bit pattern, Hail order, owner or
world membership, bounce edge, interpolation result, painter membership,
malformed-payload acceptance, unbounded decoded allocation, row-array creation
on the snapshot or presentation hot paths, protocol mismatch, browser error,
or failure to reduce both physical decode cost and sustained WebContent
footprint at the full max-Water census.

Implementation head `dfa2327bdef2fb8fc60609bdb45f1c29a2a079aa` passes the
complete canonical Website gate from an idle Mac window: 17,344 combined lines
with SHA-256
`56f94534cb41a85bad2559aa66150012119ad10238e3121ed9e82dcde3ab3efc`
and 17,293 stdout lines with SHA-256
`035b6454a094172ff42a66ab49aeb5a882abd17f08ff16301b67f0fc518ddc68`.
The exact uninstrumented Mac Safari control keeps Hub and empty Boneyard at
`60.00` FPS and max Water at `59.38` FPS with nine enemies, 1,664 primaries,
1,594 combined Water-mesh actors, p95/p99 `18/26 ms`, and an empty browser-error
array. Physical iPhone frame time, decode time, endurance footprint, and thermal
behavior remain the promotion gate.

The physical iPhone evidence proves a real but insufficient packed-frame win.
One uninstrumented run is explicitly contaminated: empty Boneyard contains
`471/1,045-ms` p99/maximum stalls and its Water row reaches only `20.01` FPS.
The clean exact-head repeat keeps Hub/Boneyard at `60.04/60.01` FPS with no
frames over 34 ms, then records max Water at `27.22` FPS, p50/p95/p99
`34/53/124 ms`, maximum `300 ms`, eight enemies, 1,665 primaries, 1,595
combined Water-mesh actors, and no browser errors. WebContent/GPU footprint is
approximately `903/68 MB` during that row.

Probe-only head `7af1ff1616ebc7f9da54ade5072d233c8fbea44f` reaches `33.63`
FPS at the harder nine-enemy, 1,665-primary census. Relative to the prior
runtime-equivalent physical diagnostic, packed storage changes the measured
averages as follows:

- strict decode/validation: `7.93 -> 6.15 ms`;
- complete snapshot callback: `11.39 -> 7.94 ms`;
- primary view: `4.02 -> 2.27 ms`;
- complete scene update: `13.89 -> 7.73 ms`;
- renderer: `20.62 -> 12.22 ms`;
- complete presentation: `26.30 -> 15.16 ms`;
- max-Water FPS: `18.14 -> 33.63`.

Packing is therefore retained: it removes nested row allocation, materially
reduces decode and presentation pressure, preserves the complete census, and
has no error or parity failure. It does not meet the excellent-performance
target. The remaining physical owners are the still-per-snapshot `6.15-ms`
decode path and the `15.16-ms` presentation path, including `3.67 ms` dynamic
views, `2.02 ms` painter/depth work, and `2.88 ms` WebGL submission. The
approximately 0.9--1.2-GB WebContent footprint also survives packing, so row
history was not its dominant resident owner.

## Retained Water entry and painter hot-path owner

The apparent 33-Hz stressed `snapshotHertz` is the rate at which the harness
observes unique interpolated ticks, not the network snapshot rate. The host
still uses its recovered 20-Hz snapshot contract. Packed Hail decode therefore
costs `6.15 ms` once per network snapshot, while complete presentation costs
`15.16 ms` per rendered frame. Render ownership is now the higher-frequency
target; lowering authority cadence would add latency before closing the larger
per-frame path.

`NativeWaterMeshRuns` currently represents each live Water/Hail actor across
five parallel retained collections: `stateById`, `planById`, `layerById`,
`liveIds`, and `PrimarySpellWorldView.painterOwners`. Every frame performs
multiple Map/Set operations for all approximately 1,595 mesh actors, then walks
those owners again to rebuild painter membership. Ordered painter output drops
the mesh identity, so depth application parses every `primary-spell:<id>`
string and repeats Map lookups before run assembly. These operations sit inside
the measured `2.27-ms` primary view and `2.02-ms` painter/depth phases.

The correction deepens `NativeWaterMeshRuns` behind one retained-entry owner.
Each actor ID maps to one entry containing its current state, optional Frost
plan, painter layer, and live generation. Two retained active-entry arrays swap
between frames; generation marks retirements without a separate live-ID Set.
`update` returns the existing painter layer directly. `PrimarySpellWorldView`
keeps one retained owner array in first-registration order rather than a Map;
the required owner walk compacts retired entries while appending Water layers
by direct reference and non-Water layers through their unchanged view. This
preserves the existing source-order lifecycle without per-frame owner objects
or Water-layer lookups. The painter result preserves optional numeric mesh
identity, allowing depth application to append the owning entry without
parsing its string ID. Run
partition, depth, quad order, vertices, UVs, tint, alpha, blend, texture,
visibility, retirement, diagnostics, and every non-Water view remain unchanged.

This seam is falsified by any changed painter source order, row, z-index, run
partition, draw/quad value, missing or duplicate actor, stale retired entry,
unbounded ID retention, changed view-to-mesh ownership, lost non-Water layer,
new per-frame Map/Set owner churn, browser error, or failure to reduce the
physical primary-view and painter/depth phases at the full census.

Candidate `80f0f839684f9d5384418ae32bff27fe11af4e1b` passes the
complete canonical gate: 17,351 combined lines with SHA-256
`b942515f29d2869ab9f73223ea6c2cbcaf5b51ed8814b4aff64a2aa35d73a3ad`
and 17,287 stdout lines with SHA-256
`2623a239826c2b3d5125fbc3c60900474a5cb28894dc9caf18d74f805ca822d2`.
Exact Mac Safari remains `59.88` FPS at nine enemies and 1,665 primaries, with
p95/p99 `18/22 ms`, maximum `47 ms`, and no browser errors.

The exact physical iPhone row is a positive comparison against packed head:
Hub/Boneyard remain `59.99/60.00` FPS with no frames over 34 ms; max Water
improves from `27.22` to `32.23` FPS at the same eight-enemy full census.
p50/p95 improve from `34/53` to `28/46 ms`, and frames over 34 ms fall from 95
to 49. The row retains 1,664 primaries, 1,595 Water-mesh actors, 255 normal
Frost actors, every visual/pass contract, and an empty browser-error array.
WebContent/GPU footprint remains approximately `940/66 MB`. The retained-entry
owner therefore required a controlled phase A/B before promotion.

That controlled Mac diagnostic falsifies the candidate. Against packed
diagnostic `7af1ff16` at the same nine-enemy census, retained-entry diagnostic
`09a68da4` changes primary view `0.87 -> 0.82 ms` and painter/depth
`0.94 -> 0.89 ms`, but regresses dynamic views `1.30 -> 1.43 ms`, painter
construction `0.38 -> 0.57 ms`, scene update `3.26 -> 3.48 ms`, renderer
`4.93 -> 5.33 ms`, WebGL submission `1.26 -> 1.43 ms`, and complete
presentation `6.01 -> 6.48 ms`. The physical headline improvement is therefore
classified as run variance rather than a causal result. The retained-entry
candidate remains isolated and is not promoted into the task implementation.

## Canonical packed-Hail validation owner

Probe-only head `ce0c5cc67b7aec6594f512948d0e8d34a66f9b00` splits the
remaining physical decode path without changing protocol, simulation,
presentation, audio, or renderer output. Its exact iPhone Water row reaches
nine enemies and 1,664 primaries at `32.83` FPS, with an empty browser-error
array. Across 160 authoritative snapshots, the measured averages are:

- complete message decode and validation: `6.48 ms`;
- complete snapshot callback: `8.04 ms`;
- complete primary-spell frame decode: `5.04 ms`;
- packed-Hail row decode: `3.49 ms`;
- packed-Hail base64 decode within that row phase: `0.31 ms`;
- packed-Hail semantic validation after row decode: `0.71 ms`;
- all 320 non-Hail Water and aura transient decodes: `0.79 ms`.

The packed row decoder, rather than the non-Hail transient schema, is therefore
the dominant remaining snapshot owner. The physical receipt is
`/private/tmp/decode-diag-ce0c5cc6-ios-water-ios-element-water-8s.json` with
SHA-256
`00187a7775ea9f2d0caf7644fbf370d820a056df8bce4a4366ca73432d3c44af`.

Probe-only head `e681687de3c1d8a3b6afb2596588c381c598fc7f` splits that row
decoder on exact Mac Safari at the same nine-enemy, 1,665-primary census.
Canonical-base64 validation costs `0.294 ms` of the complete `0.338-ms` row
decode. Native base64 decoding costs `0.038 ms`, typed-column ownership costs
`0.006 ms`, and header validation rounds to `0.000 ms`. The full-string
canonical regular expression is therefore approximately 87% of the row phase
on Mac. Applying that measured proportion to the corresponding physical phase
suggests roughly `3 ms` per iPhone snapshot, but remains an inference until an
exact physical subphase receipt is captured. The Mac receipt is
`/private/tmp/decode-split-e681-mac-water.json` with SHA-256
`b8a79df94465ecb05d47cfc63248578dbbfb7c6661bf720dd9df7e81f3f6a298`.

A full-census Hail payload is approximately 137,596 base64 characters. The
current validator scans that complete string once before the decoder scans it
again. Safari 18.2 and newer provide `Uint8Array.fromBase64`; strict final-chunk
handling rejects incomplete padding and nonzero pad bits while the base64
alphabet decoder rejects other non-whitespace characters. The correction must
decode once through that strict native path, then reject ignored whitespace by
requiring the encoded string length to equal the canonical padded length of
the decoded byte count. The existing magic, version, row-count, and exact
payload-length checks remain unchanged. Runtimes without the native decoder
retain a complete canonical validator before their existing fallback decoder.
Protocol 107 and every accepted wire value remain unchanged.

This seam is falsified by accepting an empty value, whitespace, the URL-safe
alphabet, missing or surplus padding, misplaced padding, nonzero pad bits, a
truncated or extended payload, a wrong header, or any changed decoded column
value. It is also falsified by different native/fallback acceptance, a second
full payload scan on supported Safari, a browser error, or failure to reduce
the packed-Hail row phase on the physical iPhone.

Candidate `e9bb77c8e31d699fc0fbc8e1b190fbed48c8f75e` implements that
boundary. Supported Safari invokes `Uint8Array.fromBase64` with the standard
alphabet and strict final-chunk handling, rejects ignored whitespace by
comparing encoded and decoded canonical lengths, and consumes the decoder's
exact ArrayBuffer without a redundant copy. The fallback retains the complete
alphabet/padding scan and now also rejects nonzero pad bits. Focused tests cover
empty input, URL-safe characters, whitespace, missing/surplus/misplaced
padding, nonzero pad bits, truncated/extended bytes, wrong headers, the strict
native option bag, and native whitespace rejection. The exact production build
and focused tests pass on the Mac mini.

Uninstrumented exact-head Mac Safari records `59.99/60.00/59.88` FPS for Hub,
empty Boneyard, and max Water. The Water row retains nine enemies and 1,666
primaries, with p95/p99 `17/21 ms`, one frame over 34 ms, and no browser
errors. Receipt
`/private/tmp/hail-native-e9bb-mac-water.json` has SHA-256
`ea661cd279f6700f37b617de6aea8a4af7eb1c1edc06bf898cb9311969de9d7f`.

Runtime-equivalent diagnostic `1d762b94f7435d5bd0e699ffa692f381fca356b2`
provides the controlled Mac A/B against diagnostic `e681687d` at the same
nine-enemy census:

- packed-Hail row decode: `0.338 -> 0.074 ms`;
- native base64/canonical decode: `0.038 -> 0.022 ms`;
- complete primary-spell frame decode: `0.838 -> 0.632 ms`;
- complete client decode: `1.448 -> 1.293 ms`;
- complete snapshot callback: `2.100 -> 1.993 ms`.

The row phase falls approximately 78% on Mac while preserving the full census.
The diagnostic receipt
`/private/tmp/hail-native-diag-1d762-mac-water.json` has SHA-256
`ae9b4c3ee7c122439a0748ce7799434bc781eafeabb00ebaeb170e0197012358`.
Physical iPhone row timing, frame timing, census, footprint, and browser errors
remain the promotion gate.

## Current-main Region painter registration integration reopening

Live integration against `origin/main` at
`13d5987966a58a31f362ac047ef126e21912ae78` exposes a required Hail owner that
did not exist at the packed-frame branch point. Current protocol 106 enrolls
every primary actor into the native Region painter manager before replication.
`PrimarySpellWaterHailState` inherits `PrimarySpellOwnedTransientBase`, its
`nativePrimaryPainterRegistrationContract` default is exactly one `actor`
manager root, and `PrimarySpellWorldView` resolves that authoritative
registration rather than deriving painter order from array position. These are
direct current-source facts; confidence is high.

The pre-integration protocol-107 packed row carries Hail simulation, visual,
audio, owner/world, and transient-position fields but not the newly recovered
`painterRegistrations[0].registrationOrdinal`. Applying that row unchanged
would either reject current Hail state, invent browser-owned order, or regress
the Region painter audit. None is admissible. Protocol 107 must therefore add
one exact float64 painter-registration-ordinal column per Hail row. The manager
lane is not another wire field because the complete Hail membership contract
fixes it to `actor`; decode validates a nonnegative safe integer and reconstructs
exactly one actor-manager registration at materialization and retained
presentation seams. `NativeWaterMeshRuns` carries that same registration on
its retained painter layer.

The owned row grows from 77 to 85 bytes and advances its internal packed-frame
format from 1 to 2. At the 1,340-Hail census the canonical payload is 151,888
base64 characters. Protocol 107 is still the correct external cut because no
format-1 protocol-107 build was published; the distinct internal version makes
all pre-integration diagnostic payloads fail closed instead of being
misinterpreted. Earlier format-1 Mac/iPhone timings remain causal evidence for
the duplicate validator, but they do not prove the integrated format-2 tree.

The complete integration membership is the Hail frame encoder, decoder,
byte-length and canonical-base64 bounds, semantic validation, full-state
materialization, retained Boneyard presentation, combined Water/Hail mesh
painter layer, current Region-order input, clone/JSON behavior, and malformed
protocol tests. Existing projectile and non-Hail registration decoding,
registration ordinals, manager lanes, insertions, visibility, source actor
order, and post-world lanes remain current-main owned.

This integration is falsified by a missing or synthesized Hail registration,
changed ordinal bits, any lane other than `actor`, acceptance of a negative or
non-safe ordinal, duplicate or reordered Region membership, loss of Water mesh
batching, changed Hail geometry/audio/transient order, protocol size mismatch,
or failure of the current-main Region painter and packed-Hail regression suites.

Exact-head Mac Safari then exposes the upstream writer omitted by static merge
coverage. `synchronizeAirWaterPlayerVisualActors` runs after the main primary
enrollment pass. It already accepts the authoritative Region registrar and
uses it for new Hurricane actors, but its same-pass Hail birth appended the raw
constructor result without the required actor-manager root.
`finalizeAirWaterPlayerVisualActors` runs later still; it creates Cold Aura on
six-tick edges but did not accept a registrar at all. The first max-Water Hail
birth therefore caused the strict format-2 encoder to fail closed, terminated
the host, and produced browser close `1006`. The supervisor log records
`simulation.tick_failed` at server tick 3220 with
`Hail painterRegistrations must contain one actor-manager root`.

The complete post-enrollment Air/Water birth membership is Hurricane, Hail,
and Cold Aura. All three use exactly one actor-manager painter registration.
The shared visual system must register Hail at its existing synchronized birth
seam, accept the same Region registrar at finalization, and register new Aura
there. Existing actors retain their immutable registration through update;
tests without a live world manager use the module's existing standalone order.
This is falsified by any unregistered member, registration during ordinary
update instead of birth, a changed RNG draw/order, a changed actor ID, duplicate
registration, or another live max-Water host failure.

## Integrated Region-order allocation owner

Probe-only Website head `aabe874d2598e71fd8b3755f7f4ffaeb3429ba5b`
adds no game, painter, renderer, protocol, or visual behavior. Exact Mac Safari
at ten enemies and 1,493 primary actors records `59.75` FPS with an empty
browser-error array. Its receipt is
`/private/tmp/integrated-region-diag-aabe874d-mac-water.json`, SHA-256
`319260888eb86f10d0ad7bd4f05362b3c06baa1b66b455aa8d38948ef7645f19`.

The integrated current-main Region pipeline is now the measured scene-order
owner. `scenePainterOrder` averages `1.269 ms` per presentation frame and the
shared Region planner accounts for `0.971 ms` of it. Within the planner,
manager gather/sort costs `0.154 ms`, registration validation plus row queuing
costs `0.332 ms`, and row flush/output costs `0.194 ms`; setup and remaining
planner work account for approximately `0.291 ms`. The Boneyard adapter around
the planner accounts for the remaining approximately `0.299 ms`. Collection of
the already-owned scene layers costs only `0.090 ms`. Confidence is high that
the owner is complete per-frame planning and allocation rather than one sort or
one actor family.

The existing pure pipeline rebuilds two ID maps, recursively rebuilds an
insertion-ID set, maps static and dynamic layers into a combined entry array,
allocates manager-sort wrappers, constructs a string registration key for every
root, clones every queued entry, allocates and freezes every positioned result,
then allocates a second Boneyard-specific positioned result. Those operations
repeat at presentation cadence even though IDs, manager registrations, static
adapters, and output storage have stable ownership. Validation, native manager
order, effective-Y rows, causal insertion timing, visibility, static banding,
and z-index assignment remain required and are not optimization permissions.

The admitted seam is a retained synchronous planner owned by the Boneyard
renderer. It reuses manager-lane roots, row buckets, queued slots, positioned
slots, static adapters, bands, and result arrays; detects duplicate manager
registrations adjacently in exact manager order instead of allocating string
keys; and carries root identity through the Region flush so the Boneyard
adapter does not reconstruct ID maps or insertion membership. Actor/scenery/
transient manager ordering, ordinal ordering, source-order ties, two-unit row
truncation, same-row append behavior, future-row insertion, backwards-insertion
rejection, ID and registration uniqueness, finite-value checks, visibility,
proxy membership, static band coalescing, foreground depth, and all final
position values remain exact.

The exported pure builders remain isolated snapshot APIs with their existing
value and freeze behavior. Only the live Boneyard renderer may consume the
retained ephemeral result, synchronously before the next build. Pooled slots
must release inactive actor references on the next frame and completely clear
on teardown; retained capacity may track high water, but live membership and
observable result lengths may not. Hub/private-room ordering, simulation,
protocol, audio, lighting, geometry, VFX, UI, and every draw primitive are
out-of-system.

This candidate is falsified by any changed ordered ID, manager lane or ordinal,
row, z-index, proxy, static band, Water run partition, foreground transition,
error boundary, frozen pure result, stale retired entry, unbounded live
reference retention, new browser error, or failure to materially reduce the
physical Region/painter phases. The exact integrated physical iPhone runtime
and matching diagnostic rows remain the promotion gate.

## Contaminated current-main physical control

An exact physical iPhone run at integrated runtime
`c834928b57407ef0a29815fac133d430727625a8` completed all three harness rows
without a browser error, but is not an admissible performance baseline. The Mac
mini was concurrently executing five CPU-bound OSRS native evaluators. Hub and
empty Boneyard retained `60.00/59.74` FPS while the host sustained approximately
100 ticks per second and 59 snapshots per second. During max Water, host rate
fell to `82.50` ticks per second and snapshot delivery collapsed to `7.56 Hz`.

That starvation produced a non-comparable 1,753-primary census: 1,067 Hail Mesh
actors, 253 normal Frost Mesh actors, 436 Cold Auras, and 137 Water Mesh runs.
The physical row records `11.08` FPS, p50/p95/p99 `78/240/428 ms`, maximum
`1,030 ms`, WebContent `1.1 GB`, and GPU `69 MB`. The receipt is
`/private/tmp/integrated-c834928b-ios-water-ios-element-water-8s.json`, SHA-256
`cbbd9afb5140157dee625bf6c8040cd548701af6a4b8346cc6ac38b1cd1ef2cb`.

This run proves that the integrated runtime remains serviceable through the
stress admission boundary under severe host starvation, but it does not measure
the browser optimization. Neither its frame timings nor its altered census may
be used in an A/B. The clean baseline must be repeated after the external Mac
workers exit, with host rate near 100 ticks per second and snapshot delivery
near 60 Hz throughout the Water window.

A follow-up after two of the original five workers exited independently failed
the same admission gate. Title readiness took approximately 86 seconds, empty
Boneyard fell to `55.34` FPS at `54.69` snapshot Hz, and max-Water primary
activity never arrived before the harness timeout. Its error receipt is
`/private/tmp/integrated-c834928b-ios-water-rerun-ios-element-water-8s.json`,
SHA-256 `0b5e83837269adf0f91a50709e6f4d12ac2955df4f8f828c59dd361d8e84739b`.
The external OSRS gate then advanced into another five-worker stage, confirming
that partial worker completion is not an admissible quiet-Mac boundary.

## Quiet-Mac current-main physical reopening and Cold Aura owner

The 2026-09-01 current-main candidate
`7382c9424b40a9dd0d2207895cc33a5420ebe172` was measured on the physical
iPhone XR after the Mac became idle. The device harness now drives the actual
right attack joystick, starts frame collection before input, releases input
inside the page at the requested wall-time boundary, and rejects an idle
primary window. This closes two earlier harness falsifiers: a window-level
synthetic mouse-down never reached the Boneyard host, and a report request made
before release could extend an intended eight-second cast while an overloaded
WebContent process serviced the Inspector request.

The exact product build records:

- Hub `59.99` FPS and empty Boneyard `59.97` FPS;
- eight-second max Water `23.03` FPS, p50/p95/p99 `42/64/111 ms`, maximum
  `180 ms`, and 132 frames over 34 ms;
- 1,472 primaries at peak, including 1,289 existing combined Water-mesh
  actors, 1,042 Hail, and 255 normal Frost actors in 63 runs;
- host simulation `99.34 Hz`, WebContent/GPU approximately `807/45 MB`, an
  empty browser-error array, and no transport close;
- receipt SHA-256
  `e516f51904546ac53ffd83c5eea1a40a2a695882e984a7f0636afb24d8b611d7`.

A probe-only tree preserves product simulation, protocol, decode,
interpolation, painter order, geometry, settings, and actor census while
timing the existing boundaries. At 1,491 primaries it records `19.82` FPS.
Average synchronous work per rendered frame is `18.49 ms` complete
presentation, `15.12 ms` renderer, `9.69 ms` scene update, `3.68 ms` primary
view, `2.09 ms` painter depth, `1.25 ms` retained Region planning, `0.79 ms`
Water geometry commit, and `2.89 ms` for the CPU-side WebGL submit call.
Strict client decode averages `6.28 ms` per authoritative snapshot. The
approximately 50-ms rAF interval therefore contains a large cost after the
measured synchronous submit call.

One-variable physical probes identify that cost and its membership:

- omit only final WebGL submission: `55.54` FPS at 1,488 primaries, receipt
  `87ff78d383c2b036a00fa46615f52e9bde23010f38b215691ab4d5f6f19a1f6e`;
- hide only the 63 existing Water/Hail Mesh runs: `25.78` FPS, receipt
  `041fbf8aaa743416df597c186701815eb012c9f6acde08cfdcaa5794b794e741`;
- hide every primary-spell visual: `42.93` FPS, receipt
  `4857dc321c990e95628c1929a492e8aff6e0af9024fd434a6ae21fa72e3361b8`;
- omit the Region-light render: `24.22` FPS, receipt
  `d9ce4b30656885ce707d865787b3a5bf4b5818824269dae9e38bc3ed39f49ef8`;
- hide only Cold Aura: `34.28` FPS at 1,470 primaries, including 132
  `water-aura`, 1,019 `water-hail`, and 314 `water` actors, receipt
  `ab75c65057be48910a6c0485af9522b22c3338c833fca471136ff98523873ebe`;
- hide Cold Aura and the existing combined Mesh together: `41.48` FPS at
  1,491 primaries, receipt
  `ba3a19562fb4d37c94a546aedb11775a2a9c28bc6db7292f63ef120c072cfd93`.

These probes are intentionally not visual candidates. They prove GPU/driver
backpressure, with Cold Aura as the largest unbatched primary family and the
existing combined Water/Hail draw as the secondary owner. Lighting and Region
planning are measurable but cannot explain the collapse. WebContent footprint
and JavaScript phases remain secondary work after the GPU owner closes.

## Combined Water/Hail/Cold-Aura affine mesh reopening

The next admitted representation adds Boneyard `water-aura` to the existing
combined affine Mesh owner. Its exact membership is one native `BadGuys:14`
quad per live Aura actor, using the unchanged authoritative origin, age-derived
scale, initial rotation plus rotation step, alpha decay, red fade/tint, actor
manager registration, ordinary-dynamic queue, world Y, and additive blend.
Birth, lifetime, movement penalty, damage behavior, RNG, protocol, audio, and
all non-Boneyard views remain outside the draw adapter and unchanged.

The retained Mesh adds the installed Cold Aura texture as a fourth resident
sampler. Aura contributes one affine additive quad at its globally assigned
depth. It may share a run only with immediately consecutive existing
Water/Hail/Aura depths; every player, enemy, scenery, Frost-over, secondary,
loot, foreground, or other painter gap still ends the run. The existing
zero-source-alpha encoding represents native Add on the opaque Arena target,
so texture sample, tint, quantized alpha, primitive order, and later normal
attenuation remain exact. No Aura fragment or visual pass is removed. The
structural win is removal of one Container and Sprite per Aura plus the
elimination of Aura-created gaps between otherwise consecutive combined-Water
actors.

Frost-over remains on its native post-world lane and Hurricane remains outside
the Water family. The candidate is falsified by any changed Aura census,
registration, depth, transformed corner, UV, texture sample, tint, alpha,
blend result, run partition, retirement, or pixel; by retained object/buffer
growth; by a browser error or transport close; or by failure to materially
improve the exact physical max-Water row with all visuals and settings enabled.
Focused geometry/composite/lifecycle tests, the canonical Mac gate, a Mac
pixel/census comparison, and a fresh physical iPhone row are required before
the representation can remain in the product candidate.

## Cold Aura mesh falsification

Exact candidate `22886e8056dfcac3ea5136b7d1cd366f4624b512` implemented the
fourth-sampler Aura membership above and passed Mac type-check, all ten focused
geometry/ownership/lifecycle tests, production build, and bundle budget. The
fresh physical all-visual row rejects it:

- Hub and empty Boneyard remain `60.00/59.91` FPS;
- max Water records `19.75` FPS, p50/p95/p99 `48/70/114 ms`, an `828-ms`
  maximum, and 327 frames over 34 ms;
- the unchanged 1,478-primary peak includes 1,408 combined Mesh actors, 133
  Aura, 1,040 Hail, and 256 normal Frost in 60 runs;
- host simulation remains `99.05 Hz`, WebContent/GPU are approximately
  `804/43 MB`, and the browser-error array is empty;
- receipt SHA-256 is
  `c1a66bc8f7a3c22d3b094f1c4f3c953eabd312966cfa28efa60c38166c1b6d97`.

The intended draw/run reduction therefore does not close the physical owner.
Aura is fill/tile expensive even after its display objects and run gaps are
removed; adding it to the combined shader also fails the no-regression gate.
The Aura-mesh implementation, fourth sampler, diagnostics, and tests are
removed completely. The evidence remains because it closes that structural
path. The next bounded probe preserves all draw calls and state while clamping
the diagnostic viewport/scissor to one pixel, distinguishing fragment/tile
work from per-draw or final presentation cost before another product change.

## Protocol-116 fragment and context isolation

The candidate was rebased cleanly onto `origin/main`
`46ec87a732b5330dbcab2850da7a4a9298810608`, advancing the live runtime to
protocol 116. Probe-only head
`539659f58bd2cc1feb5454a6c7f80609fc643874` contains the exact rebased product
plus timing and reversible renderer switches. Fresh physical rows at the same
approximately 36.5--36.9 C device state and 1,468--1,484-primary census record:

- unchanged control: `21.90` FPS, p95/p99 `63/107 ms`, maximum `224 ms`,
  receipt `cdfb6d2e62ec96bcf486966cfff51782958dbedd536a9554d71edf54c30a0d04`;
- unused root depth buffer disabled: `20.94` FPS, p95/p99 `62/227 ms`, receipt
  `635d068cfa68a38ced8dea1f06d2142e5e805b28218dff873ff9171116985a8e`;
- exact zero-alpha fragment discard: `23.82` FPS, p95/p99 `58/101 ms`,
  maximum `183 ms`, receipt
  `e5bd00e1a0f3cd7abec2973ff492ceb3bb69f328485264378d652a857f94e8c4`;
- Arena saturation bypassed: `24.38` FPS, p95/p99 `60/97 ms`, receipt
  `fed4b8a0536bddc1bc858906235a7cf5327bb6e36e4ba0d29304ab857b4040fe`;
- Boneyard resolution capped at 0.5: `29.69` FPS, p95/p99 `50/62 ms`, receipt
  `9784ef1d2023efd57cac738c3a56c45a76b670db5a4100ef6edab9d1d960c12c`;
- desynchronized WebGL context: `21.06` FPS, p95/p99 `73/182 ms`, receipt
  `4214fba4a6e0c8ec58dbe68dc4eff0f21397b248087b13a7fa8522a255d4a2ee`.

Depth-buffer removal and desynchronized presentation are closed. Resolution
scales materially with the load but is rejected as a product correction
because it changes image resolution. Removing saturation changes the native
image and produces no additional recovery beyond the exact discard of
transparent work, so saturation remains unchanged.

The zero-alpha discard is admitted only for the Arena pipeline. In those
shaders, a fragment with
texture alpha zero or vertex alpha zero produces final alpha zero. Native
normal blending then leaves destination RGB/alpha unchanged, and native Add
contributes zero while preserving destination alpha. Skipping that fragment is
therefore exactly equivalent for both blend families. No nonzero fragment,
texture sample, saturation result, painter order, draw, resolution, or game
state changes.

Applying the same mathematical discard to the custom combined Water/Hail
shader is nevertheless physically rejected. Exact product head
`b813c65830ed4f3b6661818b96cf93543a265de6` records `18.83` FPS,
p95/p99 `79/201 ms`, and a `650-ms` maximum at 1,488 primaries. Its receipt
SHA-256 is
`37f689ff22709cc0a07644b67f8fdd018e1ca4cf183dea65dd7c74f259a8a2c0`.
Fragment `discard` in that dominant mixed custom shader defeats more GPU work
than it saves, so the Water/Hail change and its extra test are removed.

Regression must cover zero-alpha normal and Add equivalence, shader ownership
for Arena batch/graphics/mesh, opaque/nonzero retention, and context
restoration. The canonical Mac gate, pixel comparison, and a fresh all-visual
physical Water A/B remain required. The approximately nine-percent physical
gain is valid but not the final excellent-performance closure.

## Premultiplied Arena saturation algebra reopening

Exact product candidate `970cacc77dd21f84fb6769317d7c8cf366ed8078`
passes the focused Mac renderer gate and records Hub `60.00` FPS, max-Water
`22.99` FPS, p50/p95/p99 `46/66/81 ms`, and a `224-ms` maximum at 1,490
primaries. The peak includes 132 Cold Auras, 1,040 Hail, and 317 Water actors;
host simulation remains `99.49 Hz`, the browser error array is empty, and the
physical receipt is `/private/tmp/iphone-current-970cacc7-ios-water.json`.
This confirms the Arena-only zero-alpha discard but does not close the dense
Water owner.

The installed Arena fragment path reconstructs straight texture and vertex
colors by dividing premultiplied RGB by their respective alphas. It then
computes native saturation and multiplies the result by the same two alphas
before premultiplied blend. For a premultiplied texture this round trip is
algebraically redundant:

`saturate(T.rgb / T.a, V.rgb / V.a) * T.a * V.a`

equals the same native grey/real mix evaluated directly from `T.rgb` and
`V.rgb`. Both the separate texture-grey times vertex-grey term and the real
color product are bilinear, so the alphas cancel without approximation. Final
alpha remains exactly `T.a * V.a`. The non-premultiplied branch retains its
straight-color calculation and output convention unchanged.

The candidate therefore specializes only the premultiplied Arena branch used
by packed Boneyard sprites, graphics, and premultiplied meshes. It removes two
per-fragment divisions from that branch while retaining the texture sample,
native `0.65` saturation, tint, alpha, blend family, painter order, geometry,
resolution, and every gameplay/lifecycle owner. It is falsified by any CPU
equivalence mismatch, changed shader ownership, pixel mismatch, browser error,
or failure to improve a fresh physical max-Water row. Focused equivalence and
shader tests, a Mac production build, and a physical iPhone A/B are required
before it can remain.

## Premultiplied Arena algebra falsification

Exact candidate `a5956574aa978faefd6ff1d0c5e1ae2c0b08cb1d` passes the focused
equivalence tests, TypeScript gate, production build, and bundle budget. A
fresh physical run after recycling Safari and the Web Inspector bridge rejects
the universal shader specialization:

- Hub and empty Boneyard remain `60.00/59.99` FPS;
- max Water falls to `21.26` FPS, p50/p95/p99 `47/66/110 ms`, maximum
  `280 ms`, and 130 frames over 34 ms;
- the unchanged peak has 1,495 primaries and 12 enemies, host simulation
  remains at its 100-Hz target, and the browser-error array is empty;
- the receipt is `/private/tmp/iphone-current-a5956574-ios-water-r2.json`.

The identity is mathematically valid, but a runtime branch around the two
texture-alpha conventions is slower on the physical iPhone GPU than the prior
straight-color path. The shader change, CPU helper, and test are removed. This
closes a universal Arena specialization; any next shader attempt must be fixed
to one proven texture convention and one bounded visual family rather than
adding a divergent branch to every Arena fragment.

## Fixed Cold Aura particle-run reopening

The next bounded candidate changes only Boneyard Cold Aura presentation. Every
authoritative `water-aura` identity keeps its actor-manager registration,
world-Y sort, record-14 texture frame and anchor, owner-following origin,
float32 age scale, rotation, tint, truncated 8-bit alpha, additive blend, and
independent primitive order. Hub continues to use the ordinary retained
`AirWaterActorSpellView`.

Within Boneyard, immediately consecutive Aura depths may share one Pixi
`ParticleContainer`. Any player, enemy, scenery, Hail, Frost, secondary, loot,
static band, proxy, or foreground depth ends the run. The particle buffer keeps
one quad per actor and the GPU still performs one additive blend per quad, so
framebuffer quantization and later normal attenuation remain unchanged. The
adapter only removes one Container/Sprite pair per actor and the generic Arena
batcher's multi-texture alpha-mode path.

The dedicated shader is fixed to the packed combat atlas's
`no-premultiply-alpha` source contract. It carries straight tint into the
fragment stage, moving the container-color unpremultiply to four vertices per
actor and eliminating the generic per-fragment texture-mode branch and vertex
alpha division. Texture RGB is already straight. Zero-alpha discard, `0.65`
saturation, final alpha, and adjusted non-premultiplied Add blend remain
identical. Construction fails closed if the texture source convention changes.

The candidate is falsified by a changed actor census, registration, depth/run
partition, particle transform/color, texture convention, blend, Hub behavior,
lifecycle, or screenshot; by a browser error or transport close; or by failure
to beat the exact physical max-Water control. Focused shader, painter-gap, and
retirement tests, Mac build/pixel proof, and a fresh iPhone row are required.

The first physical admission attempt against candidate
`a91a175cac9644355a282e738d960da09ef499be` proved that source-policy guard:
Hub remained at `60.01` FPS, then Boneyard renderer readiness timed out because
the initial adapter incorrectly required a premultiplied source. No Boneyard or
Water row was admitted. The receipt is
`/private/tmp/iphone-current-a91a175c-ios-water.json`. The implementation is
corrected to the observed packed non-premultiplied policy before another run.

## Fixed Cold Aura particle-run falsification

Exact corrected candidate `e052884eb5533ac6e3c554a0dde7b7ebab3eae3a`
passed the focused renderer tests, TypeScript gate, production build, bundle
budget, and exact Mac deployment guard. A deterministic Mac structural run
also showed that 82 live Aura actors collapsed into only eight painter-safe
particle runs at a 1,394-primary peak. Run fragmentation was therefore not the
dominant uncertainty.

The fresh physical iPhone run rejects the representation decisively:

- Hub remains `60.00` FPS, while the empty Boneyard control records `55.49`
  FPS after its startup tail;
- max Water collapses to `3.84` FPS with p50/p95/p99 `75/1592/1630 ms` and a
  `1630-ms` maximum;
- the peak retains 1,396 primaries: 81 Aura actors in ten runs, 1,022 Hail,
  1,262 combined Water-mesh actors, and 250 normal Frost in 59 runs;
- host simulation falls to `49.09 Hz` during the presentation stall even
  though gameplay input remains unblocked and the browser-error array is
  empty;
- the receipt is
  `/private/tmp/iphone-current-e052884e-ios-water-lean2.json`, SHA-256
  `2d055a716b779fbd4a12227c46dc25fb1f9a3d99927ecf4044473e30128b0c6c`.

The result is too large to attribute to sampling noise, startup temperature,
or the difference between eight and ten runs. `ParticleContainer` is not an
admissible Cold Aura owner on the physical A12/WebKit path even when it
preserves actor count, painter gaps, and texture convention. The particle
owner, dedicated shader, diagnostics, and tests are removed completely. Any
future Aura correction must retain the proven ordinary Sprite path until a
smaller probe identifies the physical cost without changing its render pipe.

## Cold Aura ordinary-Sprite batch specialization reopening

The next bounded candidate retains every existing `AirWaterActorSpellView`,
Container, and Sprite. It does not change Aura identity, allocation,
transforms, texture/frame/anchor, painter registration, world-Y order,
visibility, tint, alpha, Add blend, or lifecycle. It changes only the Arena
batch shader selected for a marked Cold Aura Sprite.

The packed combat atlas is authoritatively `no-premultiply-alpha`. The ordinary
Arena batch vertex path currently premultiplies Sprite tint by vertex alpha;
the generic fragment path then divides it back to straight tint. It also
carries a per-fragment texture-alpha-mode branch even though every Cold Aura
sample has the same non-premultiplied source contract. The specialized batch
path carries the already-straight packed tint through four vertices and uses a
fixed straight-texture fragment. Native texture-grey times tint-grey,
`0.65` saturation, final alpha, zero-alpha discard, and Pixi's adjusted
`add-npm` blend remain unchanged.

The custom batcher is created lazily only when a marked Aura Sprite enters an
instruction set. It uses the ordinary Sprite batch geometry and one texture
slot; consecutive Aura painters remain a batch, while every existing painter
or blend gap still breaks it. This avoids the rejected ParticleContainer
render pipe and changes neither primitive count nor framebuffer blend order.

The candidate is falsified by any changed CPU color result, Sprite transform,
texture convention, batch/run order, blend state, actor census, Hub behavior,
lifecycle, screenshot, browser error, or physical max-Water regression. It may
remain only after focused shader/routing tests, Mac type/build/pixel proof, and
a fresh physical iPhone row against the exact `970cacc7` control.

## Cold Aura ordinary-Sprite batch specialization falsification

Exact rebased candidate `703239eb54b23604753ee899a25f852edb41e2d2`
passes focused lint, TypeScript, 14 renderer tests, production build, bundle
budget, and an exact-revision Mac stress run. The runtime diagnostic proves
that the intended path is live: 10,941 Aura Sprite submissions route through
the custom batcher during the physical stress window.

The physical iPhone row rejects it:

- Hub and empty Boneyard remain `60.00/60.01` FPS;
- max Water records `20.43` FPS, p50/p95/p99 `43/57/166 ms`, a `979-ms`
  maximum, and 125 frames over 34 ms;
- the 1,471-primary peak includes 132 Aura, 1,040 Hail, 313 Water, and 256
  normal Frost actors in 63 combined mesh runs;
- host simulation remains `102.31 Hz`, gameplay input remains unblocked, and
  the browser-error array is empty;
- the receipt is `/private/tmp/iphone-current-703239eb-ios-water.json`,
  SHA-256
  `18f10ccb328a16b4ee769653ea0c20771eb45fba70acb83da1bb81cbd55d1d7f`.

The specialized ordinary-Sprite shader is 11 percent slower than the exact
`22.99` FPS control despite removing the two intended fragment branches. The
separate batcher boundary and fixed shader do not close the Aura cost on the
physical WebKit/Apple GPU path. The marker, Sprite-pipe hook, batcher, shader,
diagnostic, and tests are removed completely. The established ordinary Arena
batch path remains authoritative.

## Cold Aura transparent-border trimming reopening

The retained `BadGuys:14` Cold Aura record is a `63 x 63` RGBA frame. A raw
8-bit alpha scan, including values below ordinary crop-detection thresholds,
finds nonzero texels at inclusive source coordinates `x=0..61`, `y=3..60`.
The candidate therefore preserves the full width and one transparent texel of
vertical linear-filter support: it presents `x=0..62`, `y=2..61`, a
`63 x 60` physical frame inside the unchanged logical `63 x 63` record. This
removes only 4.8 percent of Aura quad area; no thresholded or faint nonzero
texel is discarded.

The derived Pixi Texture retains `orig=63 x 63` and uses
`trim=(0,2,63,60)`, so the Sprite's stock anchor, origin, scale, rotation,
world position, painter depth, tint, alpha, and Add blend are unchanged.
Source UVs are expressed as fractions of the original record rather than
recomputed from the cropped rectangle; this preserves the existing native
half/quarter-texel UV convention exactly. The shared packed `BadGuys:14`
texture remains unchanged for Frost spark and every other owner.

The candidate is falsified by any nonzero-alpha exclusion, changed logical
bounds/anchor/UV sample, changed actor or painter census, lifecycle leak,
screenshot mismatch, browser error, or physical max-Water regression. It may
remain only after alpha-bound and UV tests, focused Mac rendering/build proof,
and a fresh physical iPhone row.

Exact candidate `ef819b8a60863d5730bd26f5700274e925cbb372` passes focused
lint, TypeScript, record-geometry/UV/lifecycle tests, production build, bundle
budget, exact-revision Mac stress, and the fresh physical row:

- Hub remains `60.00` FPS and empty Boneyard records `59.38` FPS;
- max Water improves from the `22.99` FPS control to `23.45` FPS, with
  p50/p95/p99 `44/61/104 ms` and a `174-ms` maximum;
- the comparable 1,468-primary peak includes 133 Aura, 1,029 Hail, 311 Water,
  and 252 normal Frost actors in 68 combined mesh runs;
- host simulation remains `100.09 Hz`, gameplay input is unblocked, and the
  browser-error array is empty;
- the receipt is `/private/tmp/iphone-current-ef819b8a-ios-water.json`,
  SHA-256
  `346095d05c936118cde57589760fa4bf0de2273bac17eac4d194e7c21138f83d`.

The gain is intentionally small because the exact alpha support permits only
a 4.8-percent area reduction. It clears the no-regression gate and retains all
visible texels, original logical geometry, native UV interpolation, and the
ordinary Arena batch path, so the trim remains in the product candidate.

## Cold Aura conservative batchable hull reopening

The inspected `badguys/0014.png` SHA-256 is
`d765072a83dff46dfa71d5a3b6a2411efecebcb2871335967d39f786ddd0c290`.
The raw nonzero-alpha mask, expanded by one logical texel and clipped to the
`63 x 63` record, has this convex hull in authored record coordinates:

`(0,22) (4,17) (13,8) (17,6) (41,2) (50,2) (54,4) (57,8)
(62,17) (63,19) (63,29) (61,44) (60,47) (59,49) (51,58) (50,59)
(45,62) (18,62) (13,60) (9,56) (3,47) (2,45) (0,37)`.

Its area is `3160.5` logical pixels versus the Sprite quad's `3969`, a 20.4
percent reduction. To avoid packing 23 vertices per live actor, the candidate
uses the eight supporting half-planes `x=0`, `x=63`, `y=2`, `y=62`,
`x+y=21`, `x+y=109`, `x-y=-47`, and `x-y=50`. Their circumscribed octagon is
`(63,13) (63,46) (47,62) (15,62) (0,47) (0,21) (19,2) (52,2)`.
It contains the complete expanded hull, has area `3298.5`, and still removes
16.9 percent of the original quad.

The candidate replaces only the Cold Aura child Sprite with a shared
eight-vertex `MeshGeometry`. The Mesh remains batchable, so Pixi routes it
through the same ordinary Arena batcher, texture source, saturation shader,
and `add-npm` blend. Container identity, actor identity, painter depth,
transform, tint, alpha, and lifecycle remain unchanged. Geometry positions
bake the stock record anchor, while logical `x/63,y/63` UVs pass through the
admitted trimmed Texture's matrix and reproduce the original native UV domain.

The candidate is falsified by failure of hull containment/triangulation,
changed world bounds or native UVs, a non-batchable Mesh, actor/painter census
change, retained geometry growth across scene generations, screenshot mismatch,
browser error, or physical max-Water regression. It requires focused geometry,
batchability, transform, teardown, Mac runtime, and physical iPhone proof.

## Cold Aura conservative batchable hull falsification

Exact candidate `ace3ab57d8df0df02520832ec89e761efe89033c` passes hull
containment, area, triangulation, batchability, transform, focused renderer,
TypeScript, build, bundle-budget, and exact Mac runtime gates. The eight-vertex
octagon restores Mac max-Water performance to `59.60` FPS after the rejected
23-vertex hull recorded `58.40` FPS.

The physical iPhone still rejects it:

- Hub and empty Boneyard remain `60.00/59.94` FPS;
- max Water records `23.13` FPS, p50/p95/p99 `44/62/125 ms`, and a `244-ms`
  maximum at 1,475 primaries and 12 enemies;
- this is below the admitted trim-only row's `23.45` FPS and worsens its
  `61/104-ms` p95/p99 and `174-ms` maximum;
- gameplay remains unblocked and the browser-error array is empty;
- the receipt is `/private/tmp/iphone-current-ace3ab57-ios-water.json`,
  SHA-256
  `5829de2f6693d3a5c16b5dd4484498f5c76b0a21739dd90d249bc3bf091940ef`.

Even the reduced eight-vertex Mesh packing cost exceeds the saved fragment
work on physical WebKit. The Mesh child, shared geometry, hull tables, and
tests are removed completely. Cold Aura remains on its admitted trimmed
ordinary Sprite path.

## Physical Earth contact-painter collision reopening

Exact physical candidate `83d807665f0827308507be561e5ff79131b746f0`
reproduced a renderer failure during max-rank Earth contact on the iPhone XR:
actor-manager registration ordinal `161` was simultaneously owned by
`primary-spell:161` and `enemy-death-effect:14`. The clean Hub and empty
Boneyard controls reached `60.00` and `59.79` FPS before the contact, so this
is an authoritative ownership collision rather than a stalled device row.

The full membership trace closes the defect to
`resolveBoneyardSpellCombat.publishEarthBoulderContactDebris`. The helper
creates `earth-boulder-bit` with no registrar argument. Its constructor then
falls back to a private `NativeWorldManagerOrder` seeded from the spell id and
returns an already-populated painter root. `enrollCombatActor` correctly
preserves existing registrations, so it cannot replace that private ordinal
with the game simulation's shared actor-manager sequence. Enemy terminal
effects independently and correctly consume the shared sequence; the two
domains therefore collide when their counters meet.

The correction must pass `registerCombatPainter` into every Earth contact-rock
constructor. It changes no actor identity, debris program, geometry, tint,
blend, position, order, lifetime, damage, or gameplay state. It is falsified
by any contact rock retaining its spell id as painter order when the supplied
shared registrar returns another ordinal, or by any duplicate actor-manager
registration in the physical Earth journey. A focused disjoint-id regression,
the complete Website gate, Mac runtime proof, and a fresh physical Earth row
are required before closure.

## Exact current-main Water regression reopening

Exact reconciled candidate `8b47431f85d29fca9f6f8589f9e94a5325b5063e`
passes the complete Website gate and preserves the admitted Cold Aura trim.
Its fresh 2026-09-02 physical iPhone XR Water row has healthy controls but a
new severe stress result:

- Hub `59.98` FPS and empty Boneyard `58.84` FPS;
- max Water `11.26` FPS, p50/p95/p99 `61/243/525 ms`, an `830-ms` maximum,
  and 106 of 112 measured intervals over 34 ms;
- 1,492 primaries at peak, including 1,052 Hail Mesh actors, 254 normal Frost
  Mesh actors, 136 ordinary Cold Aura views, and 103 combined Water Mesh runs;
- host simulation remains `99.79 Hz`, gameplay input remains unblocked, and
  the browser-error array is empty;
- WebContent/GPU footprint is approximately `760/39 MB`; battery temperature
  falls from `34.69` to `33.89 C`, so rising battery temperature does not
  explain the collapse;
- receipt `/private/tmp/iphone-final-8b47431f-ios-element-water.json`, SHA-256
  `3d2ac363c156b784f72b3e6d00fa2e885b1f591368ef1247ced5d27cf13875a3`.

The clean empty control admits the row. The unchanged near-100-Hz host excludes
authority simulation as its owner. The frame and snapshot loops collapse
together only after the all-visual Water load begins, consistent with the
already isolated physical WebGL submission/backpressure owner. This result is
not accepted as the final branch state and reopens Water before handoff.

## Single packed-atlas Water sampler candidate

The three textures consumed by `NativeWaterMeshRuns` are Hail `BadGuys:32`,
Frost core `BadGuys:30`, and Frost glint `BadGuys:28`. The generated combat
atlas places all three on page zero, and `createBoneyardCombatAtlas` creates
their subtextures over the same page `TextureSource`. Their UVs are already
page-space UVs. The current custom shader nevertheless binds that identical
source through three sampler uniforms, carries a per-vertex texture id, and
dynamically selects both sampler and alpha convention for every fragment.

The bounded candidate requires one shared page source with the installed
`no-premultiply-alpha` convention, binds it once, and samples the unchanged
per-record page UV. It removes only the redundant texture-id attribute, three-
way sampler branch, and unreachable premultiplication branches. Hail/Frost
geometry, transforms, UVs, tint, quantized alpha, normal/additive encoding,
native `0.65` saturation, global painter depths, run partition, actor census,
resolution, lighting, shadows, simulation, protocol, and lifecycle remain
unchanged.

This is exact only while source identity and alpha convention are common, so
construction must fail closed if either differs. Regression coverage must
prove the common-source guard, reject a distinct source, preserve each record's
UV and logical geometry, keep the additive flag and vertex colors at their new
stride, preserve native composite algebra, painter gaps, retained buffers, and
teardown, and exercise the real packed-atlas load. A focused gate, production
build, exact Mac runtime, and fresh physical iPhone Water A/B are required. The
candidate is rejected if it changes pixels or membership, produces a browser
error, or fails to materially improve the admitted physical Water row.

## Single-sampler Cold Aura integration experiment

The earlier combined Water/Hail/Aura candidate `22886e80` remains physically
rejected as implemented. It added a fourth sampler and another varying-selected
fragment branch to the dominant mixed shader while also moving Aura into the
combined affine owner. Its `19.75` FPS result therefore closes that exact
four-sampler representation, but it does not isolate the affine owner after
the shared-page fact above removes every texture-selection branch.

This follow-up is deliberately staged only after the single-sampler Water/Hail
candidate. It adds `BadGuys:14` Cold Aura through the same already-bound page
zero source and direct page UVs. One unchanged affine quad carries the existing
trimmed texture, native anchor/logical bounds, owner-following origin,
age-derived float32 scale, rotation, tint, quantized alpha, additive encoding,
actor registration, world Y, and painter depth. Consecutive Water/Hail/Aura
depths may share a run; every other global painter gap still splits it. The
candidate adds no sampler, texture-id varying, or fragment branch.

Simulation identity, Aura birth/lifetime/RNG, gameplay slow/damage, audio,
protocol, painter membership, per-quad blend order, resolution, and all Hub
presentation remain unchanged. Regression coverage must prove exact Aura
geometry/UV/color/alpha, actor-manager registration, run gaps, census,
retirement, and source-policy failure. It is rejected unless a fresh physical
iPhone row materially beats the single-sampler Water/Hail result with all
visuals enabled; Mac-only run reduction is not promotion evidence.

## Physical single-sampler decision and closure

Both candidates were served from clean detached Mac checkouts through the same
Tailscale route and exercised on the same USB-attached iPhone XR running iOS
18.7.6. Each run used complex lighting and shadows, native resolution, normal
WebGL submission, and the complete Water presentation; no diagnostic hide,
clamp, discard, or input-activity override was enabled.

The Water/Hail-only candidate
`7458d4e0299afd848066f4e71ea9fb3faa075816` materially improves the reopened
`8b47431f` row but does not recover the previously admitted Water range:

- Hub is `60.00` FPS and empty Boneyard is `55.15` FPS;
- max Water is `16.43` FPS with p50/p95/p99 `52/80/201 ms`, a `1,106-ms`
  maximum, and 145 measured intervals over 34 ms;
- the 1,473-primary peak includes 1,278 combined mesh actors, 1,030 Hail Mesh,
  256 normal Frost Mesh, 134 ordinary Cold Aura views, and 60 combined runs;
- host simulation remains `99.54 Hz`, gameplay input remains unblocked, and
  the browser-error array is empty;
- battery temperature falls from `36.09` to `35.50 C`;
- receipt `/private/tmp/iphone-final-7458d4e0-ios-element-water.json`, SHA-256
  `d985d7b596bf9d44a460205d899a7f40cfb45862dd0f97d7f4c7759e0578a8a7`.

The single-sampler Cold Aura candidate
`2fbb40937527a1143e2e08baca49d6a5cfe1eb61` wins the direct device comparison:

- Hub is `60.00` FPS and empty Boneyard is `59.68` FPS;
- max Water is `22.62` FPS with p50/p95/p99 `43/64/121 ms`, a `205-ms`
  maximum, and 144 measured intervals over 34 ms;
- the 1,473-primary peak includes 1,405 combined Water/Hail/Aura mesh actors,
  1,038 Hail Mesh, 255 normal Frost Mesh, 133 Cold Aura Mesh, and 59 combined
  runs;
- host simulation is `100.00 Hz`, gameplay input remains unblocked, and the
  browser-error array is empty;
- battery temperature falls from `36.19` to `36.00 C`;
- receipt `/private/tmp/iphone-aura-2fbb4093-ios-element-water.json`, SHA-256
  `1222fc7a4a637929fc184453fa3e46dd52fee7cea4a3bf33a5caaa81de43427c`.

Against the immediately preceding single-sampler row, integrating Aura raises
average max-Water throughput by `37.6%`, lowers p50/p95/p99 by
`17.3%/20.0%/39.8%`, and cuts the maximum observed interval by `81.5%` without
changing the effect census, host cadence, or error state. Against the reopened
clean `8b47431f` row it approximately doubles max-Water throughput. Its Mac
receipt also holds max Water at `59.75` FPS with the same 1,474-primary class of
load and no errors.

The experiment is therefore promoted. Before this receipt-only closure was
appended, its cherry-picked inspection-branch tree was
`228fb3bf0a2eb5d4d571f46b56bf1aab7d38946d`, exactly matching the physically
exercised candidate tree. This closes the four-sampler rejection while
accepting only the guarded one-source representation: Cold Aura joins the
existing page-zero mesh without adding a sampler or fragment branch. The
pathological maximum Water load remains the device floor; ordinary Hub,
Boneyard, modal, movement, enemy, and non-Water elemental rows retain their
separately recorded higher results.

## 2026-09-03 — retained Water index-upload lifecycle reopening

### Reported smell and parity question

- Reported web behavior: repeated Frost Jet casts leave prior spray geometry
  visible when a later cast begins. The artifacts accumulate while Water is
  held and disappear when Water stops rendering.
- This reopens the combined Water/Hail/Aura mesh closure above. That pass
  proved CPU arrays, retained allocation, actor expiry, and physical throughput,
  but its lifecycle test inspected only the zeroed JavaScript index array. It
  did not model Pixi WebGL's lazy buffer upload while an owning Mesh is hidden.
- Stock behavior remains closed by the Frost entries: Normal and Over children
  expire independently after 32 or 33 completed 100-Hz updates, release stops
  new births, and no retired child can re-enter a later cast. The question is
  whether the packed web representation preserves that destruction boundary
  across asynchronous CPU-to-GPU delivery.
- Falsifiers: authoritative or presentation Frost IDs survive past their native
  lifetime; the ordinary Over Sprite path leaks; the default framebuffer is not
  cleared; a full dirty index-range upload leaves the old-direction geometry;
  or the same lazy-retirement error cannot affect Hail and Cold Aura, which
  share the buffer owner.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native instruction evidence | retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Frost constructors/update/renders `0x00453550`, `0x00453840`, `0x00453670`, `0x00457720`, `0x00457A00`; handler `0x00543860` | Frost children own independent 32/33-tick lives and destruction. Release changes birth/audio ownership, not the lifetime of already-born children. | high-existing |
| Current Website causal trace | `origin/main` `286d0d0c8c981736421f2434af74b256b73ca5d7`; `primary-spell-water-mesh-runs.ts`; installed PixiJS 8.19 `Buffer` and WebGL buffer/mesh adaptors | A retained run has a full-capacity index array. Retirement zeroes only the former active prefix and calls `Buffer.update(formerBytes)`, then hides the Mesh. Reactivation can call `Buffer.update(smallerBytes)` before either update reaches WebGL. Pixi retains only the later update size, while its Mesh adaptor draws the complete index-array length. | high-static |
| Exact Mac Chrome reproduction | clean detached current-main build; four release-to-zero casts followed by one uninterrupted four-direction cast; each direction held two seconds, beyond Frost lifetime and snapshot interpolation; 1600 x 900 headless Chrome | Every release reached zero authoritative/presentation/mesh actors and every held sample stayed at 62..64 live Frost actors. Wire directions contained only the current quadrant, but old-quadrant spray remained visible after reactivation. Page/wire errors were empty. Disposable control sweep image SHA-256 values were `ebc29eea29e16f80c9a4afe8a4ac20e3c867d12161e3047bd32d5eb75d4ee07b`, `55dd50ab6591bfc00af593e13bd9d924d8d7fd3a42275fedeb2c921ddd20f687`, `79b781df80886176dcece6c647c428929d437184c56a2aff641fdc303ba32ecb`, and `87bf1ccc65757900c9e553a7a4188faf2a295f6e552baa7dd6756fcf5be037ac`. | high-browser |
| One-variable browser probe | same clean current-main build and journey; only the index update size changed to the complete retained index array | Old-quadrant spray disappeared while actor counts, directions, lifetime, shader, draw order, and all spell state remained unchanged. Disposable probe image SHA-256 values were `cb1556a9f6bfcb7f9ac3f1b60a07f25096b98d8de4e31e92016583f2f332c928`, `4a4f5c3152ef65c2e0107785838eaf157c27b9021bc73fe7c77134dd86537bec`, `c8512401959fa23a1461886bdaee1811a95438ca58452bcea42d4cd0a487d344`, and `23e988ac9fb8bd2d6498998c64495cc8d68891548e72fe5679ae8d73456d0bad`. | high-browser |

All diagnostic screenshots, temporary source changes, and local/Mac diagnostic
worktrees were removed after the findings above were recorded. No production
runtime or occupied foreign Mac process was changed.

### System boundary and membership inventory

Native system: destruction of independently registered Water-family visual
children. Web boundary: the Boneyard-only retained affine-mesh index lifecycle
from active draw membership through shrink, empty retirement, reactivation,
capacity replacement, and renderer teardown.

| Member | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| Normal Frost core/additive/glint quads | `0x00453550`, `0x00453670`, `0x00457720` | `exact-ported` after this reopening | a smaller later cast cannot draw an index used by an expired earlier cast |
| Over Frost Sprite path | `0x00453840`, `0x00453670`, `0x00457A00` | `verified-already-at-parity`; out of the packed mesh | repeated-cast census and browser frames show no retained View or old-direction Sprite |
| Hail affine quad | `Anim_Hail` vtable `0x0078501C`, Bouncer tick `0x00458D80` | `exact-ported` through the shared correction | retirement and later smaller Water-family activation cannot resurrect a Hail index |
| Cold Aura affine quad | `0x0045AF20`, `0x0045AFB0`, vtable `0x00785540` | `exact-ported` through the shared correction | owner loss/expiry and later activation cannot resurrect an Aura index |
| active run growth | packed Website representation only | `exact-ported` optimization boundary | newly activated indices upload through the retained typed array without changing resource identity |
| active run shrink | packed Website representation only | `exact-ported` optimization boundary | every formerly drawable index in the dirty high-water range reaches WebGL as zero |
| empty hidden run and later reactivation | packed Website representation only | `exact-ported` optimization boundary | a lazy hidden update cannot be superseded by a smaller visible prefix |
| power-of-two capacity replacement | packed Website representation only | `verified-already-at-parity` | replacement starts zeroed, preserves painter slot, and destroys the old GPU resource |
| Boneyard painter-run partition | native actor/transient manager order recovered above | `verified-already-at-parity` | run count/depth/order and common-atlas shader output remain unchanged |
| Hub Water Sprite renderer | same stock Frost classes through the non-packed Website view | `out-of-system` for this buffer defect | Hub owns no `NativeWaterMeshRuns`; existing expiry/teardown coverage remains |
| simulation, snapshots, interpolation, observer and save state | shared authoritative Water lifecycle | `verified-already-at-parity` | 32/33-tick IDs and current aim remain bounded and unchanged |
| renderer/world destruction | stock child destruction plus Website scene owner | `verified-already-at-parity` | all Mesh, Geometry, Shader, maps, and arrays still destroy exactly once |

No member is blocked by the browser platform. The fix is WebGL resource
lifecycle bookkeeping and changes no native-visible mechanic or pixel.

### Ownership thread and recovered behavioral contract

- The host remains the sole owner of Water IDs, birth, age, direction, and
  retirement. The presentation timeline may retain object storage only until
  the next synchronous sample. Neither owner leaked in the reproduced run.
- `NativeWaterMeshRuns` owns one long-lived CPU typed array and one GPU buffer
  per painter run. `activeQuadCount` describes current CPU membership; it is
  not proof of the largest nonzero range still resident on the GPU.
- Pixi coalesces multiple pre-render `Buffer.update(size)` calls into the latest
  update size. A hidden Mesh can therefore carry an undelivered larger clear
  across frames. The web owner must retain a monotonic per-resource activated
  index high water and include that complete range in every later size-changing
  index upload.
- Vertices need only the current active prefix because indices outside that
  prefix are guaranteed zero after the corrected upload. Capacity replacement
  resets the high water with a newly zeroed array and new GPU resource.
- Release, owner removal, world replacement, and destruction retain their
  existing behavior. The correction changes no actor count, lifetime, shader,
  texture, UV, alpha, blend, depth, or draw partition.

### Nearby-system findings

- The existing combined-mesh regression proves CPU index zeros but cannot
  prove lazy GPU delivery. This is why the earlier green test admitted a real
  browser resurrection.
- The existing primary-spell browser driver used a stale selector that looked
  for `data-prompt-kind` on the dialog instead of its prompt-stage owner. A
  current-main clean run exposed that harness defect before the Frost journey;
  the maintained selector must follow the current native prompt ownership so
  the new browser regression remains executable.

### Confidence and open questions

- Confirmed: bounded authoritative/presentation membership, exact old-direction
  browser reproduction, full-range one-variable falsification, Pixi 8.19 lazy
  update-size overwrite, and complete shared mesh membership.
- Inferred: none used to select the owner.
- Unknown: no native or browser semantic unknown. The exact minimum upload range
  is the greatest index ever activated in the current retained GPU resource;
  bytes above it have never contained drawable indices.

### Web implementation consequence

- Add a per-run activated-index high water initialized with each new retained
  resource. Never lower it while that resource lives.
- When active quad count changes, upload indices through that high water, not
  merely through the newest or immediately previous CPU count. Continue
  uploading only the active vertex prefix.
- Add a failing regression for `larger active -> hidden empty -> smaller active`
  that asserts the smaller visible update still covers and zeros the previously
  drawable index range. Preserve stable typed-array/resource identity.
- Repair only the stale tutorial-prompt selector needed by the maintained
  browser journey; add no compatibility fallback or product behavior.

### Validation contract

- Focused Mac test: combined Water mesh growth, shrink, hidden empty, smaller
  reactivation, common-source shader, painter partition, and destroy coverage.
- Exact Mac browser: repeated release-to-zero casts plus a continuous
  four-direction sweep; hold each direction longer than 33 ticks and the
  presentation interval; assert bounded current wire directions/counts and
  visually inspect that no old quadrant returns.
- Performance guard: retained array and GPU resource identities remain stable;
  index upload is bounded by the resource's activated high water and vertex
  upload remains bounded by current quads.
- Complete exact-tree Mac `./scripts/validate.sh`, production build/bundle gate,
  empty browser page/console/failed-response/wire-error arrays, then rebase and
  repeat if `origin/main` changes before publication.

### Implementation validation receipt

- `NativeWaterMeshRuns` now retains `activatedQuadHighWater` for the lifetime
  of each concrete index-buffer resource. Any growth, shrink, empty retirement,
  or reactivation uploads indices through that greatest activated range, while
  the current vertex upload remains bounded to active quads. Power-of-two
  replacement still creates a fresh zeroed resource and resets the high water.
- The focused Mac regression first failed on untouched current main with
  `24 !== 120`: after a five-quad Frost/Hail/Aura run retired while hidden, its
  one-quad reactivation replaced the pending 120-byte clear with a 24-byte
  update. The implementation passes `7/7`; the reactivation update remains 120
  bytes, the retired tail is zero, and the retained typed-array identity is
  unchanged.
- The maintained Water browser journey now has an explicit
  `SDR_PRIMARY_FROST_REACTIVATION=1` branch and follows the current tutorial
  prompt-stage owner. Exact Mac Chrome job
  `job_20260903T134255Z_950697ce96` cast up-left, reached zero primary actors,
  zero Water mesh actors, and zero runs, then cast down-right with 62 current
  Frost actors, 46 mesh actors, and 10 runs. The combined page, console, and
  HTTP-response error array was empty. Visual inspection found no up-left spray
  in the reactivated down-right frame. Disposable held/reactivated image
  SHA-256 values were
  `149b09f170cad87ea7941ecc470f10a3d22dfef28b34e6979c21a60506952b6e`
  and
  `52c8d23a8049911fde8091323f9bf06510ae5d8637b61ff78527338c60d74ceb`.
- Initial exact-tree Mac gate `job_20260903T134438Z_4565074b6a` passed the
  zero-warning/error backend Release build, all 19 Website/backend contracts,
  formatting, lint/import/generated checks, the complete frontend and desktop
  test matrix including the 1,813-case broad group and focused 7-case Water
  mesh group, production frontend/game-host builds, media policy, and bundle
  budget. `Game-iCeVVE1l.js` measured 262,676 raw / 79,196 gzip bytes against
  524,288 / 134,144 limits. This receipt is the sole post-gate write; no
  runtime, test, build, or browser source changed after that gate.

## 2026-09-04 — retained spell plans and authoritative painter-registry selection

Final base: `fe0543982bdc077c827cd438393e934d5d118784`. The patch preserves the
intervening coffin-debris, media-control, Magic Shield, and painter/collision
fixes. The concurrent collision optimization and its tests duplicate work from
this investigation; the final diff keeps the upstream implementation and
removes those duplicate edits. Eight production files and four tests remain.

### Causal model and boundary

A Mac CPU profile of the existing Arena-0 replay showed full population scans
reconstructing standalone painter registries even when an authoritative
registry was already supplied. Those reconstructed registries were discarded.
The client profile separately showed Frost replaying its float32 motion and
animation plan repeatedly during painter/diagnostic queries after computing
the same plan for drawing. Sibling Fire and Ether views repeated that pattern.

The boundary is derived work within the existing native presentation and
registration owners. The pure native plan functions and their authored data
remain the oracle. No actor membership, ticks, RNG, geometry, asset, audio,
resolution, lighting, painter order, protocol, or save shape changes.

| Member | Disposition | Result |
| --- | --- | --- |
| Active Boneyard enemies | verified-already-at-parity | Reconstruct standalone registration only when authority is absent. |
| Paused Boneyard enemies | verified-already-at-parity | Same rule; projectile registration shares the selected order unless explicitly supplied. |
| Primary spells | verified-already-at-parity | Skip discarded projectile/transient registration scans. |
| Secondary abilities | verified-already-at-parity | Skip discarded registration scans before enrollment. |
| Air/Water player effects | verified-already-at-parity | Construct standalone order only for standalone callers. |
| Standalone consumers | verified-already-at-parity | Preserve reconstruction, allocation order, and lifecycle. |
| Normal/over/underpowered Frost sprite views | verified-already-at-parity | Painter queries read the exact plan retained by the mandatory update. |
| Fireball, Fire particle, Fire impact | verified-already-at-parity | Retain each drawn plan for painter metadata. |
| Ether impact and piercing streak | verified-already-at-parity | Retain each drawn plan for painter metadata. |
| Boneyard normal Frost mesh, Aura, Air, Earth, welded views, other Fire/Ether views | verified-already-at-parity | Already retain plans or derive painter metadata directly from current containers/state. |
| Retained Boneyard Hail | verified-already-at-parity | Reindex only when the immutable newer frame table changes; keep interpolation, birth, expiry, and same-tick replacement behavior. |

Caches belong to the existing view/timeline lifetime. Hail retains at most one
indexed newer table; no global actor-ID cache or compatibility API is added.

### Measurements

The final incremental server comparison uses Node 22.17.0, the existing replay
inputs, and baseline/candidate simulation graphs in one process. Alternating
500-tick blocks reduce scheduling differences. After 2,000 warm-up ticks, the
remaining 28,000 ticks cost **0.194197 / 0.188135 ms per tick**, or **3.12% less
time beyond the already optimized main**. State and ordered-JSON hashes match
at every 5,000-tick checkpoint. Final hashes are `88197cea5375414b` and
`bfbf09c9974bccdb:880210`.

The earlier client comparison used production bundles on base `132774b6`,
before the concurrent painter changes. Both browsers used the same baseline
host. Chrome 152.0.7977.76 used Apple M2 Metal at 1600x900. Two baseline runs,
three candidate runs, then restoration of the original bundle supplied three
samples per build. Eight-second Water samples followed gate crossing and
Solomon combat admission, max ranks for skills 32..39/57/59, a 1,000-actor
warm-up, and mana restoration every 500 ms through the existing Lua API.

| Median | Baseline | Candidate |
| --- | ---: | ---: |
| Hub FPS | 394.45 | 394.83 |
| Empty Boneyard FPS | 388.83 | 391.76 |
| Sustained Water FPS | 152.79 | 178.90 |
| Water frame p95 | 10.2 ms | 9.0 ms |
| Water frame p99 | 15.4 ms | 16.4 ms |
| Water mean actor count | 1,410.30 | 1,408.88 |

The restored baseline returned to 151.18 FPS. Individual Water runs ranged
151.18..166.72 FPS for baseline and 133.88..183.80 for candidate. This is a
17.1% median improvement in that earlier experiment, not a uniform client,
frame-tail, or incremental FPS claim against `fe054398`. No physical iPhone
measurement or production-server load claim is made.

### Final validation and quality limits

The exact final Mac tree passes `/opt/homebrew/bin/bash ./scripts/validate.sh`:
19 Website/backend contracts, 2,667 frontend/desktop test executions,
formatting, lint/import/generated checks, TypeScript, production builds,
bundle budget, and media policy. The entry is 262,311 raw / 79,058 gzip bytes.

Final hardware-browser journeys on the candidate client and host observe
Water/Aura/Hail (peak 1,481 actors), Fireball/particles/impacts (68), and
Ether/impacts (four). Each advances over 798 server ticks and renders 477..478
frames in eight seconds with normal vsync. Page-error, console-error, and
failed-response arrays are empty. Direct sprite tests cover all six changed
views, including the Ether piercing streak; Hail tests cover repeated samples,
reordered tables, removal, and replacement at the same tick.

Earlier `smoke-primary-spells.mjs` short-tap/audio attempts were inconclusive:
the Hub cast was not observed and the Boneyard Fire audio receipt timed out.
They are not passing short-tap/audio evidence. The settled held-cast journeys
establish the changed rendering behavior; input/audio code is not altered to
accommodate those harness failures.

The stricter requested quality gates are **not all satisfied**:

- Oxlint maximum complexity 21 reports the same 17 existing server/kernel
  violations on final baseline and candidate. `stepPrimarySpells` remains 226
  and `synchronizeAirWaterPlayerVisualActors` remains 39. No new violation or
  suppression is introduced; changed client modules pass this check.
- Three pre-existing kernel/enemy-store files remain above 1,000 source lines;
  this patch changes only registry selection there.
- Focused Node whole-file line/branch/function coverage is 97.52/85.11/100 for
  retained Hail, 100/93.33/91.67 for Water view, 52.62/80/78.26 for Fire view,
  and 76/86.67/82.61 for Ether view. The latter files contain unchanged classes.
  These figures do not establish 100% coverage of the scope.
- Cognitive complexity, Halstead, CRAP, mutation, and whole-project dead-code/
  duplication analyzers are not configured. Separate statement coverage is
  not reported by Node. These gates remain unmeasured; no dependencies,
  exclusions, or artificial tests were added to manufacture a pass.
- Normal lint/type checks pass. Manual diff review finds no new `any`/`unknown`,
  compatibility path, unused helper, or duplicate implementation. No UI copy
  changes.

Cleanup verified all task Mac worktrees and temporary directories absent and
ports 5537/5538 closed. The twelve changed code/test files matched between
local and Mac at manifest SHA-256
`04c9453e7f800025e415a9a660b66a4ebb6fd95809bc505b6ebdce28ce3ceda8`.
Only this documentation was written after the final validation.
