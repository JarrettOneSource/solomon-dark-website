# 2026-08-14 — Primary-cast facing ownership

## Reported smell and parity question

- Reported web behavior: a player can cast toward the pointer while the robe
  and staff face a different direction, most visibly after a short Ether or
  Fire click while movement remains held.
- Stock behavior to recover: identify which native lane owns wizard heading
  from cast acceptance through projectile birth or channel release, and when
  locomotion may own heading again.
- Reproduction inputs/scenes: press left click toward one cardinal direction,
  release immediately, and continue moving toward a different cardinal
  direction through the one-shot emission marker; repeat while holding each
  sustained primary.
- Falsifiers: locomotion heading legitimately replaces cast heading before a
  one-shot projectile is born; robe facing is a renderer-only transform; or
  each element owns an unrelated heading rule.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Preserved retail binary | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same retail image as the primary-spell and animation goldens. | high |
| Fresh instructions/decompilation | 2026-08-14 read-only Ghidra replica slot 2, `/SolomonDark.exe`, `PlayerActor::Tick` `0x00548B00` | `0x0052C910` supplies separate movement and facing vectors. `0x0042D280` first derives a movement heading and then, when attack-facing exists, derives and writes the facing heading second. Both writes target actor `+0x6C`. The whole lane is gated by animation-drive byte `+0x160 == 0`. | high |
| Durable native adjacency | `native-input-model.md`, `native-animation-state.md`, `native-projectile-and-spell-mechanics.md`, and `spell-cast-cleanup-chain.md` | Target-facing beats locomotion; Staff Cast 1 stays queued after input release; staff art and cast socket both select their 24-way record from actor heading; Fire reads actor `+0x6C` at projectile allocation. | high |
| Current web trace | `stepHubWorldTick`/`stepBoneyardWorldTick` -> `finishGameSimulationTick` -> `stepPrimarySpells` | Movement commits heading first. The spell kernel reapplies aim-facing only while `rawHeld` (or the old Earth hold special case) is true, so a released one-shot action loses facing ownership before Ether/Fire marker updates `14/18`. | high |

The native evidence is static retail evidence. Loader-authored remote-cast
playback is used only as an adjacency check: it independently preserves live
cast heading until Fire projectile birth because Fire initialization reads the
same stock actor field.

## Native ownership thread

- Owner and construction path: the player fixed tick owns heading. The control
  brain produces independent movement and facing vectors; no renderer or spell
  actor writes wizard presentation facing.
- Upstream state producers/callers: keyboard movement supplies the locomotion
  vector. World-surface aim supplies the facing vector from the torso-anchored
  pointer direction. `PlayerActor::Tick` consumes both at 100 Hz.
- State representation and transitions: actor heading is float field `+0x6C`.
  With no active presentation action, movement may write it, then a nonzero
  facing vector overwrites it in the same tick. Once Staff Cast 1 or the
  renewed Staff Constant action sets animation drive `+0x160`, subsequent
  locomotion ticks cannot replace that cast heading. Heading returns to normal
  locomotion ownership when the cast action/channel releases.
- Downstream consumers/callees: wizard robe composition, staff orientation,
  and cast-emitter facing quantize `+0x6C` into 24 directions. Fire additionally
  samples `+0x6C` when it initializes velocity; a born projectile is not
  steered by later actor heading.
- Sibling systems sharing ownership or data: Ether and Fire share Staff Cast 1;
  Air, Water, and Earth renew Staff Constant while held. Movement can continue
  during a queued cast, but it does not cancel the action or win visual facing.
- Entry, interruption, reset, and teardown: accepted press captures cast aim.
  Sustained primaries may refresh it from live held aim. Release stops Air and
  Water, Earth retains its last cast heading through its minimum-charge latch,
  and one-shot facing stays captured through the queued action. Death/scene
  reset clears the existing primary-cast state and therefore the ownership.

## Recovered behavioral contract

