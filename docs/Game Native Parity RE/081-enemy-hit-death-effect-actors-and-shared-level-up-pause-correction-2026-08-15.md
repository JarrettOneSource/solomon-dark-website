# Enemy hit/death effect actors and shared level-up pause correction (2026-08-15)

This correction supersedes the Website's five-tick additive-white hit flash,
family body-strip death approximation, integer-only XP awards, and per-player
picker input gate. Native evidence is recorded in Mod Loader
`docs/reverse-engineering/native-enemy-hit-and-death-effects.md`,
`native-progression-and-skills.md`, and `skill-picker-re.md` against retail
`SolomonDark.exe` SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

## Native hit and death ownership

`ActorDamageReaction 0x00627F80` arms Actor hit latches at `+0x78/+0x80`.
`Actor::Tick 0x00624AC0` subtracts exactly `0.05` per fixed tick, producing a
20-tick refreshed latch. `Actor::Render 0x00624B40` draws the exact current
body/action pose, then redraws it red at
`min(remaining * contextIntensity, 1)` under ordinary source-alpha blending.
The reaction is orthogonal to locomotion/action clocks. The web must therefore
replicate the authoritative remaining latch and use a red redraw; five-tick
decay, additive white, a substituted pose, or an action restart are rejected.

Death removes the live body and creates independent, registered effect actors.
Their identity, art, transforms, physics, clocks, blend, optional shadow, and
retirement are world state. The host selects all cosmetic RNG and clients
interpolate samples without rerolling or replaying on late join. Exact family
recipes are:

- Skeleton/Archer/Mage: normal nine-record shuffled BadGuys fragment sequence
  `113,115,118,121,120,119,116,117,117`, or the recovered Enhanced Effects
  sequence `113,113,113,115,118,121,120,119,116,121,120,119,116,117,117,117,117,117`;
  one random skull `1819..1822`; record-86 Unbind at `y-15`; exact
  body/weapon/headgear extras; `0.1` shake; and registry entry 79
  `skeleton_die` at pitch `[0.8,1.0)`. Instruction `0x0048D368` adds object
  offset `+0xDAC`; adjacent entry 80 `skellyscream` is `+0xDD8` and is not
  called.
- Imp: record-86 Unbind plus Banish/ZAnim and BadGuys `401..419` SpriteArray;
  exact binary split remains an authoritative enemy-child path, not debris. A
  permitted split plays `ImpSplit` at `[0.9,1.1)`; the ordinary branch plays
  `fireydeath` at `[0.8,1.0)`.
- Zombie: branch-selected fragment bouncers, record-86 Unbind, clipped
  DeadHawg-30 perspective fade, and the rotten PoisonPool actor when active.
  Rotten death plays three poison splats at `[0.9,1.05)`, then `zombiedie`
  and `zombie_die_groan` at `[0.8,1.0)`.
- Wraith: Bouncer/SmokyBouncer fragments `113..121`, random skull
  `1819..1822`, record-86 Unbind, plus the shared 12-ray MoveFade / FadeScale /
  12-Bouncer dissolve helper. Its fixed flash precedes three `bansheedie`
  calls: two at `[0.9,1.1)` and one at `[0.8,1.2)`.
- Demon: Banish wrapped by ZAnim plus BadGuys `401..419` SpriteArray; configured
  Imp children remain separate actors. Native death state 95 plays `flash`
  and `demondies`; the terminal split helper also plays `fireydeath` at
  `[0.8,1.0)`.
- Coffin: ground debris, common bone/skull output, `40..50` bouncers from
  BadGuys `2013..2062`, `12..16` additional coffin fragments including
  DeadHawg `114..144` / BadGuys `2067..2069`, record-86 Unbind, and
  `coffinbreak` at `[1.0,1.1)`.
- Maggot: one `2013..2062` Bouncer and tinted DeadHawg-28 Fade_Perspective at
  the current position and at zero to two registration-time burst offsets.
  Each offset has a random direction and radius `[0,30)`; they are not movement
  history. Death independently selects one of three Squish cues and one of two
  Maggot squeaks, both at `[1.0,1.2)`, followed by parent accounting.

