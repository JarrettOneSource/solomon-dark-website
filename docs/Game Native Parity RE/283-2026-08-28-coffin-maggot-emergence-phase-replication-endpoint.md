# 2026-08-28 — Coffin-Maggot emergence-phase replication endpoint

## Reported smell and parity question

- A second production incident, separate from the Blizzard transient above,
  closed both players on protocol 97 with code `4008`. The shared decoder
  rejected `frame.world.entities.samples[442]` at `2026-08-28T04:57:11Z` and,
  after both players rejoined, `samples[364]` at `04:57:49Z` as an invalid
  registered sample shape. The authoritative service remained alive.
- The recovered pre-incident autosave belongs to run
  `6d076cc8636e3d04532afd95fec78be1`, random Boneyard seed
  `d5554b73f7951996d00372d4c5fa21d3`, and tick `98,094`. The independent
  clients failed together on two distinct frames 38 seconds apart, which
  falsifies a permanently malformed descriptor and instead identifies a
  recurring dynamic endpoint.
- The 2026-08-27 Coffin/Maggot reopening already recovered Maggot construction
  at `0x0047E0F0`: a private inclusive `Float(5)` presentation phase, followed
  by `+0.25` and modulo-five advancement in `0x0048B2A0`. Equality at five is
  legal constructor state even though the next Maggot tick wraps it.
- Falsifiers: the rejected member is not a Maggot; the real constructor cannot
  produce a value that quantizes to five; accepting the endpoint admits values
  above the native maximum; or the recurrence depends on malformed save data,
  baseline loss, or a stale protocol rather than ordinary Coffin births.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production host/client evidence | NFO `chicago-quad36-h-10-m7b`; deployed Website `f8944a389c9a226ea20aef622279e38fa7158901`; protocol 97; `DiagnosticLogs` rows 61 through 64 | Both independent browsers reject the same sample index on each occurrence; reconnect succeeds before the second simultaneous rejection; the host records no process restart. | high-live |
| Recovered autosave evidence | SQLite `WebGameSaves` deleted-page recovery; Soggy tick `98,094`; run and seed above | The active Boneyard had run for roughly 100,000 ticks immediately before the incident. Its owner projection and static world are valid; the later Hub save overwrote the exact entity array. | medium-high forensic |
| Native Coffin/Maggot report | constructors `0x00479940/0x0047E0F0`, Coffin helper `0x00479C30`, Maggot tick `0x0048B2A0`, renderer `0x0049C190`; 2026-08-27 ledger | Every opening and charged Coffin birth gives the child a private inclusive `Float(5)` phase; live phase advancement wraps after adding `0.25`. | high |
| Current web causal trace | `spawnCoffinMaggots`, `projectBoneyardMaggots`, `boneyardMaggotSample`, and `BONEYARD_MAGGOT_ENTITY_REGISTRATION` at base `05f2232a87f3cb36bc01cec3296dd1b6afe6faa7` | Authority retains `drawUnit * 5`; projection preserves it; the codec rounds by 1,024; the decoder alone rejects the quantized endpoint with `< 5 * 1024`. | high |
| Deterministic constructor witness | Mac mini, real Coffin materializer, seed `maggot-replication-endpoint-6253` | Opening the actual Coffin constructs Maggot id 4 with phase `4.9995659198611975`; the real sample is type 4 and component 15 is exactly `5120`, which the current registration rejects. | high |

The witness does not require the exact lost production RNG words. Any native
phase at or above `4.99951171875` rounds to the same legal wire endpoint, and
the actual constructor reaches that interval without mutation.

## System boundary and membership inventory

Native system: **Coffin-owned Maggot construction phase from private native RNG
through authoritative birth, independent entity replication, presentation,
advancement, and teardown**.

| Member / branch | Native/web owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| hidden/rise/hold/open Coffin body | `0x00479940/0x004A2760`; `stepCoffin` | `verified-already-at-parity` for clocks/presentation only; spatial/hostile membership corrected by the 2026-08-30 section in entry 254 | body clocks and presentation are unchanged |
| three opening births | `0x00479C30`; opening branch | `exact-ported` wire endpoint | each child may carry the closed `Float(5)` endpoint |
| charged open-state births | same helper from state 3 | `exact-ported` wire endpoint | optional one/triple births use the identical constructor |
| edge/lid launch segments, position, heading, height, bounce | Maggot constructor | `verified-already-at-parity` | no geometry or RNG-order change |
| private emergence phase | `Float(5)` at `0x0047E0F0` | `exact-ported` decoder correction | quantized values `0..5120` are legal; `5121` remains corrupt |
| subsequent airborne advancement | `+0.25`, modulo five at `0x0048B2A0` | `verified-already-at-parity` | next tick wraps the endpoint naturally; no clamp or normalization at birth |
| crawl, bite, hit, death, parent loss, admission | existing Maggot lifecycle | `verified-already-at-parity` | correction does not extend life or alter combat |
| player, observer, keyframe, delta, late join, baseline recovery | registered entity type 4 | `exact-ported` through the shared registration | every peer accepts the same legal birth sample |
| save/rejoin and world/run retirement | authoritative Boneyard ownership | `verified-already-at-parity` | no compatibility repair or persisted-state rewrite |
| enemy types 2/3/5/6, loot type 7, goodie type 8 | independent registered families | `out-of-system` | retain their existing field-specific validators |

