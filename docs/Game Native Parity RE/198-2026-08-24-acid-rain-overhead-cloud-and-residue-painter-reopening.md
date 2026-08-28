# 2026-08-24 — Acid Rain overhead cloud and residue painter reopening

## Reported smell and parity question

- Reported web behavior: the Acid Rain cloud is missing part of its VFX.
- This reopens the right-click Acid Rain field despite the earlier secondary-
  ability ledger calling it `exact-ported`. That pass traced the individual
  BadGuys-10 glyph calls in `0x005EB290` but skipped the render-global
  translation surrounding the whole function, then put slot `+0x24` cloud art
  and slot `+0x28` residue art into one web world-sorted container. The passing
  plan test asserted that false coordinate/lane model.
- Stock behavior to recover: one aimed ground root owns a separately queued
  two-glyph cloud 175 units overhead, rain children spanning that height, a
  direct pre-world ground residue, light/audio providers, active/fade clocks,
  Enhanced Effects density, and deterministic teardown.
- Falsifiers: if raw instructions do not shift renderer Y by exactly `-175`
  around both slot-`+0x24` glyphs, the missing layer has another owner; if slot
  `+0x28` shares the world queue, the residue does not require a physical-lane
  split; if the current snapshot omits drop/splash children, coordinate repair
  alone is insufficient.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Identity matches the canonical analyzed 0.72.5 image. No stale PID, runtime address, or injected-loader observation is used. | high |
| Raw instructions | read-only canonical Ghidra replica through `Invoke-GhidraHeadless.ps1`; `0x005EB290`, especially `0x005EB2A3..0x005EB2C9` and `0x005EB580..0x005EB5AB`; constants `0x007DE840=0.0` and `0x00786C10=175.0` as doubles | The painter adds zero to renderer X and subtracts 175 from renderer Y before both BadGuys-10 cloud glyphs, then restores both globals. The prior web model omitted this enclosing transform. | high |
| Instructions and queue ownership | `AcidRain +0x0C -> 0x005E3600`; `PuppetPointer 0x0064E910`; delegate `0x0063ED70`; sorted insert `0x0068C0F0`; Arena auxiliary calls around `0x0046F8F9` and shared queue flush `0x0046FDAF`; tick tail `0x00605461..0x006054B3` | Positive cloud alpha creates a proxy at actor root with proxy Y `rootY+350`; its draw delegates to Acid slot `+0x24`. Sorted insertion compares object `+0x1C`. Slot `+0x28 -> 0x005EB1D0` is a direct pre-flush ground pass, not part of that proxy. The tick tail scales the shared rainfall maximum and provider enrollment from cloud alpha `+0x144`, not residue alpha `+0x158`. | high |
| Combat-query instructions | `0x006052A1..0x006052D6`; float `0x00787110=400.0`; Region wrapper `0x00642280`; double `0x007DE808=0.5`; spatial query `0x00523140` | The pulse supplies width 400 at the aimed ground root with hostile mask 2. The wrapper halves that width; the spatial query accepts strict root-center `dx^2+dy^2 < 200^2` and does not add body radius. Type `0xBB9` Coffin is excluded. | high |
| Full class/membership sweep | `AcidRain::vftable 0x0079CF9C`; `Anim_AcidRaindrop::vftable 0x0079DCA0`; constructor/tick/draw `0x005E3540/0x00604E90/0x004541A0/0x00459130`; all four vtable xrefs; sibling `RainOfBones::vftable 0x0079D06C` | Acid Rain has no additional vtable installer or hidden authored row. `RainOfBones` calls the Acid constructor only as a base initializer, then replaces type, tick, render registration, painter, and light callbacks. | high |
| Asset/data | BadGuys records `0` and `10`; compiled floats in `0x005EB1D0/0x005EB290`; existing exact extracted atlas records | Both cloud glyphs and the ground residue use record 10 with separate tint/blend/alpha programs. Drop head/ground use record 0. No browser-generated substitute is required. | high |
| Current web causal trace | clean `origin/main` `4021fce5bfe65e8d3201b7d33db148a6cf60f56b`; `native-secondary-abilities.ts`, `native-secondary-presentation.ts`, `native-secondary-world-view.ts`, `boneyard-world-renderer.ts`, focused presentation tests | Host state and protocol retain parent/drop/splash members. The presenter places the first parent glyph at local Y `0`, the second at `-50*s`, and residue at `0`; one `NativeSecondaryActorView` gives all three one world-sorted depth. | high |
| Pre-fix web combat trace | `native-secondary-abilities.ts` `candidates(actor,400)`; `game-simulation.ts`; `boneyardNativeSecondaryTargets` | The host treated 400 as a radius and admitted root distance `<=400+bodyRadius`, producing an over-wide, body-expanded footprint instead of the native strict radius-200 root query. | high |