The Website has no settings owner and keeps the recovered shipped-default
Enhanced Effects policy enabled. Every ordinary death Bouncer therefore uses
the native timer `10`, black shadow copy at `y+2` with Y scale `0.75`, and
alpha decrement `0.015`; the Skeleton pike fragment exception retains timer
`1.5` while still receiving the shadow. Bouncer's 50-percent horizontal
damping decision is a fresh authoritative RNG draw on every ground contact,
not a construction-time Boolean.

The Unbind star is damage-component-sensitive. Lethal secondary damage sets
Actor bit `+0x9C & 2`; the current Website spell/contact lane stages primary
damage only and therefore uses the exact primary-only clocks: Skeleton family
`alpha .75/loss .0225`, Imp `1/.025`, Zombie `.75/.05`, Wraith `1/.025`, and
Coffin `.75/.045`. The recovered secondary-present branch starts each at
`1.25`; it remains a fail-closed future producer requirement rather than an
invented web damage channel.

Skeleton `Anim_Bouncer` physics and `Anim_Unbind` are exact. Where the native
numeric physics for Banish, SpriteArray, MoveFade, SmokyBouncer, and auxiliary
Coffin/Maggot branches remains open, the Website may use named deterministic
class clocks. It must retain the recovered art, fan-out, blend family,
independent actor ownership, stable IDs, and terminal retirement; it may not
fall back to the dying enemy's body strip. Terminal sounds are once-only
run-scoped semantic events, separate from persistent effect samples.

Those sounds remain positional after replication. Let `W` be the current
visible world width, `C` the semantic camera-rectangle center, and `d` the
distance from `C` to the authoritative death point. Native Region point gain
is one through `0.25W`, falls linearly to zero at `1.1W`, and is zero beyond;
there is no pan. During the local Player's alternate/death presentation the
whole result is multiplied by `0.1`. Any event-specific scalar, including the
Maggot squeak multiplier, multiplies that spatial result.

The Skeleton-family `0.1` and Coffin `0.2` feedback calls use the same
Region-owned presentation lane. The constructor starts magnitude/accumulator
at zero. Each normal fixed tick establishes a `0.1` accumulator floor. An
impulse writes `magnitude = min(accumulator, 1) * intensity`, adds
`0.20000000298023224` to the accumulator capped at `3.5`, then later ticks
subtract `0.0025` from that accumulator and multiply magnitude by `0.94`,
zeroing magnitude below `0.001`. Arena render applies uniform XY scale
`1 + magnitude` around the local Player after semantic camera placement. The
Website must consume the once-only terminal event into that local presentation
state; it must not move authority, randomize the camera, or replay the pulse on
late join.

## XP authority and the HUD

The Boneyard award pipeline is float-valued. The Website enemy config stores
the family baseline *after* the native recipe-to-actor `*2` conversion
(Skeleton `10`, Imp `2`, Wraith `4`), so that conversion must not be applied a
second time at death:

```text
evaluatedRecipeXP = nativeRecipeXP * Arena.xpRecipeScalar
nativeFamilyBaseline = 2 * (evaluatedRecipeXP + runtimeBonusXP)
actorReward = nativeFamilyBaseline * arenaPlayerCount * Gameplay.xpScalar
credited = actorReward * survivalLevelFactor(receiverLevel)
                       * (1 + receiverXpBonus)
```

Retail Boneyard `Arena.xpRecipeScalar` is `0.425`; its one-player witnesses are
Skeleton `10 -> 4.25`, Imp `2 -> 0.85`, and Wraith `4 -> 1.70`. Survival level
factors are level 1 `1`; 2..5 `0.9`; 6..15 `0.72`; 16..30 `0.504`; and 31+
`0.3024`. The actor-private XP bonus is additive before that multiplication.
The Website keeps `Gameplay.xpScalar=1` until an implemented timeline action
1090 changes it. Cumulative XP and protocol fields accept finite nonnegative
fractions; level thresholds remain the exact native integer table and the edge
remains strict `experience > threshold`. The existing UI-81 fill/UI-82 frame
continues to use `(XP-lower)/(upper-lower)` and must update from each
authoritative snapshot rather than a seed.

