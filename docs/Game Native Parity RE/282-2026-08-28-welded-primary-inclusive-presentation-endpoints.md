# 2026-08-28 — Welded-primary inclusive presentation endpoints

## Reported smell and parity question

- Reported web behavior: both players crashed about one second after Spook
  began holding Blizzard Beam. The production server journal records both
  browser transports closing on the same authoritative frame at
  `2026-08-28T04:16:36Z` with code `4008` and reason
  `frame.primarySpells.transients[26].rotationDegrees`.
- Stock behavior already recovered by the native RNG and Spell Welding
  reports: `RandomFloat 0x00401310` draws `Integer(100001)`, divides by
  `100000`, and therefore includes both zero and the requested positive
  endpoint. A `Float(360)` presentation rotation may be exactly `360`; it is
  not restricted to `[0,360)`.
- Reproduction inputs/scenes: protocol-96 shared Boneyard, two players, build
  `1004` Blizzard Beam held across multiple root/contact glow births. The
  deterministic kernel witness uses native RNG seed `18827`, which makes an
  actual Blizzard contact-glow constructor emit rotation `360`.
- Falsifiers: the rejected field belongs to a normalized gameplay heading;
  `Float(360)` cannot reach its endpoint; the server frame is missing the
  field rather than carrying `360`; or accepting the endpoint changes
  rendering, collision, timing, randomness, or authority.

This is a secondary report against the 2026-08-20 welded-primary closure and
the 2026-08-27 Blizzard contact reopening. Those passes recovered the exact
inclusive RNG primitive and every registered child constructor, but their
strict-protocol sweep tested ordinary interior values only. The omitted
endpoint matrix left the recovered model and the wire contract inconsistent.
This entry reopens every replicated welded-primary presentation field produced
directly by that inclusive primitive, including scale, alpha, pitch, and
rotation ceilings rather than Blizzard alone.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production host journal | NFO `chicago-quad36-h-10-m7b`; deployed Website `9691cd7d1805203a5e98c5fdc2a037f4ea22f11f`; protocol 96; `2026-08-28T04:16:36.202Z..04:16:36.216Z` | Both connected players close with code `4008` on the same `primarySpells.transients[26].rotationDegrees` field; the run retires after the shared rejection while the service remains active. | high-live |
| Bounded client diagnostics | production `DiagnosticLogs` rows 59 and 60, browser-game/96 | Both independent clients decode the same invalid authoritative field, report `connection.failed`, and submit matching diagnostics. | high-live |
| Native RNG instructions/report | retail `NativeRng_Float 0x00401310`; `native-movement-and-tick.md` | Bound `100001`, divisor `100000`, and float32 stores make the requested positive endpoint reachable. | high |
| Welded constructor report | `spell-welding.md`: Frost Missile, Blizzard, Meteor, Hail, and GroundSpark presentation programs | The affected fields are retained results of `Float(360)`, `Float(45)`, or `Float(20)` and are replicated actor state, not renderer-local samples. | high |
| Deterministic constructor witness | current kernel `createNativeWeldBlizzardContactGlow`, native RNG seed `18827`, exact Website base `05f2232a87f3cb36bc01cec3296dd1b6afe6faa7` on the Mac mini | The real constructor returns `rotationDegrees: 360` and finite scale `1.3633599281311035`; no malformed save, delta, or non-finite calculation is required. | high |
| Current web causal trace | `native-rng.ts`, welded constructors, `primary-spells.ts`, `game-snapshot.ts`, and `game-protocol.ts` at `05f2232a` | Authority preserves the native inclusive result, snapshot projection sends it unchanged, and several strict decoder branches incorrectly reject equality at the recovered maximum. | high |

The later protocol-97 `world.entities.samples[...] has an invalid registered
sample shape` reports and their reconnect/authentication follow-ons are a
separate entity-registration incident. They do not consume welded-primary
transients and are not evidence for widening or suppressing this decoder.

## System boundary and membership inventory

Native system: **replicated welded-primary presentation values produced by
inclusive native float draws**, from authoritative constructor/tick RNG through
snapshot projection, player/observer strict decoding, rendering, retention,
and teardown.

