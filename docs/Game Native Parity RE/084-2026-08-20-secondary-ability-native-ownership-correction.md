# 2026-08-20 — Secondary-ability native ownership correction

## Supersession boundary and binary evidence

Visual inspection reopened Magic Storm, Raise Golem, Call Leviathan, Ring of
Fire, and Ring of Ice. Fresh static recovery proves that these are not isolated
polish defects: the 2026-08-15 implementation omitted or flattened shared
native ownership for offscreen composites, articulated summon state, Region
feedback, target modifiers, complete-equipment feature bits, and painter
grouping. This section therefore supersedes the blanket `exact-ported` labels
and implementation-closure paragraph above wherever those owners participate.

The authoritative detailed report is Mod Loader
`docs/reverse-engineering/native-secondary-parity-correction-2026-08-20.md`.
It pins retail SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`
and traces dispatcher `0x0054CC50`, StormCloud `0x00602C30/0x00619C60`,
Golem `0x005E91D0/0x00615CD0/0x00617820`, Leviathan
`0x006145D0/0x006151D0`, Ring helper `0x0063F920`, Shockwave
`0x005FF8C0`, common explosion `0x00642BF0`, FreezeWave
`0x00644460/0x005FFDC0`, Frozen `0x00623550/0x006236E0/0x00623730`,
ColdSlow `0x00623050/0x00623080`, and FrostBurn
`0x00623AE0/0x006278B0/0x00627690`.

## Corrected host and renderer contract

- StormCloud is born at the accepted world aim and never follows the caster.
  Three BadGuys-78 passes render into one 256-by-256 target, then one composite
  enters the world at scale five with its visible root 175 units above the
  actor point. Its unshifted light is radius two, intensity `.5*alpha`, and
  non-shadow-casting. Tempest doubles the base 1,000 active ticks before the
  Magic Tornado duration bonus.
- Golem feet, foot paths, interpolation, bob, limb modes, attack heading,
  provoke offsets, and rotations are authoritative state. The renderer builds
  and effective-Y sorts the native 12-record assembly; it must not infer a
  chassis around one hard-coded point. Assembly impacts remain ages
  `0/50/100/200`, contact begins at 400, and attack impact remains tick 37.
  Fete of Clay owns the two-Golem cap; Iron Golem 75 only owns cost,
  reflection, and iron state.
- Leviathan's parent and appendages render into one shared 256-by-256 target
  and have one painter owner. Its radius-300, half-angle-25 query,
  socket-derived muzzle, straight EtherBolt, and Bug-Master damage remain host
  authority. Appendages must not interleave separately with enemies.
- Ring of Fire writes Region camera magnitude `.25` in addition to its flash,
  30 MovingFire children, Shockwave, audio, and light. Region magnitude decays
  by `*.94` and clears below `.001`. Burning Man arms a first-contact explosion
  at every Shockwave target: scale `1.5` makes the common explosion query
  radius 165 and every eligible actor receives another half-wave payload,
  together with the common layered burst and three fire fragments.
- Ring of Ice and Call Comet share FreezeWave target ownership. Ordinary
  enemies receive Frozen: time factor stays zero until the final 200 ticks,
  then adds float32 `.005` per update. Frozen material blends halfway toward
  `(0.15,0.5,1,1)` and ColdSlow halfway toward `(0.5,1,1,1)` at the target's
  existing painter root, multiplied with Region lighting. Frostburn Jewels
  additionally applies FrostBurn for `freezeTicks*100`; it deals `.01` damage
  per tick and owns a target-following alternating BadGuys-10/11 additive
  flare program.
- Region camera feedback is an explicit replicated event lane. Ring of Fire
  emits `.25`; Magic Trap and Magic Shield explosions emit `1.25`.
  Earthquake's displacement vector remains a separate actor-owned lane.
- Hub and Boneyard must consume the same presentation `worldY` and `sortBias`.
  Status material composes with the existing light tint at one enemy painter
  root. Storm and Leviathan each own one composite slot; Golem sorts its
  articulation internally.

## Complete-set authority

| Set | Exact recipe membership | Feature | Required outcome |
| --- | --- | ---: | --- |
| Pandimensional Bug Master | `11..15` | `0x1` | Maximum Leviathan appendages plus the set's separate double-damage modifier. |
| Tempest | `16..19` | `0x2` | Double Storm base active lifetime. |
| Burning Man | `20,21` | `0x4` | Arm per-contact Ring explosions and half-damage radius-165 splash. |
| Frostburn Jewels | `22..24` | `0x10` | Add target-owned FrostBurn to FreezeWave contact. |
| Fete of Clay | `25..28` | `0x8` | Permit two Golems and evict the lower-HP summon. |

Enhanced Effects is a graphics setting and is never a replacement for one of
these predicates. A partial set never enables its feature.

## Reopened membership ledger

| Member | Required correction or revalidation |
| --- | --- |
| `11` Call Leviathan | One shared compositor/painter owner; maximum set, range, lane, muzzle, bolt damage, and retirement proof. |
| `12` Planewalker | Revalidate common scene depth without changing its intentional caster/Plane-Orb ownership. |
| `15` Phasing | Revalidate traversal streak depth and successful-only lifecycle. |
| `21` Ring of Fire | Add Region camera feedback and Burning-Man contact explosions/damage. |
| `23` Firewalker | Revalidate patch ordering and preserve target-owned Burn light. |
| `27` Magic Storm | Fix immutable world anchoring/composite placement and Tempest lifetime; reprove damage/range. |
| `30` Prismatic Shock | Preserve intentional caster-following owner while shared depth changes. |
| `35` Ring of Ice | Add Frozen/ColdSlow material, exact thaw, FrostBurn damage/VFX, lighting, and Z proof. |
| `41` Earthquake | Preserve its distinct Region displacement-vector owner. |
| `45` Raise Golem | Replace inferred body with authoritative feet/gait/limbs/assembly and Fete-of-Clay cap; reprove attack. |
| `46` Stoneskin | Revalidate material composition through the shared light path. |
| `48` Teleport | Revalidate source/destination burst depth. |
| `49` Magic Circle | Revalidate world/light/pulse ownership. |
| `50` Magic Trap | Publish explicit `1.25` Region camera event at detonation. |
| `51` Dampen | Revalidate its independently sorted children. |
| `54` Magic Shield | Publish explicit `1.25` Region camera event at explosion. |
| `72` Acid Rain | Revalidate field/child depth, damage, light, and loops. |
| `73` Fire Wall | Revalidate eleven independent patch slots and Burn contact. |
| `74` Ether Drain | Revalidate parent field/light and target/loot pressure. |
| `76` Call Comet | Route impact FreezeWave through corrected target modifiers/material/VFX. |
| `77` Turn Undead | Revalidate target family effect and 35-child order. |
| `78` Mindstar | Revalidate Region-only feedback and toggle authority. |
| `79` Regenerate | Revalidate Region-only feedback and toggle authority. |

## Website implementation and local proof

Protocol 30 now carries explicit camera magnitude, Frozen/ColdSlow/FrostBurn
target clocks and source ownership, and the complete Golem articulation. The
host evaluates all five exact equipment sets independently. Tempest doubles
Storm's base lifetime; Burning Man creates contact explosions, radius-165
half-damage splashes, and three Ember fragments; Frostburn Jewels applies the
target modifier through both Ring of Ice and Call Comet; Fete of Clay owns the
two-Golem cap independently of Iron Golem.

Storm and Leviathan now use actual transparent 256-by-256 RenderTextures. The
reported opaque/attached-looking Storm was traced to both offscreen owners
passing the CSS string `rgba(255,255,255,0)` as Pixi's clear color; the active
WebGL backend cleared it as opaque white. Both owners now use the explicit
RGBA tuple `[0,0,0,0]`. Storm's composite remains at its host-published world
point and native `y=-175`, scale-five offset. Leviathan reparents the parent
and appendages into one clipped target, submits one painter owner, and preserves
one equal depth for all six maximum-set members in each frame.

Golem publishes and interpolates both current feet, previous/next paths,
progress, bob, foot rotations, connector offsets, limb modes, action heading,
and gait tick. Its renderer centers the assembly from the two visible feet,
sorts the 12 native records internally, and consumes foot collision resolution
in Hub and Boneyard. Enemy rendering multiplies Frozen/ColdSlow material with
the existing Region-light tint at the enemy root. FrostBurn emits the exact
target-position record-10/11 additive color `(0.25,0.5,0.5)` program and
applies `.01` authoritative damage per tick.

The local canonical gate passed: 24 backend contracts, 136 focused secondary
tests, all 962 broad frontend/game tests, five level-up tests, six diagnostics
tests, 14 Hub UI tests, five desktop tests, strict lint/boundary checks,
backend build/formatting, production TypeScript/Vite/game-host build, and media
policy. The closed 23-member Hub WebGL journey passed without page, console,
asset, protocol, or WebGL errors. Focused Boneyard receipts additionally proved:

| Ability | Browser/host receipt |
| --- | --- |
| Leviathan | Five appendages plus parent shared one transparent target/depth; EtherBolt contact reduced a 2.5-HP enemy to zero; max-set parent damage `12`. |
| Ring of Fire | `moving-fire`, `shockwave`, `ring-fire-explosion`, and `ring-fire-fragment` all rendered; camera event `.25`; contact killed the 2.5-HP target. |
| Magic Storm | Cloud point remained separate from the player, Tempest stored 2,000 active ticks, localized cloud/rain rendered, and lightning reduced 2.5 HP below zero. |
| Ring of Ice | Enhanced ring rendered 204 primitives; live target state retained `frozenTicks=988` and `frostBurnTicks=99,988`; 12 observed FrostBurn ticks reduced HP from 2.5 to 2.38 and emitted target flares. |
| Raise Golem | Two Fete-of-Clay summons traversed primitive-count stages through `6/15/19/20`, completed assembly, attacked, and reduced 2.5 HP below zero. |
| Call Comet | Four-second fall/whistle/impact ran, dealt 50 damage to the 2.5-HP target, and created the maximum shared FreezeWave. |

The arm64 Apple-M2 Mac mini on macOS 26.4.1 then passed the same canonical
gate from an isolated exact implementation checkout. Hardware Chrome used a
`WebGL2RenderingContext` and completed the closed 23-member Hub journey with
23 receipts, 24 screenshots including the belt, and no page or console error.
Its focused Boneyard journey completed all six combat receipts and seven
screenshots. It proved parent damage `12` and five appendages for Leviathan;
the `.25` Ring-of-Fire camera pulse plus contact explosion and fragments;
Tempest's 2,000-tick immutable Storm point 200 world units from the player;
1,000 Frozen and 100,000 FrostBurn ticks; two 20-primitive attacking Golems;
and 50 Call-Comet damage plus the shared FreezeWave.

The first combined hardware run also found an acceptance-fixture boundary:
the Golem's native cooldown plus assembly clock outlived the fixture's
1,000-tick movement hold, allowing the proof target to resume AI movement.
The fixture now holds the selected target for 100,000 ticks; the rerun proved
actual Golem damage. This changes only deterministic browser acceptance, not
enemy or Golem runtime behavior.

## Publication and production closure

The runtime-bearing Website commit `a4cf0299987336a37e58419eaf532f5c7b03e361`
and Mod Loader evidence commit `82a55b2d6bde2bc84a67ffaf145fad75dd43bb48`
reached their respective `main` branches by fast-forward. GitHub's Website
Validate run `32372421945` and Mod Loader Lua/static-contract run
`32372421178` both completed successfully.

The isolated deployment worker independently validated Website `a4cf029`,
built immutable artifact
`cc028104860a10a46c2f829c578ca430fbeecbc3478afd54fd6e5f5cab09b864`,
and deployed it with an atomic rollback release and an integrity-checked SQLite
backup. NFO then reported the exact deployed SHA, both services active with
zero restarts, protocol `solomon-dark/30`, zero sessions/lobbies, `ok` for the
live and backup databases, and no warning-or-higher service journal entry from
the cutover. The public `/game` document SHA-256 matched the validated build.

Production was exercised independently from the Mac mini in hardware Chrome,
not inferred from health checks. Three real clients completed Create and the
shared Hub, entered the same generated mode-2 Boneyard, crossed the gate, and
completed the Solomon greeting, taunt, opening ten-enemy wave, audio, lighting,
and painter journey. The renderer was WebGL2; both clients agreed on run,
geometry, gate membership, Region-light composition, resident census, and
Solomon placement; all six page/console error lanes were empty. The receipt
SHA-256 is
`50475af7297dd775218bfd2c9b278de8de963cb5115a4dcba49f9ba515a2eaba`.

The first production attempt exposed one verifier-only source boundary:
`smoke-game-runtime.mjs` asked the deployed page to import a Vite-only
`/src/game/host/native-generated-boneyards.ts` path. The harness now resolves
that authored bank from its own exact checkout and compares it with observed
production geometry. This follow-up changes the smoke harness and this receipt,
not shipped game behavior.

## 2026-09-02 — Plane-galaxy edge and Leviathan portal reopening

### Reported smell and parity question

- A player supplied `SDB - Planewalker Visual Bug.mp4`. The Website capture
  shows repeated Plane Orb galaxies carrying hard opaque polygon extents while
  they travel away from the caster. The suggested tilesheet feathering is a
  useful description of the visible edge, but not its native owner.
- The same report identifies Call Leviathan's Website portal as a white
  placeholder and notes that Planewalker, Ether Drain, and Leviathan share the
  native universe/galaxy presentation.
- The parity questions are therefore: whether the loose `etherplane.png` bytes
  are wrong; which native painters consume the loose texture and shared galaxy
  record; which vertex colors, blend modes, masks, targets, and output passes
  shape their edges; and whether the current white Leviathan record is art or
  an internal compositor mask.
- This secondary report reopens the earlier blanket `exact-ported` claims. The
  skipped rule was the complete renderer-membership sweep: the old pass kept
  Plane Orb geometry and UVs but dropped its per-vertex colors, recovered
  Leviathan's target ownership without tracing the parent's direct records,
  and promoted the target's multiply mask into visible portal art.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player Website capture | `C:\Users\User\Downloads\SDB - Planewalker Visual Bug.mp4`; 1864x1080 H.264, 180 frames, 6.016 s; SHA-256 `316c996940e6da7a7ac5025d7398381427b512a5d0027e4d4a76cf80f67170a2` | Repeated Plane Orb galaxies retain hard dark polygon extents throughout the six-second cast sequence. | high for the Website symptom |
| Retail identity | unmodified 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Canonical executable for every preferred address below. | high |
| Exact loose asset | retail `images/etherplane.png` and Website `frontend/src/assets/game/boneyard/textures/etherplane.png`; both 128x128 RGBA and SHA-256 `cd9aee555fecde2d4917e1776f6bff927c8957e813659dcf163798a2c9e398fb` | The Website already bundles the byte-identical stock image. Its alpha is intentionally almost opaque, so editing or feathering the PNG would falsify source art. | high |
| Plane Orb instructions | draw `0x005E8720`; special mesh `0x00601910`; loose-texture global `0x00B3BC0C` | Draw uses additive BadGuys record 75. The mesh writes opaque white at its center and every 25-unit inner vertex, literal zero at every 50-unit outer vertex, then submits the exact 7/15-segment triangle set. | high |
| Loose-texture xref census | `0x00B3BC0C` references at `0x0060199E` and `0x005475AF` only | Plane Orb and the separate PlayerWizard Planewalker-material branch are the complete post-load consumers of `etherplane`. | high |
| Shared galaxy-record census | BadGuys inline offsets record 75 `+0x39A4`, record 38 `+0x1D50`, record 39 `+0x1E14`; scalar-access census plus raw instructions | Runtime painters are Plane Orb `0x005E8720`, Leviathan `0x006151D0`, and Ether Drain `0x005EE120`; the remaining offset hits are atlas construction, copy/destruction, inventory teardown, or unwind metadata. | high |
| Leviathan instructions | tick `0x006145D0`; draw `0x006151D0`, especially `0x00615210..0x00615C57`; target `0x00B3BEFC` | Parent draws additive record 75 tinted `(1,.5,1,1)` at rotation `globalTick*3`, scale `(-.8s,.64s)`, then source-over record 38 at scale `s`. Appendages alone enter the transparent 256x256 target. Record 39 is a lower-half multiply mask, followed by a black clear below `128 + logicalHeight(39)*s`; the target is composited source-over at full alpha and again additive at alpha `.5`. | high |
| Ether Drain instructions/current Website | `0x005EE120`; `native-secondary-presentation.ts` | Four record-75 layers and both record-38 shimmer branches already preserve the recovered rotations, scales, offsets, tints, alpha, and blend changes. | high |
| Current Website failure path | base `8ac56e987ae98437b3e4320fc6a59672c017a08b`; `native-secondary-presentation.ts`, `native-secondary-world-view.ts` | Plane Orb emits no vertex-color array, so Pixi uses one uniform mesh color. Leviathan draws visible record 39 twice, omits records 75/38, moves the parent into the appendage target, applies no mask/clear, and composites the target only once. | high |
| Ghidra provenance | canonical project `SolomonDark`, program `SolomonDark.exe`, Ghidra 12.0.3 replica pool; read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b0253061...e9d49`; decompile `899167ca...e97465`; instruction-window `79249e8e...632b40`; float dump `925d7d6f...0b15a`; offset census `b66a0ddd...93738`; xref script `c6844b84...8c4b` | Fresh replica queries reproduced the direct resources, literal vertex colors, transforms, target mask, clear, and output passes without changing Mod Loader. | high |

