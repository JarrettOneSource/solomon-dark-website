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
