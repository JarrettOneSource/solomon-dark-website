# 2026-08-26 — Acid Rain cloud/drop visual correction after comparison falsifier

> **2026-08-29 layering closure:** [entry 297](<297-2026-08-29-complete-region-world-painter-layering-audit.md>)
> leaves this file's art, transforms, alpha, and child clocks intact, but
> closes the parent cloud proxy family and direct residue/composite order.
>
> **2026-09-02 affine-order reopening:** the section below supersedes this
> file's earlier claim that independent sprite rotation and scale properties
> preserve the recovered cloud transforms. The native Graphics stack applies
> rotation before world-axis scale; Pixi properties apply local-axis scale
> before rotation.

## Reported smell and parity question

- The labeled stock/web comparison visibly contradicts the preceding
  completion claim: stock has a bright, round, filled cloud; web has a darker,
  smaller/elongated composite. Web secondary rain streaks also read upside
  down, with the bright end above the transparent tail.
- This is a secondary report in a supposedly closed system. The prior pass
  stopped after proving parent/child membership, offsets, queue ownership, and
  combat geometry. It did not map every direct atlas destination in
  `0x005EB290/0x005EB1D0/0x00459130`, did not count the blend-transition draw,
  and treated a path-directed line as if Pixi's local gradient followed path
  direction. Its passing tests encoded those false assumptions.
- This section supersedes the claims above that both cloud glyphs and residue
  use BadGuys 10, that falling Acid alpha is one, that the landed record is
  BadGuys 0, and that the comparison falsified the visual defect.
- Falsifiers: `DAT_00819978+0x3BF0` maps to BadGuys 10; the first record is
  drawn only once; `DAT_00819994+0x348` is not DeadHawg 4; `+0x3074` is not
  BadGuys 63; or native places the high-alpha rain stop above the transparent
  stop.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock/web comparison | pinned retail client capture SHA-256 `607a697578d1548181e86c8fce82218804f7e99cfcc4bb00ffa06a80bb9227f7`; exact current web comparison under `/home/user/.codex-artifacts/solomon-dark/acid-rain-comparison-20260826/` | Stock cloud is mottled, round, filled, and much brighter. Web shows small smooth circles/elongation. Stock rain grades transparent at the upper tail into a brighter lower end; web local-fill rendering reverses that visual order. | high, direct pixels |
| Raw cloud instructions | canonical read-only Ghidra replica, `0x005EB290`, especially `0x005EB2A3..0x005EB57B` | Global Y is shifted `-175`. BadGuys destination `+0x3BF0` is drawn once under source-over, renderer byte `+0x221` changes to additive and the same destination is drawn again, then destination `+0xFC` is drawn while additive remains active; source-over is restored at return. | high |
| Cloud operand ownership | `0x005EB290` direct field reads: scale `+0x140`, alpha `+0x144`, age `+0x148`, constructor phase `+0x14C` | Both rotations advance from the Acid actor's fixed-tick age. They do not read the global renderer/presentation frame. Same seed plus same actor age must therefore produce the same cloud transform regardless of browser frame cadence. | high |
| Atlas destination catalog | `native-content-inventory.json` / `native-asset-object-map.json`, BadGuys builder `0x004E1A10`, DeadHawg builder `0x004E8A90` | BadGuys `+0x3BF0` = record 78 (`136x135` mottled cloud); BadGuys `+0xFC` = record 10 (`67x68` circle); BadGuys `+0x3074` = record 63 (`17x14` ground ring); DeadHawg `+0x348` = record 4 (`93x78` residue). | high |
| Raw/decompiled Acid drop painter | `Anim_AcidRaindrop::Draw 0x00459130`; quad helper `0x0041DF10`; constants `0x00785428`, `0x007DE96C`, `0x007DE870`, `0x0078542C`, `0x007DE934`, `0x007DE8E0` | Falling quad is local `x=-1`, `y=height`, width 3, positive height `streakLength`; top RGBA `(.4,.95,.5,0)`, bottom `(.7,.95,.75,.5)`. Quarter-alpha BadGuys 0 stays at the ground root. Landed draw is BadGuys 63. | high |
| Shared secondary-drop sibling | `Anim_Raindrop::Draw 0x00458F90`; raw destination `DAT_00819978+0x3074` | Magic Storm uses width 2, top `(.4,.95,1,0)`, bottom `(.8,.95,1,.5)`, no falling ground marker, then BadGuys 63 after landing. | high |
| Residue instructions | `0x005EB1D0`; constants `0x007849F0=.05`, `0x007845E8=.1`, `0x00785E4C=4.5` | Source-over DeadHawg 4 at the field root, RGB `(.05,.1,.05)`, residual alpha, scale 4.5. | high |
| Current web causal trace | `native-secondary-presentation.ts`, `native-secondary-world-view.ts`, `native-secondary-assets.ts` at `799691a9` plus report harness | Web draws only two cloud primitives, both BadGuys 10, with normal/additive roles reversed; residue is BadGuys 10; Acid/Storm land on BadGuys 0. Its falling line is bottom-to-top, but `FillGradient(textureSpace='local')` applies stop zero to the top of the local bounds, so the high-alpha stop appears above. Acid also uses alpha 1 and blue 1 where native uses bottom alpha .5 and top blue .5. The first corrected comparison then exposed a second omission: web supplied the global presentation frame to both cloud rotations, so identical actor ages rendered different silhouettes when browser cadence changed. | high |