The player capture is Website behavior, not clean-stock footage. Natural stock
skill acquisition was not used as a substitute for missing instructions. The
material facts are closed by the matching retail image, exact asset bytes,
complete direct-xref/offset census, and raw painter instructions.

### System boundary and membership inventory

Native system: **shared plane-galaxy portal presentation**, from exact loose
and atlas resources through Plane Orb, Leviathan, and Ether Drain painter
programs, including edge colors, offscreen ownership, masks, blend/order,
quality branches, scene submission, observer rendering, and teardown.

| Member / branch | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| exact loose `etherplane.png` load/bytes | world initializer `0x005BBD90`, global `0x00B3BC0C` | `verified-already-at-parity` | stock/Website SHA-256 equality; no edited or derived replacement |
| Plane Orb record-75 core | `0x005E8720`, BadGuys `+0x39A4` | `verified-already-at-parity` | additive white, rotation `presentationTick*1.5`, scale `(-.75s,.6s)` |
| Plane Orb ordinary mesh | `0x00601910`, seven segments | `exact-ported` by this reopening | 15 vertices; center/inner packed `0xffffffff`; seven outer packed `0`; exact UVs and 63 indices |
| Plane Orb Enhanced Effects mesh | same function, 15 segments | `exact-ported` by this reopening | 31 vertices with the same alternating edge contract and 135 indices |
| Planewalker enable/disable, Plane Orb authority, audio, light, flash, particles, damage, and expiry | row 12 plus existing host/audio owners | `verified-already-at-parity` | renderer-only change; no gameplay, RNG, protocol, or lifecycle mutation |
| PlayerWizard Planewalker body material | `0x005468C0`, direct loose-texture xref `0x005475AF` | `out-of-system` — separate PlayerWizard status-material compositor, not a plane portal/field painter | nearby finding retained below; this reopening makes no body-material parity claim |
| Leviathan parent galaxy | `0x00615210..0x00615389`, record 75 | `exact-ported` by this reopening | additive `(1,.5,1,1)`, `tick*3` rotation, `(-.8s,.64s)` scale; no visible record 39 |
| Leviathan parent shimmer | `0x0061538E..0x00615406`, record 38 | `exact-ported` by this reopening | source-over white, uniform scale `s`, after galaxy and before appendage composite |
| Leviathan ordinary/max appendage membership | records `343..357` / `343..372` and existing quantity/set owner | `verified-already-at-parity` | one through five authored appendages and existing internal effective-Y order |
| Leviathan target clear and member ownership | `0x006154E0..0x00615913`, target `0x00B3BEFC` | `exact-ported` by this reopening | transparent 256x256 NPM target; appendages enter it, parent galaxy/shimmer remain direct |
| Leviathan record-39 lower-half mask | `0x00615913..0x006159E1`, BadGuys `+0x1E14` | `exact-ported` by this reopening | multiply-only, centered, scale `s`, clipped from target y 128 downward; never visible white art |
| Leviathan lower overflow clear | `0x006159E1..0x00615A49` | `exact-ported` by this reopening | transparent-black multiply rectangle begins at `128 + record39 logical height*s` and covers the remaining lower target |
| Leviathan target output | `0x00615B76..0x00615C57` | `exact-ported` by this reopening | one source-over full-alpha pass then one additive half-alpha pass at the parent point |
| Leviathan light, flash, roar/PlaneCross, EtherBolt, damage, target lane, lifetime, and teardown | `0x006145D0` plus existing kernel/audio owners | `verified-already-at-parity` | presentation correction does not alter authority or clocks |
| Ether Drain four galaxies | `0x005EE120`, record 75 | `verified-already-at-parity` | exact purple near layer and three white farther layers with native rotation/scale/offset/alpha |
| Ether Drain shimmer/capture pulse | `0x005EE120`, record 38 | `verified-already-at-parity` | exact tint, deterministic cosmetic scale, capture alpha, and order |
| Boneyard local/observer and generated-arena variants | shared secondary snapshot and `NativeSecondaryWorldView` | `exact-ported` by this reopening | same records, colors, target/mask, and fade for owner and peer; no client-authored gameplay |
| Hub category-2 rejection | existing shared-Hub combat seal | `verified-already-at-parity` | rows 11/12/74 do not create a live Hub portal or field |
| atlas builders, copy/destructors, InventoryScreen teardown, and unwind hits for offsets `+0x39A4/+0x1D50/+0x1E14` | complete scalar-offset census | `out-of-system` — storage/lifetime metadata, not additional painters | no missing scene/VFX consumer remains in the offset set |

