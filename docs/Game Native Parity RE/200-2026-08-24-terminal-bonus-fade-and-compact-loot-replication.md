# 2026-08-24 — Terminal Bonus fade and compact loot replication

## Reported smell and parity question

- Reported web behavior: an established production `/game` connection entered
  the fatal connection-report surface with `Boneyard loot descriptor and sample
  are inconsistent`; submitted diagnostic
  `58611f9f-1ddd-4e38-9f84-f4213b6275b1` records the failure at
  `2026-08-24T19:35:42Z` on protocol 72.
- The wording suggests a stale static descriptor, but the parity question is
  broader: can every legal authoritative state of all four ground-loot
  families cross both the full-snapshot and compact descriptor/sample wire for
  its complete lifetime, including float32 terminal states and retirement?
- Stock behavior to preserve: an untouched Bonus stays fully opaque for its
  1,200-tick countdown, receives 101 float32 `0.01` fade updates, and retires on
  actor update 1300. Gold and Sack persist until pickup/teardown; Orb owns its
  separate delayed value decay.
- Falsifiers: no positive float32 residue before Bonus retirement; the web host
  retiring the actor one update early; the full snapshot using the same lossy
  alpha encoding; a descriptor-cache replacement failure; or another legal
  Gold/Orb/Sack field combination failing the same boundary.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Submitted production diagnostic | private report `58611f9f-1ddd-4e38-9f84-f4213b6275b1`; Chrome 151 on Windows; deployed Website `b5c8d429650b2433c9c48496e56314bd27299690`; protocol 72 | The client failed inside compact entity reconstruction and closed itself with code 4008. The host stayed active with zero restarts. | high-live |
| Production runtime outbox | run `348b929f6b0887c543406b56d077a04e`; Random Boneyard; player disconnect server tick `779041` | Failure occurred four seconds into wave 17 after 780+ recorded kills; it was a client reconstruction failure, not a simulation tick failure or service restart. | high-live |
| Read-only SQLite WAL recovery | private cloud-save revisions 148/149, last at `2026-08-24T19:35:23Z`, simulation tick `777067` | The affected run had loot allocator `nextActorId=133`, so the 1..2047 allocator had not wrapped. Every retained Gold/Sack row in the last pre-failure checkpoint satisfied the current descriptor/sample rules. | high-live |
| Existing native report | `Mod Loader/docs/reverse-engineering/native-loot-selector.md`; Bonus tick `0x006039C0` | Bonus countdown is 1200; float32 alpha loses `0.009999999776482582`; residue requires 101 fade updates and retirement occurs on update 1300 for all kinds 0/1/2. | high |
| Current authoritative web owner | `core-server/boneyard-loot-store.ts:stepBonus` | The host mirrors the native countdown, float32 subtraction, positive-residue frame, and following retirement exactly. | high |
| Required Mac arithmetic | macOS Node 22.17.0, exact `Math.fround` loop | Fade updates 98/99/100/101 produce `0.0200006701`, `0.0100006703`, `6.705522537231445e-7`, and `-0.0099993292`; the update-100 residue is positive but `Math.round(alpha*1024) === 0`. | high |
| Current wire trace | `game-snapshot.ts`, `boneyard-loot-replication.ts`, `entity-replication.ts`, `game-protocol.ts` | Full snapshots retain the positive float. Compact samples quantize alpha at 1/1024, then `descriptorMatchesSample` incorrectly requires quantized Bonus alpha to remain strictly positive and throws a regular fatal error. | high |

The existing Mod Loader loot reports already own the complete retail
constructor, lifetime, render, pickup, and teardown facts. This investigation
recovers no new native fact, so no duplicate Mod Loader report change is
required.

## System boundary and membership inventory

Native/web system: authoritative ground-loot construction and lifetime through
full welcome/resume projection, compact keyframe/delta reconstruction,
presentation, pickup, retirement, world replacement, and teardown.