## System boundary and membership inventory

Native system: **Acid Rain field presentation and lifecycle** — the accepted
skill-72 cast through host actor state, every parent/child draw callback,
physical painter lane, Region light/audio contribution, replication, and final
teardown in Tutorial and ordinary Boneyard scenes. Inventory dispositions name
the required closed state; the implementation receipt remains open until the
exact candidate passes Mac validation and browser acceptance.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| accepted cast and aimed ground root | dispatcher `0x0054CC50`; `AcidRain 0x005E3540` | verified-already-at-parity | existing cast/aim/mana/cooldown tests |
| parent scale, cloud alpha, residue alpha, age, damage delay, and active/fade clocks | `0x00604E90`, fields `+0x13C..+0x158` | verified-already-at-parity | existing lifecycle and pulse tests plus final browser ages |
| overhead additive cloud glyph | slot `+0x24 -> 0x005EB290`, renderer Y `-175` | exact-ported | plan asserts local `(0,-175)`, tint/blend/alpha/rotation/scale, and world lane |
| overhead source-over cloud glyph | same slot/function; additional local `-50*s` | exact-ported | plan asserts local `(0,-175-50*s)` and complete scalar program |
| cloud proxy queue key and culling ownership | `0x005E3600 -> 0x0064E910`; proxy Y `rootY+350`; `0x0068C0F0` | exact-ported | separate world-sorted cloud root reports `worldY=rootY+350`, bias zero; it is not shared with residue |
| ground residue glyph | slot `+0x28 -> 0x005EB1D0` | exact-ported | separate pre-world layer at actor root; exact tint, alpha, scale, and source-over blend |
| ordinary and Enhanced Effects density | two/five `Anim_AcidRaindrop` births per tick in `0x00604E90` | verified-already-at-parity | existing child-count/RNG tests and both-setting browser checks |
| falling procedural streak and quarter-alpha head | `Anim_AcidRaindrop +0x20 -> 0x00459130` | verified-already-at-parity | width-three green/cyan gradient and BadGuys-0 head contract |
| drop ground sprite and retirement | `0x004541A0/0x00459130` | verified-already-at-parity | scale `0.1*1.1^n`, `1-s^2` alpha, retirement boundary |
| one-in-four splash and five-draw RNG suffix | `0x00604E90`; generic fade/move perspective child | verified-already-at-parity | existing RNG/state/presenter assertions |
| provider light | slot `+0x30 -> 0x005EB5C0`; enrollment at tick tail | exact-ported | radius 2, intensity `0.5*cloudAlpha`, no shadow, no residue-only source; stable actor-manager registration remains until teardown |
| cast, damage-pulse, and ambient audio | `magicstorm`, pitched `acidsizzle`, shared `rainfall__loop` | exact-ported | damage-only sizzle; rain gain equals cloud alpha and stops before residue-only ownership |
| target query, shuffle, direct-damage subset, and authority | `0x006052A1..0x006052D6`; `0x00642280`; `0x00523140`; `0x005E41F0` | exact-ported | strict radius-200 root-center boundary, exact-edge rejection, no body-radius expansion, stable shuffle, and `floor(n/3)+1` damage assertions |
| snapshot decode and peer materialization | protocol secondary actor union; parent/drop/splash rows | verified-already-at-parity | round-trip tests and browser actor-kind/count receipt |
| Tutorial and ordinary Boneyard consumers | shared skill-72 actor family | exact-ported | one renderer path; real Tutorial cast plus ordinary fixture journey |
| interruption, world reset, owner removal, reconnect, and terminal residue retirement | Region/Website world-owner teardown | verified-already-at-parity | existing reset/remove tests plus zero retained views after browser teardown |
| Magic Storm / StormCloud sibling | shared light callback and rain-loop reducer, separate painter `0x005E8970/0x00602C30` | out-of-system (does not consume Acid Rain slot `+0x24/+0x28` or its record-10 program) | stationary/moving Storm tests remain unchanged |
| Rain of Bones subclass | base Acid constructor followed by `RainOfBones 0x005E3780`, tick `0x0061C440`, painter `0x005EBAD0` | out-of-system (replaces Acid type, tick, draw registration, painter, light, and child program) | complete vtable comparison; no Acid painter callback survives |