| Member / branch | Native source / web producer | Disposition | Proof contract |
| --- | --- | --- | --- |
| Inclusive float primitive and signed variant | `0x00401310`; `drawNativeFloat` | `verified-already-at-parity` | zero and exact positive maximum remain reachable with the recovered float32 schedule |
| Build 1000 Burning Bolt inherited phase | `Float(360)` in inherited Magic Missile constructor | `verified-already-at-parity` | base phase already accepts `360` and later retained phase may exceed one revolution |
| Build 1001 Frost Missile inherited/secondary phase | two constructor `Float(360)` draws | `exact-ported` decoder correction | both phases accept `360`; unrelated normalized flight heading remains `[0,360)` |
| Build 1001 Frost compositor refresh | tick-owned `.5+Float(.25)` aspect, `.5+Float(.75)` scale, and `Float(45)` rotation | `exact-ported` decoder correction | each of two lanes accepts scale `1.25` and rotation `45` while rejecting values above either ceiling; aspect `.75` was already closed correctly |
| Build 1002 Ball Lightning inherited phase | inherited `Float(360)` | `verified-already-at-parity` | base phase endpoint remains accepted |
| Build 1002 Ball Lightning impact rotation | contact `Float(360)` | `exact-ported` decoder correction | impact accepts `360`, rejects values above it, and retains its sound/payload invariants |
| Build 1003 Flame Lash endpoint/chain fades | two `Float(360)` writes; `.5+Float(.5)` endpoint scale or its float32 `*.1` chain scale; `.75+Float(.75)` wrapper; retained `+1` rotation ticks | `exact-ported` scale/wrapper correction; rotation `verified-already-at-parity` | endpoint scale accepts `1`, chain scale accepts `Math.fround(.1)`, wrapper accepts `1.5`, and finite rotation remains uncapped because live state may exceed `360` |
| Build 1004 Blizzard source glow pair | factory `0x005328D0`, each `Float(.5)` then `Float(360)` | `exact-ported` decoder correction | both variant-24 actors accept exact scale/rotation ceilings and remain one-frame actors |
| Build 1004 terrain/root contact glows | handler `0x00541870`, variant 3, `Float(.5)` then `Float(360)` | `exact-ported` decoder correction | every terrain, hostile, and scenery glow accepts `360`; other shape/lifetime checks remain strict |
| Build 1004 chain fade/chaining Frost | `Float(10)`, `Float(.5)`, signed `Float(2)` and inherited Water state | `verified-already-at-parity` | no strict angular endpoint field is projected by these actor shapes |
| Build 1005 Steam Jet | constructor heading plus signed offset, normalized modulo 360 | `verified-already-at-parity` | strict `[0,360)` rotation remains correct |
| Build 1006 Ethereal Boulder debris | multiple `Float(360)` rotations with retained spin | `verified-already-at-parity` | debris decoders already require finite values without an artificial revolution cap |
| Build 1007 Meteor marker | marker `Float(360)` | `exact-ported` decoder correction | marker accepts `360`, rejects above, and retains its alpha/growth clock |
| Build 1007 Meteor impact disc | impact `Float(360)` and weak signed `Float(.2)` pitch around one | `exact-ported` decoder correction | retained impact rotation accepts `360` and weak pitch accepts `Math.fround(1.2)`; fall heading remains separately bounded |
| Build 1007 Meteor debris | five `Float(360)` child rotations plus retained spin | `verified-already-at-parity` | debris decoder already accepts finite rotations beyond one revolution |
| Build 1008 Hail accepted-rock line | `.25+Float(.25)` terminal alpha | `exact-ported` decoder correction | line endpoint alpha accepts `.5`, rejects above, and keeps its 14-tick lifetime |
| Build 1008 Hail enhanced rock birth fade | rock-rebuild `Float(20)` | `exact-ported` decoder correction | FadeFrost accepts `20`, rejects above, and keeps its 20-tick lifetime |
| Build 1008 terrain particles/bouncers | accumulated sector angle or `Float(360)` plus retained spin | `verified-already-at-parity` | both decoder branches already accept finite rotations |
| Build 1009 GroundSpark record-71/fork fades | per-update `Float(360)` | `exact-ported` decoder correction | both fade records accept `360`, reject above, and retain alpha/scale bounds |
| Build 1009 GroundSpark impact | contact `Float(360)` plus `1+Float(.1)` pitch | `exact-ported` decoder correction | impact accepts `360` and pitch `Math.fround(1.1)` while retaining the native variant contract |
| Gameplay aim/projectile heading fields | normalized actor/cast direction | `out-of-system` — not raw inclusive presentation draws | retain strict `[0,360)` validation; no blanket angle widening |
| Player, observer, keyframe, delta-baseline recovery, late join | shared authoritative snapshot decoder | `exact-ported` by the same protocol correction | every recipient accepts the same legal endpoints and still fails closed above them |
| release, replacement, death, disconnect, world/run teardown | existing welded actor ownership | `verified-already-at-parity` | range correction creates no new actors or lifetime extension |

