# 2026-08-22 — Enemy status-scalar reset and temporary-control lifecycle reopening

## Reported smell and parity question

- Reported web behavior: Frost Jet can leave enemies frozen permanently.
  Lightning Stun may exhibit the same behavior.
- Stock behavior to recover: temporary enemy control must affect only the
  modifier's live ticks and must restore the target's authored movement,
  action, and damage values on expiry.
- Reproduction: spawn one ordinary Boneyard enemy, apply one tick of Frozen,
  then step with no effect. Before correction its stored `baseSpeed` and
  `attackSpeed` change from nonzero values to zero and remain zero. The same
  isolated trace leaves ColdSlow/Stun at half speed, Dazzle at its first ramp
  fraction, and Turn Undead damage at its already-scaled value after the
  effect input is removed.
- Membership rescan: the same aggregate currently aliases Magic Circle's
  `Mod_CircleSlow` to `Mod_ColdSlow`, omits ColdSlow material on base Frost Jet
  and Cold Aura, and selects the minimum of simultaneous ColdSlow/Frozen/Stun/
  Dazzle factors. Native keeps separate modifier instances and multiplies
  their current factors from a fresh scalar.
- Falsifiers: an effect record surviving the trace, a continued primary
  channel, a client-only stale snapshot, or stock rewriting its authored base
  speed would disprove the leading cause. The isolated host trace and native
