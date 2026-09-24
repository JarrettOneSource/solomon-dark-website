# Enemy damage-presenter closure correction (2026-08-15)

## 2026-09-24 — Report 23: independent movement-reaction latch

### Reopened boundary and causal finding

Discord report `1552401822541676715` describes IronMaw stopping in Firewalker
and tentatively asks about Foulshaft. Original nine-second video SHA-256:
`835da5fedb41c76886313b0af74d3698428de9e12025e3cea104974241af9045`.
No original continuation was supplied. This investigation does not assume
the reported occurrence was a frozen clock or a permanent authored speed change.

The previous periodic-response pass recovered the flag-8 instruction but failed
to implement its separate state. Ledger 157 then represented the movement gate
with the visual hit timer. These are different native fields: `+0x78` is the
visual feedback clock; `+0x80` is the movement-reaction clock. Looking only at
red pixels and HP loss did not validate the movement consumer. Repeated fire
contacts refresh the visual clock even when stock explicitly clears reaction.

Boundary: common positive-damage reaction from contact flag 8, through the
target-owned latch and fixed update, to Skeleton/Archer/Mage movement, including
their authored boss variants and continuation persistence. This is not a
boss-specific immunity, a Firewalker damage change, or a new stun policy.

### Fresh native proof

Retail `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes,
SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
All analysis runs on the M2 through the existing read-only replica wrapper
`/Users/jarrett/.local/bin/sdr-ghidra-headless` (SHA-256
`26015c74981f7bc23556808b42eed2801e09c554357b8da57c8480c2aa2f9da3`),
canonical analyzed project `Decompiled Game/ghidra_project/SolomonDark`, program
`SolomonDark.exe`. Raw instructions, decompilation, exact scalar bytes, direct
xrefs, the full damage-flag-global census and float `+0x80` census were checked.
Task probes/logs are disposable under `/tmp/solomon-report23-a3u8qy39`.
No injected or newly recorded clean-stock runtime is claimed.

| Native owner | Instruction-derived contract |
| --- | --- |
| Context reset `006246F0` | Clears damage lanes and flags, initializes visual strength to one. |
| Reaction `00627F80`, stores `00627F99..00627FAF` | Positive physical plus magic damage writes both clocks to one; flag 8 immediately writes reaction zero, independently of visual strength and hurt-sound flag 16. A suppressing hit clears an earlier ordinary reaction, not merely avoids refreshing it. |
| Base constructor `006287D0` | Both clocks initialize to zero. |
| Puppet tick `00624AC0` | Independently subtracts promoted float32 `.05` (double `007DE8A0=0.05000000074505806`) from both clocks, stores float32, and clamps at zero. |
| Skeleton/Archer/Mage movers `004773E0/00477B40/00478380` | Test reaction `+80`, never visual `+78`, before the shared movement/gait builder. Equipped/armored Skeleton and Mage rest-pose overrides remain unchanged. |
| Shield `0048A290`, hurt cue `0048A600` | Pure shield absorption bypasses both body clocks. Hurt sound uses visual `+78` and flag 16, not the movement latch. |
| Fire/Fire_Goodguy/MovingFire contact `005FF1D0` | Flag `0x4A` at `005FF51E` includes no-reaction. `005FF556..005FF562` stores `0.25+Float(.5)` as visual strength. Existing physical/magic split and three-tick query stay unchanged. |
| Burn/FrostBurn `00629A40/006278B0` | Flags `0x18`, zero visual strength; suppress both reaction and hurt sound. |
| ElectricBurn/Steamed `00628F10/00625F40` | Flags `0x0A`; sampled visual strength does not imply movement reaction. |
| Lightning/Flame Lash/Blizzard/Frost Jet `0053F9C0/005408F0/00541870/00543860` | Their ordinary and chain contact writers use `0x2A` or `0x0A`; explicit Stun/ColdSlow remains a separate modifier. |
| Hurricane `0047CB20`, Acid Rain `00604E90`, Ether Drain `005F8620` | No-reaction flag appears as `8`, `0x18`, and `0x10A` respectively. |
| Ball Lightning `005F2360`, landed Meteor pulse `00621590` | Contact flags `0x2A` and `8`; Meteor impact is a separate direct contact. |

The remaining `+80` float reads in Faculty projectile logic `004804D0`, Silk
contact `005F6AC0`, Magic Circle `005FB020` and player progression consumers
address player maximum mana, not the Actor latch. Stack/UI/geometry offsets
are not additional reaction consumers. The constructor is the additional
in-system zero writer. Prismatic `00645540` writes `0x18` but delivers a
modifier without positive HP damage, so it does not arm either body clock.

### Membership inventory (declared before code; final dispositions after acceptance)

| Member | Final disposition | Verified contract |
| --- | --- | --- |
| Native context defaults; ordinary, quiet, zero-strength and no-reaction hits | exact-ported | Independent clocks; no inference from strength, element, magic damage or audio suppression. |
| Constructor, repeated hits, positive-to-suppressed transition, 20-tick expiry, paused world | exact-ported | Exact repeated float stores; movement resumes at the native boundary without modifying config. |
| All Skeleton weapons, armor branches, Archer/Mage; four Ironmaw weapon recipes and Foulshaft | exact-ported | Same shared gate; each member moves during flag-8 contact, ordinary hits still pause it. |
| Firewalker and Fire Wall; primary fire patches and their MovingFire sibling | exact-ported | Carry flag 8 and fractional strength without changing damage, cadence, area or lifetime; reuse the existing secondary response draw and restore the missing primary per-target draw. |
| Burn/FrostBurn/ElectricBurn/Steamed; Acid Rain/Ether Drain | exact-ported | Carry their native suppression bit through both secondary damage paths. |
| Lightning/Frost Jet and welded Flame Lash/Blizzard; Ball Lightning, Hurricane, landed Meteor pulses | exact-ported | Fix every same-bit producer, preserving separately authored slow, freeze, stun, knockback and damage. |
| Direct Fireball, ordinary missiles, melee, Boulder, Meteor impact, GoodImp attacks | verified-already-at-parity | Positive direct-hit control remains a 20-tick reaction; no blanket magic/fire immunity. |
| Other enemy families, Maggot, Portal/Cocoon, player/scenery/projectile visual feedback | out-of-system (not a Skeleton movement consumer) | Preserve their distinct movement/presentation consumers; no new motion gate. |
| Shield absorption, death, armor break, owner/world removal, client snapshots | exact-ported | Shield does not refresh clocks; snapshots retain unchanged visual fields; authoritative reaction never becomes a client-local timer. |
| Pre-cutover and current full saves | exact-ported | Store the new authoritative scalar with strict current validation. Legacy files lack source flags; retire only their unrecoverable transient reaction, preserving visual feedback, actors, progression and RNG. |

There is no new authored table in the latch mechanism. The complete existing
Skeleton weapon/headgear/armor catalogs and twelve generated Boneyard boss
recipe sources remain the data authority; none is approximated or retuned.
No browser platform prevents representing the recovered state.

The primary implementation consequence is an enemy-owned `hitReactionTimer`
separate from `NativePuppetHitState`, plus an explicit suppression bit at the
contact boundary. Renderer/protocol visual contracts remain unchanged. Old
saves cannot recover a historical source flag; clearing their at-most-20-tick
reaction is an explicit save cutover, not an inference that zero visual
strength means no reaction. Focused failing regressions, full M2 validation and production-browser
Firewalker journeys now satisfy the final dispositions above.


### Source exceptions and implemented ownership

The full flag census also includes Steam-particle `0045B940` (modifier delivery;
its positive periodic damage belongs to the covered Steamed owner), hostile
GuidedMissile `005F3EE0` (player contact), PoisonPool `005F8030` and Poisoned
`00627160` (separate player poison lane). They are not unhandled Skeleton-body
movement writers. Existing ledgers 070, 091, 096 and 123 own those distinct
contracts. `00649890` resets the common context to flags 3, not flag 8.

The learned physical Hail proc is a required direct-hit exception: Water's
handler calls `006246F0` again before its separate physical damage, so the
preceding Frost no-reaction flag is not inherited. The regression asserts a
reaction after Hail while pure Frost remains slowed by its modifier but not
movement-locked by visual feedback. Ground Spark and ordinary Frost Missiles
retain their direct-contact defaults; Ball Lightning explicitly carries flag 8.
Ring of Fire's 30 MovingFire children are visual-only, with zero contact damage;
the initial over-broad fixture assumption was corrected, not the game changed.

The enemy actor now owns `hitReactionTimer`, initialized to zero, assigned in
the positive body-damage receiver, and decremented with the same native float
stores as the independently retained visual clock. Every identified positive
Skeleton-targeting flag-8 producer carries an explicit `suppressHitReaction`
through its existing contact interface. No enemy recipe, authored speed, attack
rate, HP, damage, radius, status duration, physics or collision policy is retuned.
The primary fire-patch path additionally restores the missing native per-target
visual-strength draw. Secondary Firewalker/Fire Wall already spent that draw;
passing its existing value consumes no additional secondary RNG.

Save schema 41 stores the authoritative reaction field. Full current and
compatible future saves retain it; malformed or missing current fields are
rejected. Schema 40 and earlier lack historical contact flags, so their
unrecoverable at-most-20-tick reaction is retired explicitly. Full-state deep
comparison verifies no other restoration change, including visual feedback,
player progression/equipment, enemy configuration and saved RNG. No wire field
or client-local reaction clock was introduced.

### Focused and browser acceptance before the canonical gate

All 366 focused tests passed, including exact timer stores, positive-to-flag-8
clearing, zero-strength/quiet direct controls, shield absorption, every authored
boss source and all six Skeleton weapons with and without armor, paused clocks,
all changed spell producers, direct Hail/GoodImp/Meteor-impact exceptions, and
strict full-save migration. The full Boneyard command also passed its 2,583-test
main suite, along with its prerequisite suites. Type checking, production build
and lint passed; lint retains 16 pre-existing warnings and no errors.

The unchanged runtime at base `a6b8f818` reproduced the stall using a real
Firewalker key cast after Title/Create/College/Boneyard/Solomon navigation.
Each of four Ironmaw weapon variants and Foulshaft took about 7.92 HP damage
over a 100-tick post-first-contact window while moving exactly zero units.
The first corrected run at the same trial corridor moved 24.45–48.26 units,
kept taking native fire damage and subsequently entered ordinary attack states.
This is a gameplay-state comparison, not a claim of pixel-identical runtime
RNG histories or a replay of the reporter's unsupplied continuation.

The maintained `frontend/tools/smoke-firewalker-movement.mjs` then moved its
trial corridor closer to the arena center and waited for the actual client
camera and attack frame, so captures do not mislabel a delayed locomotion frame.
Its Chrome 153.0.8010.53 production journey verifies all five authored bosses,
real fire HP loss, more than ten units of motion reaching the decoded client,
unchanged native maximum HP and actual rendered `skeleton-claw-b`,
`skeleton-weapon` and `archer-shot` actions. Every page/console/HTTP/request/host
and wire error array is empty. Captures remain disposable. The fixture explicitly
holds wave generation and replenishes player health/mana, while leaving the
boss recipe, collision, pathfinding, attack and fire damage programs native.

The earliest arena seed (all bytes 42) failed the pre-existing stock-policy
opening spawn constraint before the experiment. The established zero-byte
acceptance seed was used instead, without relaxing spawn admission. An initial
movement measurement incorrectly included the short pre-contact approach;
measuring after the first actual damage separates that from the reproduced
sustained hit lock. These fixture issues are not claimed as game fixes.

Maintained browser command, from the production-built `frontend` directory:

```sh
SDR_FIREWALKER_OUTPUT=/tmp/solomon-firewalker \
node --experimental-strip-types tools/smoke-firewalker-movement.mjs
```

Disposable proof SHA-256 values (recording a hash does not retain the capture):

- Native instructions/field census: `62a9c19835f820ed6fb3291f3c5100affdb8036bd3a2ae5322bdcf66cd001b6b`.
- Complete damage flag census: `c8c0609523a46d5bc5d58ddfd859a93ee7f0cc6a6c4dc8a6a9bf731ed3f01433`.
- Water/Hail and Air source recovery: `cc0506e733b274130775900ec38d578db94a889e019427cbbf4723894174501c`.
- Unchanged-runtime five-boss baseline: `7ab2507cc4c2424aff758ffe9d5f577343bb7d4c0cf3e1da6450fabf42a2682d`.
- Initial corrected same-corridor browser: `0cf4052f44227a51f1f82193fdb4edb4b8859651b15fc9ba6970a77bc9ce55d0`.
- Framed five-boss rendered-attack browser: `8a91ff8d93029f2b0af1ed8db78adad4a04946498b44e274e50631f9060bd393`.


### Final canonical M2 acceptance — 2026-09-24

The clean candidate `55739585dac6ddfc5ef434c542a521f4ce5059c0` completed the full
`/opt/homebrew/bin/bash ./scripts/validate.sh` gate with exit zero at 12:42 UTC.
All 24 Website/backend integration tests and 3,786 frontend/desktop tests
passed, together with backend formatting/build, frontend lint/type/boundary
checks, production builds, media policy and the full renderer quality/mutation
checks. The renderer report has no failures or surviving mutants. No gate was
removed, skipped or weakened. All 7,179 tracked source files matched their
pre-validation SHA-256 manifest after both the gate and the browser run.

The script then ran the exact production client's maintained Firewalker journey
and exited zero at 12:43:04 UTC. Chrome 153.0.8010.53 observed:

| Authored boss | Motion over 100 post-contact ticks | Native fire HP loss in window | Subsequent rendered action |
| --- | ---: | ---: | --- |
| ironmaw-claw | 68.451 world units | 2.880 | `skeleton-claw-b` |
| ironmaw-sword | 54.121 world units | 4.080 | `skeleton-weapon` |
| ironmaw-mace | 68.906 world units | 1.920 | `skeleton-weapon` |
| ironmaw-flail | 74.350 world units | 2.160 | `skeleton-weapon` |
| foulshaft | 54.503 world units | 2.400 | `archer-shot` |

All five bosses retained their authored maximum HP and continued to receive
real Firewalker damage. Decoded client positions confirmed their movement;
the browser recorded each actual attack frame atomically rather than inferring
it from a later screenshot. Both melee and archer attack screenshots were
inspected; stock scenery can partially occlude Foulshaft. Page, console, HTTP,
failed-request, host and wire error arrays were all empty. The helper's player
health/mana and wave-hold controls remain explicitly test-only.

The original baseline's five zero-displacement trials and the first corrected
same-corridor trials isolate the repaired hit lock. The final centered-corridor
journey independently verifies movement, actual damage, replication and attack
presentation. These are not claims of identical cross-run RNG histories or an
exact replay of the reporter's unsupplied save. No native speed/HP/damage
retuning or FPS optimization is claimed; no new clean-stock runtime capture
was performed. There is no newly blocked-by-platform member.

Canonical log SHA-256: `4930c74192c19d0bc1d2ac9c576ae063dba740e9b81c97e334b1078fbc61af70`.

Final browser receipt SHA-256: `5fdc8352e358a9fca9f74791c3d38525ffd5c8ff30c3a46a7b4c0f63cad35e2e`.

Source-manifest SHA-256: `1c7a93a31f20394e2a4c366dd5567d7189ea44ceac24bcbe7c8d646d70559596`.

This final receipt/disposition update changes documentation only. Runtime,
tests, assets and build-input bytes remain those of the fully validated
candidate above. Publication, Discord reaction and task-cleanup receipts are
recorded separately in the private M2 archive; these local checks do not
claim production deployment or a verified live rollout.

## 2026-09-23 — Report 05 renderer retirement reopening

Recorded before implementation. The two-present-browser Faculty fixture retains
25,477–26,023 simultaneous native effects, then retires all of them. Host/client
unit tests, lint and build pass, but delivery still intermittently exceeds one
second after the scheduler/compression repair. Browser CPU profiles identify
Pixi `Container.removeChild` as the largest named self-time owner during the
burst; the view currently removes each expired sibling separately, repeatedly
searching and shifting the shared child array. A real-Pixi Mac replay with
25,802 projected native Faculty effects, all offscreen so no sprite resources
are created, measures 461–703 ms to retire all effects and 299–404 ms to retire
alternating half. This proves a renderer teardown cost independent of GPU work,
without attributing every historical stall to it.

The owning boundary remains all twenty effect kinds and all five painter lanes.
Use installed Pixi's complete child removal/re-add APIs to batch dense
retirements within each affected parent, retaining survivor identities,
transforms, resources, relative order and unrelated root children. Scene updates
are synchronous and no game renderer subscribes to these child membership
events. Only expired views are destroyed. Partial-range removal is unsuitable
in the installed Pixi implementation because its range helper passes the end
index to a count-based array utility; use the full-list API instead. Recheck
both full and mixed retirement and the two-browser journey before accepting
this optimization. Ordinary small retirement batches need measured comparison
so a large sibling list is not needlessly detached for one expired effect.

The controlled comparison reduces full-population median retirement from
468.26 ms to 19.53 ms, and alternating-half retirement from 242.29 ms to
22.48 ms. Small batches should not rebuild a large live sibling list: at
404 removals the two paths are approximately equal (15.43/15.97 ms), while
101 removals favor individual removal (11.35/18.74 ms). The adapter therefore
batches only parents losing at least 512 effect containers. This is a measured
renderer threshold, not a native population or lifetime change. The mixed-root
regression retains unrelated children and surviving sprite identities, destroys
only expired resources, and preserves order through later full teardown.
With the final per-parent threshold, the measured medians are 23.20 ms for
full retirement and 18.90 ms for alternating-half retirement.
All four Mac allocation/lifecycle tests pass, including the complete 20-kind,
two-shadow-state, five-lane matrix. Built-browser repeat acceptance remains pending.

## 2026-09-22 — Report 05 high-population allocation reopening

Recorded before the allocation change. The two-browser native wave-32 burst
reaches 13,464 effects and reproduces long delivery gaps (entry 097). An
unmodded three-Faculty host probe retains all 26,048 effects, then retires them;
it spends 2.12 seconds of a 12-second profile in GC, with 377 ms inclusively in
`stepBoneyardPreWorldEffectBirths`. That method allocates a one-element temporary
array for every ordinary resident on every tick despite changing only fresh
pre-world births. A direct ordered loop can keep the same returned ownership,
birth/retirement decisions and RNG order without those temporary arrays.

Built Mac Chrome profiles of all three individual Faculty death journeys
(8,575 effects each) identify 145–189 ms in the immutable death-plan factory
over each approximately seven-second profile. The retained view immediately
unpacks those newly frozen position/layer/offset/scale objects into existing
Pixi sprites. Profiles also attribute about 245–252 ms to GC; these figures
overlap neither one another nor establish whole-run improvement by themselves.
The minified factory was matched by its field/formula sequence to
`nativeEnemyDeathEffectPlan`, not inferred from the function's short name.

Boundary: all **20** current death-effect kinds, including Crow, both shadow
states, all five owner lanes, first visibility, moving/scaling bounds, depth,
offscreen/reentry and retirement. Reuse the same native vertical-scale formula
in bounds, the immutable plan API and the retained sprite adapter. The adapter
can write identical scalar values directly; the public immutable plan remains
available. An unshadowed visual bound needs no one-element array or union copy.
Keep every container's birth insertion position and all sprites/textures,
effects, lifetimes and draw order. This supersedes no earlier lazy-allocation,
gradient, movement-grid or duplicate-interpolation-copy repair.

Acceptance requires all-family real-Pixi property/lifecycle checks, identical
outputs against a baseline that already includes the separately recovered
float32 ring repair, controlled alternating timing blocks, and the built Mac
browser and sustained-party journeys. No speedup or stall closure is claimed
before those measurements.

The alternating Mac comparison now passes. Six complete real-Pixi container /
sprite property trees match the preserved `bf8b6e5ad` baseline byte-for-byte,
and the pre-world population output is deeply equal. The six native Faculty
snapshots contain 8,336–8,366 effects. Eight alternating blocks (20 warmups,
100 retained-view updates and 200 pre-world passes per block) measure mean
view update **6.471 → 4.752 ms (26.6% lower)** and pre-world pass
**.2032 → .0761 ms (62.6% lower)**. No profiling or forced GC runs inside the
timing blocks. The CPU-only adapter uses the same empty texture and canvas
stubs as the real-Pixi contract tests; this isolates update cost and is not a
GPU/FPS claim. All-family retained-view properties, ownership, visibility,
insertion order and teardown tests also pass. Full built-browser and sustained
party acceptance remain the separate delivery gates.

## September 21 representation-only resource allocation follow-up

The high-population private endurance run retained over one thousand death
effects. The current Website renderer constructs Pixi containers and sprites
for every newly observed effect before its existing exact visual-bounds test,
including effects that never enter the camera. This is browser resource work,
not a change to the native effect factory or effect membership.

The repair boundary is the complete `NativeEnemyDeathEffectViews` resource
lifetime. All nineteen snapshot kinds are included: `banish`, `banish-black`,
`bouncer`, `smoky-bouncer`, `black-smoky-bouncer`, `fade`, `fade-additive`,
`fade-perspective`, `fade-perspective-clipped`, `fade-scale-perspective`,
`fade-scale`, `fire-array`, `late-splat`, `move-fade`, `move-fade-perspective`,
`move-fade-sin`, `sprite-array`, `unbind`, and `scrap`. Their existing native
plans, shadowed/unshadowed resource membership, and all presentation-owner
lanes remain verified-already-at-parity and unchanged by this optimization.
The Website-only Pixi allocation timing is the exact-ported representation
change: retain the lightweight identity/bounds record and empty painter
container immediately, but create its sprites/graphics on the first visible
sample. The container's original insertion position must survive even when
same-depth background effects become visible in different orders. Once constructed,
retain those resources until the effect retires, including offscreen/reentry.

Keep unchanged the visual-bounds predicate, fixed-tick age, transforms,
texture records, material state, painter registrations/depths and identity
validation even while offscreen. Visibility must never reset effect age or
drop an effect from the authoritative or sampled world. Spawn-offscreen,
enter, leave, reenter, mutation rejection and retirement are the required
regression branches. Native effect emission, damage, RNG and simulation
retirement are outside this browser-allocation boundary and remain unchanged.

Verification results belong in `docs/performance-release-20260921.md` after
execution; this declaration alone asserts no measured speedup.

This secondary report reopens and supersedes the nonterminal-damage portion of
the immediately preceding hit/death pass. That pass correctly recovered the
common Actor red latch and terminal family presenters, but it did not enumerate
the enemy polymorphic damage seam (`vtable +0x4C`) and did not follow the
positive shield branch inside `Badguy::Contact`. The reported missing effects
and sounds are therefore one skipped native ownership layer, not four unrelated
asset-playback bugs.

## Evidence ledger

| Tier | Evidence | Finding | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Exact stock provenance used for every address and constant below. | high |
| Static class census | Native enemy catalog vtables and slot `+0x4C` | Skeleton/Archer/Mage share `0x0048A600`; Zombie uses `0x0048B1E0`; Imp uses `0x0048B1C0`; Wraith thunks to common; Demon/Coffin/Maggot use common; Spider/Cocoon/Portal own non-Website overrides. | high |
| Static receiver instructions | `0x0048A290`, `0x0048A600`, `0x0048B1E0`, `0x004835F0`, `0x0047CE00` | Exact hurt-sound gates, shield early-return/no-overflow rule, 10-tick cue throttle, pulse values/decay, break cue, and twenty-particle constructor fields. | high |
| Static shield-writer xrefs | complete `0x00477140` xref set and Mage dispatch `0x0047FDE0` | Action `0x13` shields the Mage itself. Action `0x14` calls the helper at `0x0047FE8B` only for a same-team Skeleton `0x3E9`, Archer `0x3EA`, or Zombie `0x3EE`; other enemy families are not reachable ally-shield recipients. | high |
| Static render instructions | Skeleton-family blocks at `0x0048F20F..0x0048F3B1` and siblings | Active shield is one additive BadGuys record 49 at `y-30`, with pulse-derived brightness and sine scale; it is not a health-ratio copy of body layers. | high |
| Asset/catalog identity | Retail audio catalog and untouched WAVs | `bonecrack` entry 12, `hitshield` 42, `popshield` 74, and `zombieouch` 107 are exact point cues with pinned source hashes. | high |
| Negative spell census | Rank-one Air/Water dispatch plus Earth `0x00620B60` | Air and Water have no target-contact cue. Earth `rockhit` is a vertical ground-bounce cue at `0x0062141B`, not an enemy-contact event. | high |
| Pre-fix Website base | origin/main `4fbb3b7`; `boneyard-enemy-store.ts`, `native-enemy-presentation.ts`, protocol/audio manifests | The web rolled shield overflow into HP, armed the red latch on pure absorption, drew body-copy glow, emitted no hurt/shield events or break particles, and did not ship the four damage WAVs. | high |

## Closed stock state machine

For an ordinary unshielded hit, Skeleton/Archer/Mage play `bonecrack` and
Zombie plays `zombieouch` only when the prior common latch is zero and damage
flag `0x10` is clear. Pitch is `1 + RandomFloat(0.1, signed)`, hence
`[0.9,1.1)`. The wrapper then enters common contact, which refreshes the
20-tick red body latch. A first lethal hit still emits its family hurt cue
before terminal output; repeated hits inside the latch window do not replay it.

For `shieldHealth > 0`, native common contact exits through a separate lane:

```text
shield -= primaryDamage + secondaryDamage
if shieldCueCooldown == 0:
    play hitshield at 0.8 + U[0,0.05)
    shieldCueCooldown = 10
    shieldPulse = 2