- Timing/ticks/thresholds: cast-facing changes only on the authoritative 100 Hz
  tick. Ether keeps its accepted heading through marker update 14 and
  next-ready update 55; Fire uses marker 18 and next-ready 73. Air/Water/Earth
  own facing for their renewed constant-action channel lifetime.
- Geometry/transforms/coordinate spaces: aim remains the normalized vector from
  the world cursor to the player torso anchor `(0,-25/viewScale)`. Heading is
  clockwise from screen-up and the existing wizard 24-way quantizer owns the
  rendered facing.
- Render/order: the renderer samples replicated heading; it must not rotate the
  robe or staff independently to conceal an authoritative-state mismatch.
- Input/network authority/replication: the host derives and stores heading.
  Snapshots replicate that same heading to local and remote presentation.
  Clients do not reconstruct cast-facing from transient VFX.
- Boundary behavior: moving opposite the cast may still move the player, but
  cannot turn the player during the active cast-facing interval. After the
  action ends, the next eligible movement tick may turn the player normally.

## Nearby-system findings

- Durable finding: Fire projectile direction and wizard cast presentation share
  actor heading until birth; preserving only the projectile vector would still
  leave the robe/staff visibly wrong.
- Evidence: Fire handler `0x0053DC60`, direction helper `0x00410500`, and
  `Fireball +0x13C/+0x140` initialization documented in
  `spell-cast-cleanup-chain.md`.
- Why it matters later: any future action that samples actor heading at a marker
  needs the same action-level facing priority rather than an element-local
  renderer adjustment.
- Native report also updated: `native-projectile-and-spell-mechanics.md`.

## Confidence and open questions

- Confirmed: fixed-tick owner, separate movement/facing lanes, attack-facing
  priority, animation-drive guard, shared robe/staff/socket heading, Fire birth
  dependency, and one-shot action lifetime.
- Inferred: the browser's stored cast aim is the clean representation of the
  heading retained by the native action after physical button release.
- Unknown: none material to this facing correction. Exact action interruption
  by future death/combat state remains outside the current web combat slice and
  must enter through the existing primary-cast reset seam.

## Web implementation consequence

- Correct owner/module: `core-kernels/primary-spells.ts`, after world movement
  resolves and before authoritative snapshot publication.
- Shared model change: distinguish live aim sampling from cast-facing
  ownership. One-shot primaries capture aim on accepted press and keep that
  heading for the queued action; sustained primaries refresh while physically
  held and otherwise retain their last cast direction until release.
- Stock behavior preserved: movement continues, but cannot overwrite cast
  facing; robe, staff, socket, VFX origin, and Fire direction read one state.
- Local prediction is part of that replicated-heading path. On an active cast
  snapshot, reconciliation must accept the authoritative heading instead of
  applying the ordinary locomotion "do not rewind a presented turn" rule;
  subsequent predicted movement ticks must preserve that cast-owned heading.
  The integrated WebGL receipt exposed this boundary as Ether wire heading `8`
  versus rendered heading `12` before the correction. This remains replication
  of actor heading, not client reconstruction from a spell transient.
- Symptom patch to avoid: no Pixi rotation, CSS transform, element exception,
  or client-only facing override.

## Validation contract

- Focused automated test: short-click Ether/Fire toward one direction, move in
  another through their insertion-relative marker updates `14/18`, and prove
  heading plus emitted velocity stay aligned with the accepted cast; prove
  locomotion regains heading after next-ready updates `55/73`.
- Existing regression: held Air/Water/Earth with conflicting movement continues
  to face live cast aim and release cleanly.
- Browser journey: cast at visibly separated cardinal directions in Hub and
  Boneyard and inspect robe/staff/VFX alignment for local and replicated actors.
- Measurable acceptance: heading index equals the cast vector's native 24-way
  index throughout the owning interval, with no pre-emission movement turn.
  The receipt derives that vector from the owning player's replicated
  `primaryCast.aimDirection`, not a child VFX direction: native Water particles
  intentionally add Frost Jet wiggle and radial spread after facing is chosen.