reset instructions disprove all four.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | pinned retail `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `0x00625680` | Each live tick resets actor `+0x120` to `1.0f`, clears transient modifier state, then invokes every target-owned modifier's apply slot `+0x1C`. | high |
| Instructions | ColdSlow `0x00623080/0x00628000`; CircleSlow/Stun `0x006231B0`, Stun merge `0x00625850`; Frozen `0x006236E0/0x00623730/0x00626620`; Dazzle `0x00623490/0x006263D0` | Slow/freeze/stun/dazzle multiply the fresh current-tick scalar and own bounded clocks/merges; none mutates an authored enemy speed table. | high |
| Instructions | Badguy tick `0x004835F0`; movement `0x004763E0/0x00476B90`; Turn Undead `0x00647EF0` | Zero scalar suspends the current hostile tick; nonzero movement consumes the scalar. Turn Undead weakens once at its untouched flee sentinel, not once per update. | high |
| Web host repro | `boneyard-enemy-store.ts` on pre-correction base `d2ed2c31`; Node 22.17.0 isolated store trace | The old tick-effect helper multiplied immutable `config` fields and the returned actor persisted that clone. Frozen produced permanent zero; ColdSlow/Stun/Dazzle and Weaken permanently compounded or retained scaled authored values. | high |
| Web source census | target-effect producers in `boneyard-spell-combat.ts`, `native-secondary-abilities.ts`, `player-staff-combat-system.ts`; consumer `boneyard-enemy-store.ts` | One shared consumer defect reaches all ordinary Boneyard families and every listed control producer. Maggots already compose the scalar directly into the current movement/damage operation without rewriting stored state. | high |

## System boundary and membership inventory

Native system: the target-owned temporary modifier manager and the Website
enemy-store consumer that composes current-tick movement/action/damage scalars
without changing immutable authored enemy configuration.

| Member | Native/Web source | Disposition | Proof |
| --- | --- | --- | --- |
| Frozen — Ring of Ice `35`, Call Comet `76` FreezeWave | `0x005FFDC0`, `0x006236E0/0x00623730`; `freeze-wave` | exact-ported | full stop, thaw ramp, expiry restoration tests plus live Ring-of-Ice receipt |
| ColdSlow — Frost Jet `32`, Cold Aura `37`, Frost Missile `1001`, Blizzard Beam `1004`, Hailstones `1008` | `0x00543860`, `Mod_ColdSlow 0x1B69`; primary/weld contact producers | exact-ported | bounded/material-owning slow, composition tests, and live Frost Jet expiry |
| CircleSlow — Magic Circle `49` | `0x005FB020`, `Mod_CircleSlow 0x1B70`; `magic-circle` | exact-ported | separate refreshed 20-tick scalar and cold-material expiry regression |
| Stun — Lightning `24`, Flame Lash `1003`, Blizzard Beam `1004` | `0x0053F9C0`, `Mod_Stun 0x1B6A`; Air/weld channel producers | exact-ported | fixed/merged clock, multiplicative composition, and live Lightning expiry |
| ElectricBurn-delivered Stun — Magic Trap Air `50`, Ball Lightning `1002`, Ground Spark `1009` | `Mod_ElectricBurn 0x1B6B`; burn tick to `Mod_Stun` | exact-ported | repeated 25-tick refresh without exponential decay |
| Dazzle — Ring of Fire `21`, Magic Shield `54`, Mindblast, staff Knockback, Flash response | `Shockwave 0x005FF8C0`, `Mod_Dazzle 0x1B6E`; shared dazzle state | exact-ported | recovery ramp, multiplicative composition, and immutable-config sweep |
| Turn Undead weaken/flee `77` | `0x00647EF0`; persistent `weakenFactor`, bounded `fleeTicks` | exact-ported | one fixed weaken factor across repeated ticks/casts |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, Coffin | common Badguy modifier/reset path; Website ordinary actor loop | exact-ported | five scalar classes across every family without config drift |
| Coffin-owned Maggot | common native actor modifier path; Website `stepMaggots` | verified-already-at-parity | direct current-step scalar/damage composition; no stored rewrite |
| Burn, EtherBurn, FrostBurn, Poisoned, Prismatic, Steamed | non-scalar modifier callbacks and Website target effects | verified-already-at-parity | source census shows no authored-config mutation |
| Knockback, Pushback, Dampen disruption, flee steering | position/action branches, not base-stat multipliers | verified-already-at-parity | separate position/action ownership remains unchanged |
| Staff Disabling Hit | stock one-time permanent target mutation | out-of-system — permanence is authored behavior | existing permanent-composition tests |
| Webbed/Spider/Cocoon | `Mod_Webbed 0x1B79`; absent Website survival family | out-of-system — story-only family is not spawned by this port | existing enemy-family boundary |
| Player ColdSlow/Dazzle | player modifier/progression lane | out-of-system — separate `player-combat.ts` owner | existing countdown and restoration tests |

## Native ownership thread and recovered behavioral contract

- Common actor construction seeds the scalar, but `0x00625680` owns its
  repeated reset. It walks the target's modifier manager in stable list order;
  each active modifier contributes to the fresh scalar for that tick.
- `Badguy::Tick` and its movement/action consumers read the composed scalar.
  Expiry removes the modifier contribution; no inverse multiplication or base
  stat repair exists or is needed.
- ColdSlow/CircleSlow/Stun merge maximum remaining duration and minimum factor.
  Those merge rules are same-class only. Distinct live modifier classes remain
  separate target-owned list members and multiply their factors; Dazzle's ramp
  multiplies the already-composed scalar. Every ColdSlow applies cyan material,
  while CircleSlow shares Stun's scalar-only callback and owns no material.
  Frozen owns its final-200-tick `+0.005` thaw ramp. Dazzle advances from
  `1/duration` to one. Turn Undead applies its weaken factor once and only
  refreshes flee on later casts.
- Website effect clocks and merge rules already expire correctly. The defect
  is downstream: the ordinary actor consumer materializes a scaled `config`
  clone and stores it as the next authoritative actor. Maggots use the correct
  transient pattern.

## Nearby-system findings

- Enemy spawn `config` is also the immutable replicated descriptor source.
  Persisting a status-scaled clone violates both gameplay restoration and the
  descriptor/dynamic-sample boundary.
- Staff Disabling Hit is intentionally cumulative and permanent in stock; it
  remains in the explicit `staffActionFactor`/`staffMovementFactor` lane and
  must not be swept into temporary modifier restoration.
- Durable native report updated:
  `Mod Loader/docs/reverse-engineering/native-movement-and-tick.md`.

## Confidence and open questions

- Confirmed: native reset/apply order, all scalar-writing modifier subclasses,
  every current Website producer, all nine survival enemy families, timer
  expiry, and the host-side persistence repro.
- Inferred: none material.
- Unknown: none. The browser host can represent the fixed-tick reset exactly;
  no member is blocked by platform constraints.

## Web implementation consequence

- Keep authored `BoneyardEnemyActor.config` immutable. A temporary effect may
  provide a current-tick actor view to movement/action/contact logic, but the
  returned store must retain the unmodified source config.
- Preserve the existing merge clocks, Frost thaw material/timing, Dazzle ramp,
  effect replication, Maggot path, and intentionally permanent staff-disable
  factors. Do not add inverse repairs, expiry callbacks, fallback base speeds,
  or spell-specific release patches.
- Split CircleSlow from ColdSlow state and clocks, mark every actual ColdSlow
  producer as material-owning, and derive the current scalar by multiplying
  active class factors. Replicate the newly authoritative CircleSlow state;
  do not infer it from a nearby Magic Circle on clients.

## Validation contract

- Add the original deterministic Frozen expiry repro and a Stun active/expiry
  trace at the real enemy-store seam.
- Sweep ColdSlow, Frozen, Stun, Dazzle, and Weaken across all eight ordinary
  families, proving that active ticks never rewrite `config` and expiry needs
  no repair. Retain Maggot transient-scalar coverage.
- Retain producer contracts for every primary, weld, secondary, equipment,
  staff, and target-effect member above; run the canonical Website gate.
- Browser: cast Frost Jet and Lightning Stun against live Boneyard enemies,
  release each channel, wait beyond its modifier clock, and prove movement
  resumes with no page, console, protocol, asset, or WebGL errors.

## Implementation validation receipt

- The host now treats scaled enemy config as a current-tick view and restores
  the same authored config object at the store boundary. There is no inverse
  repair, fallback speed, or spell-specific expiry callback.
- `NativeSecondaryTargetEffectState` now keeps CircleSlow separate from
  ColdSlow, derives the complete scalar by float32 multiplication across live
  ColdSlow/CircleSlow/Frozen/Stun/Dazzle factors in retained attachment order,
  and makes every real ColdSlow producer own its cyan material. Strict protocol
  56 carries the two CircleSlow fields, bounded order, and composed scalar.
- Focused status, primary/weld producer, enemy-family, secondary, and protocol
  coverage passed `202/202`. The eight-family matrix exercises ColdSlow,
  CircleSlow, Frozen, Stun, Dazzle, and Weaken on first, refreshed, and expired
  ticks; dedicated assertions prove Frozen stop/recovery, half-speed Stun then
  full progress, fixed Turn Undead damage, modifier multiplication, and
  ColdSlow material clearing while CircleSlow remains.
- The exact integrated Mac tree based on `db3c1f4f` passed the canonical
  Website gate with `16/16` backend contracts, `4/4` library, `43/43` loot,
  `233/233` prerequisites, `1337/1337` broad runtime, `9/9` weather, `42/42`
  party, `11/11` level-up, `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI,
  and `5/5` desktop tests, plus backend build/formatting, lint/import
  boundaries, production frontend/game-host builds, media policy, and bundle
  budget (`416581` raw / `116674` gzip bytes).