There are no browser-platform-blocked members and no extractable unknowns.

## Native ownership thread and recovered behavioral contract

- Dispatcher skill 72 creates one host-authoritative AcidRain actor at the
  accepted world aim. Construction consumes the private phase and initializes
  the 1,500-tick active clock; tick owns all gameplay, child births, audio
  renewal, cloud/residue fades, light admission, and retirement.
- The actor position is the ground aim. It is not the cloud position. Slot
  `+0x24` temporarily changes renderer translation by `(0,-175)` for both cloud
  glyphs. The first remains exactly at that translated root; the second adds
  its own `-50*s` local offset.
- Damage also stays at that ground aim. The native query's supplied width 400
  becomes a strict radius-200 circle over actor roots. The overhead cloud proxy
  does not move combat upward, exact distance 200 is outside, and collision
  radii do not extend the attack area.
- Cloud pixels and their painter key are deliberately different. The
  `PuppetPointer` copies the ground root, adds 350 to proxy Y, and delegates
  only slot `+0x24`. The Website needs one world-sorted cloud proxy at
  `worldY=rootY+350` with bias zero; changing sprite Y alone or inventing a
  sort bias does not recover native overflow ordering.
- Slot `+0x28` draws the long-lived dark residue directly at the ground root
  before the world queue flush. It needs a pre-world physical layer, not a fake
  negative/positive sort bias and not a child of the cloud container.
- Cloud alpha ramps and later fades over 100 ticks after activity. Ground
  residue persists and then fades over 2,000 additional ticks; child drops stop
  with active rain. Light intensity and rainfall gain both follow cloud alpha.
  Once cloud alpha reaches zero, the residue-only actor submits no light source
  and retains no rainfall ownership; its stable actor-manager registration
  remains until teardown. `acidsizzle` belongs only to live damage pulses.
- The host retains every random choice and child state. Clients reproduce the
  two physical parent lanes and child primitives without presentation RNG,
  protocol, authority, or audio changes.

## Nearby-system findings

- The `+350` scalar passed to `0x0064E910` is a painter-proxy Y adjustment,
  not a radius-350 light. The only Acid/Storm provider radius remains `2` at
  `0x005EB5C0`.
- `AcidRain +0x14 -> 0x005E3630` is serialization of fields
  `+0x13C..+0x154`; it is not another draw callback. The complete vtable sweep
  found no missing fourth Acid glyph.
- `RainOfBones` sharing the Acid constructor does not make its authored bones,
  tick, or painter part of skill 72. Its vtable replacement is complete before
  live use.
- Durable native correction is mirrored in Mod Loader
  `docs/reverse-engineering/native-projectiles-and-effects.md`.

## Web implementation consequence

- Keep protocol rows, assets, RNG, and audio unchanged.
- Replace Acid Rain's radius-400/body-overlap candidate set with an Acid-owned
  strict root-center radius-200 filter at the aimed ground point. Preserve the
  existing stable candidate order, fixed-bound shuffle, pulse clocks, and
  `floor(n/3)+1` damage subset.
- In `native-secondary-presentation.ts`, separate the Acid parent into two
  overhead cloud draws and one ground-underlay draw. Apply exact local Y values
  `-175` and `-175-50*s`; rename roles so tests cannot repeat the ground/cloud
  inversion.