Crossing a threshold dispatches registry entry 52 `sounds\levelup` once at
scalar `1.0` through `0x0067C250 -> 0x005C88B0 -> 0x00528A20`. The former
two-request attribution was wrong: calls `0x00647F6B/0x00647FBE`, at pitches
2 and 3, are owned by skill 77 Turn Undead's only caller `0x00647EF0`.
Entry 53 `levelupskill` is only loaded; no retail dispatch was found. Each
client must therefore play the untouched entry-52 WAV once per shared
threshold barrier, not once per queued private offer or snapshot.

Death credit remains owned by the player whose accepted damage most recently
stamped the actor. The Arena player-count multiplier uses the current eligible
run cohort; it does not split the credited result among participants.

## Host-authored shared picker barrier

When any eligible participant crosses one or more level thresholds, the host
freezes a fixed cohort of the currently connected eligible run participants.
It synchronizes that milestone level/XP into each participant's own progression
and rolls a private offer against that participant's own rank book and offer
seed. Books, chosen ranks, HP, and MP remain actor-private. The triggering
native actor receives its ordinary threshold refill; synchronized peers retain
their live HP/MP while adopting the shared milestone. Each participant must
resolve all offers queued by that milestone.

While the barrier is active, simulation time does not advance: player
locomotion/casts, enemies, projectiles, poison/status clocks, pickups, effects,
Solomon, waves, and run/death clocks all remain unchanged. Transport, snapshot
delivery, and picker commands continue. Input observed inside the barrier is
dropped, not replayed after release. A resolved participant sees a blocking
waiting overlay until the remaining cohort resolves. A disconnect removes
that participant from the cohort; a late join observes the barrier but is not
retroactively inserted into the frozen cohort. Unlike the Loader's operational
60-second auto-pick fallback, this Website product contract has no timeout:
gameplay resumes only after every remaining cohort member has picked.

Required acceptance is a two-client real flow showing fractional XP meter
movement, a shared threshold edge, two independent option sets, unchanged
world/player/projectile/effect ticks and transforms while one player waits,
input discarded across the pause, waiting UI after the first choice, and the
same next simulation tick resuming only after the final choice. Enemy effect
acceptance requires a real damage hit with the 20-tick red curve and a real
terminal edge whose replicated debris survives actor retirement, renders on a
second client, retires once, and does not replay for a late subscriber.

The resident enemy atlas selection must include every record reachable through
those independent effects. In particular, the Wraith dissolve selects both
BadGuys records 10 and 11; record 11 was previously present in the stock atlas
but absent from the Website preload glob. Focused asset coverage enumerates the
complete death-effect record union rather than expecting terminal debris from
the retired living-enemy pose planner.

## Website implementation and browser receipt

The completed Website lane uses protocol 21 and replicated entity type 5 for
independent death-effect actors. The living enemy sample carries the refreshed
20-tick hit latch; the renderer redraws the current pose red under normal
alpha blending. Terminal handling retires the enemy body immediately, creates
the family effect actors with host-selected IDs/RNG, publishes positional
once-only audio, and feeds the recovered Region feedback accumulator. XP is a
finite float through store, snapshot, protocol, HUD, and strict native
threshold comparison. A host-authored barrier freezes the complete simulation
while private offers and transport remain live. `BoneyardScene` now retains
its run-initial snapshot just as `HubScene` does, so barrier snapshot changes
do not destroy/reload the resident WebGL renderer or discard effect actors.

The decisive post-rebase two-client Chromium 150 flow ran on 2026-08-15 with
`tools/smoke-multiplayer-combat-lifecycle.mjs --feature-only` and exited zero
with empty page/console error arrays. It used ordinary keyboard/mouse combat
after the physical gate and Solomon proximity sequence. Its supported resident
Web Audio probe observed the actual decoded buffer starts rather than only
manifest declarations. The receipt pinned:

- a nonterminal Air contact on actor 11, health `2.5 -> 1.900390625`, with a
  replicated positive native hit latch (`hitFlash=0.4954999999701613`);
- Fire terminal ownership on actor 10 and 20 independent Skeleton effect
  actors, including the record-86 Unbind and Enhanced Effects skull variant;
- shared XP `89 -> 106`, level 2, HUD fill `98.88888888888889% ->
  22.857142857142858%`, and distinct offers host `[18,21,65]` versus guest
  `[48,27,67]`;
- an unchanged authoritative world at frozen tick `19068` after the host
  selected and attempted movement/casting, followed by the exact first resumed
  tick `19069` only after the guest selected;
- the then-current Website baseline started the level-up WAV at pitch
  multipliers `2,3` on both clients. Later instruction/xref closure proved
  that pair belongs to Turn Undead, so this remains a useful pre-correction
  browser receipt rather than a native-parity expectation. The same receipt
  also observed the Skeleton death WAV, effect aging after release, and
  eventual retirement on both independent 20 Hz presentation timelines.

Visual receipts are
`/tmp/solomon-dark-hit-death-xp-post-rebase-final3.7rBOCS/solomon-dark-multiplayer-enemy-hit.png`
(SHA-256 `d31cd1696491c75515e54ee3fc46bb4c98cdbb1450401a2eed169018b0b917e0`),
`.../solomon-dark-multiplayer-level-up.png`
(`67d1ee5dcc2ba258ba5150ac9897c51134b7c5be9e008a44656b45a048dc789a`),
and `.../solomon-dark-multiplayer-level-up-waiting.png`
(`51b7b2eefa20579c55e4e2d9cff179129a19b5637462cf949454293da2f7f2bb`).

## 2026-09-01 - Protocol-115 enemy-feedback float32 boundary reopening

### Reported smell and causal evidence

- Production diagnostic row 102, captured at `2026-09-01T01:29:09.061Z`
  from browser protocol 115, rejected
  `frame.world.enemyWorldFeedback exceeds the native enemy-feedback bounds`
  and closed the otherwise healthy private session with code 4008.
- The retained production schema-27 continuation had 27 valid enemies and a
  legal feedback accumulator of `3.339996337890625`. On the exact current
  `419699d10457a22897cdb3fdb8bb7938c5141117` Mac tree, that save restored,
  keyframed, encoded, and decoded cleanly before the terminal pulse.
- The shared authoritative kernel computes a Coffin, Demon, or Portal pulse
  as `Math.fround(min(accumulator, 1) * 0.2)`. At accumulator one this is
  exactly `0.20000000298023224`, while the protocol decoder compared against
  the double-precision decimal literal `0.2`. The host produced the former
  and the client rejected it solely because it is greater than the latter.
- A Mac reproduction passed the production save through
  `restoreGameSaveDocument -> createGameSnapshot -> createGameSnapshotFrame
  -> encodeGameMessage -> decodeServerGameMessage`; replacing only the
  feedback state with the real Coffin pulse reproduced the exact row-102
  error deterministically.

### Reopened system boundary and complete membership

Native system: terminal enemy output through the Region-owned feedback
accumulator, fixed-tick decay, full/keyframe and compact/delta transport,
local presentation, save/rejoin, and teardown.