if shield <= 0:
    play popshield at 0.8
    create 20 stationary additive BadGuys[69] fades
    shield = 0
return without body-hit reaction or health damage
```

The breaking hit never transfers excess damage to health. Common tick
`0x004835F0` subtracts `0.05` from pulse and one from the cooldown, clamping
both at zero. Applying a shield writes pulse `3`. Each break fade starts at
`(x,y-30)`, rotation `U[0,360)`, alpha `0.5+U[0,0.75)`, loss `0.05`, uniform
scale `1.5+U[0,0.25)`, zero velocity, additive blend, and stable world-owned
identity until its sampled alpha expires.

While shield health remains positive, the renderer draws one additive
BadGuys[49] shell at `(x,y-30)`. With pulse `p` and Region light `L`:

```text
brightness = (0.5 * (max(p,1) - 1) + 0.25) * L
scale = 1.5 + 0.1 * sin(worldTick * 20 degrees) * min(p,1)
```

Current/max shield ratio is not a visual input. Pure absorption must leave the
ordinary body hit latch unchanged.

## Membership and negative dispositions

- Implemented wave membership: Skeleton, Archer, Mage, Imp, Zombie, Wraith,
  Demon, Coffin, and subordinate Maggot.
- Skeleton/Archer/Mage receive `bonecrack`; Zombie receives `zombieouch`;
  other implemented families receive only their reachable common body-hit
  presentation.
- The positive shield branch is reachable for Mage self and same-team Skeleton,
  Archer, or Zombie allies only. Stock Mage action `0x14` rejects Mage-as-other,
  Imp, Wraith, Demon, Coffin, and Maggot by exact runtime type before applying a
  shield. Their inherited common receiver does not imply a stock shield writer.
- Native Imp `+0x234` rejects damage during its ejected/materializing phase.
  The Website's supported Imp lifecycle starts in active flight and has no
  corresponding phase; this pass does not disguise that separate lifecycle
  omission as a sound effect.
- DireFaculty, Heartmonger, DemonSkull, GreenImp/GoodImp, Spider, Cocoon,
  Portal, Crow, and player-owned Golem are not Website wave-family producers.
  Their recovered overrides are documented but do not justify unreachable
  protocol variants.
- Ether and Fire retain their recovered projectile impacts. Air's target
  corona is already the native visual. Water has no target-local hit actor.
  Earth `rockhit` remains a separate rolling-boulder bounce-physics concern;
  attaching it to enemy contact would be false parity.

## Implementation and acceptance contract

The host must own hurt/shield event IDs, pitch RNG, shield cooldown/pulse,
no-overflow damage acceptance, and every break-particle sample. Damage results
must publish semantic events into the existing retained run lane during the
same authoritative spell tick. The live enemy sample must carry one native
record-49 shield sample; break particles use the already-independent effect
entity lane and survive shield-state changes without client rerolls.

The renderer must remove the body-copy shield approximation. Exact untouched
WAVs enter the existing positional event path with native point attenuation.
Protocol decoding must reject unknown event/sound variants and remain strict
about effect counts and fields.

Focused acceptance must prove: no health overflow and no red body latch on the
breaking hit; 10-tick `hitshield` throttle; pulse `3 -> ...` on application and
`2 -> ...` on an audible hit; exactly twenty record-69 additive fades with
bounded fields; one record-49 active shell with the stock formula; first-hit
Skeleton-family/Zombie sounds and 20-tick suppression; once-only replicated
playback; and no invented Air/Water/Earth contact cue. Final completion also
requires Windows-side focused/canonical tests plus a real browser/Web Audio
receipt on the exact final tree.

## Website closure and Windows browser receipt

Protocol 21 closes this presenter as one host-owned system. The replicated
living actor now carries the shield pulse and cue cooldown, while the retained
enemy-event lane carries host-selected hurt/shield cue IDs and pitch. Damage
returns its semantic events to the spell tick that accepted it. The positive
shield branch absorbs the complete invocation, leaves body health and the
ordinary damage latch untouched, publishes the throttled hit cue, and on the
break edge publishes the pop cue plus twenty host-authored effect entities.
Mage ally selection now mirrors the native type gate: only Skeleton, Archer,
and Zombie are candidates, while the separate self-shield lane remains Mage
owned.
The integrated low-mana and enemy-damage changes each extend the protocol-19
wire schema, so their combined contract advances past either independently
authored protocol-20 shape to protocol 21.
The strict protocol accepts the shield break's `1.25` maximum alpha only for
the exact additive BadGuys[69] fade shape; every other existing effect shape
retains its prior maximum of one.

The renderer now plans exactly one BadGuys[49] active shell from the native
pulse/light/sine formula and no longer copies the enemy body layers as a glow.
It also excludes a shield-only contact from the body-red redraw. The unchanged
retail WAVs are shipped through the existing point-audio path:

| Cue | Bytes | SHA-256 |
| --- | ---: | --- |
| `bone-crack.wav` | 6,652 | `9b42d96a3d505cc1d631d43b6fde4b7fb9670ed2fa758a7692207f2c514047c4` |
| `hit-shield.wav` | 4,348 | `ad5a4870955e5393c17a03c847af274f7a054b62a4c712582206623d1d92ad3f` |
| `pop-shield.wav` | 6,152 | `b4d6bf4d9a68f11bab92def6e823a53f6b8534c49b96e80bbf25d99972af2503` |
| `zombie-ouch.wav` | 10,930 | `db5400fa0d40ec3507d56d6d29c77ca23dfff4686abe97193b13945da0772d32` |

Focused coverage exercises every implemented family disposition, the first
and suppressed Skeleton/Zombie cue edges (including first-hit lethal), silent
Coffin/Demon/Imp/Wraith body hits, shield application and decay, the exact
10-tick cue replay edge, the complete eligible/ineligible Mage shield target
set, no overflow/latch, all twenty break rows, strict protocol bounds, the
active shell, event retention, and decoded audio. The exact integrated Windows
full gate covers 23 backend/contract tests, 738
frontend/Boneyard tests, five desktop tests, lint/import boundaries, the
production build, and media policy; the focused ten-file enemy-damage set
covers 164 tests.

The decisive two-client Windows Chrome `151.0.7922.138` journey ran on
2026-08-15 from current origin/main `f3944f2` plus this exact change set with
`smoke-multiplayer-combat-lifecycle.mjs --feature-only`. It completed the real
menu, physical gate, Solomon proximity, Skeleton kill, shared picker barrier,
and ordinary browser combat in run `926b752a48f6ff15093f5aa839570c99` with
empty console/page-error arrays. To isolate one shield damage invocation, the
receipt armed a reachable actor at
`1/1024` shield health and published down/up through the browser input listener
in one task; those commands still traversed client tick sequencing, WebSocket,
the host simulation, replication, both renderers, and both Web Audio contexts.
It proved:

- actor 11 was armed at authoritative tick `19846` and broke at the
  presentation sample for tick `19880.839999997617`, retained body health
  `2.5 -> 2.5`, retained its prior body damage owner/tick latch, and ended with
  current/maximum shield zero;
- both peers observed the identical twenty effect IDs `21..40`; sampled alpha
  spanned `0.25..0.8984296876191366` and every row was the
  additive BadGuys[69] fade;
- both peers decoded `hit-shield` at `0.8373821377754211` and `pop-shield` at
  the exact serialized native float `0.800000011920929`;
- the later ordinary Air contact remained separately visible, actor 11 health
  changed `2.5 -> 2.464638671875007`, and the positive body-red latch sampled
  at `0.7099999999998545`;
- the terminal Skeleton path played `bone-crack` and `skeleton-die`, preserved
  its twenty independent death-effect actors through the picker barrier, and
  retired them on both presentation timelines.

The visual receipts are under
`C:/Users/User/AppData/Local/Temp/solomon-dark-enemy-damage-browser-receipt-final2-20260815`:

- active shield: `solomon-dark-multiplayer-enemy-shield.png`, SHA-256
  `605aafcc626184e98c5339a8e5f77bd3a8422b9b9ee4b2a3bef74a892713d0b4`;
- shield break: `solomon-dark-multiplayer-enemy-shield-break.png`, SHA-256
  `60da7fbed999d96b0118bd64b45cdd5666dace0059275e99192cab163eecdf94`;
- ordinary body hit: `solomon-dark-multiplayer-enemy-hit.png`, SHA-256
  `ac5138c1bf66f6bc7f267f689bd3a745e19971df0ee2dbc0e595ad10dead8548`;
- shared picker and waiting frames: SHA-256
  `a42ad1d8a48f6e5af7aa9f85659311023813a24d167ad2625d92910ac734af77`
  and `27f6ab7e3d64e455956f33daa286378539c6dd938430f8a2c88de56e65fe29eb`.

There are no browser-platform approximations or undisposed members inside the
implemented Website enemy-damage presenter. The separately documented Imp
materialization phase and the remaining numeric death-effect physics are not
producers in this system and remain outside this closure.

## 2026-09-22 — Report 02: periodic damage lost its native hit response

### Report, evidence, and boundary (recorded before implementation)

Soggy's tentative report is the original Discord message
`1542255501855825960/1551640716747341854`, archived at
`/home/user/solomon-darker-bug-reports/2026-09-21/02-burning-enemies-red-glow/report.txt`.
Its only attachment, `1551640716214669466__afterburn_red_glow.mp4`, is
1920x1080, 180 frames, 6.0178 seconds; SHA-256
`2d4761fb420cfc94c16283e643b64804ff4fb3eb03c8099cacf87bb57a5158e0`.
Inspection across the full clip shows persistent solid red enemy silhouettes
while Fire damage continues. This is a body hit redraw, distinct from the
correct small target light and additive flame children.

This reopens the damage-presenter contract: the earlier pass recovered the
receiver but did not carry the modifier's damage-context strength and sound
flags through every producer. The system boundary here is **target modifier
periodic-damage response metadata, from the native producer to the existing
shared enemy receiver, replicated hit sample, and body renderer**. The ordinary
hit renderer is already capable of representing zero and fractional strength.
Do not remove native flame art, illumination, ordinary contact flashes, or the
separate permanent `FLAG_BURNING` enemy variant.

Fresh static evidence uses retail 0.72.5, preferred base `0x00400000`, 4,723,200
bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Ghidra `SolomonDark/SolomonDark.exe` was read through the existing read-only
replica wrapper, explicitly passing the canonical `Decompiled Game/ghidra_project`
and `ghidra_project_replicas` paths. No native GUI session was taken over.
This is instruction evidence, not a claimed new clean-stock visual capture.
Read-only Mod Loader revision: `08bfba9ef367f7b863848030d0a289dc31e33192`;
wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
The decompiler, full instruction dumps, and xref census were reconciled.

| Native evidence | Recovered contract | Confidence |
| --- | --- | --- |
| Burn tick `0x00629A40`; instructions `0x00629AA5`, `0x00629ABE` | Damage flags OR `0x18`; `FLDZ` stores hit strength zero at `0x0081C6F8` before dispatch | high, instructions |
| FrostBurn tick `0x006278B0`; `0x00627914`, `0x0062792D` | Same flags and zero strength as Burn | high, instructions |
| ElectricBurn `0x00628F10`, source `0x006290A1..0x006290D0` | `Int(3)==1` gives `0.25+Float(0.5)` strength; other two branches give **zero**, not 0.25; flags `0x0A` | high, instructions |
| ElectricBurn chained target `0x00629763..0x0062978E` | Each admitted arc target gets `0.25+Float(0.5)` strength, without source gate | high, instructions |
| Steamed `0x00625F40`, `0x00625F8B..0x00625FC8` | Flags `0x0A`, strength `0.25+Float(0.5)`; preserve the separate stored Fire explosion payload | high, instructions |
| Poisoned `0x00627160` | Separate poison damage slot `0x0081C6F0`, flags `0x88`, green material and strength 0.75; not ordinary Burn | high, decompilation plus binary constants |
| EtherBurn `0x00629CD0` | Flame/light presentation only; no periodic damage dispatch | high, decompilation |
| Common reaction `0x00627F80`, `0x00627F99..0x00627FBB` | Positive physical+magic damage refreshes timer `+0x78=1` and copies context strength to `+0x7C`, including zero. Flag 8 clears the separate reaction latch `+0x80` | high, instructions |
| Zombie `0x0048B1E0`, Skeleton family `0x0048A600` | Flag `0x10` suppresses hurt cue, independently of strength; shield path remains separate | high, fresh Zombie decompilation and prior family census |
| Shared renderer `0x00624B40` and tick `0x00624AC0` | Red body alpha uses strength times the decaying timer; zero strength hides the red pass without canceling damage or timer. Native complex/simple lighting behavior is unchanged | high, decompilation and existing renderer tests |

### Membership sweep and implementation consequences

The factory is the only direct Burn-constructor xref (`0x005B94FE` in
`0x005B7080`); Burn's only tick reference is vtable slot `0x0079E510`.
The shared reaction has two direct callers (Badguy contact `0x0048A290` and
PlayerWizard contact `0x0052F540`) and 92 inherited vtable/data references.
The strength-global census has 29 references in 24 functions. Besides the
modifier members below, the direct spell/contact writers are `0x0044FFE0`,
`0x0045B940`, `0x0047CB20`, `0x00490860`, `0x00649890`, `0x0053F9C0`,
`0x005408F0`, `0x00541870`, `0x00543860`, `0x005F2360`, `0x005F3830`,
`0x005F8620`, `0x005FF1D0`, `0x005FFDC0`, `0x00604E90`, `0x0061C440`,
`0x00645540`, and `0x0047A580`: out-of-system direct-hit producers, not
periodic modifier dispatches. Their default hit behavior must remain intact.

| Member | Final disposition / acceptance contract |
| --- | --- |
| Burn from primary Fire/Explode and Ember, Ring of Fire, Firewalker/Fire Wall patches, Fire Magic Trap | exact-ported: one shared modifier path, strength zero and quiet hurt cue; unchanged 200-tick damage, refresh/merge, flame and light lifetime |
| FrostBurn from enhanced Ring of Ice / FreezeWave | exact-ported: same zero-strength/quiet response; preserve frost art and damage |
| ElectricBurn Magic Trap source | exact-ported: transport sampled strength, correct no-flash gate, retain existing RNG draw order/light |
| ElectricBurn Ball Lightning / Ground Spark source and chained targets | exact-ported: source gate and independent arc strength; retain damage, targets, stun and lifetime |
| Steamed from Steam Jet | exact-ported: fractional hit strength, retain damage and explosion/Ember payload |
| EtherBurn | verified-already-at-parity: no periodic damage; existing five art records and target light remain |
| Poisoned | out-of-system: separate player poison slot/material owner; not carried by the enemy secondary damage list |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, Coffin, Spider, DireFaculty, Heartmonger, DemonSkull | exact-ported through the common receiver; assert each family's zero-strength HP damage and positive-strength direct-hit control |
| Coffin-owned Maggot | exact-ported through the same contact transport and separate Maggot receiver |
| Portal | verified-already-at-parity: separate native hurt animation; generic red body pass is disabled, retain that response |
| Cocoon | verified-already-at-parity: separate release-only damage receiver, no ordinary body hit pass |
| Shield absorption, immunity, target death/removal, owner exit, world reset | verified-already-at-parity: retain existing authoritative gates and teardown; zero strength must not bypass HP damage, cause shield overflow, or retain orphan effects |
| Burn art `BadGuys[333..342]`, Ether art `[246..250]`, Frost art `[10,11]`, target MiscLight | verified-already-at-parity; all authored rows already extracted; no asset/table substitution |
| Simple/complex lighting; snapshot/keyframe/delta interpolation | verified-already-at-parity: existing zero/fractional hit sample and material rules; verify actual rendered samples and no red pixels during isolated Burn |

Native scalar constants were read directly from the verified PE: float
`0x007DE870=0.5`, double `0x007DE8F0=0.25`, float `0x007DE934=0.75`.
There is no additional authored table in this response transport. Existing
fixed-tick clocks, modifier merge and removal, target light registration,
flame fading, renderer ordering and replicated state remain their current
owners. The correction belongs in `native-secondary-abilities.ts`'s damage
result and `native-secondary-world.ts`'s existing receiver call, using its
already-supported `hitStrength` and `suppressHurtSound` inputs.

Acceptance: a failing regression against the current Mac candidate before the
change, focused per-producer and per-recipient checks, then the complete Mac
canonical gate and a real Chrome Title/Create/College/Boneyard journey. The
browser must show normal direct-hit feedback, isolated Burn HP loss with
flames/light and no solid red body, refresh, expiry, target removal and reset;
page/console/network/wire failures must be empty. No platform approximation is
needed. Publication requires the exact final tree to pass the canonical Mac gate and this browser journey again while the campaign lock is held.


### Implementation and focused Mac receipt

The existing damage contact now carries optional `hitStrength` and
`suppressHurtSound`; the existing enemy receiver consumes them. Burn/FrostBurn
supply zero/quiet, ElectricBurn transports the sampled source/arc response,
and Steamed supplies its native fractional strength. The native hit timer
still refreshes, HP damage continues, and ordinary direct hits are unchanged.
No renderer, atlas, protocol, save-schema, or Mod Loader change was needed.

On the isolated Mac acceptance worktree, the initial two Burn regressions
failed specifically on missing response fields and `red alpha 1 != 0`. After
the shared correction they passed for all twelve common enemy families and
all five Fire producer identities. Three sibling regressions likewise failed
before their correction. The five focused files then passed **237 tests**;
additional Maggot zero/fractional/direct response and shield break/no-overflow
checks passed **2/2**. Existing coverage retains the 200-tick damage sum,
strongest-payload refresh, two Burn RNG words, ten flame records, final-50-tick
light fade, EtherBurn's no-damage lane, and all renderer families.

The maintained browser journey is `frontend/tools/smoke-burn-response.mjs`.
It uses owned ephemeral preview/host ports and a fresh Chrome context, real
Title/Create/College/Boneyard navigation, and target staging at the native
modifier interface. The first Mac Chrome `153.0.8010.53` run decoded 118 wire
frames with empty page, console, failed-response, failed-request and wire-error
arrays. At sample tick 310.17, Zombie/Skeleton/Imp each had hit alpha zero,
**39 flame primitives and 3 target lights** were present, and each target had
lost HP. A preceding ordinary hit produced positive red alpha. Refresh at
334 retained the same three modifier IDs beyond their original expiry;
by sample 535.18 both flames and lights were zero. Target removal and world
reset also cleared their owners. Inspected screenshots showed textured bodies
with the native flames, followed by clean expiry, without red silhouettes.
The original reporter archive is preserved; these disposable test captures
are removed after publication.

The final canonical command is `/opt/homebrew/bin/bash ./scripts/validate.sh`
from the exact Mac worktree. Publication also reruns the focused integration
file and the browser journey in both Complex Lighting modes. The campaign
execution outcome records the final commit, full gate, browser receipts, and
publication identity; no production deployment is initiated by this report.