There is no `blocked-by-platform` member. WebGL2/Pixi already expose native
vertex colors, NPM textures/targets, repeat sampling, multiply/source-over/
additive blends, masks, and render-to-texture ownership.

### Native ownership thread and recovered behavioral contract

- `PlaneOrb::Draw 0x005E8720` owns the additive galaxy core. Its separate
  `0x00601910` pass binds the loose repeated texture and emits one center,
  opaque inner, and transparent-black outer vertices. Linear interpolation of
  both RGB and alpha creates the native feather; the PNG itself is not
  feathered and must not be modified.
- Leviathan's parent painter owns two direct records before appendage target
  construction. The shared galaxy is record 75, not record 39. Current scale
  `s` is the existing maximum-scale times the 40-tick-in/25-tick-out phase, so
  presentation consumes authoritative actor scale without a new clock.
- Appendages retain one painter owner but are the only members rendered into
  the 256x256 target. The record-39 white oval is used under multiply inside a
  bottom-half scissor to erase target pixels outside the authored mouth. A
  later black multiply rectangle removes lower overflow. Neither operation is
  a visible sprite.
- The appendage target is drawn once source-over and once additive at `.5`.
  Those passes occur after the direct galaxy/shimmer and before later world
  painters. Retirement destroys the task-owned target with the Leviathan view;
  generic actor teardown and observer snapshots remain unchanged.