- In `native-secondary-world-view.ts`, give the Acid underlay its own top-level
  container and physical painter-layer identity. Keep the cloud container in
  `world-sorted` with native proxy world Y `rootY+350` and bias zero.
- In `boneyard-world-renderer.ts`, admit only secondary world layers to the
  dynamic queue and place secondary pre-world layers at the established
  underlay depth. Do not simulate the pass with an extreme Y value.
- Make Acid Rain provider-source admission state-dependent on positive cloud
  alpha, drive intensity and rainfall gain from that field, and leave the later
  residue-only phase unlit and silent. Keep its actor-manager registration and
  StormCloud's alpha path unchanged.
- Remove the old test assertions that place cloud at `0/-50*s` and that treat
  all three parent glyphs as one world-sorted primitive group.

## Validation contract

- Red regression on untouched `4a81a616`: exact plan requires overhead offsets,
  a separate underlay member, and proxy `worldY=rootY+350` with bias zero; the
  old plan must fail those assertions.
- Pure plan/view: assert both cloud glyph programs, residue program, distinct
  physical lanes/depths, primitive counts, cloud-alpha light/provider/audio
  lifetime, protocol shape, teardown, and ordinary/enhanced drop/splash
  membership. Re-run all Storm sibling assertions unchanged.
- Host combat: assert the query requests radius 200 at the aimed ground root;
  roots immediately inside are eligible, exact radius 200 and immediately
  outside are rejected, and a large body radius never extends membership.
- Native Windows Website gate through Git Bash against a manifest-identical
  isolated candidate, plus the focused Acid Rain contract and production build.
- Windows Chrome built-candidate journey: cast Acid Rain in the Tutorial and an
  ordinary Boneyard fixture; capture actor kinds/counts, the two cloud sprite
  local Y values, residue container/lane/depth, cloud queue bias, provider
  light, audio events, page/console/failed-response arrays, and inspected
  frames. Require the cloud centered 175 units above the aim, residue at the
  ground aim beneath the world queue, and no Storm presentation regression.

## Implementation validation receipt

- The attack-area regression ran red on pre-fix Website commit `fef1fff5`:
  the host requested radius `400` instead of `200`. The Acid-owned query now
  asks the existing world adapter for a radius-200 superset, then applies the
  native strict root-distance-squared boundary before shuffle. Exact distance
  200, the overhead proxy, and body overlap beyond the edge are all rejected;
  roots immediately inside and inside-diagonal roots remain eligible. Red-log
  SHA-256 is
  `9e2944a45eb1465100ce1680df3b0063b4ea93eba6dea0981f9ebf75a9df5284`.
- On native Windows, TypeScript plus the five touched Acid/VFX files passed
  `187/187`, including center, just-inside, exact-edge, outside-diagonal,
  body-overlap, and overhead-proxy membership. Focused-log SHA-256 is
  `ce2462a13b426f0aa49d48e2ee67005a1b2d634879f3e6a4638e261381af7283`.
- Built Windows Chrome `151.0.7922.170`/WebGL2 traversed ordinary Boneyard on
  exact publication-candidate product HEAD
  `16dbe01e6c870cf59d2ffba49323f8bc1ad34653`. Skill 72 at ground
  `(1327.1300048828125,1647.1292543764469)` damaged the
  isolated center-root enemy from `2.5` to `2.166666656732559`. The same enemy
  was then moved to exact root distance `200`; its collision radius
  `12.273558896034956` did not extend the boundary, and health remained
  `2.166666656732559` through the next pulse. Cloud offsets `[-225,-175]`,
  proxy Y `1997.1292543764469`, residue depth `0.5`, maximum 174 actors and 221
  primitives, all Acid child kinds, the `magic-storm` cue, and empty page,
  console, and failed-response arrays remained intact. Inspected
  screenshot SHA-256 is
  `01865757413cb7f76319d472b954219d558ab068ae82fe171a2d6a0647c46b9c`;
  receipt-log SHA-256 is
  `67c5481b47d0608509886de4361726690f3923ffab549465f91030b840cb6fa4`.