- The same Mac ran the Loader's complete static RE suite under Homebrew Python
  3.12 with Pillow: `504/504`. Apple system Python was rejected as evidence
  because it lacks the required language/library features.
- Hardware Chrome `151.0.7922.170` used WebGL2 and real browser input against
  one live Skeleton. Frost Jet published `coldSlowTicks=25`, factor `.5`, and
  cyan material with modifier order `[cold-slow]`; max-rank Lightning published
  `stunTicks=25`, factor zero, and order `[stun]`. After release, both effects
  disappeared and the same actor moved `1.1366355419158936` units with authored
  config unchanged. The sibling
  maximum Ring-of-Ice journey also retained Frozen `1210`, FrostBurn `121000`,
  204 ring primitives, and exact target ownership. Page, console, HTTP,
  protocol, asset, and WebGL error arrays were empty.
- Mac evidence under
  `/Users/jarrett/Projects/Solomon Dark/.codex-evidence/status-effects-20260822-root/`:
  Frost active `3fce801c1ad2ebe5da84d50ab903868257cc3fc7c2235e7b64db998c966cf0c0`,
  Frost recovered `0aaacb4f86e6824157b0912aa6a1cda1bda5e831e625eee38fed9df5554c7348`,
  Lightning active `a90ccbdc3a841282f4de170b9a4965087da141a96ef3cc04ec85462df4daa195`,
  Lightning recovered `4c47bbd2f0481e56be2ece8190fb2322b0f7e8486e1ea93673aa154a5b5eac4b`,
  and Ring of Ice `81f3a201b876a2063d2a08266fcebdff2e1581248f4afbd0ae9907b93ba490ba`.
- No member is blocked by the browser platform and no material unknown remains.
  The WSL SwiftShader renderer-start timeout was non-decisive; Mac hardware
  proof is decisive. This change is approved for publication to `main`;
  deployment remains a separate operation and is not part of this receipt.