- Ether Drain is the third record-75 painter and already matches the recovered
  four-layer program. A falsified record-75 assumption therefore changes
  Leviathan but does not justify perturbing Ether Drain's correct branch.

### Nearby-system findings

- The only other post-load consumer of loose `etherplane.png` is the
  PlayerWizard `+0x138 & 0x10` Planewalker material branch in
  `0x005468C0`. It renders the composed wizard into a transparent target,
  multiplies a world-anchored 200x200 repeated ether-plane quad through it,
  adds BadGuys record 15 at `(0,-15)` scale three with purple half alpha, then
  redraws the target twice. Current Website rendering changes the selected
  primary and loop while active but has no equivalent body-material
  compositor. This is durable evidence for the separate PlayerWizard material
  system and is not silently claimed fixed by the portal correction.
- The earlier full-renderer reflection correctly established NPM source and
  native multiply equations, but its primitive-geometry assertion did not
  verify that `NativeSecondaryMeshDraw` carried the native vertex colors. A
  geometry-only mesh contract is insufficient for fixed-function parity.

### Confidence and open questions

- Confirmed high: exact asset bytes; complete loose-texture xrefs; all three
  record-75 runtime painters; Plane Orb 7/15 geometry, UVs, indices, and packed
  colors; Leviathan direct records, target membership, record-39 role, scissor,
  clear, double output; Ether Drain unchanged branch; current Website causes.