- The presenter now gives Acid Rain two physical owners. Its world-sorted
  `PuppetPointer` plan keeps the native `rootY+350` queue key and zero bias while
  drawing BadGuys-10 at local Y `-175` and `-175-50*s`. Its separate
  `pre-world-queue` underlay draws the BadGuys-10 ground residue at depth `0.5`.
  The Boneyard renderer excludes that underlay from the dynamic world queue and
  removes the cloud proxy itself once cloud alpha reaches zero.
- The host/view names now distinguish `cloudAlpha` from `residueAlpha`.
  Provider admission, radius-2 light intensity `0.5*cloudAlpha`, and the shared
  rainfall-loop gain all follow positive cloud alpha; the residue-only tail is
  unlit and silent. The existing drop, splash, damage, replication, teardown,
  and stationary/moving Storm contracts remain unchanged.
- The new regression was first run against untouched Website base `4a81a616`.
  It failed on the omitted proxy geometry (`200 !== 550`) and on the former
  residue-driven light (`0.5 !== 0.4`), establishing both defects before the
  implementation was applied.
- On native Windows 11 with Node `22.17.0`, the exact product source at
  `827e4c09f0eaab3293b5013eea7b7fc6ac19ba86` passed the TypeScript contract and
  all five touched focused files: `186/186`. Production build
  `Game-BmiJ7vLt.js` is 461,214 raw bytes and 129,648 gzip bytes, inside both
  budgets. Focused-test log SHA-256 is
  `6b3d4a75ef66155883d3fe073b737aff2584a7f315aa592e98404481a5eaaa8a`;
  build-log SHA-256 is
  `4884df8987dface2e3c986ad21dde6b1bb87e01cc36a04652029481b195aaa49`.
- The exact rebased ordinary-Boneyard journey ran in Windows Chrome
  `151.0.7922.170` with WebGL2. It observed `acid-rain`, `acid-drop`, and
  `acid-splash`; cloud local Y range `[-225,-175]`; proxy world Y
  `2044.7932942708335`; residue depth `0.5` with one primitive; maximum 169
  actors and 216 primitives; the `magic-storm` cue; and empty page, console,
  and failed-response arrays. Inspected screenshot SHA-256 is
  `0ffdd7ba5ffdd219cb30cf8190fa97647bb4de7f958a9f7589479b9fa752b14b`;
  receipt-log SHA-256 is
  `6f0ebb7036fab359f15a3e2c8f73a264c776345c0b882f9ce85c0f7139ba0a06`.
- The exact rebased real Tutorial journey accepted the first-run prompt,
  traversed the live Tutorial owner to stage 5, cast skill 72, and advanced to
  stage 6. Windows Chrome/WebGL2 observed all Acid members plus the authored
  fire patch; cloud alpha `1`; local Y `[-175,-225]`; ground
  `y=1653`; proxy `y=2003`; residue depth `0.5` with one primitive; and empty
  page, console, failed-response, and wire arrays. Inspected
  screenshot SHA-256 is
  `c45363987b5e86e43ce5adf14217a0aefa50cbee18729e7f0fc0d0fae189e1e7`;
  receipt-log SHA-256 is
  `61531a87089d685f50fbbc4550a3929135b53b884eccf562200bbcb6277f43f3`.
- The sibling Mod Loader static RE suite passed `499/499` natively on Windows
  with the strict attack-area catalog and explicit worktree Git provenance;
  log SHA-256 is
  `15316beb88cc7f370628c4c4d9c79a0f4d83d52e5e31dd6dd441802fdb1d8020`.
- An older task-owned validation process and static server were found still
  running after the first Windows gate attempt. After their exact process trees
  were stopped, unchanged `game-host.test.ts` passed `56/56`. The complete
  native Windows Git-Bash `./scripts/validate.sh` gate then passed on final
  publication-candidate product HEAD
  `16dbe01e6c870cf59d2ffba49323f8bc1ad34653`: backend build and integration
  tests, formatting, lint, every frontend group, desktop tests, production
  build, bundle budget, and media policy. Its final `Game-Bom7p45Z.js` is
  461,214 raw bytes and 129,650 gzip bytes; gate-log SHA-256 is
  `199e29b653dd64ddd69ee439807b38ab270efca6da2f68307d91b3123a460fe4`.
- Publication and deployment were not authorized and remain separate.