| Member | Native/web owner | Disposition | Proof |
| --- | --- | --- | --- |
| Bonus kinds 0/1/2, full-alpha countdown | `0x005E2D90/0x006039C0`; `stepBonus` | verified-already-at-parity | all kinds retain alpha one through the 1,200-countdown boundary |
| Bonus fade updates 1..99 | same tick owner | verified-already-at-parity | exact float32 values remain representable as positive compact alpha |
| Bonus fade update 100 positive residue | same owner; compact sample alpha index 5 | exact-ported at the web wire boundary in this closure | legal positive host state reconstructs without weakening full-snapshot authority or changing lifetime |
| Bonus fade update 101 retirement | same owner; entity retired lane | verified-already-at-parity; coverage expanded | actor disappears on native update 1300 and compact reconstruction deletes its descriptor |
| Bonus pickup before terminal fade | strict radius 20 path | verified-already-at-parity | accepted pickup still retires immediately; no terminal actor remains |
| Gold tiers 0/1/2/3, scatter/settled persistence | `0x005E66B0`; loot descriptor/sample | verified-already-at-parity | amount-derived tier, alpha zero, scatter through 8.5, indefinite retained rows |
| Health/mana Orb pull, decay, and retirement | `0x005E62E0`; loot descriptor/sample | verified-already-at-parity | both kinds retain dynamic alpha/value/phase and retire at value exhaustion/pickup |
| Potion, equipment, key, nested, and mod-content Sacks | `0x005E6B50`; loot descriptor/sample | verified-already-at-parity | all item identities retain bounce and full/compact round trips |
| Enemy, Goodie, and script source variants | native selector/materializers and authored actions | verified-already-at-parity | source is immutable descriptor state and does not affect the lossy alpha lane |
| Full welcome/resume snapshot | `game-snapshot.ts` plus `boneyardLootSnapshot` | verified-already-at-parity | the positive float32 residue remains positive and strictly validates |
| Compact keyframe and ACK-baselined delta | `createGameSnapshotFrame`/`EntityReplicationReconstructor` | exact-ported for the terminal residue | both forms accept the one representable zero-alpha sample for a still-live Bonus |
| Cross-kind/malformed descriptor and sample rejection | strict protocol boundary | verified-already-at-parity | wrong Gold tier/amount and illegal family fields remain rejected |
| Renderer at sub-quantum alpha | `native-loot-view.ts`/`native-loot-presentation.ts` | web-adapted quantized presentation | the final positive alpha is below one compact unit and may materialize as zero for one update; no visible stock difference is predicted |
| Run replacement, pickup, Game Over, Hub return, disconnect | world/replication owners | verified-already-at-parity | no actor or descriptor survives its owning run/world |

No member is blocked by the browser platform. Compact fixed-point alpha cannot
represent the exact positive residue, but zero is its correct nearest wire
sample and is visibly indistinguishable; authoritative lifetime remains exact.

## Native ownership thread

- Bonus construction chooses one of kinds 0/1/2 and initializes alpha one plus
  the 1,200 countdown. `0x006039C0` owns the countdown, float32 fade, pickup,
  and retirement; the renderer only consumes the current alpha.
- The web `stepBonus` owner reproduces that state transition. Snapshot
  projection sends the raw legal float in a welcome and a 1/1024 sample in the
  compact entity lane.
- The static descriptor owns kind and identity; the sample owns alpha. At fade
  update 100 those two records are not semantically inconsistent: the sample
  is the nearest representable encoding of a still-positive authoritative
  alpha. The current cross-field predicate mistakes quantization loss for a
  family mismatch.
- On the next actor update the host retires the Bonus. Delta reconstruction
  consumes the ordinary retired key and removes the cached descriptor. Pickup,
  world replacement, and disconnect retain their existing earlier teardown
  paths.

## Recovered behavioral contract

- Preserve all 1,300 native Bonus actor updates. Do not clamp or retire the
  authoritative actor early to satisfy a presentation codec.
- Full snapshots continue to reject a truly nonpositive live Bonus alpha. The
  compact matcher must admit zero only as the quantized image of the legal
  positive terminal state; every other Bonus family invariant remains strict.
- Gold, Orb, and Sack predicates are unchanged. Descriptor identity and
  malformed shape checks remain fail-closed.
- A continuously connected client, a late join/full welcome, a compact
  keyframe, and an ACK-baselined delta must all traverse the terminal Bonus
  frame and the following retirement without a runtime-error surface.

## Nearby-system findings

- `materializeBoneyardLoot` throws ordinary `Error` for a cross-field mismatch,
  so the client treats this deterministic legal state as fatal rather than as
  a recoverable replication gap. Changing the error class would only hide and
  retry the invalid predicate; the correct owner is the compact family matcher.
- The production allocator was at 133, decisively falsifying an ID-wrap/stale
  descriptor hypothesis for this report.
- The native loot report already records the exact float residue and all four
  family lifetimes; no native document or catalog update is warranted.

## Confidence and open questions

- Confirmed: production failure path and health, pre-failure run/allocator
  state, exact native Bonus lifetime, exact Mac float32 residue, full versus
  compact ownership, and the deterministic failing predicate.
- Inferred but not required for the fix: the production Bonus birth was about
  13 seconds before the fatal frame. Client diagnostics do not retain raw
  entity arrays, so that individual actor ID is unavailable after run teardown.