- Inferred: none material to the portal implementation.
- Unknown inside the declared plane-galaxy portal boundary: none.

### Web implementation consequence

- Preserve the stock PNG. Extend `NativeSecondaryMeshDraw` with exact packed
  vertex colors and install/update them through the existing native fixed-
  function mesh pipeline.
- Replace Leviathan's visible record-39 placeholder with the recovered direct
  record-75/38 parent plan. Keep parent art outside the appendage target.
- Make the appendage target apply its bottom-half record-39 multiply mask and
  lower clear, then expose two output sprites in native source-over/additive
  order. Remove the obsolete visible-record-39 path and one-pass composite.
- Do not change Ether Drain, host state, protocol, RNG, audio, lighting,
  collision, damage, skill acquisition, or the separate PlayerWizard material
  compositor.

### Validation contract

- Focused pure tests: ordinary/enhanced Plane Orb vertex-color arrays; exact
  galaxy/core geometry retained; Leviathan direct records/tints/rotations/
  scales; mask/scissor/clear geometry; full-alpha normal plus half-alpha
  additive target outputs; Ether Drain's four record-75 and two record-38
  branches unchanged.
- Renderer/browser test: naturally cast Planewalker and Call Leviathan in a
  real built Boneyard. Capture per-primitive diagnostics and pixels proving
  transparent Plane Orb outer vertices, absence of visible Leviathan record
  39, presence of record 75/38, one clipped appendage target, and both final
  target passes. Exercise ordinary and Enhanced Effects Plane Orb plus maximum
  five-appendage Leviathan.