## System boundary and membership inventory

Native system: Acid Rain's complete visual painter and the shared secondary
raindrop primitive, from parent cloud/underlay submission through falling and
landed child rendering. Combat, lifetime, audio, light, replication, and
teardown stay in-bound as regression members even where already correct.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| record-78 source-over cloud | `0x005EB3C8`, BadGuys `+0x3BF0` | exact-ported | first draw is BadGuys 78, normal blend, exact tint/alpha/transform |
| record-78 additive duplicate | renderer `+0x221=1`, `0x005EB3E5` | exact-ported | second identical record-78 draw is additive and independently present |
| record-10 additive cloud | `0x005EB44D..0x005EB53E`, BadGuys `+0xFC` | exact-ported | third draw, additive, random-X-scale branch and `-50*s` offset |
| fixed-tick cloud rotation owner | actor fields `+0x148/+0x14C` in `0x005EB290` | exact-ported | divergent render-frame test retains transforms from `actor.ageTicks` and constructor phase |
| cloud Y shift/proxy/culling | `0x005EB2A3..0x005EB2C9`, `0x005E3600`, `0x0064E910` | verified-already-at-parity | offsets `[-175,-175,-175-50*s]`, queue key `rootY+350` |
| ground residue | `0x005EB1D0`, DeadHawg `+0x348` | exact-ported | DeadHawg 4, separate pre-world lane, exact tint/alpha/scale |
| Acid falling quad | `0x00459130 -> 0x0041DF10` | exact-ported | positive downward rectangle; exact width and top/bottom RGBA |
| Acid falling ground marker | `0x0045922C..0x00459280`, BadGuys `+0x38` | exact-ported | BadGuys 0 remains at ground root, alpha .25 |
| Acid landed ring | `0x00459287..0x004592FD`, BadGuys `+0x3074` | exact-ported | BadGuys 63, exact tint/scale/alpha recurrence |
| Magic Storm falling quad sibling | `0x00458F90 -> 0x0041DF10` | exact-ported | width two, exact blue-white stops, correct vertical order |
| Magic Storm landed ring sibling | `0x0045907C..0x004590F2` | exact-ported | BadGuys 63, no Acid-only ground marker |
| Acid splash | `0x00604E90` child factory / BadGuys 10 | verified-already-at-parity | existing one-in-four RNG/life/motion/additive contract unchanged |
| Arena weather rain | `0x00459B60`, separate particle-batch web owner | verified-already-at-parity, out of secondary-renderer implementation | existing top-transparent/bottom-half-alpha plan and batch tests remain green |
| density, lifecycle, damage, light, audio, protocol, reset | existing Acid/Storm owners | verified-already-at-parity | complete focused and browser receipts unchanged except primitive counts |
| Rain of Bones subclass | `0x005E3780/0x0061C440/0x005EBAD0` | out-of-system; replaces Acid painter/drop program | vtable/painter comparison retained |

## Native ownership thread and recovered contract