| Member | Native value / owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Skeleton, Archer, Mage shatter | intensity `0.1` | `verified-already-at-parity` | exact pulse and full/compact decode |
| Imp split with children | intensity `0.05` | `verified-already-at-parity` | exact branch and decode |
| terminal Imp, Zombie collapse | intensity `0.1` | `verified-already-at-parity` | exact pulse and decode |
| Wraith fragments | two ordered `0.1` impulses | `verified-already-at-parity` | both requests, final state, and decode |
| Coffin break | intensity `0.2` -> float32 magnitude `0.20000000298023224` | `exact-ported` decoder boundary | exact maximum accepted; greater value rejected |
| Demon split | same exact maximum | `exact-ported` decoder boundary | exact maximum accepted; greater value rejected |
| Portal break | same exact maximum | `exact-ported` decoder boundary | exact maximum accepted; greater value rejected |
| accumulator floor/loss/impulse/cap | `0.1`, `0.0025`, `0.20000000298023224`, `3.5` | `verified-already-at-parity` | long decay and cap assertions |
| magnitude retention/cutoff | `0.94`, `0.001` | `verified-already-at-parity` | fixed-tick decay and zero crossing |
| authoritative Boneyard producer | terminal retirement observer | `verified-already-at-parity` | current all-family producer tests |
| full snapshot and compact frame | one shared decoder | `exact-ported` boundary correction | keyframe and delta accept the exact native maximum |
| player, observer, welcome, resume, baseline recovery | shared snapshot owners | `exact-ported` through the same predicate | each transport path cannot retain the old decimal cap |
| save/rejoin and renderer-local feedback | persisted kernel state and `NativeEnemyWorldFeedbackPresentation` | `verified-already-at-parity` | retained production save plus presentation contracts |
| Hub and nonterminal enemy state | no terminal Region feedback producer | `out-of-system` | zero-state negative assertion |

No member is browser-blocked. The browser and JSON number lanes represent the
exact float32 value. The fix gives the kernel table one named magnitude cap
and makes protocol admission consume that value instead of a second decimal
approximation. Protocol 116 separates clients carrying the corrected
contract. No producer, camera transform, event order, save field, or renderer
formula changes.

### Validation contract

- Pin the exact maximum for Coffin, Demon, and Portal and retain every lower
  terminal family. Accept the maximum through a real keyframe decoder and
  reject the next representable excess.
- Repeat the retained production-save control and injected terminal-pulse
  differential on the exact Mac candidate.
- Run the canonical Mac Website gate and a built Chrome Boneyard terminal
  journey with empty page, console, response, wire, and host-error arrays.
- Final validation, publication, and cleanup receipts are appended after the
  exact candidate is proven.

### Implementation validation receipt

- `NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeCap` now owns the exact float32
  maximum `0.20000000298023224`. The full/keyframe and compact/delta decoder
  consumes the shared accumulator and magnitude caps; no producer or
  presentation formula changed. The exact-match protocol is 116.
- Focused Mac tests passed all 74 kernel, protocol, and save-document tests.
  The exact production schema-27 continuation restored 27 live enemies and
  decoded as a control; its injected real terminal pulse also decoded after
  reproducing the row-102 error on untouched main.
- The complete Mac gate job `job_20260901T132528Z_9fb2e10557` exited zero
  through backend build and 19 integration contracts, every frontend/host/
  desktop suite, TypeScript, lint/boundaries, optimized frontend and GameHost
  builds, bundle budget, media policy, and CSP. Production entry
  `Game-B5ot6qwA.js` measured 263,721 raw / 80,244 gzip bytes. The combined
  pre-receipt log SHA-256 is
  `a63c34bbba342699079ef84dec72f26264ddbd5c6acf2914d228bbd5a41347f6`.
- Built Mac Chrome/WebGL2 ran the optimized Portal journey under protocol
  116. It emitted the terminal Portal audio family, 36 semantic events, 128
  descriptor retirements, one connected socket, and zero page, response, or
  wire errors. Visual inspection found the live Arena/Portal frame coherent;
  its PNG SHA-256 is
  `cc3696ec13a184dd6cd8350073b45e29609b17538b35d4dffd99556cd1f7f7c2`
  and the compact browser log SHA-256 is
  `5ce69b9a9e3c2ba8d2fd2933aa4616e505a28ff41f7e54d179d48b07e628dd42`.
- No browser-platform exception or material unknown remains. This receipt is
  the only tracked change after the cited gate; the complete gate and built
  journeys are repeated on the receipt-bearing tree before publication.