- Multiplayer/lifecycle: owner and observer must report identical semantic
  actors and portal membership; expiry/world replacement must remove meshes,
  targets, masks, and output sprites without replaying audio or changing
  authoritative damage.
- Require empty page, console, failed-response, WebGL, protocol, and host-error
  lanes, then run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  byte-identical Mac candidate.

### Implementation validation receipt

- Implementation: `NativeSecondaryMeshDraw` now carries the native packed
  vertex-color stream. Plane Orb emits center/inner `0xffffffff` and outer
  `0x00000000` for both seven- and fifteen-segment variants, and the existing
  fixed-function mesh batcher installs and updates those colors. The exact
  stock PNG and UV/index/geometry paths are unchanged.
- Leviathan presentation now draws direct BadGuys 75 additive purple galaxy
  and BadGuys 38 source-over shimmer layers. Its appendage-only NPM target owns
  the lower-half record-39 multiply mask, the transparent-black lower clear,
  and distinct full source-over plus half-alpha additive output sprites. The
  former visible record-39 pair and one-pass target path are removed.
- Renderer diagnostics now expose mesh vertex colors and the applied
  Leviathan compositor plan. The three-skill smoke asserts the exact shared
  membership. Its Planewalker active-label predicate now requires the existing
  `, active` token without incorrectly requiring it to follow the later
  `, insufficient mana` accessibility suffix.