- The Acid proxy calls slot `+0x24` under the normal world queue. That painter
  itself owns three ordered sprite submissions and temporarily changes blend;
  the proxy is not one sprite and primitive count two is not native.
- Sprite transforms recovered earlier remain correct. The incorrect asset and
  blend membership, not the scale constants, caused the missing round cloud.
- Native `0x0041DF10` creates four vertices `(x,y)`, `(x+w,y)`,
  `(x,y+h)`, `(x+w,y+h)`: first color on the top pair, second on the bottom.
  Web must express this as a positive-height filled rectangle with explicit
  top/bottom stops. A reversed path plus local fill is not equivalent.
- Falling Acid has two spatial owners: the streak follows `height`, while the
  BadGuys-0 marker stays at the drop's ground root. The landed ring then
  replaces both. Magic Storm shares only the quad and landed-ring rules.

## Web implementation consequence

- Change the Acid plan to ordered `78 normal`, `78 add`, `10 add`; retain the
  recovered transforms and queue key.
- Drive both cloud rotations from replicated `actor.ageTicks`, the web mirror
  of native `+0x148`; presentation/render cadence must not reconstruct this
  authoritative fixed-tick field.
- Change residue to DeadHawg 4; add DeadHawg 4 and BadGuys 63 to the closed
  secondary asset membership.
- Replace the secondary line-gradient abstraction with the native vertical
  rectangle contract and exact stops. Keep Acid's ground marker at zero local
  offset, and use BadGuys 63 for both Acid and Storm landing branches.
- Do not tune tint, scale, blur, or opacity from the screenshot: the exact
  instruction values already explain the output once membership/order is fixed.

## Validation contract

- Focused red/green tests must assert all three cloud primitives in order,
  their assets/blends/transforms, DeadHawg-4 residue, both secondary-drop quad
  geometries/stops, Acid's stationary marker, and both BadGuys-63 landing
  branches. Asset closure must include records 63/78 and DeadHawg 4.
- The cloud test must deliberately pass a presentation frame different from
  `actor.ageTicks` and require both rotations to remain actor-age-derived.
- Re-run all Acid lifecycle/combat/protocol and Magic Storm presentation tests;
  Arena weather tests must remain unchanged.
- On the exact Mac candidate, run the complete canonical gate and real
  Tutorial/ordinary Boneyard Acid journeys. Capture a stock-matched 1600x900
  frame without a phase excuse: require a round, mottled record-78 cloud,
  three cloud primitives, downward streaks with bright lower ends, ground-root
  markers/rings, DeadHawg-4 residue, and empty page/console/network arrays.
- Publication and deployment remain separate and unrequested.

## 2026-09-02 — Acid Rain center-spin affine-order reopening

### Reported smell and parity question

- A player reports that Acid Rain is still not one-to-one: the small rotating
  member in the middle of the cloud moves/deforms differently in the web port.
- This is a fifth visual report in a system previously called complete. The
  preceding passes recovered the correct records, colors, alpha, fixed-tick
  angles, scale operands, queue lanes, sampler, shader, and blend state, but
  stopped at the arguments passed to `Graphics_Rotate` and `Graphics_Scale`.
  They did not recover the shared matrix-composition order. The web adapter
  then assigned those operands to Pixi `rotation` and `scale`, and tests locked
  the operands rather than the resulting affine matrix.
- Stock behavior to recover: all three parent-cloud submissions rotate their
  record first and then scale the rotated result along fixed world X/Y axes.
  For the irregular near-circle record 10, the stretched envelope therefore
  stays axis-aligned while the ink spins within it. The current web path
  instead rotates the stretched envelope, producing the conspicuous diagonal
  sweep at many constructor phases.
- Falsifiers: `0x00402D40` post-multiplies the native current matrix rather
  than pre-multiplying it; Pixi's property transform yields the same four
  coefficients for unequal X/Y scale; Acid calls scale before rotation; or a
  current browser frame already exposes the native coefficients.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player observation | 2026-09-02 report against the current web port | The remaining mismatch is isolated to the rotating cloud center rather than rain density, residue, palette, or cloud ownership. | high as a parity falsifier; appearance must be re-proved in the browser |
