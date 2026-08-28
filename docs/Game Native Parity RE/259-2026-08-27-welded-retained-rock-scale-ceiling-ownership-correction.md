# 2026-08-27 — Welded retained-rock scale-ceiling ownership correction

## Crash and reopened parity boundary

- Production diagnostics 53 and 54 captured two protocol-89 clients at
  `2026-08-27T19:24:22Z` and `2026-08-27T19:26:50Z` closing with code 4008:
  `frame.primarySpells.transients[0].maximumScale must be positive` and the
  same failure at transient index 2.
- A base Ether+Earth or Water+Earth weld learns both primary rows while Bind
  Rocks row 43 remains rank zero. The exact rebuilt vectors consequently carry
  zero in build-1006 slot 4 and build-1008 slot 3. Current Website copied that
  optional toughness lane into `maximumScale`, producing an invalid zero actor
  before the first retained-spell tick.
- This reopens the retained Earth-weld construction boundary only: player
  selected-primary field assembly, EBoulder/Hail handler copies, held growth,
  release, strict protocol, observer/late-join hydration, and no-Bind/positive-
  Bind membership. Vector reconstruction remains closed and unchanged.

## Evidence and ownership trace

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production failure | Website `DiagnosticLogs` rows 53/54 and attached protocol-89 client archives | Both peers reject host-owned welded persistent actors because `maximumScale` is zero; the host session remains alive. | high |
| Exact vector goldens | `native-weld-primary-profile.test.ts`; `PlayerWizardSkills::RebuildWeldedSpell 0x00666020` | Base build 1006 is `[5.5,15,1,1,0,1]`; base build 1008 is `[1.3125,14.75,1,0,0,0]`. Zero is the native no-Bind toughness input, not a corrupt save or missing field. | high |
| Selected-primary assembly | fresh raw instructions in `0x00548B00`: build-1006 block `0x0054A7C0..0x0054A7EC`; build-1008 block `0x0054AAF8..0x0054AB5C` | Each block copies its vector toughness into player `+0x29C`, copies growth into `+0x2A0`, and independently executes `FLD1; FSTP [ESI+0x2A4]`. The scale-ceiling producer is literal one. | high |
| EBoulder handler | `0x00545360`, instructions/decompile `0x00545488..0x005454A6` | Actor toughness `+0x1E8` receives player `+0x29C`; actor ceiling `+0x1FC` separately receives player `+0x2A4 * .75`. Native held ceiling is always `.75`, including no-Bind. | high |
| Hailstones handler | `0x00545C20`, raw instructions `0x00545CC9..0x00545CDB` | Actor toughness `+0x1E8` receives player `+0x29C`; actor ceiling `+0x1FC` separately receives player `+0x2A4`. Native held ceiling is always one, including no-Bind. | high |
| Current web causal trace | `native-weld-primary-runtime.ts` and `game-protocol.ts` at Website `d62ed095` | Constructors derive ceilings from the toughness vector, and decoders assert the same false relation. Positive-Bind-only actor fixtures made the two values appear causally related. | high |

The ranked alternatives are closed. Fresh base vectors reproduce the zero
without save restoration, so save corruption is falsified. The actor is born
with the bad ceiling, so release-time copying and delta reconstruction are
falsified. The full host frame contains zero before client interpolation, so
transport loss is falsified.

## Complete retained-rock membership

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Build 1006, Bind rank zero | `0x0054A7C0..0x0054A7EC`, `0x00545488..0x005454A6` | `exact-ported` by this correction | toughness stays zero; held ceiling is float32 `.75`; initial `.18` and all growth remain within the ceiling; strict frame round-trip succeeds |
| Build 1006, Bind positive | same owner | `exact-ported`, corrected | toughness follows vector slot 4 while ceiling remains `.75`; changing Bind cannot change maximum size |
| Released EBoulder children | `0x005FA6D0` | `verified-already-at-parity` | each released child's ceiling becomes its actual released scale; no constant held ceiling is reintroduced after split |
| Build 1008, Bind rank zero | `0x0054AAF8..0x0054AB5C`, `0x00545CC9..0x00545CDB` | `exact-ported` by this correction | toughness stays zero; held and released carrier ceiling is one; initial `.18`, rock rebuild buckets, and strict frame round-trip succeed |
| Build 1008, Bind positive | same owner | `exact-ported`, corrected | toughness follows vector slot 3 while ceiling remains one; changing Bind cannot change maximum size |
| Build 1007 Meteor Swarm | separate field/channel owner | `out-of-system` | no retained rock carrier or `maximumScale` field |
| Hub, Boneyard, observer, late join | shared authoritative primary-spell frame | `exact-ported` by the same state correction | protocol 90 host constructs once; every client decodes the same finite positive ceiling without local repair |
| owner release/death/disconnect/world teardown | existing retained-primary lifecycle | `verified-already-at-parity` | actor removal and loop/provider cleanup remain unchanged |