- Red receipt: on detached Mac base `8efce567d5fb88506580a78bdd181b1407c0e8fb`,
  the test-only candidate failed because
  `nativeLeviathanCompositePlan` did not exist. That established the absent
  compositor contract before implementation. The first implementation run
  then failed only a literal JavaScript `-0.6` versus computed
  `-0.6000000000000001` test expectation; the contract now asserts the actual
  recovered `-.8*s` formula.
- Current-base integration: `origin/main` advanced twice during the work. The
  focused six-file patch fast-forwarded cleanly first to `8efce567` and then to
  final base `f03d1d3a2cb9b5643476b32fa807f0c426822566`. All six files were
  SHA-256-identical between the local worktree and detached Mac worktree
  `/Users/jarrett/codex-acceptance/universe-effects-20260902-green/Website`
  before final validation.
- Focused Mac contracts: the presentation file passed all `41/41` tests,
  including ordinary/enhanced vertex colors, Leviathan records/transforms,
  mask/clear/output passes, and unchanged Ether Drain layers. The complete
  `tsconfig.test.json` no-emit check and supported lint gate passed; lint
  retained eleven pre-existing repository warnings and reported zero errors.
- Planewalker Mac Chrome/WebGL2 receipt: exit zero on the final base, Enhanced
  Effects produced 15 mesh segments, 16 opaque center/inner vertices, and 15
  transparent-black outer vertices; record 75, Plane Orb particles, cast
  flash/audio, cooldown, and 21 observed ticks remained live. Page, console,
  and response error arrays were empty. Log SHA-256 is
  `42dca0f7abf1bf5785bf688487b2d4292d39fdaa70dbeebc971f1ce20e430661`;
  inspected capture SHA-256 is
  `4670bacc892d5b067580f79d743b71d33bf67cded85702a2ea8bfc25497f4096`.
