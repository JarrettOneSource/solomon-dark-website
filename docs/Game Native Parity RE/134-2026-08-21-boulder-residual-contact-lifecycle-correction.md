# 2026-08-21 — Boulder residual-contact lifecycle correction

## Reported smell and parity question

- Reported web behavior: the Earth Boulder appears to explode on the first
  enemy instead of mowing through a crowd.
- Stock behavior to recover: determine whether actor contact is a fixed pierce
  count, unconditional terminal impact, or residual-pool lifecycle; close the
  complete shared contact owner rather than changing only ordinary Earth.
- Reproduction inputs/scenes: short, 170-tick, full, Rock Surge, Gargantuan,
  Bind Rocks, and low-mana releases in Hub/Boneyard; one high-HP target,
  multiple weak targets in one query, later distinct targets, repeated target,
  terrain, zero pool, and positive pool at or below `0.001`.
- Falsifiers: any instruction deleting on every actor contact; any fixed
  pierce counter; a target missing from the actor-local ledger after accepted
  contact; a surviving actor retaining its old radius/shell; or a contact
  which creates no independently retained BoulderBit.

This reopens the prior row-40/v49 closure. The earlier pass stopped after the
damage-pool subtraction and target ledger. It skipped the downstream
`0x006212E5..0x00621365` charge writer, `0x0060BC10` child constructor,
`0x005FA4B0` retained-rock rewrite, and shared-family xrefs. Calling Boulder
closed while those extractable paths were absent violated the system-boundary
and complete-membership rules.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail binary | unmodified Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`, freshly re-hashed 2026-08-21 | Exact image supplying every address and constant below. | high |
| Fresh instructions | Ghidra 12.0.3 read-only replica; contact `0x00620B60`, pool/charge block `0x00621293..0x00621321`, threshold/traversal `0x00621326..0x0062135C`, post-contact `0x005FA4B0`, vector length `0x004029A0`, contact child `0x0060BC10` | Proves residual pool, same-target exclusion, shrink expression, one child per accepted target, retained-shell radius rewrite, and distinct traversal/retirement thresholds. | high |
| Fresh membership sweep | direct `0x00620B60` vtable references `0x0079E078` and `0x0079E168`; EBoulder override caller `0x00621450`; ordinary/EBoulder terminal vslots `0x0060B700` / `0x0060BED0`; Hail release `0x005FBDE0` | Complete shared-function family is ordinary Boulder, EBoulder override, and an inherited-but-bypassed Hail slot. | high |
| Static data/assets | `boulder.cfg`, `bind_rocks.cfg`; `BadGuys[168..171]` and lit `BadGuys[2008..2010]`; audio 77 `rockhit`, 89 `stonebreak`, 87/159/168 cast loops | Rank damage and toughness tables feed the pool; survivor and terminal children use the already extracted lit-rock bank; contact adds no cue, while terminal owns both breakup cues. | high |
| Current web | deployed/current-main `c9600ce195a30989c7625bffd2368cc50acf8817`; `native-earth-boulder.ts`, `boneyard-spell-combat.ts`, `native-weld-primary-runtime.ts`, renderers/protocol | Pool continuation exists, but ordinary/EBoulder survivors retain the old charge/shell radius; ordinary contact omits the one BoulderBit; EBoulder terminal omits its full native breakup. | high |

No new clean-stock crowd capture is required to interpret the branch: the
complete instructions directly expose both the survivor and terminal paths.
Historical injected observations remain corroboration only.

## System boundary and membership inventory

Native system: the actor-contact portion of the `Boulder` inheritance family,
from released pool/charge fields through ordered target traversal, retained
body mutation, child registration, terminal breakup, replication, and teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Ordinary Boulder `0x7D5`, normal partial/full release | `0x005E5450`, `0x00620B60`, vtable ref `0x0079E078` | `exact-ported` | Shared contact kernel and Boneyard multi-target tests pin pool, shrink, child count, shell radius, and terminal decision. |
| Low-mana Boulder with positive release base | `0x00544C60`, same release/contact owner | `exact-ported` | Repeated half, `.25` pool floor, finite/clamped charge result, contact child, and terminal regression. |
| Underflowed zero-base low-mana terminal contact child | `+0x1F8=0`, `Pnext=0`, x87 `0/0` in `0x006212EB..0x0062131E` | `blocked-by-platform` (strict JSON protocol cannot encode the native NaN child scale) | Host consumes the exact contact-child RNG program but omits the non-finite/unrenderable registered child; parent terminal breakup remains exact. |
| Hasten Rocks row 42 | charge producer only | `verified-already-at-parity` | Existing float32 growth/profile tests; no separate contact branch. |
| Bind Rocks row 43 | toughness at `+0x1E8`; pool subtraction `0x006212A5` | `exact-ported` | Per-rank profile plus multi-target tests prove outgoing payload unchanged and pool spend divided by `2*toughness`. |
| Rock Surge row 44 | immediate release through ordinary finalizer | `exact-ported` | Release writes actual charge ceiling and enters the same contact result. |
| Gargantuan row 47 | held ceiling writer; release `+0x1FC` replacement | `exact-ported` | Partial Gargantuan release test proves shrink uses actual released charge, not the earlier held ceiling. |
| Distinct-target ledger and same-target exclusion | list `+0x200`, lookup/add vslots `+0x24/+0x10` | `exact-ported` | Same-tick and later-tick tests reject repeat damage and retain ordered IDs. |
| Positive residual above `0.001` | `0x00621326..0x0062135C` | `exact-ported` | Actor continues through later candidates/ticks. |
| Positive residual at or below `0.001` | same comparison; retirement check `0x005FA630..0x005FA64C` | `exact-ported` | Stops current traversal but remains a live Boulder until a later contact/terrain/teardown. |
| Per-contact BoulderBit | `0x0060BC10`, `Anim_BoulderBit`, `ZAnimLitObject` | `exact-ported` | Exactly one host-owned, protocol-carried child per accepted target, including a terminal target; 2008..2010 renderer/lifecycle test. |
| Surviving shell/bounds/light update | charge writer `0x006212E5..0x00621321`, `0x005FA4B0 -> 0x004029A0`, provider `0x005E5670` | `exact-ported` | Count/variant/scale remain assembly-owned while local radius, body bounds, collision, aura/root/bias and light consume reduced charge. |
| Ordinary zero-pool/terrain terminal | `0x0060B700`; audio offsets `+0xD54/+0xF64` | `exact-ported` | Full breakup, Region-lit fragments, rockhit/stonebreak pitches/gains, terrain, rolling-loop stop, and teardown tests; actor contact adds its preceding one-child edge. |
| EBoulder `0x7E1`, every one-to-four released child | `0x005FA6D0`, `0x00621450 -> 0x00620B60` | `exact-ported` | Each child owns release scale/base/pool/list, shrink, contact bit, provider, and independent survival. |
| EBoulder terminal | vslot `0x0060BED0`; same audio offsets | `exact-ported` | Ether FadeMM/light, complete registered BoulderBit breakup, rockhit/stonebreak pair, loop balance, and removal regression. |
| Hailstones `0x7E4` | inherited vtable ref `0x0079E168`; reachable release/contact `0x005FBDE0` | `out-of-system` (released Hail owns per-rock substeps, pools, line/fade children, and no whole-carrier Boulder shrink) | Existing per-rock Hail contact suite remains unchanged and a negative assertion rejects shared-result use. |
| Enhanced Effects On | BoulderBit draw `0x00457E40` | `exact-ported` | Website's reachable fixed `ENHANCED EFFECTS: ON` path retains the airborne same-record black shadow and ordinary lit main copy. |
| Enhanced Effects Off | same draw gate | `out-of-system` (the current Website Settings surface exposes Enhanced Effects as fixed On; enabling the broader native setting is not owned by Boulder contact) | Particle state keeps the native gate explicit; no false claim that Off is currently selectable. |
| Hub free flight, Boneyard contact, multiplayer observer/late join | shared spell state/protocol | `exact-ported` | Hub never invents enemies; Boneyard authority mutates once; snapshot/protocol and browser checks retain actor/children independently. |
| Owner death/disconnect/world replacement | primary-spell owner cleanup and world teardown | `verified-already-at-parity` | Existing cleanup removes parent and registered children and balances rolling audio. |

The only `blocked-by-platform` member is the underflowed zero-base terminal
contact child. A user-visible difference is not expected: stock feeds NaN into
that one child's transforms before immediately running the finite full breakup,
while the browser cannot serialize NaN and therefore shows only the same full
breakup. The registered child count differs internally for that pathological
held-zero-mana case; its RNG budget is still consumed.

## Native ownership thread

- Owner and construction path: row 40 dispatcher `0x00544C60` creates one
  `Boulder 0x7D5`; weld handler `0x00545360` creates retained
  `EBoulder 0x7E1`, whose release `0x005FA6D0` produces independently
  registered children.
- Upstream state: release-base `+0x1F8`, pool `+0x1F4`, toughness `+0x1E8`,
  released charge ceiling `+0x1FC`, and per-tick saved pre-contact charge
  `+0x1F0` are actor fields. Bind/Hasten/Surge/Gargantuan change only their
  documented inputs.
- Contact state: movement and orientation commit first. One pre-contact
  `75*charge` mask-6 query returns native order. The actor-private `+0x200`
  handle list prevents repeats.
- Downstream state: every accepted target updates pool and charge, creates one
  registered BoulderBit, then the post-contact helper rewrites retained-rock
  radii and bounds. Zero pool invokes the concrete terminal vslot; positive
  pool retains the same actor identity.
- Teardown: registered children outlive the parent; parent destruction clears
  rock and contact-list allocations. World/owner teardown removes each
  semantic actor through existing ownership, never renderer inference.

## Recovered behavioral contract

Given release-base `B`, current pool `P`, target current HP `H`, toughness `T`,
and actual released charge ceiling `R`:

```text
payload = min(H, P)
spent = P < H ? payload : payload / (2*T)
Pnext = max(0, float32(P - spent))
Cnext = float32(min(R, R * (1 - (1 - Pnext/B) * 0.35)))
```

When `B=0` and `Pnext=0`, native x87 produces NaN and stores it because the
unordered comparison takes the candidate branch. This is not silently clamped
into a claimed exact value; the protocol constraint and omission are recorded
above.

- Damage is residual, not a pierce count. A target with `H > P` consumes the
  whole pool; a weak target leaves a survivor. Bind Rocks changes `spent`, not
  `payload`.
- Every accepted actor creates one contact BoulderBit at `Cnext`. If `Pnext`
  becomes zero, the later full breakup restores the pre-contact charge, so the
  one child and terminal family coexist.
- `Pnext <= 0.001` stops later candidates in that tick. Only `Pnext <= 0`
  retires the actor. Equality at `0.001` stops traversal and survives.
- Post-contact shell count, variants, and stored sprite scales stay fixed;
  every retained local XYZ radius becomes `30*Cnext`. Bounds become
  `500*Cnext`, collision radius `75*Cnext`; aura, visual offset, sort bias,
  rolling divisor and light consume the reduced charge.
- The query uses the pre-contact radius for its returned same-tick membership;
  sequential pool/charge writes do not retroactively re-query the world.
- Contact has no new audio one-shot. Terminal ordinary and EBoulder paths both
  play registry 77 `rockhit` at pitch `1 + .05/charge` and gain multiplied by
  charge, then registry 89 `stonebreak` at pitch `1 - .5*charge` and ordinary
  positional gain. Start/gather/rolling ownership and terminal balance remain
  otherwise unchanged.

## Web implementation consequence

- Keep `damage` as the native release-base field for Earth/EBoulder and
  `remainingDamage` as the finalized mutable pool. On release, replace the
  held ceiling field with the actual release charge/scale as native does.
- Extend the shared contact result with next charge and the distinct
  same-tick/retirement predicates; consume it from ordinary and Ethereal
  Boulder.
- Add one semantic ordinary-Earth contact BoulderBit state. Reuse the already
  recovered BoulderBit constructor/tick/draw program rather than inventing an
  impact sprite. EBoulder keeps its concrete actor type and adds the missing
  terminal family.
- For the one zero-base/zero-pool NaN child, consume the native constructor
  draws and omit the unserializable child; do not contaminate finite parent or
  terminal state with a browser-only clamp.
- Render retained shell membership from `assemblyCharge/assemblyScale`, but
  normalize shell positions with current post-contact charge/scale.
- Carry the new ordinary child over the strict protocol and client copy/view
  paths. Do not infer it from hit/death events.
- Publish terminal audio from the semantic terminal state: ordinary Earth uses
  its existing charge field; EBoulder impact carries the saved terminal charge
  and its native FadeMM light. Do not infer breakup audio from loop removal.

## Validation contract

- Focused kernel/combat tests: partial/full/zero-base formulas; first-target
  terminal; same-tick crowd continuation; later-target continuation; repeat
  exclusion; equality/sub-threshold survival; Bind Rocks; partial Gargantuan;
  one child per accepted finite target; terminal contact child plus full
  breakup; and zero-base NaN-child RNG consumption without protocol emission.
- Sibling tests: all EBoulder split children use independent bases/pools/scales
  and emit contact/terminal children; Hail remains on its per-rock path.
- Presentation/protocol: shell count and stored scales remain stable while
  radius shrinks; contact bit uses 2008..2010, airborne shadow, Region sample,
  `-15` sort bias and state-driven teardown; malformed protocol rows reject.
- Browser: a real Earth Boneyard journey must charge past its release
  threshold into a weak enemy and capture one frame/state interval containing
  the surviving smaller Boulder,
  remembered target, reduced pool, and independently visible contact bit with
  zero page/console errors.
- Run `./scripts/validate.sh` on the exact final tree and repeat the canonical
  gate plus browser journey on the Mac mini before publication.