- No material unknown remains in the system boundary and no platform-blocked
  member exists.

## Web implementation consequence

- Correct only `boneyard-loot-replication.ts`'s compact cross-field predicate:
  quantized alpha zero is legal for a Bonus sample, while full-snapshot and
  authoritative state validation stay strictly positive.
- Add lifecycle-derived regression coverage rather than a hand-authored zero
  sample alone: all three Bonus kinds must reach the float residue through the
  real store, cross full and compact forms, then retire on the next update.
- Retain the Gold/Orb/Sack rejection matrix and add explicit sibling round-trip
  assertions so a broad relaxation cannot enter unnoticed.

## Validation contract

- On untouched `b5c8d429`, construct each Bonus kind through the real loot
  store, advance to native update 1299, prove alpha
  `6.705522537231445e-7`, and reproduce the compact fatal mismatch.
- After the fix, round-trip that update through a keyframe and an
  ACK-baselined delta, then prove update 1300 emits retirement. Exercise a full
  snapshot at the same positive residue and all three kind rows.
- Retain explicit valid and malformed Gold, health/mana Orb, and every Sack
  identity-family contract. Run the complete Mac canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.
- In built Mac Chrome/WebGL, run an uncollected Bonus through terminal fade in
  a task-owned Boneyard and require continued connection, one ordinary actor
  retirement, and empty page, console, failed-response, runtime-error, and
  structured host-error arrays.

## Implementation validation receipt

- `boneyard-loot-replication.ts` now treats compact alpha zero as the legal
  nearest 1/1024 sample for a live Bonus. The authoritative store and full
  snapshot remain strictly positive, all other Bonus fields remain strict, and
  Gold/Orb/Sack predicates are unchanged. Implementation commit is
  `7a478d9fac3462950eca9fdbeae2eb8a9eb0f0bf` on current-main base
  `a390c357f6ce122de487922710e1fe6bf4eaa281`.
- The regression was run red on untouched deployed base `b5c8d429`: the real
  store reached alpha `6.705522537231445e-7`, compact alpha became zero, and
  reconstruction threw the exact production error. Red-log SHA-256 is
  `08c401fe8dc47c6f5242bd796ebf71ee5e5d6d145ef4e18dbd1b4b3fe269370a`.
- Final coverage lives beside the existing authoritative 1,300-update lifetime
  test in `boneyard-loot-store.test.ts`. It proves the exact update-1299
  residue, zero compact sample, successful reconstruction for Bonus kinds
  0/1/2, and update-1300 retirement while retained Gold/Sack siblings remain.
  The sequential loot group passed `45/45`; the current Acid Rain-integrated
  broad Boneyard group passed `1495/1495` with the unchanged Game Over,
  supervisor, Lua, and entity-replication suites.
- The manifest-identical detached Mac candidate passed the complete canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build and 22
  integration contracts; formatting, lint, and import boundaries; every
  frontend/desktop group; production frontend and GameHost builds; media
  policy; and bundle budget. Final `Game-D06tixt1.js` is 460,880 raw bytes and
  129,101 gzip bytes against 524,288/131,072 limits. Gate-log SHA-256 is
  `f4dc71b8e7fd61ce5e6093e761d0650de59a91614d5e5d2dad500b75a8261c71`.
- Built Mac Chrome/WebGL2 ran the expanded two-client loot journey at 100
  snapshots per second. Uncollected Bonus actor 8 crossed every compact sample
  and retired normally after 1,302 observed host ticks; both host and guest
  remained in ready Boneyard scenes. Gold, three Sack payloads, health/mana
  Orbs, Damage x4, pickup contention, audio, bitmap messages, and effects also
  passed. Page, console, failed-response, and runtime-error arrays were empty.
  Browser-log SHA-256 is
  `74c80c8c2caffea59ea9cb0aa26077c1018cfc199a46134ffcf00882ad93cd3b`.
- The final visible/collected 1600x900 frames were inspected; they retain the
  complete loot family, native lighting/shadows, HUD, messages, and ordinary
  post-collection world with no error surface. Screenshot SHA-256 values are
  `2840367d805876a0f5d0beff946af7b3180e3b289dcd8095f76fc11a5a6acfa3`
  and `f80d398420c30dc8c0d546b659fc5ae35f16ce30bcd5c1cf39dca89afee5df3d`.
- No Mod Loader change was needed because its existing native loot report
  already owns the exact float residue and all family lifetimes. No member is
  browser-blocked and no material unknown remains. Publication and deployment
  were not authorized and were not performed.