No member is `blocked-by-platform`. The renderer already accepts phase five;
the mismatch occurs before reconstruction and presentation.

## Native ownership and recovered behavioral contract

- Coffin authority consumes the private RNG and stores the raw native phase.
  Renderer and clients do not redraw it. Snapshot projection is therefore
  required to transmit the endpoint rather than clamp or wrap it early.
- Wire quantization is round-to-nearest at scale 1,024. The correct registered
  domain is the closed integer interval `0..5120`, even though ordinary
  post-construction phases are half-open after their modulo-five tick.
- `5121` and every negative/non-integer/non-finite representation remain
  invalid. This is one field-specific maximum, not a generic permissive
  entity decoder.
- The first bad frame may disappear on the next Maggot tick, which explains
  why reconnect can succeed. Another Coffin birth can independently reproduce
  it, explaining the second simultaneous two-client rejection at a different
  sample index.

## Web implementation consequence and validation contract

- Keep Coffin/Maggot RNG order, phase storage, projection, render selection,
  tick wrap, combat, and teardown unchanged. Correct only the registered
  Maggot emergence-phase maximum from half-open to closed.
- Advance the exact-match gameplay protocol to 100 so an endpoint-rejecting
  client cannot join a corrected host.
- Red/green regression: the real seed-6253 Coffin constructor must retain its
  `4.9995659198611975` witness; component 15 must encode as `5120`; a keyframe
  and delta reconstruction must accept it; `5121` must still reject.
- Unaffected-family sweep: all registered descriptor/sample fixtures remain
  strict, including cyclic headings, normalized projectile phases, loot
  family bounds, and Maggot orientation/state fields.
- Mac browser acceptance: two independently connected clients share a real
  Boneyard, consume an authoritative endpoint Maggot birth, remain connected
  through subsequent phase wrap, and report no page, console, response,
  protocol-close, or host errors.
- Canonical gate: exact candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

## Publication-candidate validation receipt

- Candidate base: latest `origin/main`
  `36b140621ed99217f062a422a5731123bf54fe09`, including protocol-99
  Frost/Chill authority, save schema 19, Hub trader lifecycle, and subdued
  Boneyard player lighting. Protocol 100 changes only the enumerated
  welded-presentation ceilings plus Maggot emergence component `5120`; `5121`
  and all malformed or above-ceiling sibling values still reject.
- Red proof: real Coffin constructor seed
  `maggot-replication-endpoint-6253` produced phase
  `4.9995659198611975`, which encoded as `5120`; pre-fix focused tests passed
  `94/95` and failed only endpoint registration. Native RNG seed `18827`
  independently constructed Blizzard rotation `360` before decoding.
- Focused green: pinned TypeScript passed and the Coffin constructor, entity
  reconstruction, complete game protocol, and save-message suites passed
  `135/135`; phase `5` reconstructs and `5121` remains rejected.
- Browser green: Mac Chrome `151.0.7922.174`, two isolated 1600x900 contexts,
  one fixed-tick host/Boneyard. Both clients decoded Maggot id 5 at component
  `5120` on tick 1,135 and component `1280` after wrap on tick 1,240; the host's
  first wrapped component was `256`, and the endpoint remained authoritative
  for 100 host ticks. Both peers also decoded build-1004 Blizzard, exact
  rotation `360`, two channel actors, at least three glows, and direct/chain
  Cold/Stun/damage while the outside target remained untouched. All error
  arrays were empty.
- Browser evidence:
  `/Users/jarrett/codex-evidence/blizzard-maggot-crash-20260828-root-publish/solomon-primary-blizzard-boneyard.png`,
  SHA-256 `5f6df5b97c3a2eb8238baf2ddfcf3fb060f27c0d53335b2287686a811319ff18`.
- Exact-tree gate: all 12 changed files were byte-identical on local and Mac
  trees. `/opt/homebrew/bin/bash ./scripts/validate.sh` passed on pinned Node
  22.17/npm 10.9.2: backend build zero warnings/errors; 28 Website/backend
  contracts; lint with only 18 existing warnings and zero errors; pre-Boneyard
  `314/314`; Boneyard `1,729/1,729`; every other frontend group, Hub UI
  `86/86`, desktop `5/5`, production frontend/game-host builds, bundle budget,
  and media/CSP policy. `Game-Ca7cIPSj.js` measured 258,257 raw and 78,106 gzip
  bytes under the 524,288 / 134,144 caps.
- This receipt is the sole post-gate edit. No runtime, test, build, or browser
  harness byte changed after the successful publish-base gate. Publication and
  deployment remain separately receipted operations.