| Retail identity | unmodified retail `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same canonical image as every preceding Acid and renderer extraction. No runtime address or injected-loader sample is used. | high |
| Acid painter instructions | canonical Ghidra 12.0.3 replica; `AcidRain::Draw 0x005EB290`, especially calls `0x005EB345 -> 0x00403120`, `0x005EB382 -> 0x004030A0`, `0x005EB469 -> 0x00403120`, and `0x005EB4AE -> 0x004030A0` | Both record-78 submissions share `Rotate(age*.03125*phase)` followed by `Scale(5*s,4*s)`. After a transform reset, record 10 uses `Rotate(-.5*age)` followed by `Scale(7.5*s*phase,6*s)`. | high |
| Rotation helper | decompile/raw instructions `0x00403120..0x004031D4`; constants runtime float pi and `0x007DE888=180.0` | The helper converts degrees with the native screen sign and constructs matrix coefficients `(cos,sin,-sin,cos)` before calling the shared compositor. | high |
| Scale and composition helpers | `0x004030A0`; raw `0x00402D40..0x0040309E`; sprite submitter `0x00414540` | Scale constructs diagonal `(sx,sy)`. `0x00402D40` copies the current matrix, then pre-multiplies the new transform. A rotate call followed by scale therefore reaches the quad as `S*R`: `a=sx*cos`, `b=sy*sin`, `c=-sx*sin`, `d=sy*cos`. | high |
| Complete rotation-xref sweep | task-local read-only Ghidra probe over all 96 references to `0x00403120`; secondary painter callsites include `0x005E8720`, `0x005E8970`, `0x005EB290`, `0x005EE120`, `0x00602C30`, `0x00613E10`, `0x006151D0`, `0x00619CD0`, plus the shared `Anim_*` draw family | Every secondary sprite path that combines rotation with perspective/non-uniform scale reaches the same rotation-then-scale stack. The Acid defect is a shared `NativeSecondarySpriteDraw` adapter defect, not permission for a record-10 exception. Mesh, quad, and gradient paths do not use this adapter. | high |
| Pixi implementation | pinned PixiJS 8.19.0 `Container.updateLocalTransform` / `Transform.matrix`; current `native-secondary-world-view.ts` at Website base `a2b19c2f5ab698fbc28e6e01d3cda94cfe025f1e` | Pixi properties produce `R*S`: `a=sx*cos`, `b=sx*sin`, `c=-sy*sin`, `d=sy*cos`. Current `applyDraw` assigns `sprite.rotation` and `sprite.scale` independently, so its off-diagonal coefficients differ from stock whenever `sx != sy` and `sin(angle) != 0`. | high |
| Existing visual oracle | clean-stock 1600x900 Acid capture SHA-256 `607a697578d1548181e86c8fce82218804f7e99cfcc4bb00ffa06a80bb9227f7`; prior web age-60 captures; exact BadGuys records 78 and 10 | The stock cloud keeps a broad fixed-axis envelope. Prior web captures include the constructor-phase-dependent diagonal center sweep predicted by `R*S`; those captures did not previously assert the final matrix. | high for the stock/web appearance; phase-aligned replacement receipt remains open |
| Tool provenance | read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; decompiler `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`; instruction dumper `273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`; task probe `86e5bc216a53f50963fc03d1f1c3818fc95b002a7e8072928cba96d204e5a714` | Ghidra leased replica 3 read-only. The task probe is disposable and owns no durable native fact outside this ledger. | high |

### System boundary and membership inventory

Native system: **secondary-ability sprite affine submission** — every
`NativeSecondarySpriteDraw` from its recovered painter operands through the
shared Pixi sprite adapter, including nested Storm targets and all lifecycle
transitions that can reuse a sprite binding. The table is exhaustive over
`NATIVE_SECONDARY_ACTOR_KINDS`; target dispositions remain open until the
implementation receipt is filled.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| Acid record-78 source-over cloud | `0x005EB345 -> 0x004030A0 -> 0x005EB3C8` | exact-ported | final `S*R` coefficients at unequal `5*s/4*s` scale |
| Acid record-78 additive duplicate | same captured matrix, `0x005EB3E5` | exact-ported | identical affine coefficients and independent additive draw |
| Acid record-10 additive center | `0x005EB469 -> 0x004030A0 -> 0x005EB53E` | exact-ported | age/phase matrix uses `7.5*s*p/6*s`; fixed envelope and rotating ink |
| Acid residue, drop marker/ring, splash | `0x005EB1D0/0x00459130` and splash child | verified-already-at-parity | zero rotation or uniform scale makes both orders identical; existing asset/blend/lifecycle tests remain green |
| `leviathan`, `leviathan-appendage`, `leviathan-mote` | `0x006151D0` plus appendage/common Anim painters | exact-ported | reflected/perspective galaxy and mote matrices; uniform appendage negative control |
| `plane-orb-shot`, `plane-orb-particle` | `0x005E8720` plus common perspective child | exact-ported | reflected `.75/.6` core and `.8` child matrices; special mesh stays separate |
| `storm-cloud` direct arcs/core/flash and nested static target | `0x005E8970/0x00602C30` | exact-ported | every unequal-axis rotating member uses the shared matrix rule in moving/static/enhanced branches |
| `storm-drop`, `acid-drop` | `0x00458F90/0x00459130` | verified-already-at-parity | gradients are meshes and landed sprites have zero rotation |
| `prismatic-wave`, `freeze-wave-visual` | shared secondary factories and perspective Anim painters | exact-ported | rotating `.8` children/bursts use `S*R`; uniform children remain identical |
| `earthquake`, `earthquake-quake`, `earthquake-dust`, `earthquake-debris` | `0x00613E10` and registered children | exact-ported | parent and quake unequal-axis rotations use `S*R`; uniform dust/debris remain identical |
| `golem`, `golem-death` | `0x005E91D0/0x00615CD0/0x00617820` and complete articulated plans | exact-ported through the same adapter | every sprite plan passes one matrix owner; uniform/scalar members remain algebraically unchanged |
| `magic-circle`, `magic-circle-player-flash` | ring helper/common perspective painter | exact-ported | rotating `.8` ring rows use `S*R`; player flash is the uniform negative control |
| `magic-trap`, `magic-trap-shimmer`, `magic-trap-burst` | `0x00619CD0` and child factories | exact-ported | clockwise/counter-clockwise halos and shimmer use `S*R`; uniform burst members stay identical |
| `dampen-wave`, `dampened-projectile` | `0x00648DF0` and reused projectile plans | exact-ported | `.8` additive arcs/projectile perspective members and uniform children share one adapter |
| `ether-drain`, `ether-drain-cloud`, `ether-drain-debris`, `ether-drain-capture-flare` | `0x005EE120` and children | exact-ported | all four reflected/non-uniform galaxy layers use `S*R`; uniform children stay identical |
| `turn-undead` | `0x00647EF0`, common perspective draw | exact-ported | `.8` record-48 bands use the shared matrix rule without changing the corrected scale domain |
| `leviathan`/`plane-orb-shot` special meshes, secondary rain gradients, Ring Fire fragment quad | direct mesh/quad programs | out-of-system — they do not consume `NativeSecondarySpriteDraw` or Pixi sprite properties | existing vertex/quad contracts remain green |
| `storm-strike` nested Lightning renderer | Air primary child view | out-of-system — separate renderer adapter | existing Storm strike/Lightning matrix remains unchanged |
| `shockwave`, `fire-burn`, `ether-burn`, `freeze-wave`, `ice-blast`, `earthquake-scenery-wobble`, `electric-burn`, `mindblast-shockwave` parent rows | gameplay/light owners whose secondary plan emits no sprite | out-of-system for affine submission | zero secondary sprite primitives remains asserted |
| `ether-bolt`, `ether-fade`, `phase-burst`, `moving-fire`, `fire-patch`, `fire-burn-flame`, `ether-burn-flare`, `frost-burn-flare`, `earthquake-dust`, `teleport-burst`, `flash-response-fade`, `flash-response-grow`, `shield-break`, `shield-explosion`, `mindblast-burst`, `ring-fire-explosion`, `ring-fire-fragment`, `acid-splash`, `comet`, `comet-trail`, `comet-impact`, `comet-debris` | their closed painter programs in entries 083/084/121/123 | verified-already-at-parity where rotation is zero or scale is uniform; exact-ported by the shared adapter wherever a reused perspective member has unequal axes | complete all-kind plan suite plus matrix equivalence/non-equivalence table |
| Tutorial and ordinary/generated Boneyard consumers | shared skill-72 and secondary world view | exact-ported | same host snapshot produces identical affine coefficients in both scenes |
| observer replication, pause, reset, disconnect, kind transition, and renderer teardown | shared secondary actor/view lifecycle | verified-already-at-parity; matrix-binding reuse is regression-covered | no stale skew/scale/rotation survives a later draw or destroyed view |
| movement modifiers `cold-slow`, `circle-slow`, `frozen`, `stun`, `dazzle` | scalar/status subsystem | out-of-system — not secondary sprite actors | existing status presentation remains unchanged |

There is no browser-platform blocker. WebGL/Pixi can represent the exact affine
matrix; the defect is the adapter's composition choice.

### Native ownership thread and recovered behavioral contract

- Acid construction owns `p=Float(1)` at `+0x14C`; tick owns float age
  `+0x148`, field scale `+0x140`, and cloud alpha `+0x144`. The painter reads
  those fields but owns the transform stack and final quad matrix.
- `Graphics_Rotate` builds `R`; the immediately following `Graphics_Scale`
  pre-multiplies `S`, so the submitted native matrix is `S*R`. Translation is
  written after the linear transform and remains the already recovered root
  plus `-175` / `-175-50*s`; it is not rotated or scaled.
- Pixi's property matrix is `R*S`. Equal axes commute, which explains why most
  tests and many secondary frames looked correct. Acid record 10 can have
  `sx=7.5*s*p` near zero while `sy=6*s`, so it amplifies the off-diagonal error
  and rotates an entire thin ellipse instead of rotating ink inside a fixed
  world-axis envelope.
- The same web adapter receives every secondary sprite plan, including nested
  Storm target sprites. The correction therefore belongs in the adapter and
  must not special-case Acid, record 10, one constructor phase, or one scene.
- Assets, shader/saturation, sampler, blend, alpha, queue depth, gameplay,
  light, audio, RNG, protocol, and teardown are unchanged. Mesh/quad/gradient
  programs retain their already explicit vertex transforms.

### Nearby-system findings

- The native rotation helper has 96 total callsites across the executable.
  Other Website sprite adapters do not share `NativeSecondarySpriteDraw` and
  remain outside this implementation boundary; the xref sweep found no hidden
  Acid painter or fourth cloud member. Any future mismatch in those adapters
  must be judged from its own recovered call sequence rather than inheriting a
  blanket Pixi-property assumption.
- The explicit affine matrices already used by specialized Weld overlays show
  that Pixi can carry non-commuting native transforms without a platform
  approximation. They are not reused here because their authored multi-step
  programs and secondary sprites have different owners.

### Confidence and open questions

- Confirmed: retail identity; both Acid call sequences; helper constants and
  multiplication direction; all 96 rotation xrefs; every secondary painter
  that combines rotation and non-uniform scale; Pixi 8.19 property formula;
  current Website violation; complete secondary actor membership.
- Inferred: the player's phrase “little spinny bit” denotes the record-10
  center member. The shared correction also fixes record 78 and sibling
  secondary matrices, so implementation does not depend on that naming.
- Unknown material to implementation: none. A phase-aligned stock/browser
  frame remains a validation receipt, not missing native truth.

### Web implementation consequence

- Add one allocation-free native rotation-then-scale affine helper. It writes
  the exact four linear coefficients plus the existing translation.
- Make `NativeSecondaryActorView.applyDraw` use that matrix for every sprite
  draw. Preserve its texture, anchor, tint, alpha, blend, source order, and
  pooled binding ownership.
- Do not add an Acid flag, alter record 10/78 art, tune phase/scale/angle, or
  change host/protocol state. The reported fix must emerge from the shared
  secondary adapter.
- Ensure repeated updates and any kind/record transition cannot retain stale
  Pixi skew/pivot state after matrix decomposition.

### Validation contract

- Red/green matrix test: at unequal axes and a non-axis angle, require
  `a=sx*cos`, `b=sy*sin`, `c=-sx*sin`, `d=sy*cos`; explicitly reject Pixi's
  former `b=sx*sin`, `c=-sy*sin`. Cover positive, reflected, uniform, and
  zero-rotation cases.
- Acid plan test: keep the exact age/phase/scale operands for records
  `78/78/10`, then assert their final matrices. At age 80, `p=.4`, and `s=.5`,
  the record-10 matrix must use X scale `1.5`, Y scale `3`, and angle `-40°`.
- Shared-secondary coverage: exercise representative unequal-axis members from
  Acid, Storm, Plane Orb, Leviathan, Ether Drain, Magic Trap, FreezeWave,
  Prismatic, Earthquake, Magic Circle, Dampen, and Turn Undead; retain the full
  all-kind asset/plan suite for equivalent members.
- Run the focused secondary renderer/kernel tests and the complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on a byte-identical Mac
  candidate.
- Mac hardware Chrome/WebGL2: capture deterministic Acid at low and near-one
  constructor phases and the stock-matched phase/age. Require three cloud
  members, exact matrix coefficients, a fixed-axis center envelope whose ink
  changes with age, all existing drop/residue/light/audio/lifecycle telemetry,
  and empty page/console/failed-response arrays. Run the all-23-secondary smoke
  or an equivalent representative sibling matrix so the shared adapter is not
  accepted from Acid alone.
- Publication and deployment remain separate and unrequested.

### Implementation validation receipt

- Implementation: `native-affine-transform.ts` now writes the native `S*R`
  coefficients into a caller-owned matrix. `NativeSecondaryActorView` keeps
  one reusable Pixi `Matrix` per sprite binding and applies it only when
  translation, angle, or either scale changes. Every secondary sprite uses the
  shared adapter; there is no Acid/record/phase exception and no per-frame
  diagnostic allocation. Asset, anchor, tint, alpha, blend, queue order,
  simulation, RNG, wire, audio, light, and teardown code is unchanged.
- Red Mac receipt: on unchanged adapter source, the new focused pair passed
  `63/64`; only the structural assertion requiring
  `writeNativeRotationThenScaleMatrix` failed. The mathematical matrix cases,
  all-kind plan membership, Acid age/phase operands, and every pre-existing
  focused test already passed, isolating the behavior change to final sprite
  composition.
- Focused green receipts on the byte-identical Mac candidate: the same pair
  passed `64/64`; the expanded secondary kernel/world/assets/presentation/
  audio/render set passed `203/203`; `tsc -p tsconfig.test.json --noEmit`
  passed. A direct Pixi decomposition probe reproduced positive,
  reflected-negative, and Acid record-10 matrices to floating-point noise,
  including the required age-80 matrix
  `(1.149066664678467,-1.9283628290596178,0.9641814145298089,2.298133329356934)`.
- Pre-receipt source-exact canonical Mac gate:
  `/opt/homebrew/bin/bash ./scripts/validate.sh`
  passed backend Release build with zero warnings/errors, all 19 Python
  contracts/integration tests, lint/boundary/generated checks, all 2,590 Node
  tests with zero failures, desktop tests, production frontend/game-host
  builds, bundle budget, and media/CSP policy. The Game entry is `265,203` raw
  / `80,817` gzip bytes; gate-log SHA-256 is
  `087437ab422fac32c3f0c4950fdf9659de96350012f312748b91cf070b2fca8e`.
  An earlier complete attempt had six unrelated host/supervisor message-wait
  timeouts under concurrent load after 1,797 passes; both files passed alone,
  and later canonical runs passed without any timeout-related product change.
  That rejected attempt is not used as the gate receipt.
- Mac Chrome `152.0.7977.65`, WebGL2, arm64 macOS `26.6.2` completed three real
  Tutorial input journeys. Seed `70` produced constructor phase
  `0.13575999438762665` at ages 40 and 60; seed `490` reproduced the prior
  near-wide phase `0.9989299774169922` at age 60. Every run retained
  `BadGuys 78 normal`, `BadGuys 78 additive`, `BadGuys 10 additive`, offsets
  `[-175,-175,-225]`, the one DeadHawg-4 underlay at depth `.5`, proxy Y
  `groundY+350`, all Acid child kinds, normal Tutorial stage `5 -> 6`, and
  empty page, console, and failed-response arrays.
- Matrix/visual receipt: at low phase and age 60, stock composition gives
  center coefficients
  `(0.8817870296798812,-3,0.5090999789535998,5.196152422706632)`;
  the removed Pixi property path would have produced
  `(0.8817870296798812,-0.5090999789535998,3,5.196152422706632)`.
  Inspected age-40/60 frames keep the thin cloud center on its fixed vertical
  world axis while its irregular ink advances from `-20` to `-30` degrees;
  the former diagonal rotating-ellipse sweep is absent. The near-one phase
  remains the broad filled cloud seen in the clean-stock oracle. Screenshot
  SHA-256 values are `66fb98119925227cf18f777b32a0f10f090990c2545a757c26acd6eff2cea59e`
  (low age 40), `ea311c221e8a13289f6a0cce815ad13e13f070ea32aea404840f7c0eab916073`
  (low age 60), and
  `1740ab8613d70aa4ea6d939c039c7dce1f0a348453a69b50e9057c169e6a9450`
  (near-one age 60).
- Shared-adapter browser receipt: an all-zero deterministic Arena exercised
  Call Leviathan, Planewalker, Magic Storm, Prismatic Shock, Ring of Ice,
  Earthquake, Raise Golem, Magic Circle, Magic Trap, Dampen, Acid Rain, Ether
  Drain, and Turn Undead. All 13 affected-family rows passed with empty page,
  console, and response-error arrays. Acid reached 175 actors / 223 primitives
  and its three-second full-density sample delivered 182 frames with p95,
  p99, and maximum gaps all `16.8 ms`, zero Long Tasks. The inspected matrix
  screenshot SHA-256 is
  `19dc7c4817e597bf884bad23a5f46b6c8f3b6db31fbaa9aa634f46d51e8fc9a9`.
  The unrestricted all-23 harness was not used as proof because its unrelated
  Teleport fixture expected authored Y `400` while that generated arena
  supplied valid Y `239.29595947265625`; a first affected-set run separately
  hit the known random `no dark collision-safe spawn placement` generator
  failure. The deterministic rerun changes no product behavior and closes the
  shared affine membership.
- No browser-platform approximation or material in-system unknown remains.
- Publication authorization arrived on 2026-09-03 after the implementation
  receipt. `origin/main` had advanced from `a2b19c2f` to `b786fc7e` through
  five shared-Hub/charm commits. None touched the six task files; the focused
  commit rebased cleanly. A new detached Mac candidate at exact base
  `b786fc7e` received a byte-identical six-file manifest.
- Rebased focused and gate receipt: the expanded secondary set again passed
  `203/203` plus TypeScript. The canonical Mac gate passed all 19 Python
  contracts/integration tests and 2,594 Node tests, lint/boundary/generated
  checks, desktop tests, both production builds, bundle budget, and media/CSP
  policy. `Game-C4lFAhRi.js` is `265,203` raw / `80,817` gzip bytes; the
  source-exact rebased gate log SHA-256 is
  `5d9f6cf009ea755617009bf2403765a12b8490a8d19709434268fe0b01c22272`.
- Rebased Mac Chrome repeated both age-60 Tutorial phases. Seed 70 yielded
  `0.13575999438762665`; seed 490 yielded `0.9989299774169922`. Both retained
  all three cloud members, offsets `[-175,-175,-225]`, the DeadHawg-4 underlay,
  normal stage transition, and empty page/console/failed-response arrays.
  Screenshot SHA-256 values are
  `ed00add7b6ea189894afe8c681f34b4e236d2ea93505d95cae3a3e06ab7fb695`
  and `41eee6e39976f4f615696d7266ae35026fa924e44c47fcbae9d006badfb2457e`.
- The rebased deterministic affected-family matrix again passed all 13 rows
  with empty error arrays. Acid reached 175 actors / 223 primitives; its
  three-second sample delivered 181 frames at p95 `16.7 ms`, p99/max
  `16.8 ms`, and zero Long Tasks. Its screenshot SHA-256 is
  `f98b8ba84fcbea155f1a609fc6be692c956cf5d4748af14fc617b8bc53332c06`.
- The final docs-inclusive canonical Mac gate runs with this publication
  receipt already present. No tracked file changes between that gate and the
  fast-forward push. Deployment and production cutover remain unrequested.