The contemporaneous `primaryCast.targetId is only valid for Air` and Staff
`proc sound does not match its outcome` diagnostics are independent player-cast
and Staff-contact state machines. They do not consume welded retained-rock
ceiling/toughness fields and are outside this crash boundary.

## Web consequence and validation contract

- Give held EBoulder and Hailstones explicit native scale-ceiling constants of
  `.75` and `1`. Keep vector toughness untouched, including its valid zero.
- Make strict protocol assert each held/carrier ceiling against the independent
  native constant. Retain the released EBoulder invariant that each child's
  ceiling equals its actual release scale.
- Bump protocol 89 to 90 for a clean host/client cutover. The field shape and
  save schema 18 stay unchanged, but a protocol-89 client asserts the refuted
  toughness-derived relation and is not compatible with corrected host state.
- Regression coverage must start from both exact base vectors, construct each
  actor, advance its held growth lane, and round-trip the authoritative frame.
  Positive-Bind siblings must prove toughness changes without changing either
  ceiling; released EBoulder children must retain their actual scale ceilings.
- Run focused kernel/protocol tests, the full Mac Website gate, and a real Mac
  browser journey casting no-Bind Ethereal Boulder and Hailstones. Acceptance
  requires both peers to remain connected with no page, console, failed-
  response, or protocol diagnostics.

## Implementation and validation receipt

- Runtime construction now owns explicit float32 held ceilings: `.75` for
  Ethereal Boulder and `1` for Hailstones. Strict protocol 90 consumes those
  same constants, while the vector and actor toughness fields retain native
  zero/positive Bind values. Released EBoulder children still replace the held
  ceiling with their actual release scale; save schema 18 is unchanged.
- The focused Mac red run on exact base `d62ed095` failed four assertions:
  positive-Bind EBoulder produced `1.125` instead of `.75`, no-Bind EBoulder
  produced zero, the positive-Bind sibling repeated `1.125`, and the no-Bind
  strict frame rejected the claimed native cap. After the correction, the
  runtime, protocol, and save selection passed `65/65`, including both exact
  base vectors, positive-Bind independence, held growth, EBoulder split, strict
  cap rejection, and protocol-90 clean cutover.
- The same detached Mac source candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build zero warnings
  and errors; `26/26` Website/backend contracts; formatting, lint, generated
  checks, and all `2,431/2,431` frontend/desktop tests; production frontend and
  game-host builds; bundle budget; and CSP/media policy. `Game-6bdyF2hl.js`
  measured `479,117` raw / `134,111` gzip bytes under `524,288 / 134,144`.
  Gate stdout SHA-256 is
  `1a679d9d874ffcb5543830f75820e1137cfeb9b01a165438f8a45a7eefa4d139`.
- Mac Chrome `151.0.7922.174` and an independently connected protocol observer
  exercised the exact failing wire/render boundary through controlled
  authoritative actors created by the production kernel. Both clients carried
  no-Bind build 1006 at held scale `0.18000000715255737`, maximum `.75`, and
  toughness zero; the browser rendered the actor through WebGL2, and release
  carried maximum/actual scale `0.18000000715255737` to both peers. Both clients
  carried no-Bind build 1008 at the same held scale, maximum `1`, and toughness
  zero, and Chrome rendered it through the same world route. Hail's empty-rock
  controlled release was not used as a flight receipt; the exact per-rock
  release family remains covered by the green native runtime/protocol suites.
  Browser page/console/request arrays were empty and the observer decoder error
  was null. Visual review confirms distinct visible Ether-rock held/flight and
  Hail carrier programs in the live lit Arena without missing-world or blank-
  frame artifacts. Retained capture SHA-256 values are
  `773211dc3da71ed4a967acf838c919bdde2e24b7b0f0964c50f37cf895d66b9e`
  (1006 held),
  `2c5f6f7cdd1a46057c96901067e30c6dbbf27afb35da85d35a6419b7f1b1a2e6`
  (1006 flight), and
  `133fd3d8946cf6f64aadbd8b047b5345d1921e1185e18f279ca9bc24b7ac91d1`
  (1008 held). No production deployment or service restart was performed by
  this acceptance run.