- Leviathan Mac Chrome/WebGL2 receipt: exit zero on the final base, parent
  diagnostics contained only `BadGuys:75:add` and `BadGuys:38:normal`, no
  visible record 39, one hidden multiply mask/clear plan, both output passes,
  and all five maximum-set appendages at one composite depth per frame. The
  live summon damaged the proof enemy, emitted its recovered audio/flash, and
  reached 64 maximum reported primitives over 84 observed ticks. All browser
  error arrays were empty. Log SHA-256 is
  `81a401918f8aeee29b9c25b4d3a39130aa5b244c4d64f9b61c1636bf4142d153`;
  inspected capture SHA-256 is
  `beaa67bbd2ebf831a565119ab7481a3c748ebe2c495fb22fe8c4dabbf028a035`.
- Ether Drain Mac Chrome/WebGL2 receipt: exit zero on the final base, the
  parent retained four additive record-75 layers and source-over record 38,
  along with the existing distort/lightning cues, flash, cooldown, and 17
  observed ticks. All browser error arrays were empty. Log SHA-256 is
  `443c3396f357da23d4e2b1091c5747ac3ffed37581334fd8be1edd81cdd2dade`;
  inspected capture SHA-256 is
  `b461220758c1ebfb489d1523cd532eed10a9546d94c76745c8de9b44e67bd000`.
- Rejected runs were not promoted: one Vite run used a dependency symlink
  outside its serving allow-list; one generated Boneyard hit an unrelated
  collision-safe spawn exception; and two pre-harness-correction Planewalker
  runs timed out on the overly strict accessibility-label suffix. Final runs
  used task-local pinned dependencies and clean exit-zero receipts.
- Complete Mac gate: macOS `26.6.2` build `25G83`, arm64, Node `22.17.0`, and
  Chrome `152.0.7977.65` passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact product
  candidate: backend Release build and 19 integration contracts; formatting,
  lint, architecture, generated-content checks; every frontend, Tutorial,
  diagnostics, Hall, Hub, and desktop group; production frontend/game-host
  builds; media policy; and game entry `265,203` raw / `80,814` gzip bytes
  within budget.
- Visual inspection shows the Plane Orb texture fading through the recovered
  polygon edge instead of carrying the recorded hard opaque extent, and the
  Leviathan portal now exposes purple galaxy art rather than the white record-
  39 placeholder. No browser-platform approximation was introduced.
- The separate PlayerWizard Planewalker body-material compositor remains the
  explicit `out-of-system` nearby finding above; this receipt makes no claim
  that it was implemented. No other member or unknown remains inside the
  declared plane-galaxy portal boundary. No commit, push, deployment,
  production restart, or live-service claim is made.