No member is `blocked-by-platform`. CSS/WebGL rotations represent `360`
exactly; it is visually equivalent to zero but remains distinct recovered
authoritative state.

## Native ownership thread and recovered behavioral contract

- The fixed-tick host owns every gameplay-affecting RNG draw. These
  presentation fields are retained only because their native actor tick or
  registered child lifetime consumes them; the browser renderer does not draw
  or repair them independently.
- `RandomFloat(maximum)` owns the closed interval `[0, maximum]`. Equality at
  `360`, `45`, `20`, or a derived float32 ceiling is legal. A value above the
  requested/derived maximum remains corrupt and must still close the strict
  transport.
- Normalized gameplay headings remain half-open `[0,360)`. Flame/Boulder/
  Meteor/Hail retained spin values may exceed one revolution and therefore
  remain finite-only. The fix is field-specific, not a global angle shim.
- Snapshot projection carries the authoritative values unchanged to ordinary
  players and observers. JSON serialization is not the cause: the rejected
  endpoint is finite. Baseline recovery and keyframes do not change the field
  contract.
- Release, low mana, pause/resume, owner removal, and world replacement alter
  births/lifetimes but never retime or normalize an already drawn presentation
  endpoint.

## Nearby-system findings

- The production client error text contains only the field path because the
  Blizzard range branch deliberately reused that path as its exception. The
  value was finite; a missing field or `NaN` would reach the same text, so the
  deterministic constructor witness is required to distinguish them.
- Other primary, secondary, enemy, Staff, and scenery rotations also consume
  native inclusive draws, but they do not share this welded-primary actor
  decoder boundary. No evidence from this crash authorizes broad changes to
  those independent schemas.
- Native report/catalog update: none. `native-movement-and-tick.md` already
  owns the inclusive primitive, and `spell-welding.md` already owns every
  constructor, field, RNG order, and lifetime used here.

## Confidence and open questions

- Confirmed: exact production frame path and two-client scope, deployed
  revision/protocol, inclusive native endpoint, deterministic Blizzard
  constructor witness, every affected welded sibling, and the strict decoder
  mismatch.
- Inferred: transient index 26 was a variant-3 contact glow rather than one of
  the two source glows. Both shapes use the same constructor range and decoder,
  so the correction and proof do not depend on that index-level identity.
- Unknown material to implementation: none. The exact preceding live RNG
  words were not archived, but seed `18827` reaches the same legal constructor
  state deterministically.

## Web implementation consequence

- Keep constructors, RNG ownership/order, actor shapes, and renderers
  unchanged. Correct only the affected strict upper comparisons from half-open
  to closed native intervals.
- Preserve strict normalized heading checks and finite-only retained-spin
  checks. Do not normalize `360` to zero, clamp state, catch decoder errors, or
  add a compatibility fallback.
- Advance the exact-match gameplay protocol so a stale client that still
  rejects legal endpoints cannot join a corrected host.

## Validation contract

- Red/green protocol matrix: exact `360` for Frost secondary phase, Ball
  Lightning/GroundSpark impact, both Blizzard glow variants, Meteor marker and
  impact, and GroundSpark fade; exact `45` and `1.25` for both Frost compositor
  lanes; Flame endpoint/chain/wrapper ceilings `1`/`Math.fround(.1)`/`1.5`;
  Hail line/fade ceilings `.5`/`20`; GroundSpark pitch `Math.fround(1.1)`; and
  weak Meteor pitch `Math.fround(1.2)`. Each maximum must round-trip, and one
  value above each maximum must still reject.
- Kernel witness: native RNG seed `18827` creates a Blizzard contact glow at
  exact rotation `360`; the resulting authoritative actor round-trips through
  the real server-snapshot decoder.
- Unaffected siblings: normalized Steam/projectile headings still reject
  `360`; Flame/Boulder/Meteor/Hail retained spin values above `360` still
  round-trip where their native ticks can produce them.
- Mac browser: two real clients share a Boneyard, hold build `1004` long enough
  to produce source/contact glows, and remain connected through the
  deterministic endpoint injection with empty page, console, failed-response,
  protocol-close, and host-error arrays. The independently connected peer must
  consume the same frame successfully through the shared strict decoder.
- Canonical gate: exact candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.
